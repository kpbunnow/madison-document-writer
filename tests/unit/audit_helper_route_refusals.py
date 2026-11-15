"""Actual route handlers retain status/error/body contracts when subordinate operations fail.
Session/Host/Origin authentication remains covered by the real HTTP session suite; these are isolated handlers.
"""

import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import server
import snow_rules


class RouteRefusals(unittest.TestCase):
    def handler(self, body=b"{}", size=None):
        handler = object.__new__(server.Handler)
        handler.path = "/locks/status?number=QA-SYNTHETIC"
        handler.headers = {"Content-Length": str(len(body) if size is None else size)}
        handler.rfile, handler.wfile = io.BytesIO(body), io.BytesIO()
        handler._json = lambda status, data: (status, data)
        handler._guard_read = lambda: None
        handler.send_response = lambda status: self.assertEqual(status, 200)
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        return handler

    def test_read_handlers_distinguish_validation_refusal_from_share_unavailability(self):
        routes = [
            ("_get_lock_status", "/locks/status", server.operations_helper, "lock_status"),
            ("_get_workflow_reads", "/outbox/list", server.workflow_helper, "outbox_files"),
            ("_get_workflow_reads", "/reporting/views", server.workflow_helper, "shared_views"),
            ("_get_citation_history", "/citation-history", server, "citation_history"),
        ]
        with tempfile.TemporaryDirectory() as folder, patch.object(server, "case_dir", return_value=Path(folder)):
            for method, route, owner, operation in routes:
                for failure, expected in [
                    (ValueError("synthetic refusal"), 400),
                    (TypeError("private implementation detail"), 400),
                    (OSError("private share path"), 503),
                ]:
                    with self.subTest(route=route, failure=type(failure)), patch.object(owner, operation, side_effect=failure):
                        status, data = getattr(self.handler(), method)(route)
                        self.assertEqual(status, expected)
                        self.assertFalse(data["ok"])
                        self.assertNotIn("private", data["error"])
            for method, operation in [("_get_backup_list", "backup_list"), ("_get_catalog_reviews", "catalog_events")]:
                with patch.object(server, operation, side_effect=TypeError("private path")):
                    status, data = getattr(self.handler(), method)("/synthetic")
                    self.assertEqual(status, 503)
                    self.assertFalse(data["ok"])
                    self.assertNotIn("private", data["error"])

    def test_snow_read_guard_precedes_files_and_read_failure_is_not_success(self):
        handler = self.handler()
        handler._guard_read = lambda: "session refused"
        with patch.object(snow_rules, "read_letter") as read:
            self.assertEqual(handler._get_snow_letter("/snow/letter"), (403, {"ok": False, "error": "session refused"}))
            read.assert_not_called()
        with patch.object(snow_rules, "read_letter", side_effect=OSError("synthetic share unavailable")):
            self.assertEqual(self.handler()._get_snow_letter("/snow/letter")[0], 400)

    def test_post_size_json_and_shape_refusals_do_not_call_effects(self):
        methods = [
            "_post_lock_or_probe",
            "_post_workflow",
            "_post_address_parse",
            "_post_case_lookup",
            "_post_inspector_cases",
            "_post_shared_records",
        ]
        with (
            patch.object(server.operations_helper, "release_lock") as release,
            patch.object(server, "lookup_case") as lookup,
            patch.object(server.workflow_helper, "sync_selected") as sync,
        ):
            for method in methods:
                for body, size in [(b"{}", 0), (b"{}", -1), (b"{}", server.MAX_BODY + 1), (b"{bad", 4)]:
                    with self.subTest(method=method, body=body, size=size):
                        status, data = getattr(self.handler(body, size), method)("/synthetic")
                        self.assertIn(status, [400, 413])
                        self.assertFalse(data["ok"])
            for route in ["/locks/release", "/probe"]:
                self.assertEqual(self.handler(b"[]")._post_lock_or_probe(route)[0], 400)
            self.assertEqual(self.handler(b'{"extra":true}')._post_lock_or_probe("/probe")[0], 400)
            release.assert_not_called()
            lookup.assert_not_called()
            sync.assert_not_called()

    def test_setup_probe_success_and_lock_release_failures(self):
        with (
            patch.object(server, "find_chrome", return_value=None),
            patch.object(server, "find_outlook", return_value="synthetic"),
            patch.object(server.operations_helper, "health", return_value={"synthetic": True}) as health,
        ):
            status, data = self.handler()._post_lock_or_probe("/probe")
            self.assertEqual(status, 200)
            self.assertFalse(data["chrome"])
            self.assertTrue(data["outlook"])
            self.assertTrue(data["synthetic"])
            self.assertEqual(health.call_args.args[1], True)
        with patch.object(server, "case_dir", return_value=Path("synthetic-unused")):
            for error, status in [
                (ValueError("synthetic refusal"), 400),
                (KeyError("token"), 400),
                (OSError("private path"), 503),
                (RuntimeError("private command"), 503),
            ]:
                with patch.object(server.operations_helper, "release_lock", side_effect=error):
                    result = self.handler()._post_lock_or_probe("/locks/release")
                    self.assertEqual(result[0], status)
                    self.assertFalse(result[1]["ok"])
                    if status == 503:
                        self.assertIn("no lock released", result[1]["error"])

    def test_workflow_dispatch_success_raw_read_and_uncertain_failures(self):
        dispatch = [("/outbox/batch-sync", "sync_selected"), ("/reporting/views", "save_view"), ("/reminder/draft", "reminder_draft")]
        with patch.object(server, "case_dir", return_value=Path("synthetic-unused")):
            for route, operation in dispatch:
                with patch.object(server.workflow_helper, operation, return_value={"ok": True, "synthetic": True}) as action:
                    self.assertEqual(self.handler()._post_workflow(route), (200, {"ok": True, "synthetic": True}))
                    self.assertEqual(action.call_args.args[1], {})
                for error, status in [
                    (ValueError("synthetic refusal"), 400),
                    (TypeError("private path"), 400),
                    (OSError("private share"), 503),
                    (RuntimeError("private native failure"), 503),
                ]:
                    with patch.object(server.workflow_helper, operation, side_effect=error):
                        result = self.handler()._post_workflow(route)
                        self.assertEqual(result[0], status)
                        self.assertFalse(result[1]["ok"])
                        if status == 503:
                            self.assertIn("local work kept", result[1]["error"])
            handler = self.handler()
            with patch.object(server.workflow_helper, "outbox_read", return_value=("synthetic.pdf", b"%PDF-SYNTHETIC")):
                handler._post_workflow("/outbox/read")
                self.assertEqual(handler.wfile.getvalue(), b"%PDF-SYNTHETIC")


if __name__ == "__main__":
    unittest.main()
