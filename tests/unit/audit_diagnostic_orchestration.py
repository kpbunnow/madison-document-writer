"""Diagnostic orchestration must bind synthetic source, refuse drift and retain isolated production/test copies.
No optional analyzer installation, nested full gate or parent evidence is used.
"""

import contextlib
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import measure_coverage as coverage_tool
import measure_maintainability as metrics


class DiagnosticOrchestration(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.root = self.base / "source"
        self.root.mkdir()
        for name, data in {
            ".gitignore": "node_modules/\n",
            "app/modules/sample.js": "export const sample = 1;\n",
            "app/assets/shared.js": "export const shared = 1;\n",
            "helper/sample.py": "sample = 1\n",
            "tools/sample.py": "sample = 2\n",
            "policy/sample.py": "sample = 3\n",
            "version.json": json.dumps({"release": "synthetic-diagnostic", "caseSchema": 5}),
            "node_modules/eslint/package.json": json.dumps({"version": "synthetic-eslint"}),
            "node_modules/typescript/package.json": json.dumps({"version": "synthetic-typescript"}),
        }.items():
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(data, encoding="utf-8")
        for command in [
            ["git", "init", "-q", "-b", "synthetic"],
            ["git", "add", "-A"],
            ["git", "-c", "user.name=Synthetic", "-c", "user.email=synthetic@invalid", "commit", "-q", "-m", "synthetic"],
        ]:
            subprocess.run(command, cwd=self.root, check=True, capture_output=True)
        for owner in [metrics, coverage_tool]:
            guard = patch.object(owner, "ROOT", self.root)
            guard.start()
            self.addCleanup(guard.stop)
        scope = patch.object(metrics, "SCOPE_AT", None)
        scope.start()
        self.addCleanup(scope.stop)

    def test_source_receipt_detects_byte_and_tree_drift_and_historical_scope_keeps_exact_files(self):
        before, inputs = coverage_tool.source_state(), coverage_tool.source_inputs()
        receipt = coverage_tool.verify_source(before, inputs)
        self.assertTrue(receipt["clean"])
        self.assertEqual(receipt["inputs"], inputs)
        file = self.root / "helper/sample.py"
        file.write_text("sample = 99\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "Source changed"):
            coverage_tool.verify_source(before, inputs)
        with patch.object(metrics, "SCOPE_AT", before["commit"]):
            self.assertEqual(metrics.in_scope(["helper/sample.py", "helper/not-in-commit.py"]), ["helper/sample.py"])
        self.assertEqual(metrics.python_scope(), {"runtime": ["helper/sample.py"], "developer": ["policy/sample.py", "tools/sample.py"]})
        total, per = metrics.digest(["helper/sample.py"])
        self.assertEqual(per["helper/sample.py"], hashlib.sha256(file.read_bytes()).hexdigest())
        self.assertEqual(len(total), 64)

    def test_external_measurement_failure_and_bad_json_cannot_be_reported_as_success(self):
        self.assertEqual(metrics.run_json([sys.executable, "-c", 'print("{\\"synthetic\\": true}")']), {"synthetic": True})
        with self.assertRaisesRegex(SystemExit, "Measurement command failed"):
            metrics.run_json([sys.executable, "-c", 'import sys; print("synthetic refusal",file=sys.stderr);sys.exit(2)'])
        with self.assertRaises(json.JSONDecodeError):
            metrics.run_json([sys.executable, "-c", 'print("not JSON")'])
        with patch.object(metrics, "run_json", return_value={"files": []}):
            with self.assertRaisesRegex(ValueError, "omitted a scoped file"):
                metrics.js_metrics(["app/modules/sample.js"])

    def test_toolchain_receipt_reads_pinned_package_versions_and_original_commands(self):
        commands = []

        def run(command, **kwargs):
            commands.append(command)
            return subprocess.CompletedProcess(command, 0, "synthetic-command-version\nextra diagnostic line\n", "")

        with patch.object(subprocess, "run", side_effect=run):
            versions = metrics.tool_versions(Path("synthetic-analysis"))
        self.assertEqual(versions["eslint"], "synthetic-eslint")
        self.assertEqual(versions["typescript"], "synthetic-typescript")
        self.assertEqual(versions["python"], sys.version.split()[0])
        self.assertEqual(versions["radon"], "synthetic-command-version")
        self.assertEqual(
            commands,
            [
                ["node", "--version"],
                [sys.executable, "-m", "ruff", "--version"],
                ["synthetic-analysis", "--version"],
                ["synthetic-analysis", "-m", "radon", "--version"],
            ],
        )

    def test_actual_metrics_cli_writes_bound_source_and_refuses_mid_measurement_changes(self):
        analysis = self.base / "synthetic-analysis"
        analysis.touch()
        out = self.base / "metrics"

        def javascript(files):
            self.assertEqual(files, ["app/assets/shared.js", "app/modules/sample.js"])
            return {"synthetic": True}

        def run(drift=False):
            def python_metrics(_):
                if drift:
                    (self.root / "helper/sample.py").write_text("sample = 99\n", encoding="utf-8")
                return {"synthetic": True}

            with (
                patch.object(sys, "argv", ["measure", "--out", str(out), "--analysis-python", str(analysis)]),
                patch.object(metrics, "tool_versions", return_value={"synthetic": True}),
                patch.object(metrics, "js_metrics", side_effect=javascript),
                patch.object(metrics, "python_metrics", side_effect=python_metrics),
                patch.object(metrics, "markdown", return_value="Synthetic diagnostic only"),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                metrics.main()

        run()
        value = json.loads((out / "metrics.json").read_text(encoding="utf-8"))
        self.assertEqual(value["measurementSource"]["inputs"], coverage_tool.source_inputs())
        self.assertEqual(value["source"]["commit"], coverage_tool.source_state()["commit"])
        self.assertEqual(
            set(value["source"]["inputs"]),
            {"app/assets/shared.js", "app/modules/sample.js", "helper/sample.py", "tools/sample.py", "policy/sample.py"},
        )
        retained = (out / "metrics.json").read_bytes()
        with self.assertRaisesRegex(ValueError, "Source changed"):
            run(drift=True)
        self.assertEqual((out / "metrics.json").read_bytes(), retained, "refused run cannot replace the earlier clearly source-bound receipt")
        with patch.object(sys, "argv", ["measure", "--analysis-python", str(self.base / "missing")]):
            with self.assertRaisesRegex(SystemExit, "Install the analysis environment"):
                metrics.main()

    def test_instrumented_copy_keeps_both_builds_and_all_source_inputs_isolated(self):
        run, aux = self.base / "copy", self.base / "aux"
        run.mkdir()
        aux.mkdir()
        calls = []

        def build(root, env):
            calls.append(env["DW_TEST_BUILD"])
            target = root / "build/dist/app.html"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("production" if env["DW_TEST_BUILD"] == "0" else "test", encoding="utf-8")

        original = coverage_tool.source_inputs()
        with (
            patch.object(coverage_tool, "analysis_site", return_value="/synthetic-analysis/site"),
            patch.object(coverage_tool, "build", side_effect=build),
        ):
            env, copied = coverage_tool.prepare(run, aux, Path("synthetic-analysis"))
        self.assertEqual(copied, original)
        self.assertEqual(coverage_tool.source_inputs(), original)
        self.assertEqual(calls, ["0", "1"])
        self.assertEqual((aux / "production/app.html").read_text(encoding="utf-8"), "production")
        self.assertEqual((run / "build/dist/app.html").read_text(encoding="utf-8"), "test")
        self.assertEqual(env["DW_PRODUCTION_DIR"], str(aux / "production"))
        self.assertEqual(env["DW_REPO_ROOT"], str(run))
        self.assertTrue(env["PYTHONPATH"].startswith(str(aux / "hook")))
        self.assertTrue((run / "node_modules").is_symlink())
        self.assertIn("branch = True", (aux / "coveragerc").read_text(encoding="utf-8"))

    def test_collector_build_and_suite_process_failures_are_not_counted_as_passed(self):
        for code in [1, -9]:
            with patch.object(subprocess, "run", return_value=subprocess.CompletedProcess([], code, "failed", "synthetic refusal")):
                with self.assertRaisesRegex(SystemExit, "Coverage build failed"):
                    coverage_tool.build(self.root, {})
                self.assertEqual(coverage_tool.run_suite(self.root, {}, self.root / "tests/unit/audit_synthetic.py")["status"], "failed")
                with self.assertRaisesRegex(SystemExit, "coverage combine failed"):
                    coverage_tool.coverage_command(Path("analysis"), self.root, {}, ["combine"])
        with patch.object(subprocess, "run", side_effect=subprocess.TimeoutExpired("synthetic", 1)):
            self.assertEqual(coverage_tool.run_suite(self.root, {}, self.root / "tests/unit/audit_synthetic.js")["status"], "timeout")
        with patch.object(subprocess, "run", return_value=subprocess.CompletedProcess([], 0, "", "synthetic warning\n")):
            self.assertEqual(coverage_tool.coverage_command(Path("analysis"), self.root, {}, ["combine"]), ["synthetic warning"])


if __name__ == "__main__":
    unittest.main()
