"""R20 byte-level archive and local HTTP checks; no Outlook/SMB integration."""

import base64, hashlib, json, tempfile, threading, unittest, urllib.request, urllib.error
from pathlib import Path
from unittest.mock import patch
import server


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.here = self.root / "installed"
        self.here.mkdir()
        self.share = self.root / "share"
        self.share.mkdir()
        self.name = "101 Main St - QA - Official Notice - 09-30-2026 - d1234567.pdf"
        self.docid = "d1234567"
        self.raw = b"%PDF-1.4\narchived original bytes\n"
        self.sha = hashlib.sha256(self.raw).hexdigest()
        self.p1 = patch.object(server, "HERE", self.here)
        self.p2 = patch.object(server, "share_root", lambda: self.share)
        self.p1.start()
        self.p2.start()

    def tearDown(self):
        self.p2.stop()
        self.p1.stop()
        self.tmp.cleanup()

    def put(self, base, raw=None):
        p = base / server.OUTDIR_NAME / self.name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(self.raw if raw is None else raw)
        return p

    def test_shared_and_local_byte_identity(self):
        p = self.put(self.share)
        self.assertEqual(server.verified_artifact(self.name, self.sha, self.docid), (p, self.raw))
        p.unlink()
        local = self.put(self.here)
        self.assertEqual(server.verified_artifact(self.name, self.sha, self.docid), (local, self.raw))
        with patch.object(server, "share_root", lambda: self.root / "unavailable-share"):
            self.assertEqual(server.verified_artifact(self.name, self.sha, self.docid), (local, self.raw))

    def test_missing_legacy_conflicting_and_paths_fail_closed(self):
        with self.assertRaises(FileNotFoundError):
            server.verified_artifact(self.name, self.sha, self.docid)
        with self.assertRaisesRegex(ValueError, "checksum"):
            server.verified_artifact(self.name, "", self.docid)
        with self.assertRaises(ValueError):
            server.verified_artifact("../" + self.name, self.sha, self.docid)
        with self.assertRaisesRegex(ValueError, "identity"):
            server.verified_artifact(self.name, self.sha, "other-doc")
        self.put(self.share)
        self.put(self.here, b"%PDF-1.4\nconflicting\n")
        with self.assertRaisesRegex(ValueError, "conflicts"):
            server.verified_artifact(self.name, self.sha, self.docid)

    def test_corrected_versions_are_distinct(self):
        other = self.name.replace("d1234567", "d7654321")
        self.put(self.share)
        p = self.share / server.OUTDIR_NAME / other
        p.write_bytes(b"%PDF-1.4\ncorrected bytes\n")
        self.assertEqual(server.verified_artifact(self.name, self.sha, self.docid)[1], self.raw)
        self.assertEqual(server.verified_artifact(other, hashlib.sha256(p.read_bytes()).hexdigest(), "d7654321")[1], p.read_bytes())

    def test_renderer_never_overwrites_archived_bytes(self):
        target = self.put(self.share)

        def fake_run(command, **kwargs):
            part = Path(next(x.split("=", 1)[1] for x in command if x.startswith("--print-to-pdf=")))
            part.write_bytes(b"%PDF-1.4\nnew formatting\n")
            return type("Process", (), {"returncode": 0, "stderr": b""})()

        with patch.object(server, "find_chrome", return_value="/fake/chrome"), patch.object(server.subprocess, "run", side_effect=fake_run):
            with self.assertRaisesRegex(ValueError, "not overwritten"):
                server.make_pdf("<html><head></head><body></body></html>", target)
        self.assertEqual(target.read_bytes(), self.raw)

    def test_http_returns_verified_pdf_and_blocks_mismatch(self):
        self.put(self.share)
        http = server.Server(("127.0.0.1", 0), server.Handler)
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        base = "http://127.0.0.1:" + str(http.server_address[1])
        port = server.PORT
        try:
            server.PORT = http.server_address[1]

            def call(path, data):
                req = urllib.request.Request(
                    base + path, json.dumps(data).encode(), {"Content-Type": "application/json", "X-DocWriter-Token": server.SESSION_TOKEN}
                )
                return urllib.request.urlopen(req)

            record = {"filename": self.name, "sha256": self.sha, "docId": self.docid}
            result = json.load(call("/artifact/read", record))
            self.assertEqual(base64.b64decode(result["pdf"]), self.raw)
            with self.assertRaises(urllib.error.HTTPError) as bad:
                call("/artifact/read", {**record, "sha256": "0" * 64})
            self.assertEqual(bad.exception.code, 400)
            with patch.object(server, "open_in_outlook", return_value="outlook") as mail:
                result = json.load(
                    call(
                        "/email",
                        {**record, "reuse": True, "filename": self.name, "html": "<html>new rules</html>", "subject": "QA", "body": "", "to": ""},
                    )
                )
                self.assertTrue(result["ok"])
                self.assertEqual(mail.call_args.args[0].read_bytes(), self.raw)
            with self.assertRaises(urllib.error.HTTPError) as bad:
                call("/email", {"filename": self.name, "html": "new", "reuse": True})
            self.assertEqual(bad.exception.code, 400)
        finally:
            server.PORT = port
            http.shutdown()
            http.server_close()
            thread.join(2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
