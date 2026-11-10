"""Open enforcement cases by assigned inspector, from the division's OpenEnforcementCases_BI SSRS report.

The report is rendered as XML by the signed-in Windows user (ssrs_reports). Rendered without a parameter it lists every
inspector's open cases; the helper counts them for the inspector list. One inspector's cases are rendered with the
report's own Inspector parameter, using the name exactly as the report printed it. The report owns the open-case rule;
the helper applies the division's and the administrator's exclusions. Picking a case on the list only supplies a case
number to the case lookup (case_lookup.lookup).
"""

import datetime
import hashlib
import json
from pathlib import Path
import re
import threading
import time
from helper_logging import logged
import case_integrity
import case_lookup
import case_projection
import case_store
import ssrs_reports
from case_lookup import CaseLookupError
from plain_files import is_plain_file, read_plain_bytes
from reporting_reads import ordered_reads, SummaryInputs

LISTS = threading.BoundedSemaphore(1)
EXCLUSIONS = "excluded-inspectors.json"
EXCLUSION_HELP = 'Case Lookup/excluded-inspectors.json is invalid. Use the supplied example: {"exclude": ["name or user ID", ...]}.'
MAX_INSPECTORS = 200
MAX_CASES = 3000
LIST_WAIT = 90
# The inspector list changes rarely and the full report takes several seconds to render, so a good answer is kept in
# memory for this long; Try again and Refresh inspector list ask for a fresh one.
CACHE_SECONDS = 1800
_cache = {"root": None, "at": 0.0, "answer": None, "source": None}
SUMMARY_DIR = "Reporting Index"
MAX_SUMMARY_BYTES = 8 * 1024 * 1024
SUMMARY_READERS = 4
NOT_LISTED = "Choose an inspector from the list. If the inspector is missing, choose Refresh inspector list."


def inspector_name(value):
    """An inspector as the report names them: printable text of 1 to 128 characters."""
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 128 or any(ord(c) < 32 or ord(c) == 127 for c in value):
        raise CaseLookupError("Choose an inspector from the list.", 400)
    return " ".join(value.split())


def _pattern(entry):
    """An administrator's exclusion entry: a name or user ID, case-insensitive, with % standing for any text."""
    return re.compile("".join(".*" if c == "%" else re.escape(c) for c in entry.strip()), re.IGNORECASE | re.DOTALL)


# Staff the division does not want listed as inspectors (owner direction 2026-11-03). They are matched like the
# administrator's entries (case-insensitive, % for any text) so a middle initial or a spaced hyphen still matches.
DEFAULT_EXCLUDED = ("Alice%Duncan%Graves", "Gregg%May", "Jessica%Price", "Phil%Grupe")


def exclusions(root):
    """The people who never appear: the division's built-in list plus the administrator's additions in
    Case Lookup/excluded-inspectors.json."""
    return list(DEFAULT_EXCLUDED) + _administrator_exclusions(root)


def _administrator_exclusions(root):
    path = Path(root) / "Case Lookup" / EXCLUSIONS
    try:
        data = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return []
    except OSError, ValueError, UnicodeError:
        raise CaseLookupError(EXCLUSION_HELP) from None
    names = data.get("exclude") if isinstance(data, dict) and set(data) == {"exclude"} else None
    if not isinstance(names, list) or len(names) > 100:
        raise CaseLookupError(EXCLUSION_HELP)
    if any(not isinstance(x, str) or not 1 <= len(x.strip()) <= 128 or any(ord(c) < 32 for c in x) for x in names):
        raise CaseLookupError(EXCLUSION_HELP)
    return names


def excluded(names, name):
    return any(_pattern(entry).fullmatch(name) for entry in names)


def _text(row, field, limit=2000):
    value = row.get(field)
    if value is None:
        return ""
    if not isinstance(value, str) or len(value) > limit or any(ord(c) < 32 and c not in "\t\r\n" for c in value):
        raise CaseLookupError("The open-case report returned an invalid field value.")
    return " ".join(value.split())


def _report(inspector=None):
    """The open-case report's rows (all inspectors, or one), one render at a time."""
    if not LISTS.acquire(blocking=False):
        raise CaseLookupError("An open-case list is already loading. Wait for it to finish and retry.", 429)
    try:
        return ssrs_reports.open_case_rows(inspector, LIST_WAIT)
    except ssrs_reports.ReportError as error:
        raise CaseLookupError(str(error), error.status) from None
    finally:
        LISTS.release()


def _source():
    return {
        **ssrs_reports.source(ssrs_reports.OPEN_CASES_REPORT),
        "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


def _checked_cases(rows):
    """(name as printed, case number, row) for every report row, refusing a row without a usable inspector or case. The
    printed name is kept exactly: it is the value the report's Inspector parameter accepts."""
    found = []
    for row in rows:
        printed, number = row.get("AssignedInspector"), row.get("CaseNumber")
        if not isinstance(printed, str) or not printed.strip() or not isinstance(number, str):
            raise CaseLookupError("The open-case report returned a row without an inspector or case number. Nothing was loaded.")
        try:
            inspector_name(printed)
            found.append((printed, case_lookup.case_number(number), row))
        except CaseLookupError:
            raise CaseLookupError("The open-case report returned an invalid inspector or case number. Nothing was loaded.") from None
    return found


def _key(name):
    return inspector_name(name).casefold()


def _people(rows):
    """The inspector list: each assigned inspector once, with the number of distinct open cases. The id is the name as
    the report printed it; the name shown has its spacing tidied."""
    counts, printed = {}, {}
    for name, number, _ in _checked_cases(rows):
        key = _key(name)
        printed.setdefault(key, name)
        counts.setdefault(key, set()).add(number)
    if len(printed) > MAX_INSPECTORS:
        raise CaseLookupError("The open-case report lists more inspectors than the program can show. Ask the report administrator.")
    return [{"id": printed[key], "name": inspector_name(printed[key]), "openCases": len(counts[key])} for key in printed]


def _configuration(cfg):
    """Only validated settings reach the cache; no credentials are accepted by settings()."""
    return tuple(sorted(cfg.items()))


def _list_answer(root, refresh, cfg):
    """The checked inspector list and where it came from: the kept one, or a fresh render when asked or expired. Only a
    list that passed every check is kept."""
    entry = _cache.copy()
    if (
        not refresh
        and entry["answer"] is not None
        and entry["root"] == str(root)
        and entry.get("configuration") == _configuration(cfg)
        and time.monotonic() - entry["at"] < CACHE_SECONDS
    ):
        return entry["answer"], entry["source"]
    people = _people(_report())
    source = _source()
    _cache.update(root=str(root), at=time.monotonic(), answer=people, source=source, configuration=_configuration(cfg))
    return people, source


@logged("lookup")
def inspectors(root, refresh=False):
    cfg = case_lookup.settings(root)
    names = exclusions(root)
    everyone, source = _list_answer(root, refresh, cfg)
    people = [dict(p) for p in everyone if not excluded(names, p["name"])]
    people.sort(key=lambda p: p["name"].casefold())
    return {"ok": True, "inspectors": people, "source": source}


@logged("lookup")
def inspector_names(root, refresh=False):
    """The report prints every inspector's full name, so no second name lookup is needed. Kept so a page that still
    asks receives a complete, empty answer."""
    case_lookup.settings(root)
    return {"ok": True, "names": []}


def next_due(summary):
    """The soonest due date still outstanding among the violation items a case summary carries. A summary's items and
    due dates are those of the last issued document that has items (notice, reinspection notice, extension and so on),
    so this is that document's soonest outstanding deadline."""
    days = []
    for item in summary.get("violations", []):
        due = item.get("due") if isinstance(item, dict) and not item.get("done") and not item.get("withdrawn") else None
        if isinstance(due, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", due):
            try:
                datetime.date.fromisoformat(due)
            except ValueError:
                continue
            days.append(due)
    return min(days) if days else ""


def _read_json(path, inputs=None):
    if inputs is not None:
        return inputs.read(path, max_bytes=MAX_SUMMARY_BYTES)
    raw = read_plain_bytes(path)
    if len(raw) > MAX_SUMMARY_BYTES:
        raise ValueError("too large")
    return raw, json.loads(raw)


def _verified_due(case_dir, number, summary_path, case_paths, context, inputs=None):
    """("due", date), ("none", "") or ("unknown", "") for one listed case. A date is used only from a summary that
    names the current revision of its single case file, whose integrity verifies and whose projection equals the
    summary: the same authority Reports uses. A case never saved to the share has no order ("none"); anything else
    that cannot be confirmed (missing, stale, orphaned, unreadable or mismatched summary) is "unknown", never "none"."""
    if summary_path is None and not case_paths:
        return "none", ""
    if summary_path is None or len(case_paths) != 1 or context is None:
        return "unknown", ""
    try:
        _, summary = _read_json(summary_path, inputs)
        case = summary.get("case") if isinstance(summary, dict) else None
        if (
            not isinstance(summary, dict)
            or summary.get("format") != "madison-case-summary"
            or not isinstance(case, dict)
            or str(case.get("number", "")).casefold() != number.casefold()
        ):
            return "unknown", ""
        raw, record = _read_json(case_paths[0])
        if not isinstance(record, dict) or summary.get("sourceRevision") != hashlib.sha256(raw).hexdigest():
            return "unknown", ""
        if not case_integrity.verify_record(record, Path(case_dir), context=context)["valid"]:
            return "unknown", ""
        if not case_projection.used_by_reports(summary) or case_projection.mismatched_fields(summary, record):
            return "unknown", ""
        due = next_due(summary)
    except Exception:  # one unusable case never fails the list; it is reported as unknown
        return "unknown", ""
    return ("due", due) if due else ("none", "")


def due_dates(case_dir, numbers):
    """Verified due-date states by upper-case case number, read only for the listed cases; None when the shared case
    folder cannot be read. Each value is (state, date) with state "due", "none" or "unknown"."""
    folder = Path(case_dir) / SUMMARY_DIR
    if not Path(case_dir).is_dir():
        return None
    if not numbers:
        return {}
    wanted = {case_store.case_number_key(n) for n in numbers}
    cases = {}
    # A linked/non-regular case entry is still evidence that this is not a never-saved case. Include its name so the
    # no-follow reader reports unknown, rather than silently treating the skipped entry as "no order".
    for path in Path(case_dir).glob("*.json"):
        key = case_store.case_file_key(path)
        if key in wanted and not path.name.startswith("_"):
            cases.setdefault(key, []).append(path)
    try:
        inputs = SummaryInputs(read_plain_bytes)
        context = case_integrity.VerificationContext(Path(case_dir), summary_workers=SUMMARY_READERS, summary_reader=inputs.read_context)
        summary_paths = context.summary_paths
    except OSError, ValueError, TypeError, KeyError:
        context = None
        # Presence still distinguishes an orphaned summary from a never-saved case when other evidence is damaged.
        summary_paths = list(folder.glob("*.json")) if folder.is_dir() else []
    summaries = {p.name.casefold(): p for p in summary_paths if is_plain_file(p)}
    found = ordered_reads(
        list(numbers),
        lambda n: (
            n,
            _verified_due(case_dir, n, summaries.get(n.casefold() + ".json"), cases.get(case_store.case_number_key(n), []), context, inputs),
        ),
        SUMMARY_READERS,
    )
    return {number.upper(): state for number, state in found}


@logged("lookup")
def open_cases(root, value, case_dir=None):
    name = inspector_name(value)
    cfg = case_lookup.settings(root)
    if excluded(exclusions(root), name):
        raise CaseLookupError("This inspector is not available for case lists. Choose another inspector.", 403)
    listed = next((p["id"] for p in _list_answer(root, False, cfg)[0] if _key(p["id"]) == name.casefold()), None)
    if listed is None:
        raise CaseLookupError(NOT_LISTED, 400)
    cases, seen = [], set()
    rows = _report(listed)
    if len(rows) > MAX_CASES:
        raise CaseLookupError("The open-case report returned too many cases for one inspector. Ask the report administrator.")
    for assigned, number, row in _checked_cases(rows):
        if _key(assigned) != _key(listed):
            raise CaseLookupError("The report returned a case for a different inspector. Nothing was loaded.")
        if number in seen:
            continue
        seen.add(number)
        cases.append(
            {
                "caseNumber": number,
                "address": _text(row, "ShortAddress", 300),
                "description": _text(row, "CaseDescription", 2000),
            }
        )
    dues = due_dates(case_dir, [c["caseNumber"] for c in cases]) if case_dir is not None else None
    for case in cases:
        state, due = (dues or {}).get(case["caseNumber"].upper(), ("unknown", ""))
        case["dueDate"], case["dueState"] = due, state
    # Cases with no order come first (they still need one), then the soonest, with past-due dates leading the dated
    # ones; cases whose due date could not be confirmed follow.
    rank = {"none": 0, "due": 1, "unknown": 2}
    cases.sort(key=lambda c: (rank[c["dueState"]], c["dueDate"]))
    return {
        "ok": True,
        "inspector": {"id": listed},
        "cases": cases,
        "dueDates": dues is not None,
        "source": _source(),
    }
