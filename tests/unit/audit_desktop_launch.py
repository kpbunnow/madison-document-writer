"""Desktop launch (stage A): shortcut, windowless start, app window, dialogs, launcher log, favicon and icon.

Windows calls (MessageBoxW, PowerShell, creationflags, os.startfile) are simulated; native Windows
behaviour still needs verification on a City PC.
"""

import ast
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import MagicMock, patch

import build_icon
import desktop_launch
import helper_session
import install_runtime
import launch
import runtime_paths
import server
import verified_update

ROOT = Path(__file__).resolve().parents[2]
TOKEN = "T0KEN-SYNTHETIC-" + "x" * 27
NO_WINDOW = runtime_paths.CREATE_NO_WINDOW


def argv_from_command_line(text):
    """CommandLineToArgvW rules for arguments after the program name (backslashes, quotes, spaces)."""
    args, current, quoted, index, started = [], "", False, 0, False
    while index < len(text):
        char = text[index]
        if char == "\\":
            count = 0
            while index < len(text) and text[index] == "\\":
                count += 1
                index += 1
            if index < len(text) and text[index] == '"':
                current += "\\" * (count // 2)
                if count % 2:
                    current += '"'
                    index += 1
            else:
                current += "\\" * count
            started = True
            continue
        if char == '"':
            quoted = not quoted
            started = True
        elif char in " \t" and not quoted:
            if started:
                args.append(current)
            current, started = "", False
        else:
            current += char
            started = True
        index += 1
    if started:
        args.append(current)
    return args


class Process:
    def __init__(self, code=None):
        self.code = code

    def poll(self):
        return self.code


class Desktop(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.profile = self.root / "profile with space"
        self.local = self.profile / "MadisonDocWriter"
        self.local.mkdir(parents=True)
        self.boxes = []
        stack = contextlib.ExitStack()
        self.addCleanup(stack.close)
        self.addCleanup(self.temp.cleanup)
        stack.enter_context(patch.dict(os.environ, {"LOCALAPPDATA": str(self.profile)}))
        stack.enter_context(patch.object(desktop_launch, "_message_box", side_effect=lambda text, flags: self.boxes.append((text, flags))))
        stack.enter_context(patch.object(helper_session, "launch_token", return_value=TOKEN))
        self.stack = stack
        self.addCleanup(self.reset_logging)

    def reset_logging(self):
        for handler in list(desktop_launch.LOGGER.handlers):
            if not isinstance(handler, desktop_launch.logging.NullHandler):
                desktop_launch.LOGGER.removeHandler(handler)
                handler.close()
        desktop_launch._STATE["log"] = None
        desktop_launch.logging.raiseExceptions = True

    def log_text(self):
        path = self.local / "logs/launcher.log"
        return path.read_text(encoding="utf-8") if path.exists() else ""

    def windowless(self):
        """Simulate pythonw.exe on Windows: no console streams."""
        self.stack.enter_context(patch.object(sys, "stdout", None))
        self.stack.enter_context(patch.object(sys, "stderr", None))
        self.stack.enter_context(patch.object(desktop_launch.sys, "platform", "win32"))

    # ---------------------------------------------------------------- shortcut

    def test_shortcut_fields_quote_spaces_apostrophes_and_unc_paths(self):
        for local in [
            r"C:\Users\Pat O'Brien\AppData\Local\MadisonDocWriter",
            r"\\city-fs\profiles$\d'Arcy Smith\AppData\Local\MadisonDocWriter",
            r"C:\Users\plain\AppData\Local\MadisonDocWriter",
        ]:
            with self.subTest(local=local):
                pythonw = r"C:\Program Files\Python312\pythonw.exe"
                with patch.object(desktop_launch, "Path", __import__("pathlib").PureWindowsPath):
                    value = desktop_launch.shortcut_settings(local, pythonw)
                self.assertEqual(value["DW_SHORTCUT_TARGET"], pythonw)
                self.assertEqual(argv_from_command_line(value["DW_SHORTCUT_ARGUMENTS"]), ["-B", local + "\\launch.py"])
                self.assertEqual(value["DW_SHORTCUT_ARGUMENTS"], '-B "' + local + '\\launch.py"')
                self.assertEqual(value["DW_SHORTCUT_FOLDER"], local)
                self.assertEqual(value["DW_SHORTCUT_ICON"], local + "\\document-writer.ico,0")
                with patch.object(desktop_launch, "Path", __import__("pathlib").PureWindowsPath):
                    fallback = desktop_launch.shortcut_settings(local, None)
                self.assertEqual(fallback["DW_SHORTCUT_TARGET"], local + "\\Start Document Writer.bat")
                self.assertEqual(fallback["DW_SHORTCUT_ARGUMENTS"], "")
        self.assertEqual(argv_from_command_line(desktop_launch.quote_argument("C:\\folder\\")), ["C:\\folder\\"])
        with self.assertRaises(ValueError):
            desktop_launch.quote_argument('C:\\bad"name')

    def test_shortcut_is_created_hidden_through_environment_values_and_migrates_existing_link(self):
        calls = []

        def run(command, **kwargs):
            calls.append((command, kwargs))
            return subprocess.CompletedProcess(command, 0, b"", b"")

        folder = self.root / "Python312"
        folder.mkdir()
        python = folder / "python.exe"
        pythonw = folder / "pythonw.exe"
        python.write_bytes(b"")
        pythonw.write_bytes(b"")
        with (
            patch.object(desktop_launch.sys, "platform", "win32"),
            patch.object(desktop_launch.sys, "executable", str(python)),
            patch.object(desktop_launch.subprocess, "run", side_effect=run),
        ):
            created, settings = desktop_launch.create_shortcut(self.local)
        self.assertTrue(created)
        version_check, shortcut = calls
        self.assertEqual(version_check[0][:3], [str(pythonw), "-I", "-c"])
        self.assertIn(repr(tuple(sys.version_info[:2])), version_check[0][3])
        command, kwargs = shortcut
        for flag in ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command"]:
            self.assertIn(flag, command)
        self.assertEqual(kwargs["creationflags"] & NO_WINDOW, NO_WINDOW)
        self.assertEqual(version_check[1]["creationflags"] & NO_WINDOW, NO_WINDOW)
        self.assertTrue(kwargs["check"] and kwargs["capture_output"])
        script = command[-1]
        # Paths reach PowerShell only as environment values, never inside the script text.
        self.assertNotIn(str(self.local), script)
        self.assertIn("CreateShortcut($p)", script)
        self.assertIn("'Document Writer.lnk'", script)
        for field in ["TargetPath", "Arguments", "WorkingDirectory", "IconLocation", "Description"]:
            self.assertIn("$s." + field + "=[string]$env:DW_SHORTCUT_", script)
        env = kwargs["env"]
        self.assertEqual(env["DW_SHORTCUT_TARGET"], str(pythonw))
        self.assertEqual(argv_from_command_line(env["DW_SHORTCUT_ARGUMENTS"]), ["-B", str(self.local / "launch.py")])
        self.assertEqual(env["DW_SHORTCUT_FOLDER"], str(self.local))
        self.assertEqual(env["DW_SHORTCUT_ICON"], str(self.local / "document-writer.ico") + ",0")
        self.assertEqual(settings, {k: env[k] for k in settings})

    def test_pythonw_absent_or_incompatible_falls_back_to_the_batch_launcher(self):
        folder = self.root / "Python"
        folder.mkdir()
        python = folder / "python.exe"
        python.write_bytes(b"")
        for case in ["absent", "incompatible", "broken"]:
            with self.subTest(case=case):
                (folder / "pythonw.exe").unlink(missing_ok=True)
                if case != "absent":
                    (folder / "pythonw.exe").write_bytes(b"")
                calls = []

                def run(command, **kwargs):
                    calls.append(command)
                    if command[1] == "-I":
                        if case == "broken":
                            raise OSError("not a valid application")
                        return subprocess.CompletedProcess(command, 3, b"", b"")
                    return subprocess.CompletedProcess(command, 0, b"", b"")

                with (
                    patch.object(desktop_launch.sys, "platform", "win32"),
                    patch.object(desktop_launch.sys, "executable", str(python)),
                    patch.object(desktop_launch.subprocess, "run", side_effect=run),
                ):
                    path, reason = desktop_launch.find_pythonw()
                    self.assertIsNone(path)
                    self.assertTrue(reason)
                    self.start_logging()
                    created, settings = desktop_launch.create_shortcut(self.local)
                self.assertTrue(created)
                self.assertEqual(settings["DW_SHORTCUT_TARGET"], str(self.local / "Start Document Writer.bat"))
                self.assertEqual(settings["DW_SHORTCUT_ARGUMENTS"], "")
                self.assertIn("Windowless start is unavailable", self.log_text())

    def test_shortcut_failure_is_logged_and_named_but_not_fatal(self):
        error = subprocess.CalledProcessError(1, ["powershell"], b"", b"Access to the path is denied.")
        self.start_logging()
        with (
            patch.object(desktop_launch.sys, "platform", "win32"),
            patch.object(desktop_launch, "find_pythonw", return_value=(None, "test")),
            patch.object(desktop_launch.subprocess, "run", side_effect=error),
        ):
            created, settings = desktop_launch.create_shortcut(self.local)
        self.assertFalse(created)
        self.assertTrue(settings)
        self.assertIn("Access to the path is denied.", self.log_text())
        # The launcher names the manual path in the console and log.
        text = (ROOT / "helper/launch.py").read_text(encoding="utf-8")
        self.assertIn("A desktop shortcut could not be created. Start the installed launcher directly: ", text)

    # ---------------------------------------------------------------- console-free child processes

    def test_every_helper_subprocess_call_states_its_window_flags(self):
        missing = []
        for path in sorted((ROOT / "helper").glob("*.py")):
            for node in ast.walk(ast.parse(path.read_bytes())):
                if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
                    continue
                owner = ast.unparse(node.func.value)
                if owner == "subprocess" and node.func.attr in {"run", "Popen", "call", "check_call", "check_output"}:
                    if "creationflags" not in {k.arg for k in node.keywords}:
                        missing.append("%s:%d" % (path.name, node.lineno))
                if owner == "os" and node.func.attr in {"system", "popen", "spawnl", "spawnv"}:
                    missing.append("%s:%d os.%s" % (path.name, node.lineno, node.func.attr))
        self.assertEqual(missing, [])
        self.assertEqual(runtime_paths.CREATE_NO_WINDOW, 0x08000000)
        with patch.object(runtime_paths.sys, "platform", "win32"):
            self.assertEqual(runtime_paths.no_window(), NO_WINDOW)
        with patch.object(runtime_paths.sys, "platform", "linux"):
            self.assertEqual(runtime_paths.no_window(), 0)
        # The share-side hand-off cannot import runtime_paths: it carries the literal value and
        # hides the child only when there is no console to share.
        text = (ROOT / "helper/launch.py").read_text(encoding="utf-8")
        self.assertIn("CREATE_NO_WINDOW = 0x08000000", text)
        self.assertIn('flags = CREATE_NO_WINDOW if sys.platform == "win32" and sys.stdout is None else 0', text)

    def test_runtime_children_receive_no_window_on_windows(self):
        seen = {}

        def capture(name, result=None):
            def call(*args, **kwargs):
                seen[name] = kwargs.get("creationflags")
                if isinstance(result, Exception):
                    raise result
                return result

            return call

        with patch.object(runtime_paths.sys, "platform", "win32"):
            # Offline parser installation (pip), with its failure output kept for the log.
            with tempfile.TemporaryDirectory() as folder:
                root = Path(folder)
                (root / "requirements-runtime.txt").write_text("synthetic lock", encoding="utf-8")
                failure = subprocess.CalledProcessError(1, ["pip"], "", "ERROR: no matching wheel")
                with (
                    patch.object(install_runtime.sys, "platform", "win32"),
                    patch.object(install_runtime.platform, "machine", return_value="AMD64"),
                    patch.object(install_runtime.subprocess, "run", side_effect=capture("pip", failure)),
                ):
                    result = install_runtime.install(root)
                self.assertFalse(result["available"])
                self.assertIn("no matching wheel", result["detail"])
            # Session-file privacy (PowerShell).
            with patch.object(helper_session.subprocess, "run", side_effect=capture("acl")):
                helper_session.windows_privacy(self.root / "session.json")
            # PDF rendering (headless Chrome/Edge).
            with (
                patch.object(server, "find_chrome", return_value="chrome.exe"),
                patch.object(server.subprocess, "run", side_effect=capture("pdf", subprocess.CompletedProcess([], 1, b"", b"renderer failed"))),
            ):
                with self.assertRaisesRegex(RuntimeError, "renderer failed"):
                    server.make_pdf("<!doctype html><html><head></head><body>x</body></html>", self.root / "out.pdf")
            # Outlook draft hand-off.
            with (
                patch.object(server, "find_outlook", return_value="OUTLOOK.EXE"),
                patch.object(server.subprocess, "Popen", side_effect=capture("outlook")),
            ):
                server.open_in_outlook(self.root / "a.pdf", "subject", "body")
            # Hidden helper and browser window.
            with patch.object(desktop_launch.sys, "platform", "win32"), patch.object(desktop_launch.subprocess, "Popen") as popen:
                desktop_launch.start_background_helper(self.local, {"DW_PORT": "8777"})
                kwargs = popen.call_args.kwargs
                self.assertEqual(kwargs["creationflags"], NO_WINDOW | desktop_launch.CREATE_NEW_PROCESS_GROUP)
                self.assertIs(kwargs["stdin"], subprocess.DEVNULL)
                self.assertIs(kwargs["stdout"], subprocess.DEVNULL)
                self.assertIs(kwargs["stderr"], subprocess.DEVNULL)
                self.assertTrue(kwargs["close_fds"])
                self.assertFalse(kwargs["start_new_session"])
                self.assertEqual(popen.call_args.args[0], [sys.executable, "-B", str(self.local / "server.py")])
                self.assertEqual(kwargs["env"], {"DW_PORT": "8777"})
        self.assertEqual(seen, {"pip": NO_WINDOW, "acl": NO_WINDOW, "pdf": NO_WINDOW, "outlook": NO_WINDOW})
        # case_lookup runs only on Windows and already uses the Windows constant.
        self.assertIn("creationflags=subprocess.CREATE_NO_WINDOW", (ROOT / "helper/case_lookup.py").read_text(encoding="utf-8"))

    # ---------------------------------------------------------------- app window

    def browsers(self, chrome=False, edge=False):
        """Fresh Program Files folders holding only the requested browsers."""
        programs = Path(tempfile.mkdtemp(dir=self.root))
        for name, present, tail in [("pf", chrome, "Google/Chrome/Application/chrome.exe"), ("pf86", edge, "Microsoft/Edge/Application/msedge.exe")]:
            if present:
                (programs / name / tail).parent.mkdir(parents=True)
                (programs / name / tail).write_bytes(b"")
        return patch.dict(
            os.environ, {"ProgramFiles": str(programs / "pf"), "ProgramFiles(x86)": str(programs / "pf86"), "LOCALAPPDATA": str(self.profile)}
        )

    def test_app_window_uses_chrome_then_edge_in_the_existing_profile(self):
        url = "http://127.0.0.1:8777/madison-document-writer.html#session=" + TOKEN
        self.start_logging()
        for chrome, edge, expected in [(True, True, "chrome.exe"), (False, True, "msedge.exe")]:
            with self.subTest(expected=expected), self.browsers(chrome, edge):
                with (
                    patch.object(desktop_launch.sys, "platform", "win32"),
                    patch.object(desktop_launch.subprocess, "Popen") as popen,
                    patch("webbrowser.open") as fallback,
                ):
                    self.assertTrue(desktop_launch.open_app_window())
                command = popen.call_args.args[0]
                self.assertEqual(Path(command[0]).name, expected)
                self.assertEqual(command[1:], ["--app=" + url])
                self.assertFalse(any("user-data-dir" in part or "profile" in part.lower() for part in command[1:]))
                self.assertEqual(popen.call_args.kwargs["creationflags"], NO_WINDOW)
                fallback.assert_not_called()
        with self.browsers(), patch.object(desktop_launch.subprocess, "Popen") as popen, patch("webbrowser.open", return_value=True) as fallback:
            self.assertTrue(desktop_launch.open_app_window())
        popen.assert_not_called()
        fallback.assert_called_once_with(url)
        with self.browsers(), patch("webbrowser.open", return_value=False):
            self.assertFalse(desktop_launch.open_app_window())
        with self.browsers(chrome=True), patch.object(desktop_launch.subprocess, "Popen", side_effect=OSError("blocked")):
            with patch("webbrowser.open", return_value=True) as fallback:
                self.assertTrue(desktop_launch.open_app_window())
            fallback.assert_called_once_with(url)
        log = self.log_text()
        self.assertIn("Chrome and Edge were not found", log)
        self.assertNotIn(TOKEN, log)
        self.assertNotIn("#session", log)

    # ---------------------------------------------------------------- start-up, reuse, dialogs and log

    def start_logging(self):
        return desktop_launch.start_logging(self.local)

    def install_fixture(self):
        (self.local / "verified-install.json").write_text(json.dumps({"helperBuild": 58}), encoding="utf-8")
        for name in launch.REQUIRED:
            (self.local / name).parent.mkdir(parents=True, exist_ok=True)
            (self.local / name).write_text("synthetic installed file", encoding="utf-8")

    def run_launcher(self, *patches):
        with contextlib.ExitStack() as stack:
            for item in patches:
                stack.enter_context(item)
            return launch.run(["launch.py"])

    def test_compatible_helper_is_reused_without_update_and_opens_the_app_window(self):
        self.windowless()
        connection = MagicMock()
        with self.browsers(chrome=True), patch.object(desktop_launch.subprocess, "Popen") as popen:
            code = self.run_launcher(
                patch.object(launch.socket, "create_connection", return_value=connection),
                patch.object(desktop_launch, "local_status", return_value={"ok": True, "version": launch.VERSION, "ready": True}),
                patch.object(verified_update, "stage_update", side_effect=AssertionError("no update under a running helper")),
            )
        self.assertEqual(code, 0)
        self.assertEqual(popen.call_args.args[0][1], "--app=http://127.0.0.1:8777/madison-document-writer.html#session=" + TOKEN)
        self.assertEqual(self.boxes, [])
        log = self.log_text()
        self.assertIn("Document Writer is already running", log)
        self.assertNotIn(TOKEN, log)

    def test_a_running_helper_makes_way_for_a_newer_shared_release(self):
        share = self.root / "share-newer"
        share.mkdir()
        manifest = share / "runtime-manifest.json"
        current = {"ok": True, "version": launch.VERSION, "ready": True}
        self.start_logging()

        def attempt(status, stop=(), stopped=True, opened=True):
            with (
                patch.object(desktop_launch, "local_status", return_value=status),
                patch.object(desktop_launch, "stop_running_helper", return_value=list(stop)) as asked,
                patch.object(desktop_launch, "wait_until_stopped", return_value=stopped),
                patch.object(desktop_launch, "open_app_window", return_value=opened),
            ):
                try:
                    return launch.reuse_running_helper(self.local, share), asked.called
                except RuntimeError as error:
                    return str(error), asked.called

        # Same release, nothing newer deployed: reuse it, ask nothing.
        manifest.write_text(json.dumps({"helperBuild": launch.HELPER_BUILD}), encoding="utf-8")
        self.assertEqual(attempt(current), (True, False))
        self.assertFalse(launch.needs_replacement(None, self.local))
        # A newer release on the share: ask the running helper to stop, then install and start the newest.
        manifest.write_text(json.dumps({"helperBuild": launch.HELPER_BUILD + 1}), encoding="utf-8")
        self.assertTrue(launch.needs_replacement(share, self.local))
        self.assertEqual(attempt(current), (False, True))
        # It refuses while working: say what it is doing and how to continue.
        message, asked = attempt(current, stop=["A case record is being saved to the shared folder."])
        self.assertTrue(asked)
        self.assertIn("A newer version of Document Writer is on the shared folder", message)
        self.assertIn("A case record is being saved", message)
        self.assertEqual(attempt(current, stopped=False)[0], desktop_launch.PORT_IN_USE)
        # An older helper that cannot be stopped keeps the existing instructions.
        self.assertEqual(attempt({"ok": True, "version": "2026.10.01.40"}, stop=["no route"])[0], desktop_launch.OLDER_HELPER)
        # After a failed verification the next start re-checks the shared release, even with the same build.
        manifest.write_text(json.dumps({"helperBuild": launch.HELPER_BUILD}), encoding="utf-8")
        (self.local / runtime_paths.UPDATE_BLOCKED).write_text("{}", encoding="utf-8")
        self.assertEqual(attempt(current), (False, True))
        (self.local / runtime_paths.UPDATE_BLOCKED).unlink()

    def test_stop_request_carries_the_session_token_and_reports_refusals(self):
        sent = []

        class Connection:
            def __init__(self, host, port, timeout):
                self.target = (host, port)

            def request(self, method, path, body=None, headers=None):
                sent.append((self.target, method, path, body, headers))

            def getresponse(self):
                return reply

            def close(self):
                pass

        class Reply:
            def __init__(self, status, value):
                self.status, self.value = status, value

            def read(self, limit):
                return json.dumps(self.value).encode()

        self.start_logging()
        with (
            patch.object(desktop_launch.helper_session, "launch_token", return_value=TOKEN),
            patch.object(desktop_launch.http.client, "HTTPConnection", Connection),
        ):
            reply = Reply(200, {"ok": True, "stopping": True})
            self.assertEqual(desktop_launch.stop_running_helper(), [])
            reply = Reply(409, {"ok": False, "reasons": ["A PDF is being made or filed."]})
            self.assertEqual(desktop_launch.stop_running_helper(), ["A PDF is being made or filed."])
        self.assertEqual(sent[0][:4], (("127.0.0.1", desktop_launch.PORT), "POST", "/helper/shutdown", b"{}"))
        self.assertEqual(sent[0][4], {"Content-Type": "application/json", "X-DocWriter-Token": TOKEN})
        with patch.object(desktop_launch.helper_session, "launch_token", side_effect=ValueError("no session")):
            self.assertEqual(desktop_launch.stop_running_helper(), ["it could not be asked to stop"])
        self.assertNotIn(TOKEN, self.log_text())

    def test_incompatible_helper_and_foreign_program_show_readable_dialogs(self):
        self.windowless()
        older = {"ok": True, "version": "2026.10.01.40", "ready": True}
        for label, urlopen, expected in [
            ("older helper", {"return_value": older}, "older version of Document Writer is still running"),
            ("foreign program", {"side_effect": OSError("not a Document Writer helper")}, "Port 8777 is already in use by another program"),
        ]:
            with self.subTest(label=label):
                self.boxes.clear()
                code = self.run_launcher(
                    patch.object(launch.socket, "create_connection", return_value=MagicMock()),
                    patch.object(desktop_launch, "local_status", **urlopen),
                    patch.object(verified_update, "stage_update", side_effect=AssertionError("must not update")),
                )
                self.assertEqual(code, 1)
                ((text, flags),) = self.boxes
                self.assertIn(expected, text)
                self.assertIn("Document Writer could not start.", text)
                self.assertIn(str(self.local / "logs" / "launcher.log"), text)
                self.assertEqual(flags & desktop_launch.MB_ICONERROR, desktop_launch.MB_ICONERROR)
                self.assertIn(expected, self.log_text())
        self.assertIn("Exit Document Writer", desktop_launch.OLDER_HELPER)
        self.assertNotIn("command window", desktop_launch.OLDER_HELPER)

    def desktop_start(self, share_text, stage_update=None):
        """Run the installed desktop launcher with no running helper, recording each step."""
        self.install_fixture()
        (self.local / "share.txt").write_text(share_text, encoding="utf-8")
        steps = []
        with self.browsers(chrome=True):
            code = self.run_launcher(
                patch.object(launch.socket, "create_connection", side_effect=OSError("free")),
                patch.object(launch, "__file__", str(self.local / "launch.py")),
                patch.object(launch.sys, "argv", [str(self.local / "launch.py")]),
                patch.object(verified_update, "stage_update", side_effect=stage_update or AssertionError("offline")),
                patch.object(desktop_launch, "create_shortcut", side_effect=lambda local: steps.append("shortcut") or (True, {})),
                patch.object(launch.install_runtime, "install", return_value={"available": True}),
                patch.object(desktop_launch, "start_background_helper", side_effect=lambda local, env: steps.append(("helper", env)) or Process()),
                patch.object(desktop_launch, "wait_until_ready", side_effect=lambda process, version: steps.append("ready") or "ready"),
                patch.object(desktop_launch.subprocess, "Popen", side_effect=lambda *a, **k: steps.append(("browser", a[0]))),
                patch.object(launch.subprocess, "call", side_effect=AssertionError("desktop launches never block on the helper")),
            )
        return code, steps

    def test_offline_share_starts_the_installed_copy_hidden_and_exits(self):
        self.windowless()
        code, steps = self.desktop_start(str(self.root / "missing share"))
        self.assertEqual(code, 0)
        self.assertEqual([s if isinstance(s, str) else s[0] for s in steps], ["shortcut", "helper", "ready", "browser"])
        env = steps[1][1]
        self.assertEqual(env["DW_PORT"], "8777")
        self.assertNotIn("DW_OPEN_BROWSER", env)
        self.assertEqual(self.boxes, [])
        self.assertIn("The shared folder is unavailable. Starting the installed copy", self.log_text())

    def test_changed_verified_release_restarts_before_using_old_imports(self):
        self.windowless()
        self.install_fixture()
        share = self.root / "new release"
        share.mkdir()
        (self.local / "share.txt").write_text(str(share), encoding="utf-8")
        approved = {**launch.MANIFEST, "helperVersion": "2099.01.01.999", "helperBuild": 999, "files": {"server.py": {}}}
        with (
            patch.object(launch.socket, "create_connection", side_effect=OSError("free")),
            patch.object(launch, "__file__", str(self.local / "launch.py")),
            patch.object(launch.sys, "argv", [str(self.local / "launch.py")]),
            patch.object(verified_update, "stage_update", return_value=approved),
            patch.object(launch.install_release, "install") as install,
            patch.object(desktop_launch, "start_background_helper", side_effect=AssertionError("old imports must not start the new helper")),
            patch.object(desktop_launch, "create_shortcut", side_effect=AssertionError("restart before using old launch code")),
            patch.object(launch.subprocess, "call", return_value=0) as restart,
        ):
            self.assertEqual(launch.run(["launch.py"]), 0)
        install.assert_called_once()
        self.assertEqual(restart.call_args.args[0], [sys.executable, "-B", str(self.local / "launch.py")])
        self.assertEqual(restart.call_args.kwargs["cwd"], str(self.local))
        self.assertEqual(restart.call_args.kwargs["creationflags"], NO_WINDOW)
        self.assertEqual((self.local / "share.txt").read_text(encoding="utf-8"), str(share))

    def test_damaged_required_file_metadata_reports_repair_instead_of_silent_exit(self):
        import ctypes

        manifest = self.root / "damaged-manifest.json"
        for value in ({}, {"required": None}, {"required": "server.py"}):
            manifest.write_text(json.dumps(value), encoding="utf-8")
            with (
                self.subTest(value=value),
                patch.object(runtime_paths, "resource", return_value=manifest),
                patch.object(sys, "platform", "win32"),
                patch.object(sys, "stdout", None),
                patch.object(ctypes, "windll", create=True) as windows,
                self.assertRaises(SystemExit) as stopped,
            ):
                runpy.run_path(str(ROOT / "helper/launch.py"), run_name="__main__")
            self.assertEqual(stopped.exception.code, 1)
            message = windows.user32.MessageBoxW.call_args.args[1]
            self.assertIn("incomplete or damaged", message)
            self.assertIn("Ask IT to repair", message)

    def test_update_check_uses_the_verifier_and_rejection_keeps_the_installed_version(self):
        self.windowless()
        share = self.root / "share"
        share.mkdir()
        (share / "runtime-manifest.json").write_text("{}", encoding="utf-8")
        real = verified_update.stage_update
        seen = []

        def verifier(*args):
            seen.append(args)
            return real(*args)

        code, steps = self.desktop_start(str(share), verifier)
        self.assertEqual(code, 0)
        self.assertEqual(len(seen), 1)
        self.assertEqual(Path(seen[0][0]), share.resolve())
        self.assertIn("browser", [s if isinstance(s, str) else s[0] for s in steps])
        ((text, flags),) = self.boxes
        self.assertIn("The shared program files failed verification; this computer kept its current version. Tell IT.", text)
        self.assertIn("started with the version already installed", text)
        self.assertEqual(flags & desktop_launch.MB_ICONWARNING, desktop_launch.MB_ICONWARNING)
        self.assertTrue((self.local / "update-diagnostic.txt").is_file())
        # Shared saves stay paused until a later start verifies the shared release.
        self.assertIn("Saving to the shared folder is paused", text)
        self.assertIn("failed verification", json.loads((self.local / runtime_paths.UPDATE_BLOCKED).read_text())["reason"])

    def test_missing_installation_or_helper_failure_stops_with_a_dialog_and_no_token_in_the_log(self):
        self.windowless()
        self.install_fixture()
        (self.local / "server.py").unlink()
        code = self.run_launcher(
            patch.object(launch.socket, "create_connection", side_effect=OSError("free")),
            patch.object(launch, "__file__", str(self.local / "launch.py")),
            patch.object(launch.sys, "argv", [str(self.local / "launch.py")]),
        )
        self.assertEqual(code, 1)
        ((text, _),) = self.boxes
        self.assertIn("independently verified package", text)
        self.boxes.clear()
        (self.local / "server.py").write_text("synthetic", encoding="utf-8")
        with self.browsers(chrome=True):
            code = self.run_launcher(
                patch.object(launch.socket, "create_connection", side_effect=OSError("free")),
                patch.object(launch, "__file__", str(self.local / "launch.py")),
                patch.object(launch.sys, "argv", [str(self.local / "launch.py")]),
                patch.object(desktop_launch, "create_shortcut", return_value=(True, {})),
                patch.object(launch.install_runtime, "install", return_value={"available": True}),
                patch.object(desktop_launch, "start_background_helper", return_value=Process(1)),
                patch.object(desktop_launch, "helper_version", return_value=None),
            )
        self.assertEqual(code, 1)
        ((text, _),) = self.boxes
        self.assertIn("local helper did not start", text)
        self.assertIn("Start Document Writer.bat", text)
        log = self.log_text()
        self.assertIn("Helper start: exited.", log)
        self.assertNotIn(TOKEN, log)

    def test_no_browser_dialog_gives_a_next_step_without_the_session_address(self):
        self.windowless()
        with self.browsers():
            code = self.run_launcher(
                patch.object(launch.socket, "create_connection", return_value=MagicMock()),
                patch.object(desktop_launch, "local_status", return_value={"version": launch.VERSION}),
                patch("webbrowser.open", return_value=False),
            )
        self.assertEqual(code, 1)
        ((text, _),) = self.boxes
        self.assertIn("Google Chrome or Microsoft Edge", text)
        self.assertNotIn(TOKEN, text)
        self.assertNotIn("8777/", text)

    def test_pythonw_without_streams_logs_print_output_and_never_crashes(self):
        self.windowless()
        self.start_logging()
        self.assertTrue(desktop_launch.windowless())
        print("diagnostic line from a library")
        sys.stderr.write("traceback text\n")
        desktop_launch.say("progress only in the log")
        log = self.log_text()
        for line in ["diagnostic line from a library", "traceback text", "progress only in the log"]:
            self.assertIn(line, log)

    def test_console_launch_prints_and_keeps_the_helper_in_the_console(self):
        output = io.StringIO()
        with patch.object(sys, "stdout", output):
            self.assertFalse(desktop_launch.windowless())
            desktop_launch.say("Checking the shared release before updating.")
            desktop_launch.report_failure("synthetic failure")
        self.assertIn("Checking the shared release", output.getvalue())
        self.assertIn("Document Writer could not start:", output.getvalue())
        self.assertEqual(self.boxes, [])
        text = (ROOT / "helper/launch.py").read_text(encoding="utf-8")
        self.assertIn('env["DW_OPEN_BROWSER"] = "1"', text)
        self.assertIn('subprocess.call([sys.executable, "-B", str(local / "server.py")], cwd=local, env=env, creationflags=0)', text)
        bat = (ROOT / "helper/Start_Document_Writer.bat").read_text(encoding="utf-8")
        self.assertIn("Document Writer (diagnostics)", bat)

    def test_readiness_polling_and_log_folder_command(self):
        with patch.object(desktop_launch, "helper_version", side_effect=[None, None, launch.VERSION]):
            self.assertEqual(desktop_launch.wait_until_ready(Process(), launch.VERSION, timeout=5, interval=0), "ready")
        with patch.object(desktop_launch, "local_status", side_effect=desktop_launch.http.client.BadStatusLine("not http")):
            self.assertIsNone(desktop_launch.helper_version())
        with patch.object(desktop_launch, "helper_version", return_value=None):
            self.assertEqual(desktop_launch.wait_until_ready(Process(0), launch.VERSION, timeout=5, interval=0), "exited")
            self.assertEqual(desktop_launch.wait_until_ready(Process(), launch.VERSION, timeout=0, interval=0), "timeout")
        with patch.object(desktop_launch.sys, "platform", "win32"), patch.object(desktop_launch.os, "startfile", create=True) as startfile:
            self.assertEqual(launch.run(["launch.py", "--open-logs"]), 0)
        startfile.assert_called_once_with(str(self.local / "logs"))

    def test_startup_indicator_degrades_without_tkinter(self):
        self.start_logging()
        with patch.dict(sys.modules, {"tkinter": None}):
            splash = desktop_launch.Splash().start(delay=0)
            splash.thread.join(timeout=5)
            splash.close()
        self.assertFalse(splash.thread.is_alive())
        self.assertIn("Start-up indicator unavailable", self.log_text())
        quick = desktop_launch.Splash().start(delay=5)
        quick.close()
        self.assertFalse(quick.thread.is_alive())

    # ---------------------------------------------------------------- favicon and icon

    def test_favicon_is_public_secret_free_and_permitted_by_the_csp(self):
        http = server.Server(("127.0.0.1", 0), server.Handler)
        port = server.PORT
        server.PORT = http.server_address[1]
        thread = threading.Thread(target=http.serve_forever, daemon=True)
        thread.start()
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/favicon.ico" % server.PORT) as response:
                body, headers = response.read(), dict(response.headers)
            self.assertEqual(headers["Content-Type"], "image/x-icon")
            self.assertEqual(body, (ROOT / "app/assets/document-writer.ico").read_bytes())
            self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
            self.assertNotIn("Set-Cookie", headers)
            self.assertNotIn(server.SESSION_TOKEN.encode(), body)
            self.assertNotIn(server.SESSION_TOKEN, json.dumps(headers))
            with patch.object(desktop_launch, "PORT", server.PORT), patch.dict(os.environ, {"HTTP_PROXY": "http://proxy.invalid:9", "NO_PROXY": ""}):
                self.assertEqual(desktop_launch.local_status(), {"ok": True, "version": server.HELPER_VERSION, "ready": True})
                self.assertEqual(desktop_launch.helper_version(), server.HELPER_VERSION)
            with self.assertRaises(urllib.error.HTTPError) as refused:
                urllib.request.urlopen("http://127.0.0.1:%d/favicon.png" % server.PORT)
            self.assertEqual(refused.exception.code, 403)
        finally:
            http.shutdown()
            http.server_close()
            thread.join()
            server.PORT = port
        policy = server.render_security.app_policy("<html></html>")
        self.assertIn("img-src 'self'", policy)
        manifest = json.loads((ROOT / "tools/runtime-manifest.template.json").read_text(encoding="utf-8"))
        for name, source in [("document-writer.ico", "app/assets/document-writer.ico"), ("desktop_launch.py", "helper/desktop_launch.py")]:
            self.assertIn(name, manifest["required"])
            self.assertEqual(manifest["deploy"][name], source)

    def test_icon_has_windows_sizes_and_matches_its_svg_source(self):
        record = json.loads((ROOT / "app/assets/document-writer-icon.json").read_text(encoding="utf-8"))
        source = ROOT / "app/assets" / record["source"]
        icon = ROOT / "app/assets" / record["icon"]
        self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), record["sourceSha256"], "run python3 tools/build_icon.py")
        self.assertEqual(hashlib.sha256(icon.read_bytes()).hexdigest(), record["iconSha256"], "run python3 tools/build_icon.py")
        images = build_icon.read_ico(icon.read_bytes())
        self.assertEqual(sorted(images), [16, 32, 48, 256])
        self.assertEqual(record["sizes"], [16, 32, 48, 256])
        for size, png in images.items():
            self.assertEqual(build_icon.png_size(png), (size, size))
        self.assertEqual(build_icon.read_ico(build_icon.pack_ico([images[s] for s in (16, 32, 48, 256)])), images)
        svg = source.read_text(encoding="utf-8")
        self.assertIn('class="detail"', svg)
        self.assertIn(".detail{display:none}", build_icon.variant(svg, 16))
        self.assertNotIn(".detail{display:none}", build_icon.variant(svg, 48))


if __name__ == "__main__":
    unittest.main()
