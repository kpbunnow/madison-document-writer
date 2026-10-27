"""Differential publication identity/source/visit rules preserve historical refusal precedence."""

import copy
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import case_store
import audit_workflow as fixtures

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = case_store.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/publication_reference.txt").read_text(encoding="utf-8"), "publication_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["validate_publication"]


def outcome(check, args, window):
    try:
        return ("result", check(*args, check_date_window=window))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


def contexts(record):
    documents, visits = {}, []
    for event in record["events"]:
        payload = event["payload"]
        if event["type"] == "reinspection.recorded":
            visits.append(dict(payload["reinspection"], _eventId=event["id"]))
        if payload.get("snapshot"):
            yield copy.deepcopy((record, event, documents, set(), set(), visits))
            documents[payload["snapshot"]["id"]] = (payload["snapshot"], event["id"])


class PublicationRules(unittest.TestCase):
    def test_fixture_and_generated_refusals(self):
        samples = list(contexts(fixtures.initial()))
        for kind in ("extension", "citation", "referral", "referralUpdate", "compliance"):
            samples.extend(contexts(fixtures.followup(fixtures.initial(), "generated-" + kind, kind)))
        rng = random.Random(20261027)
        fields = ("type", "caseId", "fromDocId", "fromReinspId", "mailed", "inspDate", "inspTime", "id")
        values = (None, "", "bad", "2026-09-01", "2027-01-01", "notice", "citation", "compliance", "missing")
        calls = []
        original_calendar = case_store.calendar_date

        def calendar(value):
            calls.append(value)
            return original_calendar(value)

        LEGACY.__globals__["calendar_date"] = calendar
        with patch.object(case_store, "calendar_date", calendar):
            for index in range(3000):
                args = copy.deepcopy(rng.choice(samples))
                snap = args[1]["payload"]["snapshot"]
                if index % 3:
                    for _ in range(rng.randrange(1, 4)):
                        snap[rng.choice(fields)] = rng.choice(values)
                if index % 5 == 0 and snap["items"]:
                    snap["items"][0]["done"] = True
                if index % 7 == 0:
                    args[1]["by"] = "missing"
                before, after = copy.deepcopy(args), copy.deepcopy(args)
                window = bool(index % 2)
                calls.clear()
                expected = outcome(LEGACY, before, window)
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(case_store.validate_publication, after, window), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)


if __name__ == "__main__":
    unittest.main()
