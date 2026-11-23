"""Ordinary saves and opens do not read every shared case or summary (synthetic).

At thousands of cases, a whole-folder read on every request made Workspace saves and opens slow. Two reads are now
done only when they can change a result:
- the cross-case citation history, only for a save that adds a priced citation;
- the Reporting Index summaries, only when a record has no retained registry entry (the downgrade check).
Both still happen in those cases, and the verdicts are unchanged."""

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import case_integrity as integrity
import case_store
from audit_helper import record
import audit_r30_helper


def shared_folder(root, count):
    """Schema-5 cases with registry entries and current summaries, as the helper writes them."""
    index = root / "Reporting Index"
    index.mkdir()
    entries = []
    for n in range(count):
        value = record()
        value["schema"] = 5
        value["case"].update(number="QA-SC-" + str(n), id="case_sc_" + str(n))
        value = integrity.commit_record(None, value)
        name = "TEST - QA-SC-" + str(n) + ".json"
        raw = case_store.encoded(value)
        (root / name).write_bytes(raw)
        entries.append(
            {"caseNumber": value["case"]["number"], "fileName": name, "genesisHash": value["integrity"]["genesis"]["hash"], "migratedAt": "synthetic"}
        )
        summary = {
            "format": "madison-case-summary",
            "case": value["case"],
            "sourceFile": name,
            "sourceRevision": hashlib.sha256(raw).hexdigest(),
            "integrity": {"headHash": value["integrity"]["headHash"]},
        }
        (index / ("qa-sc-" + str(n) + ".json")).write_text(json.dumps(summary))
    (root / "_integrity").mkdir()
    (root / "_integrity/migrated.json").write_text(json.dumps({"format": "madison-migration-registry", "entries": entries}))
    return index


class SummaryReads:
    def __init__(self, index):
        self.index, self.count = index, 0
        real_text, real_bytes = Path.read_text, Path.read_bytes

        def text(path, *args, **kwargs):
            self.count += path.parent == index
            return real_text(path, *args, **kwargs)

        def raw(path, *args, **kwargs):
            self.count += path.parent == index
            return real_bytes(path, *args, **kwargs)

        self.patches = (patch.object(Path, "read_text", text), patch.object(Path, "read_bytes", raw))

    def __enter__(self):
        for p in self.patches:
            p.start()
        return self

    def __exit__(self, *error):
        for p in self.patches:
            p.stop()


class HelperScaleReads(unittest.TestCase):
    def test_opening_and_verifying_a_registered_case_reads_no_summaries(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            index = shared_folder(root, 30)
            with SummaryReads(index) as reads:
                opened = case_store.read_case(root, "TEST - QA-SC-7.json")
            self.assertTrue(opened["integrity"]["valid"])
            self.assertEqual(reads.count, 0)

    def test_downgrade_evidence_from_summaries_is_still_read_when_needed(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            index = shared_folder(root, 5)
            # A case known only from its summary: no registry entry. Stripping its integrity block must still be detected.
            registry = json.loads((root / "_integrity/migrated.json").read_text())
            registry["entries"] = [e for e in registry["entries"] if e["caseNumber"] != "QA-SC-3"]
            (root / "_integrity/migrated.json").write_text(json.dumps(registry))
            stripped = json.loads((root / "TEST - QA-SC-3.json").read_text())
            stripped.pop("integrity")
            stripped["schema"] = 4
            context = integrity.VerificationContext(root)
            with SummaryReads(index) as reads:
                anchored, known = integrity.anchor_evidence(stripped, root, context=context)
                self.assertTrue(known)
                self.assertIn("qa-sc-3", context.known)
                verdict = integrity.verify_record(stripped, root, context=context)
            self.assertEqual(reads.count, 5, "the summaries are read once, when the downgrade check needs them")
            self.assertFalse(verdict["valid"])

    def test_cross_case_history_is_read_only_for_a_new_priced_citation(self):
        cases = audit_r30_helper.DepositTests()
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            calls = []
            real = case_store.citation_history

            def history(*args, **kwargs):
                calls.append(args)
                return real(*args, **kwargs)

            with patch.object(case_store, "citation_history", history):
                first = cases.save(root, cases.value(number="QA-SC-CITE-1"))
                self.assertEqual(len(calls), 1, "a new priced citation is checked against every shared case")
                # Saving the cited case again adds no citation, so its pricing is not re-checked across the share.
                again = case_store.save_case(root, first["name"], first["file"], first["revision"], first["file"]["case"])
                self.assertTrue(again["ok"])
                self.assertEqual(len(calls), 1)
                # The same owner and site again: the shared history makes this a second offense.
                cases.save(root, cases.value(number="QA-SC-CITE-2", tier=2))
                self.assertEqual(len(calls), 2)

    def test_priced_citation_detection_skips_saved_events(self):
        value = audit_r30_helper.DepositTests().value(number="QA-SC-CITE-3")
        ids = {e["id"] for e in value["events"]}
        self.assertTrue(case_store._has_priced_citation(value))
        self.assertFalse(case_store._has_priced_citation(value, ids))
        self.assertTrue(case_store._has_priced_citation(value, ids - {value["events"][-1]["id"]}))


if __name__ == "__main__":
    unittest.main()
