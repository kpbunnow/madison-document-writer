"""Rule ownership references are live; behavioral parity remains exercised by the named full-gate suites."""

import ast
import copy
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


def validate(inventory):
    assert inventory["version"] == 1
    assert inventory["identity"] == json.loads((ROOT / "version.json").read_text(encoding="utf-8")), (
        "Review compatibility when any independent identity changes"
    )
    ids = [r["id"] for r in inventory["rules"]]
    assert len(ids) == len(set(ids))
    assert set(ids) == {"parcel", "mailing", "calendar", "deadlines", "pricing", "projection", "recovery"}
    for rule in inventory["rules"]:
        assert rule["authority"] and rule["historicalVariants"] and rule["consumers"] and rule["owners"] and rule["suites"]
        for owner in rule["owners"]:
            source = (ROOT / owner["file"]).read_text(encoding="utf-8")
            names = (
                {n.name for n in ast.walk(ast.parse(source)) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
                if owner["file"].endswith(".py")
                else set(re.findall(r"\b(?:function|const)\s+(\w+)", source))
            )
            assert owner["symbols"] and set(owner["symbols"]) <= names, owner
        for file in rule["consumers"]:
            assert (ROOT / file).is_file(), file
        for suite in rule["suites"]:
            # run_tests.py discovers every audit_*.js / audit_*.py; no bespoke optional invocation.
            assert re.fullmatch(r"audit_[a-z0-9_]+\.(?:js|py)", suite), suite
            assert (ROOT / "tests/unit" / suite).is_file(), suite
    for row in inventory["clones"]:
        assert re.fullmatch(r"[0-9a-f]{64}", row["id"]) and row["reason"]
        assert row["disposition"] in {"consolidated", "intentional", "deferred"}


class PolicyInventory(unittest.TestCase):
    def setUp(self):
        self.inventory = json.loads((ROOT / "tools/policy-compatibility.json").read_text(encoding="utf-8"))

    def test_current_inventory(self):
        validate(self.inventory)

    def test_missing_owner_suite_identity_and_duplicate_rule_fail(self):
        for change in ["owner", "suite", "identity", "duplicate"]:
            bad = copy.deepcopy(self.inventory)
            if change == "owner":
                bad["rules"][0]["owners"][0]["symbols"] = ["removedPolicyOwner"]
            elif change == "suite":
                bad["rules"][0]["suites"] = ["audit_removed_policy.py"]
            elif change == "identity":
                bad["identity"]["authoringVersion"] += 1
            else:
                bad["rules"].append(copy.deepcopy(bad["rules"][0]))
            with self.assertRaises(AssertionError, msg=change):
                validate(bad)


if __name__ == "__main__":
    unittest.main()
