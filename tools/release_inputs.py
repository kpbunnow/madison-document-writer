"""Explicit source ownership and exact deployment bytes, shared by gate and packager."""

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit
from project_layout import checked_file, fingerprint, forbidden_source


def source_inventory(root):
    root = Path(root)
    value = json.loads(checked_file(root, "tools/source-inventory.json").read_text())
    names = value["files"]
    if value.get("format") != "madison-source-inventory" or value.get("version") != 1 or not isinstance(names, list):
        raise ValueError("Invalid source inventory")
    if names != sorted(set(names)) or any(forbidden_source(n) for n in names):
        raise ValueError("Duplicate, unsorted or forbidden source inventory entry")
    for name in names:
        checked_file(root, name)
    actual = fingerprint(root)
    if set(actual) != set(names):
        raise ValueError("Source inventory differs; review added/removed maintained files: " + ", ".join(sorted(set(actual) ^ set(names))))
    return actual


def deployment_inputs(root):
    root = Path(root)
    manifest = json.loads(checked_file(root, "build/generated/runtime-manifest.json").read_text())
    result = {}
    for target, relative in manifest["deploy"].items():
        if forbidden_source(relative) and not relative.startswith(("build/generated/", "build/dist/")):
            raise ValueError("Forbidden deployment input: " + relative)
        checked_file(root, relative)
        # Validate the installed path as well, without following any existing destination.
        if not target or "\\" in target or ":" in target or target.startswith("/") or any(x in {"", ".", ".."} for x in target.split("/")):
            raise ValueError("Invalid deployment target: " + target)
        result["deploy/" + target] = relative
    vendor = root / "helper/vendor"
    # fingerprint rejects linked directories and skips only known local caches.
    for relative in fingerprint(vendor):
        result["deploy/vendor/" + relative] = "helper/vendor/" + relative
    release = manifest["release"].split()[-1]
    result[release + "-REVIEW.md"] = "docs/developer/" + release + "-REVIEW.md"
    for suffix in ("ACCEPTANCE-RECORD", "PRODUCTION-READINESS"):
        name = release + "-" + suffix + ".md"
        result[name] = "build/generated/release-docs/" + name
    return {
        target: {"source": source, "sha256": hashlib.sha256(checked_file(root, source).read_bytes()).hexdigest()}
        for target, source in sorted(result.items())
    }


def verify_deployment(root, expected, staged=None, finalized=False):
    if not expected or deployment_inputs(root) != expected:
        raise ValueError("Deployment inputs changed after verification; rerun the full gate")
    if staged is None:
        return
    staged = Path(staged)
    wanted = {name.removeprefix("deploy/") for name in expected if name.startswith("deploy/")}
    found = {p.relative_to(staged / "deploy").as_posix() for p in (staged / "deploy").rglob("*") if p.is_file() or p.is_symlink()}
    if found != wanted:
        raise ValueError("Staged deployment file set differs from verified inputs")
    for target, value in expected.items():
        path = checked_file(staged, target)
        if finalized and target == "deploy/runtime-manifest.json":
            original = json.loads(checked_file(root, value["source"]).read_text())
            actual = json.loads(path.read_text())
            actual.pop("files", None)
            if actual != original:
                raise ValueError("Staged runtime manifest identity changed")
        elif hashlib.sha256(path.read_bytes()).hexdigest() != value["sha256"]:
            raise ValueError("Staged input differs from verified bytes: " + target)


def verify_source_copy(root, staged):
    expected = source_inventory(root)
    actual = fingerprint(staged)
    if actual != expected:
        raise ValueError("Staged source differs from the maintained inventory")


def verify_package_links(staged, documents):
    staged = Path(staged)
    for document in documents:
        for link in re.findall(r"\]\(([^)]+)\)", checked_file(staged, document).read_text()):
            url = urlsplit(link)
            if not url.scheme and url.path:
                checked_file(staged, unquote(url.path))


if __name__ == "__main__":
    import argparse
    import subprocess
    from project_layout import ROOT

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--update-source-inventory", action="store_true", required=True)
    parser.parse_args()
    # Review/stage additions and deletions first; never infer ownership from untracked files.
    names = sorted(subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().rstrip("\0").split("\0"))
    if any(forbidden_source(n) for n in names):
        raise SystemExit("Tracked local/operational file refused; review Git's staged paths")
    for name in names:
        checked_file(ROOT, name)
    (ROOT / "tools/source-inventory.json").write_text(
        json.dumps({"format": "madison-source-inventory", "version": 1, "files": names}, indent=2) + "\n"
    )
