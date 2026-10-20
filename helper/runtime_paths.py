"""Resolve immutable runtime inputs in an installed folder or maintained source tree."""

from pathlib import Path

HERE = Path(__file__).resolve().parent


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
