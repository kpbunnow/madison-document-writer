"""Resolve immutable runtime inputs in an installed folder or maintained source tree."""

from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
# Windows CREATE_NO_WINDOW. Defined here because subprocess only exposes it on Windows.
CREATE_NO_WINDOW = 0x08000000


def no_window():
    """creationflags for every helper child process: never open a console window on Windows.

    Output is still captured or redirected by each caller, so errors are not hidden. Elsewhere this is 0.
    """
    return CREATE_NO_WINDOW if sys.platform == "win32" else 0


def resource(name):
    """Installed files win; development reads the original maintained/generated input."""
    installed = HERE / name
    if installed.is_file():
        return installed
    root = HERE.parent
    if not (root / "version.json").is_file():
        return installed
    for directory in ["build/generated", "build/dist", "app/assets", "docs/staff"]:
        candidate = root / directory / name
        if candidate.is_file():
            return candidate
    return installed
