"""R52: no signing key. Updates are checked against runtime-manifest.json; tamper protection is folder permissions."""

import json
import re
import tempfile
import unittest
from pathlib import Path

import deploy_manifest
import verified_update
from project_layout import ROOT, assemble_deploy


class ManifestModel(unittest.TestCase):
    def test_signing_machinery_is_gone(self):
        for path in ["helper/release_trust.py", "helper/vendor/python/pure25519", "tools/sign_release.py", "requirements-signing.txt"]:
            self.assertFalse((ROOT / path).exists(), path)
        updater = (ROOT / "helper/verified_update.py").read_text()
        self.assertNotIn("verify_signature", updater)
        # R53 names runtime-manifest.sig only to report it as a stale leftover; it is never read or verified.
        self.assertNotRegex(updater, r"runtime-manifest\.sig\"\)?\s*\.read")
        self.assertNotIn('sig").read_bytes', updater)
        self.assertNotIn("--key", (ROOT / "tools/package_release.py").read_text())
        template = (ROOT / "tools/runtime-manifest.template.json").read_text()
        self.assertNotIn("release_trust", template)
        self.assertNotIn("pure25519", template)

    def deploy(self, root):
        folder = root / "deploy"
        folder.mkdir()
        assemble_deploy(folder)
        deploy_manifest.write_manifest(folder)
        return folder

    def test_assembled_deploy_has_only_manifest_and_runtime_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            deploy = self.deploy(root)
            names = {p.relative_to(deploy).as_posix() for p in deploy.rglob("*") if p.is_file()}
            self.assertIn("runtime-manifest.json", names)
            self.assertNotIn("runtime-manifest.sig", names)
            self.assertFalse(any("ACCEPTANCE-RECORD" in n or n.startswith("R5") for n in names), sorted(n for n in names if "R5" in n))
            self.assertFalse(any("pure25519" in n or n.endswith("release_trust.py") for n in names))
            (root / "stage").mkdir()
            (root / "local").mkdir()
            manifest = verified_update.stage_update(deploy, root / "stage", root / "local")
            self.assertEqual(set(manifest["files"]), names - {"runtime-manifest.json"})

    def test_changed_file_is_refused_and_consistent_rewrite_is_the_permission_boundary(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            deploy = self.deploy(root)
            target = deploy / "server.py"
            original = target.read_bytes()
            target.write_bytes(original + b"\n# changed without updating the manifest\n")
            for name in ("stage", "local"):
                (root / name).mkdir()
            with self.assertRaisesRegex(ValueError, "shared program files failed verification"):
                verified_update.stage_update(deploy, root / "stage", root / "local")
            # Documented limit: someone who can rewrite both the file and the manifest is not stopped by the
            # manifest. NTFS permissions on the deployment folder (release owner write only) are the control.
            deploy_manifest.write_manifest(deploy)
            (root / "stage2").mkdir()
            verified_update.stage_update(deploy, root / "stage2", root / "local")

    def test_generated_install_guide_states_the_permission_model(self):
        guide = (ROOT / "build/generated/DEPLOY.md") if (ROOT / "build/generated/DEPLOY.md").exists() else None
        if guide is None:
            matches = list((ROOT / "build").rglob("DEPLOY.md"))
            self.assertTrue(matches, "build the project first")
            guide = matches[0]
        text = guide.read_text()
        release = json.loads((ROOT / "version.json").read_text())["release"]
        number = release.split()[-1]
        self.assertTrue(set(re.findall(r"\bR\d{2,3}\b", text)) <= {number}, set(re.findall(r"\bR\d{2,3}\b", text)))
        self.assertIn("no signing key", text)
        self.assertIn("writable **only by the release owner**", text)
        self.assertNotIn("Ed25519", text)
        self.assertNotIn("Startup correction", text)


if __name__ == "__main__":
    unittest.main()
