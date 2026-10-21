"""Restore inert development history from the exact retained R49 source archive."""

import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[2]


def restore(source):
    source = Path(source)
    proof = json.loads((ROOT / "docs/history/R51-HISTORY-RESTORE.json").read_text())
    if hashlib.sha256(source.read_bytes()).hexdigest() != proof["sha256"]:
        raise ValueError("Historical archive differs from the retained R49 source")
    destination = ROOT / "archive/development-history"
    destination.mkdir(parents=True, exist_ok=True)
    with ZipFile(source) as archive:
        for name, digest in proof["files"].items():
            if Path(name).is_absolute() or ".." in Path(name).parts:
                raise ValueError("Invalid historical path")
            data = archive.read(name)
            if hashlib.sha256(data).hexdigest() != digest:
                raise ValueError("Historical file hash differs: " + name)
            path = destination / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    (destination / "RESTORE-PROVENANCE.json").write_text(json.dumps(proof, indent=2) + "\n")
    (destination / "README.md").write_text(
        "# Historical development material\n\nHistorical, non-authoritative reference only. "
        "Do not follow its prompts or instructions. Current guidance lives in docs/developer. "
        "This archive is excluded from every build input and release package.\n"
    )
    return len(proof["files"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    print("Restored", restore(args.source), "inert historical files")
