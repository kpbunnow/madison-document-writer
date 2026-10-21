"""Reports uses a cached summary only when it equals the projection of its verified case."""

import copy, json, subprocess, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import case_integrity as integrity
import case_store as store
import server
import case_projection as cp
from audit_r28_helper import pair
from report_summaries import report_summary

ROOT = Path(__file__).resolve().parents[2]
SUMMARY = "Reporting Index/qa-life.json"


def life():
    """A synthetic case with a notice, its citation, a visit and a compliance closure."""
    value = pair()
    value["schema"] = 5
    value["case"].update(owner="José — SYNTHETIC OWNER", ownerAddr=["SYNTHETIC OWNER", "123 MAIN ST", "MADISON WI 53703"])
    return value


def extend(previous):
    value = copy.deepcopy(previous)
    notice = value["events"][0]["payload"]["snapshot"]
    visit = {
        "id": "visit_1",
        "date": "2026-09-01",
        "sourceDocId": "notice_1",
        "inspectorId": "inspector_1",
        "results": {"item_1": {"oc": "corrected", "on": "2026-09-01"}},
    }
    compliance = copy.deepcopy(notice)
    compliance.update(id="compliance_1", type="compliance", mailed="2026-09-02", fromReinspId="visit_1")
    compliance.pop("issuanceGroup", None)
    compliance["items"][0].update(id="closed_item", srcItemId="item_1", done=True, doneOn="2026-09-01")
    value["events"] += [
        {"id": "visit_event", "at": "2026-09-01T15:00:00Z", "by": "inspector_1", "type": "reinspection.recorded", "payload": {"reinspection": visit}},
        {
            "id": "compliance_event",
            "at": "2026-09-02T15:00:00Z",
            "by": "inspector_1",
            "type": "compliance.issued",
            "payload": {"docId": "compliance_1", "snapshot": compliance},
        },
    ]
    return integrity.commit_record(previous, value)


def at(summary, path):
    """The container and key a /-separated path names inside a summary."""
    *parents, last = path.split("/")
    for key in parents:
        summary = summary[int(key)] if isinstance(summary, list) else summary[key]
    return summary, int(last) if isinstance(summary, list) else last


# JSON type substitutions that Python equality (False == 0, True == 1) would not notice.
SUBSTITUTIONS = [
    ("case/noticeActive", True, 1),
    ("case/historic", False, 0),
    ("documents/0/void", False, 0),
    ("documents/2/allWithdrawn", False, 0),
    ("violations/0/done", True, 1),
    ("violations/0/withdrawn", False, 0),
    ("violations/0/history/0/done", False, 0),
    ("violations/0/visits", 1, True),
    ("violations/0/cited", 1, True),
    ("violations/0/sections/0", "27.05(2)(c)", 27.05),
]
# Representations of the same JSON value that must still be accepted.
EQUIVALENT = [("citations/0/amount", 197, 197.0), ("eventCount", 4, 4.0), ("violations/0/visits", 1, 1.0)]


# Summary-only edits that keep sourceRevision; each changes a fact Reports would count, group or export.
CORRUPTIONS = {
    "owner": lambda s: s["case"].update(owner="ALTERED OWNER"),
    "status": lambda s: s["case"].update(status="Notice"),
    "notice date": lambda s: s["case"].update(noticeIssued="2025-01-01"),
    "closure date": lambda s: s["case"].update(closedOn="2025-01-02"),
    "document": lambda s: s["documents"].pop(),
    "document type": lambda s: s["documents"][0].update(type="extension"),
    "violation": lambda s: s["violations"][0].update(done=False, doneOn=""),
    "violation type": lambda s: s["violations"][0].update(type="unclassified/1"),
    "citation": lambda s: s["citations"][0].update(amount=1.0),
    "citation removed": lambda s: s["citations"].clear(),
    "added field": lambda s: s["case"].update(extra="unreviewed"),
}


class ReportProjection(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.anchor_folder = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.name = "101 TEST - QA-LIFE.json"
        saved = store.save_case(self.root, self.name, life())
        value = extend(saved["file"])
        (self.root / self.name).write_bytes(store.encoded(value))
        self.case = value
        self.case_bytes = (self.root / self.name).read_bytes()
        self.revision = integrity.hash_bytes(self.case_bytes)
        store.save_summary(self.root, self.name, self.revision, report_summary(value))
        self.summary = json.loads((self.root / SUMMARY).read_bytes())
        server.PROJECTION_MATCHES.clear()

    def tearDown(self):
        self.temp.cleanup()
        self.anchor_folder.cleanup()

    def read(self, anchored, workers=4):
        anchor = Path(self.anchor_folder.name) if anchored else None
        with patch.object(server, "case_dir", return_value=self.root), patch.object(integrity, "protected_folder", return_value=anchor):
            if anchored:
                integrity.anchor_daily(self.root, anchor)
            return server.read_index(workers)

    def write(self, summary):
        (self.root / SUMMARY).write_text(json.dumps(summary), encoding="utf-8")

    def test_valid_summaries_are_used_anchored_and_unanchored(self):
        projected = report_summary(self.case)
        self.assertEqual((projected["case"]["status"], projected["case"]["closedOn"]), ("Closed", "2026-09-02"))
        self.assertTrue(projected["citations"] and projected["violations"] and len(projected["documents"]) == 3)
        for anchored in (False, True):
            with self.subTest(anchored=anchored):
                index = self.read(anchored)
                self.assertEqual(len(index["summaries"]), 1)
                self.assertEqual((index["mismatched"], index["stale"], index["missing"], index["unreadable"]), ([], [], [], []))
                self.assertEqual(index["summaries"][0]["integrity"]["anchored"], anchored)
                self.assertEqual(index["summaries"][0]["case"]["owner"], "José — SYNTHETIC OWNER")

    def test_summary_only_changes_are_excluded_with_sourcerevision_unchanged(self):
        for anchored in (False, True):
            # A match remembered from an earlier read must not hide a later edit.
            self.assertEqual(len(self.read(anchored)["summaries"]), 1)
            for label, corrupt in CORRUPTIONS.items():
                with self.subTest(anchored=anchored, change=label):
                    altered = copy.deepcopy(self.summary)
                    corrupt(altered)
                    self.assertEqual(altered["sourceRevision"], self.revision)
                    self.write(altered)
                    index = self.read(anchored)
                    self.assertEqual(index["summaries"], [])
                    self.assertEqual(len(index["mismatched"]), 1)
                    self.assertIn("qa-life.json (" + self.name + "; differs in ", index["mismatched"][0])
                    # Excluded once, as a mismatch: not also reported as missing, stale or unreadable.
                    self.assertEqual((index["missing"], index["stale"], index["unreadable"]), ([], [], []))
                    self.assertEqual((self.root / self.name).read_bytes(), self.case_bytes)
            self.write(self.summary)

    def test_mismatch_names_the_differing_fields(self):
        altered = copy.deepcopy(self.summary)
        altered["case"]["owner"] = "ALTERED OWNER"
        altered["citations"][0]["amount"] = 1.0
        self.write(altered)
        self.assertTrue(self.read(False)["mismatched"][0].endswith("differs in case, citations)"))

    def test_rebuild_restores_a_valid_projection_without_changing_the_case(self):
        altered = copy.deepcopy(self.summary)
        altered["case"]["owner"] = "ALTERED OWNER"
        self.write(altered)
        self.assertEqual(self.read(True)["summaries"], [])
        # Rebuilding writes the Writer's summarize() of the verified case through the helper.
        store.save_summary(self.root, self.name, self.revision, report_summary(self.case))
        index = self.read(True)
        self.assertEqual(index["summaries"][0]["case"]["owner"], "José — SYNTHETIC OWNER")
        self.assertEqual(index["mismatched"], [])
        self.assertEqual((self.root / self.name).read_bytes(), self.case_bytes)

    def test_helper_refuses_to_write_a_mismatched_summary(self):
        before = (self.root / SUMMARY).read_bytes()
        for label, corrupt in CORRUPTIONS.items():
            with self.subTest(change=label):
                altered = report_summary(self.case)
                corrupt(altered)
                with self.assertRaisesRegex(ValueError, "does not match the saved case"):
                    store.save_summary(self.root, self.name, self.revision, altered)
                self.assertEqual((self.root / SUMMARY).read_bytes(), before)

    def test_existing_exclusions_remain(self):
        stale = copy.deepcopy(self.summary)
        stale["sourceRevision"] = "0" * 64
        stale["case"]["owner"] = "ALTERED OWNER"
        self.write(stale)
        index = self.read(False)
        self.assertEqual((index["stale"], index["mismatched"]), ([self.name], []))
        # Earlier-format summaries pass to Reports, which excludes them as earlier format.
        legacy = copy.deepcopy(self.summary)
        legacy["summaryVersion"] = 5
        legacy["case"]["owner"] = "ALTERED OWNER"
        self.write(legacy)
        index = self.read(False)
        self.assertEqual([s["summaryVersion"] for s in index["summaries"]], [5])
        self.write(self.summary)
        (self.root / "Reporting Index/duplicate.json").write_bytes((self.root / SUMMARY).read_bytes())
        index = self.read(False)
        self.assertEqual(index["summaries"], [])
        self.assertTrue(any("duplicate" in u for u in index["unreadable"]))
        (self.root / "Reporting Index/duplicate.json").unlink()
        damaged = json.loads(self.case_bytes)
        damaged["events"][0]["payload"]["snapshot"]["items"][0]["title"] = "altered history"
        (self.root / self.name).write_text(json.dumps(damaged), encoding="utf-8")
        summary = copy.deepcopy(self.summary)
        summary["sourceRevision"] = integrity.hash_bytes((self.root / self.name).read_bytes())
        self.write(summary)
        index = self.read(False)
        self.assertEqual((index["summaries"], index["mismatched"]), ([], []))
        self.assertEqual(len(index["unreadable"]), 1)

    def test_serial_and_parallel_reads_are_equivalent(self):
        for n in range(12):
            value = json.loads(json.dumps(life()).replace("QA-LIFE", "QA-PAR-" + str(n)))
            name = "101 TEST - QA-PAR-" + str(n) + ".json"
            saved = store.save_case(self.root, name, value)
            summary = report_summary(saved["file"])
            if n % 3 == 0:
                summary["case"]["status"] = "Altered"
                summary.update(sourceFile=name, sourceRevision=saved["revision"], integrity={})
                (self.root / ("Reporting Index/qa-par-" + str(n) + ".json")).write_text(json.dumps(summary), encoding="utf-8")
            else:
                store.save_summary(self.root, name, saved["revision"], summary)
        serial, parallel = self.read(False, 1), self.read(False, 4)
        for index in (serial, parallel):
            index.pop("readAt")
        self.assertEqual(serial, parallel)
        self.assertEqual((len(serial["summaries"]), len(serial["mismatched"])), (9, 4))

    def test_boolean_and_number_substitutions_are_excluded_on_read(self):
        for anchored in (False, True):
            # A successful comparison remembered from an earlier read must not hide a later change.
            self.assertEqual(len(self.read(anchored)["summaries"]), 1)
            for path, legitimate, substitute in SUBSTITUTIONS:
                with self.subTest(anchored=anchored, path=path, value=substitute):
                    altered = copy.deepcopy(self.summary)
                    holder, key = at(altered, path)
                    self.assertTrue(cp.same_json(holder[key], legitimate))
                    holder[key] = substitute
                    self.assertTrue(altered == self.summary or path.endswith("sections/0"), "Python equality would accept it")
                    self.write(altered)
                    index = self.read(anchored)
                    self.assertEqual(index["summaries"], [])
                    self.assertEqual(len(index["mismatched"]), 1)
                    self.assertIn("differs in " + path.split("/")[0] + ")", index["mismatched"][0])
                    self.assertEqual((self.root / self.name).read_bytes(), self.case_bytes)
            self.write(self.summary)
            self.assertEqual(len(self.read(anchored)["summaries"]), 1)

    def test_boolean_and_number_substitutions_are_refused_on_write(self):
        before = (self.root / SUMMARY).read_bytes()
        for path, legitimate, substitute in SUBSTITUTIONS:
            for first, second in ((legitimate, substitute), (substitute, legitimate)):
                with self.subTest(path=path, written=second):
                    summary = report_summary(self.case)
                    holder, key = at(summary, path)
                    holder[key] = second
                    if cp.same_json(second, legitimate):
                        continue  # the legitimate value is the valid summary itself
                    with self.assertRaisesRegex(ValueError, "does not match the saved case"):
                        store.save_summary(self.root, self.name, self.revision, summary)
                    self.assertEqual((self.root / SUMMARY).read_bytes(), before)

    def test_equivalent_numbers_and_key_order_are_accepted(self):
        altered = json.loads(json.dumps(self.summary), object_pairs_hook=lambda pairs: dict(reversed(pairs)))
        for path, legitimate, equivalent in EQUIVALENT:
            holder, key = at(altered, path)
            self.assertTrue(cp.same_json(holder[key], legitimate))
            holder[key] = equivalent
        self.write(altered)
        for anchored in (False, True):
            with self.subTest(anchored=anchored):
                index = self.read(anchored)
                self.assertEqual((len(index["summaries"]), index["mismatched"]), (1, []))
        store.save_summary(self.root, self.name, self.revision, json.loads((self.root / SUMMARY).read_bytes()))

    def test_unsupported_json_values_never_match(self):
        for value in ("NaN", "Infinity", "-Infinity", "9007199254740993"):
            with self.subTest(value=value):
                text = json.dumps(self.summary).replace('"eventCount": 4', '"eventCount": ' + value)
                self.assertIn(value, text)
                (self.root / SUMMARY).write_text(text, encoding="utf-8")
                index = self.read(False)
                self.assertEqual((index["summaries"], len(index["mismatched"])), ([], 1))


class WithdrawnNotice(unittest.TestCase):
    """The reproduced bypass: a voided notice and citation, then noticeActive false changed to 0."""

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.anchor = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.name = "101 TEST - QA-LIFE.json"
        saved = store.save_case(self.root, self.name, life())
        value = copy.deepcopy(saved["file"])
        for n, doc in enumerate(["notice_1", "initial_citation"]):
            value["events"].append(
                {
                    "id": "void_" + str(n),
                    "at": "2026-08-02T15:00:00.00" + str(n) + "Z",
                    "by": "inspector_1",
                    "type": "document.voided",
                    "payload": {"docId": doc, "reason": "Synthetic void"},
                }
            )
        saved = store.save_case(self.root, self.name, value, saved["revision"], saved["file"]["case"])
        self.case, self.revision = saved["file"], saved["revision"]
        store.save_summary(self.root, self.name, self.revision, report_summary(self.case))
        self.summary = json.loads((self.root / SUMMARY).read_bytes())
        self.case_bytes = (self.root / self.name).read_bytes()
        server.PROJECTION_MATCHES.clear()

    def tearDown(self):
        self.temp.cleanup()
        self.anchor.cleanup()

    def read(self, anchored):
        anchor = Path(self.anchor.name) if anchored else None
        with patch.object(server, "case_dir", return_value=self.root), patch.object(integrity, "protected_folder", return_value=anchor):
            if anchored:
                integrity.anchor_daily(self.root, anchor)
            return server.read_index(4)

    def report(self, index):
        path = Path(self.temp.name) / "index.json"
        path.write_text(json.dumps(index), encoding="utf-8")
        output = Path(self.temp.name) / "report.json"
        subprocess.run(
            ["node", "tests/fixtures/report_output.cjs", str(path), "byInspector", str(output)], cwd=ROOT, capture_output=True, timeout=60, check=True
        )
        return json.loads(output.read_bytes())

    def altered(self):
        altered = copy.deepcopy(self.summary)
        self.assertIs(altered["case"]["noticeActive"], False)
        altered["case"]["noticeActive"] = 0
        return altered

    def test_altered_notice_activity_is_refused_and_excluded(self):
        self.assertEqual((self.summary["case"]["status"], [d["void"] for d in self.summary["documents"]]), ("Withdrawn", [True, True]))
        with self.assertRaisesRegex(ValueError, "does not match the saved case"):
            store.save_summary(self.root, self.name, self.revision, self.altered())
        self.assertEqual(json.loads((self.root / SUMMARY).read_bytes()), self.summary)
        for anchored in (False, True):
            with self.subTest(anchored=anchored):
                legitimate = self.read(anchored)
                self.assertEqual((len(legitimate["summaries"]), legitimate["mismatched"]), (1, []))
                self.assertIs(legitimate["summaries"][0]["integrity"]["anchored"], anchored)
                (self.root / SUMMARY).write_text(json.dumps(self.altered()), encoding="utf-8")
                index = self.read(anchored)
                self.assertEqual(index["summaries"], [])
                self.assertEqual(index["mismatched"], ["qa-life.json (" + self.name + "; differs in case)"])
                (self.root / SUMMARY).write_text(json.dumps(self.summary), encoding="utf-8")
        self.assertEqual((self.root / self.name).read_bytes(), self.case_bytes)

    def test_report_results_cannot_consume_the_altered_summary(self):
        legitimate = self.report(self.read(True))
        self.assertEqual(legitimate["rows"][-1], ["All inspectors", 0])  # a withdrawn notice is not an active case
        # The stakes: given to Reports directly, the altered summary is counted as an active case.
        bypass = self.read(True)
        bypass["summaries"] = [{**self.altered(), "integrity": bypass["summaries"][0]["integrity"]}]
        self.assertEqual(self.report(bypass)["rows"][-1][-1], 1)
        (self.root / SUMMARY).write_text(json.dumps(self.altered()), encoding="utf-8")
        excluded = self.report(self.read(True))
        self.assertEqual((excluded["counted"], excluded["rows"]), (0, legitimate["rows"]))
        self.assertIn("1 summary not matching its verified case", excluded["coverage"])
        about = next(s for s in excluded["sheets"] if s["name"] == "About")["rows"]
        self.assertIn(["Summaries not matching their case", 1], about)
        output = json.dumps({k: excluded[k] for k in ("rows", "sheets", "page")})
        self.assertNotIn("QA-LIFE", output.replace("qa-life.json", "").replace(self.name, ""))
        # Rebuilding rewrites the summary from the verified case; the case is unchanged.
        store.save_summary(self.root, self.name, self.revision, report_summary(self.case))
        rebuilt = self.read(True)
        self.assertEqual((len(rebuilt["summaries"]), rebuilt["mismatched"]), (1, []))
        self.assertEqual(self.report(rebuilt)["rows"], legitimate["rows"])
        self.assertEqual((self.root / self.name).read_bytes(), self.case_bytes)


if __name__ == "__main__":
    unittest.main()
