"""R32 directed schedule compilation, measurements and default-zero rule."""

import unittest
import citation_pricing as p


class R32Pricing(unittest.TestCase):
    def test_golden_fixed_and_measured(self):
        for charge, tier, total in [
            ("27.04(2)(h)", 1, 19700),
            ("27.04(2)(h)", 2, 32300),
            ("27.04(2)(k)", 1, 70100),
            ("27.05(2)(b)", 1, 19700),
            ("24.04", 1, 19700),
            ("30.01(6)(b)", 3, 133100),
            ("41.14", 1, 38600),
            ("31.045(3)(c)", 3, 70100),
            ("10.185(6)(c)", 1, 38600),
            ("27.05(3)(a)", 2, 32300),
        ]:
            e = p.resolve(charge, at="2026-10-11")
            self.assertTrue(p.ready(e), charge)
            self.assertEqual(p.assessment_cents(p.base_cents(e, tier), 4800)["total"], total, charge)
        for charge, measurements, base, total in [
            ("10.101(7)(b)", {"diameter": 12}, 180000, 234700),
            ("23.24(3)", {"diameter": 5}, 64000, 87740),
            ("29.40(4)(b)", {"area": 200000, "days": 400}, 1000000, 1276100),
        ]:
            e = p.resolve(charge, at="2026-10-11")
            self.assertEqual(p.base_cents(e, 2, measurements), base)
            self.assertEqual(p.assessment_cents(base, 4800)["total"], total)

    def test_known_charge_cannot_use_manual_bypass(self):
        from audit_r28_helper import pair

        snap = pair()["events"][-1]["payload"]["snapshot"]
        snap["authoringVersion"] = 8
        c = snap["cits"]["charged_item"]
        c.update(depositMode="base", base="1500", amount="1966.00", depositSource="Synthetic manual override attempts to bypass schedule.")
        with self.assertRaisesRegex(ValueError, "calculated deposit"):
            p.validate_pricing(snap, [])

    def test_section_prefix(self):
        self.assertEqual(p.canonical_ordinance("Section 27.05(2)(c)"), "27.05(2)(c)")

    def test_all_classified(self):
        for e in p.policy_at("2026-10-11")["entries"]:
            self.assertIn(e.get("classification"), ["calculated", "verified", "stale", "measured", "mandatory appearance", "not-determined"], e["id"])
            self.assertTrue(e.get("rule") or e.get("reason"), e["id"])


if __name__ == "__main__":
    unittest.main()
