"""Lock assistance, ownership and diagnostics privacy regressions."""

import json
import os
from pathlib import Path
import socket
import tempfile
import time
import unittest
from unittest.mock import patch
import operations_helper as op
from case_store import file_lock
import server


class SafetyTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.folder = Path(self.temp.name)
        (self.folder / ".locks").mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def lock(self, host="other-computer", pid=999999):
        path = op.lock_path(self.folder, "QA-LOCK")
        path.write_text(json.dumps({"host": host, "pid": pid, "at": time.time() - 3600}))
        status = op.lock_status(self.folder, "qa-lock")
        return path, {
            "number": "QA-LOCK",
            "token": status["token"],
            "administrator": "Test Admin",
            "reason": "Verified owning helper stopped before release",
            "confirmed": True,
        }

    def test_explicit_release_preserves_audit_and_original_lock(self):
        path, data = self.lock()
        self.assertGreater(op.lock_status(self.folder, "QA-LOCK")["ageSeconds"], 3500)
        result = op.release_lock(self.folder, data)
        self.assertTrue(result["released"])
        self.assertFalse(path.exists())
        note = self.folder / "_lock-administration" / (result["audit"] + ".json")
        self.assertEqual(json.loads(note.read_text())["reason"], data["reason"])
        self.assertTrue(note.with_suffix(".lock").exists())

    def test_no_release_without_confirmation_or_matching_token(self):
        path, data = self.lock()
        for changed in ({**data, "confirmed": False}, {**data, "token": "wrong"}, {**data, "reason": "short"}):
            with self.assertRaises(ValueError):
                op.release_lock(self.folder, changed)
            self.assertTrue(path.exists())

    def test_live_local_owner_is_never_released(self):
        path, data = self.lock(socket.gethostname(), os.getpid())
        with self.assertRaises(ValueError):
            op.release_lock(self.folder, data)
        self.assertTrue(path.exists())

    def test_audit_failure_keeps_lock(self):
        path, data = self.lock()
        with patch.object(op, "atomic_write", side_effect=OSError("failed")):
            with self.assertRaises(OSError):
                op.release_lock(self.folder, data)
        self.assertTrue(path.exists())

    def test_context_never_removes_successor_lock(self):
        path = op.lock_path(self.folder, "QA-LOCK")
        with file_lock(self.folder, "case:qa-lock"):
            path.write_text(json.dumps({"owner": "successor"}))
        self.assertTrue(path.exists())

    def test_health_does_not_include_case_content(self):
        with patch.object(server, "case_dir", return_value=self.folder), patch.object(server, "share_root", return_value=self.folder):
            result = op.health(server)
        self.assertTrue(result["caseReachable"])
        self.assertIsNone(result["shareWritable"])
        self.assertNotIn("caseNumber", result)
        self.assertEqual(result["lookupConnection"], "Not tested")


if __name__ == "__main__":
    unittest.main()
