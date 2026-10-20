"""Real HTTP lost-response PDF protocol with deliberately changing renderer bytes."""

import copy
import json
from pathlib import Path
import socket
import subprocess
import sys
import unittest
from unittest.mock import patch
import server
import audit_r23_helper as previous


class PdfOperations(unittest.TestCase):
    setUp = previous.R23Tests.setUp
    tearDown = previous.R23Tests.tearDown
    request = previous.R23Tests.request

    def operation(self):
        return {
            "filename": "Synthetic - abcdef12.pdf",
            "html": "<p>Frozen synthetic source</p>",
            "operation": {"caseId": "case_1", "caseNumber": "QA-1", "docId": "document_abcdef12", "version": "a" * 64},
        }

    def test_lost_response_restart_returns_original_without_render(self):
        data = self.operation()
        renders = []

        def render(html, target):
            renders.append(html)
            Path(target).write_bytes(b"%PDF-1.7\noriginal-" + str(len(renders)).encode())
            return str(target)

        json_reply = server.Handler._json
        lost = False

        def lose(handler, status, value):
            nonlocal lost
            if status == 200 and value.get("operationId") and not lost:
                lost = True
                handler.close_connection = True
                handler.connection.shutdown(socket.SHUT_RDWR)
                handler.connection.close()
                return None
            return json_reply(handler, status, value)

        with patch.object(server, "make_pdf", side_effect=render), patch.object(server.Handler, "_json", lose):
            with self.assertRaises(Exception):
                self.request("/save-pdf", data)
        self.assertTrue(lost)
        self.assertEqual(len(renders), 1)
        # A fresh interpreter has no memory of either request or rendered bytes.
        (self.root / "request.txt").write_text(json.dumps(data))
        program = (
            "import json,sys;from pathlib import Path;import server,artifact_stor"
            "e;root=Path(sys.argv[1]);server.HERE=root;server.share_root=lambda:r"
            "oot/'share';server.make_pdf=lambda *a:(_ for _ in ()).throw(Assertio"
            "nError('must not rerender'));d=json.loads((root/'request.txt').read_"
            "text());print(json.dumps(artifact_store.file_operation(server,d,d['f"
            "ilename'],d['html'])))"
        )
        answer = subprocess.run([sys.executable, "-c", program, str(self.root)], capture_output=True, text=True, timeout=20)
        self.assertEqual(answer.returncode, 0, answer.stderr)
        original = json.loads(answer.stdout)
        with patch.object(server, "make_pdf", side_effect=AssertionError("must not rerender")):
            status, retry = self.request("/save-pdf", data)
        self.assertEqual(status, 200, retry)
        self.assertEqual(retry["sha256"], original["sha256"])
        self.assertEqual(len(list((self.root / "share" / server.OUTDIR_NAME).glob("*.pdf"))), 1)
        for change in ("html", "case", "version", "doc"):
            bad = copy.deepcopy(data)
            if change == "html":
                bad["html"] = "<p>Changed source</p>"
            elif change == "case":
                bad["operation"]["caseId"] = "another_case"
            elif change == "version":
                bad["operation"]["version"] = "b" * 64
            else:
                bad["operation"]["docId"] = "another_abcdef12"
            self.assertEqual(self.request("/save-pdf", bad)[0], 400, change)
        Path(original["path"]).write_bytes(b"%PDF-1.7\nmodified outside program")
        self.assertEqual(self.request("/save-pdf", data)[0], 400)

    def test_long_name_preserves_document_identity(self):
        data = self.operation()
        data["filename"] = "Very long synthetic property " + ("A" * 220) + " - abcdef12.pdf"

        def render(html, target):
            Path(target).write_bytes(b"%PDF-1.7\nlong-name original")

        with patch.object(server, "make_pdf", side_effect=render):
            status, result = self.request("/save-pdf", data)
        self.assertEqual(status, 200, result)
        self.assertTrue(result["name"].endswith(" - abcdef12.pdf"))
        self.assertLess(len(result["name"]), 181)
        path, raw = server.verified_artifact(result["name"], result["sha256"], data["operation"]["docId"])
        self.assertEqual(path.read_bytes(), raw)

    def test_prepared_receipt_before_file_failure_and_outbox_reuse(self):
        data = self.operation()
        real = server.file_pdf_bytes
        renders = []

        def render(html, target):
            renders.append(html)
            Path(target).write_bytes(b"%PDF-1.7\nexact prepared bytes")

        def fail_shared(target, raw):
            if self.root / "share" in Path(target).parents:
                raise OSError("shared PDF write lost")
            return real(target, raw)

        with patch.object(server, "make_pdf", side_effect=render), patch.object(server, "file_pdf_bytes", side_effect=fail_shared):
            status, first = self.request("/save-pdf", data)
        self.assertEqual(status, 200, first)
        self.assertTrue(first["local"])
        with patch.object(server, "make_pdf", side_effect=AssertionError("rerender forbidden")):
            status, again = self.request("/save-pdf", data)
        self.assertEqual(status, 200, again)
        self.assertEqual(first["sha256"], again["sha256"])
        self.assertEqual(len(renders), 1)
        self.assertEqual(Path(first["path"]).read_bytes(), Path(again["path"]).read_bytes())
        result = server.sync_outbox()
        self.assertTrue(result["ok"])
        self.assertFalse(Path(first["path"]).exists())


if __name__ == "__main__":
    unittest.main()
