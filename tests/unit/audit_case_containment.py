"""Case files are plain files inside the case folder: links and non-regular entries are never read, listed,
resolved, indexed or written through, while ordinary case files work as before."""

import json
import os
from pathlib import Path
import shutil
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


def record(number="QA-001", case_id="case_a"):
    return {
        "format": "madison-case-file",
        "schema": 3,
        "case": {"id": case_id, "number": number, "address": "101 TEST LANE", "owner": "SYNTHETIC OWNER"},
        "inspectors": [],
        "events": [{"id": "first", "at": "2026-09-19T01:00:00Z", "by": "", "type": "case.opened", "payload": {}}],
    }


class Containment(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name) / "share"
        cls.outside = Path(cls.temp.name) / "outside"
        cls.root.mkdir()
        cls.outside.mkdir()
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

    def setUp(self):
        shutil.rmtree(self.cases)
        self.cases.mkdir()

    def request(self, path, body=None):
        data = None if body is None else json.dumps(body).encode()
        headers = {"Content-Type": "application/json", "X-DocWriter-Token": server.SESSION_TOKEN}
        req = urllib.request.Request(self.base + path, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def link(self, name="linked.json", value=None):
        target = self.outside / "elsewhere.json"
        target.write_text(json.dumps(value or record("OUT-999", "case_out")), encoding="utf-8")
        os.symlink(target, self.cases / name)
        return target

    def test_a_linked_case_file_is_not_opened(self):
        self.link()
        code, out = self.request("/cases/open?name=linked.json")
        self.assertEqual(code, 400)
        self.assertNotIn("file", out)
        self.assertIn("link", out["error"].lower())
        with self.assertRaises(ValueError):
            case_store.read_case(self.cases, "linked.json")

    def test_a_linked_case_file_is_not_listed_resolved_or_indexed(self):
        self.link("linked - OUT-999.json")
        case_store.save_case(self.cases, NAME, record())
        code, out = self.request("/cases/list")
        self.assertEqual([f["name"] for f in out["files"]], [NAME])
        code, out = self.request("/cases/resolve?number=OUT-999")
        self.assertEqual(code, 404)
        code, out = self.request("/cases/search?q=OUT-999")
        self.assertEqual(out.get("hits", []), [])
        code, out = self.request("/reporting/index")
        self.assertEqual(code, 200)
        self.assertNotIn("OUT-999", json.dumps(out))

    def test_saving_through_a_link_is_refused_and_the_target_is_untouched(self):
        target = self.link("linked - QA-002.json", record("QA-002", "case_b"))
        before = target.read_bytes()
        with self.assertRaises(ValueError):
            case_store.save_case(self.cases, "linked - QA-002.json", record("QA-002", "case_b"))
        self.assertEqual(target.read_bytes(), before)

    def test_a_directory_named_like_a_case_file_is_not_a_case(self):
        (self.cases / "folder - QA-003.json").mkdir()
        code, out = self.request("/cases/list")
        self.assertEqual(out["files"], [])
        code, out = self.request("/cases/open?name=" + urllib.parse.quote("folder - QA-003.json"))
        self.assertEqual(code, 400)
        (self.cases / "folder - QA-003.json").rmdir()

    def test_ordinary_case_files_still_work(self):
        case_store.save_case(self.cases, NAME, record())
        code, out = self.request("/cases/open?name=" + urllib.parse.quote(NAME))
        self.assertEqual(code, 200)
        self.assertEqual(out["file"]["case"]["number"], "QA-001")
        code, out = self.request("/cases/resolve?number=QA-001")
        self.assertEqual(code, 200)
        code, out = self.request("/cases/list")
        self.assertEqual([f["name"] for f in out["files"]], [NAME])


if __name__ == "__main__":
    unittest.main()
