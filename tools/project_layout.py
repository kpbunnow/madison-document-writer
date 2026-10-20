"""Maintained source ownership and version validation without a staging layer."""

from pathlib import Path
import hashlib, json, re, shutil

ROOT = Path(__file__).resolve().parents[1]
EXCLUDES = {".rsync-tmp", ".ruff_cache", "node_modules", "build", "dist", ".git", "archive", ".hypothesis", "__pycache__"}


def fingerprint(root=ROOT):
    root = Path(root)
    return {
        p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(root.rglob("*"))
        if p.is_file() and not any(x in EXCLUDES for x in p.relative_to(root).parts) and p.suffix != ".pyc"
    }


def version():
    v = json.loads((ROOT / "version.json").read_text())
    for name in ["package.json", "package-lock.json"]:
        value = json.loads((ROOT / name).read_text())
        if value["version"] != v["helperVersion"] or name == "package-lock.json" and value["packages"][""]["version"] != v["helperVersion"]:
            raise ValueError(name + " disagrees with version.json; run tools/sync_version.py")
    if type(v.get("helperBuild")) is not int or v["helperBuild"] != int(v["helperVersion"].split(".")[-1]):
        raise ValueError("helperBuild disagrees with version.json helperVersion")
    consumers = [
        ("summaryVersion", "app/assets/shared.js", r"const\s+SUMMARY_VERSION\s*=\s*(\d+)"),
        ("caseSchema", "app/modules/app_core.js", r"const\s+SCHEMA\s*=\s*(\d+)"),
        ("backupVersion", "app/modules/draft_recovery.js", r'format\s*:\s*[\'"]madison-workspace-backup[\'"]\s*,\s*version\s*:\s*(\d+)'),
        ("authoringVersion", "app/modules/inspection_import.js", r"authoringVersion\s*:\s*(\d+)"),
    ]
    for key, name, pattern in consumers:
        found = re.search(pattern, (ROOT / name).read_text())
        if not found or int(found[1]) != v[key]:
            raise ValueError(name + " disagrees with version.json " + key)
    return v


def assemble_deploy(destination):
    """Assemble installed output only; never create a copied source tree."""
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / "build/generated/runtime-manifest.json").read_text())
    for target, relative in manifest["deploy"].items():
        source = ROOT / relative
        if not source.is_file() or relative.startswith("archive/"):
            raise ValueError("Missing or forbidden deployment input: " + relative)
        path = destination / target
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, path)
    shutil.copytree(ROOT / "helper/vendor", destination / "vendor", dirs_exist_ok=True, ignore=shutil.ignore_patterns("site", "__pycache__", "*.pyc"))
    return manifest
