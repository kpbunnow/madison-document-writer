"""Outbox transfer and direct filing share one per-name lock and never replace different bytes."""

import hashlib, os, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
import case_store
import workflow_helper as workflow
import server

TRANSFER = b"%PDF-1.7 synthetic outbox original"
DIRECT = b"%PDF-1.7 synthetic direct original"


class Publication(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.local, self.share = root / "local", root / "share"
        self.outbox = self.local / server.OUTDIR_NAME
        self.dest = self.share / server.OUTDIR_NAME
        self.outbox.mkdir(parents=True)
        self.share.mkdir()
        self.patches = [patch.object(server, "HERE", self.local), patch.object(server, "share_root", return_value=self.share)]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.temp.cleanup()

    def queue(self, name="Notice - ABCD1234.pdf", raw=TRANSFER):
        (self.outbox / name).write_bytes(raw)
        return {"name": name, "sha256": hashlib.sha256(raw).hexdigest()}

    def transfer(self, *items):
        return workflow.sync_selected(server, {"items": list(items)})["result"]

    def leftovers(self):
        return sorted(p.name for p in self.dest.iterdir() if p.name.startswith("._dw-"))

    def test_transfer_then_direct_filing_of_different_bytes(self):
        item = self.queue()
        self.assertEqual(self.transfer(item)["moved"], 1)
        with self.assertRaisesRegex(ValueError, "not overwritten"):
            server.file_pdf_bytes(self.dest / item["name"], DIRECT)
        self.assertEqual((self.dest / item["name"]).read_bytes(), TRANSFER)

    def test_direct_filing_then_transfer_of_different_bytes(self):
        item = self.queue()
        server.file_pdf_bytes(self.dest / item["name"], DIRECT)
        result = self.transfer(item)
        self.assertEqual((result["moved"], result["conflicts"]), (0, [item["name"]]))
        self.assertEqual((self.dest / item["name"]).read_bytes(), DIRECT)
        self.assertEqual((self.outbox / item["name"]).read_bytes(), TRANSFER)

    def test_direct_filing_cannot_enter_between_check_and_publication(self):
        # The defect: transfer checked absence under a different lock, so a direct
        # filing could publish at this point and then be silently replaced.
        item = self.queue()
        direct = []

        def racing(real):
            def write(target, body):
                try:
                    with case_store.file_lock(target.parent, "issued-pdf:" + target.name, wait=0.1):
                        if not target.exists():
                            target.write_bytes(DIRECT)
                        direct.append("filed")
                except RuntimeError:
                    direct.append("blocked")
                return real(target, body)

            return write

        with (
            patch.object(server, "publish_new", racing(getattr(server, "publish_new", None)), create=True),
            patch.object(workflow, "atomic_write", racing(workflow.atomic_write)),
        ):
            result = self.transfer(item)
        if direct == ["filed"]:
            self.assertEqual((self.dest / item["name"]).read_bytes(), DIRECT, "a reported direct filing was overwritten")
        self.assertEqual(direct, ["blocked"])
        self.assertEqual(result["moved"], 1)
        self.assertEqual((self.dest / item["name"]).read_bytes(), TRANSFER)

    def test_writer_outside_the_locks_is_never_overwritten(self):
        for first in ("transfer", "direct"):
            with self.subTest(operation=first):
                item = self.queue("Order " + first + " - ABCD1234.pdf")
                real = server.publish_new

                def intruder(target, body):
                    target.write_bytes(b"%PDF-1.7 synthetic copy made outside the program")
                    return real(target, body)

                with patch.object(server, "publish_new", intruder):
                    if first == "transfer":
                        self.assertEqual(self.transfer(item)["conflicts"], [item["name"]])
                        self.assertEqual((self.outbox / item["name"]).read_bytes(), TRANSFER)
                    else:
                        with self.assertRaisesRegex(ValueError, "not overwritten"):
                            server.file_pdf_bytes(self.dest / item["name"], DIRECT)
                self.assertEqual((self.dest / item["name"]).read_bytes(), b"%PDF-1.7 synthetic copy made outside the program")
                self.assertEqual(self.leftovers(), [])

    def test_identical_retries_are_safe_in_both_orders(self):
        item = self.queue()
        server.file_pdf_bytes(self.dest / item["name"], TRANSFER)
        self.assertEqual(self.transfer(item), {"moved": 1, "conflicts": [], "remaining": 0})
        self.assertEqual(server.file_pdf_bytes(self.dest / item["name"], TRANSFER), str(self.dest / item["name"]))
        self.assertEqual((self.dest / item["name"]).read_bytes(), TRANSFER)

    def test_interrupted_transfer_retries_without_duplicates(self):
        item = self.queue()
        real_unlink = Path.unlink

        def crash(path, *args, **kwargs):
            if path.parent == self.outbox:
                raise OSError("synthetic interruption after publication")
            return real_unlink(path, *args, **kwargs)

        with patch.object(Path, "unlink", crash), self.assertRaises(OSError):
            self.transfer(item)
        self.assertEqual((self.dest / item["name"]).read_bytes(), TRANSFER)
        self.assertTrue((self.outbox / item["name"]).exists())
        self.assertEqual(self.transfer(item)["moved"], 1)
        self.assertEqual(sorted(p.name for p in self.dest.glob("*.pdf")), [item["name"]])

        second = self.queue("Second - ABCD1234.pdf")
        with patch.object(server, "publish_new", side_effect=OSError("synthetic interruption before publication")), self.assertRaises(OSError):
            self.transfer(second)
        self.assertFalse((self.dest / second["name"]).exists())
        self.assertEqual(self.transfer(second)["moved"], 1)
        self.assertEqual(self.leftovers(), [])

    def test_changed_local_copy_is_kept(self):
        item = self.queue()
        real = server.file_pdf_bytes

        def edit_during_filing(target, raw):
            result = real(target, raw)
            (self.outbox / item["name"]).write_bytes(b"%PDF-1.7 synthetic edit")
            return result

        with patch.object(server, "file_pdf_bytes", edit_during_filing):
            self.assertEqual(self.transfer(item)["conflicts"], [item["name"]])
        self.assertEqual((self.outbox / item["name"]).read_bytes(), b"%PDF-1.7 synthetic edit")

    @unittest.skipIf(os.name == "nt", "symlink creation needs privileges on Windows")
    def test_linked_destination_is_refused(self):
        item = self.queue()
        elsewhere = Path(self.temp.name) / "elsewhere.pdf"
        elsewhere.write_bytes(TRANSFER)
        self.dest.mkdir()
        (self.dest / item["name"]).symlink_to(elsewhere)
        self.assertEqual(self.transfer(item)["conflicts"], [item["name"]])
        with self.assertRaisesRegex(ValueError, "not overwritten"):
            server.file_pdf_bytes(self.dest / item["name"], TRANSFER)
        self.assertTrue((self.outbox / item["name"]).exists())


if __name__ == "__main__":
    unittest.main()
