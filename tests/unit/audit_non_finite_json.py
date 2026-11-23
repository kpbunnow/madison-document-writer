"""NaN and Infinity never enter the helper: requests refuse them and no case file is written with them (synthetic)."""

import json
from pathlib import Path
import tempfile
import unittest
import threading
import urllib.error
import urllib.parse
import urllib.request
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

    def test_stored_case_overflow_is_refused_without_rewriting_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / NAME
            for token in ["NaN", "Infinity", "-Infinity", "1e309", "-1e309", "9" * 400]:
                raw = json.dumps(record(extra="NUMBER")).replace('"NUMBER"', token).encode("utf-8")
                target.write_bytes(raw)
                with self.subTest(token=token):
                    with self.assertRaisesRegex(ValueError, "could not be read as a Madison case record"):
                        case_store.read_case(root, NAME)
                    self.assertEqual(target.read_bytes(), raw)
                    with self.assertRaises(ValueError) as raised:
                        case_store.citation_history(root)
                    self.assertIn(NAME, case_store.history_refusal(raised.exception))
                    self.assertEqual(target.read_bytes(), raw)

    def test_stored_finite_values_bom_and_number_types_remain_readable(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            raw = b"\xef\xbb\xbf" + json.dumps(record(extra={"integer": 42, "largest": 1.7976931348623157e308, "tiny": 1e-300})).encode("utf-8")
            (root / NAME).write_bytes(raw)
            value = case_store.read_case(root, NAME)["file"]["case"]["extra"]
            self.assertIs(type(value["integer"]), int)
            self.assertEqual(value, {"integer": 42, "largest": 1.7976931348623157e308, "tiny": 1e-300})
            self.assertEqual((root / NAME).read_bytes(), raw)

    def test_http_open_resolve_and_history_refuse_stored_overflow_as_readable_json(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(server, "case_dir", return_value=Path(folder)):
            root = Path(folder)
            raw = json.dumps(record(extra="NUMBER")).replace('"NUMBER"', "1e309").encode("utf-8")
            (root / NAME).write_bytes(raw)
            httpd = server.Server(("127.0.0.1", 0), server.Handler)
            worker = threading.Thread(target=httpd.serve_forever, daemon=True)
            worker.start()
            try:
                base = "http://127.0.0.1:" + str(httpd.server_address[1])
                for route in ["/cases/open?name=" + urllib.parse.quote(NAME), "/cases/resolve?number=QA-001", "/citations/history"]:
                    with self.subTest(route=route):
                        request = urllib.request.Request(base + route, headers={"X-DocWriter-Token": server.SESSION_TOKEN})
                        with self.assertRaises(urllib.error.HTTPError) as raised:
                            urllib.request.urlopen(request, timeout=5)
                        response = raised.exception
                        self.assertEqual(response.code, 400)
                        with response:
                            payload = json.loads(response.read(), parse_constant=lambda value: self.fail("nonfinite response: " + value))
                        self.assertFalse(payload["ok"])
                        self.assertIn("could not be read", payload["error"])
                        self.assertEqual((root / NAME).read_bytes(), raw)
            finally:
                httpd.shutdown()
                httpd.server_close()
                worker.join(timeout=5)
                self.assertFalse(worker.is_alive())

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
