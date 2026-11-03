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
import time
from helper_logging import logged
import case_lookup
from case_lookup import CaseLookupError, HERE

LISTS = threading.BoundedSemaphore(1)
NAMES = threading.BoundedSemaphore(1)
EXCLUSIONS = "excluded-inspectors.json"
EXCLUSION_HELP = 'Case Lookup/excluded-inspectors.json is invalid. Use the supplied example: {"exclude": ["name or user ID", ...]}.'
USER_ID = re.compile(r"[A-Za-z0-9._@-]{1,64}")
MAX_INSPECTORS = 200
MAX_CASES = 3000
MAX_NAMES = 3000
LIST_WAIT = 90
LIST_QUERY_TIMEOUT = 60
# The inspector list changes rarely and takes several seconds on the City database, so a good answer is kept in memory
# for this long; Try again on the screen asks for a fresh one.
CACHE_SECONDS = 1800
_cache = {"root": None, "at": 0.0, "answer": None, "source": None}
INSPECTOR_FIELDS = ("UserId", "InspectorName", "OpenCases")
CASE_FIELDS = ("UserId", "CaseNumber", "ShortAddress", "CaseDescription")
NAME_FIELDS = ("UserId", "InspectorName")
_names = {"root": None, "at": 0.0, "found": None}


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
    slot = NAMES if fields.get("mode") == "inspector_names" else LISTS
    if not slot.acquire(blocking=False):
        raise CaseLookupError("An open-case list is already loading. Wait for it to finish and retry.", 429)
    try:
        return cfg, names, case_lookup.run_script(cfg, dict(fields, commandTimeout=LIST_QUERY_TIMEOUT), LIST_WAIT)
    finally:
        slot.release()


def _checked_people(answer):
    people, seen = [], set()
    for row in _rows(answer, INSPECTOR_FIELDS, MAX_INSPECTORS):
        uid = user_id(row["UserId"] if isinstance(row["UserId"], str) else "")
        name = _text(row, "InspectorName", 200) or uid
        count = row["OpenCases"]
        if uid.casefold() in seen or not isinstance(count, str) or not count.isdigit():
            raise CaseLookupError("The report query returned an invalid inspector list.")
        seen.add(uid.casefold())
        people.append({"id": uid, "name": name, "openCases": int(count)})
    return people


def _list_answer(root, refresh):
    """The checked inspector list and where it came from: the kept one, or a fresh query when asked or expired. Only a
    list that passed every check is kept."""
    kept = _cache["answer"] is not None and _cache["root"] == str(root) and time.monotonic() - _cache["at"] < CACHE_SECONDS
    if kept and not refresh:
        return _cache["answer"], _cache["source"]
    cfg, _, answer = _run(root, {"mode": "inspector_list"}, "inspector_list.sql")
    source = _source(cfg, answer, "inspector_list.sql")
    people = _checked_people(answer)
    _cache.update(root=str(root), at=time.monotonic(), answer=people, source=source)
    return people, source


def _kept_names(root):
    if _names["found"] is not None and _names["root"] == str(root) and time.monotonic() - _names["at"] < CACHE_SECONDS:
        return _names["found"]
    return {}


def _display_person(person, found):
    name = found.get(person["id"].casefold(), person["name"]) if person["name"].casefold() == person["id"].casefold() else person["name"]
    return {**person, "name": name}


@logged("lookup")
def inspectors(root, refresh=False):
    names = exclusions(root)
    everyone, source = _list_answer(root, refresh)
    displayed = [_display_person(p, _kept_names(root)) for p in everyone]
    people = [p for p in displayed if not excluded(names, p["id"], p["name"])]
    people.sort(key=lambda p: p["name"].casefold())
    return {"ok": True, "inspectors": people, "source": source}


def _name_map(root, refresh):
    """User ID (lower case) to full name from the inspection view, kept like the list. Only checked rows are kept."""
    kept = _names["found"] is not None and _names["root"] == str(root) and time.monotonic() - _names["at"] < CACHE_SECONDS
    if kept and not refresh:
        return _names["found"]
    cfg, _, answer = _run(root, {"mode": "inspector_names"}, "inspector_names.sql")
    _source(cfg, answer, "inspector_names.sql")
    found = {}
    for row in _rows(answer, NAME_FIELDS, MAX_NAMES):
        uid = user_id(row["UserId"] if isinstance(row["UserId"], str) else "")
        name = _text(row, "InspectorName", 200)
        if name:
            found[uid.casefold()] = name
    _names.update(root=str(root), at=time.monotonic(), found=found)
    return found


@logged("lookup")
def inspector_names(root, refresh=False):
    """Full names for the listed people who are shown by user ID, so the list does not wait for the slower query. The
    cached name map also enriches subsequent inspector lists without mutating prior responses."""
    excluded_names = exclusions(root)
    people, _ = _list_answer(root, False)
    unnamed = [p for p in people if p["name"].casefold() == p["id"].casefold()]
    resolved, removed = [], []
    if unnamed:
        found = _name_map(root, refresh)
        for person in unnamed:
            name = found.get(person["id"].casefold())
            if excluded(excluded_names, person["id"], name):
                removed.append(person["id"])
            elif name:
                resolved.append({"id": person["id"], "name": name})
    return {"ok": True, "names": resolved, **({"excluded": removed} if removed else {})}


@logged("lookup")
def open_cases(root, value):
    uid = user_id(value)
    names = exclusions(root)
    if excluded(names, uid, _kept_names(root).get(uid.casefold(), uid)):
        raise CaseLookupError("This inspector is not available for case lists. Choose another inspector.", 403)
    cfg, _, answer = _run(root, {"mode": "inspector_cases", "userId": uid}, "inspector_cases.sql")
    cases, seen = [], set()
    for row in _rows(answer, CASE_FIELDS, MAX_CASES):
        number = case_lookup.case_number(row["CaseNumber"] if isinstance(row["CaseNumber"], str) else "")
        if number in seen:
            continue
        if _text(row, "UserId", 64).casefold() != uid.casefold():
            raise CaseLookupError("The database returned a case for a different inspector. Nothing was loaded.")
        seen.add(number)
        cases.append(
            {
                "caseNumber": number,
                "address": _text(row, "ShortAddress", 300),
                "description": _text(row, "CaseDescription", 2000),
            }
        )
    return {"ok": True, "inspector": {"id": uid}, "cases": cases, "source": _source(cfg, answer, "inspector_cases.sql")}
