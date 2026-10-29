"""The Windows case-lookup query against the retained function, with the operating system, PowerShell and the
helper's answer scripted: every refusal before the call, each failure category and number, the diagnostic code
assembled from allowlisted labels, appended operation and argument text, and the exact request sent."""

import json
from pathlib import Path
import random
import subprocess
import tempfile
import types
import unittest
from unittest.mock import patch

import case_lookup as current

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = current.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/run_query_reference.txt").read_text(encoding="utf-8"), "run_query_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["run_query"]

CATEGORIES = ["limit", "database", "timeout", "tls_certificate", "authentication", "network", "script_policy", "helper_runtime", "other", None]
NUMBERS = [18456, 229, 916, 207, 208, 4060, 4064, -2, 53, None, "207", True]
LABELS = ["Connect", "Open_Reader", "9bad", "", "x" * 70, "a.b", None, 5]
TYPES = ["System.Data.SqlClient.SqlException", "Bad Type", "", "A" * 90, None, 3]


def answer(rng):
    value = {"ok": rng.random() < 0.15}
    for key, pool in (
        ("category", CATEGORIES),
        ("number", NUMBERS),
        ("state", [1, 2, None, "x", True]),
        ("operation", LABELS),
        ("argumentName", LABELS),
        ("diagnosticFile", ["x", "", None, 3]),
        ("exceptionType", TYPES),
        ("hresult", [-2147467259, 0, 2**31, None, "x", -(2**31) - 1]),
        ("nativeCode", [0, 53, 65535, 65536, -1, None]),
    ):
        if rng.random() < 0.7:
            value[key] = rng.choice(pool)
    return value


class Fakes:
    def __init__(self, root, scenario):
        self.root, self.scenario, self.calls = root, scenario, []

    def run(self, args, **kwargs):
        self.calls.append(
            (args[1:], kwargs.get("input"), kwargs.get("encoding"), kwargs.get("capture_output"), kwargs.get("timeout"), kwargs.get("creationflags"))
        )
        kind = self.scenario["kind"]
        if kind == "timeout":
            raise subprocess.TimeoutExpired(args, 40)
        if kind == "oserror":
            raise OSError("cannot start")
        stdout = self.scenario["stdout"]
        return types.SimpleNamespace(stdout=stdout, returncode=self.scenario["returncode"])


def scenario(rng):
    kind = rng.choice(
        ("answer", "answer", "answer", "answer", "answer", "toobig", "notjson", "notdict", "timeout", "oserror", "bom", "notwindows", "nopowershell")
    )
    value = answer(rng)
    stdout = json.dumps(value)
    if kind == "toobig":
        stdout = json.dumps({"ok": True, "pad": "x" * (5 * 1024 * 1024 + 1)})
    elif kind == "notjson":
        stdout = rng.choice(("", "not json", "{"))
    elif kind == "notdict":
        stdout = rng.choice(("[]", "3", '"x"', "null"))
    elif kind == "bom":
        stdout = "﻿" + stdout
    return {
        "kind": kind,
        "stdout": stdout,
        "returncode": rng.choice((0, 0, 1)),
        "cfg": rng.choice(({"server": "s"}, {"server": "s", "trustServerCertificate": True}, {})),
        "number": rng.choice(("CB2026-1", "x")),
    }


def outcome(function, namespace, root, sc):
    fakes = Fakes(root, sc)
    fake_os = types.SimpleNamespace(
        name="windows" if sc["kind"] == "notwindows" else "nt",
        environ={"SystemRoot": str(root / ("none" if sc["kind"] == "nopowershell" else "win"))},
    )
    fake_sub = types.SimpleNamespace(run=fakes.run, TimeoutExpired=subprocess.TimeoutExpired, CREATE_NO_WINDOW=134217728)
    if sc["kind"] == "notwindows":
        fake_os.name = "posix"
    with patch.dict(namespace, {"os": fake_os, "subprocess": fake_sub}):
        try:
            result = ("result", function(dict(sc["cfg"]), sc["number"]))
        except current.CaseLookupError as error:
            result = ("refused", str(error), error.status)
        except Exception as error:
            result = ("raised", type(error).__name__, str(error))
    return result, fakes.calls


class LookupQueryRules(unittest.TestCase):
    def test_query_matches_the_retained_function(self):
        rng = random.Random(20261213)
        messages = set()
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            exe = root / "win" / "System32/WindowsPowerShell/v1.0/powershell.exe"
            exe.parent.mkdir(parents=True)
            exe.write_bytes(b"")
            for index in range(6000):
                sc = scenario(rng)
                before = outcome(LEGACY, NAMESPACE, root, sc)
                after = outcome(current.run_query, current.__dict__, root, sc)
                self.assertEqual(after, before, (index, sc))
                if before[0][0] == "refused":
                    messages.add(before[0][1][:40])
        self.assertGreaterEqual(len(messages), 14, sorted(messages))


if __name__ == "__main__":
    unittest.main()
