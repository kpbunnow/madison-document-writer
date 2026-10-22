"""Windows installation and launch, using only Python's standard library.

Desktop shortcut: pythonw.exe -B "<local>\\launch.py" starts without a console, checks the share for an approved
update, starts the helper hidden (or reuses a compatible running one), opens Writer in an app window and exits.
Diagnostic launcher: Start Document Writer.bat keeps a console, prints progress and runs the helper in that window.
IT can open the launcher log folder with: pythonw.exe -B "<local>\\launch.py" --open-logs
"""

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

CREATE_NO_WINDOW = 0x08000000  # Literal: the hand-off may not import runtime_paths from an untrusted folder.
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


def handoff_log(local, text):
    """Standard library only: one line in the installed launcher log; logging must never stop the hand-off."""
    try:
        folder = os.path.join(local, "logs")
        os.makedirs(folder, exist_ok=True)
        import time

        with open(os.path.join(folder, "launcher.log"), "a", encoding="utf-8") as stream:
            stream.write(time.strftime("%Y-%m-%d %H:%M:%S") + " INFO Shared launcher: " + text + "\n")
    except (OSError, ValueError):
        pass


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
        handoff_log(local, "older signed installation; retirement required")
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
    handoff_log(local, "handing off to the installed launcher")
    # A console launch shares its window with the installed launcher (diagnostics stay visible);
    # without a console the child must not open one.
    flags = CREATE_NO_WINDOW if sys.platform == "win32" and sys.stdout is None else 0
    command = [sys.executable, "-B", os.path.join(local, "launch.py"), "--share", _source_folder]
    raise SystemExit(subprocess.call(command, cwd=local, env=env, creationflags=flags))


def installation_damaged(error):
    """Standard library only: the installed program files cannot be imported. Tell the user, then stop."""
    message = (
        "Document Writer's installed program files are incomplete or damaged (%s). "
        "Ask IT to repair the installation by running Start Document Writer.bat from the verified deployment folder."
    ) % type(error).__name__
    profile = os.environ.get("LOCALAPPDATA")
    if profile:
        handoff_log(os.path.join(profile, "MadisonDocWriter"), "installed launcher could not start: " + message)
    print("\nDocument Writer could not start:\n  %s\n" % message)
    if sys.platform == "win32" and (sys.stdout is None or os.path.basename(sys.executable).lower() == "pythonw.exe"):
        try:
            import ctypes

            ctypes.windll.user32.MessageBoxW(None, message, "Document Writer", 0x10 | 0x40000)
        except Exception:
            pass
    raise SystemExit(1)


trusted_handoff()
# The installed process (or independently verified first installer) owns trust.
sys.path[:] = _original_search
import json
from logging import WARNING
from pathlib import Path
import socket
import tempfile

try:
    import install_runtime
    import install_release
    import verified_update
    import desktop_launch
    from desktop_launch import say
    from runtime_paths import resource
    from runtime_identity import VERSION

    MANIFEST = json.loads(resource("runtime-manifest.json").read_text(encoding="utf-8"))
except (ImportError, OSError, ValueError, KeyError) as error:
    if __name__ != "__main__":
        raise
    installation_damaged(error)

PORT = desktop_launch.PORT
REQUIRED = tuple(MANIFEST["required"])
# Problems that do not stop start-up (a rejected update); a desktop launch shows them after Writer opens.
startup_warnings = []


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
            status = desktop_launch.local_status(timeout=3)
        except Exception:
            raise RuntimeError(desktop_launch.PORT_IN_USE)
        if status.get("version") != VERSION:
            raise RuntimeError(desktop_launch.OLDER_HELPER)
        # A compatible helper is serving this release: never update under it; reuse it.
        say("Document Writer is already running. Opening the workspace.")
        if not desktop_launch.open_app_window():
            raise RuntimeError(desktop_launch.NO_BROWSER)
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
        say("Checking the shared release before updating.")
        try:
            with tempfile.TemporaryDirectory(prefix="install-", dir=local) as staging:
                approved = verified_update.stage_update(share, Path(staging), local)
                names = list(approved["files"]) + ["runtime-manifest.json", "verified-install.json"]
                install_release.install(Path(staging), local, names)
            say("Installed release is current with the shared folder.")
        except ValueError as error:
            say(str(error), WARNING)
            if not (local / "verified-install.json").is_file():
                raise
            # Existing semantics: keep the verified installed copy. A desktop launch tells the user after Writer opens.
            startup_warnings.append(str(error).split("\n")[0] + " Document Writer has started with the version already installed.")
        # Anchor settings are configured locally by IT and never copied from a share.
        share_file.write_text(str(share), encoding="utf-8")
    else:
        say("The shared folder is unavailable. Starting the installed copy; shared saves will queue on this device.")
    absent = [name for name in REQUIRED if not (local / name).is_file()]
    if "vendor/python/rfc8785/__init__.py" in absent:
        raise RuntimeError("Integrity library missing; reinstall the complete deploy folder")
    if absent:
        raise RuntimeError(
            ("Run the installed Document Writer shortcut. For a first installation, IT installs from an independently verified package.")
        )
    created, shortcut = desktop_launch.create_shortcut(local)
    if shortcut and not created:
        say(
            "A desktop shortcut could not be created. Start the installed launcher directly: " + str(local / "Start Document Writer.bat"),
            WARNING,
        )
    result = install_runtime.install(local)
    if not result["available"]:
        say(result.get("reason", "address parser unavailable; R19 fallback"), WARNING)
        if result.get("detail"):
            desktop_launch.LOGGER.warning("Address parser installation output: %s", result["detail"])
    env = dict(os.environ, DW_PORT=str(PORT), PYTHONDONTWRITEBYTECODE="1")
    if desktop_launch.windowless():
        # Desktop launch: start the helper hidden and detached, wait until it answers, open Writer, exit.
        process = desktop_launch.start_background_helper(local, env)
        state = desktop_launch.wait_until_ready(process, VERSION)
        desktop_launch.LOGGER.info("Helper start: %s.", state)
        if state != "ready":
            raise RuntimeError(desktop_launch.HELPER_DID_NOT_START)
        if not desktop_launch.open_app_window():
            raise RuntimeError(desktop_launch.NO_BROWSER)
        return 0
    # Diagnostic console launch: the helper shares this console (creationflags 0) and opens Writer itself once ready.
    env["DW_OPEN_BROWSER"] = "1"
    return subprocess.call([sys.executable, "-B", str(local / "server.py")], cwd=local, env=env, creationflags=0)


def run(argv):
    """Entry point: logging first, then start-up, with a readable report for any failure."""
    # The log always lives in the local installation folder (never the share), as helper_session's profile folder.
    local = desktop_launch.helper_session.profile_folder()
    desktop_launch.start_logging(local)
    if argv[1:] == ["--open-logs"]:
        return desktop_launch.open_logs(local)
    splash = desktop_launch.Splash()
    if desktop_launch.windowless():
        splash.start()
    startup_warnings.clear()
    try:
        code = main()
    except Exception as error:
        splash.close()
        desktop_launch.LOGGER.error("Start-up failed (%s).", type(error).__name__, exc_info=True)
        desktop_launch.report_failure(str(error))
        return 1
    splash.close()
    if startup_warnings and desktop_launch.windowless():
        desktop_launch.show_dialog("\n\n".join(startup_warnings), warning=True)
    return code


if __name__ == "__main__":
    raise SystemExit(run(sys.argv))
