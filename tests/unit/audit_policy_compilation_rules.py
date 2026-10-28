"""Compiler phases preserve bytes, refusal/read/interpret order and temporary-policy cleanup."""

import copy
import json
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import citation_pricing
import compiler

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = compiler.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/policy_compiler_reference.txt").read_text(encoding="utf-8"), "policy_compiler_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["compile_policy"]


def outcome(check):
    try:
        result = check(ROOT)
        return ("result", (json.dumps(result, indent=2) + "\n").encode("utf-8"))
    except Exception as error:
        return ("error", type(error).__name__, str(error))


class PolicyCompilationRules(unittest.TestCase):
    def test_generated_compilation_contexts_and_cleanup(self):
        rng = random.Random(20261028)
        calls, cache = [], {}
        native_read, native_interpret, native_yaml = compiler.read, compiler.interpret, compiler.yaml.safe_load
        overrides = {}
        failure = None
        refused_id = None
        example_index = 0
        schedule_paths = sorted((ROOT / "policy/schedule").glob("*.json"))
        schedule_ids = [entry["id"] for path in schedule_paths for entry in native_read(path)]
        original_policy = citation_pricing.policy

        def read(path):
            relative = str(Path(path).relative_to(ROOT))
            calls.append(("read", relative))
            if relative not in cache:
                cache[relative] = native_read(path)
            return copy.deepcopy(overrides.get(relative, cache[relative]))

        def interpret(entry, version):
            calls.append(("interpret", entry["id"], copy.deepcopy(version)))
            if failure == "interpret" and entry["id"] == refused_id:
                raise ValueError("Synthetic interpreter refusal")
            return native_interpret(entry, version)

        def yaml(source):
            calls.append(("examples", source))
            examples = native_yaml(source)
            if failure == "example":
                examples[example_index % len(examples)]["total"] = "synthetic mismatched total"
            return examples

        NAMESPACE.update(read=read, interpret=interpret)
        errors, succeeded = set(), 0
        with patch.object(compiler, "read", read), patch.object(compiler, "interpret", interpret), patch.object(compiler.yaml, "safe_load", yaml):
            for index in range(128):
                overrides.clear()
                failure = None
                refused_id = None
                example_index = index
                metadata = native_read(ROOT / "policy/metadata.json")
                mode = index % 8
                if mode == 0 and index:
                    metadata["snowCountPriorDifferentOwner"] = bool(index % 16)
                elif mode == 1:
                    metadata["pricingDateBasis"] = rng.choice((None, "bad", "issue", "violation"))
                elif mode == 2:
                    metadata["snowSeasonStartMonthDay"] = rng.choice(("bad", "02-30", "01-01", "07-01"))
                elif mode == 3:
                    schedule_path = rng.choice(schedule_paths)
                    entries = native_read(schedule_path)
                    entries.append(copy.deepcopy(rng.choice(entries)))
                    overrides[str(schedule_path.relative_to(ROOT))] = entries
                elif mode == 4:
                    parameters = native_read(ROOT / "policy/surcharges.json")
                    rng.choice(parameters[rng.choice(list(parameters))])["source"] = {}
                    overrides["policy/surcharges.json"] = parameters
                elif mode == 5:
                    ladders = native_read(ROOT / "policy/ladders.json")
                    rng.choice(ladders)["versions"] = []
                    overrides["policy/ladders.json"] = ladders
                elif mode == 6:
                    failure = "interpret"
                    refused_id = rng.choice(schedule_ids)
                elif mode == 7:
                    failure = "example"
                overrides["policy/metadata.json"] = metadata
                inputs = copy.deepcopy(overrides)
                calls.clear()
                expected = outcome(LEGACY)
                self.assertIs(citation_pricing.policy, original_policy, "legacy compiler restores policy after success or refusal")
                trace = calls[:]
                calls.clear()
                with self.subTest(index=index, mode=mode):
                    self.assertEqual(outcome(compiler.compile_policy), expected)
                    self.assertEqual(calls, trace)
                    self.assertEqual(overrides, inputs)
                    self.assertIs(citation_pricing.policy, original_policy, "phase compiler restores policy after success or refusal")
                if expected[0] == "result":
                    succeeded += 1
                else:
                    errors.add(expected[1:])
        self.assertGreater(succeeded, 0)
        self.assertGreaterEqual(len(errors), 6, "corpus covers early source/version failures and late interpreter/example refusals")


if __name__ == "__main__":
    unittest.main()
