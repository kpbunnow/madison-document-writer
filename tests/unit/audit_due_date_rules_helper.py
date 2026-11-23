"""The helper's outstanding-deadline rules, at the edges generated mutation testing found untested (synthetic)."""

import unittest

import case_store as store
from citation_disposition import CITATION_ONLY


def item(n, due, **extra):
    return {"id": str(n), "no": str(n), "due": due, **extra}


class DueDateRules(unittest.TestCase):
    def authoring(self, items, **snap):
        return store._validate_authoring_document(
            snap={"type": "notice", "items": items, "mailed": "2026-11-14", "inspDate": "2026-11-10", **snap}, check_date_window=False, at=None
        )

    def test_only_outstanding_items_count_toward_three_dates(self):
        three = [item(1, "2026-12-01"), item(2, "2026-12-15"), item(3, "2027-01-05")]
        self.authoring(three)
        for extra in [item(4, "2027-02-01", done=True), item(4, "2027-02-01", withdrawn=True)]:
            with self.subTest(extra=extra):
                self.authoring(three + [extra])
        initial_citation = {
            "type": "citation",
            "authoringVersion": 16,
            "issuanceGroup": {"noticeId": "n", "citationId": "c"},
            "importInspection": {"type": "initial"},
        }
        self.authoring([*(dict(i, cite=True) for i in three), item(4, "", dueExempt=CITATION_ONLY, cite=True)], **initial_citation)
        with self.assertRaisesRegex(ValueError, "three distinct"):
            self.authoring(three + [item(4, "2027-02-01")])

    def test_mailed_date_must_be_a_real_date_after_the_inspection(self):
        self.authoring([item(1, "2026-12-01")])
        for mailed in ["2026-02-30", "", "11/14/2026"]:
            with self.subTest(mailed=mailed), self.assertRaises(ValueError):
                self.authoring([item(1, "2026-12-01")], mailed=mailed)
        with self.assertRaises(ValueError):
            self.authoring([item(1, "2026-12-01")], mailed="2026-11-09")

    def test_seven_day_spacing_applies_to_notices_extensions_and_citations_only(self):
        close = [item(1, "2026-12-01"), item(2, "2026-12-03")]
        for kind in ["notice", "extension", "citation"]:
            with self.subTest(kind=kind), self.assertRaisesRegex(ValueError, "seven days"):
                store._validate_due_spacing(snap={"type": kind}, items=close, original=None)
        for kind in ["compliance", "referral", "bestInterestExtension"]:
            with self.subTest(kind=kind):
                store._validate_due_spacing(snap={"type": kind}, items=close, original=None)
        store._validate_due_spacing(snap={"type": "citation", "caseType": "snow-10.28", "authoringVersion": 11}, items=close, original=None)


if __name__ == "__main__":
    unittest.main()
