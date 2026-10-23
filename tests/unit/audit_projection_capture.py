"""Consolidation Phase 2 (T2): projection captures reused from the gate run are accepted only when complete and bound
to the current run, suite and source, from a flow that passed; the capture fixture publishes that envelope
atomically and records a failed flow as failed."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from audit_case_projection import load_capture

ROOT = Path(__file__).resolve().parents[2]
GOOD = {
    "format": "madison-projection-capture",
    "version": 1,
    "run": "run-1",
    "suite": "audit_summary",
    "source": "digest-1",
    "passed": True,
    "summaries": [{"file": {"case": {}}, "summary": {"case": {}}}],
}


class ProjectionCapture(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "audit_summary.json"

    def write(self, value):
        self.path.write_text(value if isinstance(value, str) else json.dumps(value), encoding="utf-8")

    def load(self):
        return load_capture(self.path, "audit_summary", "run-1", "digest-1")

    def test_current_complete_capture_is_accepted(self):
        self.write(GOOD)
        self.assertEqual(self.load(), GOOD["summaries"])

    def test_unusable_captures_fail_explicitly(self):
        cases = {
            "missing": None,
            "malformed": "{not json",
            "partial": '{"format": "madison-projection-capture", "version": 1, "run": "run-1"',
            "no envelope": [GOOD["summaries"][0]],
            "boolean version": {**GOOD, "version": True},
            "older run": {**GOOD, "run": "run-0"},
            "other suite": {**GOOD, "suite": "audit_lifecycle"},
            "other source": {**GOOD, "source": "digest-0"},
            "failed flow": {**GOOD, "passed": False},
            "passed not a boolean": {**GOOD, "passed": 1},
            "empty": {**GOOD, "summaries": []},
            "incomplete entry": {**GOOD, "summaries": [{"file": {}}]},
        }
        for name, value in cases.items():
            with self.subTest(name):
                self.path.unlink(missing_ok=True)
                if value is not None:
                    self.write(value)
                with self.assertRaises(AssertionError):
                    self.load()

    def test_non_utf8_or_bom_capture_is_refused(self):
        for encoding in ("utf-16", "utf-8-sig"):
            with self.subTest(encoding):
                self.path.write_bytes(json.dumps(GOOD).encode(encoding))
                with self.assertRaises((AssertionError, UnicodeError)):
                    self.load()

    def run_capture(self, exit_code):
        script = (
            "const capture = require('./tests/fixtures/projection_capture.cjs');"
            "let summarize = (f) => ({ summarized: f });"
            "eval(capture);"
            "summarize({ case: { number: 'QA-1' } });"
            "process.exitCode = " + str(exit_code) + ";"
        )
        env = {
            **os.environ,
            "DW_PROJECTION_CAPTURE": str(self.path),
            "DW_PROJECTION_RUN": "run-1",
            "DW_PROJECTION_SUITE": "audit_summary",
            "DW_PROJECTION_SOURCE": "digest-1",
        }
        subprocess.run(["node", "-e", script], cwd=ROOT, env=env, check=False, timeout=60)
        return json.loads(self.path.read_text(encoding="utf-8"))

    def test_fixture_publishes_a_bound_envelope(self):
        capture = self.run_capture(0)
        self.assertEqual(
            {k: capture[k] for k in ("format", "version", "run", "suite", "source", "passed")},
            {k: GOOD[k] for k in ("format", "version", "run", "suite", "source", "passed")},
        )
        self.assertEqual(capture["summaries"], [{"file": {"case": {"number": "QA-1"}}, "summary": {"summarized": {"case": {"number": "QA-1"}}}}])
        self.assertEqual(list(Path(self.temp.name).glob("*.tmp")), [], "published by rename; no temporary file left")
        self.assertEqual(len(self.load()), 1)

    def test_fixture_records_a_failed_flow_as_failed(self):
        self.assertFalse(self.run_capture(1)["passed"])
        with self.assertRaises(AssertionError):
            self.load()


if __name__ == "__main__":
    unittest.main()
