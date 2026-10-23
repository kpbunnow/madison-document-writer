"""Bind in-place suite evidence to maintained source and production bytes."""

import hashlib
import json
from pathlib import Path
from project_layout import fingerprint as maintained_fingerprint


def fingerprint(root):
    root = Path(root)
    files = maintained_fingerprint(root)
    for p in sorted((root / "build/dist").glob("*.html")):
        files[p.relative_to(root).as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()
    if (root / "build/generated/runtime-manifest.json").is_file():
        from release_inputs import deployment_inputs

        for value in deployment_inputs(root).values():
            files[value["source"]] = value["sha256"]
    return files


def verify(root):
    root = Path(root)
    results = json.loads((root / "build/test-results/results.json").read_text(encoding="utf-8"))
    evidence = json.loads((root / "build/test-results/evidence.json").read_text(encoding="utf-8"))
    if evidence.get("mode") != "full":
        raise ValueError("Packaging needs full-gate test evidence; fast or unlabelled evidence is never packaged.")
    expected = sorted([p.name for p in (root / "tests/unit").glob("audit_*") if p.suffix in {".js", ".py"}] + ["tagcheck.js"])
    if not results or sorted(r["suite"] for r in results) != expected or not all(r.get("passed") is True for r in results):
        raise ValueError("The complete regression suite must pass before packaging.")
    if (
        evidence.get("files") != fingerprint(root)
        or evidence.get("resultsSha256") != hashlib.sha256((root / "build/test-results/results.json").read_bytes()).hexdigest()
    ):
        raise ValueError("Source, runtime or results changed after testing. Run tools/run_tests.py again.")
