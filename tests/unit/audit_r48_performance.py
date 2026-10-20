"""R48 real independent index verification with deterministic per-file latency."""

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
import server
from audit_helper import record


class Responsiveness(unittest.TestCase):
    def test_scale_and_explicit_latency(self):
        Path("build/test-results").mkdir(exist_ok=True)
        results = []
        for count in (600, 3000):
            with tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                idx = root / "Reporting Index"
                idx.mkdir()
                entries = []
                for n in range(count):
                    v = record()
                    v["schema"] = 5
                    v["case"].update(number="QA-" + str(n), id="case_" + str(n))
                    v = integrity.commit_record(None, v)
                    name = "TEST - " + v["case"]["number"] + ".json"
                    raw = store.encoded(v)
                    (root / name).write_bytes(raw)
                    entries.append(
                        {
                            "caseNumber": v["case"]["number"],
                            "fileName": name,
                            "genesisHash": v["integrity"]["genesis"]["hash"],
                            "migratedAt": "synthetic",
                        }
                    )
                    (idx / (v["case"]["number"] + ".json")).write_text(
                        json.dumps(
                            {
                                "format": "madison-case-summary",
                                "summaryVersion": 6,
                                "case": v["case"],
                                "sourceFile": name,
                                "sourceRevision": hashlib.sha256(raw).hexdigest(),
                                "integrity": {"headHash": v["integrity"]["headHash"]},
                            }
                        )
                    )
                (root / "_integrity").mkdir()
                (root / "_integrity/migrated.json").write_text(json.dumps({"format": "madison-migration-registry", "entries": entries}))
                for latency in (False, True):
                    reads = {"summary": 0, "case": 0, "evidence": 0}
                    delay_total = 0.0
                    counter = threading.Lock()
                    real = Path.read_bytes
                    real_text = Path.read_text

                    def pause(path):
                        nonlocal delay_total
                        if not path.is_relative_to(root):
                            return
                        kind = "summary" if path.parent == idx else "case" if path.parent == root and path.suffix == ".json" else "evidence"
                        with counter:
                            reads[kind] += 1
                            n = sum(reads.values()) % 20
                            delay = 0.0005 if n < 16 else 0.002 if n < 19 else 0.008
                            if latency:
                                delay_total += delay
                        if latency:
                            time.sleep(delay)

                    def read(path):
                        pause(path)
                        return real(path)

                    def text(path, *args, **kwargs):
                        pause(path)
                        return real_text(path, *args, **kwargs)

                    start = time.perf_counter()
                    with (
                        patch.object(Path, "read_bytes", read),
                        patch.object(Path, "read_text", text),
                        patch.object(server, "case_dir", return_value=root),
                    ):
                        result = server.read_index()
                    elapsed = time.perf_counter() - start
                    self.assertEqual(len(result["summaries"]), count)
                    self.assertEqual(reads["summary"], count * 2)
                    self.assertEqual(reads["case"], count)
                    self.assertFalse(result["stale"] or result["missing"] or result["unreadable"])
                    results.append(
                        {
                            "cases": count,
                            "profile": "injected LAN file latency" if latency else "local filesystem",
                            "fileReads": reads,
                            "injectedSeconds": round(delay_total, 4),
                            "elapsedSeconds": round(elapsed, 4),
                            "acceptedSummaries": len(result["summaries"]),
                        }
                    )
                # Another request must independently detect changed bytes and retain exact mismatch exclusion.
                p = root / "TEST - QA-0.json"
                v = json.loads(p.read_bytes())
                v["case"]["owner"] = "Outside edit"
                p.write_bytes(store.encoded(v))
                with patch.object(server, "case_dir", return_value=root):
                    changed = server.read_index()
                self.assertEqual(len(changed["summaries"]), count - 1)
                self.assertIn(p.name, changed["stale"])
        Path("build/test-results/r48-scaling.json").write_text(
            json.dumps(
                {
                    "profile": {
                        "perFileMs": {"0.5": 0.8, "2": 0.15, "8": 0.05},
                        "scope": (
                            "Every shared-fixture Path.read_bytes/read_text call, including reque"
                            "st evidence; local application settings reads are excluded. Illustra"
                            "tive healthy LAN plus tail latency; not measured City SMB. OS schedu"
                            "ling overhead included. Directory enumeration latency is not injecte"
                            "d."
                        ),
                        "baseline": (
                            "R40 1200/6000 summary reads for 600/3000, retained by R49 bounded re"
                            "ad-only I/O with the same independent revision and chain checks."
                        ),
                        "budgets": (
                            "Local already-loaded transition target <2s measured in production br"
                            "owser. City routine refresh target <5s remains provisional and unval"
                            "idated; City measurements remain required even if the illustrative f"
                            "ixture meets it. No approved City performance environment was availa"
                            "ble."
                        ),
                    },
                    "measurements": results,
                },
                indent=2,
            )
            + "\n"
        )


if __name__ == "__main__":
    unittest.main()
