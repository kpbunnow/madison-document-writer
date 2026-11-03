"""A case whose file is gone for good can be restarted only by an administrator's explicit, bound approval."""

import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import case_integrity as integrity
import case_store
import integrity_admin
from audit_r28_helper import pair

REASON = "The case file was deleted by mistake during testing and is not recoverable."


def saved(root, anchored=None):
    value = pair()
    value["schema"] = 5
    name = "101 TEST - " + value["case"]["number"] + ".json"
    with patch.object(integrity, "protected_folder", return_value=anchored):
        case_store.save_case(root, name, value)
        if anchored:
            integrity.anchor_daily(root, anchored)
    return value, name


class CaseRestart(unittest.TestCase):
    def check(self, anchored):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as external:
            root = Path(folder)
            guard = Path(external) if anchored else None
            value, name = saved(root, guard)
            number = value["case"]["number"]
            (root / name).unlink()
            with patch.object(integrity, "protected_folder", return_value=guard):
                with self.assertRaisesRegex(ValueError, "saved on the shared folder before"):
                    case_store.save_case(root, name, copy.deepcopy(value))
                result = integrity_admin.approve_restart(root, number, "Pat Admin", REASON, True)
                self.assertEqual(result["anchored"], anchored)
                again = case_store.save_case(root, name, copy.deepcopy(value))
                genesis = again["file"]["integrity"]["genesis"]
                note = genesis["administrativeRecovery"]
                self.assertEqual((note["administrator"], note["reason"], note["missingCaseFile"]), ("Pat Admin", REASON, True))
                self.assertEqual(bool(note["priorAnchoredCommitHash"]), anchored)
                entries = json.loads((root / "_integrity" / "migrated.json").read_text())["entries"]
                self.assertEqual(len(entries), 2)
                self.assertTrue(entries[-1]["administrativeRecovery"])
                self.assertEqual(entries[-1]["genesisHash"], genesis["hash"])
                verdict = case_store.read_case(root, name)["integrity"]
                self.assertTrue(verdict["valid"], verdict)
                restarts = list((root / "_integrity" / "restarts").iterdir())
                self.assertEqual(len(restarts), 1)
                self.assertIn(".used-", restarts[0].name, "the approval is kept as the audit record and cannot be used twice")
                later = copy.deepcopy(again["file"])
                later["case"]["owner"] = "CHANGED OWNER"
                case_store.save_case(root, name, later, base_revision=again["revision"], base_case=again["file"]["case"])
                self.assertTrue(case_store.read_case(root, name)["integrity"]["valid"])
                if anchored:
                    integrity.anchor_daily(root, guard)
                    self.assertTrue(case_store.read_case(root, name)["integrity"]["valid"], "still valid once the new history is the anchored one")

    def test_restart_without_an_external_anchor(self):
        self.check(False)

    def test_restart_with_an_external_anchor_names_the_prior_commit(self):
        self.check(True)

    def test_refusals(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            value, name = saved(root)
            number = value["case"]["number"]
            for args in (("A", REASON, True), ("Pat Admin", "too short", True), ("Pat Admin", REASON, False)):
                with self.assertRaises(ValueError):
                    integrity_admin.approve_restart(root, number, *args)
            with self.assertRaisesRegex(ValueError, "case file for this number exists"):
                integrity_admin.approve_restart(root, number, "Pat Admin", REASON, True)
            (root / name).unlink()
            with self.assertRaisesRegex(ValueError, "no entry for this case number"):
                integrity_admin.approve_restart(root, "CB2099-001-99999", "Pat Admin", REASON, True)
            self.assertFalse((root / "_integrity" / "restarts").exists())

    def test_an_approval_for_changed_evidence_or_another_case_is_not_used(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            value, name = saved(root)
            number = value["case"]["number"]
            (root / name).unlink()
            integrity_admin.approve_restart(root, number, "Pat Admin", REASON, True)
            path = integrity.restart_path(root, number)
            approval = json.loads(path.read_text())
            approval["registryEntries"][0]["genesisHash"] = "0" * 64
            path.write_text(json.dumps(approval))
            with self.assertRaisesRegex(ValueError, "approval to restart this case no longer matches"):
                case_store.save_case(root, name, copy.deepcopy(value))
            approval["registryEntries"][0]["genesisHash"] = json.loads((root / "_integrity" / "migrated.json").read_text())["entries"][0]["genesisHash"]
            approval["caseNumber"] = "CB2099-001-99999"
            path.write_text(json.dumps(approval))
            with self.assertRaisesRegex(ValueError, "no longer matches"):
                case_store.save_case(root, name, copy.deepcopy(value))
            self.assertFalse((root / name).exists(), "nothing was written")

    def test_a_present_file_is_never_restarted_by_a_leftover_approval(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            value, name = saved(root)
            number = value["case"]["number"]
            (root / name).unlink()
            integrity_admin.approve_restart(root, number, "Pat Admin", REASON, True)
            restored = case_store.save_case(root, name, copy.deepcopy(value))["file"]
            self.assertIn(".used-", next(iter((root / "_integrity" / "restarts").iterdir())).name)
            self.assertTrue(restored["integrity"]["genesis"]["administrativeRecovery"]["missingCaseFile"])


if __name__ == "__main__":
    unittest.main()
