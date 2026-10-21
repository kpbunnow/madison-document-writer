"""The helper's reporting projection equals the application's real summarize() output."""

from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import case_projection as cp

ROOT = Path(__file__).resolve().parents[2]
# Suites whose real Writer flows write summaries; tests/fixtures/projection_capture.cjs records them.
FLOWS = ["audit_summary", "audit_lifecycle", "audit_corrections", "audit_r25", "audit_r26", "audit_r28", "audit_release"]
SEEDS = [20261021, 7, 31337]


class CaseProjection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        folder = Path(cls.temp.name)

        def corpus(seed):
            path = folder / ("corpus-" + str(seed) + ".json")
            subprocess.run(["node", "tests/fixtures/projection_corpus.cjs", str(path), "2000", str(seed)], cwd=ROOT, check=True, timeout=120)
            return json.loads(path.read_bytes())

        def flow(name):
            path = folder / (name + ".json")
            run = subprocess.run(
                ["node", "tests/unit/" + name + ".js"],
                cwd=ROOT,
                env={**os.environ, "DW_PROJECTION_CAPTURE": str(path)},
                capture_output=True,
                encoding="utf-8",
                errors="replace",
                timeout=120,
            )
            if run.returncode:
                raise AssertionError(name + " failed while capturing:\n" + run.stdout[-2000:] + run.stderr[-2000:])
            return json.loads(path.read_bytes())

        with ThreadPoolExecutor(max_workers=4) as pool:
            cls.corpora = list(pool.map(corpus, SEEDS))
            cls.flows = dict(zip(FLOWS, pool.map(flow, FLOWS)))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_mirrored_tables_match_the_application(self):
        tables = self.corpora[0]["tables"]
        self.assertEqual(cp.STATUS_OF, tables["STATUS_OF"])
        self.assertEqual(cp.DOC_LABELS, {t["id"]: t["label"] for t in tables["DOC_TYPES"]})
        self.assertEqual(cp.SUPPLEMENTAL, {t["id"] for t in tables["NEW_TYPES"] if t["effect"] == "supplemental"})
        self.assertEqual((cp.SCHEMA, cp.SNOW_TYPE), (tables["SCHEMA"], tables["SNOW_TYPE"]))
        versions = {c["summary"]["summaryVersion"] for corpus in self.corpora for c in corpus["cases"] if c["summary"]}
        self.assertEqual(versions, {cp.SUMMARY_VERSION})
        library = json.loads((ROOT / "build/generated/projection_tables.json").read_bytes())
        self.assertEqual(library["format"], "madison-projection-tables")

    def test_generated_corpus_projects_exactly(self):
        compared = refused = 0
        for seed, corpus in zip(SEEDS, self.corpora):
            for n, case in enumerate(corpus["cases"]):
                with self.subTest(seed=seed, case=n):
                    if case["error"]:
                        # summarize() could not have written a summary; the projection must not invent one.
                        with self.assertRaises(Exception):
                            cp.project(case["file"])
                        refused += 1
                        continue
                    # Canonical JSON text, not Python ==, which would equate false with 0.
                    expected = cp.json_text(cp.reportable(case["summary"]))
                    self.assertEqual(cp.json_text(cp.projected(case["file"])[0]), expected)
                    compared += 1
        self.assertGreater(compared, 5000)
        self.assertGreater(refused, 0)

    def test_real_writer_flows_project_exactly(self):
        total = 0
        for name, captured in self.flows.items():
            for n, case in enumerate(captured):
                with self.subTest(suite=name, summary=n):
                    self.assertEqual(cp.mismatched_fields(case["summary"], case["file"]), [])
                    projections = [cp.json_text(cp.projected(case["file"], loaded)[0]) for loaded in (False, True)]
                    self.assertIn(cp.json_text(cp.reportable(case["summary"])), projections)
                    total += 1
        self.assertGreater(total, 300)

    def test_comparison_distinguishes_booleans_from_numbers(self):
        for a, b in [
            (False, 0),
            (True, 1),
            (0, False),
            (1, True),
            ({"x": {"y": False}}, {"x": {"y": 0}}),
            ([1, True], [1, 1]),
            ([{"a": [False]}], [{"a": [0]}]),
        ]:
            with self.subTest(a=a, b=b):
                self.assertTrue(a == b, "Python equality alone would accept this substitution")
                self.assertFalse(cp.same_json(a, b))
        for a, b in [(197, 197.0), ({"b": 1, "a": 2.5}, {"a": 2.5, "b": 1.0}), ([False, True], [False, True]), (None, None)]:
            with self.subTest(a=a, b=b):
                self.assertTrue(cp.same_json(a, b))
        self.assertFalse(cp.same_json([1, 2], [2, 1]))
        self.assertFalse(cp.same_json(None, 0))
        for value in [float("nan"), float("inf"), 2**60, cp.UNDEF, {1: "non-string key"}]:
            with self.subTest(unsupported=repr(value)):
                self.assertFalse(cp.same_json(value, value))

    def test_corpus_booleans_stay_booleans(self):
        # Every boolean summarize() writes is a boolean in the projection too, at any depth.
        def booleans(value, path=""):
            if isinstance(value, bool):
                yield path
            elif isinstance(value, dict):
                for k, v in value.items():
                    yield from booleans(v, path + "/" + k)
            elif isinstance(value, list):
                for i, v in enumerate(value):
                    yield from booleans(v, path + "/" + str(i))

        checked = 0
        for case in self.corpora[0]["cases"]:
            if case["summary"]:
                expected = list(booleans(cp.reportable(case["summary"])))
                self.assertEqual(list(booleans(cp.projected(case["file"])[0])), expected)
                checked += len(expected)
        self.assertGreater(checked, 10000)

    def test_corpus_covers_reportable_content(self):
        summaries = [c["summary"] for corpus in self.corpora for c in corpus["cases"] if c["summary"]]
        statuses = {s["case"]["status"] for s in summaries}
        self.assertTrue({"Notice", "Closed", "Referred", "Withdrawn", "Not issued", "Occupancy restricted", "Cited – snow"} <= statuses, statuses)
        hows = {v["typeHow"] for s in summaries for v in s["violations"]}
        self.assertEqual(hows, {"library", "matched", "section"})
        for field in [
            "documents",
            "violations",
            "citations",
            "visits",
            "restrictions",
            "conditionalExtensions",
            "snowInspections",
            "corrections",
            "referrals",
        ]:
            with self.subTest(field=field):
                self.assertGreater(sum(len(s[field]) for s in summaries), 20)


if __name__ == "__main__":
    unittest.main()
