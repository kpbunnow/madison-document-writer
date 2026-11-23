"""A citation number already in force on one shared case cannot be issued on another (synthetic).

A concurrency stress test had five PCs issue initial citations on five different cases with the same citation number
at the same time; all five were accepted. The same happened one after another: distinct numbers were only checked
within one case."""

from pathlib import Path
import tempfile
import unittest

import audit_r30_helper
import case_store


def cited(number, citation_number, owner, tier=1):
    # The synthetic cases share one site, so a later citation there is a repeat offense (tier 2).
    value = audit_r30_helper.DepositTests().value(number=number, tier=tier)
    value["case"]["owner"] = owner
    for event in value["events"]:
        event["payload"]["snapshot"]["frozen"]["case"]["owner"] = owner
    value["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]["num"] = citation_number
    return value


class CitationNumberUniqueness(unittest.TestCase):
    def test_a_number_in_force_on_another_case_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            first = case_store.save_case(root, "101 TEST LANE - QA-NUM-1.json", cited("QA-NUM-1", "B2000000001", "FIRST OWNER LLC"))
            self.assertTrue(first["ok"])
            with self.assertRaisesRegex(ValueError, "Citation number B2000000001 is already in use on case QA-NUM-1"):
                case_store.save_case(root, "101 TEST LANE - QA-NUM-2.json", cited("QA-NUM-2", "B2000000001", "SECOND OWNER LLC", tier=2))
            self.assertFalse((root / "101 TEST LANE - QA-NUM-2.json").exists(), "nothing is written for the refused citation")
            second = case_store.save_case(root, "101 TEST LANE - QA-NUM-2.json", cited("QA-NUM-2", "B2000000002", "SECOND OWNER LLC", tier=2))
            self.assertTrue(second["ok"])

    def test_resaving_a_cited_case_keeps_its_own_number(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            first = case_store.save_case(root, "101 TEST LANE - QA-NUM-3.json", cited("QA-NUM-3", "B2000000003", "THIRD OWNER LLC"))
            again = case_store.save_case(root, first["name"], first["file"], first["revision"], first["file"]["case"])
            self.assertTrue(again["ok"])

    def test_only_selected_outstanding_items_count(self):
        record = cited("QA-NUM-4", "B2000000004", "FOURTH OWNER LLC")
        history = [{"case": {"number": "QA-OTHER"}, "document": {"cits": {"x": {"num": "B2000000004"}}}}]
        snapshot = record["events"][-1]["payload"]["snapshot"]
        snapshot["items"][0]["withdrawn"] = True
        case_store._refuse_reused_citation_numbers(record, set(), history)
        snapshot["items"][0]["withdrawn"] = False
        with self.assertRaisesRegex(ValueError, "already in use on case QA-OTHER"):
            case_store._refuse_reused_citation_numbers(record, set(), history)
        case_store._refuse_reused_citation_numbers(record, {e["id"] for e in record["events"]}, history)


if __name__ == "__main__":
    unittest.main()
