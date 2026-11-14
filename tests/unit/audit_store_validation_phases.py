"""Phase 2 H2: freeze cash-deposit output, errors and ordered pricing reads before phase extraction.
Existing issuance-group/authoring differential suites retain their original 3,000 scenarios each."""

import copy
from decimal import Decimal
import hashlib
import json
import random
import shutil
import subprocess
import sys
import tempfile
import types
import unittest
from pathlib import Path

import case_store

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = ROOT / "tests/fixtures/cash_validation_reference.py.txt"
REFERENCE_SHA256 = "17d50bce94c440cea302ded01a1067cf7a290a21577fbd96da8088ee6fb0149b"


def outcome(data, settings, reference=False, stop=None):
    namespace = dict(vars(case_store))
    function = case_store._validate_cash_citation
    namespace[function.__name__] = types.FunctionType(function.__code__, namespace, function.__name__, function.__defaults__)
    if reference:
        exec(compile(REFERENCE.read_text(encoding="utf-8"), str(REFERENCE), "exec"), namespace)
    trace = []
    original = copy.deepcopy(data)
    value = copy.deepcopy(data)

    def touched(name, *args, **kwargs):
        trace.append((name, repr(args), repr(kwargs)))
        if len(trace) == stop:
            raise ValueError("synthetic pricing interruption")

    class Pricing:
        def policy(self):
            touched("policy")
            return {"allowZeroBaseDeposits": settings.get("zero", False)}

        def assessment_cents(self, base, court, **kwargs):
            touched("assessment", base, court, **kwargs)
            return {"base": base, "court": court, "total": base + court}

        def policy_at(self, at):
            touched("policy_at", at)
            return {"fees": {"ccMaxCents": settings.get("max", 10000)}}

        def item_key(self, item):
            touched("item_key", item)
            return "synthetic"

        def resolve(self, *args, **kwargs):
            touched("resolve", *args, **kwargs)
            return {"id": "entry"}

        def base_cents(self, *args):
            touched("base_cents", *args)
            return settings.get("base", 1000)

        def court_cents(self, *args):
            touched("court_cents", *args)
            return settings.get("court", 4800)

    def legacy(*args):
        touched("legacy", *args)
        return settings.get("legacy", Decimal(10))

    def amount(item):
        touched("amount", item)
        return Decimal(str(item))

    namespace["citation_pricing"], namespace["legacy_scheduled_citation_base"] = Pricing(), legacy
    try:
        result = ("result", namespace["_validate_cash_citation"](amount=amount, **value))
    except Exception as error:
        result = ("error", type(error).__name__, str(error))
    return result, trace, value == original


def seed(version=8, mode="schedule", window=True):
    return {
        "c": {"amount": "58", "base": "10", "cc": "48", "ord": "SYNTHETIC", "tier": "1st", "pricedOn": "2026-11-14"},
        "mode": mode,
        "check_date_window": window,
        "snap": {"authoringVersion": version},
        "issued": "2026-11-14",
        "item": {"id": "i"},
    }


class StoreValidationPhases(unittest.TestCase):
    def equivalent(self, data, settings, stop=None):
        expected = outcome(data, settings, True, stop)
        actual = outcome(data, settings, False, stop)
        self.assertEqual(actual, expected)
        self.assertTrue(actual[2])
        return expected

    def test_original_provenance(self):
        self.assertEqual(hashlib.sha256(REFERENCE.read_bytes()).hexdigest(), REFERENCE_SHA256)

    def test_historical_modes_windows_boundaries_and_ordered_failures(self):
        for version in [4, 5, 6, 7, 8, 16]:
            for mode in ["schedule", "base", "total"]:
                for window in [False, True]:
                    data = seed(version, mode, window)
                    for settings in [{}, {"base": None}, {"base": 1200}, {"max": 1000}, {"court": 4900}, {"legacy": None}]:
                        trace = self.equivalent(data, settings)[1]
                        for stop in range(1, len(trace) + 1):
                            self.equivalent(data, settings, stop)

    def test_seeded_malformed_cash_fields_and_partial_assessments(self):
        rng = random.Random(23052)
        values = [None, False, True, "", "bad", "0", "10", "48", "58", "-1", "0.01", "NaN", {}, []]
        for index in range(2400):
            data = seed(rng.choice([4, 5, 6, 7, 8, 16]), rng.choice(["schedule", "base", "total"]), bool(index % 2))
            fields = ["amount", "base", "cc", "ord", "tier", "pricedOn", "measurements", "assessments"]
            for _ in range(rng.randrange(1, 4)):
                field = rng.choice(fields)
                if index % 5:
                    data["c"][field] = copy.deepcopy(rng.choice(values))
                else:
                    data["c"].pop(field, None)
            with self.subTest(index=index):
                self.equivalent(data, {"zero": bool(index % 3)})

    def test_declared_flat_runtime_can_load_store_and_validate_empty_groups(self):
        manifest = json.loads((ROOT / "tools/runtime-manifest.template.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as folder:
            flat = Path(folder)
            for target, source in manifest["deploy"].items():
                if target.endswith((".py", ".json", ".tzif")) and "/" not in target:
                    shutil.copyfile(ROOT / source, flat / target)
            shutil.copytree(ROOT / "helper/vendor/python", flat / "vendor/python")
            result = subprocess.run(
                [
                    sys.executable,
                    "-I",
                    "-c",
                    "import sys; sys.path.insert(0, sys.argv[1]); import case_store; case_store.validate_issuance_groups({'events': []})",
                    str(flat),
                ],
                cwd=flat,
                capture_output=True,
                encoding="utf-8",
                timeout=20,
            )
            self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
