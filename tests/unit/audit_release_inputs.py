"""Exercise real packaging with synthetic source, policy drift and forbidden local inputs."""

import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

from project_layout import fingerprint
from release_evidence import fingerprint as release_fingerprint
from release_inputs import deployment_inputs, verify_deployment, source_inventory, verify_package_links

ROOT = Path(__file__).resolve().parents[2]


def put(root, name, value):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value if isinstance(value, str) else json.dumps(value))


def fixture(root):
    for name in [
        "tools/package_release.py",
        "tools/project_layout.py",
        "tools/release_inputs.py",
        "tools/release_evidence.py",
        "tools/deploy_manifest.py",
        "helper/verified_update.py",
    ]:
        target = root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    version = {"release": "2026-10-21 R55", "helperVersion": "2026.10.21.56", "helperBuild": 56}
    put(root, "version.json", version)
    deploy = {}
    for name in ["madison-document-writer.html", "madison-reports.html"]:
        deploy[name] = "build/dist/" + name
        put(root, deploy[name], "<!doctype html><html>SYNTHETIC</html>")
    for name in ["citation_policy.json", "calendar_policy.json", "runtime_identity.py", "DEPLOY.md"]:
        deploy[name] = "build/generated/" + name
        put(root, deploy[name], "SYNTHETIC VERIFIED " + name)
    for name in ["Program_Instruction_Manual.pdf", "Program_Instruction_Manual.docx"]:
        deploy[name] = "docs/staff/" + name
        put(root, deploy[name], "SYNTHETIC MANUAL")
    deploy["runtime-manifest.json"] = "build/generated/runtime-manifest.json"
    put(root, deploy["runtime-manifest.json"], {**version, "deploy": deploy})
    put(root, "helper/vendor/synthetic.txt", "SYNTHETIC VENDOR")
    put(root, "docs/developer/R55-REVIEW.md", "# Synthetic review")
    for name in ["ACCEPTANCE-RECORD", "PRODUCTION-READINESS"]:
        put(root, "build/generated/release-docs/R55-" + name + ".md", "# Synthetic " + name)
    put(root, "tests/unit/audit_synthetic.py", "# Synthetic discovery fixture")
    put(root, "tools/source-inventory.json", {})
    names = sorted(fingerprint(root))
    put(root, "tools/source-inventory.json", {"format": "madison-source-inventory", "version": 1, "files": names})
    results = [{"suite": name, "passed": True} for name in ["audit_synthetic.py", "tagcheck.js"]]
    put(root, "build/test-results/results.json", results)
    put(root, "build/test-results/r50-print-compatibility.json", {"checks": ["synthetic"]})
    put(
        root,
        "build/test-results/evidence.json",
        {
            "files": release_fingerprint(root),
            "resultsSha256": hashlib.sha256((root / "build/test-results/results.json").read_bytes()).hexdigest(),
        },
    )
    hashes = {name: hashlib.sha256((root / relative).read_bytes()).hexdigest() for name, relative in deploy.items() if name.endswith(".html")}
    proof = "build/verification/latest/"
    put(root, proof + "repository.json", {"passed": True, "files": fingerprint(root)})
    put(
        root,
        proof + "verification.json",
        {"passed": True, "runtimeHashes": hashes, "deploymentInputs": deployment_inputs(root), "suiteCount": 2, "axeScreens": 1},
    )
    put(root, proof + "browser/browser-results.json", {"passed": True, "runtimeHashes": hashes})
    put(root, proof + "browser/axe-results.json", {"passed": True})


class ReleaseInputs(unittest.TestCase):
    def package(self, root, output):
        return subprocess.run(
            [sys.executable, "tools/package_release.py", "--output", str(output)], cwd=root, capture_output=True, text=True, timeout=30
        )

    def test_real_archives_exclude_local_data_and_validate_without_git(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            root = base / "source"
            root.mkdir()
            fixture(root)
            for name in [
                ".env",
                "credentials.json",
                "private.pem",
                ".venv/example.txt",
                "Case JSON Files/private.json",
                "helper/logs/private.log",
                "helper/vendor/.env",
            ]:
                put(root, name, "SYNTHETIC PRIVATE CONTENT")
            run = self.package(root, base / "release")
            self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
            for archive in (base / "release").glob("*.zip"):
                with zipfile.ZipFile(archive) as z:
                    self.assertFalse(any(b"SYNTHETIC PRIVATE CONTENT" in z.read(n) for n in z.namelist()))
            source_zip = next((base / "release").glob("*-source.zip"))
            extracted = base / "extracted"
            with zipfile.ZipFile(source_zip) as z:
                z.extractall(extracted)
            self.assertEqual(source_inventory(root), source_inventory(extracted))

    def test_forbidden_inventory_entries_and_directory_links_are_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "source"
            root.mkdir()
            fixture(root)
            put(root, "credentials.json", "SYNTHETIC PRIVATE CONTENT")
            inventory = json.loads((root / "tools/source-inventory.json").read_text())
            inventory["files"] = sorted(inventory["files"] + ["credentials.json"])
            put(root, "tools/source-inventory.json", inventory)
            with self.assertRaisesRegex(ValueError, "forbidden"):
                source_inventory(root)
            outside = Path(tmp) / "external"
            outside.mkdir()
            (root / "linked-directory").symlink_to(outside, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "Linked source directory"):
                fingerprint(root)

    def test_package_document_links_must_resolve(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            put(root, "REVIEW.md", "[Accepted record](ACCEPTANCE.md) [Web](https://example.invalid/) [Local](#details)")
            put(root, "ACCEPTANCE.md", "# Open")
            verify_package_links(root, ["REVIEW.md"])
            (root / "ACCEPTANCE.md").unlink()
            with self.assertRaises(FileNotFoundError):
                verify_package_links(root, ["REVIEW.md"])

    def test_packager_refuses_every_changed_generated_input_before_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            root = base / "source"
            root.mkdir()
            fixture(root)
            paths = ["build/generated/" + name for name in ["citation_policy.json", "calendar_policy.json", "runtime_identity.py", "DEPLOY.md"]]
            paths += ["build/generated/release-docs/R55-ACCEPTANCE-RECORD.md", "build/generated/release-docs/R55-PRODUCTION-READINESS.md"]
            for name in paths:
                with self.subTest(name=name):
                    path = root / name
                    original = path.read_bytes()
                    path.write_bytes(original + b" CHANGED AFTER GATE")
                    run = self.package(root, base / "release")
                    self.assertNotEqual(run.returncode, 0)
                    self.assertIn("changed after testing", run.stderr)
                    self.assertFalse((base / "release").exists())
                    path.write_bytes(original)

    def test_packager_refuses_unowned_source_and_linked_inputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            root = base / "source"
            root.mkdir()
            fixture(root)
            outside = base / "outside.txt"
            outside.write_text("SYNTHETIC EXTERNAL CONTENT")
            target = root / "docs/developer/R55-REVIEW.md"
            target.unlink()
            target.symlink_to(outside)
            run = self.package(root, base / "release")
            self.assertNotEqual(run.returncode, 0)
            self.assertIn("Linked input refused", run.stderr)
            self.assertFalse((base / "release").exists())
            target.unlink()
            put(root, "docs/developer/R55-REVIEW.md", "# Synthetic review")
            put(root, "unexpected.py", "# Unowned source")
            run = self.package(root, base / "release")
            self.assertNotEqual(run.returncode, 0)
            self.assertFalse((base / "release").exists())

    def test_staging_damage_and_extra_files_are_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "source"
            root.mkdir()
            fixture(root)
            expected = deployment_inputs(root)
            stage = Path(tmp) / "stage"
            for target, value in expected.items():
                path = stage / target
                path.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(root / value["source"], path)
            verify_deployment(root, expected, stage)
            put(stage, "deploy/extra.py", "# Extra code")
            with self.assertRaisesRegex(ValueError, "file set"):
                verify_deployment(root, expected, stage)
            (stage / "deploy/extra.py").unlink()
            put(stage, "deploy/runtime_identity.py", "CHANGED DURING ASSEMBLY")
            with self.assertRaisesRegex(ValueError, "verified bytes"):
                verify_deployment(root, expected, stage)


if __name__ == "__main__":
    unittest.main()
