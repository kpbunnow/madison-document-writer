"""Apply a new release to the shared deployment folder: retire unlisted program items, copy, then verify.

Run by the release owner from the extracted new deploy folder:

    python prepare_deployment.py "\\\\server\\share\\Document Writer"

Every program item in the target that is not in this release's manifest is moved (never deleted) to a dated
folder beside the target. The operational folders are never touched. The result is checked with the same
verifier every PC uses before installing.
"""

import argparse
import datetime
import json
import shutil
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from verified_update import DATA_DIRS, DATA_FILES, stage_update  # noqa: E402


def plan(source, target):
    """Return (items to retire, files to copy) for applying source's manifest to target."""
    manifest = json.loads((source / "runtime-manifest.json").read_text(encoding="utf-8"))
    wanted = set(manifest["files"]) | {"runtime-manifest.json"}
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


def apply(source, target, retire, wanted, stamp=None):
    stamp = stamp or datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    archive = target.parent / (target.name + "-retired-" + stamp)
    for rel in retire:
        destination = archive / rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(target / rel), str(destination))
    for directory in sorted({p for rel in retire for p in Path(rel).parents if str(p) != "."}, key=lambda p: -len(p.parts)):
        folder = target / directory
        if folder.is_dir() and not any(folder.iterdir()):
            folder.rmdir()
    for rel in wanted:
        destination = target / rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / rel, destination)
    with tempfile.TemporaryDirectory(prefix="deployment-check-") as tmp:
        (Path(tmp) / "stage").mkdir()
        (Path(tmp) / "local").mkdir()
        return archive, stage_update(target, Path(tmp) / "stage", Path(tmp) / "local")


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
