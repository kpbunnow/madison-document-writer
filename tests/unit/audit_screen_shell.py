"""The approved screen contract normalizes only application payload and release identity."""

import hashlib
import json
from pathlib import Path
import unittest

from screen_shell_reference import normalized_shell, shell_sha256

ROOT = Path(__file__).resolve().parents[2]


class ScreenShell(unittest.TestCase):
    def test_payload_and_release_only(self):
        before = '<style>.active { color: red; }</style><h1>2026-10-24 R63</h1><script>var B="YWJj"</script>'
        expected = '<style>.active { color: red; }</style><h1>@RELEASE@</h1><script>var B="PAYLOAD"</script>'
        self.assertEqual(normalized_shell(before, "2026-10-24 R63"), expected)
        self.assertEqual(shell_sha256(before, "2026-10-24 R63"), shell_sha256(before.replace("YWJj", "ZGVm"), "2026-10-24 R63"))
        self.assertNotEqual(shell_sha256(before, "2026-10-24 R63"), shell_sha256(before.replace("red", "blue"), "2026-10-24 R63"))
        for malformed in [before.replace('var B="YWJj"', ""), before + '<script>var B="YWJj"</script>']:
            with self.assertRaises(ValueError):
                normalized_shell(malformed, "2026-10-24 R63")
        self.assertIn("2026-10-24 R63", normalized_shell(before, "2099-01-01 R99"))
        with self.assertRaises(ValueError):
            normalized_shell(before, "")

    def test_reference_provenance_and_frozen_print(self):
        reference = json.loads((ROOT / "tests/fixtures/screen_shell_reference.json").read_text(encoding="utf-8"))
        self.assertEqual(reference["schemaVersion"], 1)
        self.assertRegex(reference["baseline"]["sourceCommit"], r"^[0-9a-f]{40}$")
        self.assertRegex(reference["baseline"]["verifiedInputsSha256"], r"^[0-9a-f]{64}$")
        self.assertTrue(reference["baseline"]["sourceClean"])
        self.assertTrue(reference["baseline"]["legacyScreenCheckPassed"])
        for page in reference["files"].values():
            self.assertRegex(page["beforeNormalizedShellSha256"], r"^[0-9a-f]{64}$")
            self.assertRegex(page["normalizedShellSha256"], r"^[0-9a-f]{64}$")
        self.assertEqual(
            hashlib.sha256((ROOT / "app/assets/approved-print-style.css").read_bytes()).hexdigest(), reference["baseline"]["approvedPrintSha256"]
        )


if __name__ == "__main__":
    unittest.main()
