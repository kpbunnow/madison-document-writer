"""Regressions found in the R12 source review. Synthetic temporary records only."""

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import case_lookup
import case_store
import release_evidence
import server
from audit_helper import record


class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_malformed_local_sql_settings(self):
        folder = self.root / "MadisonDocWriter"
        folder.mkdir()
        for raw in (b"{bad json", b"\xff\xfe", b"[]"):
            (folder / case_lookup.LOCAL_TLS_SETTINGS).write_bytes(raw)
            with patch.dict(case_lookup.os.environ, {"LOCALAPPDATA": str(self.root)}):
                with self.assertRaisesRegex(case_lookup.CaseLookupError, "local SQL certificate setting is invalid") as ctx:
                    case_lookup.settings(self.root)
                self.assertEqual(ctx.exception.status, 503)

    def test_case_number_casing_cannot_create_parallel_file(self):
        name = "101 TEST LANE - QA-001.json"
        case_store.save_case(self.root, name, record())
        before = (self.root / name).read_bytes()
        altered = record("second")
        altered["case"]["number"] = "qa-001"
        result = case_store.save_case(self.root, "101 TEST LANE - qa-001.json", altered)
        self.assertEqual(result["name"], name)
        self.assertEqual(len(list(self.root.glob("*.json"))), 1)
        self.assertNotEqual((self.root / name).read_bytes(), before)

    def test_non_string_case_identity_rejected(self):
        for key in ("number", "id"):
            bad = record()
            bad["case"][key] = 123
            with self.assertRaises(ValueError):
                case_store.validate_case(bad)

    def test_malformed_report_lists_excluded(self):
        idx = self.root / "Reporting Index"
        idx.mkdir()
        (self.root / "101 TEST LANE - QA-001.json").write_text("{}")
        for key in ("citations", "referrals", "visits"):
            for bad in ({}, [None]):
                (idx / "QA-001.json").write_text(json.dumps({"format": "madison-case-summary", "case": {"number": "QA-001"}, key: bad}))
                with patch.object(server, "case_dir", return_value=self.root):
                    result = server.read_index()
                self.assertEqual(result["summaries"], [])
                self.assertEqual(len(result["unreadable"]), 1)

    def test_malformed_cache_recovers(self):
        cache = self.root / "parcels.json"
        for content in ([], {"format": "madison-parcel-cache", "parcels": []}):
            cache.write_text(json.dumps(content))
            with patch.object(server, "cache_path", return_value=cache):
                result = server.read_cache()
            self.assertEqual(result["parcels"], {})

    def test_release_evidence_rejects_changed_source_and_missing_suite(self):
        (self.root / "build/test-results").mkdir(parents=True)
        (self.root / "tests/unit").mkdir(parents=True)
        (self.root / "tests/fixtures").mkdir()
        (self.root / "tests/fixtures/tagcheck.js").write_text("// fixture")
        (self.root / "tests/unit/audit_sample.js").write_text("// audit")
        (self.root / "app_template.html").write_text("source one")
        (self.root / "build/dist").mkdir(parents=True)
        (self.root / "build/dist/app.html").write_text("runtime one")
        results = self.root / "build/test-results/results.json"
        results.write_text(json.dumps([{"suite": "audit_sample.js", "passed": True}, {"suite": "tagcheck.js", "passed": True}]))
        evidence = {"files": release_evidence.fingerprint(self.root), "resultsSha256": hashlib.sha256(results.read_bytes()).hexdigest()}
        (self.root / "build/test-results/evidence.json").write_text(json.dumps(evidence))
        release_evidence.verify(self.root)
        (self.root / "app_template.html").write_text("source two")
        with self.assertRaisesRegex(ValueError, "changed after testing"):
            release_evidence.verify(self.root)
        (self.root / "app_template.html").write_text("source one")
        results.write_text("[]")
        with self.assertRaisesRegex(ValueError, "complete regression"):
            release_evidence.verify(self.root)


if __name__ == "__main__":
    unittest.main()
