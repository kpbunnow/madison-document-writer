"""Startup reuses its registry inventory without reducing verification or recovery authority (synthetic)."""

import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from audit_helper_scale_reads import shared_folder
import case_integrity as integrity
import case_store


class StartupRegistry(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        shared_folder(self.root, 80)
        self.registry = self.root / "_integrity/migrated.json"
        self.original = json.loads(self.registry.read_bytes())

    def tearDown(self):
        self.temp.cleanup()

    def case_bytes(self):
        return {p.name: p.read_bytes() for p in self.root.glob("*.json")}

    def test_one_inventory_read_still_verifies_every_registered_case(self):
        before, registry = self.case_bytes(), self.registry.read_bytes()
        with (
            patch.object(integrity, "registry", wraps=integrity.registry) as reads,
            patch.object(integrity, "verify_record", wraps=integrity.verify_record) as checks,
        ):
            integrity.reconstruct_registry(self.root)
        self.assertEqual(reads.call_count, 1)
        self.assertEqual(checks.call_count, 80, "known registration must never skip checking the actual case")
        self.assertEqual(self.case_bytes(), before)
        self.assertEqual(self.registry.read_bytes(), registry)

    def test_missing_registry_reconstruction_retains_every_genesis_and_case_byte(self):
        before = self.case_bytes()
        self.registry.unlink()
        integrity.reconstruct_registry(self.root)
        rebuilt = integrity.registry(self.root)
        self.assertEqual(
            {e["caseNumber"]: e["genesisHash"] for e in rebuilt["entries"]}, {e["caseNumber"]: e["genesisHash"] for e in self.original["entries"]}
        )
        self.assertEqual(self.case_bytes(), before)
        self.assertTrue(all(e["reconstructed"] for e in rebuilt["entries"]))

    def test_damaged_registry_is_left_for_review_instead_of_rebuilt(self):
        before = self.case_bytes()
        for raw in (b"broken", b"[]", b"[" * 200000 + b"0" + b"]" * 200000):
            with self.subTest(prefix=raw[:20]):
                self.registry.write_bytes(raw)
                integrity.reconstruct_registry(self.root)
                self.assertEqual(self.registry.read_bytes(), raw)
                self.assertEqual(self.case_bytes(), before)

    def test_latest_retained_genesis_still_controls_conflicts(self):
        value = copy.deepcopy(self.original)
        value["entries"].append({**value["entries"][0], "genesisHash": "0" * 64})
        self.registry.write_text(json.dumps(value))
        before = self.registry.read_bytes()
        with patch.object(integrity, "register_migration", wraps=integrity.register_migration) as register:
            integrity.reconstruct_registry(self.root)
        self.assertEqual(register.call_count, 1, "matching an older genesis must not bypass the latest conflict check")
        self.assertEqual(self.registry.read_bytes(), before)
        record = case_store.case_json((self.root / value["entries"][0]["fileName"]).read_bytes())
        self.assertFalse(integrity.verify_record(record, self.root)["valid"])

    def test_new_registration_merges_evidence_added_after_the_snapshot(self):
        initial = copy.deepcopy(self.original)
        missing = initial["entries"].pop()
        self.registry.write_text(json.dumps(initial))
        original_register = integrity.register_migration
        concurrent = {**missing, "caseNumber": "QA-CONCURRENT", "fileName": "OTHER - QA-CONCURRENT.json"}

        def register(*args, **kwargs):
            if args[1]["case"]["number"] == missing["caseNumber"]:
                value = json.loads(self.registry.read_bytes())
                value["entries"].append(concurrent)
                self.registry.write_text(json.dumps(value))
            return original_register(*args, **kwargs)

        with patch.object(integrity, "register_migration", side_effect=register) as writer:
            integrity.reconstruct_registry(self.root)
        self.assertEqual(writer.call_count, 1)
        result = integrity.registry(self.root)["entries"]
        self.assertIn(concurrent, result)
        self.assertEqual(next(e["genesisHash"] for e in result if e["caseNumber"] == missing["caseNumber"]), missing["genesisHash"])

    def test_new_registration_rechecks_a_concurrent_genesis_conflict_under_lock(self):
        initial = copy.deepcopy(self.original)
        missing = initial["entries"].pop()
        self.registry.write_text(json.dumps(initial))
        original_register = integrity.register_migration
        conflicting = {**missing, "genesisHash": "0" * 64}

        def register(*args, **kwargs):
            if args[1]["case"]["number"] == missing["caseNumber"]:
                value = json.loads(self.registry.read_bytes())
                value["entries"].append(conflicting)
                self.registry.write_text(json.dumps(value))
            return original_register(*args, **kwargs)

        with patch.object(integrity, "register_migration", side_effect=register):
            integrity.reconstruct_registry(self.root)
        entries = integrity.registry(self.root)["entries"]
        self.assertEqual([e for e in entries if e["caseNumber"] == missing["caseNumber"]], [conflicting])

    def test_next_operation_checks_current_bytes_instead_of_retaining_a_startup_cache(self):
        integrity.reconstruct_registry(self.root)
        name = self.original["entries"][0]["fileName"]
        path = self.root / name
        value = case_store.case_json(path.read_bytes())
        value["case"]["owner"] = "Synthetic outside rewrite"
        path.write_text(json.dumps(value))
        before, registry = path.read_bytes(), self.registry.read_bytes()
        with patch.object(integrity, "verify_record", wraps=integrity.verify_record) as checks:
            integrity.reconstruct_registry(self.root)
        self.assertEqual(checks.call_count, 80)
        self.assertEqual(path.read_bytes(), before)
        self.assertEqual(self.registry.read_bytes(), registry)
        self.assertFalse(case_store.read_case(self.root, name)["integrity"]["valid"])

    def test_self_consistent_hashes_do_not_make_a_malformed_case_identity_registrable(self):
        path = self.root / "ODD - QA-BAD.json"
        before = self.registry.read_bytes()
        original = case_store.case_json((self.root / self.original["entries"][0]["fileName"]).read_bytes())
        for number in (42, "", None):
            with self.subTest(number=number):
                self.registry.write_bytes(before)
                value = copy.deepcopy(original)
                value.pop("integrity")
                value["case"]["number"] = number
                value = integrity.commit_record(None, value)
                self.assertTrue(integrity.verify_record(value)["valid"], "this probes domain validation independently of chain correctness")
                path.write_bytes(case_store.encoded(value))
                raw = path.read_bytes()
                integrity.reconstruct_registry(self.root)
                self.assertEqual(path.read_bytes(), raw)
                self.assertEqual(self.registry.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
