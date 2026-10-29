"""Check a complete staged update against its file manifest before touching installed program files.

R52 integrity model (no signing key): the manifest lists every program file with its size and SHA-256.
The check catches incomplete, corrupted, stray and older copies of the deployment. Protection against
deliberate tampering rests on the deployment folder being writable only by the release owner (NTFS
permissions), which IT verifies before rollout.
"""

import hashlib
import json
import os
import sys
import stat
from collections import Counter
from pathlib import Path, PurePosixPath

FAILURE = "The shared program files failed verification; this computer kept its current version. Tell IT."
STALE_SIGNED = (
    "The deployment folder still contains files from an earlier signed release. IT must replace the deployment "
    "folder's program files completely (run Prepare Deployment Folder, see the install guide)."
)
STALE_NAMES = {"runtime-manifest.sig", "release_trust.py"}
REPARSE_POINT = 0x400  # FILE_ATTRIBUTE_REPARSE_POINT


def _is_link(path):
    """True for a symlink, junction or other reparse point. Only ever called on paths inside the deployment."""
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        return False
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & REPARSE_POINT)


def _inside_has_link(share, relative):
    """Check each component of a manifest path from the deployment folder down, never its parents."""
    parts = Path(relative).parts
    return any(_is_link(share.joinpath(*parts[: i + 1])) for i in range(len(parts)))


def _write_diagnostic(local, text):
    try:
        Path(local, "update-diagnostic.txt").write_text(text, encoding="utf-8")
    except OSError:
        pass


DATA_DIRS = {"Case JSON Files", "Documents To Be Mailed And Recorded", "Reporting GIS", "Case Lookup", "Orders"}
DATA_FILES = {"integrity-settings.json"}


def version_tuple(value):
    parts = tuple(int(x) for x in value.split("."))
    if len(parts) != 4:
        raise ValueError("Invalid release version")
    return parts


def safe_relative(name):
    p = PurePosixPath(name)
    if (
        not name
        or "\\" in name
        or ":" in name
        or p.is_absolute()
        or any(part in ("", ".", "..") or part.endswith((" ", ".")) for part in name.split("/"))
    ):
        raise ValueError("Invalid manifest path")
    return name


def describe_difference(label, names):
    """Report every affected top-level location without listing private document names."""
    groups = Counter(PurePosixPath(name).parts[0] for name in names)
    entries = [repr(name) + (" (" + str(count) + " files)" if count > 1 else "") for name, count in sorted(groups.items())]
    return label + ": " + ", ".join(entries[:20]) + ("; " + str(len(entries) - 20) + " more locations" if len(entries) > 20 else "")


def _read_manifest(share, local, step):
    """The shared manifest and its checks against the pinned install: size, shape, version, build and downgrade."""
    raw = (share / "runtime-manifest.json").read_bytes()
    if len(raw) > 2 * 1024 * 1024:
        raise ValueError("Manifest too large")
    manifest = json.loads(raw)
    files = manifest["files"]
    if not isinstance(files, dict) or not files:
        raise ValueError("Empty manifest")
    version = version_tuple(manifest["helperVersion"])
    pin = local / "verified-install.json"
    build = manifest.get("helperBuild", version[-1])
    if type(build) is not int or build < 0 or build != version[-1]:
        raise ValueError("Invalid helper build counter")
    if pin.exists():
        previous = json.loads(pin.read_text(encoding="utf-8"))
        old_version = version_tuple(previous["helperVersion"])
        old_build = previous.get("helperBuild", old_version[-1])
        # Legacy R50 pins may be written by the old launcher during upgrade.
        # Comparing the independent counter prevents a future date masking rollback.
        if type(old_build) is not int or build < old_build or version < old_version:
            raise ValueError("Downgrade refused")
        if "helperBuild" in previous and "helperBuild" not in manifest:
            raise ValueError("Downgrade to legacy version scheme refused")
    return raw, manifest, files, build


def _enumeration_error(error):
    raise error


def _deployed_files(share, step):
    """Every program file in the deployment folder, refusing links; real operational folders are not program code."""
    found = set()
    step["operation"] = "enumerate"
    for current, directories, names in os.walk(share, followlinks=False, onerror=_enumeration_error):
        current = Path(current)
        if current == share:
            # These established operational roots are neither scanned nor installed.
            directories[:] = [name for name in directories if name not in DATA_DIRS]
        for name in directories + names:
            p = current / name
            relative = p.relative_to(share).as_posix()
            if relative in DATA_FILES:
                continue
            step["path"] = relative
            if _is_link(p):
                raise ValueError("Symlink in deployment: " + repr(relative))
            if p.is_file():
                found.add(relative)
    return found


def _require_exact_inventory(found, expected):
    if found == expected:
        return
    details = []
    if expected - found:
        details.append(describe_difference("Missing program files", expected - found))
    if found - expected:
        if any(n in STALE_NAMES or n.startswith("vendor/python/pure25519") for n in found - expected):
            raise ValueError(STALE_SIGNED + " " + describe_difference("Unexpected program-folder content", found - expected))
        details.append(describe_difference("Unexpected program-folder content", found - expected))
    raise ValueError("; ".join(details))


def _stage_file(share, staging, name, metadata, step):
    """Copy one listed file into staging while rechecking its size, growth and SHA-256."""
    p = share / name
    target = staging / name
    step.update(operation="size", path=name)
    if _inside_has_link(share, name):
        raise ValueError("Symlink in deployment: " + repr(name))
    size = metadata["size"]
    if type(size) is not int or not 0 <= size <= 128 * 1024 * 1024 or p.stat().st_size != size:
        raise ValueError("Changed program file (size): " + repr(name))
    target.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    count = 0
    step["operation"] = "read and hash"
    with p.open("rb") as source, target.open("wb") as dest:
        while chunk := source.read(min(1024 * 1024, size - count + 1)):
            count += len(chunk)
            if count > size:
                raise ValueError("Deployment grew while reading")
            digest.update(chunk)
            dest.write(chunk)
    if count != size or digest.hexdigest() != metadata["sha256"]:
        raise ValueError("Changed program file (checksum): " + repr(name))


def _write_pin(staging, manifest, build, raw):
    # Pin is part of the recoverable installation transaction, not an afterthought.
    (staging / "verified-install.json").write_text(
        json.dumps(
            {
                "helperVersion": manifest["helperVersion"],
                "helperBuild": build,
                "release": manifest["release"],
                "manifestSha256": hashlib.sha256(raw).hexdigest(),
            },
            sort_keys=True,
        )
        + "\n",
        encoding="utf-8",
    )


def _refuse_with_diagnostic(share, local, step, error):
    where = step["operation"] + (" " + repr(step["path"]) if step["path"] else "")
    detail = type(error).__name__ + " during " + where + ": " + str(error)
    _write_diagnostic(
        local,
        "Madison Document Writer update diagnostic\n"
        + "Python: "
        + sys.version.split()[0]
        + "\n"
        + "Share path type: "
        + ("UNC" if str(share).startswith(("\\\\", "//")) else "drive or local")
        + "\n"
        + "Operation: "
        + where
        + "\n"
        + "Exception: "
        + type(error).__name__
        + "\n"
        + "Detail: "
        + str(error)
        + "\n",
    )
    raise ValueError(FAILURE + "\n  Details: " + detail) from error


def stage_update(share, staging, local):
    """Read the shared manifest, stage every listed file, and recheck each size and SHA-256."""
    share, staging, local = Path(share), Path(staging), Path(local)
    step = {"operation": "read manifest", "path": ""}
    try:
        raw, manifest, files, build = _read_manifest(share, local, step)
        wanted = {safe_relative(n) for n in files}
        if "runtime-manifest.json" in wanted:
            raise ValueError("Self-referential manifest")
        _require_exact_inventory(_deployed_files(share, step), wanted | {"runtime-manifest.json"})
        for name, metadata in files.items():
            _stage_file(share, staging, name, metadata, step)
        (staging / "runtime-manifest.json").write_bytes(raw)
        _write_pin(staging, manifest, build, raw)
        return manifest
    except (OSError, ValueError, KeyError, TypeError, AssertionError) as error:
        _refuse_with_diagnostic(share, local, step, error)
