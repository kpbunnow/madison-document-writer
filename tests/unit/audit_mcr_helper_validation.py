"""Code-review corrections at the authoritative store (2026-11-05): a new ordinary visit cannot be after the day it is
recorded (MCR-006), a scheduled mandatory-appearance citation draft can be backed up without a deposit (MCR-007), and a
new ordinary document keeps distinct due dates seven days apart (MCR-008). Synthetic records in temporary folders."""

import copy
import tempfile
import unittest
from pathlib import Path

import case_store
import server
from audit_workflow import initial, followup


def save(value):
    with tempfile.TemporaryDirectory() as folder:
        result = case_store.save_case(Path(folder), "101 TEST LANE - QA-LIFE.json", value)
        return case_store.read_case(Path(folder), result["name"])["file"]


def notice(*dues, done=()):
    value = initial()
    snap = value["events"][0]["payload"]["snapshot"]
    snap["authoringVersion"] = 4
    first = snap["items"][0]
    snap["items"] = [
        dict(copy.deepcopy(first), id=f"item_{n}", no=str(n + 1), due=due, done=n in done, doneOn="2026-08-01" if n in done else "")
        for n, due in enumerate(dues)
    ]
    return value


class VisitDate(unittest.TestCase):
    def visit_only(self):
        value = followup(initial(), "a", "extension")
        value["events"] = [e for e in value["events"] if e["type"] in ("notice.issued", "reinspection.recorded")]
        return value

    def test_today_and_past_visits_are_accepted(self):
        value = self.visit_only()
        self.assertEqual([e["type"] for e in save(value)["events"]], ["notice.issued", "reinspection.recorded"])
        same_day = self.visit_only()
        event = same_day["events"][-1]
        event["at"] = event["payload"]["reinspection"]["date"] + "T23:00:00Z"
        self.assertEqual(len(save(same_day)["events"]), 2)

    def test_new_future_visit_is_refused(self):
        value = self.visit_only()
        visit = value["events"][-1]["payload"]["reinspection"]
        visit["date"] = "2099-01-01"
        for result in visit["results"].values():
            result["on"] = "2099-01-01"
        with self.assertRaisesRegex(ValueError, "cannot be after the day it is recorded"):
            save(value)

    def test_historical_event_keeps_its_evidence(self):
        value = self.visit_only()
        visit = value["events"][-1]["payload"]["reinspection"]
        visit["date"] = "2099-01-01"
        for result in visit["results"].values():
            result["on"] = "2099-01-01"
        args = (value, visit, {}, set(), set(), [])
        # check_date_window=False is how a retained (historical) event is revalidated: no upper bound applies.
        documents = {"notice_1": (value["events"][0]["payload"]["snapshot"], "issued_1")}
        case_store.validate_visit(args[0], visit, documents, set(), set(), [], value["events"][-1]["at"], False)


class DueSpacing(unittest.TestCase):
    def test_one_and_six_days_are_refused(self):
        for later in ("2026-12-02", "2026-12-07"):
            with self.subTest(later=later), self.assertRaisesRegex(ValueError, "seven days apart"):
                save(notice("2026-12-01", later))

    def test_seven_days_and_shared_dates_are_accepted(self):
        self.assertEqual(len(save(notice("2026-12-01", "2026-12-08"))["events"]), 1)
        self.assertEqual(len(save(notice("2026-12-01", "2026-12-01", "2026-12-08"))["events"]), 1)

    def test_corrected_items_do_not_count(self):
        self.assertEqual(len(save(notice("2026-12-01", "2026-12-02", done=(1,)))["events"]), 1)

    def test_correction_may_keep_dates_it_already_had(self):
        original = notice("2026-12-01", "2026-12-02")["events"][0]["payload"]["snapshot"]
        snap = copy.deepcopy(original)
        case_store._validate_due_spacing(snap=snap, items=snap["items"], original=original)
        snap["items"][1]["due"] = "2026-12-03"
        with self.assertRaisesRegex(ValueError, "seven days apart"):
            case_store._validate_due_spacing(snap=snap, items=snap["items"], original=original)

    def test_failed_save_leaves_the_existing_record(self):
        with tempfile.TemporaryDirectory() as folder:
            first = case_store.save_case(Path(folder), "101 TEST LANE - QA-LIFE.json", notice("2026-12-01"))
            before = (Path(folder) / first["name"]).read_bytes()
            refused = notice("2026-12-01", "2026-12-02")
            with self.assertRaises(ValueError):
                case_store.save_case(Path(folder), first["name"], refused)
            self.assertEqual((Path(folder) / first["name"]).read_bytes(), before)


class MandatoryDraftBackup(unittest.TestCase):
    def bundle(self, cit):
        return {"drafts": [{"id": "d", "type": "citation", "cits": {"i": cit}}]}

    def test_scheduled_mandatory_draft_without_deposit_is_accepted(self):
        cit = {"ord": "23.45", "mandatoryAppearance": True, "amount": "", "base": "", "cc": "", "pricedOn": "2026-11-04"}
        server.validate_draft_deposits(self.bundle(cit))
        # inside an initial-notice citation draft too
        server.validate_draft_deposits({"drafts": [{"id": "n", "type": "notice", "initialCitation": {"cits": {"i": cit}}}]})

    def test_money_charges_still_need_a_deposit(self):
        for cit in (
            {"ord": "27.05(2)(c)", "amount": ""},
            {"ord": "27.05(2)(c)", "amount": "0"},
            {"ord": "27.05(2)(c)", "mandatoryAppearance": True, "amount": ""},
            {"ord": "23.45", "mandatoryAppearance": False, "amount": ""},
        ):
            with self.subTest(cit=cit), self.assertRaisesRegex(ValueError, "needs deposit"):
                server.validate_draft_deposits(self.bundle(cit))
        server.validate_draft_deposits(self.bundle({"ord": "27.05(2)(c)", "amount": "200.00"}))


if __name__ == "__main__":
    unittest.main()
