"""Differential helper validation over historical formats and generated malformed facts."""

import copy
import datetime
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import case_store
from audit_r26_helper import REVIEW, special

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = {}
exec(
    compile((ROOT / "tests/fixtures/special_fields_reference.txt").read_text(encoding="utf-8"), "special_fields_reference", "exec"),
    case_store.__dict__.copy(),
    REFERENCE,
)
# A function keeps the globals mapping passed to exec, so retain it for controlled dependency traces.
LEGACY = REFERENCE["validate_special_fields"]


def outcome(check, snap, window):
    try:
        return ("result", check(snap, at="2026-10-27T12:00:00Z", check_date_window=window))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


def snapshot(kind, version):
    snap = special()["events"][-1]["payload"]["snapshot"]
    snap.update(type=kind, authoringVersion=version, mailed="2026-10-27", inspDate="2026-10-20")
    snap["frozen"]["body"] = "Completed synthetic narrative"
    snap["items"] = [{"id": "i", "no": 1, "due": "2026-11-15", "done": False, "withdrawn": False}]
    snap["special"] = {
        **REVIEW,
        "variant": "junk",
        "findings": "Reviewed facts",
        "work": "Remove nuisance",
        "summaryBasis": "Reviewed immediate basis",
        "orderDue": "2026-11-15",
        "servicePlan": "Reviewed service plan",
        "remedyReviewed": True,
        "mode": "restrict",
        "effective": "2026-10-26",
        "releaseConditions": "Reviewed conditions",
        "posting": "posted",
        "postedDate": "2026-10-26",
        "affected": ["1"],
        "originalDues": {"1": "2026-10-01"},
        "noSafety": True,
        "safetyBasis": "Reviewed safety basis",
        "reason": "Additional time",
        "noticeRef": "Notice reference",
        "intentions": "Corrective work",
        "supervisor": "Reviewer",
        "stage": "administrative",
        "vacancyFacts": "Vacant",
        "requestRef": "Request",
        "conditions": "Conditions",
        "expiryPolicyRef": "Policy",
        "transferClause": "Reviewed transfer clause",
        "reviewDate": "2026-11-15",
        "expiryMode": "review",
        "deadlineMode": "dated",
    }
    if kind == "vacancyExtension" and version >= 16:
        snap["items"][0]["due"] = ""
    return snap


class SpecialFieldRules(unittest.TestCase):
    def test_historical_and_generated_refusal_precedence(self):
        rng = random.Random(20261027)
        kinds = (*case_store.SPECIAL_TYPES,)
        values = (None, "", False, True, "◯", "()", "bad", "2026-10-26", "2027-01-01", "unit", "building", "release", "external")
        calls = []
        original_calendar = case_store.calendar_date

        def calendar(value):
            calls.append(("calendar", value))
            return original_calendar(value)

        def day(at=None):
            calls.append(("day", at))
            return datetime.date(2026, 10, 27)

        LEGACY.__globals__.update(calendar_date=calendar, city_day=day)
        with patch.object(case_store, "calendar_date", calendar), patch.object(case_store, "city_day", day):
            for index in range(3000):
                snap = snapshot(rng.choice(kinds), rng.choice((4, 11, 12, 13, 14, 15, 16)))
                if index % 3:
                    for _ in range(rng.randrange(1, 5)):
                        snap["special"][rng.choice(tuple(snap["special"]))] = rng.choice(values)
                window = bool(index % 2)
                before, after = copy.deepcopy(snap), copy.deepcopy(snap)
                calls.clear()
                expected = outcome(LEGACY, before, window)
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index, kind=snap["type"], version=snap["authoringVersion"]):
                    self.assertEqual(outcome(case_store.validate_special_fields, after, window), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)


if __name__ == "__main__":
    unittest.main()
