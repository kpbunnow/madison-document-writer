#!/usr/bin/env python3
"""CI-style local release gate. Evidence stays under build/verification/latest."""

import json
import os
from pathlib import Path
import subprocess
import sys
from release_evidence import fingerprint
from release_inputs import deployment_inputs, source_inventory

ROOT = Path(__file__).resolve().parents[1]
os.environ["DW_REPO_ROOT"] = str(ROOT)
os.environ["PYTHONDONTWRITEBYTECODE"] = "1"
os.environ["PYTHONPATH"] = os.pathsep.join(str(ROOT / p) for p in ["helper", "tools", "policy", "tests/unit", "tests/fixtures", "build/generated"])
OUT = ROOT / "build/verification/latest"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "verification.json").unlink(missing_ok=True)


def run(command, name, env=None):
    with (OUT / name).open("w", encoding="utf-8") as log:
        result = subprocess.run(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    if result.returncode:
        raise SystemExit("Verification failed. Read " + str(OUT / name))
    print("PASS " + name, flush=True)


run([sys.executable, "tools/check_format.py"], "format.log")
run([sys.executable, "tools/run_tests.py"], "regression.log")
source_inventory(ROOT)
source = fingerprint(ROOT)
run(["node", "tests/browser/audit_browser.js"], "browser.log", {**os.environ, "DW_QA_OUTPUT": str(OUT / "browser")})
final_source = fingerprint(ROOT)
if source != final_source:
    changed = sorted(name for name in source.keys() | final_source.keys() if source.get(name) != final_source.get(name))
    raise SystemExit("Source changed during verification; rerun. Changed files: " + ", ".join(changed))
checks = json.loads((ROOT / "build/test-results/results.json").read_text())
browser = json.loads((OUT / "browser/browser-results.json").read_text())
axe = json.loads((OUT / "browser/axe-results.json").read_text())
if not all(x["passed"] for x in checks) or not browser.get("passed") or not axe.get("passed"):
    raise SystemExit("Failed regression, browser or axe checks.")
(OUT / "verification.json").write_text(
    json.dumps(
        {
            "passed": True,
            "release": (ROOT / "build/generated/RELEASE").read_text().strip(),
            "suiteCount": len(checks),
            "axeScreens": len(axe["checks"]),
            "runtimeHashes": browser["runtimeHashes"],
            "sourceFiles": source,
            "deploymentInputs": deployment_inputs(ROOT),
        },
        indent=2,
    )
    + "\n"
)
from project_layout import fingerprint as maintained_fingerprint

(OUT / "repository.json").write_text(json.dumps({"passed": True, "files": maintained_fingerprint()}, indent=2) + "\n")
print("Verified release evidence: " + str(OUT))
