"""Install pinned Windows x64 parser wheels without contacting a package index."""

import hashlib
import json
from pathlib import Path
import platform
import shutil
import subprocess
import sys


def install(root):
    root = Path(root)
    site = root / "vendor/site"
    lock = root / "requirements-runtime.txt"
    if sys.platform != "win32":
        return {"available": False, "reason": "Offline Windows installer is not exercised on this platform"}
    if not (3, 10) <= sys.version_info[:2] <= (3, 14) or platform.machine().lower() not in ("amd64", "x86_64"):
        return {"available": False, "reason": "Address parser supports Windows x64 CPython 3.10 through 3.14"}
    identity = {"lock": hashlib.sha256(lock.read_bytes()).hexdigest(), "python": list(sys.version_info[:2])}
    marker = site / ".installed-runtime.json"
    try:
        if marker.exists() and json.loads(marker.read_text()) == identity:
            return {"available": True, "cached": True}
    except (ValueError, OSError):
        pass
    if site.exists():
        shutil.rmtree(site)
    command = [
        sys.executable,
        "-m",
        "pip",
        "install",
        "--no-index",
        "--require-hashes",
        "--only-binary=:all:",
        "--find-links",
        str(root / "vendor/wheels"),
        "--target",
        str(site),
        "-r",
        str(lock),
    ]
    try:
        subprocess.run(command, check=True, timeout=120, capture_output=True, text=True)
        marker.write_text(json.dumps(identity))
        return {"available": True}
    except (OSError, subprocess.SubprocessError):
        return {"available": False, "reason": "address parser unavailable; R19 fallback remains available"}


if __name__ == "__main__":
    print(json.dumps(install(Path(__file__).parent)))
