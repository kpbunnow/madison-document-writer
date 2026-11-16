"""Real store publication and projection: initial citation-only is closure, never fabricated compliance."""

import copy
import json
import os
import subprocess
from pathlib import Path
import tempfile
import unittest

import case_projection
import case_store
from citation_disposition import CITATION_ONLY, citation_only_closed
from audit_r28_helper import pair


def citation_only_pair():
    record = pair()
    for event in record["events"]:
        snapshot = event["payload"]["snapshot"]
        snapshot["importInspection"] = {"type": "initial", "date": "2026-08-01", "time": ""}
        snapshot["importRule"] = {"kind": "initial", "cite": True, "status": "Citation", "doc": "notice"}
        snapshot["items"][0].update(due="", dueExempt=CITATION_ONLY)
    return record


def mixed_pair():
    value = citation_only_pair()
    for event in value["events"]:
        snapshot = event["payload"]["snapshot"]
        item = copy.deepcopy(snapshot["items"][0])
        item.update(id="other_notice" if snapshot["type"] == "notice" else "other_citation", no="2", cite=False, due="2026-09-01")
        item.pop("dueExempt")
        if snapshot["type"] == "citation":
            item["srcItemId"] = "other_notice"
        snapshot["items"].append(item)
    return value


def followup(record, kind, day, due=""):
    value = copy.deepcopy(record)
    source = value["events"][-1]["payload"]["snapshot"]
    rid = "visit-" + kind
    results = {
        item["id"]: {"oc": "none", "carried": True, "on": "", "due": "", "note": "", "cite": False}
        if item.get("dueExempt") == CITATION_ONLY
        else {"oc": "corrected" if kind == "compliance" else "none", "on": day, "due": due, "cite": False}
        for item in source["items"]
    }
    visit = {
        "id": rid,
        "sourceDocId": source["id"],
        "caseId": value["case"]["id"],
        "date": day,
        "time": "10:00",
        "inspectorId": "inspector_1",
        "results": results,
    }
    value["events"].append(
        {
            "id": rid + "-event",
            "at": day + "T15:00:00Z",
            "by": "inspector_1",
            "type": "reinspection.recorded",
            "payload": {"reinspection": visit, "lifecycle": 1, "expectedHead": [e["id"] for e in value["events"]]},
        }
    )
    snap = copy.deepcopy(source)
    snap.update(id=kind + "-followup", type=kind, fromDocId=source["id"], fromReinspId=rid, mailed=day, inspDate=day, inspTime="10:00", cits={})
    snap.pop("issuanceGroup", None)
    snap["importInspection"] = {"type": "reinspection", "date": day, "time": "10:00"}
    snap.pop("importRule", None)
    for item in snap["items"]:
        old = item["id"]
        item.update(id=kind + "-" + old, srcItemId=old, cite=False)
        if item.get("dueExempt") == CITATION_ONLY:
            item.update(due="", done=False, doneOn="")
        else:
            item.update(
                done=kind == "compliance", doneOn=day if kind == "compliance" else "", due=source["items"][1]["due"] if kind == "compliance" else due
            )
    value["events"].append(
        {
            "id": kind + "-event",
            "at": day + "T15:00:00.001Z",
            "by": "inspector_1",
            "type": kind + ".issued",
            "payload": {"docId": snap["id"], "snapshot": snap, "lifecycle": 1, "expectedHead": [e["id"] for e in value["events"]]},
        }
    )
    return value


class CitationOnlyClosure(unittest.TestCase):
    def test_store_accepts_complete_atomic_pair_and_retains_retry(self):
        value = citation_only_pair()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            saved = case_store.save_case(root, "101 TEST LANE - QA-LIFE.json", value)
            content = (root / saved["name"]).read_bytes()
            summary = case_projection.projected(saved["file"])[0]
            self.assertEqual(summary["case"]["status"], "Closed")
            self.assertEqual(summary["case"]["closedOn"], "2026-08-01")
            self.assertTrue(summary["documents"][-1]["citationOnlyClosed"])
            violation = summary["violations"][0]
            self.assertFalse(violation["done"])
            self.assertFalse(violation["withdrawn"])
            self.assertEqual(violation["due"], "")
            self.assertEqual(violation["citationClosedOn"], "2026-08-01")
            again = case_store.save_case(root, saved["name"], saved["file"], saved["revision"], saved["file"]["case"], "initial_citation_event")
            self.assertTrue(again["alreadyCommitted"])
            self.assertEqual((root / saved["name"]).read_bytes(), content)

    def test_refuses_blank_without_explicit_disposition(self):
        value = citation_only_pair()
        for event in value["events"]:
            del event["payload"]["snapshot"]["items"][0]["dueExempt"]
        with self.assertRaisesRegex(ValueError, "future due date"):
            case_store.validate_history(value)

    def test_refuses_invalid_or_inconsistent_closure_without_publishing(self):
        for fault in ("dated", "not-cited", "corrected", "reinspection", "unpaired", "snow"):
            value = citation_only_pair()
            notice, citation = [event["payload"]["snapshot"] for event in value["events"]]
            for snapshot in (notice, citation):
                if fault == "dated":
                    snapshot["items"][0]["due"] = "2026-09-01"
                elif fault == "not-cited":
                    snapshot["items"][0]["cite"] = False
                elif fault == "corrected":
                    snapshot["items"][0].update(done=True, doneOn="2026-08-01")
                elif fault == "reinspection":
                    snapshot["importInspection"]["type"] = "reinspection"
            if fault == "unpaired":
                citation["items"][0].pop("dueExempt")
                citation["items"][0]["due"] = "2026-09-01"
            if fault == "snow":
                value["case"]["caseType"] = "snow-10.28"
                for snapshot in (notice, citation):
                    snapshot["frozen"]["case"]["caseType"] = "snow-10.28"
            with self.subTest(fault=fault), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                with self.assertRaises(ValueError):
                    case_store.save_case(root, "101 TEST LANE - QA-LIFE.json", value)
                self.assertFalse(list(root.glob("*.json")), "refusal cannot publish a case")

    def test_browser_helper_projection_and_historical_reports(self):
        value = citation_only_pair()
        corrected = copy.deepcopy(value)
        original = corrected["events"][-1]["payload"]["snapshot"]
        revision = copy.deepcopy(original)
        revision.update(id="corrected-citation", revision={"number": 1, "targetId": original["id"], "rootId": original["id"]})
        corrected["events"].append(
            {
                "id": "correction-event",
                "at": "2026-08-10T15:00:00Z",
                "by": "inspector_1",
                "type": "correction.issued",
                "payload": {"docId": revision["id"], "snapshot": revision, "replaces": original["id"], "reason": "Correct recorded narrative"},
            }
        )
        voided = copy.deepcopy(value)
        voided["events"].append(
            {
                "id": "void-event",
                "at": "2026-08-10T15:00:00Z",
                "by": "inspector_1",
                "type": "document.voided",
                "payload": {"docId": original["id"], "reason": "Synthetic withdrawal"},
            }
        )
        mixed = mixed_pair()
        extended = followup(mixed, "extension", "2026-09-01", "2026-10-01")
        completed = followup(extended, "compliance", "2026-10-01")
        records = [value, corrected, voided, mixed, extended, completed]
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp) / "projections.json"
            inputs = Path(temp) / "records.json"
            inputs.write_text(json.dumps(records))
            result = subprocess.run(
                ["node", "tests/unit/audit_feature_citation_packets.js"],
                cwd=Path(__file__).resolve().parents[2],
                env={**os.environ, "DW_CITATION_RECORDS_FILE": str(inputs), "DW_CITATION_PROJECTIONS": str(output)},
                capture_output=True,
                text=True,
                timeout=120,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            summaries = json.loads(output.read_text())
        for record, browser in zip(records, summaries):
            self.assertEqual(
                case_projection.json_text(case_projection.reportable(browser)), case_projection.json_text(case_projection.projected(record)[0])
            )

    def test_mixed_case_publication_and_two_followups(self):
        value = mixed_pair()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            saved = case_store.save_case(root, "101 TEST LANE - QA-LIFE.json", value)
            summary = case_projection.projected(saved["file"])[0]
            self.assertNotEqual(summary["case"]["status"], "Closed")
            self.assertEqual(summary["violations"][0]["citationClosedOn"], "2026-08-01")
            self.assertEqual(summary["violations"][1]["due"], "2026-09-01")
            for kind, day, due in [("extension", "2026-09-01", "2026-10-01"), ("compliance", "2026-10-01", "")]:
                updated = followup(saved["file"], kind, day, due)
                saved = case_store.save_case(root, saved["name"], updated, saved["revision"], saved["file"]["case"], kind + "-event")
                summary = case_projection.projected(saved["file"])[0]
                self.assertFalse(summary["violations"][0]["done"])
                self.assertFalse(summary["violations"][0]["withdrawn"])
                self.assertEqual(summary["violations"][0]["due"], "")
                self.assertEqual(summary["violations"][0]["citationClosedOn"], "2026-08-01")
                self.assertEqual(len(summary["visits"][-1]["results"]), 1, "closed citation-only item creates no new observation")
            self.assertEqual(summary["case"]["status"], "Closed")
            self.assertEqual(summary["case"]["closedOn"], "2026-10-01")
            self.assertTrue(summary["violations"][1]["done"])

    def test_followup_cannot_change_the_original_disposition_or_reinspect_it(self):
        value = followup(mixed_pair(), "extension", "2026-09-01", "2026-10-01")
        for fault in ["drop", "add", "cite", "date", "observe"]:
            bad = copy.deepcopy(value)
            snapshot = bad["events"][-1]["payload"]["snapshot"]
            if fault == "drop":
                snapshot["items"][0].pop("dueExempt")
                snapshot["items"][0]["due"] = "2026-10-01"
            if fault == "add":
                snapshot["items"][1].update(dueExempt=CITATION_ONLY, due="")
            if fault == "cite":
                snapshot["items"][0]["cite"] = True
            if fault == "date":
                snapshot["items"][0]["due"] = "2026-10-01"
            if fault == "observe":
                bad["events"][-2]["payload"]["reinspection"]["results"]["charged_item"].update(oc="corrected", on="2026-09-01")
            reason = (
                "original citation-only dispositions"
                if fault in ("drop", "add")
                else "without a new observation"
                if fault == "observe"
                else "blank due date"
            )
            with self.subTest(fault=fault), self.assertRaisesRegex(ValueError, reason):
                case_store.validate_history(bad)

    def test_compliance_cannot_close_the_other_unresolved_violation(self):
        value = followup(mixed_pair(), "compliance", "2026-09-01")
        value["events"][-2]["payload"]["reinspection"]["results"]["other_citation"].update(oc="none")
        value["events"][-1]["payload"]["snapshot"]["items"][1].update(done=False, doneOn="")
        with self.assertRaisesRegex(ValueError, "cannot close unresolved items"):
            case_store.validate_history(value)

    def test_lifecycle_and_supported_authoring_are_required_for_new_dispositions(self):
        for target in ("visit", "document"):
            bad = followup(mixed_pair(), "extension", "2026-09-01", "2026-10-01")
            bad["events"][-2 if target == "visit" else -1]["payload"].pop("lifecycle")
            with self.subTest(target=target), self.assertRaisesRegex(ValueError, "reviewed lifecycle"):
                case_store.validate_history(bad)
        bad = citation_only_pair()
        for event in bad["events"]:
            event["payload"]["snapshot"]["authoringVersion"] = 1
        with self.assertRaises(ValueError):
            case_store.validate_history(bad)

    def test_correction_cannot_drop_closure(self):
        original = citation_only_pair()["events"][-1]["payload"]["snapshot"]
        changed = copy.deepcopy(original)
        changed["items"][0].pop("dueExempt")
        changed["items"][0]["due"] = "2026-09-01"
        with self.assertRaisesRegex(ValueError, "retain its closure"):
            case_store._validate_correction_items(original=original, snap=changed, same_type=True, record={"case": original["frozen"]["case"]})

    def test_ordinary_correction_cannot_add_closure(self):
        original = pair()["events"][-1]["payload"]["snapshot"]
        changed = copy.deepcopy(original)
        changed["items"][0].update(due="", dueExempt=CITATION_ONLY)
        with self.assertRaisesRegex(ValueError, "retain its closure"):
            case_store._validate_correction_items(original=original, snap=changed, same_type=True, record={"case": original["frozen"]["case"]})

    def test_existing_occupancy_restriction_blocks_citation_only_closure(self):
        record = citation_only_pair()
        restriction = {"id": "restriction", "type": "noOccupancy", "special": {"mode": "impose"}}
        with self.assertRaisesRegex(ValueError, "every occupancy restriction"):
            case_store.validate_publication(record, record["events"][0], {"restriction": (restriction, {})}, set(), set(), [])

    def test_closed_source_cannot_start_another_physical_visit(self):
        record = citation_only_pair()
        snapshot = record["events"][-1]["payload"]["snapshot"]
        self.assertTrue(citation_only_closed(snapshot))
        with self.assertRaisesRegex(ValueError, "current open case"):
            case_store._validated_visit_source(
                visit={"sourceDocId": snapshot["id"], "id": "later"},
                documents={snapshot["id"]: (snapshot, record["events"][-1])},
                superseded=set(),
                voided=set(),
                visits=[],
            )


if __name__ == "__main__":
    unittest.main()
