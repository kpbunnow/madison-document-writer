"""Write runtime-manifest.json for a deploy folder: every program file with its size and SHA-256.

Shared by tools/package_release.py and the update tests, so both use one definition of the manifest.
"""

import hashlib
import json
from pathlib import Path


def write_manifest(directory):
    directory = Path(directory)
    value = json.loads((directory / "runtime-manifest.json").read_text(encoding="utf-8"))
    value["files"] = {
        f.relative_to(directory).as_posix(): {"size": f.stat().st_size, "sha256": hashlib.sha256(f.read_bytes()).hexdigest()}
        for f in sorted(directory.rglob("*"))
        if f.is_file() and f.relative_to(directory).as_posix() != "runtime-manifest.json"
    }
    (directory / "runtime-manifest.json").write_bytes((json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode())
