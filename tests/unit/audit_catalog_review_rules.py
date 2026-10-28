"""Catalog request extraction preserves lock/write/refusal order and partial list effects."""

from contextlib import contextmanager
import copy
import json
from pathlib import Path
import random
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import server

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = server.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/catalog_review_reference.txt").read_text(encoding="utf-8"), "catalog_review_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["catalog_review"]


def outcome(check, data):
    try:
        return ("result", check(data))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class CatalogReviewRules(unittest.TestCase):
    def test_generated_requests_concurrency_cycles_and_partial_effects(self):
        rng = random.Random(20261028)
        keys = ('["A","B",1]', '["C","D",2]')
        calls, flags, state = [], {}, {"events": []}

        class Parent:
            def mkdir(self, **kwargs):
                calls.append(("mkdir", kwargs))
                if flags.get("mkdir"):
                    raise OSError("synthetic mkdir failure")

        path = SimpleNamespace(parent=Parent())

        class Manifest:
            def read_text(self, **kwargs):
                calls.append(("manifest", kwargs))
                return "{broken" if flags.get("manifest") else json.dumps({"format": "madison-catalog-manifest", "items": dict.fromkeys(keys, {})})

        def resource(name):
            calls.append(("resource", name))
            return Manifest()

        def catalog_path():
            calls.append(("path",))
            return path

        @contextmanager
        def lock(parent, name):
            self.assertIs(parent, path.parent)
            calls.append(("lock", name))
            if flags.get("lock"):
                raise OSError("synthetic lock failure")
            try:
                yield
            finally:
                calls.append(("unlock",))

        def events():
            calls.append(("events",))
            if flags.get("read"):
                raise OSError("synthetic read failure")
            return state["events"]

        def write(target, raw):
            self.assertIs(target, path)
            calls.append(("write", raw))
            if flags.get("write"):
                raise OSError("synthetic write failure")

        def identity():
            calls.append(("uuid",))
            return "00000000-0000-0000-0000-000000000001"

        class Clock:
            @staticmethod
            def now(zone):
                calls.append(("clock", zone))
                return SimpleNamespace(isoformat=lambda: "2026-10-28T12:00:00+00:00")

        bindings = dict(resource=resource, catalog_path=catalog_path, file_lock=lock, catalog_events=events, atomic_write=write, datetime=Clock)
        NAMESPACE.update(bindings)
        with patch.multiple(server, **bindings), patch.object(server.uuid, "uuid4", identity):
            outcomes = set()
            for index in range(3000):
                data = dict(
                    key=keys[0],
                    status="approved",
                    reviewer="QA",
                    wording="Synthetic reviewed wording",
                    ordinances=["27.05"],
                    source="QA source",
                    replaces="",
                    expectedVersion=0,
                )
                if index % 3:
                    for _ in range(rng.randrange(1, 4)):
                        field = rng.choice(list(data))
                        data[field] = copy.deepcopy(
                            rng.choice(
                                (
                                    None,
                                    "",
                                    False,
                                    True,
                                    0,
                                    1,
                                    "approved",
                                    "retired",
                                    keys[1],
                                    [],
                                    {},
                                    ["27.05"],
                                    "x" * 5000,
                                    "x" * 5001,
                                    ["x" * 100],
                                    ["x" * 101],
                                )
                            )
                        )
                if index % 7 == 0:
                    data["replaces"] = keys[1]
                if index % 11 == 0:
                    data.pop("expectedVersion", None)
                history = []
                if index % 5 == 0:
                    history = [dict(key=keys[1], status="approved", replaces=keys[0], version=1)]
                if index % 13 == 0:
                    history.append(dict(key=keys[0], status="approved", replaces="", version=2))
                for name in ("manifest", "mkdir", "lock", "read", "write"):
                    flags[name] = rng.randrange(13) == 0
                before, after = copy.deepcopy(data), copy.deepcopy(data)
                state["events"] = copy.deepcopy(history)
                calls.clear()
                expected = outcome(LEGACY, before)
                trace = calls[:]
                prior_events = copy.deepcopy(state["events"])
                state["events"] = copy.deepcopy(history)
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(server.catalog_review, after), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(state["events"], prior_events)
                    self.assertEqual(after, before)
                outcomes.add(expected[0])
            self.assertEqual(outcomes, {"result", "error"})


if __name__ == "__main__":
    unittest.main()
