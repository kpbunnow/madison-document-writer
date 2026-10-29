"""People see messages the program wrote, never parser or Python wording or file paths: purposeful ValueErrors and
crafted OSErrors pass through unchanged, everything else becomes one plain sentence, and the migration conflict says
what happened and what to do."""

import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch

import case_integrity
import public_errors
import server


class PublicMessages(unittest.TestCase):
    def test_messages_the_program_wrote_are_shown_as_written(self):
        self.assertEqual(public_errors.public_message(ValueError("Invalid case filename")), "Invalid case filename")
        self.assertEqual(public_errors.public_message(OSError("The shared case folder is unavailable")), "The shared case folder is unavailable")
        self.assertEqual(public_errors.public_message(FileNotFoundError("Case file not found")), "Case file not found")

    def test_parser_and_python_wording_becomes_a_plain_sentence(self):
        for error in (
            json.JSONDecodeError("Expecting value", "", 0),
            UnicodeDecodeError("utf-8", b"\xff", 0, 1, "invalid start byte"),
        ):
            self.assertEqual(public_errors.public_message(error), public_errors.UNREADABLE)
        for error in (
            AttributeError("'str' object has no attribute 'get'"),
            TypeError("'int' object is not iterable"),
            KeyError("integrity"),
            IndexError("x"),
            RecursionError(),
        ):
            message = public_errors.public_message(error)
            self.assertEqual(message, public_errors.UNEXPECTED)
            self.assertNotIn("attribute", message)

    def test_system_errors_do_not_reveal_paths(self):
        for error in (
            FileNotFoundError(2, "No such file or directory", "/srv/cases/secret.json"),
            PermissionError(13, "Permission denied", "C:\\Cases\\x.json"),
        ):
            message = public_errors.public_message(error)
            self.assertEqual(message, public_errors.UNREACHABLE)
            self.assertNotIn("secret", message)
            self.assertNotIn("Cases", message)

    def test_the_migration_conflict_explains_itself(self):
        self.assertNotIn("genesis", case_integrity.GENESIS_CONFLICT.lower())
        self.assertIn("administrator", case_integrity.GENESIS_CONFLICT)
        self.assertIn("kept on this device", case_integrity.GENESIS_CONFLICT)


class Endpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        (cls.root / server.CASE_DIR_NAME).mkdir()
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

    def get(self, path):
        req = urllib.request.Request(self.base + path, headers={"X-DocWriter-Token": server.SESSION_TOKEN})
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_an_unexpected_failure_in_a_handler_is_answered_without_python_text(self):
        with patch.object(server, "read_case", side_effect=AttributeError("'NoneType' object has no attribute 'get'")):
            code, out = self.get("/cases/open?name=x.json")
        self.assertEqual(code, 400)
        self.assertEqual(out["error"], public_errors.UNEXPECTED)

    def test_a_system_error_in_a_handler_does_not_reveal_the_path(self):
        with patch.object(server, "read_case", side_effect=PermissionError(13, "Permission denied", "/srv/private/x.json")):
            code, out = self.get("/cases/open?name=x.json")
        self.assertNotIn("private", json.dumps(out))
        self.assertEqual(out["error"], public_errors.UNREACHABLE)

    def test_a_purposeful_refusal_still_reads_as_written(self):
        code, out = self.get("/cases/open?name=..%2Fx.json")
        self.assertEqual((code, out["error"]), (400, "Invalid case filename"))


if __name__ == "__main__":
    unittest.main()
