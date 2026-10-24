"""Search, selected PDF filing, shared views and draft-only reminder checks."""

import hashlib
import json
import re
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import workflow_helper as workflow
import server


class WorkflowToolsTests(unittest.TestCase):
    def test_every_frontend_report_can_share_a_view(self):
        source = (Path(__file__).resolve().parents[2] / "app/modules/reports_core.js").read_text(encoding="utf-8")
        reports = set(re.findall(r'^    id: "([^"]+)",', source, re.M))
        self.assertEqual(len(reports), 11)
        self.assertEqual(reports, workflow.REPORTS, "frontend reports and helper shared-view rules must agree")
        for report in reports:
            with self.subTest(report=report):
                view = dict(
                    format="madison-report-view",
                    version=1,
                    id="qa-" + report,
                    name="Synthetic report view",
                    report=report,
                    filters={},
                    view="table",
                    dateMode="all",
                )
                workflow.save_view(self.cases, view)
                self.assertIn(view, workflow.shared_views(self.cases)["views"])

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.cases = self.root / "cases"
        self.cases.mkdir()
        self.local = self.root / "local"
        self.local.mkdir()
        self.share = self.root / "share"
        self.share.mkdir()
        self.patches = [patch.object(server, "HERE", self.local), patch.object(server, "share_root", return_value=self.share)]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.temp.cleanup()

    def case(self):
        return {
            "format": "madison-case-file",
            "schema": 3,
            "case": {"id": "qa-search", "number": "QA-SEARCH", "address": "Current street", "owner": "Current owner"},
            "events": [
                {
                    "id": "citation1",
                    "type": "citation.issued",
                    "payload": {
                        "snapshot": {
                            "frozen": {"case": {"address": "Former address", "owner": "Former owner"}},
                            "cits": {"item": {"num": "CIT-4321"}},
                        }
                    },
                }
            ],
            "inspectors": [],
        }

    def test_readonly_search_citations_historical_details_duplicates(self):
        raw = json.dumps(self.case())
        p = self.cases / "Current street - QA-SEARCH.json"
        p.write_text(raw)
        for query in ("cit-4321", "former owner", "former address", "current street"):
            found = workflow.search_cases(self.cases, query)
            self.assertEqual(len(found["hits"]), 1)
        self.assertEqual(p.read_text(), raw)
        (self.cases / "Duplicate - QA-SEARCH.json").write_text(raw)
        self.assertTrue(workflow.search_cases(self.cases, "cit-4321")["hits"][0]["duplicate"])
        (self.cases / "unreadable.json").write_text("{")
        self.assertEqual(workflow.search_cases(self.cases, "current")["unreadable"], 1)

    def pdf(self, name, raw=b"%PDF-1.4\nTest bytes"):
        directory = self.local / server.OUTDIR_NAME
        directory.mkdir(exist_ok=True)
        (directory / name).write_bytes(raw)
        return {"name": name, "sha256": hashlib.sha256(raw).hexdigest()}

    def test_selected_sync_only_and_hash_failure_before_any_move(self):
        first = self.pdf("first.pdf")
        second = self.pdf("second.pdf")
        with self.assertRaises(ValueError):
            workflow.sync_selected(server, {"items": [first, {**second, "sha256": "0" * 64}]})
        self.assertTrue((self.local / server.OUTDIR_NAME / "first.pdf").exists())
        result = workflow.sync_selected(server, {"items": [first]})
        self.assertEqual(result["result"]["moved"], 1)
        self.assertTrue((self.local / server.OUTDIR_NAME / "second.pdf").exists())
        self.assertTrue((self.share / server.OUTDIR_NAME / "first.pdf").exists())

    def test_different_shared_copy_preserves_local_bytes(self):
        first = self.pdf("first.pdf")
        dest = self.share / server.OUTDIR_NAME
        dest.mkdir()
        (dest / "first.pdf").write_bytes(b"%PDF-conflict")
        result = workflow.sync_selected(server, {"items": [first]})
        self.assertEqual(result["result"]["conflicts"], ["first.pdf"])
        self.assertTrue((self.local / server.OUTDIR_NAME / "first.pdf").exists())
        self.assertEqual((dest / "first.pdf").read_bytes(), b"%PDF-conflict")

    def test_shared_view_is_immutable_and_validated(self):
        view = {
            "format": "madison-report-view",
            "version": 1,
            "id": "qa-view",
            "name": "QA saved view",
            "report": "openCases",
            "filters": {"areas": [], "owner": ""},
            "view": "table",
            "dateMode": "month",
        }
        workflow.save_view(self.cases, view)
        self.assertEqual(workflow.shared_views(self.cases)["views"], [view])
        workflow.save_view(self.cases, view)
        with self.assertRaises(ValueError):
            workflow.save_view(self.cases, {**view, "name": "Overwrite"})
        with self.assertRaises(ValueError):
            workflow.save_view(self.cases, {**view, "id": "../escape"})
        with self.assertRaises(ValueError):
            workflow.save_view(self.cases, {**view, "report": "invalid"})

    def test_reminder_opens_draft_without_attachment_or_send(self):
        data = {"to": "qa@example.invalid", "subject": "Upcoming due date", "body": "Review this draft."}
        with patch.object(server, "find_outlook", return_value="test-outlook"), patch.object(server, "open_in_outlook") as draft:
            workflow.reminder_draft(server, data)
            draft.assert_called_once_with(None, data["subject"], data["body"], data["to"])
            with self.assertRaises(ValueError):
                workflow.reminder_draft(server, {**data, "to": "one@example.invalid;two@example.invalid"})
            with self.assertRaises(ValueError):
                workflow.reminder_draft(server, {**data, "subject": "Bad\nHeader"})


if __name__ == "__main__":
    unittest.main()
