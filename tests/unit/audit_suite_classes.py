"""Consolidation Phase 6: suites that may launch Chromium are found through the local modules they require, so
moving a browser launch into a shared helper keeps the suite serial."""

from pathlib import Path
import re
import tempfile
import unittest

from suite_classes import local_closure, uses_browser

ROOT = Path(__file__).resolve().parents[2]
OLD_RULE = re.compile(r"chromium|playwright|DW_BROWSER")


class SuiteClasses(unittest.TestCase):
    def suites(self):
        return [p for p in sorted((ROOT / "tests/unit").glob("audit_*")) if p.suffix in {".js", ".py"}]

    def test_every_suite_the_text_rule_serialized_stays_serial(self):
        for suite in self.suites():
            if OLD_RULE.search(suite.read_text(encoding="utf-8")):
                self.assertTrue(uses_browser(suite), suite.name)

    def test_every_suite_that_reaches_playwright_is_serial(self):
        for suite in self.suites():
            if any("playwright" in p.read_text(encoding="utf-8") for p in local_closure(suite)):
                self.assertTrue(uses_browser(suite), suite.name)

    def test_a_browser_launch_moved_into_a_helper_is_found(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "unit").mkdir()
            (root / "fixtures").mkdir()
            (root / "fixtures/launch.cjs").write_text('const { chromium } = require("playwright");\nmodule.exports = () => chromium.launch();\n')
            (root / "fixtures/indirect.cjs").write_text('module.exports = require("./launch.cjs");\n')
            (root / "fixtures/plain.cjs").write_text('module.exports = () => 1;\nrequire("./cycle");\n')
            (root / "fixtures/cycle.js").write_text('require("./plain.cjs");\n')
            browser = root / "unit/audit_uses_helper.js"
            browser.write_text('const launch = require("../fixtures/indirect.cjs");\nlaunch();\n')
            plain = root / "unit/audit_plain.js"
            plain.write_text('require("../fixtures/plain.cjs");\n')
            self.assertFalse(OLD_RULE.search(browser.read_text()), "the suite itself names no browser")
            self.assertTrue(uses_browser(browser), "found through two levels of helpers")
            self.assertFalse(uses_browser(plain), "a helper without a browser does not change the class")
            self.assertEqual(
                {p.name for p in local_closure(plain)},
                {"audit_plain.js", "plain.cjs", "cycle.js"},
                "circular requires terminate",
            )


if __name__ == "__main__":
    unittest.main()
