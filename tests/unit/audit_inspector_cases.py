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
    row.update(UserId=uid, CaseNumber=number, ShortAddress="101 TEST ST", CaseDescription="Synthetic description")
    row.update(extra)
    return row


class InspectorCaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        cases._cache.update(root=None, at=0.0, answer=None, source=None)
        cases._names.update(root=None, at=0.0, found=None)

    def tearDown(self):
        self.temp.cleanup()

    def excluding(self, value):
        (self.root / "Case Lookup").mkdir(exist_ok=True)
        (self.root / "Case Lookup" / cases.EXCLUSIONS).write_text(value if isinstance(value, str) else json.dumps({"exclude": value}))

    def answer(self, rows):
        return {"ok": True, "rows": rows, "database": "AccelaReporting"}

    def test_shared_cache_rule_matches_the_retained_expiry_expression(self):
        for key in ("answer", "found"):
            for value in (None, [], {}, {"person": "Name"}):
                for same_root in (False, True):
                    for age in (-1, 0, cases.CACHE_SECONDS - 1, cases.CACHE_SECONDS, cases.CACHE_SECONDS + 1):
                        cache = {key: value, "root": str(self.root) if same_root else "other", "at": 100.0}
                        clock_calls = []

                        def clock():
                            clock_calls.append(True)
                            return 100.0 + age

                        with patch.object(cases.time, "monotonic", side_effect=clock):
                            actual = cases._cached(cache, self.root, key)
                        retained = cache[key] is not None and cache["root"] == str(self.root) and age < cases.CACHE_SECONDS
                        self.assertIs(actual, value if retained else None)
                        self.assertEqual(len(clock_calls), int(value is not None and same_root))
        cache = {"root": None, "at": 0, "found": None}
        with patch.object(cases.time, "monotonic", return_value=123):
            cases._keep(cache, self.root, found={})
        self.assertEqual(cache, {"root": str(self.root), "at": 123, "found": {}})

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
        # Names come from the two workflow views only, for people with open cases; the slow inspection-view scan is gone.
        self.assertNotIn("BI_ENF_INSPECTION", listing)
        self.assertIn("WHERE UserId IN (SELECT UserId FROM Assigned)", listing)
        self.assertNotIn("UserNames", detail)
        # Only what the list shows is selected: no owner, parcel, status, dates or inspection columns.
        for gone in ("OUTER APPLY", "BI_ENF_INSPECTION", "PARCEL_OWNER", "APO_PARCEL", "RECORD_STATUS AS", "INSPECTION_TYPE"):
            self.assertNotIn(gone, detail)
        script = (lookup.HERE / "case_lookup.ps1").read_text()
        self.assertIn("[int]::TryParse([string]$request.commandTimeout, [ref]$wait)", script)
        self.assertIn("$mode -eq 'inspector_list'", script)
        self.assertIn("$mode -eq 'inspector_cases'", script)
        self.assertIn("$mode -eq 'inspector_names'", script)
        names_sql = (lookup.HERE / "inspector_names.sql").read_text()
        self.assertNotIn("@", names_sql)
        self.assertNotRegex(names_sql.upper(), r"\b(INSERT|UPDATE|DELETE|DROP|EXEC|MERGE|ALTER|CREATE)\b")
        self.assertIn("BI_ENF_INSPECTION", names_sql)
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

    def test_people_shown_by_user_id_get_full_names_in_a_second_step_and_the_kept_list_learns_them(self):
        self.excluding(["Hidden%"])
        rows = [person("ASMITH", "Alex Smith", "4"), person("JQP", "JQP", "2"), person("HID", "HID", "1")]
        named = [
            {"UserId": "jqp", "InspectorName": "Jamie Q Public"},
            {"UserId": "HID", "InspectorName": "Hidden Person"},
            {"UserId": "OTHER", "InspectorName": "Not Listed"},
        ]

        def run(cfg, request, wait=None):
            return self.answer(rows if request["mode"] == "inspector_list" else named)

        with patch.object(lookup, "run_script", side_effect=run) as script:
            first = cases.inspectors(self.root)
            self.assertIn({"id": "JQP", "name": "JQP", "openCases": 2}, first["inspectors"])
            filled = cases.inspector_names(self.root)
            self.assertEqual(filled, {"ok": True, "names": [{"id": "JQP", "name": "Jamie Q Public"}], "excluded": ["HID"]})
            self.assertEqual([c.args[1]["mode"] for c in script.call_args_list], ["inspector_list", "inspector_names"])
            self.assertEqual(script.call_args_list[1].args[1]["commandTimeout"], cases.LIST_QUERY_TIMEOUT)
            later = cases.inspectors(self.root)
            self.assertIn("Jamie Q Public", [p["name"] for p in later["inspectors"]])
            self.assertEqual(script.call_count, 2, "the kept list now carries the full name")
            self.assertEqual(cases.inspector_names(self.root), filled)
            self.assertEqual(script.call_count, 2, "repeat responses use cached names without rerunning the slow query")

    def test_repeated_name_responses_are_complete_for_clients_that_loaded_ids(self):
        rows = [person("JQP", "JQP", "2")]
        named = [{"UserId": "JQP", "InspectorName": "Jamie Public"}]
        with patch.object(lookup, "run_script", side_effect=[self.answer(rows), self.answer(named)]) as run:
            first_client = cases.inspectors(self.root)
            second_client = cases.inspectors(self.root)
            expected = {"ok": True, "names": [{"id": "JQP", "name": "Jamie Public"}]}
            self.assertEqual(cases.inspector_names(self.root), expected)
            self.assertEqual(cases.inspector_names(self.root), expected)
            self.assertEqual(first_client["inspectors"][0]["name"], "JQP", "returned lists are snapshots")
            self.assertEqual(second_client["inspectors"][0]["name"], "JQP")
            self.assertEqual(run.call_count, 2)

    def test_explicit_refresh_still_refreshes_deferred_names(self):
        rows = [person("JQP", "JQP", "2")]
        named = [{"UserId": "JQP", "InspectorName": "Jamie Public"}]
        renamed = [{"UserId": "JQP", "InspectorName": "Jamie Changed"}]
        with patch.object(lookup, "run_script", side_effect=[self.answer(rows), self.answer(named), self.answer(rows), self.answer(renamed)]) as run:
            cases.inspectors(self.root)
            cases.inspector_names(self.root)
            self.assertEqual(cases.inspectors(self.root)["inspectors"][0]["name"], "Jamie Public")
            refreshed = cases.inspectors(self.root, refresh=True)
            self.assertEqual(refreshed["inspectors"][0]["name"], "JQP", "fresh fallback IDs trigger the browser's deferred refresh")
            self.assertEqual(cases.inspector_names(self.root, refresh=True)["names"][0]["name"], "Jamie Changed")
            self.assertEqual(cases.inspectors(self.root)["inspectors"][0]["name"], "Jamie Changed")
            self.assertEqual(run.call_count, 4)

    def test_background_names_do_not_hold_the_foreground_case_list_slot(self):
        entered, release = threading.Event(), threading.Event()
        outcomes = []
        rows = [person("JQP", "JQP", "2")]

        def run(cfg, request, wait=None):
            if request["mode"] == "inspector_list":
                return self.answer(rows)
            if request["mode"] == "inspector_names":
                entered.set()
                if not release.wait(5):
                    raise RuntimeError("test did not release name query")
                return self.answer([{"UserId": "JQP", "InspectorName": "Jamie Public"}])
            return self.answer([case_row(uid="JQP")])

        def names():
            try:
                outcomes.append(cases.inspector_names(self.root))
            except Exception as error:
                outcomes.append(error)

        with patch.object(lookup, "run_script", side_effect=run):
            cases.inspectors(self.root)
            thread = threading.Thread(target=names)
            thread.start()
            try:
                self.assertTrue(entered.wait(5))
                self.assertEqual(len(cases.open_cases(self.root, "JQP")["cases"]), 1)
                with self.assertRaises(lookup.CaseLookupError) as error:
                    cases.inspector_names(self.root, refresh=True)
                self.assertEqual(error.exception.status, 429, "background queries remain bounded")
            finally:
                release.set()
                thread.join(5)
            self.assertFalse(thread.is_alive())
            self.assertEqual(outcomes[0]["names"][0]["name"], "Jamie Public")

    def test_resolved_full_name_exclusions_remove_ids_from_current_and_future_lists(self):
        self.excluding(["Hidden%"])
        rows = [person("HID", "HID", "1")]
        named = [{"UserId": "HID", "InspectorName": "Hidden Person"}]
        with patch.object(lookup, "run_script", side_effect=[self.answer(rows), self.answer(named)]):
            self.assertEqual(cases.inspectors(self.root)["inspectors"][0]["id"], "HID")
            resolved = cases.inspector_names(self.root)
            self.assertEqual(resolved.get("excluded"), ["HID"])
            self.assertEqual(resolved["names"], [])
            self.assertEqual(cases.inspectors(self.root)["inspectors"], [])
            with self.assertRaises(lookup.CaseLookupError) as error:
                cases.open_cases(self.root, "HID")
            self.assertEqual(error.exception.status, 403)

    def test_name_database_identity_is_checked_before_cache_or_list_changes(self):
        rows = [person("JQP", "JQP", "2")]
        wrong = {"rows": [{"UserId": "JQP", "InspectorName": "Wrong Database"}], "database": "OtherDatabase"}
        with (
            patch.object(lookup, "settings", return_value={**lookup.DEFAULTS, "database": "AccelaReporting"}),
            patch.object(lookup, "run_script", side_effect=[self.answer(rows), wrong]),
        ):
            cases.inspectors(self.root)
            with self.assertRaisesRegex(lookup.CaseLookupError, "identity"):
                cases.inspector_names(self.root)
            self.assertIsNone(cases._names["found"])
            self.assertEqual(cases.inspectors(self.root)["inspectors"][0]["name"], "JQP")

    def test_a_bad_name_row_is_refused_and_a_failed_name_lookup_leaves_the_list_alone(self):
        rows = [person("JQP", "JQP", "2")]
        for bad in ([{"UserId": "JQP"}], [{"UserId": "J QP", "InspectorName": "x"}], [{"UserId": "JQP", "InspectorName": "a\x01b"}]):
            cases._cache.update(root=None, at=0.0, answer=None, source=None)
            cases._names.update(root=None, at=0.0, found=None)

            def run(cfg, request, wait=None, bad=bad):
                return self.answer(rows if request["mode"] == "inspector_list" else bad)

            with patch.object(lookup, "run_script", side_effect=run):
                with self.assertRaises(lookup.CaseLookupError):
                    cases.inspector_names(self.root)
                self.assertEqual(cases.inspectors(self.root)["inspectors"][0]["name"], "JQP")

    def test_inspector_list_is_kept_for_a_while_and_try_again_refreshes_it(self):
        self.excluding(["ADMIN1"])
        rows = [person("ASMITH", "Alex Smith", "4"), person("ADMIN1", "Admin One", "1")]
        with patch.object(lookup, "run_script", return_value=self.answer(rows)) as run:
            first = cases.inspectors(self.root)
            again = cases.inspectors(self.root)
            self.assertEqual(run.call_count, 1, "the second open uses the kept list")
            self.assertEqual(again["inspectors"], first["inspectors"])
            self.assertEqual(again["source"]["retrievedAt"], first["source"]["retrievedAt"])
            self.excluding([])
            self.assertEqual([p["id"] for p in cases.inspectors(self.root)["inspectors"]], ["ADMIN1", "ASMITH"], "exclusions apply to the kept list")
            self.assertEqual(run.call_count, 1)
            cases.inspectors(self.root, refresh=True)
            self.assertEqual(run.call_count, 2, "Try again asks for a fresh list")
            with patch.object(cases.time, "monotonic", return_value=cases._cache["at"] + cases.CACHE_SECONDS + 1):
                cases.inspectors(self.root)
            self.assertEqual(run.call_count, 3, "an expired list is queried again")
            other = Path(tempfile.mkdtemp())
            (other / "Case Lookup").mkdir()
            cases.inspectors(other)
            self.assertEqual(run.call_count, 4, "a different shared folder never uses another's list")

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
        rows = [case_row(), case_row("CB2026-241-00002", ShortAddress="  2 TEST   AVE ", CaseDescription=None), case_row()]
        with patch.object(lookup, "run_script", return_value=self.answer(rows)) as run:
            result = cases.open_cases(self.root, " JSMITH ")
        self.assertEqual(run.call_args.args[1], {"mode": "inspector_cases", "userId": "JSMITH", "commandTimeout": cases.LIST_QUERY_TIMEOUT})
        self.assertEqual(result["inspector"], {"id": "JSMITH"})
        self.assertEqual([c["caseNumber"] for c in result["cases"]], ["CB2026-241-00001", "CB2026-241-00002"])
        first, second = result["cases"]
        self.assertEqual(first, {"caseNumber": "CB2026-241-00001", "address": "101 TEST ST", "description": "Synthetic description"})
        self.assertEqual(second, {"caseNumber": "CB2026-241-00002", "address": "2 TEST AVE", "description": ""})
        with patch.object(lookup, "run_script", return_value=self.answer([])):
            self.assertEqual(cases.open_cases(self.root, "JSMITH")["cases"], [])

    def test_open_cases_refuse_wrong_inspector_columns_values_and_excluded_people(self):
        for value in ["", "a b", "x" * 65, None, 7, "A;DROP"]:
            with self.subTest(value=value), self.assertRaises(lookup.CaseLookupError) as error:
                cases.open_cases(self.root, value)
            self.assertEqual(error.exception.status, 400)
        wrong = [
            [case_row(uid="OTHER")],
            [case_row("bad number!")],
            [case_row(CaseDescription="x" * 2001)],
            [case_row(CaseDescription=5)],
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
        self.assertEqual(cases.exclusions(self.root), list(cases.DEFAULT_EXCLUDED), "without a file only the division's built-in list applies")
        for value in ["Pat", [""], [5], ["x" * 129], ["a\nb"], ["x"] * 101, "not json", '{"exclude": [], "extra": 1}', "[]"]:
            self.excluding(value)
            with self.subTest(value=str(value)[:20]), self.assertRaisesRegex(lookup.CaseLookupError, "excluded-inspectors.json"):
                cases.exclusions(self.root)
        self.excluding(["Alice%Example"])
        self.assertEqual(cases.exclusions(self.root), list(cases.DEFAULT_EXCLUDED) + ["Alice%Example"], "the administrator's entries are added")
        self.assertEqual(lookup.settings(self.root)["server"], "sqlelam", "the SQL settings file is unchanged")

    def test_the_divisions_four_excluded_staff_never_appear_whatever_the_name_form(self):
        rows = [
            person("ADUNCAN", "Alice Duncan-Graves"),
            person("ADUNCAN2", "Alice Duncan- Graves"),
            person("ADUNCAN3", "Alice M Duncan Graves"),
            person("GMAY", "Gregg May"),
            person("GMAY2", "GREGG A. MAY"),
            person("JPRICE", "Jessica Price"),
            person("PGRUPE", "Phil Grupe"),
            person("ASMITH", "Alex Smith"),
            person("MAYER", "Gregg Mayer"),
            person("PPRICE", "Pat Price"),
        ]
        with patch.object(lookup, "run_script", return_value=self.answer(rows)):
            listed = [p["name"] for p in cases.inspectors(self.root)["inspectors"]]
            self.assertEqual(listed, ["Alex Smith", "Gregg Mayer", "Pat Price"], "only the four are removed; look-alike names stay")
            self.excluding(["Alex Smith"])
            self.assertEqual(
                [p["name"] for p in cases.inspectors(self.root)["inspectors"]],
                ["Gregg Mayer", "Pat Price"],
                "an administrator's entry adds to the four",
            )

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
                self.assertEqual(post("/inspector-cases/list", {"refresh": False})[0], 400)
                self.assertEqual(post("/inspector-cases/names", {"sql": "SELECT 1"})[0], 400)
                self.assertEqual(post("/inspector-cases/names", {"refresh": False})[0], 400)
                self.assertEqual(post("/inspector-cases/cases", {"inspector": "A", "sql": "SELECT 1"})[0], 400)
                self.assertEqual(post("/inspector-cases/cases", {})[0], 400)
                self.assertEqual(post("/inspector-cases/cases", {"inspector": "A" * 3000})[0], 413)
                self.assertFalse(listing.called or detail.called)
                self.assertEqual(post("/inspector-cases/list", {})[0], 200)
                self.assertFalse(listing.call_args.kwargs["refresh"])
                self.assertEqual(post("/inspector-cases/list", {"refresh": True})[0], 200)
                self.assertTrue(listing.call_args.kwargs["refresh"])
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
