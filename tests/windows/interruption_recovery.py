"""Real process-death recovery on a disposable Windows runner; synthetic records only.

Barriers pause immediately before/after real filesystem operations. The parent terminates the child, so Python
exception handlers and finally blocks cannot simulate recovery. --portable exercises shared logic locally but
never writes native-Windows evidence. Windows-only handle and SMB tests are mandatory in --require-windows mode.
"""

import argparse
import copy
import ctypes
import hashlib
import json
import locale
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / p) for p in ("helper", "tools", "policy", "tests/unit", "tests/fixtures", "build/generated")]

import case_integrity
import case_store
import install_release
import operations_helper
import verified_update
from audit_r28_helper import pair
from release_evidence import fingerprint, source_provenance

NAME = "101 TEST LANE - QA-LIFE.json"
ADMIN = "Synthetic Windows recovery operator"
REASON = "Verified the synthetic owning process has stopped; exercise token-bound recovery on isolated test data."


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.flush()
        os.fsync(stream.fileno())


def fixture():
    value = pair()
    value["schema"] = 5
    value["case"]["owner"] = "Jos\u00e9 \u2014 SYNTHETIC OWNER"
    for event in value["events"]:
        event["payload"]["snapshot"]["frozen"]["case"]["owner"] = value["case"]["owner"]
    return value


def append_request(folder):
    first = case_store.save_case(folder, NAME, fixture())
    value = copy.deepcopy(first["file"])
    value["events"].append(
        {
            "id": "windows_recovery_note",
            "type": "document.annotated",
            "at": "2026-09-01T12:00:00Z",
            "by": "inspector_1",
            "payload": {"docId": "notice_1", "text": "Synthetic retained note: Jos\u00e9 \u2014 unchanged."},
        }
    )
    return {"incoming": value, "revision": first["revision"], "baseCase": first["file"]["case"]}


def save_request(folder, request):
    return case_store.save_case(folder, NAME, request["incoming"], request["revision"], request["baseCase"], "windows_recovery_note")


def barrier(config):
    dump(Path(config["control"]) / "ready.json", {"pid": os.getpid(), "phase": config["phase"]})
    while not (Path(config["control"]) / "continue").exists():
        time.sleep(0.01)


def worker(config):
    folder = Path(config["folder"])
    mode, phase = config["mode"], config["phase"]
    if mode == "lock":
        with case_store.file_lock(folder, "case:" + case_store.case_number_key("QA-LIFE")):
            barrier(config)
        return
    if mode == "install":
        staging = Path(config["staging"])
        replace, unlink = os.replace, Path.unlink
        count = 0

        def replace_at(source, target):
            nonlocal count
            result = replace(source, target)
            if Path(source).is_relative_to(staging):
                count += 1
                if phase == "file:" + str(count):
                    barrier(config)
            elif Path(target).name == "install-transaction.json" and phase == "journal":
                barrier(config)
            return result

        def unlink_at(path, *args, **kwargs):
            result = unlink(path, *args, **kwargs)
            if path == folder / "install-transaction.json" and phase == "commit":
                barrier(config)
            return result

        os.replace, Path.unlink = replace_at, unlink_at
        install_release.install(staging, folder, config["names"])
        return
    if mode == "recover-install":
        return install_release.recover(folder)
    replace = os.replace

    def replace_at(source, target):
        target = Path(target)
        selected = target == folder / NAME
        if selected and phase == "before-case":
            barrier(config)
        result = replace(source, target)
        if (
            selected
            and phase == "after-case"
            or target.parent.name == "transactions"
            and phase == "intent"
            or target.name == "migrated.json"
            and phase == "registry"
        ):
            barrier(config)
        return result

    os.replace = replace_at
    if mode == "publish":
        return case_store.save_case(folder, NAME, fixture(), idempotency_event="initial_citation_event")
    if mode == "append":
        return save_request(folder, config["request"])
    raise ValueError("Unknown synthetic worker mode")


class Child:
    def __init__(self, root, config):
        self.control = root / ("control-" + uuid.uuid4().hex)
        config = {**config, "control": str(self.control)}
        path = self.control / "input.json"
        dump(path, config)
        self.process = subprocess.Popen(
            [sys.executable, "-B", str(Path(__file__).resolve()), "--worker", str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )

    def ready(self):
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if (self.control / "ready.json").exists():
                return
            if self.process.poll() is not None:
                out, err = self.process.communicate()
                raise AssertionError("Worker exited before interruption barrier: " + (out + err).decode("utf-8", errors="replace"))
            time.sleep(0.02)
        raise AssertionError("Worker did not reach its interruption barrier")

    def kill(self):
        self.process.kill()  # TerminateProcess on Windows: no Python cleanup runs.
        self.process.communicate(timeout=20)
        assert self.process.returncode != 0

    def continue_failure(self):
        (self.control / "continue").touch()
        self.process.communicate(timeout=30)
        assert self.process.returncode != 0, "Disconnected SMB operation must not acknowledge a save"
        assert json.loads((self.control / "outcome.json").read_text(encoding="utf-8"))["ok"] is False


def orphan_locks(folder):
    return sorted((folder / ".locks").glob("*.lock"))


def release_orphans(folder):
    for path in orphan_locks(folder):
        resource = next(key for key in ["case:QA-LIFE", *operations_helper.GLOBAL_LOCKS] if operations_helper.lock_path(folder, resource=key) == path)
        current = operations_helper.lock_status(folder, resource=resource)
        assert current["ownership"] == "local" and current["ownerRunning"] is False
        result = operations_helper.release_lock(
            folder,
            {"number": "QA-LIFE", "resource": resource, "token": current["token"], "administrator": ADMIN, "reason": REASON, "confirmed": True},
        )
        assert result["released"] is True
    assert not orphan_locks(folder)


def installation(root, phase):
    base = root / ("install-" + phase.replace(":", "-"))
    local, share, stage = [base / p for p in ("local", "share", "stage")]
    for directory in (local, share, stage):
        directory.mkdir(parents=True)
    old = {
        "server.py": b"old synthetic server",
        "verified-install.json": b'{"helperBuild":74,"helperVersion":"2026.11.04.74"}',
        "vendor/python/demo.py": b"old synthetic vendor",
    }
    new = {"server.py": b"new synthetic server", "new.py": b"new synthetic module", "vendor/python/demo.py": b"new synthetic vendor"}
    for name, body in old.items():
        path = local / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    for name, body in new.items():
        path = share / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    identity = json.loads((ROOT / "version.json").read_text(encoding="utf-8"))
    dump(
        share / "runtime-manifest.json",
        {**identity, "files": {name: {"size": len(body), "sha256": hashlib.sha256(body).hexdigest()} for name, body in new.items()}},
    )
    verified_update.stage_update(share, stage, local)
    names = list(new) + ["runtime-manifest.json", "verified-install.json"]
    expected = {name: (stage / name).read_bytes() for name in names}
    (local / "private-state.txt").write_bytes(b"retained synthetic private state")
    child = Child(root, {"mode": "install", "phase": phase, "folder": str(local), "staging": str(stage), "names": names})
    try:
        child.ready()
    finally:
        if child.process.poll() is None:
            child.kill()
    recovery = Child(root, {"mode": "recover-install", "phase": "none", "folder": str(local)})
    recovery.process.communicate(timeout=20)
    assert recovery.process.returncode == 0
    committed = phase == "commit"
    for name in names:
        if committed:
            assert (local / name).read_bytes() == expected[name]
        elif name in old:
            assert (local / name).read_bytes() == old[name]
        else:
            assert not (local / name).exists()
    assert (local / "private-state.txt").read_bytes() == b"retained synthetic private state"
    assert not (local / "install-transaction.json").exists()
    assert install_release.recover(local) is False
    fresh = base / "restaged"
    fresh.mkdir()
    verified_update.stage_update(share, fresh, local)
    install_release.install(fresh, local, names)
    assert all((local / name).read_bytes() == body for name, body in expected.items())


class SMB:
    def __init__(self, local):
        self.local = local
        self.name = "DWRecovery" + uuid.uuid4().hex[:12]
        self.unc = Path("\\\\localhost\\" + self.name)
        self.present = False

    def action(self, create):
        command = (
            "Start-Service LanmanServer -ErrorAction Stop; New-SmbShare -Name $env:DW_TEST_SHARE -Path $env:DW_TEST_SHARE_PATH "
            '-FullAccess "$env:USERDOMAIN\\$env:USERNAME" -ErrorAction Stop | Out-Null'
            if create
            else "Remove-SmbShare -Name $env:DW_TEST_SHARE -Force -ErrorAction Stop"
        )
        subprocess.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; " + command],
            env={**os.environ, "DW_TEST_SHARE": self.name, "DW_TEST_SHARE_PATH": str(self.local)},
            check=True,
            capture_output=True,
        )
        self.present = create


def windows_locked_target(folder):
    from ctypes import wintypes

    request = append_request(folder)
    before = (folder / NAME).read_bytes()
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
    kernel.CreateFileW.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    handle = kernel.CreateFileW(str(folder / NAME), 0x80000000, 3, None, 3, 0x80, None)  # allow reads/writes, deny deletion/replacement
    assert handle != ctypes.c_void_p(-1).value
    try:
        try:
            save_request(folder, request)
        except PermissionError:
            pass
        else:
            raise AssertionError("An NTFS handle denying delete sharing must refuse replacement")
        assert (folder / NAME).read_bytes() == before
    finally:
        kernel.CloseHandle(handle)
    assert save_request(folder, request)["ok"] is True
    assert case_store.read_case(folder, NAME)["integrity"]["valid"] is True


def windows_filesystem(folder):
    from ctypes import wintypes

    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetVolumeInformationW.argtypes = [
        wintypes.LPCWSTR,
        wintypes.LPWSTR,
        wintypes.DWORD,
        ctypes.POINTER(wintypes.DWORD),
        ctypes.POINTER(wintypes.DWORD),
        ctypes.POINTER(wintypes.DWORD),
        wintypes.LPWSTR,
        wintypes.DWORD,
    ]
    filesystem = ctypes.create_unicode_buffer(64)
    assert kernel.GetVolumeInformationW(Path(folder).anchor, None, 0, None, None, None, filesystem, 64)
    assert filesystem.value == "NTFS", "Native delete-sharing evidence requires the observed NTFS volume"
    return filesystem.value


def run(root, results, native):
    pending = []
    children = []
    share = None
    try:
        for phase in ("intent", "after-case", "registry", "before-case", "append-after-case"):
            folder = root / phase
            folder.mkdir()
            mode = "append" if phase.startswith("before") or phase.startswith("append") else "publish"
            request = append_request(folder) if mode == "append" else None
            old = (folder / NAME).read_bytes() if request else None
            config = {"mode": mode, "phase": "after-case" if phase == "append-after-case" else phase, "folder": str(folder), "request": request}
            child = Child(root, config)
            children.append(child)
            child.ready()
            child.kill()
            if phase == "before-case":
                assert (folder / NAME).read_bytes() == old
            intent = case_integrity.intent_path(folder, "QA-LIFE")
            genesis = json.loads(intent.read_text(encoding="utf-8"))["record"]["integrity"]["genesis"]["hash"] if intent.exists() else None
            pending.append((phase, folder, request, genesis))
        active = root / "active-lock"
        active.mkdir()
        live = Child(root, {"mode": "lock", "phase": "held", "folder": str(active)})
        children.append(live)
        live.ready()
        for phase in ("journal", "file:1", "file:3", "commit"):
            installation(root, phase)
            results.append({"scenario": "forced-install-" + phase, "passed": True})
        if native:
            locked = root / "locked-target"
            locked.mkdir()
            windows_locked_target(locked)
            results.append({"scenario": "native-NTFS-delete-sharing-refusal-and-retry", "passed": True})
            shared = root / "smb-local"
            shared.mkdir()
            share = SMB(shared)
            share.action(True)
            assert share.unc.is_dir(), "The native SMB test share must be reachable"
            request = append_request(share.unc)
            before = (shared / NAME).read_bytes()
            blocked = Child(root, {"mode": "append", "phase": "before-case", "folder": str(share.unc), "request": request})
            children.append(blocked)
            blocked.ready()
            share.action(False)
            assert not share.unc.is_dir(), "Disconnect injection failed: SMB share remained reachable"
            blocked.continue_failure()
            assert (shared / NAME).read_bytes() == before
            share.action(True)
            pending.append(("SMB-disconnect-before-publish", share.unc, request, None))
        # Use real elapsed age and actual stopped-PID checks. No clock, ownership or recovery policy is mocked.
        all_folders = [folder for _, folder, _, _ in pending] + [active]
        latest = max(json.loads(p.read_text(encoding="utf-8"))["at"] for folder in all_folders for p in orphan_locks(folder))
        remaining = max(0, 30.2 - (time.time() - latest))
        if remaining:
            time.sleep(remaining)
        status = operations_helper.lock_status(active, number="QA-LIFE")
        assert status["ownerRunning"] is True
        data = {"number": "QA-LIFE", "token": status["token"], "administrator": ADMIN, "reason": REASON, "confirmed": True}
        for changed, message in (({**data, "token": "stale"}, "Lock changed"), (data, "still running")):
            try:
                operations_helper.release_lock(active, changed)
            except ValueError as error:
                assert message in str(error)
            else:
                raise AssertionError("Active or token-mismatched lock recovery must refuse")
        live.kill()
        release_orphans(active)
        results.append(
            {"scenario": "native-live-PID-protection-token-refusal-and-orphan-recovery" if native else "portable-lock-recovery", "passed": True}
        )
        for phase, folder, request, genesis in pending:
            release_orphans(folder)
            if request:
                save_request(folder, request)
                again = save_request(folder, request)
                assert again["alreadyCommitted"] is True
                expected = request["incoming"]["events"]
            else:
                again = case_store.save_case(folder, NAME, fixture(), idempotency_event="initial_citation_event")
                expected = fixture()["events"]
            saved = case_store.read_case(folder, NAME)
            assert saved["integrity"]["valid"] is True
            assert saved["file"]["events"] == expected, "No lost, duplicated or changed issued history"
            assert len({e["id"] for e in saved["file"]["events"]}) == len(expected)
            if genesis:
                assert saved["file"]["integrity"]["genesis"]["hash"] == genesis, "Recovery must not regenerate genesis"
            assert not case_integrity.intent_path(folder, "QA-LIFE").exists()
            results.append({"scenario": "forced-case-" + phase, "passed": True})
    finally:
        for child in children:
            if child.process.poll() is None:
                child.kill()
        if share and share.present:
            share.action(False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--worker", type=Path)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--require-windows", action="store_true")
    mode.add_argument("--portable", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "build/windows-recovery/filesystem.json")
    parser.add_argument("--fixture-output", type=Path)
    args = parser.parse_args()
    if args.worker:
        config = json.loads(args.worker.read_text(encoding="utf-8"))
        try:
            result = worker(config)
            dump(Path(config["control"]) / "outcome.json", {"ok": True, "recovered": result if isinstance(result, bool) else None})
        except Exception as error:
            dump(Path(config["control"]) / "outcome.json", {"ok": False, "errorType": type(error).__name__})
            raise
        return
    if args.fixture_output:
        with tempfile.TemporaryDirectory(prefix="dw-fixture-") as temp:
            dump(args.fixture_output, case_store.save_case(Path(temp), NAME, fixture())["file"])
        return
    args.output.unlink(missing_ok=True)
    (args.output.parent / "combined.json").unlink(missing_ok=True)
    if not args.portable and not args.require_windows:
        parser.error("Choose --require-windows or explicitly labelled --portable")
    if args.require_windows and os.name != "nt":
        parser.error("Native Windows evidence requires an actual Windows executor")
    inputs = fingerprint(ROOT)
    provenance = source_provenance(ROOT, inputs)
    if args.require_windows and (provenance["sourceClean"] is not True or not provenance["sourceCommit"]):
        raise ValueError("Native recovery evidence requires an identified, clean reviewed commit")
    report = {
        "format": "madison-interruption-recovery",
        "version": 1,
        "mode": "native-windows" if args.require_windows else "portable-not-Windows-evidence",
        "passed": False,
        "platform": platform.platform(),
        "osName": os.name,
        "python": platform.python_version(),
        "defaultEncoding": locale.getencoding(),
        **provenance,
        "sourceFiles": inputs,
        "identity": {"run": os.environ.get("GITHUB_RUN_ID", "local"), "attempt": os.environ.get("GITHUB_RUN_ATTEMPT", "1")},
        "runtimeHashes": {
            name: hashlib.sha256((ROOT / "build/dist" / name).read_bytes()).hexdigest()
            for name in ("madison-document-writer.html", "madison-reports.html")
        },
        "release": json.loads((ROOT / "version.json").read_text(encoding="utf-8")),
        "checks": [],
        "limits": ["Synthetic isolated data", "No physical power loss", "No City server, domain, desktop or acceptance claim"],
    }
    try:
        with tempfile.TemporaryDirectory(prefix="dw-recovery-") as temp:
            if args.require_windows:
                report["filesystem"] = windows_filesystem(temp)
            run(Path(temp), report["checks"], args.require_windows)
        assert inputs == fingerprint(ROOT), "Source/runtime changed while interruption tests ran"
        report["passed"] = True
    finally:
        dump(args.output, report)
    print(json.dumps({"passed": True, "mode": report["mode"], "checks": len(report["checks"])}))


if __name__ == "__main__":
    main()
