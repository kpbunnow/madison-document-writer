"""Before/after read comparisons retain every case proof and reject mixed or missing evidence."""

import copy
import json
from pathlib import Path
import tempfile
import sys
import types
import unittest
from unittest.mock import patch
from compare_reporting_reads import HARNESS, compare, fixture_hash, measure, run_worker, source_identity, verify_source_modules


def run(after=False):
    operation = {
        "seconds": 1 if after else 2,
        "resultSha256": "a" * 64,
        "proofs": 5,
        "reads": {"case": 5, "summary": 5 if after else 10},
        "peakReaders": 4,
    }
    return {
        "cases": 5,
        "fixtureSha256": "b" * 64,
        "python": "3.14.10",
        "platform": "synthetic",
        "latency": "local",
        "operations": {"reports": copy.deepcopy(operation), "open-case-dues": copy.deepcopy(operation)},
    }


def pairs():
    return [{"order": ["after", "before"] if n % 2 else ["before", "after"], "before": run(), "after": run(True)} for n in range(4)]


class Comparisons(unittest.TestCase):
    def test_runtime_inputs_are_part_of_source_identity(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "build/dist").mkdir(parents=True)
            runtime = root / "build/dist/writer.html"
            runtime.write_text("before", encoding="utf-8")
            before = source_identity(root)
            runtime.write_text("after", encoding="utf-8")
            after = source_identity(root)
            self.assertIsNone(before["sourceCommit"], "extracted sources must not inherit the harness commit")
            self.assertNotEqual(before["verifiedInputsSha256"], after["verifiedInputsSha256"])

    def test_actual_read_metrics_and_execution_classes(self):
        import case_integrity
        from audit_r49_readiness import fixture
        from suite_classes import uses_browser

        self.assertTrue(uses_browser(HARNESS / "tests/unit/audit_benchmark_comparison.js"))
        self.assertFalse(uses_browser(Path(__file__)))
        with tempfile.TemporaryDirectory() as tmp:
            foreign = types.SimpleNamespace(__file__=str(Path(tmp) / "helper/foreign.py"))
            with patch.dict(sys.modules, {"foreign_helper": foreign}):
                with self.assertRaisesRegex(ValueError, "Mixed helper"):
                    verify_source_modules(HARNESS)
            folder = Path(tmp)
            fixture(folder, 5)
            expected = fixture_hash(folder)
            with patch.object(case_integrity, "SETTINGS", folder.parent / "absent-synthetic-settings.json"):
                result = measure(HARNESS, folder, 5, "local")
            self.assertEqual(fixture_hash(folder), expected)
            for op in result["operations"].values():
                self.assertEqual(op["proofs"], 5)
                self.assertEqual(op["reads"]["case"], 5)
                self.assertEqual(op["reads"]["summary"], 5)
                self.assertEqual(op["reads"]["summaryScans"], 1)
                self.assertLessEqual(op["peakReaders"], 4)

    def test_paired_results_and_raw_preservation(self):
        values = pairs()
        saved = copy.deepcopy(values)
        result = compare(values)
        self.assertEqual(result["mode"], "diagnostic-only")
        self.assertTrue(result["resultsEqual"])
        self.assertTrue(all(r["percentLessTime"] == 50 for r in result["rows"]))
        self.assertEqual(values, saved)
        for pair in values:
            pair["after"] = copy.deepcopy(pair["before"])
        self.assertTrue(all(r["percentLessTime"] == 0 for r in compare(values)["rows"]))

    def test_mixed_inputs_and_missing_work_fail(self):
        for key, value in [("fixtureSha256", "f" * 64), ("cases", 4), ("python", "other"), ("platform", "other"), ("latency", "synthetic")]:
            with self.subTest(key=key):
                values = pairs()
                values[2]["after"][key] = value
                with self.assertRaises(ValueError):
                    compare(values)
        for key, value in [("resultSha256", "c" * 64), ("proofs", 4), ("peakReaders", 5), ("seconds", float("nan")), ("seconds", -1)]:
            with self.subTest(key=key):
                values = pairs()
                values[2]["after"]["operations"]["reports"][key] = value
                with self.assertRaises(ValueError):
                    compare(values)
        values = pairs()
        del values[2]["after"]["operations"]["open-case-dues"]
        with self.assertRaises(ValueError):
            compare(values)
        values = pairs()
        values[2]["after"]["operations"]["reports"]["reads"]["case"] = 4
        with self.assertRaises(ValueError):
            compare(values)
        with self.assertRaises(ValueError):
            compare(pairs()[:3])
        values = pairs()
        values[1]["order"].reverse()
        with self.assertRaises(ValueError):
            compare(values)

    def test_worker_cannot_mutate_fixture_or_substitute_workload(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp) / "fixture"
            folder.mkdir()
            data = folder / "input.json"
            data.write_text("{}", encoding="utf-8")
            expected = fixture_hash(folder)
            output = Path(tmp) / "result.json"

            def worker(*args, **kwargs):
                value = run()
                value["fixtureSha256"] = expected
                output.write_text(json.dumps(value), encoding="utf-8")
                data.write_text('{"changed":true}', encoding="utf-8")

            with patch("compare_reporting_reads.subprocess.run", side_effect=worker):
                with self.assertRaisesRegex(ValueError, "fixture changed"):
                    run_worker(Path(tmp), folder, 5, "local", output, expected)
            data.write_text("{}", encoding="utf-8")
            output.write_text(json.dumps(run()), encoding="utf-8")
            with patch("compare_reporting_reads.subprocess.run"):
                with self.assertRaisesRegex(ValueError, "requested workload"):
                    run_worker(Path(tmp), folder, 6, "local", output, expected)


if __name__ == "__main__":
    unittest.main()
