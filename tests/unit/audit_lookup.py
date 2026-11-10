"""Case lookup answers, validation, one-at-a-time locking and the local HTTP boundary. The report render, fetch and
settings are covered by audit_ssrs_reports.py. The City report server is NOT contacted by this audit.
"""

import json
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
import urllib.request
import urllib.error
import case_lookup as lookup
import server


class LookupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.row = dict.fromkeys(lookup.FIELDS, "")
        self.row.update(CaseNumber="CB2026-241-00001", SiteAddress="101 TEST ST", OwnerName="TEST OWNER")

    def tearDown(self):
        self.temp.cleanup()

    def test_unreachable_share_not_defaulted(self):
        with self.assertRaisesRegex(lookup.CaseLookupError, "shared"):
            lookup.settings(self.root / "absent")

    def test_input_not_sql_or_shell(self):
        for n in [None, {}, "", "../file", "a';DROP TABLE x--", "$(whoami)", "A" * 81, "A\nB"]:
            with self.assertRaises(lookup.CaseLookupError):
                lookup.case_number(n)
        self.assertEqual(lookup.case_number(" cb2026-241-00001 "), "CB2026-241-00001")

    def test_response_preserves_rows_and_provenance(self):
        self.row["InspectionDate"] = "2026-09-18T00:00:00"
        self.row["ParcelNumber"] = "070913125237"
        self.row["OwnerName"] = "O’NEIL & SONS"
        with patch.object(lookup, "run_query", return_value={"ok": True, "rows": [self.row]}) as run:
            answer = lookup.lookup(self.root, "cb2026-241-00001")
            self.assertEqual(answer["rows"][0], self.row)
            self.assertEqual(answer["source"]["kind"], "ssrs")
            self.assertEqual(answer["source"]["report"], "/Prod/Local/Building Inspection/Enforcement/DocumenGeneratorImport")
            self.assertEqual(run.call_args.args[1], "CB2026-241-00001")

    def test_empty_result_is_not_failure(self):
        with patch.object(lookup, "run_query", return_value={"rows": []}):
            self.assertEqual(lookup.lookup(self.root, "QA-1")["rows"], [])

    def test_wrong_case_missing_fields_values_and_size_rejected(self):
        for data in [
            {"rows": [self.row]},
            {"rows": [{}]},
            {"rows": [dict(self.row, CaseNumber="QA-2", OwnerName=7)]},
            {"rows": [dict(self.row, CaseNumber="QA-2")] * 1001},
            {"rows": "not a list"},
        ]:
            with patch.object(lookup, "run_query", return_value=data):
                with self.assertRaises(lookup.CaseLookupError):
                    lookup.lookup(self.root, "QA-2")

    def test_concurrent_lookup_rejected_and_failure_releases_slot(self):
        lookup.LOOKUPS.acquire()
        try:
            with self.assertRaises(lookup.CaseLookupError) as e:
                lookup.lookup(self.root, "QA-2")
            self.assertEqual(e.exception.status, 429)
        finally:
            lookup.LOOKUPS.release()
        with patch.object(lookup, "run_query", side_effect=lookup.CaseLookupError("offline")):
            with self.assertRaises(lookup.CaseLookupError):
                lookup.lookup(self.root, "QA-2")
        self.assertTrue(lookup.LOOKUPS.acquire(blocking=False))
        lookup.LOOKUPS.release()


class HttpLookupTests(unittest.TestCase):
    def test_guard_and_request_contract(self):
        http = server.socketserver.ThreadingTCPServer(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        base = "http://127.0.0.1:" + str(http.server_address[1])

        def post(body, origin=None, ctype="application/json"):
            headers = {"Content-Type": ctype, "X-DocWriter-Token": server.SESSION_TOKEN}
            if origin:
                headers["Origin"] = origin
            req = urllib.request.Request(base + "/case-lookup", data=json.dumps(body).encode(), headers=headers)
            try:
                with urllib.request.urlopen(req) as r:
                    return r.status, json.load(r)
            except urllib.error.HTTPError as e:
                return e.code, json.load(e)

        try:
            with patch.object(server, "lookup_case", return_value={"ok": True, "rows": []}) as call:
                self.assertEqual(post({"caseNumber": "QA-1"}, "https://other.example")[0], 403)
                self.assertEqual(post({"caseNumber": "QA-1"}, ctype="text/plain")[0], 403)
                self.assertEqual(post({"caseNumber": "QA-1", "sql": "SELECT 1"})[0], 400)
                self.assertEqual(post({"caseNumber": "Q" * 3000})[0], 413)
                self.assertFalse(call.called)
                self.assertEqual(post({"caseNumber": "QA-1"})[0], 200)
                self.assertEqual(call.call_args.args[1], "QA-1")
            with patch.object(server, "lookup_case", side_effect=lookup.CaseLookupError("Unavailable", 429)):
                self.assertEqual(post({"caseNumber": "QA-1"}), (429, {"ok": False, "error": "Unavailable"}))
        finally:
            http.shutdown()
            http.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
