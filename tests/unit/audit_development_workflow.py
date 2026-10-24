"""PR metadata must not execute title text; CI stays read-only and verifies the reviewed head."""

import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml
from release_evidence import source_provenance

ROOT = Path(__file__).resolve().parents[2]


class DevelopmentWorkflow(unittest.TestCase):
    def workflow(self, name):
        # GitHub uses YAML's event key "on"; BaseLoader avoids YAML 1.1's boolean coercion of that key.
        return yaml.load((ROOT / ".github/workflows" / name).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)

    def test_ci_is_readonly_and_pins_actions_and_toolchain(self):
        workflow = self.workflow("verify.yml")
        self.assertIn("pull_request", workflow["on"])
        self.assertNotIn("pull_request_target", workflow["on"])
        self.assertEqual(workflow["permissions"], {"contents": "read"})
        steps = workflow["jobs"]["full-gate"]["steps"]
        for step in steps:
            if "uses" in step:
                self.assertRegex(step["uses"], r"^actions/[a-z-]+@[0-9a-f]{40}$")
        checkout = next(s for s in steps if s.get("uses", "").startswith("actions/checkout@"))
        self.assertIn("pull_request.head.sha", checkout["with"]["ref"])
        self.assertEqual(checkout["with"]["persist-credentials"], "false")
        commands = "\n".join(s.get("run", "") for s in steps)
        self.assertIn("npm ci", commands)
        self.assertIn("--require-hashes", commands)
        self.assertIn("python tools/verify_release.py", commands)
        self.assertNotIn("DW_FAST=1", commands)
        self.assertEqual(next(s for s in steps if "upload-artifact@" in s.get("uses", ""))["if"], "always()")

    def test_pr_title_is_data_and_missing_sections_fail(self):
        workflow = self.workflow("pr-format.yml")
        self.assertNotIn("pull_request_target", workflow["on"])
        command = workflow["jobs"]["pr-format"]["steps"][0]["run"]
        self.assertNotIn("${{", command, "untrusted titles must be passed as environment data, never shell interpolation")
        script = command.split("python3 - <<'PY'\n", 1)[1].rsplit("\nPY", 1)[0]
        body = (ROOT / ".github/pull_request_template.md").read_text(encoding="utf-8")
        for title, text, expected in [
            ("fix(storage): preserve drafts during startup", body, 0),
            ("release: 2026-10-24 R63", body, 0),
            ("release: 2026-99-99 R63", body, 1),
            ("Miscellaneous changes", body, 1),
            ("docs(development): update review guidance", "No sections", 1),
        ]:
            with self.subTest(title=title):
                run = subprocess.run(
                    [sys.executable, "-c", script], env={**os.environ, "PR_TITLE": title, "PR_BODY": text}, capture_output=True, encoding="utf-8"
                )
                self.assertEqual(run.returncode, expected, run.stdout + run.stderr)
        with tempfile.TemporaryDirectory() as folder:
            marker = Path(folder) / "must-not-execute"
            title = "fix(storage): $(touch " + str(marker) + ")"
            run = subprocess.run(
                [sys.executable, "-c", script], env={**os.environ, "PR_TITLE": title, "PR_BODY": body}, capture_output=True, encoding="utf-8"
            )
            self.assertEqual(run.returncode, 0, run.stderr)
            self.assertFalse(marker.exists())

    def test_source_archive_without_git_keeps_content_provenance(self):
        with tempfile.TemporaryDirectory() as folder:
            first = source_provenance(Path(folder), {"file": "hash-a"})
            second = source_provenance(Path(folder), {"file": "hash-b"})
            self.assertIsNone(first["sourceCommit"])
            self.assertIsNone(first["sourceClean"])
            self.assertRegex(first["verifiedInputsSha256"], r"^[a-f0-9]{64}$")
            self.assertNotEqual(first["verifiedInputsSha256"], second["verifiedInputsSha256"])

    @unittest.skipUnless(shutil.which("git"), "Git is optional for extracted source ZIPs")
    def test_git_provenance_distinguishes_clean_commit_and_changed_source(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)

            def git(*args):
                return subprocess.run(["git", *args], cwd=root, check=True, capture_output=True, encoding="utf-8")

            git("init")
            (root / "source.txt").write_text("original", encoding="utf-8")
            git("add", "source.txt")
            git("-c", "user.name=Synthetic Review", "-c", "user.email=synthetic@example.invalid", "commit", "-m", "Synthetic checkpoint")
            clean = source_provenance(root, {"source.txt": "first"})
            self.assertTrue(clean["sourceClean"])
            self.assertEqual(clean["sourceCommit"], git("rev-parse", "HEAD").stdout.strip())
            (root / "source.txt").write_text("changed", encoding="utf-8")
            self.assertFalse(source_provenance(root, {"source.txt": "second"})["sourceClean"])


if __name__ == "__main__":
    unittest.main()
