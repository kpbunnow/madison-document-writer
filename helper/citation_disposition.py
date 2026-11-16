"""Initial citation-only closure facts; no storage, clock or publication authority."""

CITATION_ONLY = "initial-citation-only"


def citation_only_item(item):
    return isinstance(item, dict) and item.get("dueExempt") == CITATION_ONLY


def citation_only_closed(document):
    if not isinstance(document, dict):
        return False
    group = document.get("issuanceGroup") or {}
    live = [item for item in document.get("items", []) if not item.get("done") and not item.get("withdrawn")]
    return bool(
        document.get("type") == "citation"
        and not document.get("draft")
        and not document.get("void")
        and not document.get("superseded")
        and not document.get("fromReinspId")
        and isinstance(document.get("importInspection"), dict)
        and document["importInspection"].get("type") == "initial"
        and isinstance(group, dict)
        and group.get("noticeId")
        and group.get("citationId")
        and document.get("fromDocId") == group.get("noticeId")
        and live
        and all(citation_only_item(item) and item.get("cite") and not item.get("due") for item in live)
    )


def validate_citation_only(snapshot, case):
    flagged = [item for item in snapshot["items"] if citation_only_item(item)]
    if not flagged:
        return
    group = snapshot.get("issuanceGroup") or {}
    inspection = snapshot.get("importInspection") or {}
    if (
        case.get("caseType") == "snow-10.28"
        or snapshot.get("type") not in ("notice", "citation")
        or snapshot.get("fromReinspId")
        or not isinstance(group, dict)
        or not group.get("noticeId")
        or not group.get("citationId")
        or not isinstance(inspection, dict)
        or inspection.get("type") != "initial"
    ):
        raise ValueError("Citation-only closure is available only for an initial inspection issued with its citation")
    if any(item.get("due") or item.get("done") or (not item.get("cite") and not item.get("withdrawn")) for item in flagged):
        raise ValueError("Citation-only items need a citation and a blank due date; they are not marked corrected")
    if any(not item.get("done") and not item.get("withdrawn") and not citation_only_item(item) for item in snapshot["items"]):
        raise ValueError("Citation-only closure must cover every remaining violation before the case can close")
