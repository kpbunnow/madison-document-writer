"""Reports uses a cached summary only when it equals the projection of its verified case."""

import copy, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import case_integrity as integrity
import case_store as store
import server
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


if __name__ == "__main__":
    unittest.main()
