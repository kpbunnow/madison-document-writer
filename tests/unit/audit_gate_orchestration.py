"""Exercise real stage/CLI orchestration in an isolated synthetic tree; never consume parent gate evidence."""

import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import gate_stages
import project_layout
from audit_release_inputs import fixture, put
from release_evidence import fingerprint, verify

ROOT = Path(__file__).resolve().parents[2]


class GateOrchestration(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.root = self.base / "source"
        self.root.mkdir()
        fixture(self.root)
        put(self.root, "build/generated/RELEASE", "synthetic release")
        self.out = self.root / "build/verification/latest"
        self.toolchain = {
            "python": sys.version.split()[0],
            "node": "synthetic-node",
            "playwright": "synthetic",
            "browserSource": "synthetic",
            "platform": sys.platform,
            "architecture": "synthetic",
        }
        self.identity = {"run": "synthetic-test-run", "attempt": "1"}
        self.commands = []

    def results(self):
        put(self.root, "build/test-results/results.json", [{"suite": name, "passed": True} for name in ["audit_synthetic.py", "tagcheck.js"]])
        put(self.root, "build/test-results/r50-print-compatibility.json", {"checks": ["synthetic"]})
        put(
            self.root,
            "build/test-results/evidence.json",
            {
                "mode": "full",
                "files": fingerprint(self.root),
                "resultsSha256": hashlib.sha256((self.root / "build/test-results/results.json").read_bytes()).hexdigest(),
            },
        )

    def browser(self):
        checks = [{"screen": "synthetic", "violations": []}]
        put(
            self.root,
            "build/verification/latest/browser/browser-results.json",
            {
                "passed": True,
                "mode": "full",
                "productionBuild": True,
                "release": "synthetic release",
                "runtimeHashes": gate_stages.runtime_hashes(self.root),
                "errors": [],
                "cspViolations": [],
                "axe": checks,
                "browserVersion": "synthetic-chromium",
            },
        )
        put(self.root, "build/verification/latest/browser/axe-results.json", {"passed": True, "checks": checks})
        for name in ["environment.json", "screen-css-results.json"]:
            put(self.root, "build/verification/latest/browser/" + name, {"synthetic": True})

    def runner(self, command, name, env=None):
        self.commands.append((command, name, env))
        put(
            self.root,
            "build/verification/latest/" + name,
            "Usable Chromium: synthetic-chromium\n" if name == "regression.log" else "synthetic process completed\n",
        )
        put(self.root, "build/verification/latest/timings.json", {"mode": "full", "stages": [{"stage": name, "elapsedMs": 1, "passed": True}]})
        if name == "regression.log":
            self.results()
        if name == "browser.log":
            self.browser()

    @contextlib.contextmanager
    def stage_context(self):
        with (
            patch.dict(os.environ, {"DW_GATE_RUN": self.identity["run"], "GITHUB_ACTIONS": "false", "GITHUB_RUN_ATTEMPT": "1"}),
            patch.object(gate_stages, "toolchain", return_value=self.toolchain),
            patch.object(
                gate_stages, "source_provenance", return_value={"sourceCommit": "a" * 40, "sourceClean": True, "verifiedInputsSha256": "synthetic"}
            ),
        ):
            yield

    def test_real_producer_sealing_and_assembly_requires_complete_same_source_results(self):
        with self.stage_context():
            for stage in ["regression", "browser"]:
                gate_stages.execute_stage(self.root, self.runner, stage)
                shutil.copytree(self.root / "build/ci-upload", self.base / stage)
                receipt = json.loads((self.out / ("stage-" + stage + ".json")).read_text(encoding="utf-8"))
                self.assertEqual(receipt["identity"], self.identity)
                self.assertEqual(receipt["inputs"], fingerprint(self.root))
            gate_stages.assemble(self.root, self.runner, self.base / "regression", self.base / "browser")
        verify(self.root)
        gate = json.loads((self.out / "verification.json").read_text(encoding="utf-8"))
        self.assertTrue(gate["passed"])
        self.assertEqual(gate["suiteCount"], 2)
        self.assertEqual(gate["axeScreens"], 1)
        self.assertEqual(gate["sourceFiles"], fingerprint(self.root))
        self.assertEqual([x[1] for x in self.commands], ["format.log", "regression.log", "build.log", "browser.log", "assembly-build.log"])
        self.assertEqual(self.commands[2][2]["DW_TEST_BUILD"], "0")
        self.assertEqual(self.commands[3][2]["DW_QA_OUTPUT"], str(self.out / "browser"))

    def test_each_interrupted_producer_command_refuses_to_seal_partial_work(self):
        for stage, fail in [("regression", "format.log"), ("regression", "regression.log"), ("browser", "build.log"), ("browser", "browser.log")]:
            with self.subTest(stage=stage, fail=fail), self.stage_context():

                def interrupted(command, name, env=None):
                    self.runner(command, name, env)
                    if name == fail:
                        raise RuntimeError("synthetic interruption")

                with self.assertRaisesRegex(RuntimeError, "interruption"):
                    gate_stages.execute_stage(self.root, interrupted, stage)
                self.assertFalse((self.out / ("stage-" + stage + ".json")).exists())
                self.assertFalse((self.root / "build/ci-upload").exists())

    def test_browser_runtime_drift_and_missing_regression_preflight_are_not_sealed(self):
        with self.stage_context():

            def drift(command, name, env=None):
                self.runner(command, name, env)
                if name == "browser.log":
                    put(self.root, "build/dist/madison-reports.html", "changed while browser ran")

            with self.assertRaisesRegex(ValueError, "changed during browser"):
                gate_stages.execute_stage(self.root, drift, "browser")

            def no_preflight(command, name, env=None):
                self.runner(command, name, env)
                if name == "regression.log":
                    put(self.root, "build/verification/latest/regression.log", "no browser preflight")

            with self.assertRaisesRegex(ValueError, "preflight"):
                gate_stages.execute_stage(self.root, no_preflight, "regression")
            self.assertFalse((self.root / "build/ci-upload").exists())

    def cli(self, *, mode="full", failure=None, drift=False, args=None):
        # Execute the maintained original script, with only its filesystem root bound to this synthetic tree.
        # Process work is controlled at its subprocess boundary; no nested full gate or borrowed parent evidence.
        script = ROOT / "tools/verify_release.py"
        resolve = Path.resolve
        calls = []
        maintained_fingerprint = project_layout.fingerprint

        def isolated_fingerprint(root=None):
            return maintained_fingerprint(self.root if root is None else root)

        def isolated_resolve(path, *args, **kwargs):
            return self.root / "tools/verify_release.py" if path == script else resolve(path, *args, **kwargs)

        def process(command, **kwargs):
            name = (
                "format.log" if command[-1] == "tools/check_format.py" else "regression.log" if command[-1] == "tools/run_tests.py" else "browser.log"
            )
            calls.append(name)
            if name == "regression.log":
                self.results()
            if name == "browser.log":
                self.browser()
                if drift:
                    put(self.root, "build/dist/madison-reports.html", "runtime drift")
            return subprocess.CompletedProcess(command, 1 if name == failure else 0)

        with (
            patch.object(Path, "resolve", isolated_resolve),
            patch.object(subprocess, "run", side_effect=process),
            patch.object(subprocess, "check_output", return_value="synthetic-node"),
            patch.object(project_layout, "ROOT", self.root),
            patch.object(project_layout, "fingerprint", isolated_fingerprint),
            patch.object(sys, "argv", [str(script), *(args or [])]),
            patch.dict(os.environ, {"DW_FAST": "1" if mode == "fast" else "0"}),
            contextlib.redirect_stdout(io.StringIO()),
        ):
            return runpy.run_path(str(script), run_name="__main__"), calls

    def test_cli_success_and_failed_stages_invalidate_old_evidence_and_record_truthful_timings(self):
        for fail in ["format.log", "regression.log", "browser.log"]:
            with self.subTest(fail=fail):
                put(self.root, "build/verification/latest/verification.json", {"passed": True, "old": True})
                with self.assertRaisesRegex(SystemExit, "Verification failed"):
                    self.cli(failure=fail)
                self.assertFalse((self.out / "verification.json").exists())
                timings = json.loads((self.out / "timings.json").read_text(encoding="utf-8"))
                self.assertFalse(timings["stages"][-1]["passed"])
                self.assertEqual(timings["stages"][-1]["stage"], fail.removesuffix(".log"))
        _, calls = self.cli()
        self.assertEqual(calls, ["format.log", "regression.log", "browser.log"])
        self.assertTrue(json.loads((self.out / "verification.json").read_text(encoding="utf-8"))["passed"])

    def test_cli_fast_and_runtime_drift_never_publish_full_evidence(self):
        with self.assertRaisesRegex(SystemExit, "Source changed"):
            self.cli(drift=True)
        self.assertFalse((self.out / "verification.json").exists())
        with self.assertRaises(SystemExit) as ended:
            self.cli(mode="fast")
        self.assertEqual(ended.exception.code, 0)
        self.assertFalse((self.out / "verification.json").exists())
        self.assertFalse((self.out / "repository.json").exists())
        self.assertFalse(json.loads((self.out / "fast-verification.json").read_text(encoding="utf-8"))["releaseEvidence"])
        with self.assertRaisesRegex(SystemExit, "DW_FAST"):
            self.cli(mode="fast", args=["--stage", "regression"])


if __name__ == "__main__":
    unittest.main()
