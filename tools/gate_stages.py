"""Run full-coverage CI stages on separate machines and assemble source-bound release evidence.

Stage artifacts are inputs, never an assertion that the gate passed. The assembler rebuilds production output,
checks both complete artifacts against its own source/runtime/toolchain/run, and uses the normal release verifier.
"""

import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys

from project_layout import checked_file, staged_files, fingerprint as maintained_fingerprint
from release_evidence import fingerprint, source_provenance, verify
from release_inputs import source_inventory, deployment_inputs


def run_identity():
    run = os.environ.get("GITHUB_RUN_ID") if os.environ.get("GITHUB_ACTIONS") == "true" else os.environ.get("DW_GATE_RUN")
    if not run:
        raise ValueError("Isolated gate stages need GITHUB_RUN_ID or a shared fresh DW_GATE_RUN identifier")
    return {"run": run, "attempt": os.environ.get("GITHUB_RUN_ATTEMPT", "1")}


def toolchain(root):
    return {
        "python": sys.version.split()[0],
        "node": subprocess.check_output(["node", "--version"], encoding="utf-8").strip(),
        "playwright": json.loads((root / "node_modules/playwright/package.json").read_text(encoding="utf-8"))["version"],
        "browserSource": os.environ.get("DW_BROWSER") or "pinned-playwright",
        "platform": sys.platform,
        "architecture": platform.machine(),
    }


def runtime_hashes(root):
    return {
        name: hashlib.sha256((root / "build/dist" / name).read_bytes()).hexdigest()
        for name in ("madison-document-writer.html", "madison-reports.html")
    }


def browser_results(root):
    folder = root / "build/verification/latest/browser"
    browser = json.loads((folder / "browser-results.json").read_text(encoding="utf-8"))
    axe = json.loads((folder / "axe-results.json").read_text(encoding="utf-8"))
    if (
        browser.get("passed") is not True
        or browser.get("mode") != "full"
        or browser.get("productionBuild") is not True
        or browser.get("runtimeHashes") != runtime_hashes(root)
        or browser.get("release") != (root / "build/generated/RELEASE").read_text(encoding="utf-8").strip()
        or browser.get("errors") != []
        or browser.get("cspViolations") != []
        or axe.get("passed") is not True
        or not axe.get("checks")
        or any(c.get("violations") != [] for c in axe["checks"])
        or browser.get("axe") != axe["checks"]
    ):
        raise ValueError("Complete full-mode production browser and accessibility evidence must pass")
    return browser, axe


def payload_files(root, stage):
    build, out = root / "build", root / "build/verification/latest"
    folder = build / "test-results" if stage == "regression" else out / "browser"
    files = {str((folder / rel).relative_to(build).as_posix()): digest for rel, digest in staged_files(folder).items()} if folder.exists() else {}
    for name in (["format.log", "regression.log"] if stage == "regression" else ["build.log", "browser.log"]) + ["timings.json"]:
        path = out / name
        if path.exists():
            files[path.relative_to(build).as_posix()] = hashlib.sha256(
                checked_file(build, path.relative_to(build).as_posix()).read_bytes()
            ).hexdigest()
    return files


def seal_stage(root, stage, chromium):
    inputs = fingerprint(root)
    provenance = source_provenance(root, inputs)
    if provenance["sourceClean"] is False:
        raise ValueError("Isolated gate evidence requires a clean reviewed source tree")
    receipt = {
        "stage": stage,
        "mode": "full",
        "passed": True,
        "identity": run_identity(),
        "inputs": inputs,
        "provenance": provenance,
        "toolchain": {**toolchain(root), "chromium": chromium},
        "files": payload_files(root, stage),
    }
    relative = "verification/latest/stage-" + stage + ".json"
    (root / "build" / relative).write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    upload = root / "build/ci-upload"
    shutil.rmtree(upload, ignore_errors=True)
    for name in [*receipt["files"], relative]:
        source = checked_file(root / "build", name)
        destination = upload / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def execute_stage(root, runner, stage):
    run_identity()
    source = source_inventory(root)
    out = root / "build/verification/latest"
    if stage == "regression":
        shutil.rmtree(root / "build/test-results", ignore_errors=True)
        runner([sys.executable, "tools/check_format.py"], "format.log")
        runner([sys.executable, "tools/run_tests.py"], "regression.log")
        verify(root)
        matches = re.findall(r"^Usable Chromium: (.+)$", (out / "regression.log").read_text(encoding="utf-8"), re.M)
        if not matches:
            raise ValueError("Regression browser preflight did not record its actual version")
        chromium = matches[0]
    else:
        shutil.rmtree(out / "browser", ignore_errors=True)
        runner([sys.executable, "tools/build.py"], "build.log", {**os.environ, "DW_TEST_BUILD": "0"})
        inputs = fingerprint(root)
        runner(["node", "tests/browser/audit_browser.js"], "browser.log", {**os.environ, "DW_QA_OUTPUT": str(out / "browser")})
        if inputs != fingerprint(root):
            raise ValueError("Source or production runtime changed during browser verification")
        chromium = browser_results(root)[0]["browserVersion"]
    if source != source_inventory(root):
        raise ValueError("Source changed during isolated verification")
    seal_stage(root, stage, chromium)


def read_stage(folder, stage, inputs, provenance, expected_toolchain, identity):
    found = staged_files(folder)  # validate the root and hash regular files without following links
    relative = "verification/latest/stage-" + stage + ".json"
    receipt = json.loads(checked_file(folder, relative).read_text(encoding="utf-8"))
    common = {k: v for k, v in receipt.get("toolchain", {}).items() if k != "chromium"}
    if (
        receipt.get("stage") != stage
        or receipt.get("mode") != "full"
        or receipt.get("passed") is not True
        or receipt.get("identity") != identity
        or receipt.get("inputs") != inputs
        or receipt.get("provenance") != provenance
        or receipt.get("provenance", {}).get("sourceClean") is not provenance["sourceClean"]
        or common != expected_toolchain
        or not isinstance(receipt.get("toolchain", {}).get("chromium"), str)
        or not receipt["toolchain"]["chromium"]
        or not isinstance(receipt.get("files"), dict)
        or not receipt["files"]
    ):
        raise ValueError("Mismatched or incomplete " + stage + " stage evidence")
    found.pop(relative)
    if found != receipt["files"]:
        raise ValueError("Stage artifact files differ from their recorded bytes")
    required = (
        {"test-results/results.json", "test-results/evidence.json", "test-results/r50-print-compatibility.json"}
        if stage == "regression"
        else {
            "verification/latest/browser/" + name
            for name in ["browser-results.json", "axe-results.json", "environment.json", "screen-css-results.json"]
        }
    )
    logs = {
        "verification/latest/" + name
        for name in (["format.log", "regression.log"] if stage == "regression" else ["build.log", "browser.log"]) + ["timings.json"]
    }
    if not (required | logs) <= found.keys():
        raise ValueError("Missing required stage artifact files")
    prefix = "test-results/" if stage == "regression" else "verification/latest/browser/"
    for name in found:
        checked_file(folder, name)
        if not (name.startswith(prefix) or name in logs):
            raise ValueError("Unexpected stage artifact path: " + name)
    return receipt


def assemble(root, runner, regression, browser_folder):
    identity = run_identity()
    runner([sys.executable, "tools/build.py"], "assembly-build.log", {**os.environ, "DW_TEST_BUILD": "0"})
    source_inventory(root)
    inputs = fingerprint(root)
    provenance, common = source_provenance(root, inputs), toolchain(root)
    if provenance["sourceClean"] is False:
        raise ValueError("Cannot assemble gate evidence for changed source")
    regression_meta = read_stage(regression, "regression", inputs, provenance, common, identity)
    browser_meta = read_stage(browser_folder, "browser", inputs, provenance, common, identity)
    if regression_meta["toolchain"] != browser_meta["toolchain"]:
        raise ValueError("Gate stages used different browser/toolchain versions")
    shutil.rmtree(root / "build/test-results", ignore_errors=True)
    shutil.rmtree(root / "build/verification/latest/browser", ignore_errors=True)
    for folder, receipt in [(regression, regression_meta), (browser_folder, browser_meta)]:
        for relative in receipt["files"]:
            if relative == "verification/latest/timings.json":
                continue
            destination = root / "build" / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(checked_file(folder, relative), destination)
    verify(root)  # complete discovered suite list, results digest, source, production bytes and deployment inputs
    browser, axe = browser_results(root)
    if browser["browserVersion"] != browser_meta["toolchain"]["chromium"]:
        raise ValueError("Browser result version differs from the stage toolchain")
    if fingerprint(root) != inputs:
        raise ValueError("Source changed while assembling gate evidence")
    results = json.loads((root / "build/test-results/results.json").read_text(encoding="utf-8"))
    out = root / "build/verification/latest"
    timings = json.loads((out / "timings.json").read_text(encoding="utf-8"))["stages"]
    for name, folder in [("regression", regression), ("browser", browser_folder)]:
        stage_timings = json.loads(checked_file(folder, "verification/latest/timings.json").read_text(encoding="utf-8"))
        timings.extend({**row, "stage": name + "/" + row["stage"]} for row in stage_timings["stages"])
    (out / "timings.json").write_text(json.dumps({"mode": "full", "execution": "isolated", "stages": timings}, indent=2) + "\n", encoding="utf-8")
    result = {
        "passed": True,
        "mode": "full",
        "release": browser["release"],
        "suiteCount": len(results),
        "axeScreens": len(axe["checks"]),
        "runtimeHashes": browser["runtimeHashes"],
        "sourceFiles": inputs,
        "deploymentInputs": deployment_inputs(root),
        **provenance,
        "toolchain": {key: browser_meta["toolchain"][key] for key in ["python", "node", "chromium"]},
    }
    (out / "verification.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    (out / "repository.json").write_text(json.dumps({"passed": True, "files": maintained_fingerprint(root)}, indent=2) + "\n", encoding="utf-8")
    (out / "stage-evidence.json").write_text(
        json.dumps({"identity": identity, "regression": regression_meta, "browser": browser_meta}, indent=2) + "\n", encoding="utf-8"
    )
    print("Verified full gate from matching isolated stages: " + str(out), flush=True)
