"""Wheel completeness, archive integrity, hashes and mandatory offline flags."""

from pathlib import Path
import hashlib
from zipfile import ZipFile
from unittest.mock import patch
import tempfile
import unittest
import install_runtime


class InstallTests(unittest.TestCase):
    def test_all_supported_windows_wheels_and_hashes(self):
        lock = Path("helper/requirements-runtime.txt").read_text()
        for version in range(310, 315):
            self.assertTrue(list(Path("helper/vendor/wheels").glob(f"python_crfsuite-0.9.12-cp{version}-cp{version}-win_amd64.whl")))
        for file in Path("helper/vendor/wheels").glob("*.whl"):
            self.assertIn(hashlib.sha256(file.read_bytes()).hexdigest(), lock)
            with ZipFile(file) as z:
                self.assertIsNone(z.testzip())

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
