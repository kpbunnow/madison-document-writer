"""R51 direct maintained layout and setup contracts."""

from pathlib import Path
import unittest
import json
import subprocess
import sys
import os
import hashlib
import re

ROOT = Path(__file__).resolve().parents[2]

# Reviewed screen-only contrast correction; retain the historical shell hash.
# Require the exact new declaration before reversing it for byte comparison.
THEME_BUTTON_TRANSITION = """    /* Keep background and text colors in sync when switching themes in a background tab. */
    transition: border-color 0.12s;"""
BASELINE_BUTTON_TRANSITION = """    transition:
      background 0.12s,
      border-color 0.12s;"""

# Reviewed R56 usability phase 3 screen-only addition: one contiguous block appended to ui-refresh.css (review
# modes, administrator tools group and the narrow-screen editor task bar). It must be byte-identical to the
# reviewed block and appear exactly once in each built shell; it is removed before the historical comparison.
PHASE3_SCREEN_MARKER = "\n/* R56 usability phase 3 (screen only):"
PHASE3_SCREEN_BYTES = 6198
PHASE3_SCREEN_SHA256 = "a04521eaf16338cdee94d07b27944ace99535db3e78d651ab596d8e97d835524"

# Reviewed R59 screen-only addition: one contiguous block appended after the phase 3 block (type tokens for Writer
# screens and the Reports chrome, the item due-date and remove controls, the selected inspection, the issued case
# row and the Review dialog sections). Same rules: exact bytes, exactly once per built shell, removed before the
# historical comparison.
R59_SCREEN_MARKER = "\n/* R59 screen styles (screen only):"
R59_SCREEN_BYTES = 5258
R59_SCREEN_SHA256 = "d3dc770011d70a2612b9ea893299e3936a39d046a7e03d96b19aa88402879cf5"


R60_SCREEN_MARKER = "\n/* R60 screen styles (screen only):"
R60_SCREEN_BYTES = 756
R60_SCREEN_SHA256 = "b3ee90fb22f0309ec21fe09991c49115c795b370da3970a41f6ae602c37c6bec"


def _ui_refresh():
    return (ROOT / "app/assets/ui-refresh.css").read_text(encoding="utf-8")


def phase3_screen_block():
    source = _ui_refresh()
    return source[source.index(PHASE3_SCREEN_MARKER) : source.index(R59_SCREEN_MARKER)]


def r59_screen_block():
    source = _ui_refresh()
    return source[source.index(R59_SCREEN_MARKER) : source.index(R60_SCREEN_MARKER)]


class Layout(unittest.TestCase):
    def test_stable_manual_and_explicit_counter(self):
        version = json.loads((ROOT / "version.json").read_text())
        self.assertEqual(version["helperBuild"], int(version["helperVersion"].split(".")[-1]))
        manifest = json.loads((ROOT / "tools/runtime-manifest.template.json").read_text())
        self.assertIn("Program_Instruction_Manual.pdf", manifest["deploy"])
        self.assertFalse(any("ACCEPTANCE" in name for name in manifest["deploy"]))
        self.assertFalse(any(p.stem.split("_")[-1].isdigit() for p in (ROOT / "app/modules").glob("*.js")))

    def test_built_shell_matches_corrected_r50_apart_from_listed_changes(self):
        # The application code is checked by its rendered output (print, court copy and stylesheet parity),
        # not by a whole-bundle hash; the HTML shell around it must still match corrected R50.
        baseline = json.loads((ROOT / "tests/fixtures/reference/R51-R50-parity.json").read_text())
        version = json.loads((ROOT / "version.json").read_text())
        production = Path(os.environ.get("DW_PRODUCTION_DIR", ROOT / "build/dist"))
        phase3 = phase3_screen_block()
        self.assertEqual(len(phase3.encode()), PHASE3_SCREEN_BYTES, "reviewed R56 phase 3 block size")
        self.assertEqual(hashlib.sha256(phase3.encode()).hexdigest(), PHASE3_SCREEN_SHA256, "reviewed R56 phase 3 block bytes")
        r59 = r59_screen_block()
        self.assertEqual(len(r59.encode()), R59_SCREEN_BYTES, "reviewed R59 screen block size")
        self.assertEqual(hashlib.sha256(r59.encode()).hexdigest(), R59_SCREEN_SHA256, "reviewed R59 screen block bytes")
        self.assertEqual(_ui_refresh().count(R59_SCREEN_MARKER), 1, "one R59 screen block")
        r60 = _ui_refresh()[_ui_refresh().index(R60_SCREEN_MARKER) :]
        self.assertEqual(_ui_refresh().count(R60_SCREEN_MARKER), 1)
        self.assertEqual(len(r60.encode()), R60_SCREEN_BYTES)
        self.assertEqual(hashlib.sha256(r60.encode()).hexdigest(), R60_SCREEN_SHA256)
        for name, expected in baseline["files"].items():
            text = (production / name).read_text()
            bundle = re.search(r'var B="([A-Za-z0-9+/=]+)"', text)[1]
            shell = text.replace(bundle, "PAYLOAD").replace(version["release"], "@RELEASE@")
            self.assertEqual(shell.count(THEME_BUTTON_TRANSITION), 1, name + ": exact screen contrast correction")
            shell = shell.replace(THEME_BUTTON_TRANSITION, BASELINE_BUTTON_TRANSITION)
            self.assertEqual(shell.count(phase3), 1, name + ": exact R56 phase 3 screen block")
            shell = shell.replace(phase3, "")
            self.assertEqual(shell.count(r59), 1, name + ": exact R59 screen block")
            shell = shell.replace(r59, "")
            self.assertEqual(shell.count(r60), 1, name + ": exact R60 address-flow correction")
            shell = shell.replace(r60, "")
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
