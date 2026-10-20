import os, tempfile, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
import server, case_store


class LowSeverityHardening(unittest.TestCase):
    def test_reserved_case_names_and_trailing_characters(self):
        for stem in ["CON", "con", "NUL", "PRN", "AUX", *[f"COM{n}" for n in range(1, 10)], *[f"LPT{n}" for n in range(1, 10)]]:
            for tail in [".json", ".extra.json"]:
                with self.subTest(stem=stem, tail=tail), self.assertRaises(ValueError):
                    case_store.safe_json_name(stem + tail)
        for name in ["safe.json.", "safe.json "]:
            with self.assertRaises(ValueError):
                case_store.safe_json_name(name)
        self.assertEqual(case_store.safe_json_name("CONDITION - QA-001.json"), "CONDITION - QA-001.json")

    def test_environment_renderer_path_and_outlook_path_are_ignored(self):
        with tempfile.TemporaryDirectory() as folder:
            planted = Path(folder) / "outlook"
            planted.write_text("not an installed client")
            planted.chmod(0o755)
            with patch.dict(os.environ, {"DW_CHROME": str(planted)}):
                self.assertNotEqual(server.find_chrome(), str(planted))
            with patch.object(server.shutil, "which", return_value=str(planted)):
                self.assertNotEqual(server.find_outlook(), str(planted))

    def test_windows_never_launches_a_path_planted_browser(self):
        with (
            patch.object(server, "os", SimpleNamespace(name="nt", environ={})),
            patch.object(server.shutil, "which", return_value="/planted/chromium.exe"),
        ):
            self.assertIsNone(server.find_chrome())

    def test_production_never_disables_renderer_sandbox(self):
        with tempfile.TemporaryDirectory() as folder:
            calls = []

            def render(cmd, **kwargs):
                calls.append(cmd)
                Path(next(x.split("=", 1)[1] for x in cmd if x.startswith("--print-to-pdf="))).write_bytes(b"%PDF-1.4 synthetic")
                return SimpleNamespace(returncode=0, stderr=b"")

            with (
                patch.dict(os.environ, {"DW_TEST_NO_SANDBOX": "1"}),
                patch.object(server, "find_chrome", return_value="known-installed-chrome"),
                patch.object(server.subprocess, "run", side_effect=render),
            ):
                server.make_pdf("<html><head></head><body>safe</body></html>", Path(folder) / "sample.pdf")
            self.assertNotIn("--no-sandbox", calls[0])


if __name__ == "__main__":
    unittest.main()
