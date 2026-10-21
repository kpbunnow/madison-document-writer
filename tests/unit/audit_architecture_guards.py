"""Guards against reintroducing designs that were deliberately removed. Each names the decision it protects."""

import os
from pathlib import Path
import unittest

ROOT = Path(os.environ["DW_REPO_ROOT"])


class RemovedArchitecture(unittest.TestCase):
    # R50/R51: generated output lives under build/; no copied source tree, root bundles or source map.
    def test_generated_output_is_not_in_the_source_root(self):
        for name in ("app.js", "reports.js", "RELEASE", "runtime-manifest.json", "generate_module_index.cjs", "MODULE-INDEX.json", "source"):
            self.assertFalse((ROOT / name).exists(), name)
        self.assertFalse((ROOT / "tools/source-map.json").exists())

    # R51: builds and tests read maintained folders directly; no flat staging copy.
    def test_no_flat_source_projection_or_mapping(self):
        for name in ["tools/repository_stage.py", "tools/source-map.json", "build/runtime"]:
            self.assertFalse((ROOT / name).exists(), name)
        for name in ["tools/build.py", "tools/run_tests.py", "tools/verify_release.py", "tools/package_release.py"]:
            self.assertNotIn("repository_stage", (ROOT / name).read_text())

    # R50: direct ES module imports; no universal runtime registry or numbered init modules.
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

    # R52/R53: release signing was removed; updates are checked against runtime-manifest.json.
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


if __name__ == "__main__":
    unittest.main()
