"""Reproducible maintainability measurement bound to the exact source (diagnostic only; never gate or release evidence).

Usage: python tools/measure_maintainability.py [--out DIR] [--analysis-python PATH]

Writes metrics.json and SUMMARY.md to DIR (default build/maintainability/<commit>). The JavaScript scope is
app/modules/*.js and app/assets/shared.js; the Python scope is helper/*.py (runtime) and tools/*.py and policy/*.py
(developer tools), excluding helper/vendor. JavaScript uses the ESLint ratchet's function owners
(tools/maintainability_js.cjs). Python complexity is Radon, run with the isolated interpreter from
tools/analysis-requirements.txt; Ruff C901 is reported separately and never mixed with Radon. The comparable Radon
series is the radon CLI's flat function list (`radon cc -j`), as in the 2026-11-14 assessment; the complete series
adds every class method and closure.
"""

import argparse
import hashlib
import json
import os
import statistics
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ANALYSIS = ROOT.parent / "madison-runtime" / "analysis-venv" / "bin" / "python"


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, encoding="utf-8").stdout.strip()


SCOPE_AT = None  # set by --scope-commit: only files tracked at that commit are measured


def in_scope(files):
    if not SCOPE_AT:
        return sorted(files)
    tracked = set(git("ls-tree", "-r", "--name-only", SCOPE_AT).splitlines())
    return sorted(f for f in files if f in tracked)


def python_scope():
    groups = {"runtime": ["helper"], "developer": ["tools", "policy"]}
    return {
        group: in_scope(str(p.relative_to(ROOT)) for folder in folders for p in (ROOT / folder).glob("*.py")) for group, folders in groups.items()
    }


def digest(files):
    total = hashlib.sha256()
    per = {}
    for file in sorted(files):
        data = (ROOT / file).read_bytes()
        per[file] = hashlib.sha256(data).hexdigest()
        total.update(file.encode() + b"\0" + per[file].encode() + b"\n")
    return total.hexdigest(), per


def run_json(command, env=None):
    result = subprocess.run(command, cwd=ROOT, capture_output=True, encoding="utf-8", env=env)
    if result.returncode:
        raise SystemExit("Measurement command failed: " + " ".join(map(str, command)) + "\n" + result.stderr[-4000:])
    return json.loads(result.stdout)


def tool_versions(analysis):
    def out(command):
        return subprocess.run(command, cwd=ROOT, capture_output=True, encoding="utf-8").stdout.strip().splitlines()[0]

    package = lambda name: json.loads((ROOT / "node_modules" / name / "package.json").read_text(encoding="utf-8"))["version"]
    return {
        "node": out(["node", "--version"]),
        "eslint": package("eslint"),
        "typescript": package("typescript"),
        "python": sys.version.split()[0],
        "ruff": out([sys.executable, "-m", "ruff", "--version"]),
        "analysisPython": out([str(analysis), "--version"]),
        "radon": out([str(analysis), "-m", "radon", "--version"]),
    }


def distribution(values, cut):
    buckets = {"1-5": 0, "6-10": 0, "11-15": 0, "16-20": 0, "21+": 0}
    for v in values:
        key = "1-5" if v <= 5 else "6-10" if v <= 10 else "11-15" if v <= 15 else "16-20" if v <= 20 else "21+"
        buckets[key] += 1
    return {
        "count": len(values),
        "above10": sum(v > 10 for v in values),
        "above15": sum(v > 15 for v in values),
        "above20": sum(v > cut for v in values),
        "max": max(values, default=0),
        "buckets": buckets,
    }


def file_summary(rows, key, weight):
    values = [r[key] for r in rows]
    weights = [max(r[weight], 1) for r in rows]
    return {
        "files": len(rows),
        "mean": round(statistics.mean(values), 2) if values else 0,
        "median": round(statistics.median(values), 2) if values else 0,
        "sizeWeighted": round(sum(v * w for v, w in zip(values, weights)) / sum(weights), 2) if values else 0,
    }


def radon_cli_series(analysis, files):
    raw = run_json([str(analysis), "-m", "radon", "cc", "-j", *files])
    series = []
    for file, blocks in raw.items():
        if isinstance(blocks, dict):
            raise SystemExit("radon cc could not read " + file + ": " + str(blocks))
        for block in blocks:
            if block["type"] in ("function", "method"):
                name = (block["classname"] + "." if block.get("classname") else "") + block["name"]
                series.append({"file": file, "name": name, "line": block["lineno"], "complexity": block["complexity"]})
    return series


def ruff_c901(files):
    result = subprocess.run(
        [sys.executable, "-m", "ruff", "check", "--select", "C901", "--output-format", "json", *files],
        cwd=ROOT,
        capture_output=True,
        encoding="utf-8",
    )
    if result.returncode not in (0, 1):
        raise SystemExit(result.stderr)
    return [{"file": f["filename"].replace(str(ROOT) + os.sep, ""), "message": f["message"]} for f in json.loads(result.stdout)]


def python_group(cli, complete, members):
    members = set(members)
    rows = [r for r in complete["files"] if r["file"] in members]
    return {
        "radonCli": distribution([f["complexity"] for f in cli if f["file"] in members], 20),
        "radonComplete": distribution([f["complexity"] for f in complete["functions"] if f["file"] in members], 20),
        "mi": {**file_summary(rows, "mi", "sloc"), "zero": sorted(r["file"] for r in rows if r["mi"] == 0)},
        "sloc": sum(r["sloc"] for r in rows),
    }


def python_metrics(analysis):
    scope = python_scope()
    files = scope["runtime"] + scope["developer"]
    complete = run_json([str(analysis), "tools/maintainability_py.py", str(ROOT), *files])
    cli = radon_cli_series(analysis, files)
    group = {f: g for g, fs in scope.items() for f in fs}
    out = {"scope": {g: len(fs) for g, fs in scope.items()}, "compatibility": complete["compatibility"], "ruffC901": len(ruff_c901(files))}
    out["combined"] = python_group(cli, complete, files)
    out.update({name: python_group(cli, complete, members) for name, members in scope.items()})
    out["worstFunctions"] = sorted(cli, key=lambda f: -f["complexity"])[:25]
    out["worstFiles"] = sorted(complete["files"], key=lambda r: r["mi"])[:15]
    out["functions"] = {"radonCli": cli, "complete": complete["functions"]}
    out["files"] = [{**r, "group": group[r["file"]]} for r in complete["files"]]
    return out


def metric(functions, name):
    return {key: m[name] for key, m in functions.items() if name in m}


def js_metrics():
    data = run_json(["node", "tools/maintainability_js.cjs"], env={**os.environ, "DW_PYTHON": sys.executable})
    complexity, lines, depth = (metric(data["functions"], name) for name in ("complexity", "lines", "depth"))
    data["summary"] = {
        "complexity": distribution(list(complexity.values()), 20),
        "longFunctionsAbove80": sorted(k for k, v in lines.items() if v > 80),
        "nestingAbove4": sorted(k for k, v in depth.items() if v > 4),
        "maxNesting": max(depth.values(), default=0),
        "maxLines": max(lines.values(), default=0),
        "fileLogicLines": file_summary(data["files"], "logicLines", "logicLines"),
        "worstFunctions": sorted(complexity.items(), key=lambda x: -x[1])[:25],
    }
    return data


def markdown(m):
    js, py, s = m["javascript"], m["python"], m["source"]
    c = js["summary"]["complexity"]
    rows = [
        "# Maintainability measurement",
        "",
        f"Source {s['commit']} (tree {s['tree']}), clean: {s['clean']}. Identity {s['identity']}.",
        f"Input digest {s['inputDigest']}. Tools: {json.dumps(m['tools'])}.",
        "",
        "Diagnostic only; never gate or release evidence.",
        "",
        "## JavaScript (app/modules, app/assets/shared.js)",
        "",
        f"- Files {js['scope']['files']}, logic lines {js['scope']['logicLines']}; functions measured {c['count']}.",
        f"- Complexity: above 10: {c['above10']}; above 20: {c['above20']}; max {c['max']}; buckets {c['buckets']}.",
        f"- Functions above 80 nonblank/noncomment lines: {len(js['summary']['longFunctionsAbove80'])}; nesting above 4: {len(js['summary']['nestingAbove4'])} (max {js['summary']['maxNesting']}).",
        f"- Import cycles: {len(js['cycles'])}. Service-area references: {js['serviceAreas']['occurrences']} over {js['serviceAreas']['pairs']} directional pairs.",
        "- Whole-app evaluators: " + ", ".join(f"{k} {len(v)}" for k, v in js["testSeams"]["classes"].items()) + ".",
        f"- Type-checked files: {len(js['checkedCode']['files'])} ({js['checkedCode']['logicLines']} logic lines, {js['checkedCode']['share']:.2%} of scope).",
        "",
        "## Python (helper runtime; tools and policy developer)",
        "",
    ]
    for name in ("combined", "runtime", "developer"):
        g = py[name]
        rows.append(
            f"- {name}: Radon CLI series {g['radonCli']['count']} functions, above 10: {g['radonCli']['above10']}, above 20: {g['radonCli']['above20']}, max {g['radonCli']['max']}; "
            f"complete series {g['radonComplete']['count']}, above 10: {g['radonComplete']['above10']}; MI mean {g['mi']['mean']}, median {g['mi']['median']}, "
            f"size-weighted {g['mi']['sizeWeighted']}; MI zero: {', '.join(g['mi']['zero']) or 'none'}."
        )
    rows += ["", f"- Ruff C901 findings above 10 (separate tool): {py['ruffC901']}.", f"- Analyzer compatibility: {py['compatibility']}.", ""]
    rows += [
        "### Worst Python functions (Radon CLI series)",
        "",
        *[f"- {f['file']}:{f['name']} — {f['complexity']}" for f in py["worstFunctions"][:12]],
        "",
    ]
    rows += ["### Worst JavaScript functions", "", *[f"- {k} — {v}" for k, v in js["summary"]["worstFunctions"][:12]], ""]
    return "\n".join(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out")
    parser.add_argument("--analysis-python", default=os.environ.get("DW_ANALYSIS_PYTHON", str(DEFAULT_ANALYSIS)))
    parser.add_argument("--scope-commit", help="measure only files tracked at this commit (for a baseline series)")
    args = parser.parse_args()
    global SCOPE_AT
    SCOPE_AT = args.scope_commit
    analysis = Path(args.analysis_python)
    if not analysis.exists():
        raise SystemExit("Install the analysis environment first (see tools/analysis-requirements.txt): " + str(analysis))
    commit = git("rev-parse", "HEAD")
    js_files = in_scope([str(p.relative_to(ROOT)) for p in (ROOT / "app/modules").glob("*.js")] + ["app/assets/shared.js"])
    scope = python_scope()
    total, per = digest(js_files + scope["runtime"] + scope["developer"])
    version = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    metrics = {
        "source": {
            "commit": commit,
            "tree": git("rev-parse", "HEAD^{tree}"),
            "clean": not git("status", "--porcelain"),
            "scopeCommit": SCOPE_AT and git("rev-parse", SCOPE_AT),
            "identity": {k: version[k] for k in version if not isinstance(version[k], (dict, list))},
            "inputDigest": total,
            "inputs": per,
        },
        "tools": tool_versions(analysis),
        "javascript": js_metrics(),
        "python": python_metrics(analysis),
    }
    out = Path(args.out) if args.out else ROOT / "build" / "maintainability" / commit[:12]
    out.mkdir(parents=True, exist_ok=True)
    (out / "metrics.json").write_text(json.dumps(metrics, indent=1) + "\n", encoding="utf-8")
    (out / "SUMMARY.md").write_text(markdown(metrics) + "\n", encoding="utf-8")
    print(out / "SUMMARY.md")


if __name__ == "__main__":
    main()
