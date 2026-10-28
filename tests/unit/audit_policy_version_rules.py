"""Policy-version phases preserve retained coverage and date/review refusal precedence."""

import copy
import json
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import compiler

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = compiler.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/policy_versions_reference.txt").read_text(encoding="utf-8"), "policy_versions_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["versions"]


def outcome(check, rows):
    try:
        return ("result", check(rows, "synthetic parameter"))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


def policy_rows():
    result = list(json.loads((ROOT / "policy/surcharges.json").read_text(encoding="utf-8")).values())
    for path in [*sorted((ROOT / "policy/schedule").glob("*.json")), ROOT / "policy/ladders.json"]:
        result.extend(entry["versions"] for entry in json.loads(path.read_text(encoding="utf-8")))
    return result


class PolicyVersionRules(unittest.TestCase):
    def test_compiled_policy_bytes_are_unchanged(self):
        with patch.object(compiler, "versions", LEGACY):
            expected = compiler.compile_policy(ROOT)
        actual = compiler.compile_policy(ROOT)
        self.assertEqual(
            json.dumps(actual, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"),
            json.dumps(expected, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"),
        )

    def test_all_retained_rows_and_generated_date_review_failures(self):
        rng = random.Random(20261028)
        corpus = policy_rows()
        generated = []
        fields = ("from", "to", "source", "status", "review", "rawText", "tiers")
        values = (None, "", False, "bad", "2026-09-01", "2026-10-28", "verified", {}, [], {"codification": "QA"}, [{"amountCents": 1234}])
        for index in range(3000):
            rows = copy.deepcopy(corpus[index % len(corpus)])
            if index % 3:
                for _ in range(rng.randrange(1, 4)):
                    rng.choice(rows)[rng.choice(fields)] = copy.deepcopy(rng.choice(values))
            if index % 7 == 0:
                rows.reverse()
            if index % 11 == 0:
                rows.pop()
            if index % 13 == 0 and rows:
                rows.append(copy.deepcopy(rows[-1]))
            generated.append(rows)
        calls = []
        native_date = compiler.date

        class TracedDate:
            @staticmethod
            def fromisoformat(value):
                calls.append(value)
                return native_date.fromisoformat(value)

        NAMESPACE["date"] = TracedDate
        outcomes = set()
        with patch.object(compiler, "date", TracedDate):
            for index, rows in enumerate(corpus + generated):
                before, after = copy.deepcopy(rows), copy.deepcopy(rows)
                calls.clear()
                expected = outcome(LEGACY, before)
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(compiler.versions, after), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)
                outcomes.add(expected)
        self.assertIn(("result", None), outcomes)
        self.assertGreaterEqual(len(outcomes), 8, "corpus must exercise distinct date/source/review failures")


if __name__ == "__main__":
    unittest.main()
