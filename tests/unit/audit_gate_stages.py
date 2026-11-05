"""Isolated jobs must not turn missing, stale, cross-run or modified artifacts into full-gate evidence."""

import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from gate_stages import assemble, browser_results, read_stage, reviewed_provenance, run_identity, seal_stage


class StageEvidence(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.inputs = {"source.py": "reviewed-source-hash", "build/dist/production.html": "reviewed-runtime-hash"}
        self.provenance = {"sourceCommit": "a" * 40, "sourceClean": True, "verifiedInputsSha256": "digest"}
        self.toolchain = {
            "python": "3.12.14",
            "node": "v24.19.0",
            "playwright": "1.58.2",
            "browserSource": "pinned-playwright",
            "platform": "linux",
            "architecture": "x86_64",
        }
        self.identity = {"run": "1234", "attempt": "2"}
        self.receipt = {
            "stage": "regression",
            "mode": "full",
            "passed": True,
            "identity": self.identity,
            "inputs": self.inputs,
            "provenance": self.provenance,
            "toolchain": {**self.toolchain, "chromium": "145.0"},
            "files": {},
        }
        for name in [
            "test-results/results.json",
            "test-results/evidence.json",
            "test-results/r50-print-compatibility.json",
            "verification/latest/format.log",
            "verification/latest/regression.log",
            "verification/latest/timings.json",
        ]:
            self.put(name, "synthetic artifact")
        self.write_receipt(self.receipt)

    def put(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        self.receipt["files"][name] = hashlib.sha256(path.read_bytes()).hexdigest()

    def write_receipt(self, receipt):
        path = self.root / "verification/latest/stage-regression.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(receipt), encoding="utf-8")

    def read(self):
        return read_stage(self.root, "regression", self.inputs, self.provenance, self.toolchain, self.identity)

    def test_matching_complete_artifact_is_accepted_without_modifying_it(self):
        before = {p: p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        self.assertEqual(self.read(), self.receipt)
        self.assertEqual(before, {p: p.read_bytes() for p in self.root.rglob("*") if p.is_file()})

    def test_stale_or_failed_or_cross_job_evidence_is_refused(self):
        changes = [
            {"mode": "fast"},
            {"passed": False},
            {"passed": 1},
            {"stage": "browser"},
            {"identity": {"run": "other", "attempt": "2"}},
            {"identity": {"run": "1234", "attempt": "1"}},
            {"inputs": {**self.inputs, "source.py": "different"}},
            {"inputs": {**self.inputs, "build/dist/production.html": "different"}},
            {"provenance": {**self.provenance, "sourceCommit": "b" * 40}},
            {"provenance": {**self.provenance, "sourceClean": False}},
            {"provenance": {**self.provenance, "sourceClean": 1}},
            {"toolchain": {**self.receipt["toolchain"], "node": "different"}},
            {"toolchain": {**self.receipt["toolchain"], "chromium": ""}},
        ]
        for change in changes:
            with self.subTest(change=change):
                self.write_receipt({**self.receipt, **change})
                with self.assertRaisesRegex(ValueError, "stage evidence"):
                    self.read()

    def test_missing_or_modified_artifacts_fail(self):
        path = self.root / "test-results/results.json"
        path.write_text("changed", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "recorded bytes"):
            self.read()
        path.unlink()
        with self.assertRaises(ValueError):
            self.read()
        # A producer cannot omit the required file from its manifest to disguise its absence.
        del self.receipt["files"]["test-results/results.json"]
        self.write_receipt(self.receipt)
        with self.assertRaisesRegex(ValueError, "required"):
            self.read()

    def test_extra_files_and_outside_namespaces_are_refused(self):
        extra = self.root / "unlisted.txt"
        extra.write_text("not recorded", encoding="utf-8")
        with self.assertRaises(ValueError):
            self.read()
        self.put("unlisted.txt", "recorded but not a stage output")
        self.write_receipt(self.receipt)
        with self.assertRaisesRegex(ValueError, "Unexpected stage artifact path"):
            self.read()

    def test_links_are_never_followed(self):
        path = self.root / "test-results/results.json"
        path.unlink()
        outside = self.root.parent / (self.root.name + "-outside")
        outside.write_text("synthetic private bytes", encoding="utf-8")
        self.addCleanup(outside.unlink)
        path.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, "Linked"):
            self.read()

    def test_a_required_receipt_is_not_optional(self):
        (self.root / "verification/latest/stage-regression.json").unlink()
        with self.assertRaises((OSError, ValueError)):
            self.read()

    def test_each_isolated_run_needs_a_common_explicit_identity(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(ValueError, "identifier"):
            run_identity()
        with patch.dict(os.environ, {"DW_GATE_RUN": "local-fresh-id"}, clear=True):
            self.assertEqual(run_identity(), {"run": "local-fresh-id", "attempt": "1"})
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "true", "GITHUB_RUN_ID": "55", "GITHUB_RUN_ATTEMPT": "3"}, clear=True):
            self.assertEqual(run_identity(), {"run": "55", "attempt": "3"})

    def test_assembler_refuses_different_actual_browsers_before_publishing_evidence(self):
        first = {"toolchain": {**self.toolchain, "chromium": "145.0"}}
        second = {"toolchain": {**self.toolchain, "chromium": "146.0"}}
        with (
            patch("gate_stages.run_identity", return_value=self.identity),
            patch("gate_stages.source_inventory"),
            patch("gate_stages.fingerprint", return_value=self.inputs),
            patch("gate_stages.source_provenance", return_value=self.provenance),
            patch("gate_stages.toolchain", return_value=self.toolchain),
            patch("gate_stages.read_stage", side_effect=[first, second]),
            patch("gate_stages.verify") as verify,
        ):
            with self.assertRaisesRegex(ValueError, "different browser/toolchain"):
                assemble(self.root, lambda *args: None, self.root / "regression", self.root / "browser")
            verify.assert_not_called()
        self.assertFalse((self.root / "build/verification/latest/verification.json").exists())

    def test_unavailable_or_uncertain_git_provenance_cannot_publish_a_stage_receipt(self):
        for change in [
            {"sourceClean": None},
            {"sourceClean": False},
            {"sourceClean": 1},
            {"sourceCommit": None},
            {"sourceCommit": ""},
            {"sourceCommit": "not-a-commit"},
        ]:
            with (
                self.subTest(change=change),
                patch("gate_stages.source_provenance", return_value={**self.provenance, **change}),
                patch("gate_stages.fingerprint", return_value=self.inputs),
                patch("gate_stages.toolchain") as toolchain,
            ):
                with self.assertRaisesRegex(ValueError, "identified commit.*clean"):
                    reviewed_provenance(self.root, self.inputs)
                with self.assertRaisesRegex(ValueError, "identified commit.*clean"):
                    seal_stage(self.root, "regression", "145.0")
                toolchain.assert_not_called()
        self.assertFalse((self.root / "build/verification/latest/stage-regression.json").exists())

    def test_browser_evidence_must_match_production_and_include_passing_accessibility(self):
        folder = self.root / "build/verification/latest/browser"
        folder.mkdir(parents=True)
        generated = self.root / "build/generated"
        generated.mkdir(parents=True)
        (generated / "RELEASE").write_text("synthetic release", encoding="utf-8")
        checks = [{"screen": "synthetic", "violations": []}]
        browser = {
            "passed": True,
            "mode": "full",
            "productionBuild": True,
            "runtimeHashes": {"production": "hash"},
            "release": "synthetic release",
            "errors": [],
            "cspViolations": [],
            "axe": checks,
        }
        axe = {"passed": True, "checks": checks}

        def read(browser_data, axe_data):
            (folder / "browser-results.json").write_text(json.dumps(browser_data), encoding="utf-8")
            (folder / "axe-results.json").write_text(json.dumps(axe_data), encoding="utf-8")
            return browser_results(self.root)

        with patch("gate_stages.runtime_hashes", return_value={"production": "hash"}):
            self.assertEqual(read(browser, axe), (browser, axe))
            for change in [
                {"passed": False},
                {"mode": "fast"},
                {"productionBuild": False},
                {"runtimeHashes": {"production": "stale"}},
                {"release": "other release"},
                {"errors": ["page error"]},
                {"cspViolations": ["CSP error"]},
                {"axe": []},
            ]:
                with self.subTest(change=change), self.assertRaises(ValueError):
                    read({**browser, **change}, axe)
            for bad_axe in [
                {"passed": False, "checks": checks},
                {"passed": True, "checks": []},
                {"passed": True, "checks": [{"screen": "synthetic", "violations": ["violation"]}]},
            ]:
                with self.subTest(axe=bad_axe), self.assertRaises(ValueError):
                    read(browser, bad_axe)


if __name__ == "__main__":
    unittest.main()
