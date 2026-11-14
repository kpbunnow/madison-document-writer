"""Index phase extraction preserves verified-source decisions and ordered partial errors."""
import contextlib
import copy
import hashlib
import json
from pathlib import Path
import random
import tempfile
import types
import unittest
from unittest.mock import patch
import server
from audit_r49_readiness import fixture

ROOT = Path(__file__).resolve().parents[2]
REFERENCE = ROOT / "tests/fixtures/read_index_reference.py.txt"

def outcome(root, reference=False, failure=None):
    namespace = dict(vars(server))
    for name, function in vars(server).items():
        if isinstance(function, types.FunctionType) and function.__module__ == "server":
            clone = types.FunctionType(function.__code__, namespace, function.__name__, function.__defaults__, function.__closure__)
            clone.__kwdefaults__ = function.__kwdefaults__
            namespace[name] = clone
    if reference:
        exec(compile(REFERENCE.read_text(), str(REFERENCE), "exec"), namespace)
    trace = []
    original = server.read_plain_bytes
    def read(path):
        trace.append(path.name)
        if path.name == failure:
            raise OSError("synthetic interrupted case read")
        return original(path)
    namespace.update(case_dir=lambda: root, read_plain_bytes=read)
    with patch.object(server.time, "strftime", return_value="synthetic-clock"):
        server.PROJECTION_MATCHES.clear()
        try:
            return ("result", namespace["read_index"](1)), trace
        except Exception as error:
            return ("error", type(error).__name__, str(error)), trace

def parcel_outcome(cache, found, refresh, reference=False):
    namespace = dict(vars(server))
    fn = server.lookup_parcels
    namespace[fn.__name__] = types.FunctionType(fn.__code__, namespace, fn.__name__, fn.__defaults__)
    if reference:
        path = ROOT / "tests/fixtures/parcel_lookup_reference.py.txt"
        exec(compile(path.read_text(), str(path), "exec"), namespace)
    state, trace = copy.deepcopy(cache), []
    def read():
        trace.append("read")
        return state
    def city(ids):
        trace.append(("city", ids))
        if isinstance(found, Exception):
            raise found
        return copy.deepcopy(found)
    def write(value):
        trace.append(("write", copy.deepcopy(value)))
    namespace.update(CACHE_LOCK=contextlib.nullcontext(), file_lock=lambda *args: contextlib.nullcontext(),
                     gis_dir=lambda: Path("synthetic"), read_cache=read, write_cache=write, city_parcels=city)
    with patch.object(server.time, "strftime", return_value="2026-11-14"):
        try:
            result = ("result", namespace[fn.__name__](["070822219103", "070822219104", "bad"], refresh))
        except Exception as error:
            result = ("error", type(error).__name__, str(error))
    return result, state, trace

class IndexValidationPhases(unittest.TestCase):
    def test_original_provenance(self):
        self.assertEqual(hashlib.sha256(REFERENCE.read_bytes()).hexdigest(), "14983ff1eda8fe719ab212e1e183a12863967eea81c7e2d28b7261a42b792766")

    def test_parcel_history_and_partial_failure_order(self):
        path = ROOT / "tests/fixtures/parcel_lookup_reference.py.txt"
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), "f35fbd2ab9cfb9daa222b87e3ad492b9f2a5b9e9b4a47e401ad51d0be941f31c")
        pid = "070822219103"
        record = {"address": "Synthetic", "alder": 1, "building": 2, "lat": 43, "lon": -89}
        for hist in [[], [dict(record, fetched="2026-11-13")], [{"alder": 3}], [None]]:
            for missing in [{}, {pid: "2026-11-14"}, {pid: "2026-11-13"}]:
                cache = {"format": "madison-parcel-cache", "parcels": {pid: {"history": hist}}, "missing": missing}
                for found in [{}, {pid: record}, {pid: {}}, OSError("synthetic failure")]:
                    for refresh in [False, True]:
                        self.assertEqual(parcel_outcome(cache, found, refresh), parcel_outcome(cache, found, refresh, True))

    def test_original_decisions_and_ordered_interrupted_reads(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            fixture(root, 3)
            index = root / "Reporting Index"
            originals = {p: p.read_bytes() for p in index.iterdir()}
            rng = random.Random(23054)
            values = [None, False, "", "bad", {}, [], [None], [{"id": "bad"}]]
            for n in range(240):
                for path, raw in originals.items():
                    path.write_bytes(raw)
                target = index / "qa-0.json"
                summary = json.loads(originals[target])
                field = rng.choice(["case", "format", "sourceFile", "sourceRevision", "documents", "visits", "violations", "citations", "reinspections", "referrals"])
                if n % 4:
                    summary[field] = copy.deepcopy(rng.choice(values))
                else:
                    summary.pop(field, None)
                target.write_text(json.dumps(summary))
                duplicate = index / "duplicate.json"
                if n % 3 == 0:
                    duplicate.write_bytes(target.read_bytes())
                else:
                    duplicate.unlink(missing_ok=True)
                before = {p: p.read_bytes() for p in root.rglob("*.json")}
                failure = "TEST - QA-1.json" if n % 7 == 0 else None
                with self.subTest(n=n):
                    self.assertEqual(outcome(root, failure=failure), outcome(root, True, failure))
                    self.assertEqual({p: p.read_bytes() for p in before}, before)
            self.assertEqual(outcome(root / "absent"), outcome(root / "absent", True))
            (root / "_integrity/migrated.json").write_text("{bad")
            self.assertEqual(outcome(root), outcome(root, True))

if __name__ == "__main__":
    unittest.main()
