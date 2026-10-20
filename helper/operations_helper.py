"""Local operational assistance. Official record formats are unchanged."""

from helper_logging import logged
import address_parser
import case_lookup
from runtime_identity import VERSION
import case_integrity
import contextlib
import hashlib
import json
import os
from pathlib import Path
import socket
import tempfile
import time
import uuid
from case_store import atomic_write, case_number_key, file_lock


@logged("setup")
def health(server, probe=False):
    try:
        folder = server.case_dir()
    except OSError:
        folder = None
    try:
        share = server.share_root()
    except OSError:
        share = None

    def reachable(path):
        try:
            return bool(path and path.is_dir())
        except OSError:
            return False

    writable = None
    if probe:
        try:
            for target in (folder, share / server.OUTDIR_NAME if share else None):
                if not reachable(target):
                    raise OSError("Folder unavailable")
                with tempfile.NamedTemporaryFile(prefix="._dw-health-", dir=target) as check:
                    check.write(b"Madison setup check")
                    check.flush()
                    os.fsync(check.fileno())
            writable = True
        except OSError:
            writable = False
    try:
        manifest = json.loads(server.resource("catalog_manifest.json").read_text())
        catalog = manifest.get("format") == "madison-catalog-manifest" and isinstance(manifest.get("items"), dict)
    except (OSError, ValueError):
        catalog = False
    try:
        case_lookup.settings(share)
        lookup_configured = True
    except Exception:
        lookup_configured = False
    return {
        "integrityAnchor": case_integrity.anchor_health(folder),
        "addressParser": address_parser.available(),
        "addressParserStatus": "Available" if address_parser.available() else "address parser unavailable; R19 fallback",
        "shareReachable": reachable(share),
        "caseReachable": reachable(folder),
        "shareWritable": writable,
        "catalogManifest": catalog,
        "catalogCheckedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "lookupConfigured": lookup_configured,
        "lookupPlatform": os.name == "nt",
        "lookupConnection": "Not tested",
        "versionMatch": server.HELPER_VERSION == VERSION,
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


GLOBAL_LOCKS = {
    "lock-recovery": "Shared lock recovery",
    "lock-administration": "Shared lock administration",
    "citation-pricing": "Shared citation pricing",
    "integrity-registry": "Integrity migration registry",
    "integrity-anchor": "Protected integrity anchoring",
}


def lock_resource(number="", resource=""):
    if resource:
        if resource not in GLOBAL_LOCKS and not resource.startswith("case:"):
            raise ValueError("Unsupported lock resource")
        if resource.startswith("case:"):
            return "case:" + case_number_key(resource[5:])
        return resource
    return "case:" + case_number_key(number)


def lock_path(folder, number="", resource=""):
    key = lock_resource(number, resource)
    return Path(folder) / ".locks" / (hashlib.sha256(key.encode()).hexdigest() + ".lock")


def lock_status(folder, number="", resource=""):
    if not Path(folder).is_dir():
        raise OSError("Shared case folder unavailable")
    key = lock_resource(number, resource)
    # A case inspection identifies global blockers before suggesting no case lock.
    if not resource:
        for global_key in GLOBAL_LOCKS:
            status = lock_status(folder, resource=global_key)
            if status["present"]:
                return status
    path = lock_path(folder, resource=key)
    try:
        raw = path.read_bytes()
        stat = path.stat()
    except FileNotFoundError:
        return {"ok": True, "present": False, "resource": key}
    token = hashlib.sha256(raw + str(stat.st_mtime_ns).encode() + str(stat.st_ino).encode()).hexdigest()
    try:
        meta = json.loads(raw)
        host = str(meta.get("host", "Unknown computer"))[:200]
        pid = int(meta.get("pid", 0))
        created = float(meta.get("at", stat.st_mtime))
    except (ValueError, TypeError, AttributeError):
        host, pid, created = "Unreadable lock metadata", 0, stat.st_mtime
    local = host.casefold() in {socket.gethostname().casefold(), os.environ.get("COMPUTERNAME", "").casefold()}
    return {
        "ok": True,
        "present": True,
        "resource": key,
        "scope": GLOBAL_LOCKS.get(key, "Case " + key[5:]),
        "host": host,
        "pid": pid,
        "at": created,
        "ageSeconds": max(0, time.time() - created),
        "token": token,
        "ownership": "local" if local else "remote or unknown",
        "ownerRunning": local_pid_alive(pid) if local else None,
    }


def local_pid_alive(pid):
    if pid <= 0:
        return False
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        kernel = ctypes.windll.kernel32
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return ctypes.windll.kernel32.GetLastError() == 5
        try:
            code = ctypes.c_ulong()
            return not ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(code)) or code.value == 259
        finally:
            ctypes.windll.kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


@contextlib.contextmanager
def recovery_mutex(folder):
    """OS-held serialization releases on process death; it creates no orphan gate."""
    target = Path(folder) / "_lock-administration"
    target.mkdir(exist_ok=True)
    with (target / "recovery.guard").open("a+b") as stream:
        stream.seek(0)
        stream.write(b"0")
        stream.flush()
        stream.seek(0)
        if os.name == "nt":
            import msvcrt

            msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl

            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == "nt":
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


@logged("lock")
def release_lock(folder, data):
    if (
        set(data)
        not in ({"number", "token", "administrator", "reason", "confirmed"}, {"number", "resource", "token", "administrator", "reason", "confirmed"})
        or data["confirmed"] is not True
    ):
        raise ValueError("Administrator confirmation and audit note required")
    if not isinstance(data["administrator"], str) or not 2 <= len(data["administrator"].strip()) <= 120:
        raise ValueError("Enter administrator name")
    if not isinstance(data["reason"], str) or not 15 <= len(data["reason"].strip()) <= 1000:
        raise ValueError("Enter the administrator verification and reason (15–1000 characters)")
    number = data["number"]
    resource = lock_resource(number, data.get("resource", ""))
    # The recovery gate is distinct from every recoverable target. Acquirers
    # check it before and after creation, so a replacement owner cannot be removed.
    with recovery_mutex(folder), contextlib.nullcontext() if resource == "lock-recovery" else file_lock(folder, "lock-recovery"):
        current = lock_status(folder, resource=resource)
        if not current["present"] or current["token"] != data["token"]:
            raise ValueError("Lock changed; inspect again")
        if current["ageSeconds"] < 30:
            raise ValueError("This lock is recent. Wait and inspect again")
        if current["host"].casefold() in {socket.gethostname().casefold(), os.environ.get("COMPUTERNAME", "").casefold()} and local_pid_alive(
            current["pid"]
        ):
            raise ValueError("The owning process is still running on this computer")
        archive = Path(folder) / "_lock-administration"
        archive.mkdir(exist_ok=True)
        identity = uuid.uuid4().hex
        note = {
            "format": "madison-lock-administration",
            "version": 1,
            "at": time.time(),
            "caseNumber": number,
            "resource": resource,
            "lock": current,
            "administrator": data["administrator"].strip(),
            "reason": data["reason"].strip(),
            "confirmed": True,
        }
        atomic_write(archive / (identity + ".json"), json.dumps(note, indent=2).encode())
        if lock_status(folder, resource=resource).get("token") != data["token"]:
            raise ValueError("Lock changed during verification; no release performed")
        os.replace(lock_path(folder, resource=resource), archive / (identity + ".lock"))
        return {"ok": True, "released": True, "audit": identity}
