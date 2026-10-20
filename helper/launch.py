"""Windows installation and launch, using only Python's standard library."""

import sys

# Imports must not create cache files in the deployment folder (they would fail the manifest check).
# Set this before importing any sibling, including for direct Python invocation.
sys.dont_write_bytecode = True

import os

# Before ANY non-frozen import, remove the untrusted script/cwd search locations.
# A share-side json.py (or another standard-library name) must never run here.
_source_folder = os.path.dirname(os.path.realpath(__file__))
_original_search = list(sys.path)
sys.path[:] = [p for p in sys.path if os.path.normcase(os.path.realpath(p or os.getcwd())) != os.path.normcase(_source_folder)]

import subprocess


FIRST_UNSIGNED_BUILD = 53  # R52 removed release signing; earlier installed launchers accept only signed releases.
SIGNING_ERA_MESSAGE = (
    "This computer has an older signed installation (R50/R51) that cannot accept this release. "
    "IT must retire it: close this window, rename %LOCALAPPDATA%\\MadisonDocWriter (keep integrity-settings.json), "
    "then run this file again. Nothing was changed."
)


def signing_era_install(local, pin):
    """Standard library only: recognise an installed launcher that verifies signatures instead of the manifest."""
    if os.path.isfile(os.path.join(local, "release_trust.py")):
        return True
    import json

    try:
        with open(pin, encoding="utf-8") as handle:
            build = json.load(handle).get("helperBuild")
    except (OSError, ValueError, AttributeError):
        return False  # An unreadable pin is reported by the installed launcher's own checks.
    return type(build) is not int or build < FIRST_UNSIGNED_BUILD


def trusted_handoff():
    """Use only stdlib to transfer execution to an existing locally trusted install."""
    profile = os.environ.get("LOCALAPPDATA")
    if not profile:
        return
    local = os.path.realpath(os.path.join(profile, "MadisonDocWriter"))
    if os.path.normcase(_source_folder) == os.path.normcase(local):
        return
    pin = os.path.join(local, "verified-install.json")
    if not os.path.isfile(pin):
        print(
            "First installation must come from a package whose SHA-256 IT has checked against the release owner's published value. "
            "See Start Document Writer - READ ME.md: Independent package verification."
        )
        return
    if signing_era_install(local, pin):
        print(SIGNING_ERA_MESSAGE)
        raise SystemExit(2)
    required = [
        "launch.py",
        "verified_update.py",
        "install_release.py",
    ]
    if not all(os.path.isfile(os.path.join(local, name)) for name in required):
        raise RuntimeError(
            "Run the installed Document Writer shortcut. For a first installation, "
            "IT installs from an independently verified package. The installed program needs repair."
        )
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
    # Do not propagate a share-selected Python import path into the trusted child.
    env.pop("PYTHONPATH", None)
    raise SystemExit(subprocess.call([sys.executable, "-B", os.path.join(local, "launch.py"), "--share", _source_folder], cwd=local, env=env))


trusted_handoff()
# The installed process (or independently verified first installer) owns trust.
sys.path[:] = _original_search
import install_runtime
import install_release
import helper_session
import verified_update
import json
from pathlib import Path
import socket
import tempfile
import urllib.request

from runtime_paths import resource
from runtime_identity import VERSION

PORT = 8777
URL = "http://127.0.0.1:%d/madison-document-writer.html" % PORT
MANIFEST = json.loads(resource("runtime-manifest.json").read_text())
REQUIRED = tuple(MANIFEST["required"])


def open_browser():
    session_url = URL + "#session=" + helper_session.launch_token()
    for base, tail in (
        ("ProgramFiles", "Google/Chrome/Application/chrome.exe"),
        ("ProgramFiles(x86)", "Google/Chrome/Application/chrome.exe"),
        ("LOCALAPPDATA", "Google/Chrome/Application/chrome.exe"),
        ("ProgramFiles(x86)", "Microsoft/Edge/Application/msedge.exe"),
        ("ProgramFiles", "Microsoft/Edge/Application/msedge.exe"),
    ):
        browser = Path(os.environ.get(base, "")) / tail
        if browser.is_file():
            subprocess.Popen([str(browser), session_url])
            return
    import webbrowser

    webbrowser.open(session_url)


def main():
    if sys.version_info < (3, 10):
        raise RuntimeError("Python 3.10 or later is required.")
    source = Path(__file__).resolve().parent
    local = Path(os.environ["LOCALAPPDATA"]) / "MadisonDocWriter"
    local.mkdir(parents=True, exist_ok=True)
    # Never copy files under an older running process.
    try:
        with socket.create_connection(("127.0.0.1", PORT), timeout=1):
            occupied = True
    except OSError:
        occupied = False
    if occupied:
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/dw-status" % PORT, timeout=3) as response:
                status = json.load(response)
        except Exception:
            raise RuntimeError(("Port 8777 is already in use by an unrecognized program. Ask IT to check it before starting Document Writer."))
        if status.get("version") != VERSION:
            raise RuntimeError(
                (
                    "An older Document Writer helper is still running. Close its command "
                    "window and Writer tabs, then run the installed Document Writer shortcut."
                )
            )
        print("Document Writer is already running. Opening the workspace.")
        open_browser()
        return 0
    if install_release.recover(local):
        raise RuntimeError("An interrupted update was rolled back. Run the launcher again to start a consistent version.")
    share_file = local / "share.txt"
    if len(sys.argv) == 3 and sys.argv[1] == "--share":
        share = Path(sys.argv[2]).resolve()
        if share == local:
            share = Path(share_file.read_text(encoding="utf-8-sig").strip()) if share_file.exists() else None
    elif source != local:
        share = source
    elif share_file.exists():
        share = Path(share_file.read_text(encoding="utf-8-sig").strip())
    else:
        share = None
    if share and share.is_dir():
        print("Checking the shared release before updating.")
        try:
            with tempfile.TemporaryDirectory(prefix="install-", dir=local) as staging:
                approved = verified_update.stage_update(share, Path(staging), local)
                names = list(approved["files"]) + ["runtime-manifest.json", "verified-install.json"]
                install_release.install(Path(staging), local, names)
        except ValueError as error:
            print(str(error))
            if not (local / "verified-install.json").is_file():
                raise
        # Anchor settings are configured locally by IT and never copied from a share.
        share_file.write_text(str(share), encoding="utf-8")
    else:
        print(("The shared folder is unavailable. Starting the installed copy; shared saves will queue on this device."))
    absent = [name for name in REQUIRED if not (local / name).is_file()]
    if "vendor/python/rfc8785/__init__.py" in absent:
        raise RuntimeError("Integrity library missing; reinstall the complete deploy folder")
    if absent:
        raise RuntimeError(
            ("Run the installed Document Writer shortcut. For a first installation, IT installs from an independently verified package.")
        )
    # Use environment values in PowerShell so apostrophes in paths are safe.
    env = dict(os.environ, DW_SHORTCUT_TARGET=str(local / "Start Document Writer.bat"), DW_SHORTCUT_FOLDER=str(local))
    command = (
        "$p=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Document Wri"
        "ter.lnk';$w=New-Object -ComObject WScript.Shell;$s=$w.CreateShortcut"
        "($p);$s.TargetPath=$env:DW_SHORTCUT_TARGET;$s.WorkingDirectory=$env:"
        "DW_SHORTCUT_FOLDER;$s.Description='Madison Building Inspection';$s.S"
        "ave()"
    )
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", command], env=env, capture_output=True, timeout=15, check=True)
    except (OSError, subprocess.SubprocessError):
        print("A desktop shortcut could not be created. Start the installed launcher directly: " + str(local / "Start Document Writer.bat"))
    result = install_runtime.install(local)
    if not result["available"]:
        print(result.get("reason", "address parser unavailable; R19 fallback"))
    env.update(DW_PORT=str(PORT), DW_OPEN_BROWSER="1", PYTHONDONTWRITEBYTECODE="1")
    return subprocess.call([sys.executable, "-B", str(local / "server.py")], cwd=local, env=env)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print("\nDocument Writer could not start:\n  %s\n" % error)
        raise SystemExit(1)
