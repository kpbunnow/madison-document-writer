"""The build-time deposit reading against the retained module: every ordinance family, quantity row, tier list,
stale notice and refusal, compared for the exact result or error and for untouched inputs."""

import copy
from pathlib import Path
import random
import unittest

import deposit_interpreter as current

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = {"__name__": "deposit_interpreter_reference"}
exec(
    compile((ROOT / "tests/fixtures/deposit_interpreter_reference.txt").read_text(encoding="utf-8"), "deposit_interpreter_reference", "exec"),
    NAMESPACE,
)

ORDINANCES = [
    "23.24(3)",
    "29.40(4)(b)",
    "10.185(6)(b)",
    "10.185(6)(a)2.",
    "8.14(2)(c)2.",
    "8.14(2)(c)3.",
    "29.40(3)(b)",
    "27.05(2)(s)",
    "29.21",
    "30.01(5)",
    "27.05(2)(c)",
    "1.01",
]
TEXTS = [
    "Failure to comply. Forfeiture $100.00 plus costs.",
    "Forfeiture $1,000.50 for each offense",
    "$250 per offense, or $75/inch of diameter",
    "$75/inch of diameter",
    "$30 /inch for trees removed",
    "Mandatory appearance required",
    "mandatory  appearance in court $500",
    "$200, $400, $800",
    "$50 for each day of noncompliance",
    "Fee based on size in square feet $200",
    "Percent of recycling 20% $100",
    "Tons not recycled $250",
    "No amount stated for this offense",
    "",
    "  spaced   out  $12.5  ",
]


def outcome(function, entry, version):
    entry, version = copy.deepcopy(entry), copy.deepcopy(version)
    try:
        result = function(entry, version)
    except Exception as error:
        return ("error", type(error).__name__, str(error), entry, version)
    return ("result", result, entry, version)


class DepositInterpreterRules(unittest.TestCase):
    def test_readings_match_the_retained_module(self):
        rng = random.Random(20261208)
        seen = set()
        for index in range(6000):
            entry = {"ordinance": rng.choice(ORDINANCES)}
            version = {
                "rawText": " ".join(rng.choice(TEXTS) for _ in range(rng.choice((1, 1, 2)))),
                "status": rng.choice(("verified", "calculated", "other")),
                "description": rng.choice(("Old name", "Other")),
            }
            if rng.random() < 0.2:
                version["stale"] = True
            before = outcome(NAMESPACE["interpret"], entry, version)
            after = outcome(current.interpret, entry, version)
            self.assertEqual(after, before, (index, entry, version))
            if before[0] == "result":
                seen.add((before[1]["rule"]["kind"], before[1]["classification"], bool(before[1].get("notice"))))
            else:
                seen.add(("error", before[2][:30]))
        kinds = {item[0] for item in seen}
        for kind in ("mandatory", "tree-alternative", "tree-increment", "per-inch", "building-duration", "bands", "tiers", "not-determined", "error"):
            self.assertIn(kind, kinds)
        self.assertTrue(any(item[2] for item in seen if item[0] != "error"), "stale notices are reached")
        self.assertTrue(any(item[1] == "measured" for item in seen if item[0] != "error"))


if __name__ == "__main__":
    unittest.main()
