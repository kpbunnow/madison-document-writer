"""Damaged shared case files are refused clearly and named, never skipped or crashing (synthetic).

A damage stress test of the shared case folder found:
- a deeply nested case file dropped the connection for citation history, and gave a generic error when saved;
- a case file re-saved with a UTF-8 byte-order mark opened normally but blocked every new citation;
- a case file holding NaN opened as if valid, although no browser can read the response;
- a case file replaced by a link was silently left out of citation history, so a citation could be priced as a
  first offense;
- an unreadable case anywhere refused new citations as if the inspector's own request were unreadable, without
  naming the file to review;
- a corrupt pending transaction refused saves with a generic message."""

import json
import os
from pathlib import Path
import tempfile
import unittest

import case_integrity
import case_store
from audit_helper_scale_reads import shared_folder


class SharedFolderDamage(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        shared_folder(self.root, 4)
        self.name = "TEST - QA-SC-2.json"
        self.path = self.root / self.name

    def tearDown(self):
        self.tmp.cleanup()

    def history_refusal(self):
        """The refusal a person sees from the history route or a citation save: it names the file to review."""
        with self.assertRaises(Exception) as raised:
            case_store.citation_history(self.root)
        self.assertEqual(getattr(raised.exception, "case_file", None) is not None, True)
        return case_store.history_refusal(raised.exception)

    def test_byte_order_mark_is_read_everywhere(self):
        self.path.write_bytes(b"\xef\xbb\xbf" + self.path.read_bytes())
        self.assertTrue(case_store.read_case(self.root, self.name)["integrity"]["valid"])
        self.assertTrue(case_store.citation_history(self.root)["ok"])

    def test_byte_order_mark_still_allows_valid_daily_anchoring(self):
        external = self.root / "protected-anchor-test"
        external.mkdir()
        self.path.write_bytes(b"\xef\xbb\xbf" + self.path.read_bytes())
        before = self.path.read_bytes()
        result = case_integrity.anchor_daily(self.root, external)
        self.assertTrue(result["anchored"])
        record = case_store.case_json(before)
        self.assertTrue(case_integrity.verify_record(record, self.root, external=external)["anchored"])
        self.assertEqual(self.path.read_bytes(), before)

    def test_registry_reconstruction_reads_valid_bom_case_without_rewriting_it(self):
        originals = case_integrity.registry(self.root)["entries"]
        self.path.write_bytes(b"\xef\xbb\xbf" + self.path.read_bytes())
        before = self.path.read_bytes()
        (self.root / "_integrity/migrated.json").unlink()
        case_integrity.reconstruct_registry(self.root)
        rebuilt = case_integrity.registry(self.root)["entries"]
        self.assertEqual({e["caseNumber"]: e["genesisHash"] for e in rebuilt}, {e["caseNumber"]: e["genesisHash"] for e in originals})
        self.assertEqual(self.path.read_bytes(), before)

    def test_bom_does_not_let_a_tampered_case_be_anchored(self):
        external = self.root / "protected-anchor-test"
        external.mkdir()
        record = case_store.case_json(self.path.read_bytes())
        record["case"]["owner"] = "CHANGED OUTSIDE THE PROGRAM"
        self.path.write_bytes(b"\xef\xbb\xbf" + json.dumps(record).encode("utf-8"))
        before = self.path.read_bytes()
        with self.assertRaises(ValueError):
            case_integrity.anchor_daily(self.root, external)
        self.assertEqual(list(external.glob("*.sha256")), [])
        self.assertEqual(self.path.read_bytes(), before)

    def test_startup_reconstruction_skips_unreadable_nonrecord_and_deep_case_files(self):
        original_registry = (self.root / "_integrity/migrated.json").read_bytes()
        for raw in [b"[1]", b"null", b"42", b"true", b"[" * 200000 + b"0" + b"]" * 200000]:
            with self.subTest(prefix=raw[:20]):
                self.path.write_bytes(raw)
                unknown = self.root / "ODD - QA-UNKNOWN.json"
                unknown.write_bytes(raw)
                case_integrity.reconstruct_registry(self.root)
                self.assertEqual(unknown.read_bytes(), raw)
                self.assertEqual(self.path.read_bytes(), raw)
                self.assertEqual((self.root / "_integrity/migrated.json").read_bytes(), original_registry)

    def test_non_finite_case_file_is_refused_on_open_and_named_in_history(self):
        text = self.path.read_text()
        self.path.write_text(text.replace('"QA-SC-2"', '"QA-SC-2","extra":NaN', 1))
        with self.assertRaisesRegex(ValueError, "could not be read as a Madison case record"):
            case_store.read_case(self.root, self.name)
        message = self.history_refusal()
        self.assertIn("“" + self.name + "” could not be read", message)

    def test_deeply_nested_file_is_named_not_a_crash(self):
        self.path.write_text('{"a":' * 200000 + "1" + "}" * 200000)
        self.assertIn("“" + self.name + "” could not be read", self.history_refusal())
        record = json.loads((self.root / "TEST - QA-SC-1.json").read_text())
        record["case"].update(number="QA-SC-2", id="case_sc_2")
        record.pop("integrity")
        with self.assertRaisesRegex(ValueError, "could not be read as a Madison case record"):
            case_store.save_case(self.root, self.name, record, base_revision="x")
        self.assertTrue(self.path.read_text().startswith('{"a":{"a":'), "the damaged file is left unchanged")

    def test_linked_case_file_makes_history_incomplete(self):
        self.path.unlink()
        os.symlink(self.root / "TEST - QA-SC-1.json", self.path)
        self.assertIn("“" + self.name + "” is a link or not a regular file", self.history_refusal())

    def test_duplicate_and_unverifiable_files_are_named(self):
        (self.root / "COPY - QA-SC-2.json").write_bytes(self.path.read_bytes())
        message = self.history_refusal()
        self.assertIn("\u201c" + self.name + "\u201d has the same case number as \u201cCOPY - QA-SC-2.json\u201d", message)
        (self.root / "COPY - QA-SC-2.json").unlink()
        record = json.loads(self.path.read_text())
        record["case"]["owner"] = "CHANGED OUTSIDE THE PROGRAM"
        self.path.write_text(json.dumps(record))
        self.assertIn("“" + self.name + "” did not verify", self.history_refusal())

    def test_corrupt_pending_transaction_is_reported_as_damaged(self):
        folder = self.root / "_integrity/transactions"
        folder.mkdir(parents=True, exist_ok=True)
        for content in ("{broken", "[1]", "{}"):
            (folder / "damaged.json").write_text(content)
            with self.subTest(content=content), self.assertRaisesRegex(ValueError, "Pending integrity transaction is damaged"):
                case_integrity.read_intent(folder / "damaged.json")


if __name__ == "__main__":
    unittest.main()
