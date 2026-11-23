"""NaN and Infinity never enter the helper: requests refuse them and no case file is written with them (synthetic)."""

import json
from pathlib import Path
import tempfile
import unittest

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
        for token in ["NaN", "Infinity", "-Infinity"]:
            with self.subTest(token=token), self.assertRaises(ValueError):
                server.request_json(('{"measurements": {"diameter": ' + token + "}}").encode())

    def test_no_case_file_is_written_with_non_finite_numbers(self):
        # Before this check a schema-3 record kept NaN/Infinity tokens that a browser's JSON.parse cannot read.
        with tempfile.TemporaryDirectory() as folder:
            for value in [float("nan"), float("inf"), float("-inf")]:
                with self.subTest(value=value), self.assertRaises(ValueError):
                    case_store.save_case(Path(folder), NAME, record(extra=value))
                self.assertFalse((Path(folder) / NAME).exists())
            case_store.save_case(Path(folder), NAME, record(extra=1.5))
            json.loads((Path(folder) / NAME).read_text(encoding="utf-8"), parse_constant=lambda c: self.fail(c))

    def test_money_and_ordinances_use_ascii_digits(self):
        self.assertEqual(case_store._citation_amount("110.00"), case_store.Decimal("110.00"))
        for value in ["1١٠", "１０", "1٠.00"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                case_store._citation_amount(value)


if __name__ == "__main__":
    unittest.main()
