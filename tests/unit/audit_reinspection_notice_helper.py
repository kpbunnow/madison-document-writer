"""Helper rules for the Reinspection Notice (owner request after R64): it is a primary follow-up of a recorded
reinspection that reports the item list without assigning, moving or removing any due date. Past due dates are
allowed on it (a reinspection normally follows the due date) while an Extension still needs a future one; it
needs an outstanding item; and it is outside the workflow of a case already referred to the City Attorney."""

from copy import deepcopy
import unittest

import case_store
import case_projection
from audit_workflow import initial, followup


def historical(value):
    return {event["id"] for event in value["events"][:-1]}


def past_due(base):
    base = deepcopy(base)
    base["events"][0]["payload"]["snapshot"]["items"][0]["due"] = "2026-08-15"
    return base


class ReinspectionNoticeRules(unittest.TestCase):
    def test_a_notice_for_a_reinspection_is_accepted_and_keeps_every_due_date(self):
        value = followup(initial(), "a", "reinspectionNotice")
        snap = value["events"][-1]["payload"]["snapshot"]
        value["events"][-1]["type"] = "reinspectionNotice.issued"
        case_store.validate_history(value, historical(value))
        self.assertEqual([i["due"] for i in snap["items"]], ["2026-10-30"])

    def test_past_due_dates_are_allowed_here_but_not_on_an_extension(self):
        base = past_due(initial())
        notice = followup(base, "a", "reinspectionNotice")
        notice["events"][-1]["type"] = "reinspectionNotice.issued"
        case_store.validate_history(notice, historical(notice))
        extension = followup(base, "b", "extension")
        extension["events"][-1]["payload"]["snapshot"]["items"][0]["due"] = "2026-08-15"
        extension["events"][-1]["type"] = "extension.issued"
        with self.assertRaisesRegex(ValueError, "future due date"):
            case_store.validate_history(extension, historical(extension))

    def test_a_changed_due_date_is_refused(self):
        for new in ("2026-11-15", "2026-08-01", ""):
            value = followup(initial(), "a", "reinspectionNotice")
            value["events"][-1]["type"] = "reinspectionNotice.issued"
            value["events"][-1]["payload"]["snapshot"]["items"][0]["due"] = new
            with self.subTest(due=new), self.assertRaisesRegex(ValueError, "keeps every due date as assigned"):
                case_store.validate_history(value, historical(value))

    def test_a_correction_keeps_every_due_date_too(self):
        def corrected(due):
            value = followup(initial(), "a", "reinspectionNotice")
            value["events"][-1]["type"] = "reinspectionNotice.issued"
            original = value["events"][-1]["payload"]["snapshot"]
            snap = deepcopy(original)
            snap.update(id="doc_a_r1", revision={"targetId": original["id"], "rootId": original["id"], "number": 1})
            snap["items"][0]["note"] = "Corrected observation wording"
            snap["items"][0]["due"] = due
            value["events"].append(
                {
                    "id": "correction_a",
                    "at": "2026-09-20T15:00:00Z",
                    "by": "inspector_1",
                    "type": "correction.issued",
                    "payload": {
                        "docId": snap["id"],
                        "snapshot": snap,
                        "replaces": original["id"],
                        "baseEventId": value["events"][-1]["id"],
                        "reason": "Correct the observation wording.",
                        "changes": [{"path": "item.1.note"}],
                        "reviewedAt": "2026-09-20T15:00:00Z",
                    },
                }
            )
            return value

        kept = corrected("2026-10-30")
        case_store.validate_history(kept, historical(kept))
        for due in ("2026-11-15", ""):
            value = corrected(due)
            with self.subTest(due=due), self.assertRaisesRegex(ValueError, "keeps every due date as assigned"):
                case_store.validate_history(value, historical(value))

    def test_it_needs_an_outstanding_item(self):
        value = followup(initial(), "a", "reinspectionNotice", outcome="corrected")
        value["events"][-1]["type"] = "reinspectionNotice.issued"
        with self.assertRaisesRegex(ValueError, "at least one outstanding item"):
            case_store.validate_history(value, historical(value))

    def test_a_referred_case_cannot_receive_one(self):
        base = followup(initial(), "ref", "referral")
        value = followup(base, "b", "reinspectionNotice")
        value["events"][-1]["type"] = "reinspectionNotice.issued"
        with self.assertRaisesRegex(ValueError, "outside the case referral workflow"):
            case_store.validate_history(value, historical(value))

    def test_the_event_name_must_match_the_document_type(self):
        value = followup(initial(), "a", "reinspectionNotice")
        value["events"][-1]["type"] = "extension.issued"
        with self.assertRaisesRegex(ValueError, "disagree"):
            case_store.validate_history(value, historical(value))

    def test_status_and_document_label_are_the_reinspection_notice(self):
        self.assertEqual(case_projection.STATUS_OF["reinspectionNotice"], "Reinspection")
        self.assertEqual(case_projection.DOC_LABELS["reinspectionNotice"], "Reinspection Notice")


if __name__ == "__main__":
    unittest.main()
