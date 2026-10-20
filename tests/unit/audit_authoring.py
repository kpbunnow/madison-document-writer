"""R4 write gates through the actual atomic store, without browser validation."""

import copy
import tempfile
import unittest
from pathlib import Path
import case_store
from audit_workflow import initial, followup


class AuthoringStoreTests(unittest.TestCase):
    def notice(self):
        value = initial()
        value["events"][0]["payload"]["snapshot"]["authoringVersion"] = 4
        return value

    def citation(self):
        value = followup(self.notice(), "citation", "citation")
        s = value["events"][-1]["payload"]["snapshot"]
        s["authoringVersion"] = 4
        s["cits"][s["items"][0]["id"]].update(
            ord="SPS 999.99",
            desc="SYNTHETIC VIOLATION",
            deptId="1234",
            courtDate="2026-11-10",
            courtTime="08:30",
            depositMode="total",
            amount="245.67",
            depositSource="Synthetic court instruction QA-002; assessments included.",
        )
        return value

    def save(self, value):
        with tempfile.TemporaryDirectory() as folder:
            result = case_store.save_case(Path(folder), "101 TEST LANE - QA-LIFE.json", value)
            return case_store.read_case(Path(folder), result["name"])["file"]

    def test_three_dates_limit_is_enforced(self):
        value = self.notice()
        snap = value["events"][0]["payload"]["snapshot"]
        original = snap["items"][0]
        snap["items"] = [dict(copy.deepcopy(original), id=f"item_{n}", no=str(n), due=f"2026-10-{20 + n}") for n in range(1, 5)]
        with self.assertRaisesRegex(ValueError, "three distinct"):
            self.save(value)
        snap["items"][3]["due"] = snap["items"][0]["due"]
        self.assertEqual(len(self.save(value)["events"]), 1)

    def test_duplicate_library_items_cannot_issue(self):
        value = self.notice()
        items = value["events"][0]["payload"]["snapshot"]["items"]
        items[0]["libraryKey"] = '["A","B",1]'
        items.append(dict(items[0], id="second", no="2"))
        with self.assertRaisesRegex(ValueError, "duplicate library"):
            self.save(value)

    def test_approved_total_round_trips(self):
        value = self.citation()
        saved = self.save(value)
        self.assertEqual(saved["events"][-1]["payload"]["snapshot"]["cits"], value["events"][-1]["payload"]["snapshot"]["cits"])

    def test_approved_base_math_uses_decimal_rounding(self):
        value = self.citation()
        c = next(iter(value["events"][-1]["payload"]["snapshot"]["cits"].values()))
        c.update(depositMode="base", base="123.45", cc="48", amount="226.55")
        self.save(value)
        c["amount"] = "226.54"
        with self.assertRaisesRegex(ValueError, "assessments"):
            self.save(value)

    def test_missing_manual_authority_is_rejected(self):
        value = self.citation()
        c = next(iter(value["events"][-1]["payload"]["snapshot"]["cits"].values()))
        c["depositSource"] = ""
        with self.assertRaisesRegex(ValueError, "approved source"):
            self.save(value)

    def test_invalid_money_is_rejected(self):
        for invalid in ["", None, -1, "0", "NaN", "1e3", "1.234", True]:
            with self.subTest(invalid=invalid):
                value = self.citation()
                next(iter(value["events"][-1]["payload"]["snapshot"]["cits"].values()))["amount"] = invalid
                with self.assertRaises(ValueError):
                    self.save(value)

    def test_citation_dates_and_times_are_checked(self):
        for key, value in [
            ("issued", "2026-09-02"),
            ("courtDate", "2026-08-01"),
            ("courtTime", "25:30"),
            ("violDate", "2026-07-31"),
            ("violTime", ""),
        ]:
            with self.subTest(field=key):
                candidate = self.citation()
                snap = candidate["events"][-1]["payload"]["snapshot"]
                c = next(iter(snap["cits"].values()))
                c[key] = value
                if key == "violTime":
                    snap["inspTime"] = ""
                    candidate["events"][-2]["payload"]["reinspection"]["time"] = ""
                with self.assertRaises(ValueError):
                    self.save(candidate)

    def test_missing_charge_details_are_checked(self):
        for key in ["ord", "desc", "deptId", "num"]:
            with self.subTest(field=key):
                value = self.citation()
                next(iter(value["events"][-1]["payload"]["snapshot"]["cits"].values()))[key] = ""
                with self.assertRaises(ValueError):
                    self.save(value)

    def test_previous_record_remains_intact_after_invalid_save(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            base = self.notice()
            saved = case_store.save_case(root, "101 TEST LANE - QA-LIFE.json", base)
            candidate = self.citation()
            next(iter(candidate["events"][-1]["payload"]["snapshot"]["cits"].values()))["amount"] = "-1"
            with self.assertRaises(ValueError):
                case_store.save_case(root, "101 TEST LANE - QA-LIFE.json", candidate, saved["revision"], base["case"])
            self.assertEqual(case_store.read_case(root, "101 TEST LANE - QA-LIFE.json")["file"]["events"], base["events"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
