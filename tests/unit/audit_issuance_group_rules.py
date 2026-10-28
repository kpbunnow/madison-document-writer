"""Atomic initial issuance keeps two-pass notice-before-citation refusal precedence."""

import copy
from pathlib import Path
import random
import unittest

import case_store
from audit_r28_helper import pair

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = case_store.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/issuance_groups_reference.txt").read_text(encoding="utf-8"), "issuance_groups_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["validate_issuance_groups"]


def outcome(check, record):
    try:
        return ("result", check(record))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class IssuanceGroupRules(unittest.TestCase):
    def test_generated_group_and_pair_identity(self):
        rng = random.Random(20261028)
        template = pair()
        fields = ("id", "type", "fromDocId", "fromReinspId", "authoringVersion", "mailed", "issuanceGroup")
        values = (
            None,
            "",
            False,
            True,
            "missing",
            "notice",
            "citation",
            4,
            5,
            {},
            {"id": "missing"},
            {"noticeId": "notice_1", "citationId": "initial_citation"},
        )
        outcomes = set()
        for index in range(3000):
            record = copy.deepcopy(template)
            if index % 3:
                for _ in range(rng.randrange(1, 4)):
                    snap = rng.choice(record["events"])["payload"]["snapshot"]
                    snap[rng.choice(fields)] = copy.deepcopy(rng.choice(values))
            if index % 5 == 0:
                rng.choice(record["events"])["by"] = "different signer"
            if index % 7 == 0:
                record["events"].reverse()
            if index % 11 == 0:
                record["events"].pop()
            if index % 13 == 0:
                snap = rng.choice(record["events"])["payload"]["snapshot"]
                snap["items"][0][rng.choice(("cite", "withdrawn", "done"))] = True
            if index % 17 == 0:
                event = rng.choice(record["events"])
                event["payload"]["lifecycle"] = False
            before, after = copy.deepcopy(record), copy.deepcopy(record)
            expected = outcome(LEGACY, before)
            with self.subTest(index=index):
                self.assertEqual(outcome(case_store.validate_issuance_groups, after), expected)
                self.assertEqual(after, before)
            outcomes.add(expected)
        self.assertIn(("result", None), outcomes)
        self.assertGreaterEqual(len(outcomes), 7, "corpus must exercise distinct malformed and incomplete group paths")

    def test_notice_pass_precedes_orphan_citation_pass(self):
        record = pair()
        record["events"].reverse()
        for event in record["events"]:
            event["payload"]["snapshot"]["issuanceGroup"] = "malformed"
        expected = ("error", "ValueError", "The initial notice is missing a valid issuance group")
        self.assertEqual(outcome(LEGACY, record), expected)
        self.assertEqual(outcome(case_store.validate_issuance_groups, record), expected)


if __name__ == "__main__":
    unittest.main()
