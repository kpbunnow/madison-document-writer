"""R49 bounded read concurrency, independent proofs and deterministic failures."""

import copy
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import case_integrity as integrity
import case_store as store
import reporting_reads
import server
from audit_helper import record


def fixture(root, count):
    idx = root / "Reporting Index"
    idx.mkdir()
    entries = []
    for n in range(count):
        value = record()
        value["schema"] = 5
        value["case"].update(number="QA-" + str(n), id="case_" + str(n))
        value = integrity.commit_record(None, value)
        name = "TEST - QA-" + str(n) + ".json"
        raw = store.encoded(value)
        (root / name).write_bytes(raw)
        entries.append(
            {"caseNumber": value["case"]["number"], "fileName": name, "genesisHash": value["integrity"]["genesis"]["hash"], "migratedAt": "synthetic"}
        )
        (idx / ("qa-" + str(n) + ".json")).write_text(
            json.dumps(
                {
                    "format": "madison-case-summary",
                    "summaryVersion": 6,
                    "case": value["case"],
                    "sourceFile": name,
                    "sourceRevision": hashlib.sha256(raw).hexdigest(),
                    "integrity": {"headHash": value["integrity"]["headHash"]},
                }
            )
        )
    (root / "_integrity").mkdir()
    (root / "_integrity/migrated.json").write_text(json.dumps({"format": "madison-migration-registry", "entries": entries}))


class ProductionReadiness(unittest.TestCase):
    def test_bounded_ordered_read_only_batches(self):
        lock = threading.Lock()
        active = 0
        maximum = 0
        started = []

        def read(n):
            nonlocal active, maximum
            with lock:
                active += 1
                maximum = max(maximum, active)
                started.append(n)
            time.sleep(0.002 * (4 - n % 4))
            with lock:
                active -= 1
            return n

        stream = reporting_reads.ordered_reads(range(65), read, 4)
        self.assertEqual(next(stream), 0)
        self.assertLessEqual(len(started), 16)
        self.assertEqual([0, *stream], list(range(65)))
        self.assertLessEqual(maximum, 4)
        self.assertGreater(maximum, 1)
        for n in (0, 5, -1):
            with self.assertRaises(ValueError):
                list(reporting_reads.ordered_reads([], read, n))

    def test_serial_parallel_equivalence_and_anchored_integrity(self):
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as external:
            root = Path(folder)
            anchor = Path(external)
            fixture(root, 8)
            with patch.object(integrity, "protected_folder", return_value=anchor):
                integrity.anchor_daily(root, anchor)
            idx = root / "Reporting Index"
            (idx / "duplicate.json").write_bytes((idx / "qa-1.json").read_bytes())
            (idx / "bad.json").write_text("{bad json")
            s = json.loads((idx / "qa-2.json").read_bytes())
            s["sourceRevision"] = "wrong"
            (idx / "qa-2.json").write_text(json.dumps(s))
            (idx / "qa-3.json").unlink()
            s = json.loads((idx / "qa-4.json").read_bytes())
            s["sourceFile"] = "different.json"
            (idx / "qa-4.json").write_text(json.dumps(s))
            # The projection matches the rewritten bytes, so only independent integrity can reject this rewrite.
            p = root / "TEST - QA-5.json"
            v = json.loads(p.read_bytes())
            v["case"]["owner"] = "Outside rewrite"
            raw = store.encoded(v)
            p.write_bytes(raw)
            s = json.loads((idx / "qa-5.json").read_bytes())
            s["sourceRevision"] = hashlib.sha256(raw).hexdigest()
            (idx / "qa-5.json").write_text(json.dumps(s))
            with patch.object(server, "case_dir", return_value=root), patch.object(integrity, "protected_folder", return_value=anchor):
                serial = server.read_index(1)
                parallel = server.read_index(4)
            serial.pop("readAt")
            parallel.pop("readAt")
            self.assertEqual(serial, parallel)
            self.assertEqual(len(parallel["summaries"]), 3)
            self.assertTrue(all(s["integrity"]["anchored"] for s in parallel["summaries"]))
            self.assertTrue(any("qa-5.json" in s for s in parallel["unreadable"]))
            self.assertNotIn("QA-1", [s["case"]["number"] for s in parallel["summaries"]])
            self.assertEqual(parallel["stale"], ["TEST - QA-2.json"])

    def test_two_requests_do_not_share_context_or_trust(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            first, second = Path(a), Path(b)
            fixture(first, 40)
            fixture(second, 40)
            (second / "_integrity/migrated.json").write_text("{damaged")
            current = threading.local()

            def run(root):
                current.root = root
                return server.read_index(4)

            with patch.object(server, "case_dir", side_effect=lambda: current.root), ThreadPoolExecutor(max_workers=2) as pool:
                good, bad = list(pool.map(run, [first, second]))
            self.assertEqual(len(good["summaries"]), 40)
            self.assertFalse(bad["ok"])
            self.assertEqual(bad["summaries"], [])
            self.assertIn("Migration registry is damaged", bad["error"])
            p = first / "TEST - QA-0.json"
            v = json.loads(p.read_bytes())
            v["case"]["owner"] = "Changed between requests"
            p.write_bytes(store.encoded(v))
            with patch.object(server, "case_dir", return_value=first):
                fresh = server.read_index(4)
            self.assertEqual(len(fresh["summaries"]), 39)
            self.assertIn(p.name, fresh["stale"])

    def test_summary_indicator_still_rejects_legacy_downgrade(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            fixture(root, 1)
            p = root / "TEST - QA-0.json"
            v = json.loads(p.read_bytes())
            v.pop("integrity")
            v["schema"] = 4
            # Remove modern payload indicators to isolate the retained summary evidence itself.
            v["events"] = []
            raw = store.encoded(v)
            p.write_bytes(raw)
            (root / "_integrity/migrated.json").unlink()
            s = json.loads((root / "Reporting Index/qa-0.json").read_bytes())
            s["sourceRevision"] = hashlib.sha256(raw).hexdigest()
            (root / "Reporting Index/qa-0.json").write_text(json.dumps(s))
            with patch.object(server, "case_dir", return_value=root):
                result = server.read_index(4)
            self.assertEqual(result["summaries"], [])
            self.assertTrue(any("removed from a migrated case" in e for e in result["unreadable"]))

    def test_legal_hold_and_publication_owners_unchanged(self):
        from audit_r28_helper import pair

        value = pair()
        value["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]["mandatoryAppearance"] = True
        with self.assertRaisesRegex(ValueError, "division-approved defendant instructions"):
            store.validate_history(copy.deepcopy(value))
        store.validate_history(value, {e["id"] for e in value["events"]})


if __name__ == "__main__":
    unittest.main()
