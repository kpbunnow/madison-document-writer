"""Atomic file transport and record-integrity gates for the local helper.

The .locks files are created with O_EXCL on the shared drive, so separate PCs
serialize a case's read/merge/write. A crash leaves a visible lock and fails
closed; it is never deleted merely because a writer is slow.
"""

from runtime_paths import resource

import contextlib
import copy
import datetime
from decimal import Decimal
import hashlib
import json
import case_integrity
from plain_files import UNSAFE_NAME_CHARS, plain_json_files, require_plain_file
import citation_pricing
import os
import re
import tempfile
import threading
import time
import socket
import uuid
from pathlib import Path
from helper_logging import logged, record
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

HERE = Path(__file__).resolve().parent
try:
    CITY_ZONE = ZoneInfo("America/Chicago")
except ZoneInfoNotFoundError:
    with (resource("city-timezone.tzif")).open("rb") as stream:
        CITY_ZONE = ZoneInfo.from_file(stream, key="America/Chicago")
MAILING_POLICY = json.loads((resource("calendar_policy.json")).read_text(encoding="utf-8"))
SPECIAL_TYPES = ("summaryAbatement", "nonSummaryAbatement", "noOccupancy", "bestInterestExtension", "vacancyExtension")
SUPPLEMENTAL_TYPES = ("summaryAbatement", "nonSummaryAbatement", "noOccupancy")


def active_restrictions(documents, superseded, voided):
    live = [d[0] for key, d in documents.items() if key not in superseded and key not in voided and d[0].get("type") == "noOccupancy"]
    released = {d.get("special", {}).get("releases") for d in live if d.get("special", {}).get("mode") == "release"}
    return [d for d in live if d.get("special", {}).get("mode") != "release" and d["id"] not in released]


def extension_format(snap, kind=None):
    """The rule set an extension's authoring version selects: R61 simplified Best Interest (15) and the R62
    all-item Best Interest and Vacancy formats (16) drop rules the earlier formats require."""
    version, kind = snap.get("authoringVersion", 0), kind or snap.get("type")
    if kind == "bestInterestExtension":
        return "all-items" if version >= 16 else "simplified" if version >= 15 else "reviewed"
    if kind == "vacancyExtension":
        return "all-items" if version >= 16 else "reviewed"
    return ""


def validate_best_interest_correction(snap, replaced):
    """A Best Interest or Vacancy Extension correction keeps its original's format (R61 authoring 15, R62 authoring
    16), so it can neither drop rules its original required nor return to them."""
    if snap.get("type") not in ("bestInterestExtension", "vacancyExtension") or not replaced:
        return
    if extension_format(snap) != extension_format(replaced, snap["type"]):
        label = "Best Interest" if snap["type"] == "bestInterestExtension" else "Vacancy"
        raise ValueError("A " + label + " Extension correction must keep its original's format")


def _validate_reviewed_scope(*, require, assert_fact, s, check_date_window, at):
    """Preserve the historical special-format check order."""
    require("reviewer", "reviewRef", "codeSource", "codeRevision", "authority", "signerName", "signerTitle", "delegation")
    assert_fact(
        s.get("reviewed") is True
        and calendar_date(s.get("reviewDateLegal"))
        and (not check_date_window or s["reviewDateLegal"] <= city_day(at).isoformat()),
        "Current ordinance, wording, procedure and signer authority need recorded division review",
    )
    assert_fact(s.get("scope") in ("building", "unit"), "Choose an explicit scope")
    if s["scope"] == "unit":
        require("unit")


def _validate_simple_scope(*, assert_fact, s, require):
    """Preserve the historical special-format check order."""
    assert_fact(s.get("scope") in ("building", "unit"), "Choose an explicit scope")
    if s["scope"] == "unit":
        require("unit")


def _validate_release_facts(*, require, s, assert_fact, check_date_window, at):
    """Preserve the historical special-format check order."""
    require("releases", "releaseFacts", "releaseFormRef", "releaseVisitId")
    if s["releaseVisitId"] == "external":
        require("releaseInspectionRef", "releaseInspectorId")
    assert_fact(
        calendar_date(s.get("releaseInspection"))
        and s["releaseInspection"] <= s["effective"]
        and (not check_date_window or s["releaseInspection"] <= city_day(at).isoformat()),
        "Record the actual release reinspection",
    )
    assert_fact(
        s.get("placardRemoved") is True
        and calendar_date(s.get("removalDate"))
        and (s["removalDate"] <= s["effective"])
        and (not check_date_window or s["removalDate"] <= city_day(at).isoformat()),
        "Record actual placard removal before written permission",
    )


def _validate_restriction_facts(*, require, assert_fact, s, mailed, check_date_window, at):
    """Preserve the historical special-format check order."""
    require("findings", "releaseConditions")
    assert_fact(s.get("posting") in ("posted", "pending"), "Record truthful posting status")
    if s["posting"] == "posted":
        assert_fact(
            calendar_date(s.get("postedDate"))
            and s["postedDate"] <= mailed
            and (not check_date_window or s["postedDate"] <= city_day(at).isoformat()),
            "Posting must be an actual past event",
        )
    else:
        require("prePostingRef")


def _validate_best_interest_dates(*, require, assert_fact, outstanding, mailed):
    """Preserve the historical special-format check order."""
    require("reason")
    assert_fact(all((calendar_date(i.get("due")) and i["due"] > mailed for i in outstanding)), "Each uncorrected item needs a future due date")
    dates = sorted({i["due"] for i in outstanding})
    assert_fact(
        len(dates) <= 3 and all(((datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days >= 7 for a, b in zip(dates, dates[1:]))),
        "Use at most three outstanding dates, seven days apart",
    )


def _validate_vacancy_dates(*, assert_fact, s, mailed, outstanding):
    """Preserve the historical special-format check order."""
    assert_fact(
        calendar_date(s.get("reviewDate"))
        and calendar_date(mailed)
        and ((datetime.date.fromisoformat(s["reviewDate"]) - datetime.date.fromisoformat(mailed)).days >= 7),
        "Record a review inspection at least seven days after mailing",
    )
    assert_fact(all((not i.get("due") for i in outstanding)), "Uncorrected Vacancy Extension items have no due date")


def _validate_reviewed_best_interest(*, require, assert_fact, s, selected, originals, mailed):
    """Preserve the historical special-format check order."""
    require("noticeRef", "reason", "intentions", "supervisor")
    assert_fact(s.get("stage") in ("administrative", "supervisory"), "Record the actual internal review stage")
    if s["stage"] == "supervisory":
        assert_fact(
            all((calendar_date(originals.get(str(i.get("no")))) and originals[str(i["no"])] < mailed for i in selected)),
            "Supervisory prosecution review requires passed deadlines",
        )


def _validate_reviewed_vacancy(*, require, assert_fact, s, mailed, snap):
    """Preserve the historical special-format check order."""
    require("vacancyFacts", "requestRef", "conditions", "expiryPolicyRef", "transferClause")
    assert_fact(
        calendar_date(s.get("reviewDate")) and s["reviewDate"] > mailed, "Record a future review appointment separately from repair deadlines"
    )
    contact_by = (datetime.date.fromisoformat(s["reviewDate"]) - datetime.timedelta(days=7)).isoformat()
    if contact_by < mailed:
        require("shortNoticeRef")
    assert_fact(
        s.get("expiryMode") in ("fixed", "review") and s.get("deadlineMode") in ("dated", "conditional"),
        "Choose the reviewed expiration and deadline models",
    )
    if s["expiryMode"] == "fixed":
        assert_fact(calendar_date(s.get("expiryDate")) and s["expiryDate"] > mailed, "Record a separate future expiration")
    if snap.get("authoringVersion", 0) >= 13:
        assert_fact(s["deadlineMode"] == "dated", "Vacancy Extensions require a new due date for each affected item")


def _validate_selected_item_dates(*, assert_fact, selected, snap, mailed, originals):
    """Preserve the historical special-format check order."""
    assert_fact(
        all((calendar_date(i.get("due")) and i["due"] > max(mailed, originals.get(str(i["no"]), "")) for i in selected)),
        "Affected items need later future deadlines",
    )
    dates = sorted({i["due"] for i in snap["items"] if not i.get("done") and (not i.get("withdrawn")) and i.get("due")})
    assert_fact(
        len(dates) <= 3 and all(((datetime.date.fromisoformat(b) - datetime.date.fromisoformat(a)).days >= 7 for a, b in zip(dates, dates[1:]))),
        "Use at most three outstanding dates, seven days apart",
    )


def _validate_all_item_facts(*, snap, s, assert_fact, kind, require, mailed):
    """Preserve the historical special-format check order."""
    outstanding = [i for i in snap["items"] if not i.get("done") and (not i.get("withdrawn"))]
    affected = s.get("affected", [])
    assert_fact(
        isinstance(affected, list) and outstanding and (sorted(map(str, affected)) == sorted((str(i.get("no")) for i in outstanding))),
        "The extension covers every uncorrected item",
    )
    originals = s.get("originalDues", {})
    assert_fact(isinstance(originals, dict), "Retain source deadlines")
    assert_fact(
        all((i.get("due", "") == originals.get(str(i.get("no")), i.get("due", "")) for i in snap["items"] if i not in outstanding)),
        "Corrected item dates cannot change",
    )
    if kind == "bestInterestExtension":
        _validate_best_interest_dates(require=require, assert_fact=assert_fact, outstanding=outstanding, mailed=mailed)
    else:
        _validate_vacancy_dates(assert_fact=assert_fact, s=s, mailed=mailed, outstanding=outstanding)


def _validate_selected_item_facts(*, s, assert_fact, snap, simple_best, require, kind, mailed):
    """Preserve the historical special-format check order."""
    affected = s.get("affected", [])
    assert_fact(isinstance(affected, list) and affected and (len(set(affected)) == len(affected)), "Choose affected outstanding item numbers")
    selected = [i for i in snap["items"] if str(i.get("no")) in affected and (not i.get("done")) and (not i.get("withdrawn"))]
    assert_fact(len(selected) == len(affected), "Affected items must be outstanding source items")
    assert_fact(s.get("noSafety") is True, "Extensions must exclude reviewed safety and urgent obligations")
    if not simple_best:
        require("safetyBasis")
    originals = s.get("originalDues", {})
    assert_fact(isinstance(originals, dict), "Retain source deadlines")
    assert_fact(
        all((i.get("due", "") == originals.get(str(i.get("no")), i.get("due", "")) for i in snap["items"] if str(i.get("no")) not in affected)),
        "Unselected item deadlines cannot change",
    )
    if simple_best:
        require("reason")
    elif kind == "bestInterestExtension":
        _validate_reviewed_best_interest(require=require, assert_fact=assert_fact, s=s, selected=selected, originals=originals, mailed=mailed)
    else:
        _validate_reviewed_vacancy(require=require, assert_fact=assert_fact, s=s, mailed=mailed, snap=snap)
    if kind == "bestInterestExtension" or s.get("deadlineMode") == "dated":
        _validate_selected_item_dates(assert_fact=assert_fact, selected=selected, snap=snap, mailed=mailed, originals=originals)
    elif s.get("deadlineMode") == "conditional":
        assert_fact(
            all((i.get("due", "") == originals.get(str(i.get("no")), "") for i in selected)),
            "Conditional extensions retain the original repair dates; do not invent a replacement date",
        )


def _validate_occupancy_facts(*, assert_fact, s, snap, mailed, check_date_window, at, require):
    """Preserve the historical special-format check order."""
    assert_fact(s.get("mode") in ("restrict", "release"), "Choose restriction or documented release")
    initial = snap.get("frozen", {}).get("case", {}).get("date", "")
    assert_fact(
        calendar_date(s.get("effective"))
        and initial <= s["effective"] <= mailed
        and (not check_date_window or s["effective"] <= city_day(at).isoformat()),
        "Invalid effective restriction / release date",
    )
    if s["mode"] == "release":
        _validate_release_facts(require=require, s=s, assert_fact=assert_fact, check_date_window=check_date_window, at=at)
    else:
        _validate_restriction_facts(require=require, assert_fact=assert_fact, s=s, mailed=mailed, check_date_window=check_date_window, at=at)


def _validate_nuisance_facts(*, kind, assert_fact, s, require, mailed):
    """Preserve the historical special-format check order."""
    variants = ("junk", "sidewalk", "tree", "secure", "custom") if kind == "summaryAbatement" else ("junk", "sidewalk", "tree", "custom")
    assert_fact(s.get("variant") in variants, "Choose a supported reviewed nuisance variant")
    require("findings", "work")
    if kind == "summaryAbatement":
        require("summaryBasis")
    else:
        require("servicePlan")
        assert_fact(
            calendar_date(s.get("orderDue")) and s["orderDue"] > mailed and (s.get("remedyReviewed") is True),
            "Non-summary orders need an approved future compliance date and reviewed Circuit Court remedy",
        )
    if s["variant"] == "custom":
        require("customReviewRef")
    if s["variant"] == "tree":
        require("forestryRef")
    if s["variant"] == "secure":
        require("securingConditions")
        if s.get("boarding"):
            require("boardingRef")


def _validate_special_scope(*, simple_vacancy, assert_fact, s, require, simple_best, check_date_window, at):
    """Preserve the historical special-format check order."""
    if simple_vacancy:
        _validate_simple_scope(assert_fact=assert_fact, s=s, require=require)
    elif not simple_best:
        _validate_reviewed_scope(require=require, assert_fact=assert_fact, s=s, check_date_window=check_date_window, at=at)


def _validate_special_family(*, kind, assert_fact, s, require, mailed, snap, check_date_window, at, all_items, simple_best):
    """Preserve the historical special-format check order."""
    if kind in ("summaryAbatement", "nonSummaryAbatement"):
        _validate_nuisance_facts(kind=kind, assert_fact=assert_fact, s=s, require=require, mailed=mailed)
    elif kind == "noOccupancy":
        _validate_occupancy_facts(assert_fact=assert_fact, s=s, snap=snap, mailed=mailed, check_date_window=check_date_window, at=at, require=require)
    elif all_items:
        _validate_all_item_facts(snap=snap, s=s, assert_fact=assert_fact, kind=kind, require=require, mailed=mailed)
    else:
        _validate_selected_item_facts(s=s, assert_fact=assert_fact, snap=snap, simple_best=simple_best, require=require, kind=kind, mailed=mailed)


def validate_special_fields(snap, at=None, check_date_window=True):
    """Mirror R26 variant requirements; supplied review evidence is not role authentication."""
    kind, s = (snap["type"], snap.get("special", {}))
    simple_best = kind == "bestInterestExtension" and snap.get("authoringVersion", 0) >= 15
    all_items = extension_format(snap) == "all-items"
    simple_vacancy = all_items and kind == "vacancyExtension"
    if not isinstance(s, dict):
        raise ValueError("Document-specific facts must be an object")

    def require(*keys):
        if any((not isinstance(s.get(k), str) or not s[k].strip() or re.search("◯|\\(\\s{0,8}\\)", s[k]) for k in keys)):
            raise ValueError("Complete the required document facts: " + ", ".join(keys))

    def assert_fact(condition, message):
        if not condition:
            raise ValueError(message)

    if re.search("◯|\\(\\s{0,8}\\)|class=[\\\"\\']blank[\\\"\\']", str(snap.get("frozen", {}).get("body", ""))):
        raise ValueError("Fill all printed narrative placeholders before issuance")
    _validate_special_scope(
        simple_vacancy=simple_vacancy,
        assert_fact=assert_fact,
        s=s,
        require=require,
        simple_best=simple_best,
        check_date_window=check_date_window,
        at=at,
    )
    inspected = snap.get("inspDate") or snap.get("frozen", {}).get("case", {}).get("date", "")
    mailed = snap.get("mailed", "")
    _validate_special_family(
        kind=kind,
        assert_fact=assert_fact,
        s=s,
        require=require,
        mailed=mailed,
        snap=snap,
        check_date_window=check_date_window,
        at=at,
        all_items=all_items,
        simple_best=simple_best,
    )
    if snap.get("initialAction") and kind not in SUPPLEMENTAL_TYPES:
        raise ValueError("Initial emergency actions must be scoped orders")
    if not calendar_date(inspected):
        raise ValueError("The document needs its actual factual inspection date")


def _special_publication_source(*, snap, documents, superseded, voided, kind, rid):
    pair = documents.get(snap.get("fromDocId"))
    source = pair[0] if pair and snap.get("fromDocId") not in superseded | voided else None
    if not source:
        raise ValueError("The scoped action needs an effective factual source")
    current = current_document(documents, superseded, voided)
    if current and source["id"] != current["id"] and not (kind in SUPPLEMENTAL_TYPES and rid and current.get("fromReinspId") == rid):
        raise ValueError("The source changed; review the current case")
    if [(i.get("srcItemId"), str(i.get("no"))) for i in snap["items"]] != [(i.get("id"), str(i.get("no"))) for i in source["items"]]:
        raise ValueError("Scoped actions retain all item identities, numbers and order")
    return source


def _special_publication_visit(*, snap, source, visits, live, kind, rid):
    visit = next((r for r in visits if r.get("id") == rid), None)
    if (
        not visit
        or visit.get("sourceDocId") != source["id"]
        or snap.get("inspDate") != visit.get("date")
        or snap.get("inspTime", "") != visit.get("time", "")
    ):
        raise ValueError("The action must match its one verified inspection")
    existing = [d for d in live if d.get("fromReinspId") == rid]
    if any(d.get("type") == kind or kind not in SUPPLEMENTAL_TYPES and d.get("type") not in SUPPLEMENTAL_TYPES for d in existing):
        raise ValueError("This inspection already has that action or a conflicting primary follow-up")
    for i in snap["items"]:
        res = visit.get("results", {}).get(i["srcItemId"], {})
        if bool(i.get("done")) != (res.get("oc") == "corrected") or i.get("done") and i.get("doneOn") != (res.get("on") or visit["date"]):
            raise ValueError("Action outcomes must match the inspection")


def _special_publication_administration(*, snap, source, visits):
    factual = next((r for r in visits if r.get("id") == snap.get("factualVisitId")), None)
    if (
        not snap.get("administrativeAction")
        or (
            factual
            and (
                factual.get("sourceDocId") != source["id"]
                or snap.get("inspDate") != factual.get("date")
                or snap.get("inspTime", "") != factual.get("time", "")
                or snap.get("inspectorId") != factual.get("inspectorId")
            )
        )
        or (
            not factual
            and (
                snap.get("factualVisitId") or snap.get("inspDate") != (source.get("inspDate") or source.get("frozen", {}).get("case", {}).get("date"))
            )
        )
    ):
        raise ValueError("Administrative letters must cite the actual existing inspection")
    for item, prior in zip(snap["items"], continuing_items(source, visits)):
        if bool(item.get("done")) != bool(prior.get("done")) or prior.get("done") and item.get("doneOn") != prior.get("doneOn"):
            raise ValueError("Administrative actions must preserve recorded compliance")


def _special_publication_retained_items(*, snap, source, kind, s):
    for i, previous in zip(snap["items"], source["items"]):
        if previous.get("withdrawn") and not i.get("withdrawn") or previous.get("done") and not i.get("done"):
            raise ValueError("Prior withdrawals and compliance cannot be lost")
        if kind in SUPPLEMENTAL_TYPES and i.get("due", "") != previous.get("due", ""):
            raise ValueError("Supplemental orders cannot replace continuing item deadlines")
        if kind not in SUPPLEMENTAL_TYPES and s.get("originalDues", {}).get(str(i["no"])) != previous.get("due", ""):
            raise ValueError("Extension source deadlines must match the issued case")


def _special_publication_release(*, record, s, documents, superseded, voided, visits):
    old = next((d for d in active_restrictions(documents, superseded, voided) if d["id"] == s.get("releases")), None)
    release_id = s.get("verifiedReleaseVisitId") if s.get("releaseVisitId") == "external" else s.get("releaseVisitId")
    visit = next((r for r in visits if r.get("id") == release_id), None)
    if not visit or visit.get("caseId") != record["case"]["id"] or visit.get("date") != s.get("releaseInspection"):
        raise ValueError("The written release needs its actual verified physical reinspection record")
    if s.get("releaseVisitId") == "external" and (
        visit.get("purpose") != "occupancyRelease"
        or visit.get("sourceDocId") != s.get("releases")
        or visit.get("inspectionReference") != s.get("releaseInspectionRef")
        or visit.get("inspectorId") != s.get("releaseInspectorId")
        or visit.get("time", "") != s.get("releaseInspectionTime", "")
    ):
        raise ValueError("The external release must match its verified inspection facts")
    if (
        not old
        or old["special"]["scope"] != s.get("scope")
        or s.get("scope") == "unit"
        and old["special"].get("unit", "") != s.get("unit", "")
        or s.get("releaseInspection", "") < old["special"].get("effective", "")
    ):
        raise ValueError("Release requires an active restriction of the exact scope and a later verified reinspection")


def validate_special_publication(record, snap, documents, superseded, voided, visits, correction=False, new_action=True):
    if record.get("schema") not in (4, 5):
        raise ValueError("R26 actions require schema 4; update the writer and helper together")
    kind, s, rid = snap["type"], snap.get("special", {}), snap.get("fromReinspId")
    live = [d[0] for key, d in documents.items() if key not in superseded and key not in voided]
    referred = any(d.get("type") in ("referral", "referralUpdate") for d in live)
    # R62 (owner, Development 3): a referred case allows only an Update for Case Referral or a Compliance Letter; the
    # former approved emergency / occupancy exception for scoped orders is removed. Correcting a document issued
    # before the referral remains possible.
    historical_exception = (
        not new_action and kind in SUPPLEMENTAL_TYPES and s.get("emergencyApproved") is True and str(s.get("referralCoordination", "")).strip()
    )
    if referred and not correction and not historical_exception:
        raise ValueError("A referred case permits only an Update for Case Referral or a Compliance Letter")
    if snap.get("initialAction"):
        if kind not in SUPPLEMENTAL_TYPES or any(d.get("type") not in SUPPLEMENTAL_TYPES for d in live):
            raise ValueError("Use the current case source for this action")
    else:
        source = _special_publication_source(snap=snap, documents=documents, superseded=superseded, voided=voided, kind=kind, rid=rid)
        if rid:
            _special_publication_visit(snap=snap, source=source, visits=visits, live=live, kind=kind, rid=rid)
        else:
            _special_publication_administration(snap=snap, source=source, visits=visits)
        _special_publication_retained_items(snap=snap, source=source, kind=kind, s=s)
        if kind not in SUPPLEMENTAL_TYPES and (source.get("type") == "compliance" or not snap["items"]):
            raise ValueError("A completed case cannot receive a new extension")
    if kind == "noOccupancy" and s.get("mode") == "release":
        _special_publication_release(record=record, s=s, documents=documents, superseded=superseded, voided=voided, visits=visits)


def parse_instant(at):
    if not isinstance(at, str) or not at.strip():
        raise ValueError("Timestamp must be ISO date/time text")
    text = at.strip().replace("Z", "+00:00")
    # Python 3.10 accepts only three or six fractional-second digits.
    text = re.sub(r"(\d{2}:\d{2}:\d{2})[.,](\d+)", lambda m: m[1] + "." + (m[2] + "000000")[:6], text)
    try:
        instant = datetime.datetime.fromisoformat(text)
    except (ValueError, TypeError) as error:
        raise ValueError("Timestamp must be valid ISO date/time text") from error
    return instant.replace(tzinfo=instant.tzinfo or datetime.timezone.utc)


def city_day(at=None):
    instant = datetime.datetime.now(datetime.timezone.utc) if at is None else parse_instant(at)
    return instant.astimezone(CITY_ZONE).date()


def mailing_max_day(kind, at=None):
    key = "CITATION_MAX_DAYS_AHEAD" if kind == "citation" else "MAILED_MAX_DAYS_AHEAD"
    return (city_day(at) + datetime.timedelta(days=MAILING_POLICY[key])).isoformat()


def mailing_message(kind):
    days = MAILING_POLICY["CITATION_MAX_DAYS_AHEAD" if kind == "citation" else "MAILED_MAX_DAYS_AHEAD"]
    limit = "no later than today." if days == 0 else "no more than %s %s ahead." % ("five" if days == 5 else days, "day" if days == 1 else "days")
    return ("The citation mailing date" if kind == "citation" else "The mailing date") + " must be on or after the inspection and " + limit


def case_number_key(number, strict=False):
    if not isinstance(number, str) or not number.strip() or len(number.strip()) > 80 or re.search(r"[\x00-\x1f\x7f]", number):
        raise ValueError("Case number must be nonempty text of at most 80 characters")
    if strict and not re.fullmatch(r"[A-Za-z0-9-]{3,80}", number):
        raise ValueError("New case number must use 3–80 letters, numbers or hyphens")
    return re.sub(r"\s+", " ", re.sub(r'[\\/:*?"<>|]', "-", number)).strip().lower()


def case_file_key(path):
    try:
        return case_number_key(Path(path).stem.rsplit(" - ", 1)[-1])
    except ValueError:
        return ""


def digest(data):
    return hashlib.sha256(data).hexdigest()


def encoded(record):
    return json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def event_order(event):
    try:
        stamp = parse_instant(event.get("at")).timestamp()
    except (ValueError, TypeError):
        stamp = 0
    return stamp, event["id"]


def safe_json_name(name):
    if (
        not isinstance(name, str)
        or not name.lower().endswith(".json")
        or name.startswith(".")
        or any(c in name for c in '\\/:*?"<>|')
        or UNSAFE_NAME_CHARS.search(name)
        or re.search(r"[\t\n\v\f\r]", name)
        or Path(name).name != name
        or len(name) > 220
        or name.endswith((" ", "."))
        or re.match(r"(?i)^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)", name)
    ):
        raise ValueError("Invalid case filename")
    return name


# Locks this helper process holds right now, by kind ("case", "issued-pdf", ...). Memory only: Exit Document
# Writer refuses to stop the helper while any is held. Case numbers and file names are never recorded here.
HELD_LOCKS = {}
HELD_LOCKS_GUARD = threading.Lock()


def held_lock_kinds():
    with HELD_LOCKS_GUARD:
        return sorted(kind for kind, count in HELD_LOCKS.items() if count)


def _hold(kind, change):
    with HELD_LOCKS_GUARD:
        HELD_LOCKS[kind] = HELD_LOCKS.get(kind, 0) + change
        if HELD_LOCKS[kind] <= 0:
            del HELD_LOCKS[kind]


@contextlib.contextmanager
def file_lock(folder, key, wait=5):
    locks = Path(folder) / ".locks"
    locks.mkdir(exist_ok=True)
    path = locks / (hashlib.sha256(key.encode()).hexdigest() + ".lock")
    administration = locks / (hashlib.sha256(b"lock-administration").hexdigest() + ".lock")
    deadline = time.monotonic() + wait
    owner = uuid.uuid4().hex
    gate = locks / (hashlib.sha256(b"lock-recovery").hexdigest() + ".lock")

    def remove_owned(identity=None):
        try:
            if identity is not None and (path.stat().st_dev, path.stat().st_ino) == identity:
                path.unlink()
            elif identity is None and json.loads(path.read_text(encoding="utf-8")).get("owner") == owner:
                path.unlink()
        except (OSError, ValueError):
            pass

    while True:
        identity = None
        try:
            if key != "lock-recovery" and gate.exists() or key.startswith("case:") and administration.exists():
                raise FileExistsError()
            fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            stat = os.fstat(fd)
            identity = (stat.st_dev, stat.st_ino)
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as stream:
                    json.dump(
                        {"pid": os.getpid(), "host": os.environ.get("COMPUTERNAME") or socket.gethostname(), "at": time.time(), "owner": owner},
                        stream,
                    )
                    stream.flush()
                    os.fsync(stream.fileno())
            except BaseException:
                remove_owned(identity)
                raise
            if key != "lock-recovery" and gate.exists() or key.startswith("case:") and administration.exists():
                remove_owned()
                raise FileExistsError()
            break
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise RuntimeError(
                    ("Shared saving is busy. Retry shortly; if it continues, ask an administrator to inspect shared locks in Tools & settings.")
                )
            time.sleep(0.05)
    record("lock", "acquired")
    kind = key.split(":", 1)[0]
    _hold(kind, 1)
    try:
        yield
    finally:
        _hold(kind, -1)
        record("lock", "released")
        try:
            if json.loads(path.read_text(encoding="utf-8")).get("owner") == owner:
                path.unlink(missing_ok=True)
        except (OSError, ValueError):
            pass


def atomic_write(target, body):
    target = Path(target)
    fd, temporary = tempfile.mkstemp(prefix="._dw-", suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(body)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
    finally:
        Path(temporary).unlink(missing_ok=True)


def publish_new(target, body):
    """Publish a complete file at a new name, never replacing one that appeared meanwhile.

    Raises FileExistsError when the name exists, including a file written by a
    writer that does not use the program's locks."""
    target = Path(target)
    fd, temporary = tempfile.mkstemp(prefix="._dw-", suffix=".tmp", dir=target.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(body)
            stream.flush()
            os.fsync(stream.fileno())
        if os.name == "nt":
            os.rename(temporary, target)  # Windows rename refuses an existing name
        else:
            os.link(temporary, target)
    finally:
        Path(temporary).unlink(missing_ok=True)


def validate_case(record, legacy=False):
    if (
        not isinstance(record, dict)
        or record.get("format") != "madison-case-file"
        or record.get("schema") not in ((2, 3, 4, 5) if legacy else (3, 4, 5))
    ):
        raise ValueError("Expected a schema-3 or schema-4 Madison case file; update all program files together")
    case = record.get("case")
    if not isinstance(case, dict) or any(not isinstance(case.get(k), str) or not case[k].strip() for k in ("number", "id")):
        raise ValueError("Case number and identity are required")
    case_number_key(case["number"])
    inspectors = record.get("inspectors", [])
    if not isinstance(record.get("events"), list) or not isinstance(inspectors, list) or any(not isinstance(x, dict) for x in inspectors):
        raise ValueError("Invalid event or inspector list")
    seen = set()
    for event in record["events"]:
        _require_valid_event(event, seen)


def _require_valid_event(event, seen):
    if not isinstance(event, dict) or not isinstance(event.get("id"), str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", event["id"]):
        raise ValueError("Invalid event identity")
    if event["id"] in seen:
        raise ValueError("Duplicate event identity")
    seen.add(event["id"])
    if not isinstance(event.get("type"), str) or not event["type"].strip() or not isinstance(event.get("payload", {}), dict):
        raise ValueError("Invalid event")
    if event["type"].endswith(".issued"):
        snapshot = event.get("payload", {}).get("snapshot", {})
        if not isinstance(snapshot, dict):
            raise ValueError("Invalid event")
        if snapshot.get("draft"):
            raise ValueError("A working draft cannot be published to the shared record")


def remap(event, old_id, new_id):
    event = json.loads(json.dumps(event))
    payload = event.get("payload", {})
    for item in (payload, payload.get("snapshot", {}), payload.get("reinspection", {})):
        if item.get("caseId") == old_id:
            item["caseId"] = new_id
    return event


UNREADABLE_CASE = "This case file could not be read as a Madison case record. It has been left unchanged; ask an administrator to review it."


def read_case(folder, name):
    target = Path(folder) / safe_json_name(name)
    require_plain_file(target)
    raw = target.read_bytes()
    try:
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError("not a case record")
        integrity = case_integrity.verify_record(value, folder)
    except (ValueError, RecursionError, TypeError, AttributeError, KeyError):
        raise ValueError(UNREADABLE_CASE) from None
    return {"ok": True, "file": value, "integrity": integrity, "revision": digest(raw), "name": target.name}


def _catalog_publication_reviews(catalog_file):
    path = Path(catalog_file)
    if path.exists():
        review_file = json.loads(path.read_text(encoding="utf-8"))
        if review_file.get("format") != "madison-catalog-review" or not isinstance(review_file.get("events"), list):
            raise ValueError("Catalog review history is invalid")
        reviews = review_file["events"]
    else:
        reviews = []
    latest = {}
    for event in reviews:
        if not isinstance(event, dict) or not isinstance(event.get("key"), str):
            raise ValueError("Catalog review history is invalid")
        latest[event["key"]] = event
    return latest


def _validate_catalog_selection(*, item, manifest, latest, replacements):
    key = item.get("libraryKey")
    if not key:
        return  # Individually authored entries retain existing policy.
    bundled = manifest["items"].get(key)
    if not bundled:
        raise ValueError("Selected catalog entry is not in this release")
    review = latest.get(key)
    if key in replacements or review and review.get("status") == "retired":
        raise ValueError("Selected catalog entry was retired or superseded; review the draft")
    if review and review.get("status") == "approved":
        if item.get("catalogReviewId") != review.get("id") or item.get("catalogVersion") != review.get("version"):
            raise ValueError("Catalog version changed after selection; review and adopt the current version")
    elif bundled.get("draft") or not bundled.get("ordinances"):
        raise ValueError("Draft or incomplete catalog language needs division review")
    elif item.get("catalogReviewId"):
        raise ValueError("Selected catalog review cannot be verified")


def validate_catalog_publication(current, incoming, catalog_file, manifest_file):
    """Only new selections are checked; corrections and inherited history stay frozen."""
    prior = {e["id"] for e in current.get("events", [])} if current else set()
    notices = [e for e in incoming["events"] if e["id"] not in prior and e["type"] == "notice.issued"]
    if not notices:
        return
    manifest = json.loads(Path(manifest_file).read_text(encoding="utf-8"))
    if manifest.get("format") != "madison-catalog-manifest" or not isinstance(manifest.get("items"), dict):
        raise ValueError("Catalog manifest is unavailable or invalid")
    latest = _catalog_publication_reviews(catalog_file)
    replacements = {e.get("replaces") for e in latest.values() if e.get("status") == "approved" and e.get("replaces")}
    for notice in notices:
        for item in notice["payload"]["snapshot"].get("items", []):
            _validate_catalog_selection(item=item, manifest=manifest, latest=latest, replacements=replacements)


def _has_priced_citation(record):
    """Whether any event issues a priced citation. Wrong-shaped records answer no here; validation refuses them next."""
    events = record.get("events") if isinstance(record, dict) else None
    for event in events if isinstance(events, list) else []:
        payload = event.get("payload") if isinstance(event, dict) else None
        snapshot = payload.get("snapshot") if isinstance(payload, dict) else None
        if not isinstance(snapshot, dict):
            continue
        version = snapshot.get("authoringVersion", 0)
        if isinstance(version, (int, float)) and not isinstance(version, bool) and version >= 6 and snapshot.get("type") == "citation":
            return True
    return False


@logged("case-save")
def save_case(folder, name, incoming, base_revision="", base_case=None, idempotency_event="", catalog_file=None, manifest_file=None):
    # Different cases for one respondent share a pricing lock. The established
    # per-case lock still encloses merge/validate/write, and retries remain exact.
    lock = file_lock(Path(folder), "citation-pricing") if _has_priced_citation(incoming) else contextlib.nullcontext()
    with lock:
        return _save_case(folder, name, incoming, base_revision, base_case, idempotency_event, catalog_file, manifest_file)


def _resolve_case_save_target(*, folder, name, number_key, number):
    target = folder / name
    require_plain_file(target)
    matches = [p for p in plain_json_files(folder) if case_file_key(p) == number_key]
    if len(matches) > 1:
        raise ValueError("Multiple shared files have this case number. Resolve the duplicate files before saving")
    if matches:
        target = matches[0]
    elif case_file_key(name) != number_key:
        raise ValueError("Case filename must end with the case number")
    if case_integrity.reconcile_publication(folder, number):
        matches = [p for p in plain_json_files(folder) if case_file_key(p) == number_key]
        if len(matches) != 1:
            raise ValueError("Pending transaction case identity is ambiguous")
        target = matches[0]
    return target


def _merge_case_details(*, current, incoming, base_case):
    clean = lambda k: {a: b for a, b in k.items() if a not in ("savedAt", "id")}
    remote, local = (clean(current["case"]), clean(incoming["case"]))
    local["number"] = remote["number"]
    baseline = clean(base_case) if isinstance(base_case, dict) else None
    merged = dict(remote)
    absent = object()
    for key in remote.keys() | local.keys():
        old, new = (remote.get(key, absent), local.get(key, absent))
        if old == new:
            continue
        if baseline is None:
            raise ValueError("Case details differ from the shared record. Reopen the shared case before changing its details")
        before = baseline.get(key, absent)
        if new == before:
            continue
        if old != before:
            raise ValueError("Both copies changed %s. Keep the local case and review the shared copy before saving" % key)
        if new is absent:
            merged.pop(key, None)
        else:
            merged[key] = new
    return merged


def _merge_case_events(*, current, output, incoming):
    cid = current["case"]["id"]
    output["case"]["id"] = cid
    by_id = {event["id"]: event for event in current["events"]}
    for event in incoming["events"]:
        event = remap(event, incoming["case"]["id"], cid)
        old = by_id.get(event["id"])
        if old is not None and encoded(old) != encoded(event):
            raise ValueError("Conflicting content for an existing event; neither version was discarded")
        by_id[event["id"]] = event
    output["events"] = sorted(by_id.values(), key=event_order)
    inspectors = {i["id"]: i for i in current.get("inspectors", [])}
    inspectors.update({i["id"]: i for i in incoming.get("inspectors", [])})
    output["inspectors"] = list(inspectors.values())


def _merge_existing_case_save(*, previous, folder, incoming, number_key, base_revision, idempotency_event, target, output, base_case):
    current = json.loads(previous)
    case_integrity.require_valid(current, folder)
    if current.get("schema", 1) > incoming.get("schema", 1):
        raise ValueError("A newer schema wrote this case; reopen it with the current writer before saving")
    if current.get("format") != "madison-case-file" or case_number_key(current.get("case", {}).get("number")) != number_key:
        raise ValueError("The existing file is not this case; it was not overwritten")
    if current.get("schema", current.get("version", 1)) not in (2, 3, 4, 5):
        if current.get("schema", current.get("version", 1)) > 5:
            raise ValueError("A newer program wrote this case. It was not overwritten")
        if not base_revision or digest(previous) != base_revision:
            raise ValueError("Reopen this legacy case before saving its upgraded record")
    else:
        validate_case(current, legacy=True)
        if idempotency_event:
            prior = next((e for e in current["events"] if e["id"] == idempotency_event), None)
            if prior:
                submitted = next((e for e in incoming["events"] if e["id"] == idempotency_event), None)
                if submitted is None or encoded(prior) != encoded(remap(submitted, incoming["case"]["id"], current["case"]["id"])):
                    raise ValueError("Conflicting content for an existing event; the saved record was preserved")
                case_integrity.anchor_after_save(folder)
                return (current, {"ok": True, "file": current, "revision": digest(previous), "name": target.name, "alreadyCommitted": True})
        output["case"] = _merge_case_details(current=current, incoming=incoming, base_case=base_case)
        _merge_case_events(current=current, output=output, incoming=incoming)
    validate_record_changes(current, incoming, output)
    recovery = folder / "_recovery"
    recovery.mkdir(exist_ok=True)
    atomic_write(recovery / (target.name + ".bak"), previous)
    return (current, None)


def _publish_validated_case(*, catalog_file, manifest_file, previous, current, output, folder, target):
    if catalog_file is not None:
        if manifest_file is None:
            raise ValueError("Catalog manifest is required")
        Path(catalog_file).parent.mkdir(parents=True, exist_ok=True)
        with file_lock(Path(catalog_file).parent, "catalog-review"):
            validate_catalog_publication(current if previous is not None else None, output, catalog_file, manifest_file)
            raw = encoded(output)
            if output.get("schema", 1) >= 5:
                case_integrity.publish_record(folder, target, output, previous)
            else:
                atomic_write(target, raw)
    else:
        raw = encoded(output)
        if output.get("schema", 1) >= 5:
            case_integrity.publish_record(folder, target, output, previous)
        else:
            atomic_write(target, raw)
    return raw


def _save_case(folder, name, incoming, base_revision="", base_case=None, idempotency_event="", catalog_file=None, manifest_file=None):
    folder = Path(folder)
    if not folder.is_dir():
        raise OSError("The shared case folder is unavailable; the case remains on this device")
    safe_json_name(name)
    validate_case(incoming)
    if incoming.get("schema", 1) < 5 and case_integrity.has_modern_evidence(incoming):
        raise ValueError("Integrity record removed from a migrated case")
    number = incoming["case"]["number"]
    number_key = case_number_key(number)
    # Keep the case-number lock around every resolve/merge/validate/publish phase.
    with file_lock(folder, "case:" + number_key):
        target = _resolve_case_save_target(folder=folder, name=name, number_key=number_key, number=number)
        output = json.loads(json.dumps(incoming))
        previous = target.read_bytes() if target.exists() else None
        current = None
        if previous is None and (not incoming.get("events")):
            case_number_key(number, strict=True)
        if previous is not None:
            current, already_committed = _merge_existing_case_save(
                previous=previous,
                folder=folder,
                incoming=incoming,
                number_key=number_key,
                base_revision=base_revision,
                idempotency_event=idempotency_event,
                target=target,
                output=output,
                base_case=base_case,
            )
            if already_committed is not None:
                return already_committed
        cross_case = (
            citation_history(folder, number_key)["history"]
            if any(
                (
                    e.get("payload", {}).get("snapshot", {}).get("authoringVersion", 0) >= 6
                    and e.get("payload", {}).get("snapshot", {}).get("type") == "citation"
                    for e in output.get("events", [])
                )
            )
            else []
        )
        validate_history(output, {e["id"] for e in current.get("events", [])} if previous is not None else set(), cross_case, folder)
        if output.get("schema", 1) >= 5:
            output = case_integrity.commit_record(current if previous is not None else None, output)
        raw = _publish_validated_case(
            catalog_file=catalog_file, manifest_file=manifest_file, previous=previous, current=current, output=output, folder=folder, target=target
        )
        case_integrity.anchor_after_save(folder)
        return {"ok": True, "file": output, "revision": digest(raw), "name": target.name}


@logged("summary-save")
def save_summary(folder, name, revision, summary):
    folder = Path(folder)
    if not isinstance(summary, dict) or summary.get("format") != "madison-case-summary":
        raise ValueError("Expected a case summary")
    number = case_number_key(summary.get("case", {}).get("number", ""))
    with file_lock(folder, "case:" + number.casefold()):
        current = read_case(folder, name)
        if current["revision"] != revision:
            return {"ok": False, "retry": True, "error": "The case changed before its summary was written"}
        if case_number_key(current["file"].get("case", {}).get("number", "")) != number:
            raise ValueError("The summary belongs to another case")
        summary["integrity"] = case_integrity.require_valid(current["file"], folder)
        import case_projection

        # Write only a summary that represents this exact case; reads check again.
        try:
            fields = case_projection.mismatched_fields(summary, current["file"]) if case_projection.used_by_reports(summary) else []
        except Exception as error:
            raise ValueError("The saved case cannot be summarized for Reports; the summary was not written") from error
        if fields:
            raise ValueError("The summary does not match the saved case (" + ", ".join(fields) + "); it was not written")
        summary["sourceFile"] = name
        summary["sourceRevision"] = revision
        target = folder / "Reporting Index"
        target.mkdir(exist_ok=True)
        summary_name = number + ".json"
        # Reuse a pre-R23 uppercase summary; do not create a duplicate on POSIX.
        matches = [p for p in target.glob("*.json") if p.name.casefold() == summary_name]
        if len(matches) > 1:
            raise ValueError("Duplicate summaries for this case; rebuild the reporting index")
        destination = matches[0] if matches else target / safe_json_name(summary_name)
        atomic_write(destination, encoded(summary))
        return {"ok": True}


def record_event(event):
    return event["type"].endswith(".issued") or event["type"] in ("document.voided", "reinspection.recorded", "document.served")


def validate_record_changes(current, incoming, output):
    """A correction must still target the exact record reviewed on that PC.

    Checking after event union, inside the lock, closes the two-writer race.
    Disjoint notes/filing receipts may merge; competing official actions may not.
    """
    known = {e["id"] for e in current.get("events", [])}
    current_head = {e["id"] for e in current.get("events", []) if record_event(e)}
    submitted = {e["id"] for e in incoming.get("events", [])}
    for event in incoming.get("events", []):
        if event["id"] in known:
            continue  # Retry after a lost response is idempotent.
        payload = event.get("payload", {})
        expected = payload.get("expectedHead")
        if event["type"] == "correction.issued" and not isinstance(expected, list):
            raise ValueError("The correction is missing its reviewed record baseline")
        if expected is not None and (not isinstance(expected, list) or current_head - set(expected)):
            raise ValueError(
                (
                    "The case changed on another computer after this action was reviewed."
                    " Keep the draft, reopen the shared case, and review its current vers"
                    "ion"
                )
            )
        if event["type"] == "correction.issued" and not current_head <= submitted:
            raise ValueError("Reopen the complete shared case before correcting it")


def _validate_initial_notice_group(event, documents):
    snap = event.get("payload", {}).get("snapshot", {})
    if event["type"] != "notice.issued" or snap.get("authoringVersion", 0) < 5:
        return
    selected = [i for i in snap.get("items", []) if i.get("cite") and not i.get("withdrawn")]
    if not selected:
        if snap.get("issuanceGroup"):
            raise ValueError("An initial issuance group requires selected citations on its Official Notice")
        return
    group = snap.get("issuanceGroup") or {}
    if not isinstance(group, dict):
        raise ValueError("The initial notice is missing a valid issuance group")
    companion = documents.get(group.get("citationId"), {})
    citation = companion.get("payload", {}).get("snapshot", {})
    cited = [i for i in citation.get("items", []) if i.get("cite") and not i.get("withdrawn")]
    if (
        group.get("id") != event["id"]
        or group.get("noticeId") != snap["id"]
        or citation.get("type") != "citation"
        or companion.get("type") != "citation.issued"
        or citation.get("authoringVersion", 0) < 5
        or companion.get("by") != event.get("by")
        or not companion.get("payload", {}).get("lifecycle")
        or citation.get("issuanceGroup") != group
        or citation.get("fromDocId") != snap["id"]
        or citation.get("fromReinspId")
        or citation.get("mailed") != snap.get("mailed")
        or citation.get("frozen", {}).get("inspector") != snap.get("frozen", {}).get("inspector")
        or citation.get("frozen", {}).get("case") != snap.get("frozen", {}).get("case")
        or len(cited) != len(selected)
        or {i.get("srcItemId") for i in cited} != {i["id"] for i in selected}
        or any(i.get("done") for i in selected)
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


def validate_issuance_groups(record):
    documents = {e.get("payload", {}).get("snapshot", {}).get("id"): e for e in record.get("events", []) if e["type"].endswith(".issued")}
    for event in record.get("events", []):
        _validate_initial_notice_group(event, documents)
    for event in record.get("events", []):
        _validate_initial_citation_group(event, documents)


def legacy_scheduled_citation_base(ordinance, tier):
    policy = json.loads(resource("citation_policy.json").read_text(encoding="utf-8"))
    entries = policy["legacyEntries"]
    match = next((f for f in entries if f["o"] == ordinance), None)
    if match is None:
        children = [f for f in entries if f["o"].startswith(ordinance + "(") and f.get("t")]
        if len(children) == 1:
            match = children[0]
    if match:
        amounts = [Decimal(m.replace(",", "")) for m in re.findall(r"\$([\d,]+(?:\.\d+)?)", match.get("r", ""))]
        tiers = match.get("t", [])
        if "1st" in match.get("r", "") and "2nd" in match.get("r", "") and amounts != [Decimal(str(t["a"])) for t in tiers]:
            return None
    else:
        section = re.match(r"^(\d+)\.(\d+)", ordinance)
        match = next(
            (
                f
                for f in [
                    {
                        "ch": f["ch"] + (["22"] if f["id"] == "ladder-12-month" else []),
                        "sec": f["sec"],
                        "t": [
                            {"a": t["amountCents"] / 100, "l": ("1st" if t["ordinal"] == 1 else "2nd" if t["ordinal"] == 2 else "3rd+")}
                            for t in f["tiers"]
                        ],
                    }
                    for f in policy["fallback"]
                ]
                if section and (section[1] in f["ch"] or section[0] in f["sec"])
            ),
            None,
        )
        tiers = match.get("t", []) if match else []
    pick = next((t for t in tiers if t["l"] == tier), tiers[-1] if tiers else None)
    return Decimal(str(pick["a"])) if pick else None


def _append_effective_citations(value, history):
    docs, excluded = {}, set()
    for event in sorted(value.get("events", []), key=event_order):
        payload = event.get("payload", {})
        snap = payload.get("snapshot")
        if record_event(event) and snap:
            docs[snap["id"]] = snap
            if payload.get("replaces"):
                excluded.add(payload["replaces"])
        if event["type"] == "document.voided":
            excluded.add(payload.get("docId"))
    for identity, snap in docs.items():
        if identity not in excluded and snap.get("type") == "citation":
            history.append({"case": snap.get("frozen", {}).get("case", value["case"]), "document": snap})


def citation_history(folder, exclude_number=""):
    """Read all effective citation snapshots, without altering local projections.

    Atomic replacement gives complete per-file reads. A corrupt/duplicate case
    blocks the request; incomplete history must never suggest a first offense.
    Publication serializes R30 citation writes before this read.
    """
    root = Path(folder)
    if not root.is_dir():
        raise OSError("The shared case folder is unavailable")
    context = case_integrity.VerificationContext(root)
    history, numbers = [], set()
    for path in sorted(plain_json_files(root)):
        if path.name.startswith("_"):
            continue
        value = json.loads(path.read_text(encoding="utf-8"))
        validate_case(value, legacy=True)
        case_integrity.require_valid(value, folder, context)
        number = case_number_key(value["case"]["number"])
        if number in numbers:
            raise ValueError("Duplicate shared case prevents complete citation history review")
        numbers.add(number)
        if number == exclude_number:
            continue
        _append_effective_citations(value, history)
    return {"ok": True, "history": history}


def _validate_correction_target(*, payload, documents, superseded, visits):
    target = payload.get("replaces")
    old = documents.get(target)
    if not old or old[1] != payload.get("baseEventId") or target in superseded:
        raise ValueError("The correction target has changed or was already replaced")
    active_versions = [d for d in documents if d not in superseded]
    if not active_versions or active_versions[-1] != target or any((r.get("sourceDocId") == target for r in visits)):
        raise ValueError("Later work depends on this document. Correct the latest document or add a record note")
    original = old[0]
    return (target, original)


def _validate_scoped_correction(*, original, snap):
    if original.get("type") in SPECIAL_TYPES:
        if len(str(snap.get("revision", {}).get("externalReference", "")).strip()) < 10:
            raise ValueError("Scoped corrections require a reviewed division amendment reference")
        for key in ("mode", "releases", "scope", "unit", "effective", "affected", "deadlineMode", "reviewDate", "expiryDate"):
            if snap.get("special", {}).get(key) != original.get("special", {}).get(key):
                raise ValueError("Use a newly reviewed action to change restriction, release, scope or conditional extension facts")


def _validate_correction_items(*, original, snap, same_type, record):
    allowed_type = (
        original.get("fromReinspId")
        and original.get("type") != "citation"
        and (original.get("type") not in SPECIAL_TYPES)
        and (snap.get("type") in ("extension", "referral", "referralUpdate", "compliance"))
    )
    if not (same_type or allowed_type) or [(i.get("id"), i.get("no")) for i in snap["items"]] != [
        (i.get("id"), i.get("no")) for i in original["items"]
    ]:
        raise ValueError("A correction cannot change document type, item identity, order or numbering")
    if snap.get("frozen", {}).get("case", {}).get("number") != original.get("frozen", {}).get("case", {}).get("number", record["case"]["number"]):
        raise ValueError("A correction cannot change case number")
    if original.get("type") == "citation":
        if any(
            (
                snap.get("cits", {}).get(i["id"], {}).get("num") != original.get("cits", {}).get(i["id"], {}).get("num")
                for i in original["items"]
                if i.get("cite")
            )
        ):
            raise ValueError("A citation correction must retain its original citation numbers")


def _validate_reinspection_notice_correction(*, original, snap):
    """A corrected Reinspection Notice still reports the due dates as assigned, as its first issue did."""
    if original.get("type") == "reinspectionNotice" and snap.get("type") == "reinspectionNotice":
        if any(not i.get("withdrawn") and (i.get("due") or "") != (o.get("due") or "") for i, o in zip(snap["items"], original["items"])):
            raise ValueError("A Reinspection Notice keeps every due date as assigned")


def _validate_correction_review(*, snap, target, original, payload, event):
    revision = snap.get("revision", {})
    if (
        revision.get("targetId") != target
        or revision.get("rootId") != original.get("revision", {}).get("rootId", target)
        or revision.get("number") != original.get("revision", {}).get("number", 0) + 1
    ):
        raise ValueError("Invalid correction revision chain")
    if len(str(payload.get("reason", "")).strip()) < 10 or not payload.get("changes") or (not payload.get("reviewedAt")) or (not event.get("by")):
        raise ValueError("A correction needs a reason, change review and identified inspector")
    if snap.get("type") in ("citation", "referral", "referralUpdate") and len(str(revision.get("externalReference", "")).strip()) < 10:
        raise ValueError("Record the court or attorney amendment instructions or reference")
    if any((i.get("withdrawn") and len(str(i.get("withdrawalReason", "")).strip()) < 10 for i in snap["items"])):
        raise ValueError("A withdrawn item needs a specific reason")


def _apply_visit_correction(*, visits, patch, original, snap):
    visit = next((r for r in visits if r.get("id") == patch.get("id")), None)
    if not visit or patch.get("id") != original.get("fromReinspId") or patch.get("baseEventId") != visit.get("_eventId"):
        raise ValueError("The visit correction is not linked to the original recorded visit")
    for key, result in patch.get("results", {}).items():
        if (
            key not in visit.get("results", {})
            or visit["results"][key].get("carried")
            or result.get("oc") not in ("none", "corrected", "progress", "noaccess")
        ):
            raise ValueError("The visit correction cannot change a carried or unrelated observation")
    amended = copy.deepcopy(visit)
    amended.update({k: patch[k] for k in ("date", "time") if k in patch})
    amended["results"].update(patch.get("results", {}))
    initial = snap.get("frozen", {}).get("case", {}).get("date", "")
    if not calendar_date(amended.get("date")) or any(
        (
            not r.get("carried")
            and (not calendar_date(r.get("on") or amended["date"]) or not initial <= (r.get("on") or amended["date"]) <= amended["date"])
            for r in amended["results"].values()
        )
    ):
        raise ValueError("The amended result dates must fall within their inspection")
    visit.update(amended)


def _validate_history_correction(*, payload, documents, superseded, visits, snap, record, event):
    target, original = _validate_correction_target(payload=payload, documents=documents, superseded=superseded, visits=visits)
    same_type = snap.get("type") == original.get("type")
    _validate_scoped_correction(original=original, snap=snap)
    _validate_correction_items(original=original, snap=snap, same_type=same_type, record=record)
    _validate_reinspection_notice_correction(original=original, snap=snap)
    _validate_correction_review(snap=snap, target=target, original=original, payload=payload, event=event)
    patch = payload.get("visitCorrection")
    if patch:
        _apply_visit_correction(visits=visits, patch=patch, original=original, snap=snap)
    superseded.add(target)


def _validate_history_snapshot(*, payload, event, historical_ids):
    snap = payload.get("snapshot")
    if not isinstance(snap, dict) or not snap.get("id") or (not isinstance(snap.get("items"), list)):
        raise ValueError("An issued document is missing its snapshot or item list")
    check_window = event["id"] not in historical_ids
    if check_window and snap.get("type") == "citation" and any((c.get("mandatoryAppearance") for c in snap.get("cits", {}).values())):
        raise ValueError(
            "Mandatory-appearance citations need division-approved defendant instructions. Your draft is retained; ask the division to approve the wording before issuance."
        )
    try:
        parse_instant(event.get("at"))
    except ValueError:
        if event["id"] not in historical_ids:
            raise
        check_window = False
    return (snap, check_window)


def _validate_history_special(*, snap, kind, payload, event, check_window, historical_ids, documents):
    if snap.get("authoringVersion", 0) < 4 or (kind != "correction.issued" and payload.get("lifecycle") != 1):
        raise ValueError("R26 actions require current authoring and atomic lifecycle validation")
    validate_special_fields(snap, event.get("at"), check_window)
    if kind == "correction.issued" and event["id"] not in historical_ids:
        validate_best_interest_correction(snap, documents.get(payload.get("replaces"), (None,))[0])


def _validate_history_snow_and_overrides(*, snap, record, kind, override_folder):
    import snow_rules

    snow_item = any((citation_pricing.item_key(item) == snow_rules.ITEM_KEY for item in snap.get("items", [])))
    if snow_item or snow_rules.is_snow(snap) or record["case"].get("caseType") == snow_rules.TYPE:
        if (
            snap.get("caseType") != snow_rules.TYPE
            or snap.get("frozen", {}).get("case", {}).get("caseType") != snow_rules.TYPE
            or record["case"].get("caseType") != snow_rules.TYPE
        ):
            raise ValueError(snow_rules.MIXED_MESSAGE)
        snow_rules.validate_snapshot(snap, require_letter=True)
        if snap.get("frozen", {}).get("body") != snow_rules.cover_html(snap, snap["frozen"]["snowLetter"]):
            raise ValueError("Snow cover wording and amounts must match its frozen seasonal content")
    if snow_rules.is_snow(snap) and kind != "correction.issued":
        current_letter = snow_rules.read_letter(override_folder)
        snow_rules.validate_letter(current_letter)
        if snap.get("frozen", {}).get("snowLetter") != current_letter:
            raise ValueError("Seasonal snow-letter content changed; refresh and review it before issuance")
        if snap.get("frozen", {}).get("body") != snow_rules.cover_html(snap, current_letter):
            raise ValueError("Snow cover wording and amounts must match the recorded pricing date and seasonal content")
    import admin_rules

    for citation in snap.get("cits", {}).values():
        if citation.get("overrideBasis"):
            admin_rules.verify_override(override_folder, snap, citation)


def _validate_history_pricing(*, cross_case_history, documents, snap, original, superseded, voided, payload, record):
    prior = list(cross_case_history) + [
        {"case": d.get("frozen", {}).get("case", record["case"]), "document": d}
        for did, (d, _) in documents.items()
        if did not in superseded and did not in voided and (did != payload.get("replaces")) and (d.get("type") == "citation")
    ]
    citation_pricing.validate_pricing(snap, prior, original)


def _validate_history_authoring(
    *, snap, kind, documents, payload, check_window, record, override_folder, event, cross_case_history, superseded, voided
):
    if snap.get("authoringVersion", 0) >= 4:
        original = documents.get(payload.get("replaces"), (None,))[0] if kind == "correction.issued" else None
        if check_window and snap.get("authoringVersion", 0) >= 9:
            _validate_history_snow_and_overrides(snap=snap, record=record, kind=kind, override_folder=override_folder)
        validate_authoring(snap, event.get("at"), check_window, original)
        if check_window and snap.get("authoringVersion", 0) >= 6 and (snap.get("type") == "citation"):
            _validate_history_pricing(
                cross_case_history=cross_case_history,
                documents=documents,
                snap=snap,
                original=original,
                superseded=superseded,
                voided=voided,
                payload=payload,
                record=record,
            )


def _validate_history_publication(*, record, event, documents, superseded, voided, visits, check_window, historical_ids):
    validate_publication(record, event, documents, superseded, voided, visits, check_window)
    if event["id"] not in historical_ids:
        validate_document_import(event, documents, visits)


def _validate_history_issued(
    *, payload, event, historical_ids, kind, documents, record, override_folder, cross_case_history, superseded, voided, visits
):
    snap, check_window = _validate_history_snapshot(payload=payload, event=event, historical_ids=historical_ids)
    if snap.get("type") in SPECIAL_TYPES:
        _validate_history_special(
            snap=snap, kind=kind, payload=payload, event=event, check_window=check_window, historical_ids=historical_ids, documents=documents
        )
    _validate_history_authoring(
        snap=snap,
        kind=kind,
        documents=documents,
        payload=payload,
        check_window=check_window,
        record=record,
        override_folder=override_folder,
        event=event,
        cross_case_history=cross_case_history,
        superseded=superseded,
        voided=voided,
    )
    if snap["id"] in documents:
        raise ValueError("Two issued records share a document identity")
    if payload.get("lifecycle"):
        _validate_history_publication(
            record=record,
            event=event,
            documents=documents,
            superseded=superseded,
            voided=voided,
            visits=visits,
            check_window=check_window,
            historical_ids=historical_ids,
        )
    if kind == "correction.issued":
        _validate_history_correction(
            payload=payload, documents=documents, superseded=superseded, visits=visits, snap=snap, record=record, event=event
        )
    documents[snap["id"]] = (snap, event["id"])


def _validate_history_visit(*, payload, record, documents, superseded, voided, visits, event, historical_ids):
    if payload.get("lifecycle"):
        validate_visit(
            record, payload.get("reinspection", {}), documents, superseded, voided, visits, event.get("at"), event["id"] not in historical_ids
        )
    visits.append(dict(payload.get("reinspection", {}), _eventId=event["id"]))


def _validate_history_void(*, payload, documents, voided, superseded, visits, event):
    target = payload.get("docId")
    if "expectedHead" in payload:
        if target not in documents or target in voided or target in superseded:
            raise ValueError("Only a current issued document can be withdrawn")
        active_versions = [d for d in documents if d not in superseded]
        if active_versions[-1] != target or any((r.get("sourceDocId") == target for r in visits)):
            raise ValueError("Later work depends on this document; add a record note instead")
        if len(str(payload.get("reason", "")).strip()) < 10 or not event.get("by"):
            raise ValueError("Withdrawal needs a reason and identified inspector")
    if documents.get(target, ({},))[0].get("type") in SPECIAL_TYPES and len(str(payload.get("externalReference", "")).strip()) < 10:
        raise ValueError("Withdrawal of a scoped order requires reviewed division instructions / reference")
    voided.add(target)


def _validate_history_service(*, documents, payload, superseded, voided, event, events):
    pair = documents.get(payload.get("docId"))
    if not pair or pair[0].get("type") != "nonSummaryAbatement" or payload.get("docId") in superseded | voided or (not event.get("by")):
        raise ValueError("Service evidence needs an effective non-summary order and identified recorder")
    if (
        payload.get("method") not in ("service", "publication")
        or not calendar_date(payload.get("date"))
        or (not pair[0]["mailed"] <= payload["date"] <= city_day(event["at"]).isoformat())
        or (len(str(payload.get("reference", "")).strip()) < 10)
    ):
        raise ValueError("Record actual service/publication date and supporting evidence; planned service is not completed")
    if payload.get("replacesService") and (
        not any(
            (
                e["id"] == payload["replacesService"] and e["type"] == "document.served" and (e["payload"].get("docId") == payload["docId"])
                for e in events[: events.index(event)]
            )
        )
    ):
        raise ValueError("A service correction must identify its earlier evidence record")
    if payload.get("courtRestriction") and len(str(payload.get("courtReference", "")).strip()) < 10:
        raise ValueError("Record the court restriction reference separately")


def _validate_history_annotation(*, kind, payload, documents, event):
    field = "text" if kind == "document.annotated" else "reference"
    if payload.get("docId") not in documents or len(str(payload.get(field, "")).strip()) < 10 or (not event.get("by")):
        raise ValueError("Record actions need a document, identified inspector and specific explanation")


def _validate_history_event(
    *, kind, payload, event, historical_ids, documents, record, override_folder, cross_case_history, superseded, voided, visits, events
):
    if kind.endswith(".issued"):
        _validate_history_issued(
            payload=payload,
            event=event,
            historical_ids=historical_ids,
            kind=kind,
            documents=documents,
            record=record,
            override_folder=override_folder,
            cross_case_history=cross_case_history,
            superseded=superseded,
            voided=voided,
            visits=visits,
        )
    elif kind == "reinspection.recorded":
        _validate_history_visit(
            payload=payload,
            record=record,
            documents=documents,
            superseded=superseded,
            voided=voided,
            visits=visits,
            event=event,
            historical_ids=historical_ids,
        )
    elif kind == "document.voided":
        _validate_history_void(payload=payload, documents=documents, voided=voided, superseded=superseded, visits=visits, event=event)
    elif kind == "document.served":
        _validate_history_service(documents=documents, payload=payload, superseded=superseded, voided=voided, event=event, events=events)
    elif kind in ("document.annotated", "document.reconciled"):
        _validate_history_annotation(kind=kind, payload=payload, documents=documents, event=event)


def validate_history(record, historical_ids=frozenset(), cross_case_history=(), override_folder=None):
    """Protect links and identity even on import, migration, and an empty share."""
    documents, superseded, voided, visits = ({}, set(), set(), [])
    head = set()
    validate_issuance_groups(record)
    events = sorted(record.get("events", []), key=event_order)
    for event in events:
        payload = event.get("payload", {})
        kind = event["type"]
        if payload.get("lifecycle") and (not isinstance(payload.get("expectedHead"), list) or set(payload["expectedHead"]) != head):
            raise ValueError("This action does not include the complete reviewed case history")
        if record_event(event):
            head.add(event["id"])
        _validate_history_event(
            kind=kind,
            payload=payload,
            event=event,
            historical_ids=historical_ids,
            documents=documents,
            record=record,
            override_folder=override_folder,
            cross_case_history=cross_case_history,
            superseded=superseded,
            voided=voided,
            visits=visits,
            events=events,
        )


def calendar_date(value):
    try:
        return isinstance(value, str) and datetime.date.fromisoformat(value).isoformat() == value
    except (ValueError, TypeError):
        return False


def current_document(documents, superseded, voided):
    active = [pair[0] for key, pair in documents.items() if key not in superseded and key not in voided and pair[0].get("items")]
    primary = [d for d in active if d.get("type") not in SUPPLEMENTAL_TYPES]
    return primary[-1] if primary else active[-1] if active else None


def continuing_items(source, visits):
    rows = copy.deepcopy(source["items"])
    linked = sorted((r for r in visits if r.get("sourceDocId") == source["id"]), key=lambda r: (r.get("date", ""), r.get("_eventId", "")))
    for visit in linked:
        for item in rows:
            result = visit.get("results", {}).get(item["id"], {})
            if result.get("oc") == "corrected":
                item.update(done=True, doneOn=result.get("on") or visit["date"])
    return rows


IMPORT_USED = "This imported inspection has already been used; open the existing case"
# inspectionKind in app_core.js: the imported inspection types. A visit worksheet is opened only from a
# Reinspection or a CA Reinspection; documents may also carry the Initial Inspection they were written from.
IMPORT_TYPES = ("initial", "reinspection", "caReinspection")
VISIT_IMPORT_TYPES = ("reinspection", "caReinspection")


def visit_import_identity(visit):
    """A recorded visit's import key; a legacy visit without one is keyed by its reinspection date and time."""
    return visit.get("importInspection") or dict(type="reinspection", date=visit.get("date"), time=visit.get("time", ""))


def same_import_identity(key, imported):
    """Mirror of sameInspection in case_timeline.js: a missing time on either side matches any time that day."""
    return bool(
        isinstance(key, dict)
        and key
        and key.get("type") == imported.get("type")
        and key.get("date") == imported.get("date")
        and (not key.get("time") or not imported.get("time") or key.get("time") == imported.get("time"))
    )


def validate_document_import(event, documents, visits):
    """R59: a new document may not reuse an imported inspection already recorded in this case.

    Refused when any earlier issued document (including corrected or withdrawn ones, whose evidence is
    retained) or any recorded visit in the case carries the same identity. Not refused: a correction
    (it keeps its original's identity); the visit the document is written from and any other document
    written from that same visit (fromReinspId); the companion in the same initial issuance group.
    Drafts are device-only, so the R53 refresh of an unissued draft never reaches this check.
    """
    snap = event["payload"]["snapshot"]
    imported = snap.get("importInspection")
    if event["type"] == "correction.issued" or not imported:
        return
    if not isinstance(imported, dict) or imported.get("type") not in IMPORT_TYPES or not calendar_date(imported.get("date")):
        raise ValueError("Invalid imported inspection identity")
    linked, group = snap.get("fromReinspId"), snap.get("issuanceGroup")
    for other, other_event in documents.values():
        # Only the named companion citation shares its initial notice's exemption. Arbitrary follow-ups
        # may carry copied metadata, but that must never authorize inspection reuse.
        companion = (
            isinstance(group, dict)
            and group.get("id") == other_event
            and group.get("noticeId") == other.get("id") == snap.get("fromDocId")
            and group.get("citationId") == snap.get("id")
            and snap.get("type") == "citation"
            and other.get("type") == "notice"
            and other.get("issuanceGroup") == group
        )
        if linked and other.get("fromReinspId") == linked or companion:
            continue
        if same_import_identity(other.get("importInspection"), imported):
            raise ValueError(IMPORT_USED)
    if any(same_import_identity(visit_import_identity(r), imported) for r in visits if not linked or r.get("id") != linked):
        raise ValueError(IMPORT_USED)


def _validate_release_visit(*, record, visit, documents, superseded, voided, visits, at, check_date_window):
    source = next((d for d in active_restrictions(documents, superseded, voided) if d["id"] == visit.get("sourceDocId")), None)
    if (
        not source
        or visit.get("caseId") != record["case"]["id"]
        or not calendar_date(visit.get("date"))
        or visit["date"] < source["special"]["effective"]
        or check_date_window
        and visit["date"] > city_day(at).isoformat()
        or not visit.get("inspectorId")
        or len(str(visit.get("inspectionReference", "")).strip()) < 10
        or visit.get("results") != {}
    ):
        raise ValueError("Record the actual verified occupancy-release inspection, not a synthetic violation worksheet")
    if visit.get("scope") != source["special"]["scope"] or visit.get("scope") == "unit" and visit.get("unit") != source["special"].get("unit"):
        raise ValueError("The release inspection must identify the exact restriction scope")
    if any(r.get("id") == visit.get("id") or r.get("inspectionReference") == visit["inspectionReference"] for r in visits):
        raise ValueError("This physical release inspection is already recorded")
    return


def _validated_visit_source(*, visit, documents, superseded, voided, visits):
    source = current_document(documents, superseded, voided)
    if (
        not source
        or source["id"] != visit.get("sourceDocId")
        or source.get("type") == "compliance"
        or all(i.get("withdrawn") for i in source["items"])
    ):
        raise ValueError("An inspection must use the current open case document")
    if any(r.get("id") == visit.get("id") for r in visits):
        raise ValueError("An inspection identity can only be recorded once")
    return source


def _validate_visit_import(*, visit, visits, documents):
    imported = visit.get("importInspection")
    if imported:
        if not isinstance(imported, dict) or imported.get("type") not in VISIT_IMPORT_TYPES or not calendar_date(imported.get("date")):
            raise ValueError("Invalid imported inspection identity")
        prior = [visit_import_identity(r) for r in visits]
        prior.extend(d[0].get("importInspection") for d in documents.values())
        if any(same_import_identity(key, imported) for key in prior):
            raise ValueError(IMPORT_USED)


def _validate_visit_outcomes(*, record, visit, source, visits):
    date = visit.get("date", "")
    initial = source.get("frozen", {}).get("case", {}).get("date", record["case"].get("date", ""))
    earliest = source.get("inspDate", initial)
    if not calendar_date(date) or date < earliest:
        raise ValueError("The inspection date precedes its source inspection")
    results = visit.get("results", {})
    if set(results) != {i["id"] for i in source["items"]}:
        raise ValueError("An inspection must retain an outcome for every source item")
    for item in continuing_items(source, visits):
        result = results[item["id"]]
        if item.get("withdrawn"):
            if result.get("oc") != "withdrawn" or not result.get("carried"):
                raise ValueError("A withdrawn item cannot be counted as newly compliant")
        elif item.get("done"):
            if result.get("oc") != "corrected" or result.get("on") != item.get("doneOn") or not result.get("carried"):
                raise ValueError("Prior compliance must carry forward unchanged")
        elif (
            result.get("oc") not in ("corrected", "none", "progress", "noaccess")
            or not calendar_date(result.get("on"))
            or not initial <= result["on"] <= date
        ):
            raise ValueError("An inspection outcome or result date is invalid")


def validate_visit(record, visit, documents, superseded, voided, visits, at=None, check_date_window=True):
    if visit.get("purpose") == "occupancyRelease":
        return _validate_release_visit(
            record=record,
            visit=visit,
            documents=documents,
            superseded=superseded,
            voided=voided,
            visits=visits,
            at=at,
            check_date_window=check_date_window,
        )
    source = _validated_visit_source(visit=visit, documents=documents, superseded=superseded, voided=voided, visits=visits)
    _validate_visit_import(visit=visit, visits=visits, documents=documents)
    _validate_visit_outcomes(record=record, visit=visit, source=source, visits=visits)


def _validate_publication_identity(*, event, record, check_date_window):
    payload, snap = (event["payload"], event["payload"]["snapshot"])
    kind = snap.get("type")
    if (
        kind not in ("notice", "extension", "reinspectionNotice", "citation", "referral", "referralUpdate", "compliance", *SPECIAL_TYPES)
        or event["type"] != kind + ".issued"
    ):
        raise ValueError("The issued event and document type disagree")
    items = snap["items"]
    if (
        not items
        and kind not in SUPPLEMENTAL_TYPES
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


def _validate_followup_visit(*, visits, source, documents, snap, items, rid):
    visit = next((r for r in visits if r.get("id") == rid), None)
    if (
        not visit
        or visit.get("sourceDocId") != source["id"]
        or any((d[0].get("fromReinspId") == rid and d[0].get("type") not in SUPPLEMENTAL_TYPES for d in documents.values()))
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


def validate_publication(record, event, documents, superseded, voided, visits, check_date_window=True):
    payload, snap, kind, items = _validate_publication_identity(event=event, record=record, check_date_window=check_date_window)
    import snow_rules

    if snap.get("authoringVersion", 0) >= 9 and (snow_rules.is_snow(snap) or record["case"].get("caseType") == "snow-10.28"):
        _validate_snow_publication(snow_rules=snow_rules, snap=snap, documents=documents, superseded=superseded, voided=voided, event=event)
        return
    if kind in ("notice", "extension", "citation") and any(
        (not i.get("done") and (not i.get("withdrawn")) and (not calendar_date(i.get("due")) or i["due"] <= snap["mailed"]) for i in items)
    ):
        raise ValueError("Outstanding items require a future due date")
    if kind in SPECIAL_TYPES:
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
        _validate_followup_visit(visits=visits, source=source, documents=documents, snap=snap, items=items, rid=rid)
    elif kind != "citation" or source.get("type") != "notice":
        raise ValueError("This follow-up needs a recorded inspection")
    _validate_followup_outcomes(kind=kind, items=items, source=source)
    if kind == "citation":
        _validate_new_citation_numbers(items=items, documents=documents, snap=snap)


def _validate_authoring_document(*, snap, check_date_window, at):
    items = snap["items"]
    live = [i for i in items if not i.get("done") and (not i.get("withdrawn"))]
    if snap.get("type") in ("notice", "extension", "citation") and len({i.get("due") for i in live if i.get("due")}) > 3:
        raise ValueError("A notice may have no more than three distinct outstanding due dates")
    if snap.get("type") == "notice" and (not snap.get("revision")):
        keys = [
            i.get("libraryKey") or (json.dumps([i["lib"].get(k) for k in ("c", "g", "o")], separators=(",", ":")) if i.get("lib") else "")
            for i in items
        ]
        keys = [k for k in keys if k]
        if len(keys) != len(set(keys)):
            raise ValueError("An original notice cannot contain duplicate library items")
    if not calendar_date(snap.get("mailed")) or not (snap.get("inspDate") or snap.get("frozen", {}).get("case", {}).get("date", "")) <= snap[
        "mailed"
    ] <= (mailing_max_day(snap.get("type"), at) if check_date_window else "9999-12-31"):
        raise ValueError(mailing_message(snap.get("type")))
    return items


def _validate_citation_court(*, check_date_window, snap):
    if check_date_window and snap.get("authoringVersion", 0) >= 9:
        court = snap.get("frozen", {}).get("court", {})
        if court.get("room") != "RM#203," or court.get("caseNumberLabel") != citation_pricing.policy().get(
            "mc2000CaseNumberLabel", "Building Inspection Case Number"
        ):
            raise ValueError("New citations must use the configured R33 court room and case-number label")


def _citation_amount(value):
    if isinstance(value, bool) or not re.fullmatch("(?:0|[1-9]\\d*)(?:\\.\\d{1,2})?", str(value)):
        raise ValueError("Citation money values must be nonnegative amounts with at most two decimal places")
    return Decimal(str(value))


def _validate_citation_identity(*, item, snap, numbers):
    if item.get("done"):
        raise ValueError("Corrected violations cannot be cited")
    c = snap.get("cits", {}).get(item["id"], {})
    if any((not str(c.get(k, "")).strip() for k in ("num", "ord", "desc", "deptId"))):
        raise ValueError("Complete the citation number, ordinance, description and officer ID")
    if snap.get("authoringVersion", 0) >= 5:
        if not (
            citation_pricing.canonical_ordinance(c["ord"])
            if snap.get("authoringVersion", 0) >= 6
            else re.fullmatch("(?:\\d+\\.\\d+|SPS ?\\d+\\.\\d+)(?:\\([A-Za-z0-9]+\\))*", str(c["ord"]))
        ):
            raise ValueError("Enter one complete citation ordinance, not a list of sections")
        if any((re.search("\\(\\s*\\)", str(c.get(k, ""))) for k in ("desc", "comment", "statute", "deptId"))):
            raise ValueError("Complete the placeholder details in each citation")
    if not re.fullmatch("[A-Za-z0-9-]+", c["num"]):
        raise ValueError("The citation number has invalid characters")
    numbers.append(c["num"])
    return c


def _validate_citation_calendar(*, issued, court, observed, snap, initial, check_date_window, at, c, visit_time):
    if (
        not all((calendar_date(x) for x in (issued, court, observed)))
        or issued != (snap.get("revision", {}).get("actionDate") or snap.get("mailed"))
        or (not initial <= observed <= issued < court)
        or (check_date_window and issued > city_day(at).isoformat())
    ):
        raise ValueError("Citation violation, issue, mailing and court dates are inconsistent")
    if any((not re.fullmatch("(?:[01]\\d|2[0-3]):[0-5]\\d", str(t or "")) for t in (c.get("courtTime"), c.get("violTime") or visit_time))):
        raise ValueError("A citation needs valid court and violation times")
    if (
        snap.get("authoringVersion", 0) >= 6
        and citation_pricing.canonical_ordinance(c["ord"]) == "27.05(2)(s)"
        and re.search("noxious\\s+weeds", c["desc"], re.I)
    ):
        raise ValueError("The stale weeds description cannot be charged under Removal of Debris, 27.05(2)(s)")


def _validate_citation_method(*, c):
    if c.get("reconfirmDeposit") or c.get("depositEditInvalid"):
        raise ValueError("Re-confirm deposit before issuance")
    mode = c.get("depositMode", "schedule")
    if mode not in ("schedule", "base", "total"):
        raise ValueError("Invalid deposit method")
    if mode != "schedule" and len(str(c.get("depositSource", "")).strip()) < 10:
        raise ValueError("A manual deposit requires its approved source or reason")
    return mode


def _retains_citation_deposit(*, original, item, c):
    retained = (original or {}).get("cits", {}).get(item["id"])
    return (
        retained
        and citation_pricing.canonical_ordinance(retained["ord"]) == citation_pricing.canonical_ordinance(c["ord"])
        and all(
            (
                retained.get(k) == c.get(k)
                for k in (
                    "base",
                    "cc",
                    "amount",
                    "depositMode",
                    "tier",
                    "scheduleEntryId",
                    "assessments",
                    "pricedOn",
                    "policyVersionHash",
                    "depositSource",
                    "measurements",
                    "mandatoryAppearance",
                    "overrideBasis",
                )
            )
        )
    )


def _validate_citation_policy(*, observed, issued, snap, c, check_date_window, mode):
    expected_priced_on = observed if citation_pricing.policy().get("pricingDateBasis") == "violation" else issued
    if snap.get("authoringVersion", 0) >= 7 and (
        c.get("pricedOn") != expected_priced_on
        or not calendar_date(c.get("pricedOn"))
        or (not re.fullmatch("[0-9a-f]{64}", str(c.get("policyVersionHash", ""))))
        or (check_date_window and c.get("policyVersionHash") != citation_pricing.policy()["versionHash"])
    ):
        raise ValueError("Citation pricing date and policy version must be recorded and current")
    if snap.get("authoringVersion", 0) >= 6 and mode == "total" and (c.get("assessments") is not None):
        raise ValueError("An approved total must not retain a calculated assessment breakdown")


def _validate_mandatory_citation(*, c, item, issued):
    entry = citation_pricing.resolve(c["ord"], citation_pricing.item_key(item), c.get("scheduleEntryId", ""), at=c.get("pricedOn") or issued)
    if not entry or (entry.get("rule") or {}).get("kind") != "mandatory" or c.get("amount") not in ("", None):
        raise ValueError("Mandatory appearance permits no deposit")


def _validate_cash_citation(*, amount, c, mode, check_date_window, snap, issued, item):
    total = amount(c.get("amount"))
    if total <= 0:
        raise ValueError("A cash deposit must be positive")
    if mode != "total" and (check_date_window or snap.get("authoringVersion", 0) < 6):
        base, costs = (amount(c.get("base")), amount(c.get("cc")))
        if snap.get("authoringVersion", 0) >= 8 and base == 0 and (not citation_pricing.policy().get("allowZeroBaseDeposits", False)):
            raise ValueError("A zero forfeiture needs City Attorney approval")
        if snap.get("authoringVersion", 0) >= 6:
            lines = citation_pricing.assessment_cents(int(base * 100), int(costs * 100), at=c.get("pricedOn") or issued)
            expected = Decimal(lines["total"]) / 100
            if c.get("assessments") is not None and c["assessments"] != lines:
                raise ValueError("The recorded jail/assessment figures do not match the shared policy")
        else:
            expected = Decimal(citation_pricing.assessment_cents(int(base * 100), int(costs * 100), legacy=True)["total"]) / 100
        if (
            not Decimal(15) <= costs <= Decimal(citation_pricing.policy_at(c.get("pricedOn") or issued)["fees"]["ccMaxCents"]) / 100
            or total != expected
        ):
            raise ValueError("The citation deposit does not match its base and assessments")
        if mode == "schedule" and snap.get("authoringVersion", 0) >= 5 and check_date_window:
            current_policy = snap.get("authoringVersion", 0) >= 6
            expected_base = (
                (
                    None
                    if (
                        b := citation_pricing.base_cents(
                            citation_pricing.resolve(
                                c["ord"], citation_pricing.item_key(item), c.get("scheduleEntryId", ""), at=c.get("pricedOn") or issued
                            ),
                            c.get("tier", "1st"),
                            c.get("measurements"),
                        )
                    )
                    is None
                    else Decimal(b) / 100
                )
                if current_policy
                else legacy_scheduled_citation_base(c["ord"], c.get("tier", "1st"))
            )
            expected_costs = Decimal(citation_pricing.court_cents(c.get("pricedOn") or issued)) / 100 if current_policy else Decimal(48)
            if expected_base is None or base != expected_base or costs != expected_costs:
                raise ValueError("Scheduled deposit does not match the selected ordinance and tier; use an approved base or total with its source")


def validate_authoring(snap, at=None, check_date_window=True, original=None):
    """New R4 writes only; historical records retain their original evidence."""
    items = _validate_authoring_document(snap=snap, check_date_window=check_date_window, at=at)
    if snap.get("type") in SPECIAL_TYPES:
        validate_special_fields(snap, at, check_date_window)
    if snap.get("type") != "citation":
        return
    _validate_citation_court(check_date_window=check_date_window, snap=snap)
    amount = _citation_amount
    numbers = []
    initial = snap.get("frozen", {}).get("case", {}).get("date", "")
    inspected = snap.get("inspDate") or initial
    visit_time = snap.get("inspTime") or snap.get("frozen", {}).get("case", {}).get("time", "")
    for item in items:
        if not item.get("cite") or item.get("withdrawn"):
            continue
        c = _validate_citation_identity(item=item, snap=snap, numbers=numbers)
        issued, court = (c.get("issued"), c.get("courtDate"))
        observed = c.get("violDate") or inspected
        _validate_citation_calendar(
            issued=issued,
            court=court,
            observed=observed,
            snap=snap,
            initial=initial,
            check_date_window=check_date_window,
            at=at,
            c=c,
            visit_time=visit_time,
        )
        mode = _validate_citation_method(c=c)
        if _retains_citation_deposit(original=original, item=item, c=c):
            continue
        _validate_citation_policy(observed=observed, issued=issued, snap=snap, c=c, check_date_window=check_date_window, mode=mode)
        if snap.get("authoringVersion", 0) >= 8 and c.get("mandatoryAppearance"):
            _validate_mandatory_citation(c=c, item=item, issued=issued)
            continue
        _validate_cash_citation(amount=amount, c=c, mode=mode, check_date_window=check_date_window, snap=snap, issued=issued, item=item)
    if len(numbers) != len(set(numbers)) or (not numbers and any((not i.get("withdrawn") for i in items))):
        raise ValueError("Select citations with distinct citation numbers")
