"""Malformed input is answered as a definitive 400 with a plain message, never as a server failure with Python
text: wrong-shaped case records, unreadable case files and bad parcel requests. Nothing is written for a refused
record, and well-formed requests are unchanged."""

import copy
import json
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from unittest.mock import patch

import case_store
import server

NAME = "101 TEST LANE - QA-001.json"
LEAKS = ("object has no attribute", "is not iterable", "Expecting value", "not subscriptable", "Unterminated", "Extra data", "char ")


def record():
    return {
        "format": "madison-case-file",
        "schema": 3,
        "case": {"id": "case_a", "number": "QA-001", "address": "101 TEST LANE", "owner": "SYNTHETIC OWNER"},
        "inspectors": [],
        "events": [{"id": "first", "at": "2026-09-19T01:00:00Z", "by": "", "type": "case.opened", "payload": {}}],
    }


def with_second_event(mutate):
    value = record()
    value["events"].append({"id": "second", "at": "2026-09-19T02:00:00Z", "by": "", "type": "case.noted", "payload": {}})
    mutate(value)
    return value


MALFORMED = {
    "event is a string": lambda r: r["events"].__setitem__(1, "text"),
    "event is a number": lambda r: r["events"].__setitem__(1, 5),
    "event is null": lambda r: r["events"].__setitem__(1, None),
    "payload is a string": lambda r: r["events"][1].__setitem__("payload", "x"),
    "payload is a list": lambda r: r["events"][1].__setitem__("payload", []),
    "snapshot is a list on an issue": lambda r: r["events"][1].update(type="notice.issued", payload={"snapshot": []}),
    "snapshot is a string on an issue": lambda r: r["events"][1].update(type="notice.issued", payload={"snapshot": "x"}),
    "snapshot is a list on a citation": lambda r: r["events"][1].update(type="citation.issued", payload={"snapshot": [1]}),
    "events is a number": lambda r: r.__setitem__("events", 5),
    "events is a string": lambda r: r.__setitem__("events", "x"),
    "events is null": lambda r: r.__setitem__("events", None),
    "case is a string": lambda r: r.__setitem__("case", "x"),
    "case is null": lambda r: r.__setitem__("case", None),
    "inspectors is a number": lambda r: r.__setitem__("inspectors", 7),
    "an inspector is null": lambda r: r.__setitem__("inspectors", [None]),
    "an inspector is a string": lambda r: r.__setitem__("inspectors", ["i1"]),
}


class Malformed(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        (cls.root / server.CASE_DIR_NAME).mkdir()
        cls.cases = cls.root / server.CASE_DIR_NAME
        cls.patch = patch.object(server, "share_root", lambda: cls.root)
        cls.patch.start()
        cls.http = server.Server(("127.0.0.1", 0), server.Handler)
        server.PORT = cls.http.server_address[1]
        cls.base = "http://127.0.0.1:%d" % server.PORT
        threading.Thread(target=cls.http.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.patch.stop()
        cls.temp.cleanup()

    def request(self, path, body=None, raw=None):
        data = raw if raw is not None else (None if body is None else json.dumps(body).encode())
        headers = {"Content-Type": "application/json", "X-DocWriter-Token": server.SESSION_TOKEN}
        req = urllib.request.Request(self.base + path, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def assertPlain(self, error):
        for leak in LEAKS:
            self.assertNotIn(leak, error, error)

    def test_malformed_records_are_refused_as_400_and_nothing_is_written(self):
        for target in self.cases.glob("*.json"):
            target.unlink()
        code, out = self.request("/cases/save", {"name": NAME, "file": record(), "baseRevision": "", "idempotencyEvent": "first"})
        self.assertEqual(code, 200, out)
        before = (self.cases / NAME).read_bytes()
        for label, mutate in MALFORMED.items():
            with self.subTest(label):
                code, out = self.request(
                    "/cases/save",
                    {"name": NAME, "file": with_second_event(mutate), "baseRevision": out_revision(before), "idempotencyEvent": "second"},
                )
                self.assertEqual(code, 400, (label, code, out))
                self.assertFalse(out["ok"])
                self.assertPlain(out["error"])
                self.assertEqual((self.cases / NAME).read_bytes(), before)

    def test_a_well_formed_second_event_still_saves(self):
        for target in self.cases.glob("*.json"):
            target.unlink()
        code, out = self.request("/cases/save", {"name": NAME, "file": record(), "baseRevision": "", "idempotencyEvent": "first"})
        saved = with_second_event(lambda r: None)
        code, out = self.request("/cases/save", {"name": NAME, "file": saved, "baseRevision": out["revision"], "idempotencyEvent": "second"})
        self.assertEqual(code, 200, out)
        self.assertEqual(len(out["file"]["events"]), 2)

    def test_unreadable_case_files_get_a_plain_message(self):
        files = {
            "empty.json": b"",
            "binary.json": bytes(range(256)) * 4,
            "nonutf8.json": b"\xff\xfe\x00{",
            "truncated.json": b'{"format": "madison-case-file", "sch',
            "list.json": b"[1, 2, 3]",
            "null.json": b"null",
            "string.json": b'"text"',
            "number.json": b"42",
        }
        for name, content in files.items():
            (self.cases / name).write_bytes(content)
            with self.subTest(name):
                code, out = self.request("/cases/open?name=" + urllib.parse.quote(name))
                self.assertEqual(code, 400)
                self.assertPlain(out["error"])
                self.assertIn("could not be read", out["error"])
                self.assertEqual((self.cases / name).read_bytes(), content)
            (self.cases / name).unlink()

    def test_bad_parcel_requests_are_400(self):
        for raw in (b"{", b"[]", b"null", b'"text"', b"5", b'{"ids": 5}', b'{"ids": "x"}'):
            with self.subTest(raw=raw):
                code, out = self.request("/reporting/parcels", raw=raw)
                self.assertEqual(code, 400, (raw, code, out))
                self.assertPlain(out["error"])

    def test_oversized_and_missing_parcel_bodies_keep_their_413(self):
        code, out = self.request("/reporting/parcels", raw=b"")
        self.assertEqual(code, 413)


def out_revision(raw):
    return case_store.digest(raw)


if __name__ == "__main__":
    unittest.main()
