"""Case files are plain files inside the case folder: links and non-regular entries are never read, listed,
resolved, indexed or written through, while ordinary case files work as before."""

import json
import os
from pathlib import Path
import shutil
import tempfile
import threading
import unittest
import ctypes
import sys
from types import SimpleNamespace
from unittest.mock import Mock
import urllib.error
import urllib.parse
import urllib.request
from unittest.mock import patch

import case_store
import server
import plain_files

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
    def test_descriptors_close_when_a_read_is_refused_or_stream_creation_fails(self):
        target = self.cases / "directory.json"
        target.mkdir()
        opened = []
        original = os.open

        def tracked(path, *args, **kwargs):
            fd = original(path, *args, **kwargs)
            opened.append(fd)
            return fd

        with patch.object(plain_files.os, "open", side_effect=tracked):
            with self.assertRaises(ValueError):
                plain_files.read_plain_bytes(target)
        with self.assertRaises(OSError):
            os.fstat(opened[-1])
        target.rmdir()
        target.write_bytes(b"ordinary file")
        with (
            patch.object(plain_files.os, "open", side_effect=tracked),
            patch.object(plain_files.os, "fdopen", side_effect=RuntimeError("stream failed")),
        ):
            with self.assertRaisesRegex(RuntimeError, "stream failed"):
                plain_files.read_plain_bytes(target)
        with self.assertRaises(OSError):
            os.fstat(opened[-1])

    def test_replacement_before_open_never_follows_the_new_link(self):
        target = self.cases / "race.json"
        target.write_text("{}")
        outside = self.outside / "race.json"
        outside.write_text('{"private":"synthetic"}')
        original = os.open

        def replace_then_open(path, *args, **kwargs):
            if Path(path) == target:
                target.unlink()
                target.symlink_to(outside)
            return original(path, *args, **kwargs)

        with patch.object(plain_files.os, "open", side_effect=replace_then_open):
            with self.assertRaises(ValueError):
                case_store.read_case(self.cases, target.name)

    def test_replacement_after_open_reads_only_the_verified_handle(self):
        target = self.cases / "race.json"
        target.write_text('{"original":true}')
        outside = self.outside / "race.json"
        outside.write_text('{"private":"synthetic"}')
        original = os.fstat

        def replace_after_open(fd):
            info = original(fd)
            target.unlink()
            target.symlink_to(outside)
            return info

        with patch.object(plain_files.os, "fstat", side_effect=replace_after_open):
            self.assertEqual(json.loads(plain_files.read_plain_bytes(target)), {"original": True})

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

    def test_an_unreachable_share_is_not_reported_as_a_missing_case(self):
        case_store.save_case(self.cases, NAME, record())
        shutil.rmtree(self.cases)
        code, out = self.request("/cases/open?name=" + urllib.parse.quote(NAME))
        self.assertEqual((code, out), (503, {"ok": False, "error": "The shared case folder is unavailable"}))
        self.assertNotIn("missing", out)
        self.cases.mkdir()
        code, out = self.request("/cases/open?name=" + urllib.parse.quote(NAME))
        self.assertEqual((code, out["missing"], out["error"]), (404, True, "Case file not found"))

    def test_ordinary_case_files_still_work(self):
        case_store.save_case(self.cases, NAME, record())
        code, out = self.request("/cases/open?name=" + urllib.parse.quote(NAME))
        self.assertEqual(code, 200)
        self.assertEqual(out["file"]["case"]["number"], "QA-001")
        code, out = self.request("/cases/resolve?number=QA-001")
        self.assertEqual(code, 200)
        code, out = self.request("/cases/list")
        self.assertEqual([f["name"] for f in out["files"]], [NAME])


@unittest.skipIf(os.name == "nt", "non-Windows API model; native Windows uses the actual implementation")
class WindowsReadHandle(unittest.TestCase):
    def test_reparse_and_directory_handles_are_refused_and_closed(self):
        for flags in (plain_files.REPARSE_POINT, 0x10):
            kernel = SimpleNamespace(CreateFileW=Mock(return_value=123), GetFileInformationByHandleEx=Mock(), CloseHandle=Mock())

            def information(handle, kind, attributes, size):
                attributes[0] = flags
                return True

            kernel.GetFileInformationByHandleEx.side_effect = information
            bridge = SimpleNamespace(open_osfhandle=Mock())
            with patch.object(ctypes, "WinDLL", return_value=kernel, create=True), patch.dict(sys.modules, {"msvcrt": bridge}):
                with self.assertRaises(ValueError):
                    plain_files._windows_read_fd("case.json")
            kernel.CloseHandle.assert_called_once_with(123)
            bridge.open_osfhandle.assert_not_called()
            args = kernel.CreateFileW.call_args.args
            self.assertEqual(args[2], 3, "no FILE_SHARE_DELETE while a case read is active")
            self.assertTrue(args[5] & 0x00200000, "open the reparse point itself, never its target")

    def test_regular_handle_is_transferred_to_the_file_descriptor(self):
        kernel = SimpleNamespace(CreateFileW=Mock(return_value=123), GetFileInformationByHandleEx=Mock(return_value=True), CloseHandle=Mock())
        bridge = SimpleNamespace(open_osfhandle=Mock(return_value=42))
        with (
            patch.object(ctypes, "WinDLL", return_value=kernel, create=True),
            patch.object(os, "O_BINARY", 0, create=True),
            patch.dict(sys.modules, {"msvcrt": bridge}),
        ):
            self.assertEqual(plain_files._windows_read_fd("case.json"), 42)
        kernel.CloseHandle.assert_not_called()
        bridge.open_osfhandle.assert_called_once()


if __name__ == "__main__":
    unittest.main()
