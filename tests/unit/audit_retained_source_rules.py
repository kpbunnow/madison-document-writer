"""Retained-source phases preserve library/schedule refusal and UTF-8 read order."""

import copy
import json
from pathlib import Path
import random
import tempfile
import unittest
from unittest.mock import patch

import compiler

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = compiler.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/retained_sources_reference.txt").read_text(encoding="utf-8"), "retained_sources_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["validate_retained_sources"]


def outcome(check, root):
    try:
        return ("result", check(root))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class RetainedSourceRules(unittest.TestCase):
    def test_compiled_policy_bytes_are_unchanged(self):
        with patch.object(compiler, "validate_retained_sources", LEGACY):
            expected = compiler.compile_policy(ROOT)
        actual = compiler.compile_policy(ROOT)
        self.assertEqual(
            json.dumps(actual, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"),
            json.dumps(expected, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8"),
        )

    def test_generated_sources_refusals_and_read_order(self):
        rng = random.Random(20261028)
        grammar = json.loads((ROOT / "policy/sources/citation_policy_source.json").read_text(encoding="utf-8"))["grammar"]
        calls, outcomes = [], set()
        native_read = Path.read_text

        def traced_read(path, **kwargs):
            calls.append((str(path), kwargs))
            return native_read(path, **kwargs)

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "policy/sources").mkdir(parents=True)
            (root / "app/assets").mkdir(parents=True)
            (root / "policy/sources/citation_policy_source.json").write_text(json.dumps({"grammar": grammar}), encoding="utf-8")
            library_path, schedule_path = root / "app/assets/library.js", root / "app/assets/deposits.js"
            with patch.object(Path, "read_text", traced_read):
                for index in range(3000):
                    section = "27.05(2)(c)"
                    item = {"o": "QA item", "s": [section], "citationManualSections": {section: "QA reviewed"}}
                    entry = {
                        "id": "QA entry",
                        "ordinance": section,
                        "status": "verified",
                        "rawText": "$1.00",
                        "tiers": [{"amountCents": 100}],
                        "review": {"reviewer": "QA"},
                        "stale": False,
                    }
                    if index % 3:
                        for _ in range(rng.randrange(1, 4)):
                            if rng.choice((True, False)):
                                item[rng.choice(("s", "citationManualSections", "citationMapping"))] = copy.deepcopy(
                                    rng.choice((None, {}, [], ["bad"], ["27.05(2)(C)3"], False, "QA mapping"))
                                )
                            else:
                                entry[rng.choice(("ordinance", "status", "rawText", "tiers", "review", "stale"))] = copy.deepcopy(
                                    rng.choice((None, "", "bad", "verified", "$1.00 $2.00", {}, [], [{"amountCents": 100}], True, False))
                                )
                    library = [{"code": "QA", "groups": [{"code": "synthetic", "items": [item]}]}]
                    schedule = [entry]
                    library_text = "const LIBRARY=" + json.dumps(library) + ";"
                    schedule_text = "const DEPOSITS=" + json.dumps(schedule) + ";"
                    if index % 11 == 0:
                        schedule_text = "const DEPOSITS={broken;"
                    library_path.write_text(library_text, encoding="utf-8")
                    schedule_path.write_text(schedule_text, encoding="utf-8")
                    calls.clear()
                    expected = outcome(LEGACY, root)
                    trace = calls[:]
                    calls.clear()
                    with self.subTest(index=index):
                        self.assertEqual(outcome(compiler.validate_retained_sources, root), expected)
                        self.assertEqual(calls, trace)
                        self.assertEqual(native_read(library_path, encoding="utf-8"), library_text)
                        self.assertEqual(native_read(schedule_path, encoding="utf-8"), schedule_text)
                    outcomes.add(expected)
        self.assertIn(("result", None), outcomes)
        self.assertGreaterEqual(len(outcomes), 6, "corpus must exercise distinct library, schedule and malformed-source failures")


if __name__ == "__main__":
    unittest.main()
