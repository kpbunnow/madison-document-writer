"""Open enforcement cases by inspector: fixed queries, validation, exclusions and the local HTTP boundary.
The City SQL server and Windows authentication are NOT contacted by this audit; the Windows script is replaced."""

import json
import re
import subprocess
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import case_lookup as lookup
import inspector_cases as cases
import server

OPEN_RULES = [
    "WHERE r.RECORD_ID LIKE 'CB%'",
    "AND LTRIM(RTRIM(r.ASSIGNED_USERID)) <> ''",
    "AND r.RECORD_STATUS NOT LIKE '%Close%'",
    "AND r.RECORD_STATUS NOT LIKE '%Compliance%'",
    "AND r.RECORD_STATUS NOT IN ('No Violation', 'Void', 'Withdrawn')",
]


def person(uid="JSMITH", name="Jordan Smith", count="3"):
    return {"UserId": uid, "InspectorName": name, "OpenCases": count}


def case_row(number="CB2026-241-00001", uid="JSMITH", **extra):
    row = dict.fromkeys(cases.CASE_FIELDS, None)
    row.update(
        AssignedInspector="Jordan Smith",
        UserId=uid,
        CaseNumber=number,
        ShortAddress="101 TEST ST",
        ParcelNumber="070822219105",
        OwnerName="SYNTHETIC OWNER",
        RecordCategory="Building Code",
        CaseDescription="Synthetic description",
        Status="Open",
        DateOpened="2026-09-30T00:00:00",
        LatestInspectionType="Initial Inspection",
        LatestInspectionStatus="Violations Found",
        LatestInspectionDate="2026-10-01T00:00:00",
    )
    row.update(extra)
    return row


class InspectorCaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def excluding(self, value):
        (self.root / "Case Lookup").mkdir(exist_ok=True)
        (self.root / "Case Lookup" / cases.EXCLUSIONS).write_text(value if isinstance(value, str) else json.dumps({"exclude": value}))

    def answer(self, rows):
        return {"ok": True, "rows": rows, "database": "AccelaReporting"}

    def test_queries_keep_the_reports_open_case_rules_and_bind_only_a_user_id(self):
        listing = (lookup.HERE / "inspector_list.sql").read_text()
        detail = (lookup.HERE / "inspector_cases.sql").read_text()
        for rule in OPEN_RULES:
            self.assertIn(rule, listing)
            self.assertIn(rule, detail)
        self.assertIn("AND LTRIM(RTRIM(r.ASSIGNED_USERID)) = @UserId", detail)
        self.assertNotIn("@", listing)
        code = "\n".join(line for line in detail.splitlines() if not line.lstrip().startswith("--"))
        self.assertEqual(re.findall(r"@\w+", code), ["@UserId"])
        for sql in (listing, detail):
            self.assertNotRegex(sql.upper(), r"\b(INSERT|UPDATE|DELETE|DROP|EXEC|MERGE|ALTER|CREATE)\b")
            # The report's hard-coded staff names are an administrator setting now, not source.
            self.assertNotIn("Duncan", sql)
        script = (lookup.HERE / "case_lookup.ps1").read_text()
        self.assertIn("$mode -eq 'inspector_list'", script)
        self.assertIn("$mode -eq 'inspector_cases'", script)
        self.assertIn("$cmd.Parameters.Add('@UserId', [System.Data.SqlDbType]::NVarChar, 64)", script)
        self.assertIn("throw 'LOOKUP_MODE'", script)

    def test_inspector_list_is_validated_sorted_and_filtered_by_the_administrators_exclusions(self):
        self.excluding(["Pat%Example", "ADMIN1"])
        rows = [person("ZLEE", "Zoe Lee", "1"), person("ADMIN1", "Admin One"), person("PEX", "Pat Q Example"), person("ASMITH", "Alex Smith", "12")]
        with patch.object(lookup, "run_script", return_value=self.answer(rows)) as run:
            result = cases.inspectors(self.root)
        self.assertEqual(
            result["inspectors"], [{"id": "ASMITH", "name": "Alex Smith", "openCases": 12}, {"id": "ZLEE", "name": "Zoe Lee", "openCases": 1}]
        )
        self.assertEqual(result["source"]["database"], "AccelaReporting")
        self.assertEqual(len(result["source"]["querySha256"]), 64)
        self.assertEqual(run.call_args.args[1], {"mode": "inspector_list", "commandTimeout": cases.LIST_QUERY_TIMEOUT})
        self.assertEqual(run.call_args.args[2], cases.LIST_WAIT)

    def test_bad_lists_are_refused(self):
        bad = [
            [person(), person()],
            [person(uid="A B")],
            [person(count="many")],
            [{"UserId": "A"}],
            [person()] * (cases.MAX_INSPECTORS + 1),
        ]
        for rows in bad:
            with self.subTest(rows=str(rows)[:40]), patch.object(lookup, "run_script", return_value=self.answer(rows)):
                with self.assertRaises(lookup.CaseLookupError):
                    cases.inspectors(self.root)
        with patch.object(lookup, "run_script", return_value={"rows": [], "database": ""}):
            with self.assertRaisesRegex(lookup.CaseLookupError, "identity"):
                cases.inspectors(self.root)

    def test_open_cases_are_normalized(self):
        rows = [case_row(), case_row("CB2026-241-00002", ShortAddress="  2 TEST   AVE ", LatestInspectionType=None, DateOpened=None), case_row()]
        with patch.object(lookup, "run_script", return_value=self.answer(rows)) as run:
            result = cases.open_cases(self.root, " JSMITH ")
        self.assertEqual(run.call_args.args[1], {"mode": "inspector_cases", "userId": "JSMITH", "commandTimeout": cases.LIST_QUERY_TIMEOUT})
        self.assertEqual(result["inspector"], {"id": "JSMITH", "name": "Jordan Smith"})
        self.assertEqual([c["caseNumber"] for c in result["cases"]], ["CB2026-241-00001", "CB2026-241-00002"])
        first, second = result["cases"]
        self.assertEqual(first["dateOpened"], "2026-09-30")
        self.assertEqual(first["latest"], {"type": "Initial Inspection", "status": "Violations Found", "date": "2026-10-01", "scheduled": ""})
        self.assertEqual(second["address"], "2 TEST AVE")
        self.assertEqual(second["dateOpened"], "")
        self.assertEqual(second["latest"]["type"], "")
        with patch.object(lookup, "run_script", return_value=self.answer([])):
            self.assertEqual(cases.open_cases(self.root, "JSMITH")["inspector"], {"id": "JSMITH", "name": "JSMITH"})

    def test_open_cases_refuse_wrong_inspector_columns_values_and_excluded_people(self):
        for value in ["", "a b", "x" * 65, None, 7, "A;DROP"]:
            with self.subTest(value=value), self.assertRaises(lookup.CaseLookupError) as error:
                cases.open_cases(self.root, value)
            self.assertEqual(error.exception.status, 400)
        wrong = [
            [case_row(uid="OTHER")],
            [case_row("bad number!")],
            [case_row(CaseDescription="x" * 1001)],
            [case_row(Status=5)],
            [{"CaseNumber": "CB1-1-1"}],
            [case_row(f"CB2026-241-{n:05d}") for n in range(cases.MAX_CASES + 1)],
        ]
        for rows in wrong:
            with self.subTest(rows=str(rows)[:40]), patch.object(lookup, "run_script", return_value=self.answer(rows)):
                with self.assertRaises(lookup.CaseLookupError):
                    cases.open_cases(self.root, "JSMITH")
        self.excluding(["jsmith"])
        with patch.object(lookup, "run_script", return_value=self.answer([case_row()])):
            with self.assertRaises(lookup.CaseLookupError) as error:
                cases.open_cases(self.root, "JSMITH")
        self.assertEqual(error.exception.status, 403)

    def test_exclusion_file_is_validated(self):
        self.assertEqual(cases.exclusions(self.root), [])
        for value in ["Pat", [""], [5], ["x" * 129], ["a\nb"], ["x"] * 101, "not json", '{"exclude": [], "extra": 1}', "[]"]:
            self.excluding(value)
            with self.subTest(value=str(value)[:20]), self.assertRaisesRegex(lookup.CaseLookupError, "excluded-inspectors.json"):
                cases.exclusions(self.root)
        self.excluding(["Alice%Example"])
        self.assertEqual(cases.exclusions(self.root), ["Alice%Example"])
        self.assertEqual(lookup.settings(self.root)["server"], "sqlelam", "the SQL settings file is unchanged")

    def test_one_list_runs_at_a_time(self):
        self.assertTrue(cases.LISTS.acquire(blocking=False))
        try:
            with self.assertRaises(lookup.CaseLookupError) as error:
                cases.inspectors(self.root)
            self.assertEqual(error.exception.status, 429)
        finally:
            cases.LISTS.release()
        with patch.object(lookup, "run_script", side_effect=lookup.CaseLookupError("offline")):
            with self.assertRaises(lookup.CaseLookupError):
                cases.inspectors(self.root)
        self.assertTrue(cases.LISTS.acquire(blocking=False))
        cases.LISTS.release()

    def test_windows_transport_sends_only_the_mode_and_user_id(self):
        fake_os = SimpleNamespace(name="nt", environ={"SystemRoot": str(self.root)})
        exe = self.root / "System32/WindowsPowerShell/v1.0/powershell.exe"
        exe.parent.mkdir(parents=True)
        exe.touch()
        cfg = dict(lookup.DEFAULTS)
        with (
            patch.object(lookup, "os", fake_os),
            patch.object(subprocess, "CREATE_NO_WINDOW", 0, create=True),
            patch.object(subprocess, "run") as run,
        ):
            run.return_value = SimpleNamespace(returncode=0, stdout=json.dumps({"ok": True, "rows": [], "database": "AccelaReporting"}))
            lookup.run_script(cfg, {"mode": "inspector_cases", "userId": "JSMITH", "commandTimeout": 60}, 90)
            sent = json.loads(run.call_args.kwargs["input"])
            self.assertEqual((sent["mode"], sent["userId"], sent["commandTimeout"]), ("inspector_cases", "JSMITH", 60))
            self.assertNotIn("SECRET", json.dumps(sent))
            self.assertEqual(run.call_args.kwargs["timeout"], 90)
            run.return_value = SimpleNamespace(returncode=1, stdout=json.dumps({"ok": False, "category": "sql", "number": 229}))
            with self.assertRaisesRegex(lookup.CaseLookupError, "BI_ENF_WORKFLOW_HISTORY"):
                lookup.run_script(cfg, {"mode": "inspector_list"})
            run.return_value = SimpleNamespace(returncode=1, stdout=json.dumps({"ok": False, "category": "limit"}))
            with self.assertRaisesRegex(lookup.CaseLookupError, "open-case list is too large"):
                lookup.run_script(cfg, {"mode": "inspector_list"})


class HttpInspectorCaseTests(unittest.TestCase):
    def test_routes_guard_and_request_contract(self):
        http = server.socketserver.ThreadingTCPServer(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        base = "http://127.0.0.1:" + str(http.server_address[1])

        def post(route, body, origin=None, ctype="application/json"):
            headers = {"Content-Type": ctype, "X-DocWriter-Token": server.SESSION_TOKEN}
            if origin:
                headers["Origin"] = origin
            req = urllib.request.Request(base + route, data=json.dumps(body).encode(), headers=headers)
            try:
                with urllib.request.urlopen(req) as r:
                    return r.status, json.load(r)
            except urllib.error.HTTPError as e:
                return e.code, json.load(e)

        try:
            with (
                patch.object(server.inspector_cases, "inspectors", return_value={"ok": True, "inspectors": []}) as listing,
                patch.object(server.inspector_cases, "open_cases", return_value={"ok": True, "cases": []}) as detail,
            ):
                self.assertEqual(post("/inspector-cases/list", {}, "https://other.example")[0], 403)
                self.assertEqual(post("/inspector-cases/list", {}, ctype="text/plain")[0], 403)
                self.assertEqual(post("/inspector-cases/list", {"sql": "SELECT 1"})[0], 400)
                self.assertEqual(post("/inspector-cases/cases", {"inspector": "A", "sql": "SELECT 1"})[0], 400)
                self.assertEqual(post("/inspector-cases/cases", {})[0], 400)
                self.assertEqual(post("/inspector-cases/cases", {"inspector": "A" * 3000})[0], 413)
                self.assertFalse(listing.called or detail.called)
                self.assertEqual(post("/inspector-cases/list", {})[0], 200)
                self.assertEqual(post("/inspector-cases/cases", {"inspector": "JSMITH"})[0], 200)
                self.assertEqual(detail.call_args.args[1], "JSMITH")
            with patch.object(server.inspector_cases, "open_cases", side_effect=lookup.CaseLookupError("Choose an inspector from the list.", 400)):
                self.assertEqual(
                    post("/inspector-cases/cases", {"inspector": "x"}), (400, {"ok": False, "error": "Choose an inspector from the list."})
                )
            with patch.object(server.inspector_cases, "inspectors", side_effect=RuntimeError("boom")):
                status, body = post("/inspector-cases/list", {})
                self.assertEqual(status, 503)
                self.assertNotIn("boom", json.dumps(body))
        finally:
            http.shutdown()
            http.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
