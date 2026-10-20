"""Release proof must be stable across temporary bundling and sensitive to real drift."""

from pathlib import Path
import tempfile
import unittest
from release_evidence import fingerprint


class BuildEvidence(unittest.TestCase):
    def test_generated_entries_do_not_hide_maintained_source_or_runtime_drift(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "app/modules").mkdir(parents=True)
            (root / "build/dist").mkdir(parents=True)
            maintained = root / "app/modules/app_entry.js"
            runtime = root / "build/dist/madison-document-writer.html"
            maintained.write_text("maintained entry v1")
            runtime.write_text("production runtime v1")
            before = fingerprint(root)
            (root / "build/generated/modules").mkdir(parents=True)
            # Esbuild's derived temporary entries may appear/disappear during a build.
            for name in (".app_build.js", ".reports_build.js"):
                (root / "build/generated/modules" / name).write_text("derived temporary input")
            self.assertEqual(before, fingerprint(root))
            # The exclusion is exact: an unrelated hidden module is still maintained evidence.
            other = root / "app/modules/.unexpected.js"
            other.write_text("unexpected source")
            self.assertNotEqual(before, fingerprint(root))
            other.unlink()
            maintained.write_text("maintained entry v2")
            self.assertNotEqual(before, fingerprint(root))
            maintained.write_text("maintained entry v1")
            runtime.write_text("production runtime v2")
            self.assertNotEqual(before, fingerprint(root))


if __name__ == "__main__":
    unittest.main()
