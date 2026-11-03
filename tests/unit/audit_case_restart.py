"""A case whose file is gone for good restarts its history on the next save, visibly, and never hides a file that exists."""

import copy
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import case_integrity as integrity
import case_store
from audit_r28_helper import pair


def saved(root, guard=None):
    value = pair()
    value["schema"] = 5
    name = "101 TEST - " + value["case"]["number"] + ".json"
    with patch.object(integrity, "protected_folder", return_value=guard):
        case_store.save_case(root, name, value)
        if guard:
            integrity.anchor_daily(root, guard)
    return value, name


class CaseRestart(unittest.TestCase):
    def check(self, anchored):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as external:
            root = Path(folder)
            guard = Path(external) if anchored else None
            value, name = saved(root, guard)
            first = json.loads((root / name).read_text())
            (root / name).unlink()
            with patch.object(integrity, "protected_folder", return_value=guard):
                again = case_store.save_case(root, name, copy.deepcopy(value))
                genesis = again["file"]["integrity"]["genesis"]
                note = genesis["administrativeRecovery"]
                self.assertTrue(note["automatic"] and note["missingCaseFile"])
                self.assertEqual(note["priorGenesisHashes"], [first["integrity"]["genesis"]["hash"]])
                self.assertEqual(bool(note["priorAnchoredCommitHash"]), anchored)
                self.assertNotEqual(genesis["hash"], first["integrity"]["genesis"]["hash"])
                entries = json.loads((root / "_integrity" / "migrated.json").read_text())["entries"]
                self.assertEqual(len(entries), 2, "the old entry is kept as evidence")
                self.assertEqual(entries[0]["genesisHash"], first["integrity"]["genesis"]["hash"])
                self.assertEqual(entries[-1]["genesisHash"], genesis["hash"])
                self.assertTrue(entries[-1]["administrativeRecovery"])
                verdict = case_store.read_case(root, name)["integrity"]
                self.assertTrue(verdict["valid"], verdict)
                self.assertTrue(verdict["historyRestarted"])
                self.assertIn("history restarted", verdict["label"])
                self.assertIn("because the case file was missing", verdict["label"])
                later = copy.deepcopy(again["file"])
                later["case"]["owner"] = "CHANGED OWNER"
                case_store.save_case(root, name, later, base_revision=again["revision"], base_case=again["file"]["case"])
                self.assertEqual(len(json.loads((root / "_integrity" / "migrated.json").read_text())["entries"]), 2, "no second restart")
                self.assertTrue(case_store.read_case(root, name)["integrity"]["valid"])
                if anchored:
                    integrity.anchor_daily(root, guard)
                    self.assertTrue(case_store.read_case(root, name)["integrity"]["valid"], "still valid once the new history is the anchored one")

    def test_a_deleted_case_file_restarts_without_an_external_anchor(self):
        self.check(False)

    def test_a_deleted_case_file_restarts_with_an_external_anchor_naming_the_prior_commit(self):
        self.check(True)

    def test_a_new_case_or_an_intact_case_is_unchanged(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            value, name = saved(root)
            record = json.loads((root / name).read_text())
            self.assertNotIn("administrativeRecovery", record["integrity"]["genesis"])
            self.assertFalse(case_store.read_case(root, name)["integrity"]["historyRestarted"])
            self.assertIsNone(integrity.automatic_restart(root, "CB2099-001-99999"))

    @unittest.skipIf(os.name == "nt", "a symbolic link stands in for a link or placeholder the program must not use")
    def test_an_entry_for_the_number_that_cannot_be_used_is_never_hidden_by_a_restart(self):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as elsewhere:
            root = Path(folder)
            value, name = saved(root)
            raw = (root / name).read_bytes()
            (root / name).unlink()
            kept = Path(elsewhere) / "kept.json"
            kept.write_bytes(raw)
            (root / ("5 OTHER NAME - " + value["case"]["number"] + ".json")).symlink_to(kept)
            with self.assertRaisesRegex(ValueError, "link or is not a regular file"):
                case_store.save_case(root, name, copy.deepcopy(value))
            self.assertFalse((root / name).exists(), "nothing was written")
            self.assertEqual(len(json.loads((root / "_integrity" / "migrated.json").read_text())["entries"]), 1)


if __name__ == "__main__":
    unittest.main()
