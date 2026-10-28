"""Snow phases preserve exempt-item, evidence/noon and retained-letter refusal precedence."""

import copy
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import snow_rules
from audit_r33_snow import snow_snapshot

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = snow_rules.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/snow_snapshot_reference.txt").read_text(encoding="utf-8"), "snow_snapshot_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["validate_snapshot"]


def outcome(check, snap, letter):
    try:
        return ("result", check(snap, require_letter=letter))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class SnowSnapshotRules(unittest.TestCase):
    def test_generated_evidence_and_frozen_letter_precedence(self):
        rng = random.Random(20261028)
        template = snow_snapshot()
        template["snowInspectionId"] = template["inspDate"] + "T" + template["inspTime"]
        template["frozen"]["snowLetter"] = snow_rules.read_letter()
        template["cits"][template["items"][0]["id"]]["comment"] = snow_rules.comment(template)
        calls, outcomes = [], set()
        native_date = snow_rules.date

        class TracedDate:
            @staticmethod
            def fromisoformat(value):
                calls.append(("date", value))
                return native_date.fromisoformat(value)

        def traced(name, original):
            def lookup(*args, **kwargs):
                calls.append((name, copy.deepcopy((args, kwargs))))
                return original(*args, **kwargs)

            return lookup

        bindings = {name: traced(name, getattr(snow_rules, name)) for name in ("comment", "validate_letter")}
        pricing_bindings = {name: traced(name, getattr(snow_rules.pricing, name)) for name in ("item_key", "canonical_ordinance")}
        NAMESPACE.update(bindings, date=TracedDate)
        with patch.multiple(snow_rules, **bindings, date=TracedDate), patch.multiple(snow_rules.pricing, **pricing_bindings):
            for index in range(3000):
                snap = copy.deepcopy(template)
                if index % 3:
                    for _ in range(rng.randrange(1, 4)):
                        group = rng.randrange(4)
                        values = (
                            None,
                            "",
                            False,
                            True,
                            0,
                            -1,
                            0.8,
                            float("inf"),
                            float("nan"),
                            "bad",
                            "2026-01-01",
                            "2026-01-02",
                            "11:59",
                            "12:00",
                            "snow covered",
                            {},
                            [],
                        )
                        if group == 0:
                            snap["snow"][rng.choice(("snowfallDate", "inches", "condition", "photographed", "cornerNotCleared"))] = copy.deepcopy(
                                rng.choice(values)
                            )
                        elif group == 1:
                            snap[rng.choice(("type", "fromDocId", "fromReinspId", "issuanceGroup", "inspDate", "inspTime", "snowInspectionId"))] = (
                                copy.deepcopy(rng.choice(values))
                            )
                        elif group == 2:
                            snap["items"][0][rng.choice(("due", "dueExempt", "cite", "withdrawn", "done", "sections", "libraryKey"))] = copy.deepcopy(
                                rng.choice(values)
                            )
                        else:
                            snap["cits"][snap["items"][0]["id"]][rng.choice(("ord", "comment"))] = copy.deepcopy(rng.choice(values))
                if index % 7 == 0:
                    snap["frozen"]["snowLetter"] = rng.choice((None, {}, {"format": "bad"}))
                if index % 11 == 0:
                    snap["inspDate"], snap["inspTime"] = "2026-01-02", rng.choice(("11:59", "12:00", "12:01"))
                if index % 13 == 0:
                    snap["items"] = []
                before, after = copy.deepcopy(snap), copy.deepcopy(snap)
                require_letter = bool(index % 2)
                calls.clear()
                expected = outcome(LEGACY, before, require_letter)
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index, require_letter=require_letter):
                    self.assertEqual(outcome(snow_rules.validate_snapshot, after, require_letter), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)
                outcomes.add(expected)
        self.assertIn(("result", None), outcomes)
        self.assertGreaterEqual(len(outcomes), 10, "corpus must exercise distinct item, evidence, timing and letter failures")


if __name__ == "__main__":
    unittest.main()
