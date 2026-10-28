"""Visit phase extraction retains release/import/outcome refusal and lookup order."""

import copy
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import case_store

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = case_store.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/visit_validation_reference.txt").read_text(encoding="utf-8"), "visit_validation_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["validate_visit"]


def outcome(check, args, window):
    try:
        return ("result", check(*args, at="2026-10-27T12:00:00Z", check_date_window=window))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


def samples():
    record = {"case": {"id": "case", "date": "2026-09-01"}}
    source = {"id": "notice", "type": "notice", "items": [{"id": "a", "no": "1"}], "inspDate": "2026-09-01"}
    documents = {"notice": (source, "issued")}
    visit = {"id": "visit", "sourceDocId": "notice", "date": "2026-09-15", "time": "10:00", "results": {"a": {"oc": "none", "on": "2026-09-15"}}}
    result = [(record, visit, documents, set(), set(), [])]
    imported = copy.deepcopy(result[0])
    imported[1]["importInspection"] = {"type": "reinspection", "date": "2026-09-15", "time": "10:00"}
    result.append(imported)
    for withdrawn in (False, True):
        value = copy.deepcopy(result[0])
        value[2]["notice"][0]["items"].append({"id": "b", "no": 2, "done": not withdrawn, "doneOn": "2026-09-02", "withdrawn": withdrawn})
        value[1]["results"]["b"] = {"oc": "withdrawn" if withdrawn else "corrected", "on": "2026-09-02", "carried": True}
        result.append(value)
    restriction = {
        "id": "restriction",
        "type": "noOccupancy",
        "special": {"mode": "restrict", "scope": "unit", "unit": "1", "effective": "2026-09-01"},
    }
    release = dict(
        id="release",
        purpose="occupancyRelease",
        sourceDocId="restriction",
        caseId="case",
        scope="unit",
        unit="1",
        date="2026-09-15",
        inspectorId="i1",
        inspectionReference="QA physical visit reference",
        results={},
    )
    result.append((record, release, {"restriction": (restriction, "issued")}, set(), set(), []))
    return result


class VisitValidationRules(unittest.TestCase):
    def test_generated_visit_and_release_precedence(self):
        rng = random.Random(20261028)
        corpus = samples()
        calls, outcomes = [], set()
        fields = ("purpose", "id", "sourceDocId", "caseId", "scope", "unit", "date", "inspectorId", "inspectionReference", "importInspection")
        values = (None, "", "missing", "occupancyRelease", "2026-01-01", "2027-01-01", {}, {"type": "reinspection", "date": "2026-09-15"})

        def traced(name, original):
            def lookup(*args, **kwargs):
                calls.append((name, copy.deepcopy((args, kwargs))))
                return original(*args, **kwargs)

            return lookup

        names = (
            "active_restrictions",
            "calendar_date",
            "city_day",
            "current_document",
            "visit_import_identity",
            "same_import_identity",
            "continuing_items",
        )
        with patch.multiple(case_store, **{name: traced(name, getattr(case_store, name)) for name in names}):
            for name in names:
                NAMESPACE[name] = getattr(case_store, name)
            for index in range(3000):
                args = copy.deepcopy(corpus[index % len(corpus)])
                record, visit, documents, superseded, voided, visits = args
                if index % 3:
                    for _ in range(rng.randrange(1, 4)):
                        visit[rng.choice(fields)] = copy.deepcopy(rng.choice(values))
                if index % 7 == 0:
                    visits.append(copy.deepcopy(corpus[1][1]))
                if index % 11 == 0:
                    superseded.update(documents)
                if index % 13 == 0:
                    voided.update(documents)
                if index % 17 == 0:
                    visit["results"] = rng.choice(({}, None, {"a": {"oc": "corrected", "on": "2026-09-15", "carried": True}}))
                before, after = copy.deepcopy(args), copy.deepcopy(args)
                calls.clear()
                expected = outcome(LEGACY, before, bool(index % 2))
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index):
                    self.assertEqual(outcome(case_store.validate_visit, after, bool(index % 2)), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(after, before)
                outcomes.add(expected)
        self.assertIn(("result", None), outcomes)
        self.assertGreaterEqual(len(outcomes), 8, "corpus must exercise distinct refusal paths")


if __name__ == "__main__":
    unittest.main()
