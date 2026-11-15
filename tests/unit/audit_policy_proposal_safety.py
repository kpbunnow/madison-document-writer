"""A review-only policy proposal must never mint approval, mutate inputs or activate runtime policy."""

import copy
import json
from pathlib import Path
import runpy
import sys
import tempfile
import unittest
from unittest.mock import patch

from propose_policy_version import propose

ROOT = Path(__file__).resolve().parents[2]


class ProposalSafety(unittest.TestCase):
    def inputs(self):
        return (
            {"id": "synthetic", "versions": [{"from": "2026-01-01", "to": None, "status": "approved", "source": {"ordinance": "RETAINED"}}]},
            {
                "from": "1900-01-01",
                "to": "1900-02-01",
                "status": "approved",
                "review": {"reviewer": "forged approval"},
                "rawText": "SYNTHETIC exported legal text",
                "source": {"url": "https://example.invalid/synthetic", "ordinance": "old"},
                "nested": {"amount": 100},
            },
        )

    def test_proposal_forces_review_and_retains_original_ranges_and_source_provenance(self):
        existing, candidate = self.inputs()
        before = copy.deepcopy((existing, candidate))
        result = propose(existing, candidate, "2026-11-15", "SYNTHETIC-2026-001")
        self.assertEqual((existing, candidate), before)
        self.assertEqual(result["status"], "proposal-only")
        self.assertIn("prior-range closure", result["requires"])
        self.assertIn("No runtime change", result["requires"])
        self.assertEqual(result["entry"]["versions"][:-1], existing["versions"])
        proposed = result["entry"]["versions"][-1]
        self.assertEqual((proposed["from"], proposed["to"], proposed["status"], proposed["review"]), ("2026-11-15", None, "manual-only", None))
        self.assertEqual(proposed["source"], {"url": candidate["source"]["url"], "ordinance": "SYNTHETIC-2026-001", "rowText": candidate["rawText"]})
        proposed["nested"]["amount"] = 999
        result["entry"]["versions"][0]["source"]["ordinance"] = "changed proposal"
        self.assertEqual((existing, candidate), before, "proposal edits cannot alias approved/source facts")
        minimal = propose({"versions": []}, {}, "2026-11-15", "SYNTHETIC")
        self.assertEqual(minimal["entry"]["versions"][0]["source"]["rowText"], "")

    def test_real_cli_refuses_invalid_inputs_before_replacing_output(self):
        with tempfile.TemporaryDirectory() as folder:
            base = Path(folder)
            existing, candidate = self.inputs()
            old, new, output = base / "existing.json", base / "candidate.json", base / "proposal.json"
            old.write_text(json.dumps(existing), encoding="utf-8")
            new.write_text(json.dumps(candidate), encoding="utf-8")
            original = (old.read_bytes(), new.read_bytes())

            def run(day="2026-11-15", ordinance="SYNTHETIC"):
                with patch.object(
                    sys,
                    "argv",
                    [
                        str(ROOT / "tools/propose_policy_version.py"),
                        str(old),
                        str(new),
                        "--effective",
                        day,
                        "--ordinance",
                        ordinance,
                        "--output",
                        str(output),
                    ],
                ):
                    runpy.run_path(str(ROOT / "tools/propose_policy_version.py"), run_name="__main__")

            run()
            retained = output.read_bytes()
            result = json.loads(retained)
            self.assertEqual(result["status"], "proposal-only")
            self.assertEqual(result["entry"]["versions"][-1]["status"], "manual-only")
            for day, ordinance in [("2026-02-30", "SYNTHETIC"), ("not a date", "SYNTHETIC"), ("2026-11-15", "  ")]:
                with self.subTest(day=day, ordinance=ordinance), self.assertRaises(ValueError):
                    run(day, ordinance)
                self.assertEqual(output.read_bytes(), retained)
                self.assertEqual((old.read_bytes(), new.read_bytes()), original)


if __name__ == "__main__":
    unittest.main()
