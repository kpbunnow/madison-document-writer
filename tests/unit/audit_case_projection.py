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
# Consolidation Phase 2 (T3): a fast development run (DW_FAST=1) deliberately reduces coverage to the first seed, with
# its own threshold. The full gate always uses every seed and the full threshold.
FAST = os.environ.get("DW_FAST") == "1"
if FAST:
    SEEDS = SEEDS[:1]
MIN_COMPARED = 1500 if FAST else 5000


def load_capture(path, suite, run, source):
    """Consolidation Phase 2 (T2): a capture is accepted only as a complete envelope from this run, suite and source,
    written by a suite that passed. Anything else fails explicitly; nothing is reused silently."""
    path = Path(path)
    if not path.is_file():
        raise AssertionError(suite + ": projection capture is missing (" + str(path) + ")")
    try:
        capture = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as error:
        raise AssertionError(suite + ": projection capture is malformed: " + str(error)) from None
    if (
        not isinstance(capture, dict)
        or capture.get("format") != "madison-projection-capture"
        or type(capture.get("version")) is not int
        or capture.get("version") != 1
    ):
        raise AssertionError(suite + ": projection capture has no recognized envelope")
    if capture.get("run") != run or capture.get("suite") != suite or capture.get("source") != source:
        raise AssertionError(suite + ": projection capture is from another run, suite or source")
    if capture.get("passed") is not True:
        raise AssertionError(suite + ": the source flow failed; its projection capture cannot be used")
    summaries = capture.get("summaries")
    if not isinstance(summaries, list) or not summaries or not all(isinstance(c, dict) and {"file", "summary"} <= c.keys() for c in summaries):
        raise AssertionError(suite + ": projection capture is empty or incomplete")
    return summaries


class CaseProjection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        folder = Path(cls.temp.name)

        def corpus(seed):
            path = folder / ("corpus-" + str(seed) + ".json")
            subprocess.run(["node", "tests/fixtures/projection_corpus.cjs", str(path), "2000", str(seed)], cwd=ROOT, check=True, timeout=120)
            return json.loads(path.read_bytes())

        # In the gate, tools/run_tests.py captured the flows while running them; reuse those captures (and fail if
        # any is unusable). Run on its own, this suite runs the flows itself.
        gate = os.environ.get("DW_PROJECTION_DIR")
        run_id = os.environ.get("DW_PROJECTION_RUN", "") if gate else "standalone-" + str(os.getpid())
        source = os.environ.get("DW_PROJECTION_SOURCE", "") if gate else ""

        def flow(name):
            if gate:
                return load_capture(Path(gate) / (name + ".json"), name, run_id, source)
            path = folder / (name + ".json")
            run = subprocess.run(
                ["node", "tests/unit/" + name + ".js"],
                cwd=ROOT,
                env={
                    **os.environ,
                    "DW_PROJECTION_CAPTURE": str(path),
                    "DW_PROJECTION_RUN": run_id,
                    "DW_PROJECTION_SUITE": name,
                    "DW_PROJECTION_SOURCE": source,
                },
                capture_output=True,
                encoding="utf-8",
                errors="replace",
                timeout=120,
            )
            if run.returncode:
                raise AssertionError(name + " failed while capturing:\n" + run.stdout[-2000:] + run.stderr[-2000:])
            return load_capture(path, name, run_id, source)

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
        self.assertGreater(compared, MIN_COMPARED)
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
