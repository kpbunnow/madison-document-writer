"""Publication identity, current source and recorded-visit consistency.

Read-only over the supplied record/history. The store retains locking, merge, history
replay, authoring/special policy, atomic publication and integrity receipts. Calendar
and history operations are explicit call-time inputs, never cached authorities.
"""

from citation_disposition import citation_only_item, citation_only_closed


def _validate_publication_identity(
    *, event, record, check_date_window, calendar_date, mailing_max_day, mailing_message, special_types, supplemental_types
):
    payload, snap = (event["payload"], event["payload"]["snapshot"])
    kind = snap.get("type")
    if (
        kind not in ("notice", "extension", "reinspectionNotice", "citation", "referral", "referralUpdate", "compliance", *special_types)
        or event["type"] != kind + ".issued"
    ):
        raise ValueError("The issued event and document type disagree")
    items = snap["items"]
    if (
        not items
        and kind not in supplemental_types
        or len({i.get("id") for i in items}) != len(items)
        or len({str(i.get("no", "")) for i in items}) != len(items)
    ):
        raise ValueError("Every document needs unique item identities and numbers")
    if (
        payload.get("docId") != snap["id"]
        or not event.get("by")
        or (not snap.get("frozen", {}).get("inspector"))
        or (not calendar_date(snap.get("mailed")))
    ):
        raise ValueError("The issued document is missing its identity, signer, date or frozen source")
    initial = snap.get("frozen", {}).get("case", {}).get("date", record["case"].get("date", ""))
    inspected = snap.get("inspDate") or initial
    if snap.get("caseId") != record["case"]["id"] or snap["frozen"]["inspector"].get("id") != event["by"]:
        raise ValueError("The document case or signer disagrees with the saved record")
    if not calendar_date(inspected) or not inspected <= snap["mailed"] <= (mailing_max_day(kind, event["at"]) if check_date_window else "9999-12-31"):
        raise ValueError(mailing_message(kind))
    if any(
        (
            i.get("done") and (not i.get("withdrawn")) and (not calendar_date(i.get("doneOn")) or not initial <= i["doneOn"] <= inspected)
            for i in items
        )
    ):
        raise ValueError("Compliance dates must fall within the recorded inspection")
    return (payload, snap, kind, items)


def _validate_snow_publication(*, snow_rules, snap, documents, superseded, voided, event):
    snow_rules.validate_snapshot(snap, require_letter=True)
    for previous, _ in documents.values():
        if (
            previous.get("snowInspectionId") == snap.get("snowInspectionId")
            and previous.get("id") not in superseded
            and (previous.get("id") not in voided)
            and (event["type"] != "correction.issued")
        ):
            raise ValueError("This snow inspection already has a citation; use its correction history")
    if snap.get("authoringVersion", 0) >= 10 and event["type"] != "correction.issued":
        if snap.get("frozen", {}).get("snowCoverFormat") != 10:
            raise ValueError("A new snow citation must use the current cover format")
    numbers = [c.get("num") for c in snap.get("cits", {}).values()]
    if event["type"] != "correction.issued" and any(
        (n in {c.get("num") for d, _ in documents.values() for c in d.get("cits", {}).values()} for n in numbers)
    ):
        raise ValueError("A new snow citation needs a distinct citation number")
    return


def _validate_notice_publication(*, documents):
    if any((d[0].get("type") == "notice" for d in documents.values())):
        raise ValueError("The original notice already exists; use a linked correction")
    return


def _validate_followup_source(*, source, snap, items, documents, kind, superseded, voided):
    if (
        not source
        or source["id"] != snap.get("fromDocId")
        or source.get("type") == "compliance"
        or citation_only_closed(source)
        or all((i.get("withdrawn") for i in source["items"]))
    ):
        raise ValueError("The follow-up must use the current open case document")
    if [(i.get("srcItemId"), str(i.get("no"))) for i in items] != [(i.get("id"), str(i.get("no"))) for i in source["items"]]:
        raise ValueError("A follow-up must retain every item and its numbering")
    referred = any(
        (d[0].get("type") in ("referral", "referralUpdate") for key, d in documents.items() if key not in superseded and key not in voided)
    )
    if referred and kind not in ("referralUpdate", "compliance") or (kind == "referralUpdate" and (not referred)):
        raise ValueError("This document is outside the case referral workflow")


def _validate_followup_visit(*, visits, source, documents, snap, items, rid, supplemental_types):
    visit = next((r for r in visits if r.get("id") == rid), None)
    if (
        not visit
        or visit.get("sourceDocId") != source["id"]
        or any((d[0].get("fromReinspId") == rid and d[0].get("type") not in supplemental_types for d in documents.values()))
    ):
        raise ValueError("The follow-up needs one unused, linked inspection")
    if snap.get("inspDate") != visit.get("date") or snap.get("inspTime", "") != visit.get("time", ""):
        raise ValueError("The document and inspection dates/times disagree")
    for item in items:
        result = visit.get("results", {}).get(item["srcItemId"], {})
        if bool(item.get("done")) != (result.get("oc") == "corrected") or (
            item.get("done") and item.get("doneOn") != (result.get("on") or visit.get("date"))
        ):
            raise ValueError("The document and recorded inspection outcomes disagree")


def _validate_followup_outcomes(*, kind, items, source):
    if kind == "compliance" and any((not i.get("done") and (not i.get("withdrawn")) for i in items)):
        raise ValueError("A compliance letter cannot close unresolved items")
    for item, previous in zip(items, source["items"]):
        if previous.get("withdrawn") and (not item.get("withdrawn")) or (previous.get("done") and (not item.get("done"))):
            raise ValueError("Prior compliance and withdrawals must remain in later documents")
    if kind == "reinspectionNotice":
        # A Reinspection Notice is a status update: it never assigns, moves or removes a due date.
        if all(i.get("done") or i.get("withdrawn") for i in items):
            raise ValueError("A Reinspection Notice needs at least one outstanding item")
        if any(not i.get("withdrawn") and (i.get("due") or "") != (p.get("due") or "") for i, p in zip(items, source["items"])):
            raise ValueError("A Reinspection Notice keeps every due date as assigned")


def _validate_new_citation_numbers(*, items, documents, snap):
    if any((i.get("cite") and (i.get("done") or i.get("withdrawn")) for i in items)):
        raise ValueError("Only outstanding items may be selected for a new citation")
    numbers = [snap.get("cits", {}).get(i["id"], {}).get("num") for i in items if i.get("cite") and (not i.get("withdrawn"))]
    previous_numbers = {c.get("num") for d, _ in documents.values() for c in d.get("cits", {}).values()}
    if not numbers or any((not n for n in numbers)) or len(numbers) != len(set(numbers)) or set(numbers) & previous_numbers:
        raise ValueError("A new citation must use distinct citation numbers; corrections retain existing numbers")


def validate_publication(
    record,
    event,
    documents,
    superseded,
    voided,
    visits,
    check_date_window=True,
    *,
    calendar_date,
    mailing_max_day,
    mailing_message,
    current_document,
    validate_special_publication,
    special_types,
    supplemental_types,
):
    payload, snap, kind, items = _validate_publication_identity(
        event=event,
        record=record,
        check_date_window=check_date_window,
        calendar_date=calendar_date,
        mailing_max_day=mailing_max_day,
        mailing_message=mailing_message,
        special_types=special_types,
        supplemental_types=supplemental_types,
    )
    import snow_rules

    if snap.get("authoringVersion", 0) >= 9 and (snow_rules.is_snow(snap) or record["case"].get("caseType") == "snow-10.28"):
        _validate_snow_publication(snow_rules=snow_rules, snap=snap, documents=documents, superseded=superseded, voided=voided, event=event)
        return
    if kind in ("notice", "extension", "citation") and any(
        (
            not i.get("done")
            and (not i.get("withdrawn"))
            and not citation_only_item(i)
            and (not calendar_date(i.get("due")) or i["due"] <= snap["mailed"])
            for i in items
        )
    ):
        raise ValueError("Outstanding items require a future due date")
    if kind in special_types:
        validate_special_publication(
            record, snap, documents, superseded, voided, visits, event["type"] == "correction.issued", new_action=check_date_window
        )
        return
    source = current_document(documents, superseded, voided)
    if kind == "notice":
        _validate_notice_publication(documents=documents)
        return
    _validate_followup_source(source=source, snap=snap, items=items, documents=documents, kind=kind, superseded=superseded, voided=voided)
    rid = snap.get("fromReinspId")
    if rid:
        _validate_followup_visit(
            visits=visits, source=source, documents=documents, snap=snap, items=items, rid=rid, supplemental_types=supplemental_types
        )
    elif kind != "citation" or source.get("type") != "notice":
        raise ValueError("This follow-up needs a recorded inspection")
    _validate_followup_outcomes(kind=kind, items=items, source=source)
    if kind == "citation":
        _validate_new_citation_numbers(items=items, documents=documents, snap=snap)
