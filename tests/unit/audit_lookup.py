"""Fixed-query contract, config, transport errors, and local HTTP boundary tests.
The City SQL server and Windows authentication are NOT contacted by this audit.
"""

import json
import tempfile
import subprocess
from types import SimpleNamespace
import threading
import unittest
from pathlib import Path
from unittest.mock import patch
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
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

    def test_query_is_exact_rdl_select(self):
        root = ET.parse(lookup.HERE.parent / "tests/fixtures/reference/Document-Generator-Import.rdl").getroot()
        sql = next(e.text for e in root.iter() if e.tag.endswith("}CommandText"))
        self.assertEqual((lookup.HERE / "case_lookup.sql").read_text().strip(), sql.strip())
        self.assertIn("WHERE r.RECORD_ID = @CaseNumber", sql)
        ps = (lookup.HERE / "case_lookup.ps1").read_text()
        self.assertIn("$cmd.Parameters.Add('@CaseNumber', [System.Data.SqlDbType]::NVarChar, 80)", ps)
        self.assertIn("$builder['Integrated Security'] = $true", ps)
        self.assertIn("$builder['Encrypt'] = $true", ps)
        self.assertIn("$builder['TrustServerCertificate'] = [bool]$request.trustServerCertificate", ps)
        self.assertIn("'tls_certificate'", ps)
        self.assertIn("category=$category; number=$number; state=$state; 'class'=$class", ps)
        self.assertIn("exceptionType=$exceptionType; hresult=$hresult; nativeCode=$nativeCode", ps)
        self.assertIn("$builder['Data Source'] = [string]$request.server", ps)
        self.assertIn("$builder['Initial Catalog'] = [string]$request.database", ps)
        self.assertIn("$builder['Integrated Security'] = $true", ps)
        self.assertNotIn("$builder.DataSource", ps)
        self.assertNotIn("$builder.InitialCatalog", ps)
        self.assertIn("Operation: $operation", ps)
        self.assertIn("Argument name:", ps)
        self.assertIn("case-lookup-diagnostic.txt", ps)
        self.assertIn("argumentName=$argumentName; diagnosticFile=$diagnosticFile", ps)
        self.assertNotIn("message=$detail", ps)
        self.assertNotIn("Invoke-Expression", ps)

    def test_defaults_and_shared_database(self):
        with patch.dict(lookup.os.environ, {"LOCALAPPDATA": str(self.root / "profile")}):
            self.assertFalse(lookup.settings(self.root)["trustServerCertificate"])
            local = self.root / "profile" / "MadisonDocWriter" / lookup.LOCAL_TLS_SETTINGS
            local.parent.mkdir(parents=True)
            local.write_text(json.dumps({"trustServerCertificate": True}))
            self.assertTrue(lookup.settings(self.root)["trustServerCertificate"])
            local.write_text(json.dumps({"server": "unexpected"}))
            with self.assertRaisesRegex(lookup.CaseLookupError, "local SQL certificate setting is invalid"):
                lookup.settings(self.root)
            local.unlink()
            self.assertFalse(lookup.settings(self.root)["trustServerCertificate"])
            self.assertEqual(set(lookup.settings(self.root)), set(lookup.DEFAULTS) | {"trustServerCertificate"})
            (self.root / "Case Lookup").mkdir()
            p = self.root / "Case Lookup/settings.json"
            p.write_text(json.dumps({"database": "City Case Data"}))
            self.assertEqual(lookup.settings(self.root)["database"], "City Case Data")
            p.write_text("{bad")
            with self.assertRaises(lookup.CaseLookupError):
                lookup.settings(self.root)
            p.write_text(json.dumps({"password": "bad"}))
            with self.assertRaises(lookup.CaseLookupError):
                lookup.settings(self.root)
            p.write_text(json.dumps({"trustServerCertificate": True}))
            with self.assertRaises(lookup.CaseLookupError):
                lookup.settings(self.root)
            p.write_text(json.dumps({"enabled": False}))
            with self.assertRaisesRegex(lookup.CaseLookupError, "disabled"):
                lookup.settings(self.root)

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
        with patch.object(lookup, "run_query", return_value={"ok": True, "rows": [self.row], "database": "CityData"}) as run:
            answer = lookup.lookup(self.root, "cb2026-241-00001")
            self.assertEqual(answer["rows"][0], self.row)
            self.assertEqual(answer["source"]["database"], "CityData")
            self.assertEqual(len(answer["source"]["querySha256"]), 64)
            self.assertEqual(run.call_args.args[1], "CB2026-241-00001")

    def test_empty_result_is_not_failure(self):
        with patch.object(lookup, "run_query", return_value={"rows": [], "database": "CityData"}):
            self.assertEqual(lookup.lookup(self.root, "QA-1")["rows"], [])

    def test_wrong_case_missing_fields_database_and_size_rejected(self):
        for data in [
            {"rows": [self.row], "database": "CityData"},
            {"rows": [{}], "database": "CityData"},
            {"rows": [], "database": ""},
            {"rows": [self.row] * 1001, "database": "CityData"},
        ]:
            with patch.object(lookup, "run_query", return_value=data):
                with self.assertRaises(lookup.CaseLookupError):
                    lookup.lookup(self.root, "QA-2")

    def test_configured_database_must_match(self):
        (self.root / "Case Lookup").mkdir()
        (self.root / "Case Lookup/settings.json").write_text('{"database":"Intended"}')
        with patch.object(lookup, "run_query", return_value={"rows": [], "database": "Different"}):
            with self.assertRaisesRegex(lookup.CaseLookupError, "identity"):
                lookup.lookup(self.root, "QA-2")

    def test_windows_transport_arguments_and_actionable_failures(self):
        # Exercise the Python Windows branch with a substitute process, never a live login.
        fake_os = SimpleNamespace(name="nt", environ={"SystemRoot": str(self.root)})
        exe = self.root / "System32/WindowsPowerShell/v1.0/powershell.exe"
        exe.parent.mkdir(parents=True)
        exe.touch()
        with (
            patch.object(lookup, "os", fake_os),
            patch.object(subprocess, "CREATE_NO_WINDOW", 0, create=True),
            patch.object(subprocess, "run") as run,
        ):
            run.return_value = SimpleNamespace(returncode=0, stdout=json.dumps({"ok": True, "rows": [], "database": "CityData"}))
            lookup.run_query(lookup.DEFAULTS, "QA-1")
            args, kwargs = run.call_args
            self.assertEqual(args[0][-2:], ["-File", str(lookup.HERE / "case_lookup.ps1")])
            self.assertNotIn("-ExecutionPolicy", args[0])
            self.assertNotIn("shell", kwargs)
            self.assertEqual(json.loads(kwargs["input"])["caseNumber"], "QA-1")
            self.assertFalse(json.loads(kwargs["input"])["trustServerCertificate"])
            self.assertEqual(kwargs["timeout"], 40)
            for num, fragment in [
                (18456, "permissions"),
                (229, "permissions"),
                (208, "database"),
                (4060, "database"),
                (4064, "database"),
                (-2, "timed out"),
            ]:
                run.return_value = SimpleNamespace(returncode=1, stdout=json.dumps({"ok": False, "code": "sql", "number": num}))
                with self.assertRaisesRegex(lookup.CaseLookupError, fragment):
                    lookup.run_query(lookup.DEFAULTS, "QA-1")
            diagnoses = [
                ("tls_certificate", "TLS_CERTIFICATE"),
                ("authentication", "WINDOWS_AUTH"),
                ("network", "SQL_NETWORK"),
                ("timeout", "timed out"),
                ("database", "database"),
                ("script_policy", "SCRIPT_POLICY"),
                ("helper_runtime", "HELPER_RUNTIME"),
            ]
            for category, fragment in diagnoses:
                run.return_value = SimpleNamespace(
                    returncode=1,
                    stdout=json.dumps(
                        {"ok": False, "category": category, "number": -999, "message": "SensitiveServerName should never reach the UI"}
                    ),
                )
                with self.assertRaisesRegex(lookup.CaseLookupError, fragment) as err:
                    lookup.run_query(lookup.DEFAULTS, "QA-1")
                self.assertNotIn("SensitiveServerName", str(err.exception))
            run.return_value = SimpleNamespace(returncode=1, stdout=json.dumps({"ok": False, "category": "sql", "number": 20, "state": 5}))
            with self.assertRaisesRegex(lookup.CaseLookupError, "SQL_CONNECT_20_STATE_5"):
                lookup.run_query(lookup.DEFAULTS, "QA-1")
            run.return_value = SimpleNamespace(
                returncode=1,
                stdout=json.dumps(
                    {
                        "ok": False,
                        "category": "connection",
                        "exceptionType": "System.InvalidOperationException",
                        "hresult": -2146233079,
                        "nativeCode": 53,
                        "message": "Do not show this raw provider error",
                    }
                ),
            )
            with self.assertRaisesRegex(lookup.CaseLookupError, "SQL_CONNECT_TYPE_System_InvalidOperationException_HR_0x80131509_WIN32_53"):
                lookup.run_query(lookup.DEFAULTS, "QA-1")
            run.return_value = SimpleNamespace(
                returncode=1,
                stdout=json.dumps(
                    {
                        "ok": False,
                        "category": "connection",
                        "exceptionType": "ArgumentException",
                        "hresult": -2147024809,
                        "operation": "set_server",
                        "argumentName": "DataSource",
                        "diagnosticFile": "C:\\Users\\Inspector\\AppData\\Local\\MadisonDocWriter\\case-lookup-diagnostic.txt",
                        "message": "Do not show this raw provider error",
                    }
                ),
            )
            with self.assertRaises(lookup.CaseLookupError) as err:
                lookup.run_query(lookup.DEFAULTS, "QA-1")
            self.assertIn("SQL_CONNECT_TYPE_ArgumentException_HR_0x80070057_OP_set_server_ARG_DataSource", str(err.exception))
            self.assertIn(r"%LOCALAPPDATA%\MadisonDocWriter\case-lookup-diagnostic.txt", str(err.exception))
            self.assertNotIn("C:\\Users", str(err.exception))
            self.assertNotIn("Do not show this raw provider error", str(err.exception))
            run.return_value = SimpleNamespace(returncode=1, stdout="Execution policy blocked this script")
            with self.assertRaisesRegex(lookup.CaseLookupError, "script policy"):
                lookup.run_query(lookup.DEFAULTS, "QA-1")
            run.side_effect = subprocess.TimeoutExpired("powershell", 40)
            with self.assertRaisesRegex(lookup.CaseLookupError, "timed out"):
                lookup.run_query(lookup.DEFAULTS, "QA-1")

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
