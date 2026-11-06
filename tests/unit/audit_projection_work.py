"""One continuing-item calculation per helper summary; full retained output and fresh requests remain equal."""

import copy
from pathlib import Path
import unittest
from unittest.mock import Mock, patch
import case_projection as cp
from audit_helper import record


class ProjectionWorkTests(unittest.TestCase):
    def test_one_calculation_and_fresh_results(self):
        legacy = cp.__dict__.copy()
        source = Path(__file__).resolve().parents[1] / "fixtures/case_projection_py_reference.txt"
        exec(compile(source.read_text(), "retained_projection", "exec"), legacy)
        original = cp.continuing_items
        legacy["continuing_items"] = Mock(wraps=original)
        for size in [25, 100]:
            value = record()
            items = [
                {
                    "id": "item-" + str(n),
                    "no": str(n + 1),
                    "title": "Synthetic repair",
                    "text": "Retain order wording",
                    "sections": ["27.05(2)(c)"],
                    "due": "2026-12-01",
                }
                for n in range(size)
            ]
            notice = {
                "id": "notice",
                "caseId": value["case"]["id"],
                "type": "notice",
                "authoringVersion": 16,
                "mailed": "2026-01-03",
                "items": items,
                "cits": {},
            }
            value["events"].append({"id": "issued", "type": "notice.issued", "at": "2026-01-03T12:00:00Z", "payload": {"snapshot": notice}})
            for n in range(8):
                date = "2026-02-0" + str(n + 1)
                visit = {
                    "id": "visit-" + str(n),
                    "caseId": value["case"]["id"],
                    "sourceDocId": "notice",
                    "date": date,
                    "results": {it["id"]: {"oc": "corrected" if n == 7 and q % 3 == 0 else "outstanding"} for q, it in enumerate(items)},
                }
                value["events"].append(
                    {"id": "visit-event-" + str(n), "type": "reinspection.recorded", "at": date + "T12:00:00Z", "payload": {"reinspection": visit}}
                )
            before = copy.deepcopy(value)
            legacy["continuing_items"].reset_mock()
            with patch.object(cp, "continuing_items", wraps=original) as work:
                actual = cp.plain(cp.project(value))
                self.assertEqual(actual, cp.plain(legacy["project"](value)))
                self.assertEqual(value, before)
                self.assertEqual(work.call_count, 1)
                self.assertEqual(legacy["continuing_items"].call_count, size)
                self.assertTrue(actual["violations"][0]["done"])
                value["events"][-1]["payload"]["reinspection"]["results"]["item-0"]["oc"] = "outstanding"
                fresh = cp.plain(cp.project(value))
                self.assertFalse(fresh["violations"][0]["done"])
                self.assertEqual(work.call_count, 2)
                self.assertEqual(fresh, cp.plain(legacy["project"](value)))


if __name__ == "__main__":
    unittest.main()
