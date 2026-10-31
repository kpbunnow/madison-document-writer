"""Actual locked store: corruption, migration, retries, skew, concurrency and anchors."""

import copy
import json
from pathlib import Path
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
import case_integrity as integrity
import case_store
from audit_r28_helper import pair


class IntegrityTests(unittest.TestCase):
    def fixture(self):
        v = pair()
        v["schema"] = 5
        return v

    def test_every_tamper_is_detected(self):
        v = integrity.commit_record(None, self.fixture())
        self.assertTrue(integrity.verify_record(v)["valid"])
        for change in ("field", "delete", "order", "amount", "metadata"):
            bad = copy.deepcopy(v)
            if change == "field":
                bad["events"][0]["payload"]["snapshot"]["items"][0]["text"] = "tampered"
            elif change == "delete":
                bad["events"].pop()
            elif change == "order":
                bad["events"].reverse()
            elif change == "amount":
                bad["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]["amount"] = "1.00"
            else:
                bad["case"]["owner"] = "Edited outside program"
            result = integrity.verify_record(bad)
            self.assertFalse(result["valid"])
            self.assertTrue(result["eventId"])
            self.assertTrue(result["expected"])
            self.assertTrue(result["actual"])

    def test_locked_save_retry_and_migration(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            v = pair()
            v["schema"] = 4
            name = "101 TEST - " + v["case"]["number"] + ".json"
            case_store.save_case(root, name, v)
            v["schema"] = 5
            first = case_store.save_case(root, name, v)
            self.assertEqual(first["file"]["integrity"]["genesis"]["sourceSchema"], 4)
            again = case_store.save_case(root, name, v, idempotency_event=v["events"][-1]["id"])
            self.assertEqual(first["file"]["integrity"], again["file"]["integrity"])
            raw = json.loads((root / name).read_text())
            raw["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]["amount"] = "1.00"
            (root / name).write_text(json.dumps(raw))
            self.assertFalse(case_store.read_case(root, name)["integrity"]["valid"])
            with self.assertRaisesRegex(ValueError, "changed outside"):
                case_store.save_case(root, name, v)

    def test_migrating_a_legacy_number_with_spacing_or_filename_characters(self):
        """The pending transaction is named from the normalized number read_intent checks; a raw number with doubled
        spaces or a slash once left an intent that could never be read, blocking every case on the share."""
        for number in ("CB 2026  01", "CB/2026/01", "cb2026-000-00001"):
            with self.subTest(number=number), tempfile.TemporaryDirectory() as directory:
                folder = Path(directory)
                legacy = {"format": "madison-case-file", "schema": 4, "case": {"id": "c1", "number": number}, "events": [], "inspectors": []}
                name = "1 MAIN ST - " + case_store.case_number_key(number).upper().replace("/", "-") + ".json"
                (folder / name).write_text(json.dumps(legacy))
                base = case_store.digest((folder / name).read_bytes())
                self.assertTrue(case_store.save_case(folder, name, dict(legacy, schema=5), base_revision=base)["ok"])
                self.assertEqual(list((folder / "_integrity" / "transactions").glob("*.json")), [])
                self.assertEqual(integrity.VerificationContext(folder).pending, {})
                self.assertTrue(case_store.read_case(folder, name)["integrity"]["valid"])
        self.assertEqual(integrity.intent_path("f", "CB2026-1").name, integrity.intent_path("f", "cb2026-1").name)

    def test_disjoint_annotations_with_clock_skew(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            v = self.fixture()
            name = "101 TEST - " + v["case"]["number"] + ".json"
            first = case_store.save_case(root, name, v)
            a, b = copy.deepcopy(v), copy.deepcopy(v)
            for data, identity, at in ((a, "note_a", "2026-08-02T15:00:00Z"), (b, "note_b", "2026-08-02T14:00:00Z")):
                data["events"].append(
                    {
                        "id": identity,
                        "type": "document.annotated",
                        "at": at,
                        "by": "inspector_1",
                        "payload": {"docId": "initial_citation", "text": "Synthetic disjoint note"},
                    }
                )
            with ThreadPoolExecutor(2) as pool:
                list(pool.map(lambda x: case_store.save_case(root, name, x, first["revision"], v["case"]), [a, b]))
            result = case_store.read_case(root, name)
            self.assertTrue(result["integrity"]["valid"])
            ids = [x["eventId"] for x in result["file"]["integrity"]["entries"]]
            self.assertEqual(len(ids), len(set(ids)))
            self.assertIn("note_a", ids)
            self.assertIn("note_b", ids)

    def test_external_anchor_detects_whole_rewrite(self):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as external:
            root = Path(folder)
            v = integrity.commit_record(None, self.fixture())
            name = "case.json"
            (root / name).write_text(json.dumps(v))
            integrity.anchor_daily(root, Path(external))
            altered = copy.deepcopy(self.fixture())
            altered["case"]["owner"] = "Whole file rewrite"
            altered = integrity.commit_record(None, altered)
            self.assertFalse(integrity.verify_record(altered, root, Path(external))["valid"])
            (root / "_integrity").joinpath(next((root / "_integrity").glob("*.json")).name).write_text("{}")
            self.assertFalse(integrity.verify_record(v, root, Path(external))["valid"])

    def test_canonical_corpus(self):
        cases = json.loads(Path("tests/fixtures/reference/canonical-corpus.json").read_text())
        answers = [{"value": v, "canonical": integrity.canonical(v).decode(), "hash": integrity.hash_bytes(integrity.canonical(v))} for v in cases]
        Path("build/test-results/integrity-corpus.json").write_text(json.dumps(answers, ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()
