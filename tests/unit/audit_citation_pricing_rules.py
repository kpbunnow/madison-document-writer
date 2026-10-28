"""Pricing phases retain schedule/override/refusal and staged-history semantics."""

import copy
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import citation_pricing
from audit_r28_helper import pair

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = citation_pricing.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/citation_pricing_reference.txt").read_text(encoding="utf-8"), "citation_pricing_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["validate_pricing"]


def outcome(check, args):
    try:
        return ("result", check(*args))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


def policy_snapshots():
    template = pair()["events"][-1]["payload"]["snapshot"]
    for entry in citation_pricing.policy_at("2026-10-11")["entries"]:
        snap = copy.deepcopy(template)
        snap.update(authoringVersion=10, inspDate="2026-10-11", inspTime="09:00")
        cit = next(iter(snap["cits"].values()))
        measurements = {field["key"]: False if field.get("boolean") else field.get("min", 0) for field in entry.get("measurements", [])}
        base = citation_pricing.base_cents(entry, "1st", measurements)
        cit.update(
            ord=entry["ordinance"],
            scheduleEntryId=entry["id"],
            pricedOn="2026-10-11",
            issued="2026-10-11",
            tier="1st",
            base=str((base or 0) / 100),
            measurements=measurements,
            siteMatch=citation_pricing.site_basis(snap["frozen"]["case"]),
        )
        if (entry.get("rule") or {}).get("kind") == "mandatory":
            cit.update(mandatoryAppearance=True, amount="")
        yield snap


class CitationPricingRules(unittest.TestCase):
    def test_policy_and_generated_pricing_contexts(self):
        rng = random.Random(20261028)
        corpus = list(policy_snapshots())
        generated = []
        fields = (
            "ord",
            "base",
            "tier",
            "depositMode",
            "scheduleEntryId",
            "differentChargeSource",
            "preparedSections",
            "siteMatch",
            "overrideBasis",
            "tierOverride",
            "tierOverrideSource",
            "mandatoryAppearance",
            "amount",
            "measurements",
        )
        values = (None, "", False, True, "bad", "1st", "2nd", "schedule", "base", "total", "QA approved source", {}, {"approvedTier": 1})
        for index in range(3000):
            snap = copy.deepcopy(corpus[index % len(corpus)])
            if index % 2:
                cit = next(iter(snap["cits"].values()))
                for _ in range(rng.randrange(1, 4)):
                    cit[rng.choice(fields)] = copy.deepcopy(rng.choice(values))
            generated.append(snap)
        calls, outcomes = [], set()

        def traced(name, original):
            def lookup(*args, **kwargs):
                calls.append((name, copy.deepcopy((args, kwargs))))
                return original(*args, **kwargs)

            return lookup

        names = (
            "same_site",
            "canonical_ordinance",
            "shared_validate_basis",
            "resolve",
            "ready",
            "base_cents",
            "prior_offenses",
            "site_basis",
            "respondent_key",
            "ordinal",
            "tier_label",
        )
        with patch.multiple(citation_pricing, **{name: traced(name, getattr(citation_pricing, name)) for name in names}):
            for name in names:
                NAMESPACE[name] = getattr(citation_pricing, name)
            for index, sample in enumerate(corpus + generated):
                snap = copy.deepcopy(sample)
                if index % 5 == 0:
                    snap["authoringVersion"] = rng.choice((5, 6, 8, 9, 10, 16))
                if index % 7 == 0:
                    snap["caseType"] = "snow-10.28"
                if index % 11 == 0:
                    extra = copy.deepcopy(snap["items"][0])
                    extra["id"] = "second-item"
                    snap["items"].append(extra)
                    snap["cits"][extra["id"]] = dict(next(iter(snap["cits"].values())), num="QA-SECOND")
                if index % 13 == 0:
                    snap["items"][0]["withdrawn"] = True
                history = [{"case": copy.deepcopy(sample["frozen"]["case"]), "document": copy.deepcopy(sample)}] if index % 3 == 0 else []
                original = copy.deepcopy(sample) if index % 4 == 0 else None
                before, after = copy.deepcopy((snap, history, original)), copy.deepcopy((snap, history, original))
                calls.clear()
                expected = outcome(LEGACY, before)
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(citation_pricing.validate_pricing, after), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)
                outcomes.add(expected)
        self.assertIn(("result", None), outcomes)
        self.assertGreaterEqual(len(outcomes), 8, "corpus must exercise distinct refusal paths")


if __name__ == "__main__":
    unittest.main()
