"""Citation base phases preserve policy results, errors, lookup order and input objects."""

import copy
import math
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import citation_pricing

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = citation_pricing.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/citation_base_reference.txt").read_text(encoding="utf-8"), "citation_base_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["base_cents"]


def outcome(check, args):
    try:
        value = check(*args)
        if isinstance(value, float) and math.isnan(value):
            return ("result", "NaN")
        return ("result", value)
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class CitationBaseRules(unittest.TestCase):
    def test_policy_rows_and_generated_measurements(self):
        policy = citation_pricing.policy()
        entries = policy["entries"] + policy["fallback"]
        rng = random.Random(20261028)
        corpus = []
        for entry in entries:
            measurements = {field["key"]: False if field.get("boolean") else field.get("min", 0) for field in entry.get("measurements", [])}
            for tier in (1, "2nd", "99th"):
                corpus.append((entry, tier, measurements))
        for _ in range(3000):
            entry = copy.deepcopy(rng.choice(entries))
            if rng.randrange(11) == 0:
                entry = rng.choice((None, {}, {"status": "draft"}))
            measurements = {
                field["key"]: rng.choice((None, False, True, -1, 0, 1, 5, 12, 200000, 0.5, float("inf"), float("nan"), "5"))
                for field in (entry or {}).get("measurements", [])
            }
            if rng.randrange(7) == 0:
                measurements = rng.choice((None, {}, "malformed"))
            corpus.append((entry, rng.choice((None, 0, 1, -1, "1st", "2nd", "99th", "bad")), measurements))
        calls = []

        def traced(name, original):
            def lookup(*args):
                calls.append((name, copy.deepcopy(args)))
                return original(*args)

            return lookup

        with patch.multiple(citation_pricing, **{name: traced(name, getattr(citation_pricing, name)) for name in ("ready", "ordinal")}):
            for name in ("ready", "ordinal"):
                NAMESPACE[name] = getattr(citation_pricing, name)
            for index, args in enumerate(corpus):
                before, after = copy.deepcopy(args), copy.deepcopy(args)
                calls.clear()
                expected = outcome(LEGACY, before)
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(citation_pricing.base_cents, after), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)


if __name__ == "__main__":
    unittest.main()
