"""Before/after latency with unchanged read counts and independent full proofs."""

from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import statistics
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import case_integrity as integrity
import case_store as store
import server
from audit_r49_readiness import fixture
from report_summaries import report_summary


class MeasuredReporting(unittest.TestCase):
    def test_serial_baseline_parallel_refresh_and_history(self):
        Path("build/test-results").mkdir(exist_ok=True)
        results = []
        for count in (600, 3000):
            with tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                fixture(root, count)
                for workers in (1, 4):
                    samples = []
                    counts = []
                    for _ in range(3):
                        lock = threading.Lock()
                        reads = {"summary": 0, "case": 0, "evidence": 0}
                        active = 0
                        peak = 0
                        real_bytes = Path.read_bytes
                        real_text = Path.read_text

                        def before(path):
                            nonlocal active, peak
                            if not path.is_relative_to(root):
                                return False
                            kind = "summary" if path.parent.name == "Reporting Index" else "case" if path.parent == root else "evidence"
                            with lock:
                                reads[kind] += 1
                                active += 1
                                peak = max(peak, active)
                                n = sum(reads.values()) % 20
                            time.sleep(0.0005 if n < 16 else 0.002 if n < 19 else 0.008)
                            return True

                        def after(counted):
                            nonlocal active
                            if counted:
                                with lock:
                                    active -= 1

                        def byte_read(path):
                            counted = before(path)
                            try:
                                return real_bytes(path)
                            finally:
                                after(counted)

                        def text_read(path, *args, **kwargs):
                            counted = before(path)
                            try:
                                return real_text(path, *args, **kwargs)
                            finally:
                                after(counted)

                        start = time.perf_counter()
                        with (
                            patch.object(Path, "read_bytes", byte_read),
                            patch.object(Path, "read_text", text_read),
                            patch.object(server, "case_dir", return_value=root),
                        ):
                            value = server.read_index(workers)
                        elapsed = time.perf_counter() - start
                        samples.append(elapsed)
                        counts.append(reads)
                        self.assertEqual(len(value["summaries"]), count)
                        self.assertEqual(reads["summary"], count * 2)
                        self.assertEqual(reads["case"], count)
                        self.assertLessEqual(peak, workers)
                        self.assertTrue(all(s["integrity"]["valid"] for s in value["summaries"]))
                    results.append(
                        {
                            "cases": count,
                            "readers": workers,
                            "samplesSeconds": [round(x, 4) for x in samples],
                            "medianSeconds": round(statistics.median(samples), 4),
                            "maximumSeconds": round(max(samples), 4),
                            "fileReads": counts,
                            "allCaseProofsVerified": True,
                        }
                    )
                self.assertLess(results[-1]["medianSeconds"], results[-2]["medianSeconds"] * 0.75, "Measured I/O improvement must be real")
        with tempfile.TemporaryDirectory() as folder, tempfile.TemporaryDirectory() as external:
            root = Path(folder)
            anchor = Path(external)
            fixture(root, 16)
            for n in range(16):
                name = "TEST - QA-" + str(n) + ".json"
                value = json.loads((root / name).read_bytes())
                for j in range(80):
                    previous = value
                    value = {
                        **value,
                        "events": value["events"]
                        + [
                            {
                                "id": "note_" + str(j),
                                "at": "2026-10-16T12:00:00Z",
                                "by": "qa",
                                "type": "record.note",
                                "payload": {"note": "Synthetic long-history fixture " + str(j)},
                            }
                        ],
                    }
                    value = integrity.commit_record(previous, value)
                raw = store.encoded(value)
                (root / name).write_bytes(raw)
                # The summary of the extended history, as the Writer would rewrite it.
                s = report_summary(
                    value, sourceFile=name, sourceRevision=integrity.hash_bytes(raw), integrity={"headHash": value["integrity"]["headHash"]}
                )
                (root / "Reporting Index" / ("qa-" + str(n) + ".json")).write_text(json.dumps(s))
            with patch.object(integrity, "protected_folder", return_value=anchor):
                integrity.anchor_daily(root, anchor)
            with (
                patch.object(server, "case_dir", return_value=root),
                patch.object(integrity, "protected_folder", return_value=anchor),
                ThreadPoolExecutor(max_workers=2) as clients,
            ):
                snapshots = list(clients.map(lambda _: server.read_index(4), range(2)))
            for snapshot in snapshots:
                self.assertEqual(len(snapshot["summaries"]), 16)
                self.assertTrue(all(s["integrity"]["anchored"] for s in snapshot["summaries"]))
        Path("build/test-results/r49-performance.json").write_text(
            json.dumps(
                {
                    "profile": (
                        "R48-equivalent one-reader baseline and R49 four-reader implementatio"
                        "n; identical 0.5/2/8 ms 80/15/5 percent shared-file latency, three r"
                        "uns each, enumeration/local settings excluded. This is not approved "
                        "City SMB timing."
                    ),
                    "measurements": results,
                    "longHistory": {"cases": 16, "additionalCommitsPerCase": 80, "concurrentIndependentReaders": 2, "protectedAnchorsVerified": True},
                    "cityAcceptance": (
                        "Open: repeat on approved City PCs/share with real history/anchor vol"
                        "umes, cold/warm reads, concurrency and agreed median/tail budgets. S"
                        "ynthetic fixture success cannot grant City approval."
                    ),
                },
                indent=2,
            )
            + "\n"
        )


if __name__ == "__main__":
    unittest.main()
