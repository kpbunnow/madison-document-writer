"""Damaged auxiliary files cannot crash diagnostics or emit JSON the browser cannot read.

Synthetic files only. Reads leave bytes intact; locks still require the existing administrator safeguards.
"""

import http.client
import json
import os
from pathlib import Path
import socket
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from audit_helper_scale_reads import shared_folder
import operations_helper as operations
import scan_legacy_cases
import server


class AuxiliaryMetadata(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_parcel_cache_route_remains_browser_readable_and_preserves_bad_bytes(self):
        cache = self.root / "parcels.json"
        listener = server.Server(("127.0.0.1", 0), server.Handler)
        worker = threading.Thread(target=listener.serve_forever, daemon=True)
        worker.start()

        def refuse(token):
            raise ValueError("Browser cannot parse " + token)

        try:
            with patch.object(server, "cache_path", return_value=cache), patch.object(server, "PORT", listener.server_address[1]):
                for token in ("NaN", "Infinity", "-Infinity", "1e999", "9" * 400, "[" * 200000 + "0" + "]" * 200000):
                    raw = ('{"format":"madison-parcel-cache","parcels":{"001":{"history":[{"lat":' + token + "}]}}}").encode()
                    cache.write_bytes(raw)
                    connection = http.client.HTTPConnection("127.0.0.1", server.PORT, timeout=10)
                    try:
                        connection.request("GET", "/reporting/parcels", headers={"X-DocWriter-Token": server.SESSION_TOKEN})
                        response = connection.getresponse()
                        answer = json.loads(response.read(), parse_constant=refuse)
                        self.assertEqual(response.status, 200)
                        self.assertTrue(answer["ok"])
                        self.assertEqual(answer["parcels"], {})
                        self.assertEqual(cache.read_bytes(), raw)
                    finally:
                        connection.close()
        finally:
            listener.shutdown()
            listener.server_close()
            worker.join(timeout=2)

    def test_valid_parcel_history_is_retained_exactly(self):
        cache = self.root / "parcels.json"
        value = {
            "format": "madison-parcel-cache",
            "parcels": {"001": {"history": [{"fetched": "2025-01-02", "lat": 43.1, "lon": -89.4}]}},
            "missing": {},
        }
        raw = json.dumps(value).encode()
        cache.write_bytes(raw)
        with patch.object(server, "cache_path", return_value=cache):
            self.assertEqual(server.read_cache(), value)
        self.assertEqual(cache.read_bytes(), raw)

    def test_inventory_uses_case_decoder_and_names_bad_files_without_modifying_them(self):
        shared_folder(self.root, 2)
        valid = self.root / "TEST - QA-SC-0.json"
        valid.write_bytes(b"\xef\xbb\xbf" + valid.read_bytes())
        bad = self.root / "TEST - QA-SC-1.json"
        for content in (b"null", b"[1]", b"[" * 200000 + b"0" + b"]" * 200000):
            with self.subTest(prefix=content[:20]):
                bad.write_bytes(content)
                before = {p: p.read_bytes() for p in (valid, bad)}
                result = scan_legacy_cases.scan(self.root)
                self.assertEqual(result["scanned"], 2)
                self.assertEqual([row["file"] for row in result["issues"]], [bad.name])
                self.assertIn("Unreadable", result["issues"][0]["issue"])
                self.assertEqual({p: p.read_bytes() for p in (valid, bad)}, before)

    def test_inventory_refuses_linked_cases(self):
        target = self.root / "original.txt"
        target.write_text('{"case":{"number":"QA-001"}}')
        linked = self.root / "LINK - QA-001.json"
        try:
            linked.symlink_to(target)
        except OSError:
            self.skipTest("This account cannot create a test symlink")
        result = scan_legacy_cases.scan(self.root)
        self.assertEqual(result["scanned"], 1)
        self.assertEqual([r["file"] for r in result["issues"]], [linked.name])
        self.assertIn("Unreadable", result["issues"][0]["issue"])

    def test_unusable_lock_values_are_reported_without_releasing_the_lock(self):
        path = operations.lock_path(self.root, "QA-METADATA")
        path.parent.mkdir()
        values = [
            json.dumps({"at": 10**400}).encode(),
            json.dumps({"host": socket.gethostname(), "pid": 10**100}).encode(),
            b"[" * 200000 + b"0" + b"]" * 200000,
        ]
        for raw in values:
            with self.subTest(prefix=raw[:40]):
                path.write_bytes(raw)
                status = operations.lock_status(self.root, "QA-METADATA")
                self.assertTrue(status["present"])
                self.assertEqual(status["host"], "Unreadable lock metadata")
                self.assertEqual(status["ownership"], "remote or unknown")
                self.assertIsNone(status["ownerRunning"])
                self.assertLess(status["ageSeconds"], 30)
                self.assertEqual(path.read_bytes(), raw)
                data = {
                    "number": "QA-METADATA",
                    "token": status["token"],
                    "administrator": "Synthetic Admin",
                    "reason": "Synthetic verification of a stopped helper",
                    "confirmed": True,
                }
                with self.assertRaisesRegex(ValueError, "recent"):
                    operations.release_lock(self.root, data)
                self.assertEqual(path.read_bytes(), raw)

    def test_live_local_lock_owner_still_cannot_be_released(self):
        path = operations.lock_path(self.root, "QA-LIVE")
        path.parent.mkdir()
        path.write_text(json.dumps({"host": socket.gethostname(), "pid": os.getpid(), "at": time.time() - 120}))
        os.utime(path, (time.time() - 120, time.time() - 120))
        status = operations.lock_status(self.root, "QA-LIVE")
        self.assertTrue(status["ownerRunning"])
        data = {
            "number": "QA-LIVE",
            "token": status["token"],
            "administrator": "Synthetic Admin",
            "reason": "Synthetic verification of the current helper",
            "confirmed": True,
        }
        with self.assertRaisesRegex(ValueError, "still running"):
            operations.release_lock(self.root, data)
        self.assertTrue(path.exists())

    def test_bad_catalog_manifest_does_not_hide_other_setup_facts(self):
        manifest = self.root / "catalog_manifest.json"
        with (
            patch.object(server, "resource", return_value=manifest),
            patch.object(server, "case_dir", return_value=self.root),
            patch.object(server, "share_root", return_value=self.root),
        ):
            for raw in (b"[]", b"null", b"42", b"[" * 200000 + b"0" + b"]" * 200000):
                with self.subTest(prefix=raw[:20]):
                    manifest.write_bytes(raw)
                    status = operations.health(server)
                    self.assertFalse(status["catalogManifest"])
                    self.assertTrue(status["shareReachable"])
                    self.assertTrue(status["caseReachable"])
                    self.assertTrue(status["versionMatch"])
                    self.assertEqual(manifest.read_bytes(), raw)
            manifest.write_text('{"format":"madison-catalog-manifest","items":{}}')
            self.assertTrue(operations.health(server)["catalogManifest"])


if __name__ == "__main__":
    unittest.main()
