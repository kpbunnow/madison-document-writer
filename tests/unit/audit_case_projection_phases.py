"""The helper projection against the retained functions over the synthetic corpus: replayed documents and visits,
summaries for both workspace modes, whether the workspace was consulted, refusals and untouched inputs."""

import copy
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import case_projection as cp

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = cp.__dict__.copy()
exec(
    compile((ROOT / "tests/fixtures/case_projection_py_reference.txt").read_text(encoding="utf-8"), "case_projection_py_reference", "exec"), NAMESPACE
)
LEGACY_REPLAY, LEGACY_PROJECT = NAMESPACE["replay_events"], NAMESPACE["project"]
SEEDS = [20261021, 7, 31337]


def encode(value):
    """A type-aware, order-keeping text: booleans stay distinct from numbers and undefined from missing."""
    if value is cp.UNDEF:
        return "<UNDEF>"
    if isinstance(value, dict):
        return {str(k): encode(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [encode(v) for v in value]
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return "<" + type(value).__name__ + ":" + repr(value) + ">"


def text(value):
    return json.dumps(encode(value), ensure_ascii=False, allow_nan=True)


def outcome(check, *args):
    try:
        return ("result", text(check(*args)))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class ProjectionPhases(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.cases = []
        for seed in SEEDS:
            path = Path(cls.temp.name) / ("corpus-" + str(seed) + ".json")
            subprocess.run(["node", "tests/fixtures/projection_corpus.cjs", str(path), "1000", str(seed)], cwd=ROOT, check=True, timeout=120)
            cls.cases.extend(json.loads(path.read_text(encoding="utf-8"))["cases"])

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_replay_matches_the_retained_function(self):
        for n, case in enumerate(self.cases):
            with self.subTest(case=n):
                record = case["file"]
                before = text(record)
                events = copy.deepcopy(record.get("events"))
                expected, actual = outcome(LEGACY_REPLAY, copy.deepcopy(events)), outcome(cp.replay_events, copy.deepcopy(events))
                self.assertEqual(actual, expected)
                self.assertEqual(text(record), before)

    def test_projection_matches_the_retained_function(self):
        refused = consulted = 0
        for n, case in enumerate(self.cases):
            for loaded in (False, True):
                with self.subTest(case=n, loaded=loaded):
                    record = case["file"]
                    before = text(record)
                    flags, results = [], []
                    for check in (LEGACY_PROJECT, cp.project):
                        workspace = cp.Workspace(loaded)
                        results.append(outcome(check, copy.deepcopy(record), workspace))
                        flags.append(workspace.consulted)
                    self.assertEqual(results[1], results[0])
                    self.assertEqual(flags[1], flags[0])
                    self.assertEqual(text(record), before)
                    refused += results[0][0] == "error"
                    consulted += bool(flags[0])
        self.assertGreater(refused, 0, "the corpus keeps reaching refusals")
        self.assertGreater(consulted, 0, "the corpus keeps consulting the workspace")


if __name__ == "__main__":
    unittest.main()
