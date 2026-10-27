"""Authoring extraction retains exact refusal order across historical citations and malformed inputs."""

import copy
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import case_store
import citation_pricing
import audit_authoring as fixtures

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = case_store.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/authoring_reference.txt").read_text(encoding="utf-8"), "authoring_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["validate_authoring"]


def outcome(check, snap, window, original):
    try:
        return ("result", check(snap, at="2026-10-27T12:00:00Z", check_date_window=window, original=original))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class AuthoringRules(unittest.TestCase):
    def test_generated_authoring_and_refusal_precedence(self):
        rng = random.Random(20261027)
        template = fixtures.AuthoringStoreTests().citation()["events"][-1]["payload"]["snapshot"]
        fields = (
            "num",
            "ord",
            "desc",
            "deptId",
            "issued",
            "courtDate",
            "courtTime",
            "violTime",
            "violDate",
            "amount",
            "base",
            "cc",
            "depositMode",
            "depositSource",
            "pricedOn",
            "policyVersionHash",
            "reconfirmDeposit",
            "mandatoryAppearance",
            "assessments",
        )
        values = (None, "", False, True, "()", "bad", "2026-09-01", "2027-01-01", "12.345", "0", "48", "245.67", "base", "total", "schedule")
        calls = []
        original_calendar = case_store.calendar_date

        def calendar(value):
            calls.append(("calendar", value))
            return original_calendar(value)

        LEGACY.__globals__["calendar_date"] = calendar
        with patch.object(case_store, "calendar_date", calendar):
            for index in range(3000):
                snap = copy.deepcopy(template)
                snap["authoringVersion"] = rng.choice((4, 5, 6, 7, 8, 9, 16))
                snap.setdefault("frozen", {})["court"] = {
                    "room": "RM#203,",
                    "caseNumberLabel": citation_pricing.policy().get("mc2000CaseNumberLabel", "Building Inspection Case Number"),
                }
                charge = next(iter(snap["cits"].values()))
                charge.update(
                    pricedOn=snap.get("inspDate") or snap["frozen"]["case"]["date"], policyVersionHash=citation_pricing.policy()["versionHash"]
                )
                if index % 3:
                    for _ in range(rng.randrange(1, 5)):
                        charge[rng.choice(fields)] = rng.choice(values)
                if index % 7 == 0:
                    snap["items"][0]["withdrawn"] = True
                if index % 11 == 0:
                    snap["items"][0]["done"] = True
                if index % 13 == 0:
                    snap["type"] = "notice"
                before, after = copy.deepcopy(snap), copy.deepcopy(snap)
                original = copy.deepcopy(template) if index % 5 == 0 else None
                window = bool(index % 2)
                calls.clear()
                expected = outcome(LEGACY, before, window, original)
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index, version=snap["authoringVersion"]):
                    self.assertEqual(outcome(case_store.validate_authoring, after, window, original), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)


if __name__ == "__main__":
    unittest.main()
