"""Verify maintained source ownership and release inventory outside the test projection."""

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(os.environ["DW_REPO_ROOT"])


class RepositoryContract(unittest.TestCase):
    def test_maintained_roots_and_generated_exclusions(self):
        for name in ("app/modules", "helper", "policy", "tests/unit", "tests/browser", "tests/fixtures", "tools", "docs/staff", "docs/developer"):
            self.assertTrue((ROOT / name).is_dir(), name)
        for name in ("app.js", "reports.js", "RELEASE", "runtime-manifest.json", "generate_module_index.cjs", "MODULE-INDEX.json", "source"):
            self.assertFalse((ROOT / name).exists(), name)
        self.assertFalse((ROOT / "tools/source-map.json").exists())
        manifest = json.loads((ROOT / "tools/runtime-manifest.template.json").read_text())
        for source in manifest["deploy"].values():
            self.assertFalse(source.startswith("archive/"), source)
            self.assertNotIn("..", Path(source).parts)
            self.assertTrue((ROOT / source).is_file(), source)

    def test_direct_module_boundaries(self):
        for stem in ("app", "reports"):
            entry = (ROOT / "app/modules" / (stem + "_entry.js")).read_text()
            self.assertLess(len(entry), 200)
            self.assertIn(stem + "_core.js", entry)
        for p in (ROOT / "app/modules").glob("*.js"):
            text = p.read_text()
            self.assertNotIn("$runtime", text, p.name)
            self.assertNotIn("$modules", text, p.name)
            if p.stem.startswith(("app_", "reports_")) and p.stem.rsplit("_", 1)[-1].isdigit():
                self.assertNotIn("function initModule", text, p.name)

    def test_staff_only_signed_deployment_contract(self):
        manifest = json.loads((ROOT / "tools/runtime-manifest.template.json").read_text())
        self.assertEqual(set(manifest["required"] + manifest["optional"]), set(manifest["deploy"]))
        for target in manifest["deploy"]:
            self.assertFalse(
                any(
                    x in target.lower()
                    for x in (
                        "continuation",
                        "development_prompt",
                        "-review",
                        "roadmap",
                        "maintenance",
                        "production-readiness",
                        "verification/",
                        "tests/",
                    )
                ),
                target,
            )
        self.assertIn("Program_Instruction_Manual.pdf", manifest["deploy"])
        self.assertIn("trusted-connections.json", manifest["required"])

    def test_single_version_source_and_mismatch_refusal(self):
        version = json.loads((ROOT / "version.json").read_text())
        self.assertEqual((version["authoringVersion"], version["caseSchema"], version["summaryVersion"], version["backupVersion"]), (12, 5, 6, 2))
        for name in ("package.json", "package-lock.json"):
            self.assertEqual(json.loads((ROOT / name).read_text())["version"], version["helperVersion"])
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "tools").mkdir()
            shutil.copyfile(ROOT / "tools/project_layout.py", root / "tools/project_layout.py")
            (root / "version.json").write_text(json.dumps(version))
            (root / "package.json").write_text('{"version":"wrong"}')
            result = subprocess.run(
                [sys.executable, "-c", "from project_layout import version; version()"], cwd=root / "tools", capture_output=True, text=True
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("disagrees with version.json", result.stderr)

    def test_protocol_drift_is_refused_before_build(self):
        paths = [
            "tools/project_layout.py",
            "version.json",
            "package.json",
            "package-lock.json",
            "app/assets/shared.js",
            "app/modules/app_core.js",
            "app/modules/draft_recovery.js",
            "app/modules/inspection_import.js",
        ]
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in paths:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)
            original = json.loads((root / "version.json").read_text())
            for key in ("summaryVersion", "caseSchema", "backupVersion", "authoringVersion"):
                with self.subTest(key=key):
                    value = dict(original)
                    value[key] += 1
                    (root / "version.json").write_text(json.dumps(value))
                    result = subprocess.run(
                        [sys.executable, "-c", "from project_layout import version; version()"], cwd=root / "tools", capture_output=True, text=True
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("disagrees with version.json " + key, result.stderr)

    def test_approved_print_style_is_immutable(self):
        expected = json.loads((ROOT / "tests/fixtures/reference/R50-Frozen-Print-Style.json").read_text())
        actual = hashlib.sha256((ROOT / "app/assets/approved-print-style.css").read_bytes()).hexdigest()
        self.assertEqual(actual, expected["sha256"])


if __name__ == "__main__":
    unittest.main()
