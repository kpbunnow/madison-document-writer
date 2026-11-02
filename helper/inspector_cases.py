"""Open enforcement cases by assigned inspector: fixed, read-only queries run as the signed-in Windows user.

Two queries (inspector_list.sql and inspector_cases.sql) come from the division's Open_Enforcement_Cases report. The
inspector is chosen from the first list and sent back as an Accela user ID; no SQL or free text reaches the database.
Picking a case on the list only supplies a case number to the existing case lookup (case_lookup.lookup).
"""

import datetime
import hashlib
import json
from pathlib import Path
import re
import threading
from helper_logging import logged
import case_lookup
from case_lookup import CaseLookupError, HERE

LISTS = threading.BoundedSemaphore(1)
EXCLUSIONS = "excluded-inspectors.json"
EXCLUSION_HELP = 'Case Lookup/excluded-inspectors.json is invalid. Use the supplied example: {"exclude": ["name or user ID", ...]}.'
USER_ID = re.compile(r"[A-Za-z0-9._@-]{1,64}")
MAX_INSPECTORS = 200
MAX_CASES = 3000
LIST_WAIT = 90
LIST_QUERY_TIMEOUT = 60
INSPECTOR_FIELDS = ("UserId", "InspectorName", "OpenCases")
CASE_FIELDS = (
    "AssignedInspector UserId CaseNumber ShortAddress ParcelNumber OwnerName RecordCategory CaseDescription Status DateOpened "
    "LatestInspectionType LatestInspectionStatus LatestInspectionDate LatestScheduledDate"
).split()


def user_id(value):
    if not isinstance(value, str) or not USER_ID.fullmatch(value.strip()):
        raise CaseLookupError("Choose an inspector from the list.", 400)
    return value.strip()


def _pattern(entry):
    """An administrator's exclusion entry: a name or user ID, case-insensitive, with % standing for any text."""
    return re.compile("".join(".*" if c == "%" else re.escape(c) for c in entry.strip()), re.IGNORECASE | re.DOTALL)


def exclusions(root):
    """The administrator's list of people who never appear (Case Lookup/excluded-inspectors.json), or none."""
    path = Path(root) / "Case Lookup" / EXCLUSIONS
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return []
    except (OSError, ValueError, UnicodeError):
        raise CaseLookupError(EXCLUSION_HELP) from None
    names = data.get("exclude") if isinstance(data, dict) and set(data) == {"exclude"} else None
    if not isinstance(names, list) or len(names) > 100:
        raise CaseLookupError(EXCLUSION_HELP)
    if any(not isinstance(x, str) or not 1 <= len(x.strip()) <= 128 or any(ord(c) < 32 for c in x) for x in names):
        raise CaseLookupError(EXCLUSION_HELP)
    return names


def excluded(names, uid, name):
    return any(_pattern(entry).fullmatch(value) for entry in names for value in (uid, name or ""))


def _text(row, field, limit=2000):
    value = row.get(field)
    if value is None:
        return ""
    if not isinstance(value, str) or len(value) > limit or any(ord(c) < 32 and c not in "\t\r\n" for c in value):
        raise CaseLookupError("The report query returned an invalid field value.")
    return " ".join(value.split())


def _day(value):
    """The date part of an ISO timestamp, or empty when the value is missing or not a date."""
    return value[:10] if re.fullmatch(r"\d{4}-\d{2}-\d{2}(T.*)?", value or "") else ""


def _rows(answer, fields, limit):
    rows = answer.get("rows")
    if not isinstance(rows, list) or len(rows) > limit:
        raise CaseLookupError("The report returned an invalid or oversized list.")
    for row in rows:
        if not isinstance(row, dict) or any(f not in row for f in fields):
            raise CaseLookupError("The report query returned unexpected columns. Ask IT to reinstall the complete release.")
    return rows


def _source(cfg, answer, query):
    database = answer.get("database")
    if not isinstance(database, str) or not database or len(database) > 128:
        raise CaseLookupError("The database identity could not be verified. Nothing was loaded.")
    if cfg["database"] and cfg["database"].casefold() != database.casefold():
        raise CaseLookupError("The database identity did not match the shared setting. Nothing was loaded.")
    return {
        "kind": "sql",
        "server": cfg["server"],
        "database": database,
        "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "querySha256": hashlib.sha256((HERE / query).read_bytes()).hexdigest(),
    }


def _run(root, fields, query):
    cfg = case_lookup.settings(root)
    names = exclusions(root)
    if not LISTS.acquire(blocking=False):
        raise CaseLookupError("An open-case list is already loading. Wait for it to finish and retry.", 429)
    try:
        return cfg, names, case_lookup.run_script(cfg, dict(fields, commandTimeout=LIST_QUERY_TIMEOUT), LIST_WAIT)
    finally:
        LISTS.release()


@logged("lookup")
def inspectors(root):
    cfg, names, answer = _run(root, {"mode": "inspector_list"}, "inspector_list.sql")
    people, seen = [], set()
    for row in _rows(answer, INSPECTOR_FIELDS, MAX_INSPECTORS):
        uid = user_id(row["UserId"] if isinstance(row["UserId"], str) else "")
        name = _text(row, "InspectorName", 200) or uid
        count = row["OpenCases"]
        if uid.casefold() in seen or not isinstance(count, str) or not count.isdigit():
            raise CaseLookupError("The report query returned an invalid inspector list.")
        seen.add(uid.casefold())
        if not excluded(names, uid, name):
            people.append({"id": uid, "name": name, "openCases": int(count)})
    people.sort(key=lambda p: p["name"].casefold())
    return {"ok": True, "inspectors": people, "source": _source(cfg, answer, "inspector_list.sql")}


@logged("lookup")
def open_cases(root, value):
    uid = user_id(value)
    cfg, names, answer = _run(root, {"mode": "inspector_cases", "userId": uid}, "inspector_cases.sql")
    cases, seen = [], set()
    for row in _rows(answer, CASE_FIELDS, MAX_CASES):
        number = case_lookup.case_number(row["CaseNumber"] if isinstance(row["CaseNumber"], str) else "")
        if number in seen:
            continue
        if _text(row, "UserId", 64).casefold() != uid.casefold():
            raise CaseLookupError("The database returned a case for a different inspector. Nothing was loaded.")
        name = _text(row, "AssignedInspector", 200) or uid
        if excluded(names, uid, name):
            raise CaseLookupError("This inspector is not available for case lists. Choose another inspector.", 403)
        seen.add(number)
        cases.append(
            {
                "caseNumber": number,
                "address": _text(row, "ShortAddress", 300),
                "parcel": _text(row, "ParcelNumber", 64),
                "owner": _text(row, "OwnerName", 300),
                "category": _text(row, "RecordCategory", 200),
                "description": _text(row, "CaseDescription", 1000),
                "status": _text(row, "Status", 200),
                "dateOpened": _day(_text(row, "DateOpened", 40)),
                "latest": {
                    "type": _text(row, "LatestInspectionType", 200),
                    "status": _text(row, "LatestInspectionStatus", 200),
                    "date": _day(_text(row, "LatestInspectionDate", 40)),
                    "scheduled": _day(_text(row, "LatestScheduledDate", 40)),
                },
            }
        )
    name = _text(answer["rows"][0], "AssignedInspector", 200) if cases else ""
    return {
        "ok": True,
        "inspector": {"id": uid, "name": name or uid},
        "cases": cases,
        "source": _source(cfg, answer, "inspector_cases.sql"),
    }
