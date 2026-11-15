"""Original maintained packager, isolated synthetic source/evidence/output; no program release is packaged."""

import contextlib
import io
import json
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import project_layout
from audit_release_inputs import fixture, put

ROOT = Path(__file__).resolve().parents[2]


class PackagingOrchestration(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.root = self.base / "source"
        self.root.mkdir()
        fixture(self.root)
        self.proof = self.root / "build/verification/latest/verification.json"
        self.output = self.base / "synthetic-output"

    def package(self, output=None, baseline=None):
        # Execute maintained original code with its declared root bound to the synthetic fixture.
        # Dependency roots stay synthetic; do not read/borrow the parent gate's build or proof.
        fingerprint = project_layout.fingerprint

        def isolated_fingerprint(root=None):
            return fingerprint(self.root if root is None else root)

        args = [str(ROOT / "tools/package_release.py"), "--output", str(self.output if output is None else output)]
        args += ["--first-publication"] if baseline is None else ["--published-manifest", str(baseline)]
        old_path = sys.path[:]
        try:
            with (
                patch.object(project_layout, "ROOT", self.root),
                patch.object(project_layout, "fingerprint", isolated_fingerprint),
                patch.object(sys, "argv", args),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                return runpy.run_path(str(ROOT / "tools/package_release.py"), run_name="__main__")
        finally:
            sys.path[:] = old_path

    def gate(self, **changes):
        value = json.loads(self.proof.read_text(encoding="utf-8"))
        value.update(changes)
        self.proof.write_text(json.dumps(value), encoding="utf-8")

    def test_complete_synthetic_package_rechecks_every_archive_and_never_claims_native_acceptance(self):
        before = project_layout.fingerprint(self.root)
        self.package()
        archives = sorted(self.output.glob("*.zip"))
        self.assertEqual(len(archives), 4)
        for archive in archives:
            with zipfile.ZipFile(archive) as zipped:
                self.assertIsNone(zipped.testzip())
                self.assertEqual(len(zipped.namelist()), len(set(zipped.namelist())))
                self.assertTrue(all(not name.startswith("/") and ".." not in Path(name).parts for name in zipped.namelist()))
        summary = json.loads((self.output / "R55-Verification-Summary.json").read_text(encoding="utf-8"))
        self.assertFalse(summary["cityNativeAcceptance"])
        self.assertEqual(summary["suiteCount"], 2)
        self.assertEqual(project_layout.fingerprint(self.root), before)
        with self.assertRaisesRegex(SystemExit, "existing release packages"):
            self.package()

    def test_in_tree_output_and_missing_repository_refuse_before_output(self):
        with self.assertRaisesRegex(SystemExit, "outside maintained source"):
            self.package(self.root / "output")
        (self.root / "build/verification/latest/repository.json").unlink()
        with self.assertRaisesRegex(SystemExit, "repository verification is missing"):
            self.package()
        self.assertFalse(self.output.exists())

    def test_fast_failed_mismatched_runtime_and_unclean_source_do_not_package(self):
        original = self.proof.read_bytes()
        for changes, message in [
            ({"mode": "fast"}, "full-gate production"),
            ({"passed": False}, "full-gate production"),
            ({"runtimeHashes": {}}, "match every runtime"),
            ({"sourceClean": False}, "Commit the reviewed source"),
        ]:
            with self.subTest(changes=changes):
                self.gate(**changes)
                with self.assertRaisesRegex(SystemExit, message):
                    self.package()
                self.assertFalse(self.output.exists())
                self.proof.write_bytes(original)

    def test_missing_print_evidence_and_malformed_publication_baseline_refuse(self):
        print_proof = self.root / "build/test-results/r50-print-compatibility.json"
        retained = print_proof.read_bytes()
        print_proof.unlink()
        with self.assertRaisesRegex(SystemExit, "Print compatibility evidence is missing"):
            self.package()
        self.assertFalse(self.output.exists())
        print_proof.write_bytes(retained)
        baseline = self.base / "synthetic-baseline.json"
        put(self.base, baseline.name, [])
        with self.assertRaisesRegex(SystemExit, "Published manifest must be an object"):
            self.package(baseline=baseline)
        self.assertFalse(list(self.output.glob("*.zip")), "refused publication cannot create archives")


if __name__ == "__main__":
    unittest.main()
