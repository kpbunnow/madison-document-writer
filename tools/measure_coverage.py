"""Diagnostic statement and branch coverage for JavaScript and Python (plan Phase 1). Never gate, release or
acceptance evidence, and never mixed with production, performance or frozen-print verification.

Usage: python tools/measure_coverage.py [--out DIR] [--analysis-python PATH] [--suites NAME ...] [--workers N]

The working tree's tracked files are copied to a temporary directory, so instrumentation never touches this
checkout's build. There the test build is made with inline source maps (DW_COVERAGE_SOURCEMAPS) and every
non-browser unit suite runs once with both collectors:
- JavaScript: tools/coverage_js_preload.cjs (Node's built-in inspector; no new dependency) and
  tools/coverage_js_report.cjs;
- Python: coverage.py from the isolated analysis environment (tools/analysis-requirements.txt) with branch
  measurement, extended to Python subprocesses through a temporary sitecustomize.
Every maintained file is in the denominator whether or not it ran. Suites that may launch Chromium run afterwards,
serially; their Node and Python code is measured, but code executing inside the browser is not. Results go to
build/coverage/<commit>/ (coverage.json, SUMMARY.md).
"""

import argparse
import fnmatch
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ANALYSIS = ROOT.parent / "madison-runtime" / "analysis-venv" / "bin" / "python"
GROUPS = json.loads((ROOT / "tools" / "coverage-groups.json").read_text(encoding="utf-8"))
sys.path.insert(0, str(ROOT / "tools"))
import suite_classes  # noqa: E402


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, encoding="utf-8").stdout.strip()


def matching(files, patterns):
    return sorted(f for f in files if any(fnmatch.fnmatchcase(f, p) for p in patterns) and "/vendor/" not in f)


def copy_tree(dest):
    for name in git("ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0"):
        if name and (ROOT / name).is_file():
            target = dest / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, target)
    (dest / "node_modules").symlink_to(ROOT / "node_modules")
    # As tools/run_tests.py prepares it: suites write their result corpora here.
    (dest / "build" / "test-results").mkdir(parents=True, exist_ok=True)
    # Repository suites read git state; the copy is its own throwaway repository with the same content.
    quiet = {"cwd": dest, "check": True, "capture_output": True}
    subprocess.run(["git", "init", "-q", "-b", "coverage"], **quiet)
    subprocess.run(["git", "add", "-A"], **quiet)
    subprocess.run(["git", "-c", "user.name=coverage", "-c", "user.email=coverage@invalid", "commit", "-q", "-m", "coverage copy"], **quiet)


def analysis_site(analysis):
    return subprocess.run(
        [str(analysis), "-c", "import coverage, os; print(os.path.dirname(os.path.dirname(coverage.__file__)))"],
        capture_output=True,
        encoding="utf-8",
        check=True,
    ).stdout.strip()


def coverage_rc(run, aux):
    """coverage.py settings. Suites that copy the repository to a temporary source/ folder run the same files there;
    [paths] maps those copies back to this run's files so that execution is counted, not skipped."""
    remap = "".join(f"{part} =\n    {run / part}\n    */source/{part}\n" for part in ("helper", "tools", "policy"))
    return (
        f"[run]\nbranch = True\nparallel = True\nsource = {run / 'helper'},{run / 'tools'},{run / 'policy'}\n"
        f"omit = */vendor/*\ndata_file = {aux / 'data' / 'python'}\n\n[paths]\n{remap}"
    )


def environment(run, aux, analysis):
    """The run's environment: the gate's paths plus both collectors (coverage.py also starts in subprocesses).
    Collector files live beside the copy, never inside it, so repository-shape suites see the checkout's layout."""
    hook = aux / "hook"
    hook.mkdir(parents=True)
    (hook / "sitecustomize.py").write_text("import coverage\ncoverage.process_startup()\n", encoding="utf-8")
    (aux / "coveragerc").write_text(coverage_rc(run, aux), encoding="utf-8")
    (aux / "data").mkdir()
    paths = [
        str(hook),
        analysis_site(analysis),
        *(str(run / p) for p in ["helper", "tools", "policy", "tests/unit", "tests/fixtures", "build/generated"]),
    ]
    return {
        **os.environ,
        "PYTHONPATH": os.pathsep.join(paths),
        "COVERAGE_PROCESS_START": str(aux / "coveragerc"),
        "NODE_OPTIONS": (os.environ.get("NODE_OPTIONS", "") + " --require " + str(run / "tools/coverage_js_preload.cjs")).strip(),
        "DW_JS_COVERAGE_DIR": str(aux / "data" / "js"),
        "DW_COVERAGE_SOURCEMAPS": "1",
        "DW_REPO_ROOT": str(run),
        "DW_TEST_BUILD": "1",
        "TZ": "America/Chicago",
        "PYTHONDONTWRITEBYTECODE": "1",
    }


def build(run, env):
    built = subprocess.run([sys.executable, "tools/build.py"], cwd=run, env=env, capture_output=True, encoding="utf-8")
    if built.returncode:
        raise SystemExit("Coverage build failed:\n" + (built.stderr or built.stdout)[-3000:])


def run_suite(run, env, suite):
    command = [sys.executable if suite.suffix == ".py" else "node", str(suite.relative_to(run))]
    started = time.monotonic()
    try:
        result = subprocess.run(command, cwd=run, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=1800)
        status = "passed" if result.returncode == 0 else "failed"
    except subprocess.TimeoutExpired:
        status = "timeout"
    return {"suite": suite.name, "status": status, "seconds": round(time.monotonic() - started, 1)}


def ratio(part, whole):
    return round(part / whole, 4) if whole else None


def summarize(files, per_file):
    rows = [per_file[f] for f in files if f in per_file]
    total = {key: sum(r[key] for r in rows) for key in ("statements", "coveredStatements", "branches", "coveredBranches")}
    return {
        "files": len(files),
        "unexecutedFiles": sorted(f for f in files if not per_file.get(f, {}).get("executed")),
        **total,
        "statementRate": ratio(total["coveredStatements"], total["statements"]),
        "branchRate": ratio(total["coveredBranches"], total["branches"]),
    }


def coverage_command(analysis, run, env, args):
    done = subprocess.run([str(analysis), "-m", "coverage", *args], cwd=run, env=env, capture_output=True, encoding="utf-8")
    if done.returncode:
        raise SystemExit("coverage " + args[0] + " failed:\n" + (done.stderr or done.stdout)[-3000:])
    return [line for line in done.stderr.splitlines() if line.strip()]


def python_files(run, aux, analysis, env):
    data = aux / "data"
    rc = ["--rcfile", str(aux / "coveragerc")]
    coverage_command(analysis, run, env, ["combine", *rc, "--keep", str(data)])
    out = aux / "python-coverage.json"
    # A suite may record a temporary module that no longer exists; such files are skipped and named in the report.
    warnings = coverage_command(analysis, run, env, ["json", "--ignore-errors", *rc, "--data-file", str(data / "python"), "-o", str(out)])
    files = {}
    for name, entry in json.loads(out.read_text(encoding="utf-8"))["files"].items():
        s = entry["summary"]
        rel = os.path.relpath(name, run) if os.path.isabs(name) else name
        files[rel.replace(os.sep, "/")] = {
            "statements": s["num_statements"],
            "coveredStatements": s["covered_lines"],
            "branches": s.get("num_branches", 0),
            "coveredBranches": s.get("covered_branches", 0),
            "executed": s["covered_lines"] > 0,
            "uncoveredLines": entry["missing_lines"],
        }
    files["__warnings__"] = warnings
    return files


def report_groups(per_file, groups, language):
    every = sorted(per_file)
    return {name: summarize(matching(every, patterns), per_file) for name, patterns in groups.items()} | {"language": language}


def prepare(run, aux, analysis):
    """The instrumented copy: both collectors, then the production and test builds as the gate makes them."""
    copy_tree(run)
    env = environment(run, aux, analysis)
    build(run, {**env, "DW_TEST_BUILD": "0"})
    shutil.copytree(run / "build" / "dist", aux / "production")
    build(run, env)
    env["DW_PRODUCTION_DIR"] = str(aux / "production")
    return env


def run_suites(run, env, names, workers):
    suites = sorted((run / "tests/unit").glob("audit_*.js")) + sorted((run / "tests/unit").glob("audit_*.py"))
    if names:
        suites = [s for s in suites if s.name in set(names)]
    browser = [s for s in suites if suite_classes.uses_browser(s)]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(lambda s: run_suite(run, env, s), [s for s in suites if s not in browser]))
    # Suites that may launch Chromium run afterwards, one at a time, as the gate keeps browser work serial. Their Node
    # and Python code is measured; code executing inside the browser is not.
    results += [run_suite(run, env, s) for s in browser]
    return {"run": results, "serialBrowserClass": sorted(s.name for s in browser)}


def javascript_files(run, aux, env):
    scope = matching([str(p.relative_to(run)) for p in (run / "app").rglob("*.js")], GROUPS["javascript"]["runtime"])
    command = ["node", "tools/coverage_js_report.cjs", str(aux / "data" / "js"), str(run), *scope]
    plain = {k: v for k, v in env.items() if k != "NODE_OPTIONS"}
    return json.loads(subprocess.run(command, cwd=run, capture_output=True, encoding="utf-8", check=True, env=plain).stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out")
    parser.add_argument("--analysis-python", default=os.environ.get("DW_ANALYSIS_PYTHON", str(DEFAULT_ANALYSIS)))
    parser.add_argument("--suites", nargs="*", help="limit to these suite file names (diagnostic runs)")
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()
    analysis = Path(args.analysis_python)
    commit = git("rev-parse", "HEAD")
    with tempfile.TemporaryDirectory(prefix="dw-coverage-") as temp:
        run, aux = Path(temp) / "repo", Path(temp) / "aux"
        run.mkdir()
        env = prepare(run, aux, analysis)
        suites = run_suites(run, env, args.suites, args.workers)
        js, py = javascript_files(run, aux, env), python_files(run, aux, analysis, env)
        py_warnings = py.pop("__warnings__")
    result = {
        "source": {"commit": commit, "tree": git("rev-parse", "HEAD^{tree}"), "clean": not git("status", "--porcelain")},
        "method": __doc__,
        "suites": suites,
        "javascript": {"groups": report_groups(js, GROUPS["javascript"], "javascript"), "files": js},
        "python": {"groups": report_groups(py, GROUPS["python"], "python"), "files": py, "reportWarnings": py_warnings},
        "targets": GROUPS["targets"],
        "notMeasured": ["Code executing inside Chromium (browser suites and production-page workflows)", "Developer JavaScript in tools/*.cjs"],
    }
    out = Path(args.out) if args.out else ROOT / "build" / "coverage" / commit[:12]
    out.mkdir(parents=True, exist_ok=True)
    (out / "coverage.json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")
    (out / "SUMMARY.md").write_text(markdown(result) + "\n", encoding="utf-8")
    print(out / "SUMMARY.md")


def rate(value):
    return "n/a" if value is None else f"{value:.1%}"


def markdown(r):
    lines = ["# Coverage (diagnostic)", "", f"Source {r['source']['commit']}, clean: {r['source']['clean']}.", ""]
    failed = [x["suite"] for x in r["suites"]["run"] if x["status"] != "passed"]
    lines.append(
        f"Suites run {len(r['suites']['run'])}, {len(r['suites']['serialBrowserClass'])} of them browser-class and serial "
        f"(not passing under instrumentation: {', '.join(failed) or 'none'})."
    )
    lines.append("")
    lines += ["| Language | Group | Files (unexecuted) | Statements | Branches |", "| --- | --- | ---: | ---: | ---: |"]
    for language in ("javascript", "python"):
        for name, g in r[language]["groups"].items():
            if name == "language":
                continue
            lines.append(
                f"| {language} | {name} | {g['files']} ({len(g['unexecutedFiles'])}) | {g['coveredStatements']}/{g['statements']} = {rate(g['statementRate'])} | {g['coveredBranches']}/{g['branches']} = {rate(g['branchRate'])} |"
            )
    lines += ["", "Not measured: " + "; ".join(r["notMeasured"]) + "."]
    return "\n".join(lines)


if __name__ == "__main__":
    main()
