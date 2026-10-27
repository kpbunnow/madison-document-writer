"""Real-filesystem equivalence for case-save merges, retries, refusals and recovery bytes."""

import copy
import contextlib
from pathlib import Path
import random
import tempfile
import unittest
from unittest.mock import patch

import case_store
import audit_helper as fixtures

ROOT = Path(__file__).resolve().parents[2]
NAMESPACE = case_store.__dict__.copy()
exec(compile((ROOT / "tests/fixtures/case_save_reference.txt").read_text(encoding="utf-8"), "case_save_reference", "exec"), NAMESPACE)
LEGACY = NAMESPACE["_save_case"]
NAME = "101 TEST LANE - QA-001.json"


def outcome(check, root, incoming, **options):
    try:
        return ("result", check(root, NAME, incoming, **options))
    except Exception as error:
        return ("error", type(error).__name__, str(error).replace(str(root), "ROOT"))


def files(root):
    return {str(p.relative_to(root)): p.read_bytes() for p in root.rglob("*") if p.is_file()}


class CaseSavePhases(unittest.TestCase):
    def test_sequenced_real_file_saves_match(self):
        rng = random.Random(20261027)
        native_lock, native_write = case_store.file_lock, case_store.atomic_write
        trace = []
        active_root = None

        @contextlib.contextmanager
        def lock(folder, key):
            trace.append(("lock", str(Path(folder).relative_to(active_root)), key))
            with native_lock(folder, key):
                yield
            trace.append(("unlock", key))

        def write(path, raw):
            trace.append(("write", str(Path(path).relative_to(active_root)), raw))
            return native_write(path, raw)

        LEGACY.__globals__.update(file_lock=lock, atomic_write=write)
        with (
            tempfile.TemporaryDirectory() as temporary,
            patch.object(case_store, "file_lock", lock),
            patch.object(case_store, "atomic_write", write),
            patch.object(case_store.case_integrity, "stamp", return_value="2026-10-27T12:00:00+00:00"),
        ):
            roots = [Path(temporary) / "old", Path(temporary) / "new"]
            for root in roots:
                root.mkdir()
            baseline = fixtures.record()
            requests = [(baseline, {})]
            for index in range(100):
                incoming = copy.deepcopy(baseline)
                incoming["case"]["owner"] = rng.choice(("SYNTHETIC OWNER", "SYNTHETIC CHANGED OWNER"))
                if index % 5 == 0:
                    incoming["events"][0]["payload"]["conflict"] = index
                options = {"base_case": copy.deepcopy(baseline["case"])}
                if index % 3 == 0:
                    options["idempotency_event"] = "first"
                if index % 11 == 0:
                    incoming["schema"] = 2
                requests.append((incoming, options))
            for index, (incoming, options) in enumerate(requests):
                outcomes, traces, inputs = [], [], []
                for root, check in zip(roots, (LEGACY, case_store._save_case)):
                    active_root = root
                    trace.clear()
                    value = copy.deepcopy(incoming)
                    outcomes.append(outcome(check, root, value, **copy.deepcopy(options)))
                    traces.append(trace[:])
                    inputs.append(value)
                with self.subTest(index=index):
                    self.assertEqual(outcomes[0], outcomes[1])
                    self.assertEqual(traces[0], traces[1])
                    self.assertEqual(inputs[0], inputs[1])
                    self.assertEqual(files(roots[0]), files(roots[1]))


if __name__ == "__main__":
    unittest.main()
