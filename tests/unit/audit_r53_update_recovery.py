"""R53 WP0: signing-era installs are retired explicitly, stale signed files are named, the deployment cleaner, diagnostics."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import deploy_manifest
import prepare_deployment
import verified_update
from project_layout import ROOT, assemble_deploy


def built_deploy(folder):
    folder.mkdir(parents=True)
    assemble_deploy(folder)
    deploy_manifest.write_manifest(folder)
    return folder


class UpdateRecovery(unittest.TestCase):
    def run_share_launcher(self, root, installed_pin, extra=None):
        share, local = root / "share", root / "profile" / "MadisonDocWriter"
        share.mkdir()
        local.mkdir(parents=True)
        shutil.copyfile(ROOT / "helper/launch.py", share / "launch.py")
        marker = root / "INSTALLED_LAUNCHER_RAN"
        for name in ["verified_update.py", "install_release.py"]:
            (local / name).write_text("# installed\n")
        (local / "launch.py").write_text("from pathlib import Path\nPath(" + repr(str(marker)) + ").touch()\n")
        (local / "verified-install.json").write_text(json.dumps(installed_pin))
        for name, text in (extra or {}).items():
            (local / name).write_text(text)
        env = {**os.environ, "LOCALAPPDATA": str(root / "profile"), "PYTHONDONTWRITEBYTECODE": "1"}
        result = subprocess.run([sys.executable, "-B", str(share / "launch.py")], cwd=share, env=env, capture_output=True, text=True, timeout=60)
        return result, marker

    def test_signing_era_install_gets_retirement_message_and_nothing_runs(self):
        for pin, extra in [
            ({"helperBuild": 52}, None),
            ({"helperVersion": "2026.10.17.51"}, None),
            ({"helperBuild": 60}, {"release_trust.py": "PUBLIC_KEY = b''\n"}),
        ]:
            with self.subTest(pin=pin, extra=bool(extra)), tempfile.TemporaryDirectory() as directory:
                result, marker = self.run_share_launcher(Path(directory), pin, extra)
                self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
                self.assertIn("older signed installation (R50/R51)", result.stdout)
                self.assertIn("rename %LOCALAPPDATA%\\MadisonDocWriter", result.stdout)
                self.assertFalse(marker.exists())

    def test_current_install_still_hands_off(self):
        with tempfile.TemporaryDirectory() as directory:
            result, marker = self.run_share_launcher(Path(directory), {"helperBuild": 53})
            self.assertTrue(marker.exists(), result.stdout + result.stderr)

    def test_stale_signed_files_are_named(self):
        for stale in ["runtime-manifest.sig", "release_trust.py", "vendor/python/pure25519/eddsa.py"]:
            with self.subTest(stale=stale), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                deploy = built_deploy(root / "deploy")
                (deploy / stale).parent.mkdir(parents=True, exist_ok=True)
                (deploy / stale).write_bytes(b"left over from a signed release")
                (root / "stage").mkdir()
                (root / "local").mkdir()
                with self.assertRaisesRegex(ValueError, "files from an earlier signed release"):
                    verified_update.stage_update(deploy, root / "stage", root / "local")

    def test_failure_details_and_diagnostic_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            deploy = built_deploy(root / "deploy")
            (deploy / "server.py").write_bytes((deploy / "server.py").read_bytes() + b"#")
            (root / "stage").mkdir()
            (root / "local").mkdir()
            with self.assertRaises(ValueError) as error:
                verified_update.stage_update(deploy, root / "stage", root / "local")
            self.assertIn("ValueError during size 'server.py'", str(error.exception))
            diagnostic = (root / "local" / "update-diagnostic.txt").read_text()
            self.assertIn("Operation: size 'server.py'", diagnostic)
            self.assertIn("Python: ", diagnostic)

    def test_parents_above_the_deployment_are_never_inspected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            deploy = built_deploy(root / "deploy")
            (root / "stage").mkdir()
            (root / "local").mkdir()
            real = os.lstat
            guarded = str(root.resolve())

            def lstat(path, *a, **k):
                if os.path.normcase(os.path.abspath(str(path))) == os.path.normcase(guarded):
                    raise PermissionError("parent folder above the deployment")
                return real(path, *a, **k)

            with mock.patch.object(os, "lstat", lstat):
                manifest = verified_update.stage_update(deploy, root / "stage", root / "local")
            self.assertTrue(manifest["files"])

    def test_prepare_deployment_retires_only_unlisted_program_items(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = built_deploy(root / "new")
            target = root / "Document Writer"
            target.mkdir()
            for stale in ["runtime-manifest.sig", "release_trust.py", "vendor/python/pure25519/basic.py", "old_tool.py"]:
                (target / stale).parent.mkdir(parents=True, exist_ok=True)
                (target / stale).write_text("old")
            for data in ["Case JSON Files/case.json", "Orders/order.pdf", "Reporting GIS/settings.json"]:
                (target / data).parent.mkdir(parents=True, exist_ok=True)
                (target / data).write_text("operational")
            retire, wanted = prepare_deployment.plan(source, target)
            self.assertEqual(set(retire), {"runtime-manifest.sig", "release_trust.py", "vendor/python/pure25519/basic.py", "old_tool.py"})
            archive, manifest = prepare_deployment.apply(source, target, retire, wanted, stamp="test")
            self.assertTrue((archive / "release_trust.py").exists())
            self.assertFalse((target / "vendor/python/pure25519").exists())
            for data in ["Case JSON Files/case.json", "Orders/order.pdf", "Reporting GIS/settings.json"]:
                self.assertEqual((target / data).read_text(), "operational")
            self.assertEqual(len(manifest["files"]), len(wanted) - 1)


if __name__ == "__main__":
    unittest.main()
