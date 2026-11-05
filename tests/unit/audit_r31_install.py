"""Wheel completeness, archive integrity, hashes and mandatory offline flags."""

from pathlib import Path
import hashlib
from zipfile import ZipFile
from unittest.mock import patch
import tempfile
import unittest
import install_runtime
from release_inputs import deployment_inputs


class InstallTests(unittest.TestCase):
    def test_all_supported_windows_wheels_and_hashes(self):
        lock = Path("helper/requirements-runtime.txt").read_text()
        expected = "python_crfsuite-0.9.12-cp314-cp314-win_amd64.whl"
        self.assertEqual([p.name for p in Path("helper/vendor/wheels").glob("python_crfsuite*.whl")], [expected])
        inputs = deployment_inputs(Path.cwd())
        deployed = [name for name in inputs if "/python_crfsuite-" in name]
        self.assertEqual(deployed, ["deploy/vendor/wheels/" + expected])
        self.assertIn(inputs[deployed[0]]["sha256"], lock)
        for file in Path("helper/vendor/wheels").glob("*.whl"):
            self.assertIn(hashlib.sha256(file.read_bytes()).hexdigest(), lock)
            with ZipFile(file) as z:
                self.assertIsNone(z.testzip())

    def test_parser_refuses_unsupported_python_before_touching_installation(self):
        with tempfile.TemporaryDirectory() as folder:
            for version in [(3, 10), (3, 12), (3, 13), (3, 15), (4, 0)]:
                with (
                    self.subTest(version=version),
                    patch.object(install_runtime.sys, "platform", "win32"),
                    patch.object(install_runtime.sys, "version_info", version),
                    patch.object(install_runtime.platform, "machine", return_value="AMD64"),
                    patch.object(install_runtime.subprocess, "run") as run,
                ):
                    result = install_runtime.install(folder)
                    self.assertFalse(result["available"])
                    self.assertIn("3.14 only", result["reason"])
                    self.assertIn("not yet supported", result["reason"])
                    run.assert_not_called()
                    self.assertEqual(list(Path(folder).iterdir()), [])

    def test_install_is_offline_and_hash_enforced(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "requirements-runtime.txt").write_text("synthetic lock")
            (root / "vendor/site").mkdir(parents=True)
            with (
                patch.object(install_runtime.sys, "platform", "win32"),
                patch.object(install_runtime.platform, "machine", return_value="AMD64"),
                patch.object(install_runtime.subprocess, "run") as run,
            ):
                run.side_effect = lambda *a, **k: (root / "vendor/site").mkdir(parents=True, exist_ok=True)
                self.assertTrue(install_runtime.install(root)["available"])
                cmd = run.call_args.args[0]
                for flag in ("--no-index", "--require-hashes", "--only-binary=:all:"):
                    self.assertIn(flag, cmd)


if __name__ == "__main__":
    unittest.main()
