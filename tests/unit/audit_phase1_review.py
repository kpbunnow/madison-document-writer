"""Regressions for Phase 0/1 diagnostics: real cohort scope, invalid mutants, complete denominators,
language-order dependency barriers and exact input binding. No analysis dependencies or application startup."""

import copy
import hashlib
import json
import subprocess
from types import SimpleNamespace
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import measure_coverage as coverage_tool
import measure_maintainability as metrics
import mutation_pilot


class CohortScope(unittest.TestCase):
    def test_javascript_cohort_filters_functions_and_checked_share(self):
        data = {
            "scope": {"files": 2, "logicLines": 30},
            "files": [{"file": "app/a.js", "logicLines": 10}, {"file": "app/b.js", "logicLines": 20}],
            "functions": {"app/a.js:f#1": {"complexity": 2, "lines": 3}, "app/b.js:g#1": {"complexity": 99, "lines": 200}},
            "checkedCode": {"files": ["app/b.js"], "inScope": ["app/b.js"], "logicLines": 20, "share": 2 / 3},
        }
        with patch.object(metrics, "run_json", return_value=copy.deepcopy(data)):
            result = metrics.js_metrics(["app/a.js"])
        self.assertEqual(result["scope"], {"files": 1, "logicLines": 10})
        self.assertEqual(result["summary"]["complexity"]["max"], 2)
        self.assertEqual(result["summary"]["longFunctionsAbove80"], [])
        self.assertEqual(result["checkedCode"]["inScope"], [])
        self.assertEqual(result["checkedCode"]["share"], 0)
        self.assertIn("entire checkout", result["structuralScope"])
        with patch.object(metrics, "run_json", return_value=copy.deepcopy(data)), self.assertRaisesRegex(ValueError, "omitted"):
            metrics.js_metrics(["app/missing.js"])


class MutationValidity(unittest.TestCase):
    def test_invalid_python_is_not_a_kill_and_never_runs_tests(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / "mod.py"
            original = "def value():\n    return 1\n"
            target.write_text(original, encoding="utf-8")
            mutant = {"file": "mod.py", "find": "return 1", "replace": "return ???", "suites": ["probe.py"]}
            with patch.object(mutation_pilot, "run_suites", side_effect=AssertionError("invalid code must not run")):
                result = mutation_pilot.trial(root, {}, mutant)
            self.assertEqual(result["outcome"], "invalid")
            self.assertEqual(target.read_text(encoding="utf-8"), original)

    def test_valid_python_kill_restores_the_source(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            target = root / "mod.py"
            original = "def value():\n    return 1\n"
            target.write_text(original, encoding="utf-8")
            mutant = {"file": "mod.py", "find": "return 1", "replace": "return 2", "suites": ["probe.py"]}

            def run(*_):
                self.assertIn("return 2", target.read_text(encoding="utf-8"))
                return "failed:probe.py"

            with patch.object(mutation_pilot, "run_suites", side_effect=run):
                self.assertEqual(mutation_pilot.trial(root, {}, mutant)["outcome"], "killed")
            self.assertEqual(target.read_text(encoding="utf-8"), original)

    def test_abnormal_process_outcomes_are_not_kills(self):
        for code, expected in [(0, "passed"), (1, "failed:probe.py"), (-9, "invalid:probe.py"), (None, "invalid:probe.py")]:
            with self.subTest(code=code), patch.object(mutation_pilot.subprocess, "run", return_value=SimpleNamespace(returncode=code)):
                self.assertEqual(mutation_pilot.run_suites(Path("."), {}, ["probe.py"]), expected)
        for error, expected in [(OSError("spawn"), "invalid:probe.py"), (subprocess.TimeoutExpired("probe", 1), "timeout:probe.py")]:
            with patch.object(mutation_pilot.subprocess, "run", side_effect=error):
                self.assertEqual(mutation_pilot.run_suites(Path("."), {}, ["probe.py"]), expected)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "mod.py").write_text("value = 1\n", encoding="utf-8")
            mutant = {"file": "mod.py", "find": "1", "replace": "2", "suites": ["probe.py"]}
            for result, expected in [("invalid:probe.py", "invalid"), ("timeout:probe.py", "timeout"), ("passed", "survived")]:
                with patch.object(mutation_pilot, "run_suites", return_value=result):
                    self.assertEqual(mutation_pilot.trial(root, {}, mutant)["outcome"], expected)
                self.assertEqual((root / "mod.py").read_text(encoding="utf-8"), "value = 1\n")

    def test_unknown_and_empty_selection_cannot_report_zero_mutants_as_success(self):
        mutants = [{"id": "first"}, {"id": "second"}]
        self.assertEqual(mutation_pilot.select_mutants(mutants, None), mutants)
        self.assertEqual(mutation_pilot.select_mutants(mutants, ["second"]), [mutants[1]])
        for selection in [[], ["typo"], ["first", "typo"]]:
            with self.subTest(selection=selection), self.assertRaisesRegex(ValueError, "known"):
                mutation_pilot.select_mutants(mutants, selection)


class CoverageInputs(unittest.TestCase):
    def test_unreported_maintained_python_file_refuses_partial_denominator(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            run, aux = root / "repo", root / "aux"
            (run / "helper").mkdir(parents=True)
            (run / "helper" / "never.py").write_text("value = 1\n", encoding="utf-8")
            (run / "helper" / "vendor").mkdir()
            (run / "helper" / "vendor" / "ignored.py").write_text("value = 1\n", encoding="utf-8")
            (aux / "data").mkdir(parents=True)
            result = aux / "python-coverage.json"
            result.write_text('{"files": {}}', encoding="utf-8")
            with patch.object(coverage_tool, "coverage_command", return_value=[]), self.assertRaisesRegex(ValueError, "helper/never.py"):
                coverage_tool.python_files(run, aux, Path("analysis"), {})
            summary = {"num_statements": 1, "covered_lines": 0, "num_branches": 0, "covered_branches": 0}
            result.write_text(json.dumps({"files": {"helper/never.py": {"summary": summary, "missing_lines": [1]}}}), encoding="utf-8")
            with patch.object(coverage_tool, "coverage_command", return_value=[]):
                report = coverage_tool.python_files(run, aux, Path("analysis"), {})
            self.assertFalse(report["helper/never.py"]["executed"])
            self.assertEqual(report["helper/never.py"]["statements"], 1)

    def test_all_javascript_producers_finish_before_python_consumers(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            unit = root / "tests" / "unit"
            unit.mkdir(parents=True)
            for name in ["audit_a.js", "audit_b.js", "audit_consumer.py"]:
                (unit / name).write_text("", encoding="utf-8")
            ready, consumer = threading.Event(), threading.Event()

            def suite(_run, _env, path):
                if path.name == "audit_a.js":
                    consumer.wait(0.1)
                    ready.set()
                elif path.suffix == ".py":
                    consumer.set()
                    self.assertTrue(ready.is_set(), "Python ran before its JavaScript producer finished")
                return {"suite": path.name, "status": "passed"}

            with (
                patch.object(coverage_tool, "run_suite", side_effect=suite),
                patch.object(coverage_tool.suite_classes, "uses_browser", return_value=False),
            ):
                result = coverage_tool.run_suites(root, {}, None, 2)
            self.assertEqual(len(result["run"]), 3)
            with self.assertRaisesRegex(ValueError, "Unknown"):
                coverage_tool.run_suites(root, {}, ["typo.py"], 2)

    def test_source_hash_identity_and_file_set_must_all_stay_unchanged(self):
        before = {"commit": "a", "tree": "b", "clean": True}
        inputs = {"helper/a.py": hashlib.sha256(b"a").hexdigest()}
        with patch.object(coverage_tool, "source_state", return_value=before), patch.object(coverage_tool, "source_inputs", return_value=inputs):
            receipt = coverage_tool.verify_source(before, inputs)
        self.assertEqual(receipt["inputs"], inputs)
        self.assertEqual(receipt["commit"], "a")
        for state, changed in [
            ({**before, "commit": "different"}, inputs),
            (before, {"helper/a.py": "changed"}),
            (before, {**inputs, "helper/new.py": "new"}),
        ]:
            with patch.object(coverage_tool, "source_state", return_value=state), patch.object(coverage_tool, "source_inputs", return_value=changed):
                with self.assertRaisesRegex(ValueError, "Source changed"):
                    coverage_tool.verify_source(before, inputs)


if __name__ == "__main__":
    unittest.main()
