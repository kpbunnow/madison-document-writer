#!/usr/bin/env python3
"""Verify production modules, run regression fixtures, restore production output."""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from release_evidence import fingerprint

os.environ["TZ"] = "America/Chicago"
if hasattr(__import__("time"), "tzset"):
    __import__("time").tzset()
ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / p) for p in ["helper", "tools", "policy", "tests/unit", "tests/fixtures", "build/generated"]]
os.environ["DW_REPO_ROOT"] = str(ROOT)
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
os.environ["PYTHONPATH"] = os.pathsep.join(sys.path[:6])
browser_check = subprocess.run(["node", "tools/check_browser.cjs"], cwd=ROOT)
if browser_check.returncode:
    raise SystemExit(browser_check.returncode)
LOGS = ROOT / "build/test-results"
LOGS.mkdir(parents=True, exist_ok=True)
(LOGS / "results.json").write_text("[]\n")
(LOGS / "evidence.json").unlink(missing_ok=True)


def build(test=False):
    subprocess.run([sys.executable, "tools/build.py"], cwd=ROOT, env={**os.environ, "DW_TEST_BUILD": "1" if test else "0"}, check=True)


build()
subprocess.run(
    ["node", "node_modules/eslint/bin/eslint.js", "build/app.js", "build/reports.js", "app/assets/shared.js", "app/modules"], cwd=ROOT, check=True
)
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
subprocess.run([sys.executable, "-m", "pyflakes", *python_sources], cwd=ROOT, check=True)
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
(LOGS / "source-before-tests.json").write_text(json.dumps(inputs, indent=2) + "\n")
results = []
with tempfile.TemporaryDirectory(prefix="madison-production-") as production:
    import shutil

    shutil.copytree(ROOT / "build/dist", Path(production) / "dist")
    build(True)
    try:
        suites = [
            *sorted((ROOT / "tests/unit").glob("audit_*.js")),
            ROOT / "tests/fixtures/tagcheck.js",
            *sorted((ROOT / "tests/unit").glob("audit_*.py")),
        ]
        for suite in suites:
            if suite.name == "audit_browser.js":
                continue
            started = time.monotonic()
            try:
                run = subprocess.run(
                    [sys.executable if suite.suffix == ".py" else "node", str(suite.relative_to(ROOT))],
                    cwd=ROOT,
                    env={**os.environ, "DW_PRODUCTION_DIR": str(Path(production) / "dist")},
                    capture_output=True,
                    text=True,
                    timeout=150,
                )
                output, code = run.stdout + run.stderr, run.returncode
            except subprocess.TimeoutExpired:
                output, code = "FAIL suite exceeded 150 seconds\n", 124
            (LOGS / (suite.name + ".log")).write_text(output, encoding="utf-8")
            failed = code != 0 or bool(re.search(r"^\s*(?:FAIL\b|CRASH\b|[1-9][0-9]* (?:FAILURE|DATA ISSUE))", output, re.M))
            results.append(
                {
                    "suite": suite.name,
                    "passed": not failed,
                    "exit_code": code,
                    "elapsedMs": round((time.monotonic() - started) * 1000),
                    "limitMs": 150000,
                }
            )
            print(("FAIL " if failed else "PASS ") + suite.name, flush=True)
    finally:
        build()
(LOGS / "results.json").write_text(json.dumps(results, indent=2) + "\n")
final_inputs = fingerprint(ROOT)
if inputs != final_inputs:
    changed = sorted(name for name in inputs.keys() | final_inputs.keys() if inputs.get(name) != final_inputs.get(name))
    raise SystemExit("Source changed during testing; rerun before packaging. Changed files: " + ", ".join(changed))
if any(not x["passed"] for x in results):
    raise SystemExit(1)
(LOGS / "evidence.json").write_text(
    json.dumps({"files": inputs, "resultsSha256": hashlib.sha256((LOGS / "results.json").read_bytes()).hexdigest()}, indent=2) + "\n"
)
