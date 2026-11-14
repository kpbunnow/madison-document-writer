"""Targeted mutation pilot (plan Phase 1; diagnostic only, never gate or release evidence).

Usage: python tools/mutation_pilot.py [--out FILE] [--only ID ...]

Mutants are hand-seeded critical regressions listed in tools/mutation-pilot.json. The working tree is copied to a
temporary directory (tools/measure_coverage.copy_tree); this checkout is never mutated. The listed suites must pass
on the unmutated copy first. Each mutant is then applied alone (its exact text must occur once, else it is invalid),
the copy's test build is remade when browser code changed, its suites run, and the original text is restored.
A mutant is killed when any suite fails, survived when all pass, timeout when a suite exceeds the limit.
Survivors are reported with their category so each can be reviewed (missing test or equivalent mutant).
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from measure_coverage import copy_tree  # noqa: E402

TIMEOUT = 900


def environment(run):
    paths = [str(run / p) for p in ["helper", "tools", "policy", "tests/unit", "tests/fixtures", "build/generated"]]
    return {
        **os.environ,
        "PYTHONPATH": os.pathsep.join(paths),
        "DW_REPO_ROOT": str(run),
        "TZ": "America/Chicago",
        "PYTHONDONTWRITEBYTECODE": "1",
        "DW_TEST_BUILD": "1",
    }


def build(run, env):
    subprocess.run([sys.executable, "tools/build.py"], cwd=run, env=env, check=True, capture_output=True)


def run_suites(run, env, suites):
    """'passed', or the first failing suite's outcome."""
    for suite in suites:
        command = [sys.executable if suite.endswith(".py") else "node", "tests/unit/" + suite]
        try:
            result = subprocess.run(command, cwd=run, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=TIMEOUT)
        except subprocess.TimeoutExpired:
            return "timeout:" + suite
        if result.returncode:
            return "failed:" + suite
    return "passed"


def trial(run, env, mutant):
    target = run / mutant["file"]
    original = target.read_text(encoding="utf-8")
    if original.count(mutant["find"]) != 1:
        return {"outcome": "invalid", "detail": "mutation text does not occur exactly once"}
    started = time.monotonic()
    target.write_text(original.replace(mutant["find"], mutant["replace"]), encoding="utf-8")
    try:
        if mutant["file"].startswith("app/"):
            build(run, env)
        result = run_suites(run, env, mutant["suites"])
    finally:
        target.write_text(original, encoding="utf-8")
        if mutant["file"].startswith("app/"):
            build(run, env)
    outcome = "survived" if result == "passed" else "timeout" if result.startswith("timeout") else "killed"
    return {"outcome": outcome, "detail": result, "seconds": round(time.monotonic() - started, 1)}


def run_pilot(mutants):
    """Every mutant's result in a fresh copy whose listed suites first pass unmutated."""
    with tempfile.TemporaryDirectory(prefix="dw-mutation-") as temp:
        run = Path(temp)
        copy_tree(run)
        env = environment(run)
        build(run, env)
        suites = sorted({s for m in mutants for s in m["suites"]})
        broken = sorted(s for s in suites if run_suites(run, env, [s]) != "passed")
        results = []
        for mutant in mutants:
            if set(mutant["suites"]) & set(broken):
                results.append({"id": mutant["id"], "outcome": "invalid", "detail": "a listed suite fails without the mutation"})
            else:
                results.append({"id": mutant["id"], "category": mutant["category"], "file": mutant["file"], **trial(run, env, mutant)})
    return results, broken


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out")
    parser.add_argument("--only", nargs="*")
    args = parser.parse_args()
    pilot = json.loads((ROOT / "tools" / "mutation-pilot.json").read_text(encoding="utf-8"))
    results, broken = run_pilot([m for m in pilot["mutants"] if not args.only or m["id"] in args.only])
    counts = {o: sum(r["outcome"] == o for r in results) for o in ("killed", "survived", "timeout", "invalid")}
    applicable = counts["killed"] + counts["survived"]
    summary = {
        "commit": subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, encoding="utf-8").stdout.strip(),
        "counts": counts,
        "killRate": round(counts["killed"] / applicable, 4) if applicable else None,
        "baselineFailures": broken,
        "results": results,
    }
    text = json.dumps(summary, indent=1) + "\n"
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
