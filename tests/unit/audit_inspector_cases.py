"""Open enforcement cases by inspector from the OpenEnforcementCases_BI report: the inspector list counted from the full
report, one inspector's render, validation, exclusions, due dates and the local HTTP boundary.
The City report server is NOT contacted by this audit; the report render is replaced by synthetic rows."""

import contextlib
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

import case_lookup as lookup
import case_projection
import case_store
from audit_workflow import initial
import inspector_cases as cases
import server
import ssrs_reports

FIXTURE = Path(__file__).resolve().parents[2] / "tests/fixtures/ssrs/open-cases-report.xml"


def case_row(number="CB2026-241-00001", inspector="Jordan Smith", **extra):
    row = {
        "AssignedInspector": inspector,
        "CaseNumber": number,
        "ShortAddress": "101 TEST ST",
        "CaseDescription": "Synthetic description",
        "Status": "Open",
    }
    row.update(extra)
    return {k: v for k, v in row.items() if v is not None}


class InspectorCaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        cases._cache.update(root=None, at=0.0, answer=None, source=None)
        self.calls = []

    def tearDown(self):
        self.temp.cleanup()

    def excluding(self, value):
        (self.root / "Case Lookup").mkdir(exist_ok=True)
        (self.root / "Case Lookup" / cases.EXCLUSIONS).write_text(value if isinstance(value, str) else json.dumps({"exclude": value}))

    @contextlib.contextmanager
    def report(self, rows, everyone=None):
        """A stand-in report server: the full render answers with `everyone` (by default the inspectors in `rows`), an
        inspector's render with the rows assigned to them, or `rows` itself when it names other people on purpose."""
        everyone = rows if everyone is None else everyone

        def render(inspector=None, wait=None):
            self.calls.append(inspector)
            if inspector is None:
                return [dict(r) for r in everyone]
            return [dict(r) for r in rows]

        with patch.object(ssrs_reports, "open_case_rows", side_effect=render):
            yield

    def test_the_inspector_list_counts_each_inspectors_distinct_open_cases(self):
        rows = ssrs_reports.rows(FIXTURE.read_bytes(), ssrs_reports.OPEN_CASES_REPORT, 1000)
        with patch.object(ssrs_reports, "fetch", return_value=FIXTURE.read_bytes()) as fetch:
            result = cases.inspectors(self.root)
        self.assertNotIn("Inspector=", fetch.call_args.args[0], "the list is the report rendered for everyone")
        self.assertEqual(
            result["inspectors"],
            [
                {"id": "Casey Sample", "name": "Casey Sample", "openCases": 1},
                {"id": "Jordan Q Example", "name": "Jordan Q Example", "openCases": 3},
                {"id": "QAUSER7", "name": "QAUSER7", "openCases": 1},
            ],
            "Gregg May is one of the division's excluded staff",
        )
        self.assertEqual(len(rows), 6)
        self.assertEqual(
            {k: result["source"][k] for k in ("kind", "report")},
            {"kind": "ssrs", "report": "/Prod/Local/Building Inspection/Enforcement/OpenEnforcementCases_BI"},
        )
        twice = [case_row("CB2026-241-00001"), case_row("CB2026-241-00001"), case_row("CB2026-241-00002", "JORDAN  smith")]
        cases._cache.update(root=None, at=0.0, answer=None, source=None)
        with self.report(twice):
            self.assertEqual(
                cases.inspectors(self.root)["inspectors"],
                [{"id": "Jordan Smith", "name": "Jordan Smith", "openCases": 2}],
                "one person, counted once per case",
            )

    def test_inspector_list_is_kept_for_a_while_and_try_again_refreshes_it(self):
        with self.report([case_row()]):
            cases.inspectors(self.root)
            cases.inspectors(self.root)
            self.assertEqual(self.calls, [None])
            cases.inspectors(self.root, refresh=True)
            self.assertEqual(self.calls, [None, None])
            with patch.object(cases.time, "monotonic", return_value=cases._cache["at"] + cases.CACHE_SECONDS + 1):
                cases.inspectors(self.root)
            self.assertEqual(self.calls, [None, None, None])
            other = self.root / "other share"
            other.mkdir()
            cases.inspectors(other)
            self.assertEqual(len(self.calls), 4, "another share never reuses this list")
        with self.report([]):
            cases._cache.update(root=None, at=0.0, answer=None, source=None)
            self.assertEqual(cases.inspectors(self.root)["inspectors"], [])
            cases.inspectors(self.root)
            self.assertEqual(self.calls.count(None), 5, "an empty list is kept too")

    def test_warm_caches_never_bypass_disabled_or_malformed_settings(self):
        with self.report([case_row()]):
            cases.inspectors(self.root)
            (self.root / "Case Lookup").mkdir()
            for raw, message in (('{"enabled": false}', "disabled"), ("{bad", "invalid")):
                (self.root / "Case Lookup/settings.json").write_text(raw)
                for call in (
                    lambda: cases.inspectors(self.root),
                    lambda: cases.open_cases(self.root, "Jordan Smith"),
                    lambda: cases.inspector_names(self.root),
                ):
                    with self.subTest(raw=raw), self.assertRaisesRegex(lookup.CaseLookupError, message):
                        call()
        self.assertEqual(self.calls, [None])

    def test_names_come_with_the_list(self):
        with self.report([case_row()]):
            self.assertEqual(cases.inspector_names(self.root), {"ok": True, "names": []})
            self.assertEqual(cases.inspector_names(self.root, refresh=True), {"ok": True, "names": []})
        self.assertEqual(self.calls, [], "no report is rendered for names")

    def test_bad_lists_are_refused_and_nothing_is_kept(self):
        bad = [
            [{"CaseNumber": "CB2026-241-00001"}],
            [case_row(inspector="")],
            [case_row(inspector="Bad\x01Name")],
            [case_row(number=None)],
            [case_row(number="bad number!")],
            [case_row(f"CB2026-241-{n:05d}", inspector=f"Person {n}") for n in range(cases.MAX_INSPECTORS + 1)],
        ]
        for rows in bad:
            with self.subTest(rows=str(rows)[:60]), self.report(rows), self.assertRaises(lookup.CaseLookupError):
                cases.inspectors(self.root)
            self.assertIsNone(cases._cache["answer"])
        with patch.object(ssrs_reports, "open_case_rows", side_effect=ssrs_reports.ReportError("SSRS_403 no permission")):
            with self.assertRaisesRegex(lookup.CaseLookupError, "SSRS_403"):
                cases.inspectors(self.root)

    def test_changed_report_layout_is_refused_without_caching_a_false_empty_list(self):
        changed = FIXTURE.read_bytes().replace(b"<Details ", b"<RenamedRow ")
        with patch.object(ssrs_reports, "fetch", return_value=changed):
            with self.assertRaisesRegex(lookup.CaseLookupError, "SSRS_LAYOUT"):
                cases.inspectors(self.root)
        self.assertIsNone(cases._cache["answer"])
        with patch.object(ssrs_reports, "fetch", return_value=FIXTURE.read_bytes()):
            previous = cases.inspectors(self.root)
        with patch.object(ssrs_reports, "fetch", return_value=changed):
            with self.assertRaisesRegex(lookup.CaseLookupError, "SSRS_LAYOUT"):
                cases.inspectors(self.root, refresh=True)
            with self.assertRaisesRegex(lookup.CaseLookupError, "SSRS_LAYOUT"):
                cases.open_cases(self.root, "Casey Sample")
            self.assertEqual(cases.inspectors(self.root), previous, "only the prior verified cached list remains")

    def test_open_cases_are_rendered_for_the_listed_name_and_normalized(self):
        rows = [case_row(), case_row("CB2026-241-00002", ShortAddress="  2 TEST   AVE ", CaseDescription=None), case_row()]
        with self.report(rows):
            result = cases.open_cases(self.root, " jordan   SMITH ")
        self.assertEqual(self.calls, [None, "Jordan Smith"], "the report's own spelling is sent as its Inspector parameter")
        self.assertEqual(result["inspector"], {"id": "Jordan Smith"})
        self.assertEqual([c["caseNumber"] for c in result["cases"]], ["CB2026-241-00001", "CB2026-241-00002"])
        first, second = result["cases"]
        self.assertEqual(
            first,
            {
                "caseNumber": "CB2026-241-00001",
                "address": "101 TEST ST",
                "description": "Synthetic description",
                "dueDate": "",
                "dueState": "unknown",
            },
        )
        self.assertEqual(second, {"caseNumber": "CB2026-241-00002", "address": "2 TEST AVE", "description": "", "dueDate": "", "dueState": "unknown"})
        self.assertFalse(result["dueDates"], "no case folder was given, so due dates are not available")
        self.assertEqual(result["source"]["kind"], "ssrs")
        with self.report([], everyone=[case_row()]):
            self.assertEqual(cases.open_cases(self.root, "Jordan Smith")["cases"], [])

    def test_the_reports_exact_spelling_is_its_parameter_even_with_untidy_spacing(self):
        printed = "Jordan  Q Smith "
        with self.report([case_row(inspector=printed)]):
            listed = cases.inspectors(self.root)["inspectors"]
            self.assertEqual(listed, [{"id": printed, "name": "Jordan Q Smith", "openCases": 1}])
            result = cases.open_cases(self.root, "jordan q smith")
        self.assertEqual(self.calls, [None, printed])
        self.assertEqual(result["inspector"], {"id": printed})
        self.assertEqual(len(result["cases"]), 1)

    def summary(self, number, *dues, **extra):
        """A Reporting Index summary whose violation items carry the given due dates (one item each)."""
        items = [{"no": str(n + 1), "due": due, "done": False, "withdrawn": False} for n, due in enumerate(dues)]
        value = {"format": "madison-case-summary", "case": {"number": number}, "violations": items}
        value.update(extra)
        return value

    def write_summary(self, number, value, name=None):
        folder = self.root / "Case JSON Files" / "Reporting Index"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / (name or number + ".json")).write_text(value if isinstance(value, str) else json.dumps(value))

    def test_the_soonest_outstanding_due_date_of_the_last_issued_document_is_the_due_date(self):
        today = "2026-11-03"
        self.assertEqual(cases.next_due(self.summary("A", "2026-12-20", "2026-11-20", "2026-12-01")), "2026-11-20", "the soonest of the items")
        self.assertEqual(cases.next_due(self.summary("A", "2026-10-01", "2026-12-01")), "2026-10-01", "a past-due date counts and leads")
        done = self.summary("A", "2026-11-05", "2026-12-01")
        done["violations"][0]["done"] = True
        self.assertEqual(cases.next_due(done), "2026-12-01", "a corrected item no longer counts")
        done["violations"][1]["withdrawn"] = True
        self.assertEqual(cases.next_due(done), "", "nothing outstanding means no due date")
        for bad in ("", "soon", "2026-13-45", "12/01/2026", None, 5):
            self.assertEqual(cases.next_due(self.summary("A", bad)), "", repr(bad))
        self.assertEqual(cases.next_due({"violations": "not a list"}), "")
        self.assertEqual(cases.next_due({}), "", today)

    def write_case(self, number, *dues, done=(), summary=True):
        """A saved, verified case whose notice items carry the given due dates, and (unless asked not to) the summary the
        Writer writes for it through the store, which checks it against the case."""
        value = initial()
        value["case"]["number"] = number
        snap = value["events"][0]["payload"]["snapshot"]
        snap["frozen"]["case"]["number"] = number
        first = snap["items"][0]
        snap["items"] = [
            dict(first, id=f"item_{n}", no=str(n + 1), due=due, done=n in done, doneOn="2026-08-01" if n in done else "")
            for n, due in enumerate(dues or ["2026-10-30"])
        ]
        folder = self.root / "Case JSON Files"
        folder.mkdir(parents=True, exist_ok=True)
        saved = case_store.save_case(folder, "101 TEST LANE - " + number + ".json", value)
        if summary:
            record_value = case_store.read_case(folder, saved["name"])["file"]
            projected = dict(case_projection.projected(record_value)[0], format="madison-case-summary")
            self.assertTrue(case_store.save_summary(folder, saved["name"], saved["revision"], projected)["ok"])
        return folder / saved["name"]

    def index_file(self, number):
        return self.root / "Case JSON Files" / "Reporting Index" / (number.lower() + ".json")

    def test_linked_case_without_summary_is_unknown_not_no_order(self):
        folder = self.root / "Case JSON Files"
        folder.mkdir()
        number = "CB2026-241-00001"
        outside = self.root / "outside.json"
        outside.write_text("do not read", encoding="utf-8")
        (folder / ("TEST ROAD - " + number + ".json")).symlink_to(outside)
        self.assertEqual(cases.due_dates(folder, [number])[number], ("unknown", ""))

    def test_due_dates_come_only_from_verified_current_summaries(self):
        # MCR-002: a date is shown only from a summary that names the current case revision, whose case verifies and
        # whose projection equals the summary. Anything that cannot be confirmed is "unknown", never "no order".
        n = ["CB2026-241-%05d" % i for i in range(1, 9)]
        self.write_case(n[0], "2026-12-01", "2026-11-10")
        self.write_case(n[1], "2026-11-04", "2026-11-20", done=(0,))
        self.write_case(n[2], "2026-11-05", summary=False)  # case saved, summary never written
        stale = self.write_case(n[3], "2026-11-06")
        record_value = json.loads(stale.read_text())
        stale.write_text(json.dumps(record_value, indent=1))  # newer bytes: the summary's revision no longer matches
        self.write_case(n[4], "2026-11-07")
        self.index_file(n[4]).write_text(self.index_file(n[4]).read_text().replace("2026-11-07", "2026-11-09"))  # disagrees
        self.write_summary(n[5], self.summary(n[5], "2026-10-01"))  # orphan: no case file at all
        self.write_case(n[6], "2026-11-08")
        self.index_file(n[6]).write_text("{ not json")
        found = cases.due_dates(self.root / "Case JSON Files", n)
        self.assertEqual(
            found,
            {
                n[0]: ("due", "2026-11-10"),
                n[1]: ("due", "2026-11-20"),
                n[2]: ("unknown", ""),
                n[3]: ("unknown", ""),
                n[4]: ("unknown", ""),
                n[5]: ("unknown", ""),
                n[6]: ("unknown", ""),
                n[7]: ("none", ""),
            },
        )
        self.assertEqual(cases.due_dates(self.root / "nowhere", [n[0]]), None, "an unreachable case folder is reported, not guessed")
        withdrawn = self.write_case("CB2026-241-00010", "2026-11-10", done=(0,))
        self.assertTrue(withdrawn.exists())
        self.assertEqual(cases.due_dates(self.root / "Case JSON Files", ["CB2026-241-00010"]), {"CB2026-241-00010": ("none", "")})

    def test_open_cases_sort_no_order_first_then_past_due_to_furthest_then_unknown(self):
        names = ["CB2026-241-%05d" % i for i in range(1, 7)]
        rows = [case_row(n) for n in names]
        self.write_case(names[0], "2026-12-15")
        self.write_case(names[1], "2026-10-01")
        self.write_case(names[3], "2026-11-20", "2026-11-05")
        self.write_case(names[4], "2026-11-06", done=(0,))
        self.write_summary(names[5], self.summary(names[5], "2026-09-01"))  # orphaned summary
        with self.report(rows):
            result = cases.open_cases(self.root, "Jordan Smith", self.root / "Case JSON Files")
        self.assertTrue(result["dueDates"])
        self.assertEqual(
            [(c["caseNumber"], c["dueState"], c["dueDate"]) for c in result["cases"]],
            [
                ("CB2026-241-00003", "none", ""),
                ("CB2026-241-00005", "none", ""),
                ("CB2026-241-00002", "due", "2026-10-01"),
                ("CB2026-241-00004", "due", "2026-11-05"),
                ("CB2026-241-00001", "due", "2026-12-15"),
                ("CB2026-241-00006", "unknown", ""),
            ],
            "no order first (in the report's order), then past due to furthest away, then unconfirmed",
        )
        with self.report(rows):
            unreachable = cases.open_cases(self.root, "Jordan Smith", self.root / "nowhere")
        self.assertFalse(unreachable["dueDates"])
        self.assertEqual([c["caseNumber"] for c in unreachable["cases"]], names, "without due dates the report's order stays")
        self.assertTrue(all(c["dueDate"] == "" and c["dueState"] == "unknown" for c in unreachable["cases"]))

    def test_open_cases_refuse_unlisted_wrong_inspector_columns_values_and_excluded_people(self):
        for value in ["", "   ", "x" * 129, None, 7, "A\nB", "tab\there"]:
            with self.subTest(value=value), self.assertRaises(lookup.CaseLookupError) as error:
                cases.open_cases(self.root, value)
            self.assertEqual(error.exception.status, 400)
        with self.report([case_row()]), self.assertRaises(lookup.CaseLookupError) as error:
            cases.open_cases(self.root, "Somebody Else")
        self.assertEqual(error.exception.status, 400)
        self.assertIn("Refresh inspector list", str(error.exception))
        wrong = [
            [case_row(), case_row("CB2026-241-00002", inspector="Other Person")],
            [case_row("bad number!")],
            [case_row(CaseDescription="x" * 2001)],
            [case_row(CaseDescription=5)],
            [case_row(f"CB2026-241-{n:05d}") for n in range(cases.MAX_CASES + 1)],
        ]
        for rows in wrong:
            cases._cache.update(root=None, at=0.0, answer=None, source=None)
            with self.subTest(rows=str(rows)[:40]), self.report(rows, everyone=[case_row()]), self.assertRaises(lookup.CaseLookupError):
                cases.open_cases(self.root, "Jordan Smith")
        self.excluding(["jordan smith"])
        self.calls.clear()
        with self.report([case_row()]), self.assertRaises(lookup.CaseLookupError) as error:
            cases.open_cases(self.root, "Jordan Smith")
        self.assertEqual(error.exception.status, 403)
        self.assertEqual(self.calls, [], "an excluded person's cases are never rendered")

    def test_exclusion_file_is_validated(self):
        self.assertEqual(cases.exclusions(self.root), list(cases.DEFAULT_EXCLUDED), "without a file only the division's built-in list applies")
        for value in ["Pat", [""], [5], ["x" * 129], ["a\nb"], ["x"] * 101, "not json", '{"exclude": [], "extra": 1}', "[]"]:
            self.excluding(value)
            with self.subTest(value=str(value)[:20]), self.assertRaisesRegex(lookup.CaseLookupError, "excluded-inspectors.json"):
                cases.exclusions(self.root)
        self.excluding(["Alice%Example"])
        self.assertEqual(cases.exclusions(self.root), list(cases.DEFAULT_EXCLUDED) + ["Alice%Example"], "the administrator's entries are added")

    def test_an_exclusion_added_after_the_list_loaded_applies_to_the_next_request(self):
        with self.report([case_row(inspector="Synthetic Excluded Person"), case_row("CB2026-241-00002")]):
            self.assertEqual(sorted(p["id"] for p in cases.inspectors(self.root)["inspectors"]), ["Jordan Smith", "Synthetic Excluded Person"])
            self.excluding(["Synthetic%Excluded%Person"])
            self.assertEqual([p["id"] for p in cases.inspectors(self.root)["inspectors"]], ["Jordan Smith"])
            with self.assertRaises(lookup.CaseLookupError) as error:
                cases.open_cases(self.root, "synthetic excluded person")
            self.assertEqual(error.exception.status, 403)

    def test_a_cold_list_cache_is_read_before_any_inspectors_cases_are_rendered(self):
        with self.report([case_row()]):
            cases.open_cases(self.root, "Jordan Smith")
        self.assertEqual(self.calls, [None, "Jordan Smith"])
        cases._cache.update(root=None, at=0.0, answer=None, source=None)
        with patch.object(ssrs_reports, "open_case_rows", side_effect=ssrs_reports.ReportError("offline")) as run:
            with self.assertRaises(lookup.CaseLookupError):
                cases.open_cases(self.root, "Jordan Smith")
            self.assertEqual(run.call_count, 1, "an unreadable list refuses the request instead of guessing")

    def test_the_divisions_four_excluded_staff_never_appear_whatever_the_name_form(self):
        names = [
            "Alice Duncan-Graves",
            "Alice Duncan- Graves",
            "Alice M Duncan Graves",
            "Gregg May",
            "GREGG A. MAY",
            "Jessica Price",
            "Phil Grupe",
            "Alex Smith",
            "Gregg Mayer",
            "Pat Price",
        ]
        rows = [case_row(f"CB2026-241-{n:05d}", inspector=name) for n, name in enumerate(names)]
        with self.report(rows):
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
        with patch.object(ssrs_reports, "open_case_rows", side_effect=ssrs_reports.ReportError("offline")):
            with self.assertRaises(lookup.CaseLookupError):
                cases.inspectors(self.root)
        self.assertTrue(cases.LISTS.acquire(blocking=False))
        cases.LISTS.release()


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
                self.assertEqual(post("/inspector-cases/cases", {"inspector": "Jordan Smith"})[0], 200)
                self.assertEqual(detail.call_args.args[1], "Jordan Smith")
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
