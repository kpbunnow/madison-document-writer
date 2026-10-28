"""Trace scan ordering independently; unchanged real-store/integrity suites protect actual trust."""

import copy
import json
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import case_store

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = case_store.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/citation_history_reference.txt").read_text(encoding="utf-8"), "citation_history_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["citation_history"]


def outcome(check, exclude):
    try:
        return ("result", check("synthetic-scan", exclude))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class CitationHistoryRules(unittest.TestCase):
    def test_effective_snapshots_and_scan_refusal_order(self):
        rng = random.Random(20261028)
        calls = []

        class File:
            def __init__(self, name, content):
                self.name, self.content = name, content

            def __lt__(self, other):
                return self.name < other.name

            def read_text(self, **kwargs):
                calls.append(("read", self.name, kwargs))
                return self.content

        class Folder:
            available = True
            files = []

            def is_dir(self):
                calls.append(("is_dir",))
                return self.available

            def glob(self, pattern):
                calls.append(("glob", pattern))
                return self.files

        folder, context = Folder(), object()

        def make_context(root):
            self.assertIs(root, folder)
            calls.append(("context",))
            return context

        def validate(value, **kwargs):
            calls.append(("validate", copy.deepcopy(value), kwargs))
            if value.get("invalidShape"):
                raise ValueError("synthetic invalid shape")

        def verify(value, root, retained):
            self.assertEqual(root, "synthetic-scan")
            self.assertIs(retained, context)
            calls.append(("verify", copy.deepcopy(value)))
            if value.get("invalidIntegrity"):
                raise ValueError("synthetic invalid integrity")

        def path(unused):
            return folder

        NAMESPACE.update(Path=path, validate_case=validate)
        with (
            patch.object(case_store, "Path", path),
            patch.object(case_store, "validate_case", validate),
            patch.object(case_store.case_integrity, "VerificationContext", make_context),
            patch.object(case_store.case_integrity, "require_valid", verify),
        ):
            for index in range(3000):
                record = {"case": {"number": "QA-ONE"}, "events": []}
                for event_index in range(rng.randrange(0, 6)):
                    identity = rng.choice(("first", "second", "third"))
                    snapshot = {"id": identity, "type": rng.choice(("notice", "citation")), "frozen": {"case": {"number": "frozen-case"}}}
                    event = {
                        "id": str(event_index),
                        "at": "2026-10-27T12:00:00Z",
                        "type": rng.choice(("citation.issued", "notice.issued", "correction.issued", "document.voided", "document.annotated")),
                        "payload": {"snapshot": snapshot, "docId": identity},
                    }
                    if event_index % 2:
                        event["payload"]["replaces"] = rng.choice(("first", "second", "third"))
                    record["events"].append(event)
                if index % 5 == 0:
                    record["invalidShape"] = True
                if index % 7 == 0:
                    record["invalidIntegrity"] = True
                content = json.dumps(record)
                folder.files = [File("z.json", content), File("_ignored.json", "invalid JSON ignored")]
                if index % 3 == 0:
                    folder.files.append(File("a.json", content))
                if index % 11 == 0:
                    folder.files[0].content = "{broken"
                folder.available = bool(index % 13)
                exclude = "qa-one" if index % 2 else ""
                before = [(file.name, file.content) for file in folder.files]
                calls.clear()
                expected = outcome(LEGACY, exclude)
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(case_store.citation_history, exclude), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual([(file.name, file.content) for file in folder.files], before)
                    self.assertFalse(any(call[:2] == ("read", "_ignored.json") for call in calls))


if __name__ == "__main__":
    unittest.main()
