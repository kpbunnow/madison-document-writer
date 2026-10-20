"""Deep-scan regressions: legacy identities, timestamps, retention and PDF filing."""

import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request
import case_store
import server
import audit_r23_helper as fixtures
from scan_legacy_cases import scan


class DeepScanTests(unittest.TestCase):
    setUp = fixtures.R23Tests.setUp
    tearDown = fixtures.R23Tests.tearDown
    request = fixtures.R23Tests.request
    backup = fixtures.R23Tests.backup

    def test_legacy_save_report_resolve_and_inventory(self):
        for n, number in enumerate(("CB_2026_01", "CB 2026 01", "12", "QA/001")):
            file = {
                "format": "madison-case-file",
                "schema": 3,
                "case": {"id": "legacy" + str(n), "number": number, "address": "Legacy property", "owner": "Owner"},
                "events": [],
                "inspectors": [],
            }
            name = "Legacy property - " + number.replace("/", "-") + ".json"
            path = self.case_folder / name
            raw = json.dumps(file).encode()
            path.write_bytes(raw)
            response = case_store.save_case(self.case_folder, name, copy.deepcopy(file), hashlib.sha256(raw).hexdigest(), file["case"])
            self.assertEqual(response["file"]["case"]["number"], number)
            summary = {"format": "madison-case-summary", "summaryVersion": 4, "case": {"number": number}, "documents": []}
            case_store.save_summary(self.case_folder, name, response["revision"], summary)
            status, found = self.request("/cases/resolve?number=" + urllib.parse.quote(number))
            self.assertEqual(status, 200)
            self.assertEqual(found["file"]["case"]["number"], number)
        result = server.read_index()
        self.assertEqual(len(result["summaries"]), 4)
        self.assertFalse(result["missing"])
        self.assertFalse(result["unreadable"])
        before = {p.name: p.read_bytes() for p in self.case_folder.glob("*.json")}
        inventory = scan(self.case_folder)
        self.assertEqual(len(inventory["issues"]), 4)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.case_folder.glob("*.json")})

    def test_new_case_strict_and_normalized_duplicate_blocked(self):
        file = {"format": "madison-case-file", "schema": 3, "case": {"id": "newcase", "number": "CB_2026_01"}, "events": [], "inspectors": []}
        with self.assertRaises(ValueError):
            case_store.save_case(self.case_folder, "Property - CB_2026_01.json", file)
        file["case"]["number"] = "QA-001"
        for name in ("One - QA-001.json", "Two - qa-001.json"):
            (self.case_folder / name).write_text(json.dumps(file))
        with self.assertRaisesRegex(ValueError, "Multiple"):
            case_store.save_case(self.case_folder, "One - QA-001.json", file)

    def test_fractional_seconds_and_nontext_timestamp(self):
        for fraction in ("1", "12", "1234", "12345", "123456", "1234567"):
            stamp = "2026-10-03T04:59:59." + fraction + "Z"
            self.assertEqual(case_store.city_day(stamp).isoformat(), "2026-10-02")
            self.assertGreater(case_store.event_order({"id": "event", "at": stamp})[0], 0)
        for value in (42, {}, [], True, "bad date"):
            with self.assertRaises(ValueError):
                case_store.city_day(value)
            self.assertEqual(case_store.event_order({"id": "event", "at": value})[0], 0)

    def test_new_invalid_timestamp_is_400_and_old_timestamp_is_unchanged(self):
        value = fixtures.audit_authoring.AuthoringStoreTests().notice()
        name = "101 TEST LANE - QA-LIFE.json"
        for invalid in (42, {}, "unreadable old date"):
            candidate = copy.deepcopy(value)
            candidate["events"][0]["at"] = invalid
            status, _ = self.request("/cases/save", {"name": name, "file": candidate})
            self.assertEqual(status, 400)
        value["events"][0]["at"] = "unreadable old date"
        raw = json.dumps(value).encode()
        (self.case_folder / name).write_bytes(raw)
        incoming = copy.deepcopy(value)
        incoming["case"]["owner"] = "UPDATED OWNER"
        saved = case_store.save_case(self.case_folder, name, incoming, hashlib.sha256(raw).hexdigest(), value["case"])
        self.assertEqual(saved["file"]["events"], value["events"])
        self.assertEqual(saved["file"]["case"]["owner"], "UPDATED OWNER")

    def test_policy_messages_follow_settings(self):
        with patch.dict(case_store.MAILING_POLICY, {"MAILED_MAX_DAYS_AHEAD": 2, "CITATION_MAX_DAYS_AHEAD": 1}):
            self.assertIn("2 days", case_store.mailing_message("notice"))
            self.assertIn("1 day", case_store.mailing_message("citation"))

    def test_retention_24_and_case_free_failures(self):
        data = self.backup()
        for n in range(30):
            data["backup"]["sequence"] = n
            server.backup_write(data)
        self.assertEqual(len(list(server.backup_location(data["workspace"], data["case"]).glob("*.json"))), 24)
        with patch.object(Path, "glob", side_effect=OSError("PRIVATE CASE")), patch.object(server, "record") as logged:
            self.assertTrue(server.backup_write(data)["ok"])
            self.assertTrue(any(c.args[:2] == ("backup-retention", "failed") for c in logged.call_args_list))

    def test_pdf_renders_once_then_storage_fallback_and_renderer_error(self):
        self.root.joinpath("share").mkdir(exist_ok=True)
        target = self.root / "share" / server.OUTDIR_NAME / "test.pdf"

        def render(html, path):
            path.write_bytes(b"%PDF-1.4\noriginal bytes")
            return str(path)

        real_file = server.file_pdf_bytes

        def file(path, raw):
            if path == target:
                raise OSError("share unavailable")
            return real_file(path, raw)

        with patch.object(server, "make_pdf", side_effect=render) as rendered, patch.object(server, "file_pdf_bytes", side_effect=file):
            status, result = self.request("/save-pdf", {"filename": "test.pdf", "html": "<p>test</p>"})
            self.assertEqual(status, 200, result)
            self.assertEqual(rendered.call_count, 1)
            self.assertEqual(Path(result["path"]).read_bytes(), b"%PDF-1.4\noriginal bytes")
        with patch.object(server, "make_pdf", side_effect=OSError("renderer startup")) as rendered, patch.object(server, "file_pdf_bytes") as filed:
            status, _ = self.request("/save-pdf", {"filename": "bad.pdf", "html": "<p>test</p>"})
            self.assertEqual(status, 500)
            self.assertEqual(rendered.call_count, 1)
            filed.assert_not_called()

    def test_filing_conflict_preserves_existing_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            p = Path(directory) / "original.pdf"
            p.write_bytes(b"%PDF-original")
            with self.assertRaises(ValueError):
                server.file_pdf_bytes(p, b"%PDF-different")
            self.assertEqual(p.read_bytes(), b"%PDF-original")


if __name__ == "__main__":
    unittest.main()
