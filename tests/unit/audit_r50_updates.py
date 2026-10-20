"""Signed updates refuse tampering without changing an existing install."""

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import os
import shutil
import subprocess
import sys
import verified_update
import install_release


class ManifestUpdates(unittest.TestCase):
    def test_first_and_repeated_launcher_imports_do_not_modify_share(self):
        """Exercise actual launcher imports before verification, with bytecode enabled by default."""
        import deploy_manifest

        runtime = Path(__file__).resolve().parents[2]
        manifest = json.loads((runtime / "build/generated/runtime-manifest.json").read_text())
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            share = root / "signed share"
            share.mkdir()
            for name, relative in manifest["deploy"].items():
                target = share / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(runtime / relative, target)
            shutil.copytree(
                runtime / "helper/vendor", share / "vendor", dirs_exist_ok=True, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "site")
            )
            deploy_manifest.write_manifest(share)
            # Existing office archives share the deployment's parent folder.
            # These are operational documents, never installed or imported as code.
            for relative, content in {
                "Orders/1-2026/test-order.pdf": b"retained original order",
                "Orders/2-2026/Thumbs.db": b"Windows document-folder metadata",
                "Orders/2-2026/~$test-order.docm": b"Word temporary file",
                "Orders/server.py": b"raise RuntimeError('Archive code must never run')",
            }.items():
                document = share / relative
                document.parent.mkdir(parents=True, exist_ok=True)
                document.write_bytes(content)
            before = {p.relative_to(share).as_posix(): p.read_bytes() for p in share.rglob("*") if p.is_file()}
            profile = root / "profile"
            local = profile / "MadisonDocWriter"
            local.mkdir(parents=True)
            (local / "integrity-settings.json").write_bytes(b"protected local settings")
            (local / "pending-work.json").write_bytes(b"retained unfinished work")
            harness = root / "exercise_launcher.py"
            harness.write_text(
                "import runpy, sys, os\n"
                "from pathlib import Path\n"
                "share = Path(sys.argv[1])\n"
                "local = Path(os.environ['LOCALAPPDATA']) / 'MadisonDocWriter'\n"
                "target = local if (local / 'verified-install.json').is_file() else share\n"
                "sys.path.insert(0, str(target))\n"
                "sys.argv = [str(target / 'launch.py'), '--share', str(share)]\n"
                "app = runpy.run_path(str(target / 'launch.py'), run_name='launcher_fixture')\n"
                "def offline(*args, **kwargs):\n"
                "    raise OSError('No helper is running')\n"
                "app['socket'].create_connection = offline\n"
                "app['subprocess'].run = lambda *args, **kwargs: None\n"
                "app['subprocess'].call = lambda *args, **kwargs: 0\n"
                "app['install_runtime'].install = lambda *args: {'available': True}\n"
                "assert app['main']() == 0\n"
            )
            env = {**os.environ, "LOCALAPPDATA": str(profile)}
            env.pop("PYTHONDONTWRITEBYTECODE", None)
            env.pop("PYTHONPYCACHEPREFIX", None)
            for index, flags in enumerate([[], [], ["-B"]]):
                result = subprocess.run([sys.executable, *flags, str(harness), str(share)], env=env, capture_output=True, text=True, timeout=30)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual("First installation must come from a package whose SHA-256 IT has checked" in result.stdout, index == 0)
                self.assertFalse(list(share.rglob("__pycache__")))
                self.assertEqual(before, {p.relative_to(share).as_posix(): p.read_bytes() for p in share.rglob("*") if p.is_file()})
                self.assertEqual((local / "integrity-settings.json").read_bytes(), b"protected local settings")
                self.assertEqual((local / "pending-work.json").read_bytes(), b"retained unfinished work")
                self.assertEqual(json.loads((local / "verified-install.json").read_text())["helperVersion"], manifest["helperVersion"])
                self.assertFalse((local / "Orders").exists())

            (share / "unexpected-code.py").write_bytes(b"unlisted program")
            result = subprocess.run([sys.executable, str(harness), str(share)], env=env, capture_output=True, text=True, timeout=30)
            self.assertIn("unexpected-code.py", result.stdout)
            self.assertIn("Unexpected", result.stdout)
            self.assertFalse((local / "unexpected-code.py").exists())

    def test_file_set_error_groups_many_extras_and_preserves_the_cause(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            share, stage, local = (root / name for name in ("share", "stage", "local"))
            for folder in (share, stage, local):
                folder.mkdir()
            content = b"signed server"
            (share / "server.py").write_bytes(content)
            manifest = {
                "helperVersion": "2026.10.17.51",
                "release": "2026-10-17 R50",
                "files": {"server.py": {"size": len(content), "sha256": hashlib.sha256(content).hexdigest()}},
            }
            raw = json.dumps(manifest).encode()
            (share / "runtime-manifest.json").write_bytes(raw)
            extra = share / "Unexpected archive"
            extra.mkdir()
            for n in range(424):
                (extra / (str(n) + ".pdf")).write_bytes(b"document")
            (share / "server.py").unlink()
            with self.assertRaises(ValueError) as caught:
                verified_update.stage_update(share, stage, local)
            message = str(caught.exception)
            self.assertIn("server.py", message)
            self.assertIn("Unexpected archive", message)
            self.assertIn("424", message)
            self.assertLess(len(message), 1000)

    def test_both_windows_python_launcher_paths_disable_bytecode(self):
        launcher = Path("helper/Start_Document_Writer.bat").read_text()
        self.assertIn('set "PYTHONDONTWRITEBYTECODE=1"', launcher)
        self.assertIn('py -3 -B "%DW_LAUNCH%"', launcher)
        self.assertIn('python -B "%DW_LAUNCH%"', launcher)

    def test_manifest_tool_hashes_all_files_and_rechecks_staged_bytes(self):
        import deploy_manifest

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            deploy = root / "deploy"
            deploy.mkdir()
            stage = root / "stage"
            stage.mkdir()
            local = root / "local"
            local.mkdir()
            (deploy / "vendor").mkdir()
            (deploy / "vendor/runtime-manifest.json").write_bytes(b"vendored data with the same basename")
            (deploy / "server.py").write_bytes(b"authenticated code")
            (deploy / "runtime-manifest.json").write_text(json.dumps({"release": "2026-10-16 R50", "helperVersion": "2026.10.16.50"}))
            deploy_manifest.write_manifest(deploy)
            manifest = verified_update.stage_update(deploy, stage, local)
            self.assertEqual(set(manifest["files"]), {"server.py", "vendor/runtime-manifest.json"})
            self.assertEqual((stage / "vendor/runtime-manifest.json").read_bytes(), b"vendored data with the same basename")

    def test_verified_update_and_all_tamper_classes(self):
        for damage in [
            "none",
            "server.py",
            "madison-document-writer.html",
            "case_lookup.sql",
            "extra",
            "nested_orders",
            "missing",
            "downgrade",
            "none",
        ]:
            with self.subTest(damage=damage), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                share = root / "share"
                local = root / "local"
                stage = root / "stage"
                share.mkdir()
                local.mkdir()
                stage.mkdir()
                (local / "server.py").write_bytes(b"old verified program")
                files = {}
                for name in ["server.py", "madison-document-writer.html", "case_lookup.sql", "vendor/python/lib.py"]:
                    p = share / name
                    p.parent.mkdir(parents=True, exist_ok=True)
                    p.write_bytes(("verified " + name).encode())
                    files[name] = {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(), "size": p.stat().st_size}
                manifest = {"release": "2026-10-16 R50", "helperVersion": "2026.10.16.50", "files": files}
                raw = json.dumps(manifest, sort_keys=True).encode()
                (share / "runtime-manifest.json").write_bytes(raw)
                if damage in files:
                    (share / damage).write_bytes(b"altered")
                if damage == "extra":
                    (share / "injected.py").write_bytes(b"code")
                if damage == "nested_orders":
                    nested = share / "vendor/Orders/injected.py"
                    nested.parent.mkdir(parents=True)
                    nested.write_bytes(b"unlisted code inside program dependencies")
                if damage == "missing":
                    (share / "server.py").unlink()
                if damage == "downgrade":
                    (local / "verified-install.json").write_text(json.dumps({"helperVersion": "2026.10.16.51"}))
                if damage == "none":
                    result = verified_update.stage_update(share, stage, local)
                    self.assertEqual(result["helperVersion"], "2026.10.16.50")
                    self.assertEqual((stage / "server.py").read_bytes(), b"verified server.py")
                else:
                    with self.assertRaisesRegex(ValueError, "shared program files failed verification"):
                        verified_update.stage_update(share, stage, local)
                self.assertEqual((local / "server.py").read_bytes(), b"old verified program")
                if damage == "none":
                    install_release.install(stage, local, list(files) + ["runtime-manifest.json", "verified-install.json"])
                    self.assertEqual((local / "server.py").read_bytes(), b"verified server.py")
                    self.assertEqual(json.loads((local / "verified-install.json").read_text())["helperVersion"], "2026.10.16.50")


if __name__ == "__main__":
    unittest.main()
