"""R51 direct maintained layout and setup contracts."""

from pathlib import Path
import unittest
import json
import subprocess
import sys
import os
import hashlib
import base64
import re

ROOT = Path(__file__).resolve().parents[2]

# Reviewed screen-only contrast correction; retain the historical shell hash.
# Require the exact new declaration before reversing it for byte comparison.
THEME_BUTTON_TRANSITION = """    /* Keep background and text colors in sync when switching themes in a background tab. */
    transition: border-color 0.12s;"""
BASELINE_BUTTON_TRANSITION = """    transition:
      background 0.12s,
      border-color 0.12s;"""


class Layout(unittest.TestCase):
    def test_no_flat_source_projection_or_mapping(self):
        for name in ["tools/repository_stage.py", "tools/source-map.json", "build/runtime"]:
            self.assertFalse((ROOT / name).exists(), name)
        for name in ["tools/build.py", "tools/run_tests.py", "tools/verify_release.py", "tools/package_release.py"]:
            self.assertNotIn("repository_stage", (ROOT / name).read_text())

    def test_stable_manual_and_explicit_counter(self):
        version = json.loads((ROOT / "version.json").read_text())
        self.assertEqual(version["helperBuild"], int(version["helperVersion"].split(".")[-1]))
        manifest = json.loads((ROOT / "tools/runtime-manifest.template.json").read_text())
        self.assertIn("Program_Instruction_Manual.pdf", manifest["deploy"])
        self.assertFalse(any("ACCEPTANCE" in name for name in manifest["deploy"]))
        self.assertFalse(any(p.stem.split("_")[-1].isdigit() for p in (ROOT / "app/modules").glob("*.js")))

    def test_built_browser_bytes_match_corrected_r50_apart_from_listed_changes(self):
        baseline = json.loads((ROOT / "tests/fixtures/reference/R51-R50-parity.json").read_text())
        version = json.loads((ROOT / "version.json").read_text())
        reviewed = baseline
        if version["authoringVersion"] == 12:
            reviewed = json.loads((ROOT / "tests/fixtures/reference/R54-runtime-parity.json").read_text())
            self.assertEqual(reviewed["release"], version["release"])
            self.assertEqual(reviewed["helperVersion"], version["helperVersion"])
            self.assertEqual(reviewed["historicalReference"], "R51-R50-parity.json")
        production = Path(os.environ.get("DW_PRODUCTION_DIR", ROOT / "build/dist"))
        for name, expected in baseline["files"].items():
            text = (production / name).read_text()
            bundle = re.search(r'var B="([A-Za-z0-9+/=]+)"', text)[1]
            code = base64.b64decode(bundle).decode().replace(version["release"], "@RELEASE@").replace(version["helperVersion"], "@HELPER@")
            code = re.sub(r"^// (?:modules/[^\n]+|shared.js|app/[^\n]+|build/generated/[^\n]+)\n", "", code, flags=re.M)
            shell = text.replace(bundle, "PAYLOAD").replace(version["release"], "@RELEASE@")
            self.assertEqual(shell.count(THEME_BUTTON_TRANSITION), 1, name + ": exact screen contrast correction")
            shell = shell.replace(THEME_BUTTON_TRANSITION, BASELINE_BUTTON_TRANSITION)
            self.assertEqual(hashlib.sha256(code.encode()).hexdigest(), reviewed["files"][name]["normalizedCodeSha256"], name)
            self.assertEqual(hashlib.sha256(shell.encode()).hexdigest(), expected["normalizedShellSha256"], name)

    def test_staff_docs_name_no_release_numbered_files(self):
        # Packaged records are renamed per release and the manual has one stable filename.
        stale = re.compile(r"\bR\d{2}-(?:ACCEPTANCE-RECORD|PRODUCTION-READINESS|REVIEW)\.md|\bR\d{2}_Program_Instruction_Manual")
        from zipfile import ZipFile

        texts = {p.name: p.read_text() for p in (ROOT / "docs/staff").glob("*") if p.suffix in {".md", ".html"}}
        texts["Program_Instruction_Manual.docx"] = ZipFile(ROOT / "docs/staff/Program_Instruction_Manual.docx").read("word/document.xml").decode()
        for name, text in texts.items():
            self.assertEqual(stale.findall(text), [], name)

    def test_current_release_package_documents_exist(self):
        version = json.loads((ROOT / "version.json").read_text())
        release = version["release"].split()[-1]
        review = ROOT / "docs/developer" / (release + "-REVIEW.md")
        self.assertTrue(review.is_file(), str(review))
        self.assertTrue(review.read_text().strip(), str(review))
        for suffix in ["PRODUCTION-READINESS", "ACCEPTANCE-RECORD"]:
            self.assertTrue((ROOT / "docs/developer" / (suffix + ".md")).is_file(), suffix)
            document = ROOT / "build/generated/release-docs" / (release + "-" + suffix + ".md")
            text = document.read_text()
            self.assertNotIn("{{", text, str(document))
            self.assertTrue(text.startswith("# " + release + " "), str(document))
            self.assertIn("Release " + version["release"] + " · Helper " + version["helperVersion"], text, str(document))

    def test_stalled_browser_workflow_fails_with_deadline(self):
        code = "const assert=require('assert/strict');const {runSuite}=require('./tools/browser_suite.cjs');(async()=>{await assert.rejects(runSuite('stalled-flow',()=>new Promise(()=>{}),25),/stalled-flow exceeded 25 ms/);console.log('deadline detected')})().catch(e=>{console.error(e);process.exit(1)});"
        run = subprocess.run(["node", "-e", code], cwd=ROOT, capture_output=True, text=True, timeout=5)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("deadline detected", run.stdout)

    def test_missing_browser_message_lists_both_setup_choices(self):
        run = subprocess.run(
            ["node", "tools/check_browser.cjs"],
            cwd=ROOT,
            env={**os.environ, "DW_BROWSER": str(ROOT / "no-browser-here")},
            capture_output=True,
            text=True,
            timeout=20,
        )
        self.assertNotEqual(run.returncode, 0)
        self.assertIn("npx playwright install chromium", run.stderr)
        self.assertIn("DW_BROWSER", run.stderr)
        self.assertNotIn("at BrowserType", run.stderr)
        runner = subprocess.run(
            [sys.executable, "tools/run_tests.py"],
            cwd=ROOT,
            env={**os.environ, "DW_BROWSER": str(ROOT / "no-browser-here")},
            capture_output=True,
            text=True,
            timeout=20,
        )
        self.assertNotEqual(runner.returncode, 0)
        self.assertIn("DW_BROWSER", runner.stderr)
        self.assertIn("npx playwright install chromium", runner.stderr)
        self.assertNotIn("Traceback", runner.stderr)

    def test_browser_preflight_and_history(self):
        self.assertTrue((ROOT / "tools/check_browser.cjs").is_file())
        history = ROOT / "archive/development-history/README.md"
        if (ROOT / "archive").exists():
            self.assertTrue(history.is_file())
        provenance = json.loads((ROOT / "docs/history/R51-HISTORY-RESTORE.json").read_text())
        self.assertEqual(len(provenance["sha256"]), 64)
        self.assertTrue(provenance["files"])
        text = (ROOT / "docs/developer/05-TESTING.md").read_text()
        self.assertIn("npx playwright install chromium", text)
        self.assertIn("DW_BROWSER", text)


if __name__ == "__main__":
    unittest.main()
