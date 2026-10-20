"""Initial citations must pass the real store as a complete atomic pair."""

import copy
from pathlib import Path
import tempfile
import unittest
import case_store
from audit_workflow import initial


def pair():
    value = initial()
    notice = value["events"][0]["payload"]["snapshot"]
    notice.update(authoringVersion=5, inspDate="2026-08-01", inspTime="10:00", cits={})
    notice["items"][0]["cite"] = True
    group = {"id": "issued_1", "noticeId": "notice_1", "citationId": "initial_citation"}
    notice["issuanceGroup"] = group
    citation = copy.deepcopy(notice)
    citation.update(id="initial_citation", type="citation", fromDocId="notice_1")
    citation["items"][0].update(id="charged_item", srcItemId="item_1")
    citation["cits"] = {
        "charged_item": {
            "num": "QA-INITIAL-1",
            "ord": "27.05(2)(c)",
            "desc": "SYNTHETIC DEFECT",
            "deptId": "1234",
            "issued": "2026-08-01",
            "courtDate": "2026-11-10",
            "courtTime": "08:30",
            "depositMode": "schedule",
            "tier": "1st",
            "base": "100.00",
            "cc": "48.00",
            "amount": "197.00",
        }
    }
    value["events"].append(
        {
            "id": "initial_citation_event",
            "at": "2026-08-01T15:00:00.001Z",
            "by": "inspector_1",
            "type": "citation.issued",
            "payload": {
                "docId": citation["id"],
                "snapshot": citation,
                "fromDocId": notice["id"],
                "fromReinspId": "",
                "expectedHead": ["issued_1"],
                "lifecycle": 1,
            },
        }
    )
    return value


class InitialCitationStoreTests(unittest.TestCase):
    def save(self, value):
        with tempfile.TemporaryDirectory() as folder:
            return case_store.save_case(Path(folder), "101 TEST LANE - QA-LIFE.json", value)

    def test_complete_pair_and_idempotent_retry(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            value = pair()
            first = case_store.save_case(root, "101 TEST LANE - QA-LIFE.json", value)
            for _ in range(3):
                result = case_store.save_case(root, first["name"], value, idempotency_event="initial_citation_event")
                self.assertTrue(result["alreadyCommitted"])
                self.assertEqual(len(result["file"]["events"]), 2)
            self.assertFalse(any(e["type"] == "reinspection.recorded" for e in first["file"]["events"]))

    def test_missing_companion_cannot_create_case(self):
        value = pair()
        value["events"].pop()
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, "saved together"):
                case_store.save_case(Path(folder), "101 TEST LANE - QA-LIFE.json", value)
            self.assertFalse(list(Path(folder).glob("*.json")))

    def test_tampered_group_and_selection_rejected(self):
        for field in ("group", "source", "selection", "inspector", "duplicate"):
            with self.subTest(field=field):
                value = pair()
                citation = value["events"][-1]["payload"]["snapshot"]
                if field == "group":
                    citation["issuanceGroup"]["id"] = "wrong"
                if field == "source":
                    citation["fromDocId"] = "wrong"
                if field == "selection":
                    citation["items"][0]["srcItemId"] = "wrong"
                if field == "inspector":
                    citation["frozen"]["inspector"]["id"] = "wrong"
                if field == "duplicate":
                    citation["items"].append(dict(citation["items"][0], id="extra"))
                with self.assertRaisesRegex(ValueError, "saved together"):
                    self.save(value)

    def test_incomplete_citation_rejects_whole_pair(self):
        for field, invalid in [
            ("ord", ""),
            ("ord", "27.05(2)(c),27.05(2)(d)"),
            ("desc", "Repair ()"),
            ("deptId", ""),
            ("amount", "196.99"),
            ("courtTime", "25:00"),
            ("courtDate", "2026-07-31"),
        ]:
            with self.subTest(field=field, invalid=invalid):
                value = pair()
                value["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"][field] = invalid
                with self.assertRaises(ValueError):
                    self.save(value)

    def test_fabricated_schedule_rejected_but_approved_modes_work(self):
        value = pair()
        charge = value["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]
        charge.update(base="123.45", amount="226.55")
        with self.assertRaisesRegex(ValueError, "Scheduled deposit"):
            self.save(value)
        charge.update(depositMode="base", depositSource="Synthetic court-approved base instruction")
        self.save(value)
        charge.update(depositMode="total", amount="250.00")
        self.save(value)
        charge["depositSource"] = ""
        with self.assertRaisesRegex(ValueError, "approved source"):
            self.save(value)

    def test_decimal_half_cent_rounding_matches_ui(self):
        value = pair()
        charge = value["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]
        charge.update(depositMode="base", base="0.25", amount="71.32", depositSource="Synthetic approved zero-near base")
        self.save(value)

    def test_old_issued_notice_remains_recoverable(self):
        value = initial()
        value["events"][0]["payload"]["snapshot"]["authoringVersion"] = 4
        value["events"][0]["payload"]["snapshot"]["items"][0]["cite"] = True
        self.assertEqual(len(self.save(value)["file"]["events"]), 1)

    def test_orphan_and_empty_groups_rejected(self):
        value = pair()
        value["events"][0]["payload"]["snapshot"]["items"][0]["cite"] = False
        with self.assertRaisesRegex(ValueError, "requires selected citations"):
            self.save(value)
        value = pair()
        value["events"][0]["payload"]["snapshot"].pop("issuanceGroup")
        with self.assertRaises(ValueError):
            self.save(value)
        value = pair()
        value["events"][0]["payload"]["snapshot"]["issuanceGroup"] = "invalid"
        with self.assertRaisesRegex(ValueError, "valid issuance group"):
            self.save(value)


if __name__ == "__main__":
    unittest.main(verbosity=2)
