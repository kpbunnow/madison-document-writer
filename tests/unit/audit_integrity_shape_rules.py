"""Malformed integrity metadata makes one case invalid, never the whole Reports index: the verifier answers a
failed verdict for wrong-shaped structures, and the index reader isolates any single case file it cannot process."""

import copy
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import case_integrity
import case_store
import server

DAMAGE = {
    "genesis is a list": lambda i: i.__setitem__("genesis", []),
    "genesis is a string": lambda i: i.__setitem__("genesis", "x"),
    "genesis is null": lambda i: i.__setitem__("genesis", None),
    "entries is a number": lambda i: i.__setitem__("entries", 5),
    "an entry is a string": lambda i: i.__setitem__("entries", ["x"]),
    "an entry is null": lambda i: i.__setitem__("entries", [None]),
    "commits is a string": lambda i: i.__setitem__("commits", "x"),
    "a commit is a list": lambda i: i.__setitem__("commits", [[]]),
    "a commit context is a string": lambda i: i["commits"][-1].__setitem__("context", "x"),
    "event ids is a number": lambda i: i["genesis"].__setitem__("eventIds", 3),
    "genesis event ids hold lists": lambda i: i["genesis"].__setitem__("eventIds", [[]]),
}


def record(number="QA-001", case_id="case_a", event="first"):
    return {
        "format": "madison-case-file",
        "schema": 3,
        "case": {"id": case_id, "number": number, "address": "101 TEST LANE", "owner": "SYNTHETIC OWNER"},
        "inspectors": [],
        "events": [{"id": event, "at": "2026-09-19T01:00:00Z", "by": "", "type": "case.opened", "payload": {}}],
    }


class IntegrityShapes(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.count = 0
        self.fresh()
        self.patches = [
            patch.object(server, "HERE", self.root),
            patch.object(server, "share_root", lambda: self.root / "share"),
            patch.dict(os.environ, {"DW_CASE_DIR": str(self.cases)}),
        ]
        for p in self.patches:
            p.start()

    def fresh(self):
        """A new case folder for each scenario: one damaged case blocks writes to its own folder by design."""
        self.count += 1
        self.cases = self.root / ("cases%d" % self.count)
        self.cases.mkdir()
        os.environ["DW_CASE_DIR"] = str(self.cases)

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.temp.cleanup()

    def saved(self, number, case_id, event):
        name = "TEST - %s.json" % number
        value = record(number, case_id, event)
        value["schema"] = 5
        result = case_store.save_case(self.cases, name, value)
        assert "integrity" in result["file"], "a schema-5 save carries its integrity record"
        case_store.save_summary(self.cases, name, result["revision"], {"format": "madison-case-summary", "case": {"number": number}})
        return name, result

    def planted(self, number, case_id, event, change):
        """A schema-5 case the migration registry has never seen, damaged and given a summary naming its exact bytes."""
        value = record(number, case_id, event)
        value["schema"] = 5
        value = case_integrity.commit_record(None, value)
        change(value["integrity"])
        raw = json.dumps(value).encode("utf-8")
        name = "TEST - %s.json" % number
        (self.cases / name).write_bytes(raw)
        index_folder = self.cases / "Reporting Index"
        index_folder.mkdir(exist_ok=True)
        summary = {"format": "madison-case-summary", "case": {"number": number}, "sourceFile": name, "sourceRevision": case_store.digest(raw)}
        (index_folder / (number.lower() + ".json")).write_text(json.dumps(summary), encoding="utf-8")
        return name

    def test_wrong_shaped_integrity_is_an_invalid_verdict_not_an_exception(self):
        name, saved = self.saved("QA-001", "case_a", "first")
        for label, change in DAMAGE.items():
            with self.subTest(label):
                value = copy.deepcopy(saved["file"])
                change(value["integrity"])
                verdict = case_integrity.verify_record(value, self.cases)
                self.assertFalse(verdict["valid"], label)
                self.assertNotIn("has no attribute", json.dumps(verdict))

    def test_the_index_keeps_healthy_cases_when_one_case_has_malformed_integrity(self):
        for label, change in DAMAGE.items():
            with self.subTest(label):
                self.fresh()
                self.saved("QA-001", "case_a", "first")
                broken = self.planted("QA-002", "case_b", "second", change)
                index = server.read_index()
                self.assertTrue(index["ok"], index)
                self.assertEqual([s["case"]["number"] for s in index["summaries"]], ["QA-001"])
                self.assertTrue(any("qa-002" in line for line in index["unreadable"]), (label, index["unreadable"]))

    def test_an_unexpected_error_from_one_case_is_isolated_by_the_index_reader(self):
        self.saved("QA-001", "case_a", "first")
        broken, _ = self.saved("QA-002", "case_b", "second")
        original = case_integrity.verify_record

        def flaky(value, *args, **kwargs):
            if value.get("case", {}).get("number") == "QA-002":
                raise AttributeError("synthetic unexpected failure")
            return original(value, *args, **kwargs)

        with patch.object(case_integrity, "verify_record", flaky):
            index = server.read_index()
        self.assertTrue(index["ok"], index)
        self.assertEqual([s["case"]["number"] for s in index["summaries"]], ["QA-001"])
        self.assertEqual(len(index["unreadable"]), 1)
        self.assertIn("qa-002", index["unreadable"][0])


if __name__ == "__main__":
    unittest.main()
