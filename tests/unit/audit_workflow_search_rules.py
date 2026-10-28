"""Search phases preserve bounded reads, historical terms, duplicate flags and refusals."""

import copy
import json
from pathlib import Path
import random
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import workflow_helper
import audit_workflow_tools as workflow_fixtures

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = workflow_helper.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/workflow_search_reference.txt").read_text(encoding="utf-8"), "workflow_search_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["search_cases"]


def outcome(check, query):
    try:
        return ("result", check("synthetic-search", query))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class WorkflowSearchRules(unittest.TestCase):
    def test_generated_terms_reads_and_limits(self):
        rng = random.Random(20261028)
        calls = []

        class File:
            def __init__(self, name, raw, size=1):
                self.name, self.raw, self.size = name, raw, size
                self.stem = Path(name).stem

            def __lt__(self, other):
                return self.name < other.name

            def stat(self):
                calls.append(("stat", self.name))
                return SimpleNamespace(st_size=self.size)

            def read_bytes(self):
                calls.append(("read", self.name))
                return self.raw

        class Folder:
            available = True
            files = []

            def is_dir(self):
                calls.append(("is_dir",))
                return self.available

            def glob(self, pattern):
                calls.append(("glob", pattern))
                return self.files

        folder = Folder()
        original_validate = workflow_helper.validate_case

        def path(unused):
            return folder

        def validate(record, **kwargs):
            calls.append(("validate", copy.deepcopy(record), kwargs))
            return original_validate(record, **kwargs)

        NAMESPACE.update(Path=path, validate_case=validate)
        with patch.object(workflow_helper, "Path", path), patch.object(workflow_helper, "validate_case", validate):
            for index in range(3000):
                record = workflow_fixtures.WorkflowToolsTests().case()
                if index % 3:
                    snapshot = record["events"][0]["payload"]["snapshot"]
                    snapshot["frozen"]["case"][rng.choice(("address", "owner"))] = rng.choice((None, "", "Straße 雪", "Former owner", 42))
                    snapshot["cits"]["item"] = rng.choice((None, {}, {"num": "QA-SECOND"}, "malformed"))
                if index % 5 == 0:
                    record["events"][0]["payload"]["snapshot"]["frozen"]["case"] = None
                raw = json.dumps(record).encode("utf-8")
                folder.files = [File("z - QA-SEARCH.json", raw), File("_ignored.json", b"{broken")]
                if index % 7 == 0:
                    folder.files.append(File("a - QA-SEARCH.json", raw))
                if index % 11 == 0:
                    folder.files[0].size = 32 * 1024 * 1024 + 1
                if index % 13 == 0:
                    folder.files[0].raw = b"{broken"
                folder.available = bool(index % 17)
                query = rng.choice((None, "", "x", "  QA  ", "current", "former", "cit-4321", "strasse", "雪", "x" * 201))
                before = [(file.name, file.raw, file.size) for file in folder.files]
                calls.clear()
                expected = outcome(LEGACY, query)
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(workflow_helper.search_cases.__wrapped__, query), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual([(file.name, file.raw, file.size) for file in folder.files], before)
            folder.available = True
            raw = json.dumps(workflow_fixtures.WorkflowToolsTests().case()).encode("utf-8")
            folder.files = [File(f"{index:05d} - QA-SEARCH.json", raw) for index in range(5001)]
            expected = outcome(LEGACY, "current")
            calls.clear()
            actual = outcome(workflow_helper.search_cases.__wrapped__, "current")
            self.assertEqual(actual, expected)
            self.assertEqual(sum(call[0] == "stat" for call in calls), 5000)
            self.assertTrue(actual[1]["partial"])
            self.assertEqual(len(actual[1]["hits"]), 100)
            self.assertTrue(all(hit["duplicate"] for hit in actual[1]["hits"]))


if __name__ == "__main__":
    unittest.main()
