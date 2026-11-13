"""PR metadata must not execute title text; CI stays read-only and verifies the reviewed head."""

import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml
from release_evidence import source_provenance

ROOT = Path(__file__).resolve().parents[2]


class DevelopmentWorkflow(unittest.TestCase):
    def test_every_project_python_job_uses_the_314_toolchain(self):
        for name in ("verify.yml", "pr-format.yml", "windows-recovery.yml"):
            for job in self.workflow(name)["jobs"].values():
                pins = [s["with"]["python-version"] for s in job["steps"] if "setup-python@" in s.get("uses", "")]
                self.assertEqual(len(pins), 1, name)
                for pin in pins:
                    if "matrix.python" in pin:
                        self.assertEqual(job["strategy"]["matrix"]["python"], ["3.14.10"])
                    else:
                        self.assertEqual(pin, "3.14.10", name)

    def workflow(self, name):
        # GitHub uses YAML's event key "on"; BaseLoader avoids YAML 1.1's boolean coercion of that key.
        return yaml.load((ROOT / ".github/workflows" / name).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)

    def test_job_environment_expressions_use_available_contexts(self):
        # GitHub validates job-level env before runner context exists. Step env has different rules.
        allowed = {"github", "inputs", "matrix", "needs", "secrets", "strategy", "vars"}
        for path in (ROOT / ".github/workflows").glob("*.yml"):
            for name, job in self.workflow(path.name)["jobs"].items():
                for value in job.get("env", {}).values():
                    for context in re.findall(r"\$\{\{\s*(\w+)\.", value):
                        self.assertIn(context, allowed, f"{path.name}/{name}: unavailable job env context {context}")

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
        command = next(s["run"] for s in workflow["jobs"]["pr-format"]["steps"] if "run" in s)
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

    def test_browser_cache_is_exact_and_never_skips_installation_or_verification(self):
        workflow = self.workflow("verify.yml")
        browser_path = workflow["jobs"]["stages"]["env"]["PLAYWRIGHT_BROWSERS_PATH"]
        self.assertNotRegex(browser_path, r"(?:^|/)\.{1,2}(?:/|$)", "actions/cache refuses dot or parent path components")
        self.assertEqual(browser_path, workflow["jobs"]["full-gate"]["env"]["PLAYWRIGHT_BROWSERS_PATH"])
        steps = workflow["jobs"]["stages"]["steps"]
        cache = next(s for s in steps if s.get("uses", "").startswith("actions/cache@"))
        for part in ("runner.os", "runner.arch", "steps.playwright.outputs.version", "hashFiles('package-lock.json')"):
            self.assertIn(part, cache["with"]["key"])
        self.assertNotIn("restore-keys", cache["with"], "no fallback to another browser or dependency lock")
        install = next(s for s in steps if "npx playwright install --with-deps chromium" in s.get("run", ""))
        gate = next(s for s in steps if "python tools/verify_release.py" in s.get("run", ""))
        self.assertNotIn("if", install, "a cache hit never skips OS dependency/browser installation checks")
        self.assertNotIn("if", gate, "cached binaries are not cached passing results")

    def test_full_gate_cannot_succeed_after_a_failed_cancelled_or_skipped_stage(self):
        workflow = self.workflow("verify.yml")
        workers = workflow["jobs"]["stages"]
        self.assertEqual(workers["strategy"]["matrix"]["stage"], ["regression", "browser"])
        self.assertEqual(workers["strategy"]["fail-fast"], "false")
        gate = workflow["jobs"]["full-gate"]
        self.assertEqual(gate["needs"], "stages")
        self.assertEqual(gate["if"], "always()")
        guard = gate["steps"][0]
        self.assertEqual(guard["env"]["STAGE_RESULT"], "${{ needs.stages.result }}")
        for status in ["success", "failure", "cancelled", "skipped", ""]:
            with self.subTest(status=status):
                result = subprocess.run(
                    ["bash", "-c", guard["run"]], env={**os.environ, "STAGE_RESULT": status}, capture_output=True, encoding="utf-8"
                )
                self.assertEqual(result.returncode == 0, status == "success")
        self.assertEqual(gate["permissions"], {"contents": "read", "actions": "read"})
        self.assertFalse(any("download-artifact@" in step.get("uses", "") for step in gate["steps"]))
        assembly = next(step for step in gate["steps"] if "--assemble-github" in step.get("run", ""))
        self.assertEqual(assembly["env"], {"GITHUB_TOKEN": "${{ github.token }}"})
        for job in workflow["jobs"].values():
            self.assertNotIn("continue-on-error", job)
            for step in job["steps"]:
                if "continue-on-error" in step:
                    self.assertTrue(step.get("uses", "").startswith("actions/upload-artifact@"))
                    self.assertEqual(step["continue-on-error"], "true")
                    self.assertRegex(step["id"], r"^upload_[1-9]+_[12]$")
                if "uses" in step:
                    self.assertRegex(step["uses"], r"^actions/[a-z-]+@[0-9a-f]{40}$")

    def test_upload_retries_are_bounded_same_payload_and_final_failure_is_fatal(self):
        for name in ("verify.yml", "windows-recovery.yml"):
            for job in self.workflow(name)["jobs"].values():
                uploads = [step for step in job["steps"] if step.get("uses", "").startswith("actions/upload-artifact@")]
                self.assertEqual(len(uploads) % 3, 0)
                for offset in range(0, len(uploads), 3):
                    first, second, third = uploads[offset : offset + 3]
                    prefix = first["id"].removesuffix("_1")
                    self.assertEqual([step["id"] for step in [first, second, third]], [prefix + "_1", prefix + "_2", prefix + "_3"])
                    self.assertEqual(first["continue-on-error"], "true")
                    self.assertEqual(second["continue-on-error"], "true")
                    self.assertNotIn("continue-on-error", third, "all upload attempts failing must fail the job")
                    self.assertEqual(second["if"], "${{ !cancelled() && steps." + prefix + "_1.outcome == 'failure' }}")
                    self.assertEqual(
                        third["if"],
                        "${{ !cancelled() && steps." + prefix + "_1.outcome == 'failure' && steps." + prefix + "_2.outcome == 'failure' }}",
                    )
                    for retry in [second, third]:
                        self.assertEqual(retry["uses"], first["uses"])
                        self.assertEqual(retry["with"], {**first["with"], "overwrite": "true"})
                    if first["with"]["name"].startswith("stage-"):
                        self.assertEqual(first["if"], "success()")
                        self.assertEqual(first["with"]["if-no-files-found"], "error")

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
