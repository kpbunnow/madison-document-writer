#!/usr/bin/env python3
"""Verify production modules, run regression fixtures, restore production output."""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import shutil
import tempfile
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from release_evidence import fingerprint

os.environ["TZ"] = "America/Chicago"
if hasattr(__import__("time"), "tzset"):
    __import__("time").tzset()
ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / p) for p in ["helper", "tools", "policy", "tests/unit", "tests/fixtures", "build/generated"]]
os.environ["DW_REPO_ROOT"] = str(ROOT)
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
os.environ["PYTHONPATH"] = os.pathsep.join(sys.path[:6])
# The browser precheck runs before evidence is touched: audit_r51_layout runs this script without a browser during
# the gate, and that nested run must not clear the gate's own evidence.
browser_check = subprocess.run(["node", "tools/check_browser.cjs"], cwd=ROOT)
if browser_check.returncode:
    raise SystemExit(browser_check.returncode)
LOGS = ROOT / "build/test-results"
LOGS.mkdir(parents=True, exist_ok=True)
# Consolidation Phase 2 (T3): DW_FAST=1 is a reduced-coverage development run. It skips the measured performance
# suites and uses one projection corpus seed; its evidence is labelled "fast" and is never packaged.
MODE = "fast" if os.environ.get("DW_FAST") == "1" else "full"
# A new run invalidates the previous run's evidence first, so an aborted run never leaves earlier results in place.
(LOGS / "results.json").write_text("[]\n", encoding="utf-8")
(LOGS / "evidence.json").unlink(missing_ok=True)
(LOGS / "r50-print-compatibility.json").unlink(missing_ok=True)


def build(test=False):
    subprocess.run([sys.executable, "tools/build.py"], cwd=ROOT, env={**os.environ, "DW_TEST_BUILD": "1" if test else "0"}, check=True)


build()
subprocess.run(["node", "node_modules/eslint/bin/eslint.js", "app/assets/shared.js", "app/modules"], cwd=ROOT, check=True)
subprocess.run(
    [
        "node",
        "node_modules/typescript/bin/tsc",
        "--allowJs",
        "--checkJs",
        "--noEmit",
        "--target",
        "ES2022",
        "--lib",
        "ES2022,DOM",
        "app/modules/contracts.js",
    ],
    cwd=ROOT,
    check=True,
)
python_sources = [str(p.relative_to(ROOT)) for folder in ["helper", "tools", "policy"] for p in (ROOT / folder).glob("*.py")]
subprocess.run([sys.executable, "-m", "ruff", "check", "--select", "F", *python_sources], cwd=ROOT, check=True)
subprocess.run(
    [
        sys.executable,
        "-m",
        "vulture",
        "--min-confidence",
        "60",
        "--exclude",
        "helper/vendor",
        "helper",
        "tools",
        "policy",
        "tests/fixtures/vulture_whitelist.py",
    ],
    cwd=ROOT,
    check=True,
)
inputs = fingerprint(ROOT)
(LOGS / "source-before-tests.json").write_text(json.dumps(inputs, indent=2) + "\n", encoding="utf-8")
# Consolidation Phase 2 (T2): the Writer flows that audit_case_projection.py compares are captured while they run in
# the pool, in a directory created fresh for this run; the projection check runs afterwards and accepts only
# captures bound to this run, suite and source.
from audit_case_projection import FLOWS as PROJECTION_FLOWS

PROJECTION = LOGS / "projection"
shutil.rmtree(PROJECTION, ignore_errors=True)
PROJECTION.mkdir(parents=True)
projection_env = {
    "DW_PROJECTION_RUN": uuid.uuid4().hex,
    "DW_PROJECTION_SOURCE": hashlib.sha256(json.dumps(inputs, sort_keys=True).encode("utf-8")).hexdigest(),
}
results = []
with tempfile.TemporaryDirectory(prefix="madison-production-") as production:
    shutil.copytree(ROOT / "build/dist", Path(production) / "dist")
    build(True)
    try:
        suites = [
            *sorted((ROOT / "tests/unit").glob("audit_*.js")),
            ROOT / "tests/fixtures/tagcheck.js",
            *sorted((ROOT / "tests/unit").glob("audit_*.py")),
        ]

        def suite_env(suite):
            env = {**os.environ, "DW_PRODUCTION_DIR": str(Path(production) / "dist"), "PYTHONIOENCODING": "utf-8"}
            if suite.stem in PROJECTION_FLOWS:
                env.update(projection_env, DW_PROJECTION_CAPTURE=str(PROJECTION / (suite.stem + ".json")), DW_PROJECTION_SUITE=suite.stem)
            if suite.name == "audit_case_projection.py":
                env.update(projection_env, DW_PROJECTION_DIR=str(PROJECTION))
            return env

        def run_suite(suite):
            started = time.monotonic()
            try:
                run = subprocess.run(
                    [sys.executable if suite.suffix == ".py" else "node", str(suite.relative_to(ROOT))],
                    cwd=ROOT,
                    env=suite_env(suite),
                    capture_output=True,
                    text=True,
                    timeout=150,
                    encoding="utf-8",
                    errors="replace",
                )
                output, code = run.stdout + run.stderr, run.returncode
            except subprocess.TimeoutExpired:
                output, code = "FAIL suite exceeded 150 seconds\n", 124
            (LOGS / (suite.name + ".log")).write_text(output, encoding="utf-8")
            failed = code != 0 or bool(re.search(r"^\s*(?:FAIL\b|CRASH\b|[1-9][0-9]* (?:FAILURE|DATA ISSUE))", output, re.M))
            print(("FAIL " if failed else "PASS ") + suite.name, flush=True)
            return {
                "suite": suite.name,
                "passed": not failed,
                "exit_code": code,
                "elapsedMs": round((time.monotonic() - started) * 1000),
                "limitMs": 150000,
            }

        # Measured performance suites run last and alone; suites that launch Chromium run one at a time.
        # Everything else shares a small worker pool. Each suite keeps its own 150-second deadline.
        # The projection check reads the flows' captures, so it starts after the pool and runs beside the serial
        # Chromium suites.
        performance = [s for s in suites if "performance" in s.name]
        if MODE == "fast":
            print("FAST RUN: skipping measured performance suites " + ", ".join(s.name for s in performance), flush=True)
            suites = [s for s in suites if s not in performance]
            performance = []
        chromium = [s for s in suites if s not in performance and re.search(r"chromium|playwright|DW_BROWSER", s.read_text(encoding="utf-8"))]
        after_pool = [s for s in suites if s.name == "audit_case_projection.py"]
        pooled = [s for s in suites if s not in performance and s not in chromium and s not in after_pool]
        workers = int(os.environ.get("DW_TEST_WORKERS") or min(4, os.cpu_count() or 1))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            finished = dict(zip(pooled, pool.map(run_suite, pooled)))
        with ThreadPoolExecutor(max_workers=2) as pool:
            projection = [pool.submit(run_suite, suite) for suite in after_pool]
            for suite in chromium:
                finished[suite] = run_suite(suite)
            for suite, future in zip(after_pool, projection):
                finished[suite] = future.result()
        for suite in performance:
            finished[suite] = run_suite(suite)
        results = [finished[s] for s in suites]
    finally:
        build()
(LOGS / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
final_inputs = fingerprint(ROOT)
if inputs != final_inputs:
    changed = sorted(name for name in inputs.keys() | final_inputs.keys() if inputs.get(name) != final_inputs.get(name))
    raise SystemExit("Source changed during testing; rerun before packaging. Changed files: " + ", ".join(changed))
if any(not x["passed"] for x in results):
    raise SystemExit(1)
(LOGS / "evidence.json").write_text(
    json.dumps({"mode": MODE, "files": inputs, "resultsSha256": hashlib.sha256((LOGS / "results.json").read_bytes()).hexdigest()}, indent=2) + "\n",
    encoding="utf-8",
)
