"""Phase 2 H1: retained/current verification verdicts, input immutability and ordered hash/context failures.
Reference is the untouched verify_record from main 3183bff (PR 512), frozen before changing production code."""

import copy
import hashlib
import inspect
import itertools
import json
import shutil
import subprocess
import sys
import tempfile
import random
import types
import unittest
from pathlib import Path
from unittest.mock import patch

import case_integrity as owner

REFERENCE = Path(__file__).resolve().parents[1] / "fixtures" / "integrity_verification_reference.py.txt"
REFERENCE_SHA256 = "a5199d943b52636438f92ee060ed3fa1b40e6f00892eb65887226669efaad79c"


def namespace(reference=False):
    values = dict(vars(owner))
    for name, function in list(values.items()):
        if inspect.isfunction(function) and function.__module__ == owner.__name__:
            clone = types.FunctionType(function.__code__, values, function.__name__, function.__defaults__, function.__closure__)
            clone.__kwdefaults__ = function.__kwdefaults__
            values[name] = clone
    if reference:
        exec(compile(REFERENCE.read_text(encoding="utf-8"), str(REFERENCE), "exec"), values)
    return values


def outcome(record, options, reference=False, fail_at=None, error=ValueError):
    values = namespace(reference)
    trace = []
    original = copy.deepcopy(record)
    value = copy.deepcopy(record)

    def touched(name, *args):
        trace.append((name, repr(args)))
        if len(trace) == fail_at:
            raise error("synthetic interruption")

    class Context:
        def __init__(self):
            self.pending = {"qa-case": True} if options.get("pending") else {}

        def retained(self, supplied):
            touched("retained", supplied)
            return copy.deepcopy(options.get("retained", []))

    def context(*args):
        touched("context", *args)
        return Context()

    def anchor(supplied, folder, external, current):
        touched("anchor", supplied, folder, external, current is not None)
        return copy.deepcopy(options.get("anchor")), options.get("known", False)

    values["VerificationContext"], values["anchor_evidence"] = context, anchor
    for name in ("canonical", "hash_bytes", "hashed", "body"):
        base = values[name]

        def wrapped(*args, _name=name, _base=base):
            touched(_name, *args)
            return _base(*args)

        values[name] = wrapped
    provided = Context() if options.get("provided") else None
    result = values["verify_record"](value, "synthetic-folder" if options.get("folder") else None, "synthetic-anchor", provided)
    return result, trace, value == original


def records():
    base = {"format": "madison-case-file", "schema": 4, "case": {"number": "QA-CASE", "address": "100 SYNTHETIC ST"}, "inspectors": [], "events": []}
    clock = itertools.count()
    with patch.object(owner, "stamp", side_effect=lambda: f"2026-11-14T00:00:{next(clock):02d}+00:00"):
        first = owner.commit_record(None, {**base, "events": [{"id": "a", "type": "note", "payload": {"text": "first"}}]})
        second = copy.deepcopy(first)
        second["events"].append({"id": "b", "type": "note", "payload": {"text": "second"}})
        second = owner.commit_record(first, second)
        third = copy.deepcopy(second)
        third["case"]["owner"] = "SYNTHETIC OWNER"
        third["events"].append({"id": "c", "type": "note", "payload": {"text": "third"}})
        third = owner.commit_record(second, third)
        migrated = owner.commit_record(base, {**base, "events": [{"id": "legacy", "type": "note"}]})
        restarted = owner.commit_record(
            None,
            {**base, "events": [{"id": "restart", "type": "note"}]},
            restart={"priorAnchoredCommitHash": "d" * 64, "priorGenesisHashes": ["e" * 64]},
        )
    return [base, first, second, third, migrated, restarted]


def paths(value, prefix=()):
    result = [prefix]
    if isinstance(value, dict):
        for key, child in value.items():
            result.extend(paths(child, (*prefix, key)))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            result.extend(paths(child, (*prefix, index)))
    return result


class VerificationPhases(unittest.TestCase):
    def assert_equivalent(self, record, options, fail_at=None, error=ValueError):
        expected = outcome(record, options, True, fail_at, error)
        actual = outcome(record, options, False, fail_at, error)
        self.assertEqual(actual, expected)
        self.assertTrue(actual[2], "verification never changes the input record")
        return expected

    def test_retained_original_provenance(self):
        self.assertEqual(hashlib.sha256(REFERENCE.read_bytes()).hexdigest(), REFERENCE_SHA256)

    def test_declared_flat_runtime_can_import_the_new_phase_owner(self):
        root = Path(__file__).resolve().parents[2]
        manifest = json.loads((root / "tools/runtime-manifest.template.json").read_text(encoding="utf-8"))
        self.assertIn("integrity_verification.py", manifest["required"])
        with tempfile.TemporaryDirectory() as folder:
            flat = Path(folder)
            for target, source in manifest["deploy"].items():
                if target.endswith(".py") and "/" not in target:
                    shutil.copyfile(root / source, flat / target)
            shutil.copytree(root / "helper/vendor/python", flat / "vendor/python")
            result = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    "-c",
                    "import sys; sys.path.insert(0, sys.argv[1]); import case_integrity; assert case_integrity.verify_record({'schema': 4})['legacy']",
                    str(flat),
                ],
                cwd=flat,
                capture_output=True,
                encoding="utf-8",
                timeout=20,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_real_chains_legacy_restart_anchor_registry_and_pending_branches(self):
        for record in records():
            genesis = record.get("integrity", {}).get("genesis", {})
            anchor = {"commitHash": record.get("integrity", {}).get("commits", [{"hash": "none"}])[-1]["hash"]}
            variants = [
                {},
                {"known": True},
                {"folder": True},
                {"provided": True},
                {"provided": True, "pending": True},
                {"provided": True, "retained": [{"genesisHash": genesis.get("hash")}]},
                {"provided": True, "retained": [{"genesisHash": "mismatch"}]},
                {"anchor": anchor},
                {"anchor": {"commitHash": "not-retained"}},
                {
                    "folder": True,
                    "anchor": {"commitHash": "d" * 64},
                    "retained": [{"genesisHash": genesis.get("hash"), "administrativeRecovery": True}],
                },
            ]
            for options in variants:
                with self.subTest(options=options, schema=record.get("schema")):
                    result = self.assert_equivalent(record, options)[0]
                    if not options and record.get("integrity"):
                        self.assertTrue(result["valid"])

    def test_seeded_missing_malformed_and_tampered_metadata(self):
        rng = random.Random(23051)
        seeds = records()
        replacements = [None, False, True, 0, 1, "changed", "", [], {}, ["a", "a"], {"changed": True}]
        for index in range(2200):
            seed = rng.choice(seeds)
            value = copy.deepcopy(seed)
            path = rng.choice(paths(seed))
            if not path:
                value = copy.deepcopy(rng.choice(replacements))
            else:
                parent = value
                for key in path[:-1]:
                    parent = parent[key]
                key = path[-1]
                if index % 4 == 0:
                    if isinstance(parent, list):
                        parent.pop(key)
                    else:
                        del parent[key]
                else:
                    parent[key] = copy.deepcopy(rng.choice(replacements))
            with self.subTest(index=index, path=path):
                self.assert_equivalent(value, {"provided": True, "known": bool(index % 2)})

    def test_entry_progress_keeps_the_actual_last_good_commit(self):
        record = records()[3]
        entries = record["integrity"]["entries"]
        result = self.assert_equivalent(record, {})[0]
        self.assertEqual(result["lastGoodCommitTime"], entries[-1]["committedAt"])
        entries[1]["seq"] = -1
        result = self.assert_equivalent(record, {})[0]
        self.assertFalse(result["valid"])
        self.assertEqual(result["lastGoodCommitTime"], entries[0]["committedAt"])

    def test_differential_contract_detects_deliberately_bypassed_checks(self):
        record = records()[3]
        mutations = [
            ("anchor_mismatch", lambda *_: False, record, {"anchor": {"commitHash": "not-retained"}}),
            ("invalid_entry", lambda *_: False, copy.deepcopy(record), {}),
            ("genesis_events", lambda r, *a, **k: ({e["id"]: e for e in r["events"]}, None), copy.deepcopy(record), {}),
            ("committed_context", lambda r, c, *a, **k: (c["commits"][-1]["hash"], None), copy.deepcopy(record), {}),
        ]
        mutations[1][2]["integrity"]["entries"][0]["prevHash"] = "changed"
        mutations[2][2]["integrity"]["genesis"]["hash"] = "changed"
        mutations[3][2]["case"]["address"] = "changed"
        for name, replacement, value, options in mutations:
            with self.subTest(name=name), patch.object(owner.verification, name, replacement):
                with self.assertRaises(AssertionError):
                    self.assert_equivalent(value, options)

    def test_every_hash_context_interruption_keeps_original_order_and_last_good_time(self):
        for record in records()[1:]:
            for options in [{"folder": True}, {"provided": True, "pending": True}]:
                good = outcome(record, options, True)
                for stop in range(1, len(good[1]) + 1):
                    for error in [OSError, ValueError, KeyError, TypeError, IndexError, AttributeError]:
                        with self.subTest(stop=stop, error=error, options=options):
                            self.assert_equivalent(record, options, stop, error)


if __name__ == "__main__":
    unittest.main()
