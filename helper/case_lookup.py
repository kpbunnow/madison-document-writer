"""Read-only, fixed-query Windows case lookup. No caller-supplied SQL or credentials."""

import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import threading
from helper_logging import logged
import trusted_connections

HERE = Path(__file__).resolve().parent
LIMIT = 5 * 1024 * 1024
LOOKUPS = threading.BoundedSemaphore(1)
DEFAULTS = {"server": "sqlelam", "database": "", "enabled": True}
LOCAL_TLS_SETTINGS = "case-lookup-local-settings.json"
FIELDS = (
    "CaseNumber SiteAddress ParcelNumber OwnerName OwnerAddress CaseDescription "
    "DetailedDescription ZoningDistrict HistoricDistrict HistoricDistrictName "
    "IndividualLandmark Landmark InspectionDate InspectionScheduledDate "
    "InspectionType InspectionStatus InspectionTime InspectorName"
).split()


class CaseLookupError(Exception):
    def __init__(self, message, status=503):
        super().__init__(message)
        self.status = status


def _read_shared_settings(root):
    path = root / "Case Lookup" / "settings.json"
    try:
        return path.read_text(encoding="utf-8-sig")
    except FileNotFoundError:
        return "{}"
    except OSError:
        raise CaseLookupError("Case Lookup/settings.json cannot be read. Ask IT to check access.")


def _checked_settings(raw):
    try:
        data = json.loads(raw)
        if not isinstance(data, dict) or set(data) - set(DEFAULTS):
            raise ValueError()
        cfg = dict(DEFAULTS, **data)
        if type(cfg["enabled"]) is not bool:
            raise ValueError()
        if not isinstance(cfg["server"], str) or not re.fullmatch(r"[A-Za-z0-9_.\\,:-]{1,128}", cfg["server"]):
            raise ValueError()
        if not isinstance(cfg["database"], str) or len(cfg["database"]) > 128 or any(ord(c) < 32 for c in cfg["database"]):
            raise ValueError()
    except (ValueError, TypeError):
        raise CaseLookupError(("Case Lookup/settings.json is invalid. Use the supplied example; allowed settings are server, database and enabled."))
    return cfg


def _local_certificate_setting(local_app_data):
    """The per-user choice to skip server identity validation; absent means validate."""
    local_path = Path(local_app_data) / "MadisonDocWriter" / LOCAL_TLS_SETTINGS
    try:
        local_data = json.loads(local_path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        local_data = {}
    except OSError:
        raise CaseLookupError("The local SQL certificate setting cannot be read. Remove it or check access.")
    except (ValueError, UnicodeError):
        raise CaseLookupError("The local SQL certificate setting is invalid. Use only the boolean key trustServerCertificate.")
    try:
        if not isinstance(local_data, dict) or set(local_data) - {"trustServerCertificate"}:
            raise ValueError()
        trust_certificate = local_data.get("trustServerCertificate", False)
        if type(trust_certificate) is not bool:
            raise ValueError()
    except (ValueError, TypeError):
        raise CaseLookupError("The local SQL certificate setting is invalid. Use only the boolean key trustServerCertificate.")
    return trust_certificate


def settings(root):
    root = Path(root)
    if not root.is_dir():
        raise CaseLookupError("The shared program folder is unavailable. Reconnect to the City network and retry.")
    cfg = _checked_settings(_read_shared_settings(root))
    try:
        trusted_connections.approved_sql(cfg["server"])
    except ValueError as error:
        raise CaseLookupError(str(error)) from None
    cfg["trustServerCertificate"] = False
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        cfg["trustServerCertificate"] = _local_certificate_setting(local_app_data)
    if not cfg["enabled"]:
        raise CaseLookupError("Direct case lookup is disabled by the administrator. Use an Excel report.")
    return cfg


def case_number(value):
    if not isinstance(value, str):
        raise CaseLookupError("Enter a case number.", 400)
    value = value.strip().upper()
    if not re.fullmatch(r"[A-Z0-9-]{3,80}", value):
        raise CaseLookupError("Enter a complete case number using letters, numbers and hyphens (3–80 characters).", 400)
    return value


# First match wins: provider numbers and categories map to fixed, allowlisted guidance.
FAILURE_MESSAGES = [
    (lambda category, num: category == "limit", "This case exceeds the lookup size limit. Ask IT to check duplicate or unusually large report rows."),
    (
        lambda category, num: num in (18456, 229, 916),
        ("Your Windows account cannot read the case database. Ask IT to check your read permissions on BI_ENF_RECORD and BI_ENF_INSPECTION."),
    ),
    (
        lambda category, num: num == 207,
        (
            "The lookup query names a column the case database does not have (SQL"
            "_QUERY_207). The installed case_lookup.sql does not match the BI_ENF"
            "_RECORD/BI_ENF_INSPECTION views; ask IT to compare it with the worki"
            "ng SSRS report. This is not a connection problem. Excel import remai"
            "ns available."
        ),
    ),
    (
        lambda category, num: num in (208, 4060, 4064) or category == "database",
        "The case tables were not found in the selected database. Ask IT to set the database in Case Lookup/settings.json.",
    ),
    (lambda category, num: num == -2 or category == "timeout", "The database lookup timed out. Check the City network and retry."),
    (
        lambda category, num: category == "tls_certificate",
        (
            "The SQL server certificate is not trusted (TLS_CERTIFICATE). The sec"
            "ure fix is a trusted certificate chain and matching server name. If "
            "you accept skipping server identity validation, see the per-user wor"
            "karound in CASE-LOOKUP-GUIDE.md."
        ),
    ),
    (
        lambda category, num: category == "authentication",
        (
            "SQL rejected the signed-in Windows account (WINDOWS_AUTH). Ask IT to"
            " verify the account’s database access and the City network connectio"
            "n."
        ),
    ),
    (
        lambda category, num: category == "network",
        ("The City SQL server could not be reached (SQL_NETWORK). Check the City network, approved server name and SQL service, then retry."),
    ),
    (
        lambda category, num: category == "script_policy",
        (
            "Windows blocked the lookup helper (SCRIPT_POLICY). Ask IT to approve"
            " the lookup helper under City policy; do not bypass PowerShell polic"
            "y."
        ),
    ),
    (
        lambda category, num: category == "helper_runtime",
        (
            "The lookup helper could not load its Windows SQL runtime (HELPER_RUN"
            "TIME). Ask IT to install the complete deployment and confirm Windows"
            " PowerShell/.NET support."
        ),
    ),
]


def _connect_diagnostic(answer, num, state, operation, argument_name):
    """A code built only from allowlisted labels and numbers; provider text never reaches the UI."""
    diagnostic = "SQL_CONNECT"
    if type(num) is int:
        diagnostic += "_" + str(num)
    if type(state) is int:
        diagnostic += "_STATE_" + str(state)
    exception_type = answer.get("exceptionType")
    if isinstance(exception_type, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9.]{0,79}", exception_type):
        diagnostic += "_TYPE_" + exception_type.replace(".", "_")
    hresult = answer.get("hresult")
    if type(hresult) is int and -(2**31) <= hresult < 2**31:
        diagnostic += "_HR_0x" + format(hresult & 0xFFFFFFFF, "08X")
    native_code = answer.get("nativeCode")
    if type(native_code) is int and 0 <= native_code <= 65535:
        diagnostic += "_WIN32_" + str(native_code)
    if isinstance(operation, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}", operation):
        diagnostic += "_OP_" + operation
    if isinstance(argument_name, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}", argument_name):
        diagnostic += "_ARG_" + argument_name
    return diagnostic


def _failure_message(answer):
    category, num = answer.get("category"), answer.get("number")
    state = answer.get("state")
    operation = answer.get("operation")
    argument_name = answer.get("argumentName")
    diagnostic_file = answer.get("diagnosticFile")
    for applies, text in FAILURE_MESSAGES:
        if applies(category, num):
            message = text
            break
    else:
        message = (
            "The SQL connection failed ("
            + _connect_diagnostic(answer, num, state, operation, argument_name)
            + "). Ask IT to use this code to check the SQL client error. Excel import remains available."
        )
    # Stage and argument are stable, allowlisted labels. Full provider
    # text stays in the local diagnostic file and is never sent to the UI.
    if isinstance(operation, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}", operation) and "_OP_" not in message:
        message += " Failed operation: " + operation + "."
    if isinstance(argument_name, str) and re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{0,63}", argument_name) and "_ARG_" not in message:
        message += " Argument: " + argument_name + "."
    if isinstance(diagnostic_file, str) and diagnostic_file:
        message += r" Full local details: %LOCALAPPDATA%\MadisonDocWriter\case-lookup-diagnostic.txt."
    return message


def run_query(cfg, number):
    if os.name != "nt":
        raise CaseLookupError("Direct lookup runs on a City Windows computer. The SSRS Excel report import remains available.")
    exe = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    if not exe.is_file():
        raise CaseLookupError("Windows PowerShell is unavailable. Ask IT to enable the approved lookup helper.")
    request = dict(cfg)
    request.setdefault("trustServerCertificate", False)
    request["caseNumber"] = number
    try:
        run = subprocess.run(
            [str(exe), "-NoLogo", "-NoProfile", "-NonInteractive", "-File", str(HERE / "case_lookup.ps1")],
            input=json.dumps(request),
            encoding="utf-8",
            capture_output=True,
            timeout=40,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
    except subprocess.TimeoutExpired:
        raise CaseLookupError("The case lookup timed out. Check the City network and retry. Your work has been kept.")
    except OSError:
        raise CaseLookupError(("The Windows lookup helper could not start. Ask IT to check the installation and application policy."))
    if len(run.stdout.encode("utf-8")) > LIMIT:
        raise CaseLookupError("The database returned too much data for one case. Ask IT to check the report query.")
    try:
        answer = json.loads(run.stdout.lstrip("\ufeff"))
    except ValueError:
        raise CaseLookupError(
            ("The Windows lookup helper did not return data. Ask IT to check PowerShell script policy and the complete installation.")
        )
    if not isinstance(answer, dict):
        raise CaseLookupError("The lookup helper returned an invalid response.")
    if run.returncode or not answer.get("ok"):
        raise CaseLookupError(_failure_message(answer))
    return answer


@logged("lookup")
def lookup(root, value):
    number = case_number(value)
    cfg = settings(root)
    if not LOOKUPS.acquire(blocking=False):
        raise CaseLookupError("A case lookup is already running. Wait for it to finish and retry.", 429)
    try:
        answer = run_query(cfg, number)
        rows = answer.get("rows")
        if not isinstance(rows, list) or len(rows) > 1000:
            raise CaseLookupError("The lookup returned an invalid or oversized row list.")
        clean = []
        for row in rows:
            if not isinstance(row, dict) or any(f not in row for f in FIELDS):
                raise CaseLookupError("The report query returned unexpected columns. Ask IT to reinstall the complete release.")
            if any(v is not None and not isinstance(v, str) for v in row.values()):
                raise CaseLookupError("The report query returned an invalid field value.")
            if case_number(row["CaseNumber"]) != number:
                raise CaseLookupError("The database returned a different case number. Nothing was imported.")
            clean.append(
                {
                    **{f: row[f] for f in FIELDS},
                    **({"CaseType": row.get("CaseType") or row.get("CaseTypeName")} if row.get("CaseType") or row.get("CaseTypeName") else {}),
                    # R37: Record Category ("Snow Removal" advances a snow case); optional so a lookup never fails on it.
                    **({"RecordCategory": row.get("RecordCategory")} if row.get("RecordCategory") else {}),
                }
            )
        if len(json.dumps(clean).encode("utf-8")) > LIMIT:
            raise CaseLookupError("The case response is too large. Nothing was imported.")
        database = answer.get("database")
        if not isinstance(database, str) or not database or len(database) > 128:
            raise CaseLookupError("The database identity could not be verified. Nothing was imported.")
        if cfg["database"] and cfg["database"].casefold() != database.casefold():
            raise CaseLookupError("The database identity did not match the shared setting. Nothing was imported.")
        return {
            "ok": True,
            "caseNumber": number,
            "rows": clean,
            "source": {
                "kind": "sql",
                "server": cfg["server"],
                "database": database,
                "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "querySha256": hashlib.sha256((HERE / "case_lookup.sql").read_bytes()).hexdigest(),
            },
        }
    finally:
        LOOKUPS.release()
