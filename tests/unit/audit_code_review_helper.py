"""Helper defects found by the 2026-11-27 code review (synthetic).

- An earlier-format summary holding NaN passed into the Reports index response, which no browser can parse, so one
  such file stopped every report from loading. It is now refused and named like any unreadable summary.
- A citation number that differed only in letter case (b2000000001 for B2000000001) was accepted as a new number on
  another case, on the same case and on the same citation. New citations now compare without regard to case;
  issued records are replayed with the exact comparison they were saved under.
- A lock written by a PC whose clock ran ahead looked recent, and could not be released, until real time caught up.
  Its age is now bounded by the lock file's own time."""

import json
import os
from pathlib import Path
import socket
import tempfile
import time
import unittest
from unittest.mock import patch

import audit_r30_helper
import case_store
import operations_helper as operations
import publication_validation
from audit_citation_number_uniqueness import cited
from audit_helper_scale_reads import shared_folder


class NonfiniteSummary(unittest.TestCase):
    def test_nan_summary_is_refused_and_the_index_stays_readable(self):
        import server

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            index = shared_folder(root, 3)
            damaged = index / "qa-sc-1.json"
            damaged.write_text(damaged.read_text().replace('"format"', '"extra": NaN, "format"', 1))
            with patch.dict(os.environ, {"DW_CASE_DIR": str(root)}):
                out = server.read_index()
            self.assertEqual(len(out["summaries"]), 2)
            self.assertEqual(out["unreadable"], ["qa-sc-1.json (Summary numbers must be finite)"])
            json.dumps(out, allow_nan=False)  # the response is JSON a browser can read


class CitationNumberCase(unittest.TestCase):
    def test_another_case_cannot_reuse_a_number_in_another_letter_case(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.assertTrue(case_store.save_case(root, "101 TEST LANE - QA-CASE-1.json", cited("QA-CASE-1", "B2000000101", "FIRST OWNER LLC"))["ok"])
            with self.assertRaisesRegex(ValueError, "Citation number b2000000101 is already in use on case QA-CASE-1"):
                case_store.save_case(root, "101 TEST LANE - QA-CASE-2.json", cited("QA-CASE-2", "b2000000101", "SECOND OWNER LLC", tier=2))
            self.assertFalse((root / "101 TEST LANE - QA-CASE-2.json").exists())

    def test_one_case_cannot_reuse_a_number_in_another_letter_case(self):
        snap = {"cits": {"x": {"num": "b9"}}}
        documents = {"old": ({"cits": {"a": {"num": "B9"}}}, "e1")}
        items = [{"id": "x", "cite": True}]
        with self.assertRaisesRegex(ValueError, "distinct citation numbers"):
            publication_validation._validate_new_citation_numbers(items=items, documents=documents, snap=snap, fold=True)
        # Replaying an issued record keeps the comparison it was saved under.
        publication_validation._validate_new_citation_numbers(items=items, documents=documents, snap=snap, fold=False)

    def test_one_citation_cannot_repeat_a_number_in_another_letter_case(self):
        value = audit_r30_helper.DepositTests().value(number="QA-CASE-3")
        snap = value["events"][-1]["payload"]["snapshot"]
        cited_item = next(i for i in snap["items"] if i.get("cite"))
        twin = dict(cited_item, id="twin", no=str(len(snap["items"]) + 1))
        snap["items"].append(twin)
        snap["cits"]["twin"] = dict(snap["cits"][cited_item["id"]], num=snap["cits"][cited_item["id"]]["num"].lower())
        with (
            patch.object(case_store, "_validate_citation_calendar"),
            patch.object(case_store, "_validate_cash_citation"),
            patch.object(case_store, "_validate_citation_policy"),
        ):
            with self.assertRaisesRegex(ValueError, "distinct citation numbers"):
                case_store.validate_authoring(snap, check_date_window=True)
            case_store.validate_authoring(snap, check_date_window=False)


class LockClock(unittest.TestCase):
    def test_a_lock_from_a_clock_ahead_is_aged_by_its_file_time(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / ".locks").mkdir()
            path = operations.lock_path(root, "QA-CLOCK-1")
            path.write_text(json.dumps({"pid": 99999999, "host": "AHEAD-PC", "at": time.time() + 86400, "owner": "orphan"}))
            os.utime(path, (time.time() - 120, time.time() - 120))
            status = operations.lock_status(root, "QA-CLOCK-1")
            self.assertGreaterEqual(status["ageSeconds"], 119)
            data = {
                "number": "QA-CLOCK-1",
                "token": status["token"],
                "administrator": "Synthetic Admin",
                "reason": "Verified the owning helper has stopped on AHEAD-PC.",
                "confirmed": True,
            }
            self.assertTrue(operations.release_lock(root, data)["released"])

    def test_a_recent_lock_still_cannot_be_released(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / ".locks").mkdir()
            path = operations.lock_path(root, "QA-CLOCK-2")
            path.write_text(json.dumps({"pid": 99999999, "host": socket.gethostname() + "-other", "at": time.time() + 86400, "owner": "o"}))
            status = operations.lock_status(root, "QA-CLOCK-2")
            self.assertLess(status["ageSeconds"], 30)
            data = {"number": "QA-CLOCK-2", "token": status["token"], "administrator": "Synthetic Admin", "reason": "x" * 20, "confirmed": True}
            with self.assertRaisesRegex(ValueError, "recent"):
                operations.release_lock(root, data)


if __name__ == "__main__":
    unittest.main()
