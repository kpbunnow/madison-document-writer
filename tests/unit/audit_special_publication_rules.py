"""Preserve scoped-action refusals, query order and partial effects across phase extraction."""

import copy
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import case_store
from audit_publication_rules import contexts
from audit_r26_helper import special

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = case_store.__dict__.copy()
exec(
    compile((ROOT / "tests/fixtures/special_publication_reference.txt").read_text(encoding="utf-8"), "special_publication_reference", "exec"),
    NAMESPACE,
)
LEGACY = NAMESPACE["validate_special_publication"]


def outcome(check, args, correction, new_action):
    try:
        return ("result", check(*args, correction=correction, new_action=new_action))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


def samples():
    result = []
    for kind in sorted(case_store.SPECIAL_TYPES):
        for record, event, documents, superseded, voided, visits in contexts(special(kind)):
            snap = event["payload"]["snapshot"]
            if snap["type"] == kind:
                result.append((record, snap, documents, superseded, voided, visits))
    # Explicit initial/referral and internal/external release branches complement the historical fixtures.
    base = copy.deepcopy(result[0])
    for kind in ("noOccupancy", "summaryAbatement"):
        value = copy.deepcopy(base)
        value[1].update(type=kind, initialAction=True)
        value[2].clear()
        result.append(value)
    for external in (False, True):
        value = copy.deepcopy(base)
        record, snap, documents, _, _, visits = value
        restriction = copy.deepcopy(snap)
        restriction.update(id="restriction", type="noOccupancy", special={"scope": "unit", "unit": "1", "effective": "2026-08-01"})
        documents[restriction["id"]] = (restriction, "restriction-event")
        release = dict(
            id="release-visit",
            caseId=record["case"]["id"],
            date="2026-10-20",
            purpose="occupancyRelease",
            sourceDocId="restriction",
            inspectionReference="QA",
            inspectorId="i1",
            time="09:00",
        )
        visits.append(release)
        snap.update(type="noOccupancy", initialAction=True)
        documents = {"restriction": documents["restriction"]}
        snap["special"] = dict(
            mode="release",
            scope="unit",
            unit="1",
            releases="restriction",
            releaseInspection=release["date"],
            releaseVisitId="external" if external else release["id"],
            verifiedReleaseVisitId=release["id"],
            releaseInspectionRef="QA",
            releaseInspectorId="i1",
            releaseInspectionTime="09:00",
        )
        result.append((record, snap, documents, set(), set(), visits))
    return result


class SpecialPublicationRules(unittest.TestCase):
    def test_historical_and_generated_refusal_precedence(self):
        rng = random.Random(20261028)
        corpus = samples()
        calls, outcomes = [], set()
        fields = (
            "type",
            "fromDocId",
            "fromReinspId",
            "initialAction",
            "administrativeAction",
            "factualVisitId",
            "inspDate",
            "inspTime",
            "inspectorId",
        )
        values = (None, "", False, True, "missing", "noOccupancy", "vacancyExtension", "2026-10-20")

        def traced(name, original):
            def query(*args, **kwargs):
                calls.append((name, copy.deepcopy((args, kwargs))))
                return original(*args, **kwargs)

            return query

        with patch.multiple(
            case_store, **{name: traced(name, getattr(case_store, name)) for name in ("current_document", "continuing_items", "active_restrictions")}
        ):
            for name in ("current_document", "continuing_items", "active_restrictions"):
                NAMESPACE[name] = getattr(case_store, name)
            for index in range(3000):
                args = copy.deepcopy(corpus[index % len(corpus)])
                record, snap, documents, superseded, voided, visits = args
                if index % 3:
                    for _ in range(rng.randrange(1, 4)):
                        snap[rng.choice(fields)] = rng.choice(values)
                if index % 5 == 0:
                    record["schema"] = rng.choice((3, 4, 5, None))
                if index % 7 == 0 and snap["items"]:
                    snap["items"][0].update(
                        done=rng.choice((False, True)), withdrawn=rng.choice((False, True)), due="2027-01-01", doneOn="2026-10-20"
                    )
                if index % 11 == 0:
                    documents["referral"] = ({"id": "referral", "type": "referral"}, "referral-event")
                if index % 13 == 0:
                    superseded.update(documents)
                if index % 17 == 0:
                    voided.update(documents)
                if index % 19 == 0:
                    visits.clear()
                if index % 23 == 0:
                    snap["special"].update(emergencyApproved=True, referralCoordination="QA", scope="unit", mode="release", releaseVisitId="missing")
                before, after = copy.deepcopy(args), copy.deepcopy(args)
                correction, new_action = bool(index % 2), bool(index % 4)
                calls.clear()
                expected = outcome(LEGACY, before, correction, new_action)
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(case_store.validate_special_publication, after, correction, new_action), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)
                outcomes.add(expected)
        self.assertIn(("result", None), outcomes)
        self.assertGreaterEqual(len(outcomes), 8, "corpus must exercise distinct refusal paths")


if __name__ == "__main__":
    unittest.main()
