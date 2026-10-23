"""R62 helper rules for authoring-16 Best Interest and Vacancy Extensions (owner, Development 3): every uncorrected
item is covered, no safety confirmation or signer review; Best Interest due dates follow the normal Extension rules
and a Vacancy Extension has no due date for uncorrected items and a review inspection at least seven days out."""

from copy import deepcopy
import unittest

import case_store
from audit_r26_helper import append_action, special
from audit_workflow import initial, followup


def fixture(kind):
    snap = {
        "type": kind,
        "authoringVersion": 16,
        "mailed": "2026-10-23",
        "inspDate": "2026-10-22",
        "items": [
            {"id": "a", "no": "1", "due": "2026-11-12"},
            {"id": "b", "no": "2", "due": "2026-11-20"},
            {"id": "c", "no": "3", "due": "2026-10-01", "done": True, "doneOn": "2026-10-22"},
        ],
        "special": {"affected": ["1", "2"], "originalDues": {"1": "2026-10-01", "2": "2026-10-01", "3": "2026-10-01"}},
    }
    if kind == "bestInterestExtension":
        snap["special"]["reason"] = "The contractor repair plan supports additional time."
    else:
        for item in snap["items"][:2]:
            item["due"] = ""
        snap["special"].update(scope="building", reviewDate="2026-10-30")
    return snap


def validate(snap):
    case_store.validate_special_fields(snap, "2026-10-23T15:00:00Z")


class AllItemExtensions(unittest.TestCase):
    def test_pre_r62_referred_emergency_history_still_validates(self):
        base = followup(initial(), "ref", "referral")
        base["schema"] = 4
        facts = deepcopy(special()["events"][-1]["payload"]["snapshot"]["special"])
        facts.update(emergencyApproved=True, referralCoordination="Previously approved City Attorney coordination")
        value = append_action(base, "summaryAbatement", facts, True)
        historical = {event["id"] for event in value["events"]}
        case_store.validate_history(value, historical)
        # Historical exceptions do not authorize any newly submitted order, even at an old authoring version.
        with self.assertRaisesRegex(ValueError, "only an Update for Case Referral or a Compliance Letter"):
            case_store.validate_history(value, historical - {value["events"][-1]["id"]})

    def test_valid_documents_need_no_safety_confirmation_or_signer_review(self):
        for kind in ("bestInterestExtension", "vacancyExtension"):
            snap = fixture(kind)
            saved = deepcopy(snap)
            validate(snap)
            self.assertEqual(snap, saved, "validation never fabricates facts")

    def test_every_uncorrected_item_is_covered(self):
        for kind in ("bestInterestExtension", "vacancyExtension"):
            for affected in (["1"], ["1", "2", "3"], [], ["1", "1"]):
                snap = fixture(kind)
                snap["special"]["affected"] = affected
                with self.subTest(kind=kind, affected=affected), self.assertRaisesRegex(ValueError, "every uncorrected item"):
                    validate(snap)
            snap = fixture(kind)
            snap["items"][2]["due"] = "2026-12-01"
            with self.assertRaisesRegex(ValueError, "Corrected item dates"):
                validate(snap)

    def test_best_interest_due_dates_follow_the_normal_extension_rules(self):
        snap = fixture("bestInterestExtension")
        snap["special"]["originalDues"]["1"] = "2026-12-01"
        validate(snap)  # a date earlier than the source deadline is not refused; only a future date is required
        for due, message in (("2026-10-23", "future due date"), ("", "future due date"), ("2026-11-15", "seven days apart")):
            snap = fixture("bestInterestExtension")
            snap["items"][0]["due"] = due
            with self.subTest(due=due), self.assertRaisesRegex(ValueError, message):
                validate(snap)
        snap = fixture("bestInterestExtension")
        snap["special"]["reason"] = " "
        with self.assertRaisesRegex(ValueError, "reason"):
            validate(snap)

    def test_vacancy_has_no_item_due_dates_and_a_review_seven_days_out(self):
        for review in ("2026-10-29", "", "not a date"):
            snap = fixture("vacancyExtension")
            snap["special"]["reviewDate"] = review
            with self.subTest(review=review), self.assertRaisesRegex(ValueError, "seven days after mailing"):
                validate(snap)
        snap = fixture("vacancyExtension")
        snap["items"][0]["due"] = "2026-12-01"
        with self.assertRaisesRegex(ValueError, "no due date"):
            validate(snap)
        snap = fixture("vacancyExtension")
        snap["special"]["scope"] = "unit"
        with self.assertRaisesRegex(ValueError, "unit"):
            validate(snap)
        snap["special"]["unit"] = "2"
        validate(snap)

    def test_earlier_formats_keep_their_requirements(self):
        snap = fixture("vacancyExtension")
        snap["authoringVersion"] = 13
        with self.assertRaisesRegex(ValueError, "reviewer"):
            validate(snap)
        snap = fixture("bestInterestExtension")
        snap["authoringVersion"] = 15
        snap["special"]["affected"] = ["1"]
        with self.assertRaisesRegex(ValueError, "exclude reviewed safety"):
            validate(snap)


if __name__ == "__main__":
    unittest.main()
