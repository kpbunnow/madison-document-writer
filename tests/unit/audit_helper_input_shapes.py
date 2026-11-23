"""Malformed request shapes get a clear refusal instead of an internal error (synthetic).

A helper stress test sent saves, summaries and artifact checks whose nested parts had the wrong JSON type. Each one
reached a validator that called a dictionary or string method on a list, string or null, and the browser was shown
the generic "could not confirm" message. These requests must be refused with a ValueError, write nothing, and leave
well-formed requests and stored records as they were. A summary for a case file that is no longer in a connected
folder says so, instead of asking staff to check the folder connection."""

import copy
from pathlib import Path
import tempfile
import unittest

import case_store
import public_errors
import server

NAME = "101 TEST LANE - QA-001.json"


def record(snapshot=None, **payload):
    events = [{"id": "first", "at": "2026-09-19T01:00:00Z", "by": "", "type": "case.opened", "payload": {}}]
    if snapshot is not None or payload:
        body = dict(payload)
        if snapshot is not None:
            body["snapshot"] = snapshot
        events.append({"id": "second", "at": "2026-09-19T01:05:00Z", "by": "i1", "type": "document.saved", "payload": body})
    return {
        "format": "madison-case-file",
        "schema": 3,
        "case": {"id": "case_a", "number": "QA-001", "address": "101 TEST LANE", "owner": "SYNTHETIC OWNER"},
        "inspectors": [],
        "events": events,
    }


WELL_FORMED = {
    "id": "d1",
    "caseId": "case_a",
    "type": "notice",
    "items": [{"id": "x1", "cite": False}],
    "cits": {"x1": {"num": ""}},
    "frozen": {"case": {"number": "QA-001"}, "inspector": None},
}


def damaged():
    for key, value in [
        ("items", "x"),
        ("items", {"x1": {}}),
        ("items", [None]),
        ("items", ["x1"]),
        ("cits", []),
        ("cits", "x"),
        ("cits", {"x1": "N1"}),
        ("cits", {"x1": None}),
        ("frozen", []),
        ("frozen", "x"),
        ("frozen", {"case": None}),
        ("frozen", {"case": "QA-001"}),
        ("frozen", {"inspector": ["i1"]}),
        ("frozen", {"inspector": "i1"}),
    ]:
        snapshot = copy.deepcopy(WELL_FORMED)
        snapshot[key] = value
        yield key, value, snapshot


class HelperInputShapes(unittest.TestCase):
    def test_damaged_snapshots_are_refused_and_nothing_is_written(self):
        with tempfile.TemporaryDirectory() as folder:
            for key, value, snapshot in damaged():
                with self.subTest(key=key, value=value):
                    with self.assertRaisesRegex(ValueError, "damaged structure"):
                        case_store.save_case(Path(folder), NAME, record(snapshot))
                    self.assertFalse((Path(folder) / NAME).exists())
            for value in [None, "x", ["visit"]]:
                with self.subTest(reinspection=value), self.assertRaisesRegex(ValueError, "damaged structure"):
                    case_store.save_case(Path(folder), NAME, record(reinspection=value))
            case_store.save_case(Path(folder), NAME, record(WELL_FORMED, reinspection={"date": "2026-09-19"}))
            self.assertTrue((Path(folder) / NAME).exists())

    def test_stored_records_are_not_refused_when_read(self):
        # Shape checks apply to incoming saves only; an older stored record is still readable for review.
        for _key, _value, snapshot in damaged():
            case_store.validate_case(record(snapshot), legacy=True)

    def test_summary_case_must_be_an_object(self):
        with tempfile.TemporaryDirectory() as folder:
            for value in ["QA-001", ["QA-001"], None, 7]:
                with self.subTest(case=value), self.assertRaisesRegex(ValueError, "Expected a case summary"):
                    case_store.save_summary(Path(folder), NAME, "", {"format": "madison-case-summary", "case": value})

    def test_summary_for_a_missing_case_file_says_so(self):
        with tempfile.TemporaryDirectory() as folder:
            summary = {"format": "madison-case-summary", "case": {"number": "QA-001"}}
            with self.assertRaises(OSError) as raised:
                case_store.save_summary(Path(folder), NAME, "", summary)
            self.assertEqual(public_errors.public_message(raised.exception), case_store.MISSING_CASE_FILE)

    def test_artifact_status_filename_must_be_text(self):
        for value in [None, 7, ["a.pdf"], {"name": "a.pdf"}]:
            item = {"filename": value, "sha256": "0" * 64, "docId": "d1-abcdefgh"}
            with self.subTest(filename=value), self.assertRaisesRegex(ValueError, "Invalid artifact status identity"):
                server.artifact_status([item])


if __name__ == "__main__":
    unittest.main()
