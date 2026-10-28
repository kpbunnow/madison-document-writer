"""Health phases retain optional probe I/O, caught errors and live diagnostic reads."""

import json
from pathlib import Path
import random
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import operations_helper as operations

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = operations.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/health_reference.txt").read_text(encoding="utf-8"), "health_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["health"]


def outcome(check, server, probe):
    try:
        return ("result", check(server, probe))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class HealthRules(unittest.TestCase):
    def test_native_probe_cleanup_and_missing_outbox(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            cases, share = root / "cases", root / "share"
            cases.mkdir()
            outbox = share / "outbox"
            outbox.mkdir(parents=True)
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"format": "madison-catalog-manifest", "items": {}}), encoding="utf-8")
            server = SimpleNamespace(
                case_dir=lambda: cases,
                share_root=lambda: share,
                OUTDIR_NAME="outbox",
                resource=lambda name: manifest,
                HELPER_VERSION=operations.VERSION,
            )
            with (
                patch.object(operations.case_lookup, "settings", return_value={}),
                patch.object(operations.case_integrity, "anchor_health", return_value={}),
                patch.object(operations.address_parser, "available", return_value=True),
            ):
                self.assertTrue(operations.health(server, probe=True)["shareWritable"])
                self.assertEqual(list(cases.iterdir()), [])
                self.assertEqual(list(outbox.iterdir()), [])
                outbox.rmdir()
                self.assertFalse(operations.health(server, probe=True)["shareWritable"])
                self.assertEqual(list(cases.iterdir()), [])
                self.assertIsNone(operations.health(server, probe=False)["shareWritable"])
                self.assertFalse(outbox.exists())

    def test_generated_status_and_probe_effect_order(self):
        rng = random.Random(20261028)
        calls, flags = [], {}
        parser_index, clock_index = [0], [0]
        parser_values = (True, False)

        def fail(name):
            if flags.get(name) == "unexpected":
                raise RuntimeError("synthetic " + name)
            if flags.get(name):
                raise OSError("synthetic " + name)

        class Folder:
            def __init__(self, name):
                self.name = name

            def __truediv__(self, leaf):
                calls.append(("join", self.name, leaf))
                return Folder(self.name + "/" + leaf)

            def is_dir(self):
                calls.append(("is_dir", self.name))
                fail("reachError")
                return not flags.get("unreachable")

        class Manifest:
            def read_text(self, **kwargs):
                calls.append(("manifest", kwargs))
                fail("manifestError")
                return "{broken" if flags.get("invalidManifest") else json.dumps({"format": "madison-catalog-manifest", "items": {}})

        class Server:
            @property
            def OUTDIR_NAME(self):
                calls.append(("outdir",))
                fail("outdirError")
                return "outbox"

            @property
            def HELPER_VERSION(self):
                calls.append(("version",))
                return "different" if flags.get("versionMismatch") else operations.VERSION

            def case_dir(self):
                calls.append(("case_dir",))
                fail("caseError")
                return Folder("case")

            def share_root(self):
                calls.append(("share_root",))
                fail("shareError")
                return Folder("share")

            def resource(self, name):
                calls.append(("resource", name))
                return Manifest()

        class ProbeFile:
            def __enter__(self):
                calls.append(("enter",))
                return self

            def __exit__(self, kind, value, traceback):
                calls.append(("exit", kind.__name__ if kind else None, str(value)))

            def write(self, value):
                calls.append(("write", value))
                fail("writeError")

            def flush(self):
                calls.append(("flush",))
                fail("flushError")

            def fileno(self):
                calls.append(("fileno",))
                return 42

        def temporary_file(**kwargs):
            calls.append(("temporary", kwargs["prefix"], kwargs["dir"].name))
            fail("createError")
            return ProbeFile()

        def sync(fd):
            calls.append(("sync", fd))
            fail("syncError")

        def lookup(share):
            calls.append(("lookup", share.name if share else None))
            fail("lookupError")

        def anchor(folder):
            calls.append(("anchor", folder.name if folder else None))
            fail("anchorError")
            return {"configured": bool(folder)}

        def available():
            value = parser_values[parser_index[0]]
            parser_index[0] += 1
            calls.append(("parser", value))
            return value

        def clock():
            value = clock_index[0]
            clock_index[0] += 1
            calls.append(("clock", value))
            return (value,)

        def format_time(pattern, value):
            calls.append(("format_time", pattern, value))
            return "clock-" + str(value[0])

        patches = [
            patch.object(operations.tempfile, "NamedTemporaryFile", temporary_file),
            patch.object(operations.os, "fsync", sync),
            patch.object(operations.case_lookup, "settings", lookup),
            patch.object(operations.case_integrity, "anchor_health", anchor),
            patch.object(operations.address_parser, "available", available),
            patch.object(operations.time, "gmtime", clock),
            patch.object(operations.time, "strftime", format_time),
        ]
        for context in patches:
            context.start()
        try:
            server = Server()
            outcomes = set()
            for index in range(3000):
                flags.clear()
                for name in (
                    "caseError",
                    "shareError",
                    "reachError",
                    "outdirError",
                    "createError",
                    "writeError",
                    "flushError",
                    "syncError",
                    "manifestError",
                    "lookupError",
                    "anchorError",
                    "invalidManifest",
                    "unreachable",
                    "versionMismatch",
                ):
                    flags[name] = rng.randrange(8) == 0
                if index % 137 == 0:
                    flags["createError"] = "unexpected"
                probe = bool(rng.randrange(2))
                parser_values = rng.choice(((True, True), (False, False), (True, False), (False, True)))
                calls.clear()
                parser_index[0], clock_index[0] = 0, 0
                expected = outcome(LEGACY, server, probe)
                trace = calls[:]
                calls.clear()
                parser_index[0], clock_index[0] = 0, 0
                with self.subTest(index=index, probe=probe):
                    self.assertEqual(outcome(operations.health.__wrapped__, server, probe), expected)
                    self.assertEqual(calls, trace)
                    if not probe:
                        self.assertFalse(any(call[0] in ("temporary", "write", "sync", "outdir") for call in calls))
                outcomes.add(expected[0])
            self.assertEqual(outcomes, {"result", "error"})
        finally:
            for context in reversed(patches):
                context.stop()


if __name__ == "__main__":
    unittest.main()
