"""Pure atomic initial-issuance group checks; the store retains transaction and save authority."""

from citation_disposition import citation_only_item


def _validate_initial_notice_group(event, documents):
    snap = event.get("payload", {}).get("snapshot", {})
    if event["type"] != "notice.issued" or snap.get("authoringVersion", 0) < 5:
        return
    selected = _selected_citations(snap)
    if not selected:
        if snap.get("issuanceGroup"):
            raise ValueError("An initial issuance group requires selected citations on its Official Notice")
        return
    group = snap.get("issuanceGroup") or {}
    if not isinstance(group, dict):
        raise ValueError("The initial notice is missing a valid issuance group")
    companion = documents.get(group.get("citationId"), {})
    citation = companion.get("payload", {}).get("snapshot", {})
    cited = _selected_citations(citation)
    if (
        _group_identity_bad(group, event, snap)
        or _citation_header_bad(citation, companion, event)
        or _citation_source_bad(citation, snap, group)
        or _selection_bad(cited, selected)
    ):
        raise ValueError("The Official Notice and every selected initial citation must be completed and saved together")


def _validate_initial_citation_group(event, documents):
    snap = event.get("payload", {}).get("snapshot", {})
    if event["type"] == "citation.issued" and snap.get("issuanceGroup"):
        group = snap["issuanceGroup"]
        if not isinstance(group, dict):
            raise ValueError("The initial citation is missing a valid issuance group")
        notice = documents.get(group.get("noticeId"), {})
        if notice.get("type") != "notice.issued" or notice.get("payload", {}).get("snapshot", {}).get("issuanceGroup") != group:
            raise ValueError("An initial citation must be saved with its reviewed Official Notice")


def _group_identity_bad(group, event, snap):
    return group.get("id") != event["id"] or group.get("noticeId") != snap["id"]


def _citation_header_bad(citation, companion, event):
    return (
        citation.get("type") != "citation"
        or companion.get("type") != "citation.issued"
        or citation.get("authoringVersion", 0) < 5
        or companion.get("by") != event.get("by")
        or not companion.get("payload", {}).get("lifecycle")
    )


def _citation_source_bad(citation, snap, group):
    return (
        citation.get("issuanceGroup") != group
        or citation.get("fromDocId") != snap["id"]
        or citation.get("fromReinspId")
        or citation.get("mailed") != snap.get("mailed")
        or citation.get("frozen", {}).get("inspector") != snap.get("frozen", {}).get("inspector")
        or citation.get("frozen", {}).get("case") != snap.get("frozen", {}).get("case")
    )


def _selection_bad(cited, selected):
    return (
        len(cited) != len(selected)
        or {i.get("srcItemId") for i in cited} != {i["id"] for i in selected}
        or any(i.get("done") for i in selected)
        or {i.get("srcItemId") for i in cited if citation_only_item(i)} != {i["id"] for i in selected if citation_only_item(i)}
    )


def _selected_citations(snap):
    return [i for i in snap.get("items", []) if i.get("cite") and not i.get("withdrawn")]
