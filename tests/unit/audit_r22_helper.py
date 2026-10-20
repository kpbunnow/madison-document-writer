#!/usr/bin/env python3
"""R22 authoritative catalog and bounded recovery tests in temporary storage."""

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import case_store
import server


class R22Helper(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.catalog = self.root / "Catalog Review" / "reviews.json"
        self.catalog.parent.mkdir()
        self.manifest = self.root / "catalog_manifest.json"
        self.key = '["A","B",1]'
        self.manifest.write_text(
            json.dumps(
                {
                    "format": "madison-catalog-manifest",
                    "version": 1,
                    "items": {self.key: {"draft": False, "ordinances": ["1"]}, '["C","D",2]': {"draft": False, "ordinances": ["2"]}},
                }
            )
        )
        self.event = {"id": "issue-1", "type": "notice.issued", "payload": {"snapshot": {"items": [{"libraryKey": self.key, "prov": "notice"}]}}}
        self.record = {"events": [self.event]}

    def tearDown(self):
        self.temp.cleanup()

    def test_catalog_publication_retirement_version_and_frozen_history(self):
        case_store.validate_catalog_publication(None, self.record, self.catalog, self.manifest)
        latest = {"key": self.key, "id": "review-1", "version": 1, "status": "approved"}
        self.catalog.write_text(json.dumps({"format": "madison-catalog-review", "events": [latest]}))
        with self.assertRaisesRegex(ValueError, "version changed"):
            case_store.validate_catalog_publication(None, self.record, self.catalog, self.manifest)
        self.event["payload"]["snapshot"]["items"][0].update(catalogReviewId="review-1", catalogVersion=1)
        case_store.validate_catalog_publication(None, self.record, self.catalog, self.manifest)
        latest["status"] = "retired"
        self.catalog.write_text(json.dumps({"format": "madison-catalog-review", "events": [latest]}))
        with self.assertRaisesRegex(ValueError, "retired"):
            case_store.validate_catalog_publication(None, self.record, self.catalog, self.manifest)
        case_store.validate_catalog_publication(self.record, self.record, self.catalog, self.manifest)

    def test_committed_issuance_acknowledged_after_retirement(self):
        from audit_helper import StoreTests

        fixture = StoreTests()
        base, _ = fixture.correction_fixture()
        item = base["events"][0]["payload"]["snapshot"]["items"][0]
        item.update(libraryKey=self.key, prov="notice", catalogReviewId="review-1", catalogVersion=1)
        latest = {"key": self.key, "id": "review-1", "version": 1, "status": "approved"}
        self.catalog.write_text(json.dumps({"format": "madison-catalog-review", "events": [latest]}))
        folder = self.root / "cases"
        folder.mkdir()
        saved = case_store.save_case(folder, "101 TEST LANE - QA-001.json", base, catalog_file=self.catalog, manifest_file=self.manifest)
        latest["status"] = "retired"
        self.catalog.write_text(json.dumps({"format": "madison-catalog-review", "events": [latest]}))
        acknowledged = case_store.save_case(
            folder, "101 TEST LANE - QA-001.json", base, saved["revision"], base["case"], "issued1", self.catalog, self.manifest
        )
        self.assertTrue(acknowledged["alreadyCommitted"])

    def test_review_concurrency_cycle_and_validation(self):
        data = {
            "key": self.key,
            "status": "approved",
            "reviewer": "QA",
            "wording": "Reviewed wording",
            "ordinances": ["1"],
            "source": "synthetic review",
            "replaces": "",
            "expectedVersion": 0,
        }
        with patch.object(server, "share_root", lambda: self.root), patch.object(server, "HERE", self.root):
            first = server.catalog_review(data)["event"]
            self.assertEqual(first["version"], 1)
            with self.assertRaisesRegex(ValueError, "changed"):
                server.catalog_review(data)
            other = {**data, "key": '["C","D",2]', "expectedVersion": 0, "replaces": self.key}
            server.catalog_review(other)
            with self.assertRaisesRegex(ValueError, "cycle"):
                server.catalog_review({**data, "expectedVersion": 1, "replaces": other["key"]})

    def test_retention_and_failed_write_keep_latest(self):
        work = "a" * 32
        case = "b" * 32
        backup = {
            "format": "madison-draft-recovery",
            "version": 1,
            "workspace": work,
            "case": case,
            "number": "QA",
            "at": "now",
            "included": ["note"],
            "bundle": {"cases": []},
            "pending": [],
        }
        with patch.object(server, "BACKUP_ROOT", self.root / "Draft Backups"):
            first = None
            for n in range(38):
                backup["at"] = str(n)
                if n == 5:
                    backup["preReplacement"] = True
                else:
                    backup.pop("preReplacement", None)
                name = server.backup_write({"workspace": work, "case": case, "backup": backup})["name"]
                if n == 5:
                    first = name
            names = {x["name"] for x in server.backup_list()["backups"]}
            self.assertLessEqual(len(names), 24)
            self.assertIn(first, names)
            self.assertIn(name, names)
            with patch.object(server, "atomic_write", side_effect=OSError("disk full")):
                with self.assertRaises(OSError):
                    server.backup_write({"workspace": work, "case": case, "backup": backup})
            self.assertEqual(server.backup_read({"workspace": work, "case": case, "name": name})["backup"]["at"], "37")

    def test_artifact_request_limits(self):
        with self.assertRaisesRegex(ValueError, "Invalid artifact status list"):
            server.artifact_status([{}] * 201)
        self.assertEqual(server.artifact_status([])["items"], [])


if __name__ == "__main__":
    unittest.main()
