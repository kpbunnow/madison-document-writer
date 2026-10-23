"""Maintained source ownership and version validation without a staging layer."""

from pathlib import Path
import hashlib, json, os, re, shutil, stat

ROOT = Path(__file__).resolve().parents[1]
EXCLUDES = {".rsync-tmp", ".ruff_cache", "node_modules", "build", "dist", ".git", "archive", ".hypothesis", "__pycache__"}
LOCAL_DIRS = {
    ".venv",
    "venv",
    ".cache",
    ".pytest_cache",
    ".mypy_cache",
    "playwright-report",
    "test-results",
    "site",
    ".aws",
    ".ssh",
    ".azure",
    ".gnupg",
    ".config",
    ".secrets",
}
OPERATIONAL = {
    "Case JSON Files",
    "Reporting Index",
    "Reporting GIS",
    "Documents To Be Mailed And Recorded",
    "Case Lookup",
    "Orders",
    "outbox",
    "_integrity",
    "logs",
}


def forbidden_source(relative):
    p = Path(relative)
    excluded = {x.casefold() for x in EXCLUDES | LOCAL_DIRS | OPERATIONAL}
    return (
        any(x.casefold() in excluded for x in p.parts)
        or any(x.casefold() == ".env" or x.casefold().startswith(".env.") and x.casefold() != ".env.example" for x in p.parts)
        or p.name.casefold()
        in {
            "credentials.json",
            "secrets.json",
            "id_rsa",
            "id_dsa",
            "id_ecdsa",
            "id_ed25519",
            "share.txt",
            "integrity-settings.json",
            "case-lookup-settings.json",
            ".helper-session.json",
        }
        or p.suffix.lower() in {".pyc", ".key", ".pem", ".p12", ".pfx", ".p8", ".jks"}
    )


def checked_file(root, relative):
    """Refuse traversal, links and Windows reparse points before reading an input."""
    p = Path(relative)
    if not relative or "\\" in relative or ":" in relative or p.is_absolute() or any(x in {"", ".", ".."} for x in relative.split("/")):
        raise ValueError("Invalid input path: " + relative)
    current = Path(root)
    for part in p.parts:
        current = current / part
        info = current.lstat()
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
            raise ValueError("Linked input refused: " + relative)
    if not current.is_file():
        raise ValueError("Missing input file: " + relative)
    return current


def staged_files(root):
    """Every file under a staging folder, with no exclusions, refusing links, reparse points and special files."""
    root = Path(root)
    info = root.lstat()
    if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400 or not stat.S_ISDIR(info.st_mode):
        raise ValueError("Linked staging folder refused: " + str(root))
    files = {}
    for current, directories, names in os.walk(root, followlinks=False):
        folder = Path(current)
        for name in sorted(directories + names):
            candidate = folder / name
            relative = candidate.relative_to(root).as_posix()
            info = candidate.lstat()
            if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
                raise ValueError("Linked staged file refused: " + relative)
            if name in names:
                if not stat.S_ISREG(info.st_mode):
                    raise ValueError("Special staged file refused: " + relative)
                files[relative] = hashlib.sha256(candidate.read_bytes()).hexdigest()
    return dict(sorted(files.items()))


def fingerprint(root=ROOT):
    root = Path(root)
    info = root.lstat()
    if root.is_symlink() or getattr(info, "st_file_attributes", 0) & 0x400:
        raise ValueError("Linked source root refused: " + str(root))
    files = {}
    for current, directories, names in os.walk(root, followlinks=False):
        folder = Path(current)
        directories[:] = sorted(n for n in directories if not forbidden_source((folder / n).relative_to(root)))
        for name in directories:
            candidate = folder / name
            info = candidate.lstat()
            if candidate.is_symlink() or getattr(info, "st_file_attributes", 0) & 0x400:
                raise ValueError("Linked source directory refused: " + str(candidate.relative_to(root)))
        for name in sorted(names):
            relative = (folder / name).relative_to(root).as_posix()
            if relative != "SHA256SUMS.txt" and not forbidden_source(relative):
                files[relative] = hashlib.sha256(checked_file(root, relative).read_bytes()).hexdigest()
    return dict(sorted(files.items()))


def package_name(release):
    """The release-package base name: the release label with its space replaced, as packaged and documented."""
    return "Madison-Building-Inspection-" + release.replace(" ", "-")


def version():
    v = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    for name in ["package.json", "package-lock.json"]:
        value = json.loads((ROOT / name).read_text(encoding="utf-8"))
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
        found = re.search(pattern, (ROOT / name).read_text(encoding="utf-8"))
        if not found or int(found[1]) != v[key]:
            raise ValueError(name + " disagrees with version.json " + key)
    return v


def assemble_deploy(destination):
    """Assemble installed output only; never create a copied source tree."""
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / "build/generated/runtime-manifest.json").read_text(encoding="utf-8"))
    for target, relative in manifest["deploy"].items():
        source = checked_file(ROOT, relative)
        if forbidden_source(relative) and not relative.startswith(("build/generated/", "build/dist/")):
            raise ValueError("Missing or forbidden deployment input: " + relative)
        path = destination / target
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, path)
    for relative in fingerprint(ROOT / "helper/vendor"):
        source = checked_file(ROOT, "helper/vendor/" + relative)
        target = destination / "vendor" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    return manifest
