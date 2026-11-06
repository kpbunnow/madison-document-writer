"""Paired synthetic Reports/open-case reads in isolated source processes. Diagnostic only, never gate approval.

Build both trusted source roots first, then:
python3 tools/compare_reporting_reads.py BEFORE_ROOT AFTER_ROOT NEW_OUTPUT_DIR
"""

import argparse
from contextlib import ExitStack
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import statistics
import subprocess
import sys
import tempfile
import threading
import time
from unittest.mock import patch

HARNESS = Path(__file__).resolve().parents[1]


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def fixture_hash(folder):
    return digest({p.relative_to(folder).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(folder.rglob("*")) if p.is_file()})


def configure_source(source):
    os.environ["DW_REPO_ROOT"] = str(source)
    sys.path[:0] = [str(source / p) for p in ["helper", "tools", "policy", "build/generated"]] + [str(HARNESS / "tests/unit")]


def verify_source_modules(source):
    for module in list(sys.modules.values()):
        filename = getattr(module, "__file__", None)
        if filename:
            path = Path(filename).resolve()
            if "helper" in path.parts and not path.is_relative_to(source / "helper"):
                raise ValueError("Mixed helper source roots")


class ReadMetrics:
    def __init__(self, folder, latency):
        self.folder, self.latency = folder, latency
        self.counts = {"summary": 0, "case": 0, "evidence": 0, "summaryScans": 0}
        self.lock, self.active, self.peak = threading.Lock(), 0, 0
        self.original_text, self.original_bytes, self.original_glob = Path.read_text, Path.read_bytes, Path.glob

    def read(self, reader, path, *args, **kwargs):
        path = Path(path)
        counted = path.is_relative_to(self.folder)
        if counted:
            kind = "summary" if path.parent.name == "Reporting Index" else "case" if path.parent == self.folder else "evidence"
            with self.lock:
                self.counts[kind] += 1
                self.active += 1
                self.peak = max(self.peak, self.active)
        try:
            if counted and self.latency == "synthetic":
                bucket = hashlib.sha256(path.relative_to(self.folder).as_posix().encode("utf-8")).digest()[0] % 20
                time.sleep(0.0005 if bucket < 16 else 0.002 if bucket < 19 else 0.008)
            return reader(path, *args, **kwargs)
        finally:
            if counted:
                with self.lock:
                    self.active -= 1

    def glob(self, path, pattern, *args, **kwargs):
        if path == self.folder / "Reporting Index":
            self.counts["summaryScans"] += 1
        return self.original_glob(path, pattern, *args, **kwargs)


def measure(source, folder, count, latency):
    configure_source(source)
    import case_integrity as integrity
    import inspector_cases
    import server
    from plain_files import read_plain_bytes

    verify_source_modules(source)
    # Never read a developer's real anchor settings. Both versions exercise the same absent synthetic configuration.
    integrity.SETTINGS = folder.parent / "absent-synthetic-settings.json"
    result = {}
    for operation in ["reports", "open-case-dues"]:
        call = (
            (lambda: server.read_index(4))
            if operation == "reports"
            else (lambda: inspector_cases.due_dates(folder, [f"QA-{n}" for n in range(count)]))
        )
        with patch.object(server, "case_dir", return_value=folder):
            call()  # Equal untimed warmup; the pure projection cache is reset before measurement.
        server.PROJECTION_MATCHES.clear()
        metrics = ReadMetrics(folder, latency)
        with ExitStack() as stack:
            stack.enter_context(patch.object(Path, "read_text", lambda p, *a, **k: metrics.read(metrics.original_text, p, *a, **k)))
            stack.enter_context(patch.object(Path, "read_bytes", lambda p: metrics.read(metrics.original_bytes, p)))
            stack.enter_context(patch.object(Path, "glob", lambda p, pattern, *a, **k: metrics.glob(p, pattern, *a, **k)))
            stack.enter_context(patch.object(server, "read_plain_bytes", lambda p: metrics.read(read_plain_bytes, p)))
            stack.enter_context(patch.object(inspector_cases, "read_plain_bytes", lambda p: metrics.read(read_plain_bytes, p)))
            stack.enter_context(patch.object(server, "case_dir", return_value=folder))
            settings = stack.enter_context(patch.object(integrity, "protected_folder", wraps=integrity.protected_folder))
            proofs = stack.enter_context(patch.object(integrity, "verify_record", wraps=integrity.verify_record))
            started = time.perf_counter()
            value = call()
            elapsed = time.perf_counter() - started
        if operation == "reports":
            del value["readAt"]  # Operation timestamp only; all facts, order and verification results remain compared.
            if len(value["summaries"]) != count or not all(s["integrity"]["valid"] for s in value["summaries"]):
                raise ValueError("Incomplete/unverified Reports workload")
        elif len(value) != count:
            raise ValueError("Incomplete due-date workload")
        if proofs.call_count != count or metrics.counts["case"] != count or not 1 <= metrics.peak <= 4 or metrics.active:
            raise ValueError("Every case must be read and independently verified within four readers")
        result[operation] = {
            "seconds": elapsed,
            "resultSha256": digest(list(value.items())),
            "reads": metrics.counts,
            "proofs": proofs.call_count,
            "settingsLookups": settings.call_count,
            "peakReaders": metrics.peak,
        }
    verify_source_modules(source)
    return {
        "cases": count,
        "fixtureSha256": fixture_hash(folder),
        "python": platform.python_version(),
        "platform": platform.platform(),
        "latency": latency,
        "operations": result,
    }


def validate_run(run, reference):
    if type(run["cases"]) is not int or run["cases"] <= 0 or not re.fullmatch(r"[a-f0-9]{64}", run["fixtureSha256"]):
        raise ValueError("Missing workload identity")
    for key in ["cases", "fixtureSha256", "python", "platform", "latency"]:
        if run[key] != reference[key]:
            raise ValueError("Different workload/environment: " + key)
    if set(run["operations"]) != {"reports", "open-case-dues"}:
        raise ValueError("Missing operation")
    for op, values in run["operations"].items():
        if not re.fullmatch(r"[a-f0-9]{64}", values["resultSha256"]):
            raise ValueError("Missing result identity")
        if values["resultSha256"] != reference["operations"][op]["resultSha256"]:
            raise ValueError("Different results/order")
        if values["proofs"] != run["cases"] or values["reads"]["case"] != run["cases"] or not 1 <= values["peakReaders"] <= 4:
            raise ValueError("Missing independent case reads/proofs or excess concurrency")
        if not 0 < values["seconds"] < float("inf"):
            raise ValueError("Invalid duration")


def compare(pairs):
    if len(pairs) < 4 or len(pairs) % 2:
        raise ValueError("Use an even number of at least four paired rounds")
    reference = pairs[0]["before"]
    for n, pair in enumerate(pairs):
        if pair["order"] != (["after", "before"] if n % 2 else ["before", "after"]):
            raise ValueError("Unbalanced run order")
        for version in ["before", "after"]:
            validate_run(pair[version], reference)
    rows = []
    for operation in reference["operations"]:
        before, after = ([p[v]["operations"][operation]["seconds"] for p in pairs] for v in ["before", "after"])
        rows.append(
            {
                "operation": operation,
                "beforeMedianSeconds": statistics.median(before),
                "afterMedianSeconds": statistics.median(after),
                "percentLessTime": 100 * (1 - statistics.median(after) / statistics.median(before)),
                "pairedPercent": [100 * (1 - a / b) for a, b in zip(after, before)],
                "beforeRange": [min(before), max(before)],
                "afterRange": [min(after), max(after)],
            }
        )
    return {
        "mode": "diagnostic-only",
        "passed": True,
        "resultsEqual": True,
        "rounds": len(pairs),
        "cases": reference["cases"],
        "fixtureSha256": reference["fixtureSha256"],
        "rows": rows,
        "pairs": pairs,
    }


def source_identity(source):
    from project_layout import fingerprint
    from release_evidence import source_provenance

    inputs = fingerprint(source)
    return {"root": str(source), **source_provenance(source, inputs)}


def run_worker(source, folder, count, latency, output, expected_hash):
    command = [sys.executable, str(Path(__file__).resolve()), "--worker", str(source), str(folder), str(count), latency, str(output)]
    subprocess.run(command, check=True, timeout=300, encoding="utf-8")
    value = json.loads(output.read_text(encoding="utf-8"))
    if value["cases"] != count or value["latency"] != latency:
        raise ValueError("Worker did not complete the requested workload")
    if value["fixtureSha256"] != expected_hash or fixture_hash(folder) != expected_hash:
        raise ValueError("Synthetic fixture changed")
    return value


def run_comparison(args):
    if args.rounds < 4 or args.rounds > 10 or args.rounds % 2:
        raise ValueError("Use 4–10 even paired rounds")
    sizes = [int(x) for x in args.sizes.split(",")]
    if len(sizes) != len(set(sizes)) or not sizes or any(not 1 <= n <= 10000 for n in sizes):
        raise ValueError("Use unique sizes from 1–10,000")
    sources = {"before": args.before.resolve(), "after": args.after.resolve()}
    identities = {k: source_identity(v) for k, v in sources.items()}
    for name in ["requirements-dev.txt", "package-lock.json"]:
        if (sources["before"] / name).read_bytes() != (sources["after"] / name).read_bytes():
            raise ValueError("Dependency pins differ: " + name)
    args.output.mkdir()  # Exclusive run folder; never mix evidence with a previous comparison.
    configure_source(sources["after"])
    from audit_r49_readiness import fixture

    comparisons = []
    with tempfile.TemporaryDirectory(prefix="madison-read-comparison-") as tmp:
        for count in sizes:
            folder = Path(tmp) / str(count)
            folder.mkdir()
            fixture(folder, count)
            expected_hash = fixture_hash(folder)
            pairs = []
            for round_number in range(args.rounds):
                pair = {"order": ["after", "before"] if round_number % 2 else ["before", "after"]}
                for version in pair["order"]:
                    output = args.output / f"{count}-{round_number}-{version}.json"
                    pair[version] = run_worker(sources[version], folder, count, args.latency, output, expected_hash)
                    print(f"Completed {count} {round_number} {version}", flush=True)
                pairs.append(pair)
            comparisons.append(compare(pairs))
    if {k: source_identity(v) for k, v in sources.items()} != identities:
        raise ValueError("Source changed during comparison")
    result = {
        "mode": "diagnostic-only",
        "sources": identities,
        "harness": source_identity(HARNESS),
        "latency": args.latency,
        "comparisons": comparisons,
    }
    (args.output / "comparison.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps([r["rows"] for r in comparisons], indent=2))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--worker":
        source, folder, count, latency, output = sys.argv[2:]
        value = measure(Path(source).resolve(), Path(folder), int(count), latency)
        Path(output).write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
        return
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--sizes", default="600,3000")
    parser.add_argument("--rounds", type=int, default=4)
    parser.add_argument("--latency", choices=["local", "synthetic"], default="local")
    run_comparison(parser.parse_args())


if __name__ == "__main__":
    main()
