"""NaN and Infinity never enter the helper: requests refuse them and no case file is written with them (synthetic)."""

import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import case_store
import server

NAME = "101 TEST LANE - QA-001.json"


def record(**case):
    return {
        "format": "madison-case-file",
        "schema": 3,
        "case": {"id": "case_a", "number": "QA-001", "address": "101 TEST LANE", "owner": "SYNTHETIC OWNER", **case},
        "inspectors": [],
        "events": [{"id": "first", "at": "2026-09-19T01:00:00Z", "by": "", "type": "case.opened", "payload": {}}],
    }


class NonFiniteJson(unittest.TestCase):
    def test_requests_refuse_non_finite_numbers(self):
        self.assertEqual(server.request_json(b'{"x": 1.5, "y": [0, -2e3]}'), {"x": 1.5, "y": [0, -2000.0]})
        for token in ["NaN", "Infinity", "-Infinity", "1e309", "-1e309", "9" * 400]:
            with self.subTest(token=token), self.assertRaises(ValueError):
                server.request_json(('{"measurements": {"diameter": ' + token + "}}").encode())

    def test_valid_numeric_types_and_boundary_values_are_preserved(self):
        value = server.request_json(b'{"integer":42,"largest":1.7976931348623157e308,"tiny":1e-300,"text":"1e309"}')
        self.assertIs(type(value["integer"]), int)
        self.assertEqual(value["integer"], 42)
        self.assertEqual(value["largest"], float.fromhex("0x1.fffffffffffffp+1023"))
        self.assertEqual(value["tiny"], 1e-300)
        self.assertEqual(value["text"], "1e309")

    def test_no_case_file_is_written_with_non_finite_numbers(self):
        # Before this check a schema-3 record kept NaN/Infinity tokens that a browser's JSON.parse cannot read.
        with tempfile.TemporaryDirectory() as folder:
            for value in [float("nan"), float("inf"), float("-inf")]:
                with self.subTest(value=value), self.assertRaises(ValueError):
                    case_store.save_case(Path(folder), NAME, record(extra=value))
                self.assertFalse((Path(folder) / NAME).exists())
            case_store.save_case(Path(folder), NAME, record(extra=1.5))
            json.loads((Path(folder) / NAME).read_text(encoding="utf-8"), parse_constant=lambda c: self.fail(c))

    def test_recovery_writer_refuses_non_finite_data_before_creating_a_backup(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(server, "BACKUP_ROOT", Path(folder)):
            workspace, case = "a" * 32, "b" * 32
            payload = {"format": "madison-draft-recovery", "version": 1, "workspace": workspace, "case": case}
            for value in [float("inf"), float("-inf"), float("nan")]:
                with self.subTest(value=value), self.assertRaises(ValueError):
                    server.backup_write({"workspace": workspace, "case": case, "backup": {**payload, "extra": value}})
                self.assertFalse(list(Path(folder).rglob("*.json")))
            saved = server.backup_write({"workspace": workspace, "case": case, "backup": {**payload, "extra": 1.5}})
            raw = (Path(folder) / workspace / case / saved["name"]).read_text(encoding="utf-8")
            self.assertEqual(json.loads(raw)["extra"], 1.5)

    def test_money_and_ordinances_use_ascii_digits(self):
        self.assertEqual(case_store._citation_amount("110.00"), case_store.Decimal("110.00"))
        for value in ["1١٠", "１０", "1٠.00"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                case_store._citation_amount(value)


if __name__ == "__main__":
    unittest.main()
