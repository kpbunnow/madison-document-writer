"""Apply a new release to the shared deployment folder: retire unlisted program items, copy, then verify.

Run by the release owner from the extracted new deploy folder:

    python prepare_deployment.py "\\\\server\\share\\Document Writer"

The extracted release is verified first (manifest, every file's size and SHA-256, safe paths outside the
operational folders); nothing in the target changes if it fails. Every program item in the target that is not in
this release's manifest is moved (never deleted) to a dated folder beside the target, and every program file the
release replaces is kept there too, under replaced-by-this-release. The operational folders are never touched.
The result is checked with the same verifier every PC uses before installing; if copying or that check fails, the
previous deployment is put back.
"""

import argparse
import datetime
import shutil
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from verified_update import DATA_DIRS, DATA_FILES, safe_relative, stage_update  # noqa: E402

PREVIOUS = Path("replaced-by-this-release")


def _checked_release(source):
    """Verify the extracted release before anything in the target is touched: its manifest, every listed file's size
    and SHA-256, an exact inventory and safe relative paths that stay out of the operational folders."""
    with tempfile.TemporaryDirectory(prefix="release-check-") as tmp:
        (Path(tmp) / "stage").mkdir()
        (Path(tmp) / "local").mkdir()
        manifest = stage_update(source, Path(tmp) / "stage", Path(tmp) / "local")
    names = [safe_relative(name) for name in manifest["files"]]
    for name in names:
        if Path(name).parts[0] in DATA_DIRS or name in DATA_FILES:
            raise ValueError("The release manifest lists an operational path: " + name)
    return set(names)


def plan(source, target):
    """Return (items to retire, files to copy) for applying source's verified manifest to target."""
    wanted = _checked_release(source) | {"runtime-manifest.json"}
    retire = []
    for item in sorted(target.iterdir()) if target.exists() else []:
        if item.name in DATA_DIRS or item.name in DATA_FILES:
            continue
        if item.is_dir():
            for f in sorted(item.rglob("*")):
                rel = f.relative_to(target).as_posix()
                if (f.is_file() or f.is_symlink()) and rel not in wanted:
                    retire.append(rel)
        elif item.name not in wanted:
            retire.append(item.name)
    return retire, sorted(wanted)


def _restore(target, archive, journal):
    """Undo a failed application, newest step first: remove added files, put back replaced and retired ones."""
    for kind, rel in reversed(journal):
        current = target / rel
        if kind == "added":
            current.unlink(missing_ok=True)
        else:
            saved = archive / (PREVIOUS / rel if kind == "replaced" else Path(rel))
            current.parent.mkdir(parents=True, exist_ok=True)
            if current.exists() or current.is_symlink():
                current.unlink()
            shutil.move(str(saved), str(current))


def apply(source, target, retire, wanted, stamp=None):
    _checked_release(source)
    stamp = stamp or datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    archive = target.parent / (target.name + "-retired-" + stamp)
    journal = []
    try:
        for rel in retire:
            destination = archive / rel
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(target / rel), str(destination))
            journal.append(("retired", rel))
        for rel in wanted:
            destination = target / rel
            if destination.exists() or destination.is_symlink():
                kept = archive / PREVIOUS / rel
                kept.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(destination), str(kept))
                journal.append(("replaced", rel))
            else:
                journal.append(("added", rel))
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source / rel, destination)
        with tempfile.TemporaryDirectory(prefix="deployment-check-") as tmp:
            (Path(tmp) / "stage").mkdir()
            (Path(tmp) / "local").mkdir()
            manifest = stage_update(target, Path(tmp) / "stage", Path(tmp) / "local")
    except BaseException:
        _restore(target, archive, journal)
        raise
    for directory in sorted({p for rel in retire for p in Path(rel).parents if str(p) != "."}, key=lambda p: -len(p.parts)):
        folder = target / directory
        if folder.is_dir() and not any(folder.iterdir()):
            folder.rmdir()
    return archive, manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("target", type=Path, help="The shared deployment folder")
    parser.add_argument("--yes", action="store_true", help="Apply without asking (for scripted use)")
    args = parser.parse_args(argv)
    source, target = Path(__file__).resolve().parent, args.target.resolve()
    if source == target:
        raise SystemExit("Run this from the extracted new release, not from the deployment folder itself.")
    retire, wanted = plan(source, target)
    print("Program items to retire (moved beside the deployment folder, not deleted): %d" % len(retire))
    for rel in retire[:50]:
        print("  " + rel)
    if len(retire) > 50:
        print("  ... and %d more" % (len(retire) - 50))
    print("Operational folders left untouched: " + ", ".join(sorted(DATA_DIRS)))
    if not args.yes and input("Apply this release to %s? Type YES: " % target).strip() != "YES":
        raise SystemExit("Nothing was changed.")
    archive, manifest = apply(source, target, retire, wanted)
    print("Retired items: " + (str(archive) if retire else "none"))
    print("Deployment verified: %s, helper %s, %d files." % (manifest["release"], manifest["helperVersion"], len(manifest["files"])))


if __name__ == "__main__":
    main()
