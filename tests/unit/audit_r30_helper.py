"""Independent shared R30 golden values and actual helper tamper checks."""

import json
import copy
from pathlib import Path
import tempfile
import unittest
import case_store
from test_support import scheduled_citation_base
import citation_pricing as pricing
from audit_r28_helper import pair

GOLDEN = json.loads((Path(__file__).resolve().parents[2] / "tests/fixtures/deposit_golden.json").read_text())


class DepositTests(unittest.TestCase):
    def test_golden_bases(self):
        for g in GOLDEN["rows"]:
            with self.subTest(charge=g["ordinance"], tier=g["tier"]):
                label = str(g["tier"]) + ("st" if g["tier"] == 1 else "nd" if g["tier"] == 2 else "rd" if g["tier"] == 3 else "th")
                value = scheduled_citation_base(g["ordinance"], label, entry_id=g.get("entryId", ""))
                if g["ordinance"]:
                    self.assertEqual(None if value is None else int(value * 100), g["base"])
                self.assertEqual(
                    pricing.assessment_cents(g["base"], g["court"]), {k: g[k] for k in ("base", "penalty", "jail", "crimeLab", "court", "total")}
                )

    def test_stale_and_phantom(self):
        for o in GOLDEN["blocked"]:
            with self.subTest(charge=o):
                if o in ("27.05(2)(s)", "29.21", "30.01(5)"):
                    self.assertTrue(pricing.ready(pricing.resolve(o, at="2026-10-10")))
                else:
                    self.assertIsNone(pricing.base_cents(pricing.resolve(o, at="2026-10-10"), "1st"))

    def test_shared_grammar_and_effective_costs(self):
        for value in GOLDEN["valid"]:
            self.assertTrue(pricing.canonical_ordinance(value), value)
        for value in GOLDEN["invalid"]:
            self.assertFalse(pricing.canonical_ordinance(value), value)
        self.assertEqual(pricing.court_cents("2026-07-29"), 3800)
        self.assertEqual(pricing.court_cents("2026-07-30"), 4800)

    def value(self, ordinance="27.05(2)(c)", tier=1, number="QA-R30-1"):
        value = pair()
        value["case"].update(number=number, owner="SYNTHETIC R30 OWNER", ownerAddr=["101 TEST STREET", "MADISON WI 53703"])
        for event in value["events"]:
            snap = event["payload"]["snapshot"]
            snap.update(authoringVersion=6)
            snap["frozen"]["case"] = copy.deepcopy(value["case"])
            snap["items"][0]["sections"] = [ordinance]
        snap = value["events"][-1]["payload"]["snapshot"]
        cit = snap["cits"]["charged_item"]
        cit.update(ord=ordinance, tier=pricing.tier_label(tier), num="CIT-" + number, preparedSections=[ordinance])
        b = pricing.base_cents(pricing.resolve(ordinance), tier)
        if b is not None:
            lines = pricing.assessment_cents(b, 4800)
            cit.update(base=f"{b / 100:.2f}", amount=f"{lines['total'] / 100:.2f}", assessments=lines)
        return value

    def save(self, root, value):
        return case_store.save_case(root, "101 TEST LANE - " + value["case"]["number"] + ".json", value)

    def test_manual_base_assessments_are_saved(self):
        with tempfile.TemporaryDirectory() as folder:
            value = self.value()
            cit = value["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]
            cit.update(
                depositMode="base",
                base="1500",
                cc="48",
                amount="1966.00",
                depositSource="Synthetic approved manual base instruction.",
                assessments=pricing.assessment_cents(150000, 4800),
            )
            saved = self.save(Path(folder), value)
            self.assertEqual(saved["file"]["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]["assessments"]["jail"], 1500)

    def test_cross_case_history_tier_rejection_and_atomic_retry(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            first = self.value()
            self.save(root, first)
            next_case = self.value(tier=1, number="QA-R30-2")
            with self.assertRaisesRegex(ValueError, "expected tier 2nd"):
                self.save(root, next_case)
            self.assertFalse((root / "101 TEST LANE - QA-R30-2.json").exists())
            next_case = self.value(tier=2, number="QA-R30-2")
            saved = self.save(root, next_case)
            history = case_store.citation_history(root)["history"]
            self.assertEqual(len(history), 2)
            retry = case_store.save_case(root, saved["name"], next_case, idempotency_event="initial_citation_event")
            self.assertTrue(retry["alreadyCommitted"])

    def test_wrong_base_jail_tier_costs_grammar_and_stale_refused(self):
        for mutation in ("base", "jail", "tier", "cost", "grammar", "stale", "total-breakdown"):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as folder:
                value = self.value("9.25(4)", 3)
                cit = value["events"][-1]["payload"]["snapshot"]["cits"]["charged_item"]
                cit.update(tierOverride=3, tierOverrideSource="Synthetic court-approved tier for this charge.")
                if mutation == "base":
                    cit["base"] = "2400.00"
                    cit["assessments"] = pricing.assessment_cents(240000, 4800)
                    cit["amount"] = str(cit["assessments"]["total"] / 100)
                elif mutation == "jail":
                    cit["assessments"]["jail"] = 1000
                elif mutation == "tier":
                    cit["tier"] = "1st"
                elif mutation == "cost":
                    cit["cc"] = "38.00"
                    cit["assessments"] = pricing.assessment_cents(250000, 3800)
                    cit["amount"] = str(cit["assessments"]["total"] / 100)
                elif mutation == "grammar":
                    cit["ord"] = "27.05(2)(c), 27.05(2)(d)"
                elif mutation == "stale":
                    cit["ord"] = "27.05(2)(s)"
                elif mutation == "total-breakdown":
                    cit.update(depositMode="total", depositSource="Synthetic approved total instruction.")
                with self.assertRaises(ValueError):
                    self.save(Path(folder), value)
                self.assertFalse(list(Path(folder).glob("*.json")))

    def test_windows_sequence_void_and_missing_history(self):
        case = {"number": "QA-HISTORY", "owner": "SYNTHETIC R30 OWNER", "ownerAddr": ["101 TEST ST", "MADISON WI 53703"]}
        self.assertEqual(pricing.respondent_key(case), pricing.respondent_key(dict(case, ownerAddr=["101 TEST STREET", "MADISON WI 53703-1234"])))
        for charge, expected in [("10.18(7)", 0), ("10.05(15)", 1)]:
            entry = pricing.resolve(charge)
            snap = {"inspDate": "2025-08-24", "items": [{"id": "prior", "cite": True}], "cits": {"prior": {"ord": charge, "num": "OLD"}}}
            self.assertEqual(len(pricing.prior_offenses(entry, case, "2026-09-24", [{"case": case, "document": snap}])), expected)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            value = self.value()
            self.save(root, value)
            (root / "broken - QA-BROKEN.json").write_text("{")
            with self.assertRaises(ValueError):
                self.save(root, self.value(tier=2, number="QA-R30-2"))

    def test_same_issuance_sequence(self):
        value = self.value()
        notice, citation = [e["payload"]["snapshot"] for e in value["events"]]
        notice["items"].append(dict(notice["items"][0], id="item_2", no="2"))
        citation["items"].append(dict(citation["items"][0], id="charged_2", srcItemId="item_2", no="2"))
        lines = pricing.assessment_cents(20000, 4800)
        citation["cits"]["charged_2"] = dict(
            citation["cits"]["charged_item"], num="CIT-R30-SECOND", tier="2nd", base="200.00", amount="323.00", assessments=lines
        )
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(len(self.save(Path(folder), value)["file"]["events"]), 2)
        citation["cits"]["charged_2"].update(tier="1st", base="100.00", amount="197.00", assessments=pricing.assessment_cents(10000, 4800))
        with tempfile.TemporaryDirectory() as folder, self.assertRaisesRegex(ValueError, "expected tier 2nd"):
            self.save(Path(folder), value)

    def test_retained_correction_amount_and_old_court_rate(self):
        value = self.value("9.25(4)", 3)
        snap = value["events"][-1]["payload"]["snapshot"]
        old = copy.deepcopy(snap)
        cit = snap["cits"]["charged_item"]
        old["cits"]["charged_item"].update(cc="38.00", amount="3211.00", assessments=None)
        snap["cits"]["charged_item"] = copy.deepcopy(old["cits"]["charged_item"])
        # Independent pricing gate retains an old exact basis; a changed charge
        # must resolve under current rules. No historical snapshot is rewritten.
        pricing.validate_pricing(snap, [], old)
        snap["cits"]["charged_item"]["amount"] = "3236.00"
        with self.assertRaisesRegex(ValueError, "retains the original"):
            pricing.validate_pricing(snap, [], old)


if __name__ == "__main__":
    unittest.main()
