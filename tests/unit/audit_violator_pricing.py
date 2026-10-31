"""Violator contact: the helper prices repeat offenses against the Violator's address (mirrors citation_policy.js)."""

import json
from pathlib import Path
import unittest

import citation_pricing as pricing

FIXTURE = json.loads((Path(__file__).resolve().parents[2] / "tests/fixtures/violator_cases.json").read_text())
OWNER = ["100 TEST ST", "MADISON WI 53703"]
VIOLATOR = {"kind": "Violator", "name": "THE VIOLATOR", "addr": "55 SECOND ST", "city": "MADISON WI 53704"}


def case(number, **extra):
    return {"number": number, "owner": "SYNTHETIC OWNER", "ownerAddr": list(OWNER), **extra}


def history(prior):
    snap = {"inspDate": "2025-08-24", "items": [{"id": "prior", "cite": True}], "cits": {"prior": {"ord": "10.05(15)", "num": "OLD"}}}
    return [{"case": prior, "document": snap}]


class ViolatorPricingTests(unittest.TestCase):
    def test_shared_cases_give_the_same_key_as_the_writer(self):
        for row in FIXTURE["cases"]:
            with self.subTest(case=row["name"]):
                self.assertEqual(pricing.defendant_key(row["case"]), row["key"])

    def test_prior_offense_follows_the_violator_not_the_owner(self):
        entry = pricing.resolve("10.05(15)")
        when = "2026-09-24"
        current = case("NOW", ccList=[VIOLATOR])
        same_violator = case("A", ccList=[dict(VIOLATOR, name="OTHER SPELLING")])
        owner_only = case("B")
        different_violator = case("C", ccList=[dict(VIOLATOR, addr="7 THIRD ST")])
        self.assertEqual(len(pricing.prior_offenses(entry, current, when, history(same_violator))), 1)
        self.assertEqual(pricing.prior_offenses(entry, current, when, history(owner_only)), [], "the owner alone no longer matches")
        self.assertEqual(pricing.prior_offenses(entry, current, when, history(different_violator)), [])
        # Without a Violator the owner is still the respondent.
        self.assertEqual(len(pricing.prior_offenses(entry, case("NOW"), when, history(owner_only))), 1)
        self.assertEqual(pricing.prior_offenses(entry, case("NOW"), when, history(same_violator)), [])

    def test_snow_cases_ignore_the_violator(self):
        snow = case("S", caseType="snow-10.28", ccList=[VIOLATOR])
        self.assertEqual(pricing.defendant_key(snow), pricing.respondent_key(snow))


if __name__ == "__main__":
    unittest.main()
