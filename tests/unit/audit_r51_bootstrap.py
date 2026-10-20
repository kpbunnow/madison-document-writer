"""R51 trust-boundary regressions; never execute shared verification dependencies."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class TrustedBootstrap(unittest.TestCase):
    def test_handoff_precedes_every_sibling_import_and_ignores_share_stdlib_shadow(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            share = root / "share"
            local = root / "profile/MadisonDocWriter"
            share.mkdir()
            local.mkdir(parents=True)
            marker = root / "UNTRUSTED_CODE_RAN"
            trusted = root / "trusted-arguments.json"
            shutil.copyfile(ROOT / "helper/launch.py", share / "launch.py")
            for name in ["verified_update.py", "install_release.py", "helper_session.py", "install_runtime.py", "json.py"]:
                (share / name).write_text("from pathlib import Path\nPath(" + repr(str(marker)) + ').touch()\nraise RuntimeError("untrusted")\n')
            for name in ["verified_update.py", "install_release.py"]:
                (local / name).write_text("# trusted installed dependency\n")
            (local / "verified-install.json").write_text('{"helperBuild": 53}')
            (local / "launch.py").write_text(
                "import json,os,sys\nfrom pathlib import Path\nPath("
                + repr(str(trusted))
                + ').write_text(json.dumps({"argv":sys.argv,"bytecode":sys.dont_write_bytecode,"env":os.environ.get("PYTHONDONTWRITEBYTECODE")}))\n'
            )
            env = {**os.environ, "LOCALAPPDATA": str(root / "profile")}
            env.pop("PYTHONPATH", None)
            run = subprocess.run([sys.executable, str(share / "launch.py")], env=env, capture_output=True, text=True, timeout=15)
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            self.assertFalse(marker.exists())
            result = json.loads(trusted.read_text())
            self.assertTrue(result["bytecode"])
            self.assertEqual(result["env"], "1")
            self.assertEqual(result["argv"][1:], ["--share", str(share)])
            self.assertFalse(list(share.rglob("__pycache__")))

    def test_share_batch_uses_installed_launcher_with_explicit_source(self):
        text = (ROOT / "helper/Start_Document_Writer.bat").read_text()
        self.assertIn('--share "%~dp0', text)
        self.assertIn('py -3 -B "%DW_LAUNCH%"', text)
        self.assertIn('python -B "%DW_LAUNCH%"', text)

    def test_installed_verifier_refuses_every_shared_trust_module_without_execution(self):
        import hashlib
        import deploy_manifest
        import verified_update
        import install_release

        manifest = json.loads((ROOT / "build/generated/runtime-manifest.json").read_text())
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            share, stage = root / "share", root / "stage"
            local = root / "profile/MadisonDocWriter"
            for p in [share, stage, local]:
                p.mkdir(parents=True)
            for name, source in manifest["deploy"].items():
                target = share / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / source, target)
            shutil.copytree(
                ROOT / "helper/vendor", share / "vendor", dirs_exist_ok=True, ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "site")
            )
            deploy_manifest.write_manifest(share)
            approved = verified_update.stage_update(share, stage, local)
            install_release.install(stage, local, list(approved["files"]) + ["runtime-manifest.json", "verified-install.json"])
            marker = root / "UNTRUSTED_CODE_RAN"
            harness = root / "exercise_installed.py"
            harness.write_text(
                "import runpy,sys\nfrom pathlib import Path\n"
                "local,share=map(Path,sys.argv[1:])\nsys.path.insert(0,str(local))\n"
                'sys.argv=[str(local/"launch.py"),"--share",str(share)]\n'
                'app=runpy.run_path(str(local/"launch.py"),run_name="installed_fixture")\n'
                'def offline(*a,**k): raise OSError("No running helper")\n'
                'app["socket"].create_connection=offline\n'
                'app["subprocess"].run=lambda *a,**k:None\n'
                'app["subprocess"].call=lambda *a,**k:0\n'
                'app["install_runtime"].install=lambda *a:{"available":True}\n'
                'assert app["main"]()==0\n'
            )
            env = {**os.environ, "LOCALAPPDATA": str(local.parent), "PYTHONDONTWRITEBYTECODE": "1"}
            for name in ["launch.py", "verified_update.py", "install_release.py"]:
                target = share / name
                original = target.read_bytes()
                marker_code = ("from pathlib import Path\nPath(" + repr(str(marker)) + ").touch()\n").encode()
                target.write_bytes(marker_code + original)
                result = subprocess.run(
                    [sys.executable, "-B", str(harness), str(local), str(share)], env=env, capture_output=True, text=True, timeout=30
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn("shared program files failed verification", result.stdout)
                self.assertIn(name, result.stdout)
                self.assertFalse(marker.exists(), name)
                self.assertEqual(hashlib.sha256((local / name).read_bytes()).hexdigest(), approved["files"][name]["sha256"])
                target.write_bytes(original)

    def test_no_installed_user_message_redirects_to_share(self):
        text = (ROOT / "helper/launch.py").read_text()
        self.assertNotIn("You can still use the launcher from the share", text)
        self.assertNotIn("then run this launcher again from the shared", text)
        self.assertIn("independently verified package", text)
        self.assertIn("Run the installed Document Writer shortcut.", text)


if __name__ == "__main__":
    unittest.main()
