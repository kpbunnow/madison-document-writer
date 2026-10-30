"""Open cases for one inspector, read from the verified Reporting Index summaries.

The rule is the Reports "open (not closed)" filter, so this list and the Open cases report agree: a case is
closed when its status is Closed or Withdrawn, or when it is a snow case whose closing filing is on or before today.
Cases whose summary is missing, out of date or damaged cannot be listed; their count is returned so the screen can
say the list may be incomplete. Nothing here reads or writes a case file.
"""

import re

SNOW_TYPE = "snow-10.28"
CLOSED_STATUSES = frozenset({"Closed", "Withdrawn"})
# The picker's extra choice: cases with no assigned inspector, or one who is not in the division's list.
UNASSIGNED = "unassigned"
ISO_DAY = re.compile(r"\d{4}-\d{2}-\d{2}")
MAX_ROWS = 500


def is_open(case, today):
    if case.get("status") in CLOSED_STATUSES:
        return False
    closed_on = case.get("closedOn")
    return not (case.get("caseType") == SNOW_TYPE and isinstance(closed_on, str) and closed_on and closed_on <= today)


def next_due(summary):
    """Earliest deadline among violation items that are neither done nor withdrawn."""
    days = [
        item["due"]
        for item in summary.get("violations", [])
        if isinstance(item, dict)
        and not item.get("done")
        and not item.get("withdrawn")
        and isinstance(item.get("due"), str)
        and ISO_DAY.fullmatch(item["due"])
    ]
    return min(days) if days else ""


def belongs_to(case, inspector, roster_ids):
    assigned = case.get("inspectorId")
    if inspector == UNASSIGNED:
        return not isinstance(assigned, str) or assigned not in roster_ids
    return assigned == inspector


def open_cases_for(index, inspector, roster_ids, today):
    """Rows for one inspector, soonest deadline first; undated cases follow in case-number order."""
    if not isinstance(inspector, str) or not 1 <= len(inspector) <= 80:
        raise ValueError("Choose an inspector")
    rows = []
    for summary in index.get("summaries", []):
        case = summary.get("case") if isinstance(summary, dict) else None
        if not isinstance(case, dict) or not belongs_to(case, inspector, roster_ids) or not is_open(case, today):
            continue
        rows.append(
            {
                "number": case.get("number", ""),
                "address": case.get("address", ""),
                "owner": case.get("owner", ""),
                "status": case.get("status", ""),
                "inspector": case.get("inspector", ""),
                "nextDue": next_due(summary),
            }
        )
    rows.sort(key=lambda r: (r["nextDue"] == "", r["nextDue"], str(r["number"])))
    return {
        "ok": True,
        "cases": rows[:MAX_ROWS],
        "total": len(rows),
        "partial": len(rows) > MAX_ROWS,
        # Cases that exist in the folder but are not in the list because their summary could not be used.
        "incomplete": len(index.get("missing", [])) + len(index.get("stale", [])) + len(index.get("unreadable", [])) + len(index.get("mismatched", [])),
        "readAt": index.get("readAt", ""),
    }
