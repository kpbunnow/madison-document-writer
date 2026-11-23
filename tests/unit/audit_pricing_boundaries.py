"""Exact schedule and repeat-offense boundaries in the helper's pricing (synthetic).

Generated mutation testing (2026-11-23) changed single comparisons in citation_pricing.py; these were the changes no
suite noticed. Each expectation follows the schedule row's own text or the window's stated rule, not the current code.
"""

import unittest

import citation_pricing as P

AT = "2026-11-14"


def entry(ordinance, entry_id=None):
    rows = [e for e in P.policy_at(AT)["entries"] if e["ordinance"] == ordinance and (entry_id is None or e["id"] == entry_id)]
    assert len(rows) == 1, (ordinance, entry_id, len(rows))
    return rows[0]


class PricingBoundaries(unittest.TestCase):
    def test_building_tune_up_rows_and_365_days(self):
        large, small = entry("29.40(4)(b)", "mgo-row-497-29.40(4)(b)"), entry("29.40(4)(b)", "mgo-row-498-29.40(4)(b)")
        # "$3,000, 1st 180 days / $10,000, 365 days" (100,000 sq ft or more); "$2,000 … / $8,000, 365 days" (less).
        self.assertEqual(P.base_cents(large, 1, {"area": 100000, "days": 364}), 300000)
        self.assertEqual(P.base_cents(large, 1, {"area": 100000, "days": 365}), 1000000)
        self.assertEqual(P.base_cents(small, 1, {"area": 99999.99, "days": 364}), 200000)
        self.assertEqual(P.base_cents(small, 1, {"area": 99999.99, "days": 365}), 800000)
        self.assertEqual(P.base_cents(small, 1, {"area": 100000, "days": 1}), 300000, "the measured area chooses the large amount")
        self.assertIsNone(P.base_cents(large, 1, {"area": 100000, "days": 364.5}), "days are whole")

    def test_band_edges(self):
        percent, tons, fee = entry("10.185(6)(a)2."), entry("10.185(6)(b)"), entry("8.14(2)(c)2.")
        cases = [
            (percent, "percent", [(0.99, None), (1, 25000), (10, 25000), (10.01, 50000), (20, 50000), (20.01, 100000), (100, 100000)]),
            (tons, "tons", [(0, 25000), (0.99, 25000), (1, 50000), (2, 50000), (2.01, 100000)]),
            (fee, "fee", [(0, 2500), (20, 2500), (20.03, None), (20.05, 5500), (50, 5500), (50.05, 10500), (500, 10500)]),
        ]
        for row, field, values in cases:
            for value, cents in values:
                with self.subTest(field=field, value=value):
                    self.assertEqual(P.base_cents(row, 1, {field: value}), cents)

    def test_tree_rows(self):
        alternative, per_inch, increment = entry("10.05(11)(d)1."), entry("10.101(7)(b)"), entry("23.24(3)")
        # "$500/offense, or $150/inch for tree removals": the diameter matters only for a removal.
        self.assertEqual(P.base_cents(alternative, 1, {"removed": False}), 50000)
        self.assertEqual(P.base_cents(alternative, 1, {"removed": False, "diameter": 0}), 50000)
        self.assertEqual(P.base_cents(alternative, 1, {"removed": True, "diameter": 10}), 150000)
        self.assertIsNone(P.base_cents(alternative, 1, {"removed": True}))
        self.assertIsNone(P.base_cents(alternative, 1, {"removed": True, "diameter": 10.5}), "whole inches")
        self.assertIsNone(P.base_cents(per_inch, 1, {"diameter": 10.5}), "whole inches")
        self.assertIsNone(P.base_cents(per_inch, 1, {"diameter": 0}))
        # "$250 + $30/inch, 0>3 diameter inches; $150 per diameter inch over 3 inches"
        self.assertEqual(P.base_cents(increment, 1, {"diameter": 3}), 25000 + 3 * 3000)
        self.assertEqual(P.base_cents(increment, 1, {"diameter": 4}), 25000 + 3 * 3000 + 15000)

    def test_repeat_offense_window_edges(self):
        season = {"kind": "site-season", "startMonthDay": "07-01"}
        for prior, violation, counted in [
            ("2026-07-01", "2026-07-01", True),
            ("2026-06-30", "2026-07-01", False),
            ("2025-07-01", "2026-06-30", True),
            ("2025-06-30", "2026-06-30", False),
        ]:
            with self.subTest(window="season", prior=prior, violation=violation):
                self.assertIs(P.within_window(prior, violation, season), counted)
        for prior, violation, window, counted in [
            ("2025-03-31", "2026-03-31", {"months": 12}, True),
            ("2025-03-30", "2026-03-31", {"months": 12}, False),
            ("2023-02-28", "2024-02-29", {"years": 1}, True),
            ("2023-02-27", "2024-02-29", {"years": 1}, False),
            ("2025-02-28", "2026-08-31", {"months": 18}, True),
            ("2025-02-27", "2026-08-31", {"months": 18}, False),
            ("2021-11-30", "2026-11-30", {"years": 5}, True),
            ("2026-12-01", "2026-11-30", {"years": 5}, False),
        ]:
            with self.subTest(prior=prior, violation=violation, window=window):
                self.assertIs(P.within_window(prior, violation, window), counted)

    def test_tier_override_source_needs_ten_characters(self):
        cit = {"tier": "1st", "tierOverride": "3"}
        self.assertEqual(P._scheduled_pricing_tier(cit={**cit, "tierOverrideSource": "0123456789"}, counted=[]), 3)
        with self.assertRaises(ValueError):
            P._scheduled_pricing_tier(cit={**cit, "tierOverrideSource": "012345678"}, counted=[])
        self.assertEqual(P._scheduled_pricing_tier(cit={"tier": "2nd"}, counted=[{}]), 2)

    def test_rows_without_a_rule_need_a_verified_current_amount(self):
        tiers = [{"ordinal": 1, "amountCents": 5000}]
        self.assertTrue(P.ready({"status": "verified", "tiers": tiers}))
        for row in [
            {"status": "verified", "stale": True, "tiers": tiers},
            {"status": "verified", "tiers": []},
            {"status": "proposed", "tiers": tiers},
            {"status": "verified", "tiers": tiers, "rule": {"kind": "not-determined"}, "stale": True},
            None,
        ]:
            with self.subTest(row=row):
                self.assertFalse(P.ready(row))
        self.assertTrue(P.ready({"status": "proposed", "tiers": [], "rule": {"kind": "tiers", "amountsCents": [5000]}}))

    def test_money_limit(self):
        self.assertEqual(P.cents("90071992547409.91"), 9007199254740991)
        self.assertIsNone(P.cents("90071992547409.92"))

    def test_same_site_without_parcels(self):
        same = [({"address": "100 Test Street, Madison"}, {"address": "100 TEST ST"}), ({"address": "ONE MAIN"}, {"address": " one main "})]
        different = [
            ({"address": "100 TEST ST"}, {"address": "102 TEST ST"}),
            ({"address": ""}, {"address": ""}),
            ({"address": "100 TEST ST"}, {"address": "ONE MAIN"}),
            ({"parcel": "070900000001", "address": "100 TEST ST"}, {"parcel": "070900000002", "address": "100 TEST ST"}),
        ]
        for a, b in same:
            with self.subTest(a=a, b=b):
                self.assertTrue(P.same_site(a, b))
        for a, b in different:
            with self.subTest(a=a, b=b):
                self.assertFalse(P.same_site(a, b))
        self.assertTrue(P.same_site({"parcel": "070900000001", "address": "1 A ST"}, {"parcel": "070900000001", "address": "2 B ST"}))
        # A parcel on only one side is not a parcel comparison: the addresses decide.
        self.assertTrue(P.same_site({"parcel": "070900000001", "address": "100 TEST ST"}, {"address": "100 Test Street"}))
        self.assertFalse(P.same_site({"parcel": "070900000001", "address": "100 TEST ST"}, {"address": "102 TEST ST"}))

    def test_respondent_key(self):
        lines = ["100 Test Street", "MADISON WI 53703"]
        derived = P.respondent_key({"ownerAddr": lines})
        self.assertTrue(derived.endswith("|53703") and derived.startswith("100 TEST"), derived)
        parsed = {"accepted": True, "acceptedLines": lines, "ownerKey": "STANDARDIZED|53703"}
        self.assertEqual(P.respondent_key({"ownerAddr": lines, "ownerAddressParsed": parsed}), "STANDARDIZED|53703")
        self.assertEqual(P.respondent_key({"ownerAddr": ["1 A ST", *lines[1:]], "ownerAddressParsed": parsed}), "1 A ST|53703")
        self.assertEqual(P.respondent_key({"ownerAddr": ["MADISON WI 53703"]}), "")
        self.assertEqual(P.respondent_key({"ownerAddr": ["100 TEST ST", "MADISON WI"]}), "")


if __name__ == "__main__":
    unittest.main()
