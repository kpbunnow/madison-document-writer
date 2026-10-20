#!/usr/bin/env python3
"""Local-helper recovery, catalog, and artifact location boundaries."""

import hashlib
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import server


class R21Helper(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        shutil.copyfile((Path(__file__).resolve().parents[2] / "app/assets/catalog_manifest.json"), self.root / "catalog_manifest.json")
        self.workspace = "a" * 32
        self.case = "b" * 32
        self.backup = {
            "format": "madison-draft-recovery",
            "version": 1,
            "workspace": self.workspace,
            "case": self.case,
            "number": "QA-1",
            "at": "2026-10-01T00:00:00Z",
            "included": ["one worksheet"],
            "bundle": {"cases": []},
            "pending": [],
        }
        self.patchers = [
            patch.object(server, "BACKUP_ROOT", self.root / "Draft Backups"),
            patch.object(server, "HERE", self.root),
            patch.object(server, "share_root", lambda: self.root / "shared"),
        ]
        for p in self.patchers:
            p.start()

    def tearDown(self):
        for p in reversed(self.patchers):
            p.stop()
        self.tmp.cleanup()

    def write(self):
        return server.backup_write({"workspace": self.workspace, "case": self.case, "backup": self.backup})

    def test_separate_snapshots_retention_and_read(self):
        names = []
        for n in range(15):
            self.backup["at"] = f"2026-10-01T00:00:{n:02d}Z"
            names.append(self.write()["name"])
        listing = server.backup_list()["backups"]
        self.assertLessEqual(len(listing), 24)
        self.assertGreaterEqual(len(listing), 8)
        self.assertEqual(server.backup_read({"workspace": self.workspace, "case": self.case, "name": names[-1]})["backup"]["at"], self.backup["at"])
        self.assertFalse((self.root / "shared" / "Case JSON Files").exists())

    def test_interrupted_write_keeps_last_success(self):
        first = self.write()["name"]
        self.backup["at"] = "later"
        with patch.object(server, "atomic_write", side_effect=OSError("disk unavailable")):
            with self.assertRaises(OSError):
                self.write()
        self.assertEqual(server.backup_read({"workspace": self.workspace, "case": self.case, "name": first})["backup"]["number"], "QA-1")

    def test_corrupt_older_and_cross_workspace_are_rejected(self):
        name = self.write()["name"]
        path = server.backup_location(self.workspace, self.case) / name
        path.write_text("{corrupt")
        with self.assertRaisesRegex(ValueError, "checksum"):
            server.backup_read({"workspace": self.workspace, "case": self.case, "name": name})
        self.backup["version"] = 0
        with self.assertRaisesRegex(ValueError, "format"):
            self.write()
        self.backup["version"] = 1
        with self.assertRaisesRegex(ValueError, "identity"):
            server.backup_write({"workspace": "c" * 32, "case": self.case, "backup": self.backup})
        with self.assertRaises(ValueError):
            server.backup_read({"workspace": "../private", "case": self.case, "name": name})

    def test_catalog_versions_and_atomic_failure(self):
        data = {
            "key": '["ENF_HSE","GM_INTERIOR",10]',
            "status": "approved",
            "reviewer": "Reviewer Name",
            "wording": "Approved corrective action",
            "ordinances": ["27.05(2)(c)"],
            "source": "Division review 2026-10-01",
            "replaces": "",
        }
        first = server.catalog_review(data)["event"]
        self.assertEqual(first["version"], 1)
        second = server.catalog_review({**data, "wording": "Revised wording"})["event"]
        self.assertEqual(second["version"], 2)
        with patch.object(server, "atomic_write", side_effect=OSError("share unavailable")):
            with self.assertRaises(OSError):
                server.catalog_review({**data, "status": "retired"})
        self.assertEqual(len(server.catalog_events()), 2)
        with self.assertRaisesRegex(ValueError, "required"):
            server.catalog_review({**data, "reviewer": ""})

    def test_artifact_locations_are_bound_to_checksum_and_doc(self):
        doc = "d1234-abcdef1234567890"
        tag = "1234567890"[-8:]
        name = "Case - " + tag + ".pdf"
        raw = b"%PDF-1.4\narchived original\n"
        sha = hashlib.sha256(raw).hexdigest()
        local = self.root / server.OUTDIR_NAME
        local.mkdir()
        (local / name).write_bytes(raw)
        item = {"filename": name, "sha256": sha, "docId": doc}
        self.assertEqual(server.artifact_status([item])["items"][0]["locations"], ["local"])
        shared = self.root / "shared" / server.OUTDIR_NAME
        shared.mkdir(parents=True)
        (shared / name).write_bytes(b"%PDF-1.4\nconflict")
        self.assertIn("shared conflict", server.artifact_status([item])["items"][0]["locations"])
        with self.assertRaisesRegex(ValueError, "belong"):
            server.artifact_status([{**item, "docId": "another-id"}])
        with self.assertRaises(ValueError):
            server.artifact_status([{**item, "filename": "../escape.pdf"}])


if __name__ == "__main__":
    unittest.main()
