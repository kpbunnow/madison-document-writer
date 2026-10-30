"""Open cases for one inspector: the open rule, assignment, ordering, incompleteness and the guarded route.

The rule must match the Reports "open (not closed)" filter: Closed and Withdrawn are closed, and a snow case is
closed once its closing filing is on or before today. The route is read-only, answers with plain sentences and
reads only through read_index, so a case file is never opened or changed here.
"""

import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

import case_projection
import open_cases
import server

TODAY = "2026-10-30"
ROSTER = {"i1", "i2"}


def summary(number, inspector="i1", status="Notice", due=("2026-11-05",), **case):
    return {
        "case": {"number": number, "address": number + " ST", "owner": "OWNER " + number, "inspectorId": inspector, "status": status, **case},
        "violations": [{"due": day, "done": False, "withdrawn": False} for day in due],
    }


def listing(summaries, inspector="i1", **extra):
    return open_cases.open_cases_for({"summaries": summaries, **extra}, inspector, ROSTER, TODAY)


class OpenCaseRules(unittest.TestCase):
    def test_closed_and_withdrawn_are_not_open_and_other_standings_are(self):
        for status in ("Closed", "Withdrawn"):
            with self.subTest(status=status):
                self.assertEqual(listing([summary("A", status=status)])["cases"], [])
        for status in ("Not issued", "Notice", "Extension", "Cited", "Referred", "Occupancy restricted", "Restriction released"):
            with self.subTest(status=status):
                self.assertEqual([c["number"] for c in listing([summary("A", status=status)])["cases"]], ["A"])

    def test_snow_case_closes_on_its_filing_day(self):
        snow = dict(caseType="snow-10.28", status="Cited – snow")
        self.assertEqual(listing([summary("S1", closedOn=TODAY, **snow)])["cases"], [])
        self.assertEqual(listing([summary("S2", closedOn="2026-10-01", **snow)])["cases"], [])
        self.assertEqual(len(listing([summary("S3", closedOn="2026-10-31", **snow)])["cases"]), 1)
        self.assertEqual(len(listing([summary("S4", closedOn="", **snow)])["cases"]), 1)
        # A closing date on a non-snow case does not close it; only the status does.
        self.assertEqual(len(listing([summary("N1", closedOn="2026-10-01")])["cases"]), 1)

    def test_assignment_is_the_cases_own_inspector(self):
        rows = [summary("A", "i1"), summary("B", "i2"), summary("C", "i1")]
        self.assertEqual([c["number"] for c in listing(rows, "i1")["cases"]], ["A", "C"])
        self.assertEqual([c["number"] for c in listing(rows, "i2")["cases"]], ["B"])
        self.assertEqual(listing(rows, "i9")["cases"], [])

    def test_unassigned_choice_covers_blank_missing_and_former_inspectors(self):
        rows = [summary("A", "i1"), summary("B", ""), summary("C", "gone"), summary("D", None), {"case": {"number": "E", "status": "Notice"}}]
        self.assertEqual([c["number"] for c in listing(rows, open_cases.UNASSIGNED)["cases"]], ["B", "C", "D", "E"])
        # Nothing appears under two picker choices.
        seen = [c["number"] for who in (*ROSTER, open_cases.UNASSIGNED) for c in listing(rows, who)["cases"]]
        self.assertEqual(sorted(seen), ["A", "B", "C", "D", "E"])

    def test_next_due_ignores_done_withdrawn_and_malformed_dates(self):
        item = lambda due, **x: {"due": due, **x}  # noqa: E731
        value = summary("A")
        value["violations"] = [
            item("2026-09-01", done=True),
            item("2026-09-02", withdrawn=True),
            item("soon"),
            item(None),
            item("2026-12-01"),
            item("2026-11-20"),
            "not a record",
        ]
        self.assertEqual(listing([value])["cases"][0]["nextDue"], "2026-11-20")
        value["violations"] = []
        self.assertEqual(listing([value])["cases"][0]["nextDue"], "")

    def test_soonest_deadline_first_then_undated_by_number(self):
        rows = [summary("C", due=()), summary("B", due=("2026-12-01",)), summary("A", due=()), summary("D", due=("2026-11-01", "2026-10-01"))]
        self.assertEqual([c["number"] for c in listing(rows)["cases"]], ["D", "B", "A", "C"])

    def test_incomplete_count_and_limits(self):
        index = {"missing": ["a"], "stale": ["b", "c"], "unreadable": ["d"], "mismatched": ["e"]}
        self.assertEqual(listing([], **index)["incomplete"], 5)
        many = [summary("C%04d" % n) for n in range(open_cases.MAX_ROWS + 3)]
        result = listing(many)
        self.assertEqual((len(result["cases"]), result["total"], result["partial"]), (open_cases.MAX_ROWS, open_cases.MAX_ROWS + 3, True))

    def test_damaged_summaries_are_skipped_not_fatal(self):
        rows = [None, "x", {}, {"case": "x"}, {"case": {"number": "A", "inspectorId": "i1", "status": "Notice"}, "violations": "bad"}]
        self.assertEqual([c["number"] for c in listing(rows)["cases"]], ["A"])

    def test_inspector_must_be_a_short_text(self):
        for bad in ("", None, 5, "x" * 81):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                listing([], bad)

    def test_roster_is_the_divisions_list(self):
        ids = {i["id"] for i in case_projection.tables()[0]["inspectors"]}
        self.assertTrue({"i1", "i2", "i3"} <= ids)


class OpenCasesRoute(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "Case JSON Files").mkdir()
        self.patches = [patch.object(server, "HERE", self.root), patch.dict("os.environ", {"DW_CASE_DIR": str(self.root / "Case JSON Files")})]
        for item in self.patches:
            item.start()
        self.http = server.Server(("127.0.0.1", 0), server.Handler)
        self.port = server.PORT
        server.PORT = self.http.server_address[1]
        self.base = "http://127.0.0.1:%d" % server.PORT
        self.thread = threading.Thread(target=self.http.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.http.shutdown()
        self.http.server_close()
        self.thread.join(5)
        server.PORT = self.port
        for item in reversed(self.patches):
            item.stop()
        self.temp.cleanup()

    def get(self, query="?inspector=i1", headers=None):
        headers = {"X-DocWriter-Token": server.SESSION_TOKEN} if headers is None else headers
        try:
            with urllib.request.urlopen(urllib.request.Request(self.base + "/cases/by-inspector" + query, headers=headers), timeout=10) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read() or b"null")

    def test_route_is_registered_as_a_guarded_get_only(self):
        self.assertIs(server.GET_ROUTES["/cases/by-inspector"], server.Handler._get_cases_by_inspector)
        self.assertNotIn("/cases/by-inspector", server.POST_ROUTES)
        for headers in ({}, {"X-DocWriter-Token": "wrong"}, {"X-DocWriter-Token": server.SESSION_TOKEN, "Origin": "https://foreign.invalid"}):
            with self.subTest(headers=headers):
                self.assertEqual(self.get(headers=headers)[0], 403)

    def test_returns_the_inspectors_open_cases_from_the_index(self):
        index = {"ok": True, "summaries": [summary("A"), summary("B", status="Closed"), summary("C", "i2")], "missing": ["x.json"], "readAt": "now"}
        with patch.object(server, "read_index", return_value=index):
            status, body = self.get()
        self.assertEqual(status, 200)
        self.assertEqual([c["number"] for c in body["cases"]], ["A"])
        self.assertEqual(body["incomplete"], 1)

    def test_refusals_are_plain_sentences_without_paths_or_python_text(self):
        status, body = self.get("")
        self.assertEqual((status, body["error"]), (400, "Choose an inspector"))
        with patch.object(server, "read_index", return_value={"ok": False, "error": "the case folder /secret/place cannot be reached"}):
            status, body = self.get()
        self.assertEqual((status, body), (503, {"ok": False, "error": "The shared case folder could not be read"}))
        with patch.object(server, "read_index", side_effect=KeyError("private")):
            status, body = self.get()
        self.assertEqual(status, 500)
        self.assertNotIn("private", json.dumps(body))

    def test_a_case_file_is_never_written(self):
        folder = self.root / "Case JSON Files"
        (folder / "1 A ST - A.json").write_text("{}")
        before = {p.name: p.read_bytes() for p in folder.iterdir()}
        with patch.object(server, "read_index", return_value={"ok": True, "summaries": []}):
            self.get()
        self.assertEqual({p.name: p.read_bytes() for p in folder.iterdir()}, before)


if __name__ == "__main__":
    unittest.main()
