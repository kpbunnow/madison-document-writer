"""History replay extraction preserves ordered refusals, delegate calls and partial mutations."""

import copy
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import case_store
import audit_workflow as workflow
import audit_helper as helper_fixtures
import audit_r26_helper as scoped
import audit_r28_helper as initial_citations

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = case_store.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/history_reference.txt").read_text(encoding="utf-8"), "history_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["validate_history"]


def outcome(check, record, historical):
    try:
        return ("result", check(record, historical))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class HistoryRules(unittest.TestCase):
    def test_fixtures_and_generated_replay(self):
        samples = [workflow.initial(), initial_citations.pair(), *helper_fixtures.StoreTests().correction_fixture()]
        samples.extend(
            workflow.followup(workflow.initial(), kind, kind) for kind in ("extension", "citation", "referral", "referralUpdate", "compliance")
        )
        samples.extend(scoped.special(kind) for kind in ("summaryAbatement", "nonSummaryAbatement"))
        rng = random.Random(20261027)
        calls = []
        originals = {
            name: getattr(case_store, name)
            for name in ("validate_authoring", "validate_publication", "validate_special_fields", "validate_document_import", "validate_visit")
        }

        def wrapper(name):
            def call(*args, **kwargs):
                calls.append((name, copy.deepcopy(args), copy.deepcopy(kwargs)))
                return originals[name](*args, **kwargs)

            return call

        delegates = {name: wrapper(name) for name in originals}
        LEGACY.__globals__.update(delegates)
        with patch.multiple(case_store, **delegates):
            for index in range(3000):
                record = copy.deepcopy(rng.choice(samples))
                event = rng.choice(record["events"])
                if index % 3:
                    field = rng.choice(("at", "by", "type", "id"))
                    event[field] = rng.choice(("", "missing", "2026-10-27T12:00:00Z", "document.voided", "document.annotated", "document.served"))
                if index % 5 == 0:
                    event["payload"]["expectedHead"] = []
                    event["payload"]["lifecycle"] = 1
                snap = event["payload"].get("snapshot")
                if snap and index % 7 == 0:
                    snap["id"] = "missing"
                if snap and index % 11 == 0:
                    snap.setdefault("revision", {})["number"] = 99
                historical = {e["id"] for e in record["events"]} if index % 2 else set()
                before, after = copy.deepcopy(record), copy.deepcopy(record)
                calls.clear()
                expected = outcome(LEGACY, before, historical)
                trace = copy.deepcopy(calls)
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(case_store.validate_history, after, historical), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)


if __name__ == "__main__":
    unittest.main()
