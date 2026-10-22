"""Windows desktop start-up for Document Writer, using only Python's standard library.

Imported by the installed launcher after the trusted hand-off (never by the share-side bootstrap), and by
server.py for diagnostic launches. It owns the launcher log, readable Windows dialogs, the optional
"Starting Document Writer" indicator, the desktop shortcut, the hidden helper start and the Writer app window.

Desktop launches run under pythonw.exe and have no console: messages go to
%LOCALAPPDATA%\\MadisonDocWriter\\logs\\launcher.log and failures that stop start-up are shown in a dialog.
Diagnostic launches (Start Document Writer.bat) keep a console and print the same messages.
Nothing here records the session token, the authenticated URL, credentials or case contents.
"""

import http.client
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import subprocess
import sys
import threading
import time

import helper_session
from runtime_paths import no_window

PORT = 8777
ORIGIN = "http://127.0.0.1:%d" % PORT
APP_URL = ORIGIN + "/madison-document-writer.html"
TITLE = "Document Writer"
SHORTCUT_DESCRIPTION = "Madison Building Inspection Document Writer"
ICON_NAME = "document-writer.ico"
DIAGNOSTIC_LAUNCHER = "Start Document Writer.bat"
LOG_NAME = "launcher.log"
READY_SECONDS = 45
SPLASH_DELAY = 1.0
CREATE_NEW_PROCESS_GROUP = 0x00000200
MB_OK, MB_ICONERROR, MB_ICONWARNING, MB_TOPMOST, MB_SETFOREGROUND = 0x0, 0x10, 0x30, 0x40000, 0x10000

LOGGER = logging.getLogger("madison-launcher")
LOGGER.propagate = False
LOGGER.setLevel(logging.INFO)
LOGGER.addHandler(logging.NullHandler())
_STATE = {"log": None}

PORT_IN_USE = (
    "Port 8777 is already in use by another program, so Document Writer cannot start. "
    "Restart the computer and try again. If this keeps happening, ask IT to check which program uses port 8777."
)
OLDER_HELPER = (
    "An older version of Document Writer is still running on this computer, so the update cannot be applied yet. "
    "Save your work and close the Writer windows, then use Exit Document Writer (or sign out of Windows and back in) "
    "and double-click the Document Writer icon again. If this keeps happening, contact IT."
)
HELPER_DID_NOT_START = (
    "Document Writer's local helper did not start. Double-click the Document Writer icon again. "
    "If this keeps happening, IT can run Start Document Writer.bat in the installed folder to see the details."
)
NO_BROWSER = (
    "Document Writer is running, but no web browser could be opened. Install or repair Google Chrome or "
    "Microsoft Edge, then double-click the Document Writer icon again. Do not copy Writer addresses between "
    "computers or users; the desktop icon opens Writer securely."
)


# ---------------------------------------------------------------- logging and console-free output


class _LogStream:
    """Stands in for sys.stdout/sys.stderr under pythonw (where they are None) so output reaches the log."""

    encoding = "utf-8"

    def __init__(self, level):
        self.level = level
        self.pending = ""
        self.local = threading.local()

    def write(self, text):
        if getattr(self.local, "busy", False):
            return len(text)  # A logging failure must never recurse through this stream.
        self.local.busy = True
        try:
            self.pending += text
            while "\n" in self.pending:
                line, self.pending = self.pending.split("\n", 1)
                if line.strip():
                    LOGGER.log(self.level, line.rstrip())
        finally:
            self.local.busy = False
        return len(text)

    def flush(self):
        pass

    def isatty(self):
        return False


def windowless():
    """True for a desktop launch: pythonw.exe, or any process started without a console."""
    return sys.stdout is None or isinstance(sys.stdout, _LogStream) or Path(sys.executable).name.lower() == "pythonw.exe"


def guard_streams():
    """print() and tracebacks must not crash or vanish when pythonw provides no console streams."""
    if sys.stdout is None:
        sys.stdout = _LogStream(logging.INFO)
    if sys.stderr is None:
        sys.stderr = _LogStream(logging.ERROR)
    if isinstance(sys.stderr, _LogStream):
        logging.raiseExceptions = False  # A failed log write is dropped, never reported to a missing console.


def log_file(local):
    return Path(local) / "logs" / LOG_NAME


def start_logging(local):
    """Rotating launcher log in the local installation (never on the share): 1 MB x 4 files."""
    guard_streams()
    path = log_file(local)
    if _STATE["log"] == path:
        return path
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        handler = RotatingFileHandler(path, maxBytes=1024 * 1024, backupCount=3, encoding="utf-8", delay=True)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
        for old in [h for h in LOGGER.handlers if isinstance(h, RotatingFileHandler)]:
            LOGGER.removeHandler(old)
            old.close()
        LOGGER.addHandler(handler)
        _STATE["log"] = path
        LOGGER.info("Launcher started (Python %s, %s).", sys.version.split()[0], "desktop" if windowless() else "diagnostic console")
    except OSError:
        return None
    return path


def say(message, level=logging.INFO):
    """Progress for the diagnostic console and the log. Desktop launches only log it."""
    LOGGER.log(level, message)
    if not windowless():
        print(message, flush=True)


# ---------------------------------------------------------------- dialogs and start-up indicator


def _message_box(text, flags):
    if sys.platform != "win32":
        return 0
    import ctypes

    return ctypes.windll.user32.MessageBoxW(None, text, TITLE, flags)


def show_dialog(message, warning=False):
    """A readable Windows dialog naming the next step and the log location."""
    path = _STATE["log"]
    text = message + ("\n\nDetails are recorded in:\n" + str(path) if path else "")
    LOGGER.log(logging.WARNING if warning else logging.ERROR, "Dialog shown: %s", message)
    try:
        _message_box(text, MB_OK | (MB_ICONWARNING if warning else MB_ICONERROR) | MB_TOPMOST | MB_SETFOREGROUND)
    except Exception as error:  # A dialog failure must not hide the original problem; it is in the log.
        LOGGER.warning("Dialog could not be shown: %s", type(error).__name__)


def report_failure(message):
    """Start-up stopped: print for the diagnostic console; dialog for a desktop launch."""
    LOGGER.error("Document Writer could not start: %s", message)
    if windowless():
        show_dialog("Document Writer could not start.\n\n" + message)
    else:
        print("\nDocument Writer could not start:\n  %s\n" % message, flush=True)


class Splash:
    """A small 'Starting Document Writer…' window, shown only if start-up takes longer than SPLASH_DELAY.

    It runs on its own daemon thread, degrades silently without tkinter or a display, and never delays start-up.
    """

    def __init__(self):
        self.done = threading.Event()
        self.thread = None

    def start(self, delay=SPLASH_DELAY):
        self.thread = threading.Thread(target=self._run, args=(delay,), name="startup-indicator", daemon=True)
        self.thread.start()
        return self

    def _run(self, delay):
        if self.done.wait(delay):
            return
        try:
            import tkinter

            root = tkinter.Tk()
            root.withdraw()
            root.title(TITLE)
            root.overrideredirect(True)
            root.attributes("-topmost", True)
            frame = tkinter.Frame(root, background="#17325a", padx=2, pady=2)
            frame.pack()
            label = tkinter.Label(
                frame, text="Starting Document Writer…", background="#ffffff", foreground="#17325a", font=("Segoe UI", 11), padx=28, pady=18
            )
            label.pack()
            root.update_idletasks()
            width, height = root.winfo_reqwidth(), root.winfo_reqheight()
            root.geometry("+%d+%d" % ((root.winfo_screenwidth() - width) // 2, (root.winfo_screenheight() - height) // 3))
            root.deiconify()
            limit = time.monotonic() + 120
            while not self.done.is_set() and time.monotonic() < limit:
                root.update()
                time.sleep(0.05)
            root.destroy()
        except Exception as error:
            LOGGER.info("Start-up indicator unavailable (%s).", type(error).__name__)

    def close(self):
        self.done.set()
        if self.thread and self.thread is not threading.current_thread():
            self.thread.join(timeout=2)


# ---------------------------------------------------------------- desktop shortcut


def find_pythonw(executable=None):
    """The windowless interpreter of the running Python installation, verified to be the same version.

    Returns (path, None) or (None, reason). The sibling pythonw.exe from the same folder belongs to the same
    installation; running it once (without a window) confirms it starts and reports the same major.minor
    version, so a missing, broken or mismatched file falls back to the diagnostic batch launcher.
    """
    current = Path(executable or sys.executable)
    candidate = current if current.name.lower() == "pythonw.exe" else current.with_name("pythonw.exe")
    if not candidate.is_file():
        return None, "pythonw.exe was not found beside " + current.name
    expected = tuple(sys.version_info[:2])
    if expected < (3, 10):
        return None, "Python 3.10 or later is required"
    check = "import sys; raise SystemExit(0 if tuple(sys.version_info[:2]) == %r else 3)" % (expected,)
    try:
        result = subprocess.run([str(candidate), "-I", "-c", check], capture_output=True, timeout=20, creationflags=no_window())
    except (OSError, subprocess.SubprocessError) as error:
        return None, "pythonw.exe could not run (%s)" % type(error).__name__
    if result.returncode != 0:
        return None, "pythonw.exe is not Python %d.%d (exit code %s)" % (expected + (result.returncode,))
    return candidate, None


def quote_argument(value):
    """Quote one Windows command-line argument (CommandLineToArgvW rules); always quoted."""
    value = str(value)
    if '"' in value:
        raise ValueError("Windows paths cannot contain quotation marks")
    trailing = len(value) - len(value.rstrip("\\"))
    return '"' + value + "\\" * trailing + '"'


def shortcut_settings(local, pythonw):
    """Desktop shortcut fields: the windowless launcher when pythonw is available, else the diagnostic batch file."""
    local = Path(local)
    if pythonw:
        target, arguments = str(pythonw), "-B " + quote_argument(local / "launch.py")
    else:
        target, arguments = str(local / DIAGNOSTIC_LAUNCHER), ""
    return {
        "DW_SHORTCUT_TARGET": target,
        "DW_SHORTCUT_ARGUMENTS": arguments,
        "DW_SHORTCUT_FOLDER": str(local),
        "DW_SHORTCUT_ICON": str(local / ICON_NAME) + ",0",
        "DW_SHORTCUT_DESCRIPTION": SHORTCUT_DESCRIPTION,
    }


# Values arrive through environment variables so apostrophes and spaces in paths are never parsed as code.
# CreateShortcut opens an existing "Document Writer.lnk", so saving it migrates the old batch-file shortcut.
SHORTCUT_SCRIPT = (
    "$ErrorActionPreference='Stop';"
    "$p=Join-Path ([Environment]::GetFolderPath('Desktop')) 'Document Writer.lnk';"
    "$w=New-Object -ComObject WScript.Shell;$s=$w.CreateShortcut($p);"
    "$s.TargetPath=[string]$env:DW_SHORTCUT_TARGET;$s.Arguments=[string]$env:DW_SHORTCUT_ARGUMENTS;"
    "$s.WorkingDirectory=[string]$env:DW_SHORTCUT_FOLDER;$s.IconLocation=[string]$env:DW_SHORTCUT_ICON;"
    "$s.Description=[string]$env:DW_SHORTCUT_DESCRIPTION;$s.WindowStyle=1;$s.Save()"
)


def powershell():
    known = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    return str(known) if known.is_file() else "powershell"


def create_shortcut(local):
    """Create or migrate the desktop shortcut. Returns (created, settings); a failure is logged, never fatal."""
    if sys.platform != "win32":
        LOGGER.info("Desktop shortcut is created only on Windows.")
        return False, None
    pythonw, reason = find_pythonw()
    if not pythonw:
        LOGGER.warning("Windowless start is unavailable (%s); the desktop shortcut uses %s.", reason, DIAGNOSTIC_LAUNCHER)
    settings = shortcut_settings(local, pythonw)
    command = [powershell(), "-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", SHORTCUT_SCRIPT]
    try:
        subprocess.run(command, env={**os.environ, **settings}, capture_output=True, timeout=20, check=True, creationflags=no_window())
    except (OSError, subprocess.SubprocessError) as error:
        output = getattr(error, "stderr", None) or b""
        detail = output.decode("utf-8", "replace").strip()[-800:] if isinstance(output, bytes) else str(output)[-800:]
        LOGGER.warning("Desktop shortcut could not be created (%s). %s", type(error).__name__, detail)
        return False, settings
    LOGGER.info("Desktop shortcut saved: target %s.", Path(settings["DW_SHORTCUT_TARGET"]).name)
    return True, settings


# ---------------------------------------------------------------- helper process and app window


def start_background_helper(local, env):
    """Start server.py detached from any console. Its output is discarded: request errors may name case files,
    so they are never written to a persistent log. IT sees them by running the diagnostic batch launcher."""
    flags = no_window() | (CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0)
    return subprocess.Popen(
        [sys.executable, "-B", str(Path(local) / "server.py")],
        cwd=str(local),
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
        creationflags=flags,
        start_new_session=sys.platform != "win32",
    )


def local_status(timeout=3):
    """The public readiness answer of whatever listens on the port (version and readiness only, no secret).

    A direct loopback connection: never routed through a web proxy configured for the user or by environment.
    """
    connection = http.client.HTTPConnection("127.0.0.1", PORT, timeout=timeout)
    try:
        connection.request("GET", "/dw-status")
        response = connection.getresponse()
        if response.status != 200:
            raise ValueError("Not a Document Writer readiness answer")
        value = json.loads(response.read(64 * 1024))
    finally:
        connection.close()
    if not isinstance(value, dict):
        raise ValueError("Not a Document Writer readiness answer")
    return value


def helper_version(timeout=2):
    """The version a helper on the port reports through its public readiness route, or None."""
    try:
        return local_status(timeout).get("version")
    except (OSError, ValueError, http.client.HTTPException):
        return None  # Nothing listening yet, or a program that does not speak HTTP.


def wait_until_ready(process, version, timeout=READY_SECONDS, interval=0.25):
    """Poll /dw-status until this release answers ('ready'), the child exits ('exited') or time runs out."""
    deadline = time.monotonic() + timeout
    while True:
        if helper_version() == version:
            return "ready"  # Also covers a second simultaneous launch whose own helper could not bind the port.
        if process.poll() is not None:
            return "exited"
        if time.monotonic() >= deadline:
            return "timeout"
        time.sleep(interval)


def find_browser():
    """Chrome, then Edge, in their standard installation folders."""
    for base, tail in (
        ("ProgramFiles", "Google/Chrome/Application/chrome.exe"),
        ("ProgramFiles(x86)", "Google/Chrome/Application/chrome.exe"),
        ("LOCALAPPDATA", "Google/Chrome/Application/chrome.exe"),
        ("ProgramFiles(x86)", "Microsoft/Edge/Application/msedge.exe"),
        ("ProgramFiles", "Microsoft/Edge/Application/msedge.exe"),
    ):
        if os.environ.get(base):
            browser = Path(os.environ[base]) / tail
            if browser.is_file():
                return browser
    return None


def open_app_window():
    """The one place that builds the authenticated Writer address and opens it.

    Chrome or Edge opens it as an app-style window in the user's existing browser profile (no separate
    profile). Without either, the default browser opens it. Returns False when nothing could be opened.
    """
    url = APP_URL + "#session=" + helper_session.launch_token()
    browser = find_browser()
    if browser:
        try:
            subprocess.Popen(
                [str(browser), "--app=" + url],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                close_fds=True,
                creationflags=no_window(),
            )
            LOGGER.info("Opened Writer in an app window (%s).", browser.name)
            return True
        except OSError as error:
            LOGGER.warning("%s could not start (%s); trying the default browser.", browser.name, type(error).__name__)
    else:
        LOGGER.warning("Chrome and Edge were not found; opening Writer in the default browser.")
    import webbrowser

    try:
        opened = webbrowser.open(url)
    except Exception as error:
        LOGGER.warning("Default browser failed (%s).", type(error).__name__)
        opened = False
    if opened:
        LOGGER.info("Opened Writer in the default browser.")
    else:
        LOGGER.error("No browser could open Writer.")
    return bool(opened)


def open_logs(local):
    """launch.py --open-logs: open the log folder for IT (Windows Explorer)."""
    folder = Path(local) / "logs"
    folder.mkdir(parents=True, exist_ok=True)
    if sys.platform == "win32":
        os.startfile(str(folder))  # noqa: S606 - opens a folder in Explorer; no shell command is built.
    else:
        print(folder)
    return 0
