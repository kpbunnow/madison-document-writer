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


def require_citation_only_lifecycle(kind, payload, seen):
    snapshot = payload.get("snapshot")
    if isinstance(snapshot, dict) and isinstance(snapshot.get("items"), list):
        seen = seen or any(citation_only_item(item) for item in snapshot["items"])
    if seen and (kind == "reinspection.recorded" or kind.endswith(".issued") and kind != "correction.issued") and not payload.get("lifecycle"):
        raise ValueError("Citation-only records require reviewed lifecycle publication and inspection links")
    return seen


def validate_citation_only_result(result):
    if not result.get("carried") or result.get("oc") != "none" or any(result.get(key) for key in ("on", "due", "cite", "note")):
        raise ValueError("Citation-only items carry forward without a new observation, deadline or citation")


def citation_only_followup(snapshot):
    return bool(snapshot.get("fromDocId") and not snapshot.get("issuanceGroup") and not snapshot.get("initialPreview"))


def citation_only_closure_requested(snapshot):
    live = [item for item in snapshot.get("items", []) if not item.get("done") and not item.get("withdrawn")]
    return bool(live and all(citation_only_item(item) for item in live))


def validate_carried_citation_only(items, source_items):
    if any(citation_only_item(item) != citation_only_item(prior) for item, prior in zip(items, source_items)):
        raise ValueError("A follow-up must retain the original citation-only dispositions")


def validate_citation_only(snapshot, case):
    if "omitRepairDueDate" in snapshot.get("frozen", {}):
        validate_undated_layout(snapshot)
    flagged = [item for item in snapshot["items"] if citation_only_item(item)]
    if not flagged:
        return
    carried = citation_only_followup(snapshot)
    group = snapshot.get("issuanceGroup") or {}
    inspection = snapshot.get("importInspection") or {}
    if (
        (not isinstance(snapshot.get("authoringVersion"), int) or snapshot["authoringVersion"] < 5)
        or case.get("caseType") == "snow-10.28"
        or (
            not carried
            and (
                snapshot.get("type") not in ("notice", "citation")
                or snapshot.get("fromReinspId")
                or not isinstance(group, dict)
                or not group.get("noticeId")
                or not group.get("citationId")
                or not isinstance(inspection, dict)
                or inspection.get("type") != "initial"
            )
        )
    ):
        raise ValueError("Citation-only disposition is available only for an initial inspection issued with its citation")
    if any(
        item.get("due")
        or item.get("done")
        or item.get("doneOn")
        or (item.get("cite") if carried else not item.get("cite") and not item.get("withdrawn"))
        for item in flagged
    ):
        raise ValueError("Citation-only items retain a blank due date and are never marked corrected or cited again")


def validate_undated_layout(snapshot):
    """A new optional presentation fact; older issued packets keep their original columns."""
    if (
        snapshot["frozen"]["omitRepairDueDate"] is not True
        or snapshot.get("type") not in ("notice", "citation")
        or snapshot.get("fromReinspId")
        or not isinstance(snapshot.get("importInspection"), dict)
        or snapshot["importInspection"].get("type") != "initial"
        or not snapshot["items"]
        or any(not citation_only_item(item) or any(item.get(key) for key in ("due", "done", "doneOn")) for item in snapshot["items"])
    ):
        raise ValueError("A citation without the repair due-date column must contain only undated citation-only items")
