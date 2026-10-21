"""Helper validation and cover wording for the division's MGO 10.28 workflow."""

from datetime import date, timedelta
from decimal import Decimal
from runtime_paths import resource

import html
import json
import math
from pathlib import Path
import re
import citation_pricing as pricing

TYPE = "snow-10.28"
ITEM_KEY = '["ENF_PM_PROPMAINT","SNOW",1]'
MIXED_MESSAGE = "Snow removal cases cite only MGO 10.28. Create a separate case for other violations."
WARNING = "There are no warnings given for this Ordinance violation."


def is_snow(snap):
    return snap.get("authoringVersion", 0) >= 9 and (snap.get("caseType") == TYPE or snap.get("frozen", {}).get("case", {}).get("caseType") == TYPE)


def read_letter(folder=None):
    path = Path(folder) / "_administration/snow_letter.json" if folder else None
    return json.loads((path if path and path.is_file() else resource("snow_letter.json")).read_text(encoding="utf-8"))


def validate_letter(letter, review_required=False):
    if (
        not isinstance(letter, dict)
        or letter.get("format") != "madison-snow-letter"
        or not re.fullmatch(r"\d{4}[–-]\d{2}", str(letter.get("season", "")))
    ):
        raise ValueError("Enter the snow-letter season and supported format")
    if review_required or letter.get("reviewedOn"):
        try:
            date.fromisoformat(letter["reviewedOn"])
        except (ValueError, TypeError, KeyError):
            raise ValueError("Enter the seasonal-content review date") from None
    if (
        not isinstance(letter.get("sites"), list)
        or not 1 <= len(letter["sites"]) <= 30
        or any(
            not isinstance(row, list) or len(row) != 2 or any(not isinstance(cell, str) or len(cell) > 500 for cell in row) for row in letter["sites"]
        )
    ):
        raise ValueError("Sand sites need a West Side and East Side column")
    if not re.match(r"^https?://[^\s<>]+$", str(letter.get("webAddress", ""))):
        raise ValueError("Snow letter web address must use http or https")
    if any(not isinstance(letter.get(k), str) or not letter[k].strip() or len(letter[k]) > 2000 for k in ("closing", "westPhone", "eastPhone")):
        raise ValueError("Enter the seasonal contact information")
    return letter


def validate_snapshot(snap, require_letter=False):
    facts = snap.get("snow") or {}
    items = snap.get("items", [])
    if (
        snap.get("type") != "citation"
        or len(items) != 1
        or pricing.item_key(items[0]) != ITEM_KEY
        or items[0].get("sections") != ["10.28"]
        or not items[0].get("cite")
        or items[0].get("withdrawn")
        or items[0].get("done")
    ):
        raise ValueError(MIXED_MESSAGE)
    if (
        "due" not in items[0]
        or items[0]["due"] is not None
        or items[0].get("dueExempt") != TYPE
        or snap.get("fromReinspId")
        or snap.get("fromDocId")
        or snap.get("issuanceGroup")
    ):
        raise ValueError("Snow citations have one exempt item, no notice and no reinspection")
    try:
        fall = date.fromisoformat(facts["snowfallDate"])
        inspected = date.fromisoformat(snap["inspDate"])
    except (KeyError, TypeError, ValueError):
        raise ValueError("Enter the snowfall date and inspection date") from None
    value = facts.get("inches")
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise ValueError("Snowfall inches must be a decimal greater than zero")
    if facts.get("condition") not in ("snow covered", "ice covered", "snow and ice covered"):
        raise ValueError("Choose the observed sidewalk condition")
    if facts.get("photographed") is not True:
        raise ValueError("Confirm the violation was photographed before citation")
    if "cornerNotCleared" in facts and not isinstance(facts["cornerNotCleared"], bool):
        raise ValueError("The corner-lot confirmation must be yes or no")
    clock = str(snap.get("inspTime", ""))
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", clock):
        raise ValueError("Enter the snow inspection time")
    deadline = fall + timedelta(days=1)
    if inspected < deadline or inspected == deadline and clock < "12:00":
        raise ValueError("Under MGO 10.28(1) the owner has until noon on " + deadline.strftime("%m/%d/%Y") + "; inspect at or after that time.")
    citation = snap.get("cits", {}).get(items[0]["id"], {})
    if pricing.canonical_ordinance(citation.get("ord")) != "10.28":
        raise ValueError(MIXED_MESSAGE)
    if require_letter:
        validate_letter(snap.get("frozen", {}).get("snowLetter"))
        if snap.get("snowInspectionId") != snap["inspDate"] + "T" + clock:
            raise ValueError("Snow citation must retain its inspection identity")
        if citation.get("comment") != comment(snap):
            raise ValueError("Snow citation comment must match the recorded snowfall and condition")


def comment(snap):
    facts = snap["snow"]
    amount = Decimal(str(facts["inches"]))
    number = format(amount, "f").rstrip("0").rstrip(".") if "." in format(amount, "f") else format(amount, "f")
    text = (
        "On "
        + date.fromisoformat(facts["snowfallDate"]).strftime("%m/%d/%Y")
        + ", "
        + number
        + (" inch" if amount == 1 else " inches")
        + " of snow fell. Inspection found the public sidewalk "
        + facts["condition"]
        + "."
    )
    return text + (" Snow and ice were not removed from both abutting sidewalks, including the curb ramp." if facts.get("cornerNotCleared") else "")


def totals(snap):
    citation = next(iter(snap.get("cits", {}).values()), {})
    at = citation.get("pricedOn") or snap["mailed"]
    entry = pricing.resolve("10.28", at=at)
    return [
        "$" + format(pricing.assessment_cents(pricing.base_cents(entry, n), pricing.court_cents(at), at=at)["total"] / 100, ",.2f") for n in (1, 2)
    ]


def esc(value):
    return html.escape(str(value), quote=False).replace('"', "&quot;").replace("'", "&#39;")


def cover_html(snap, letter):
    validate_letter(letter)
    first, later = totals(snap)
    paragraphs = [
        "Subject: Failure to Remove Snow and/or Ice from Public Sidewalk",
        (
            "Madison City Ordinance 10.28(1) requires that sidewalks be cleared o"
            "f all snow and ice not later than 12:00 noon of the day after the sn"
            "ow or ice has accumulated on the sidewalk or on a curb ramp that lea"
            "ds to the street."
        ),
        ("When public walks are found in violation, the property owner is issued a Citation with an initial fine of ")
        + first
        + ". All subsequent violations at the property during this snow season will result in a "
        + later
        + (
            " fine. After a City inspector photographs a sidewalk in violation an"
            "d cites the property, the owner has until 7:00 a.m. the following mo"
            "rning to remove the hazard. Failure to do so will cause a snow remov"
            "al contractor to do the work with costs assessed against the propert"
            "y. There are no warnings given for this Ordinance violation. If you "
            "have questions about snow removal Ordinances, please visit our websi"
            "te at "
        )
        + letter["webAddress"]
        + ".",
        (
            "In cases where ice has formed on the public sidewalk and cannot be r"
            "emoved, the property owner must use sand to effectively eliminate da"
            "ngerous conditions. The City provides a mixture of sand and salt for"
            " public use at the locations listed."
        ),
    ]
    if cover_format(snap) < 10:
        rows = "".join("<tr><td>" + esc(a) + "</td><td>" + esc(b) + "</td></tr>" for a, b in letter["sites"])
        return (
            "".join("<p>" + esc(p) + "</p>" for p in paragraphs)
            + ('<table class="snow-sites"><thead><tr><th scope="col">West Side</th><th scope="col">East Side</th></tr></thead><tbody>')
            + rows
            + "</tbody></table><p>"
            + esc(letter["closing"])
            + "</p>"
        )
    # Authoring 10 layout; must stay byte-identical to modules/snow_cases.js body().
    phones = [str(x or "").strip() for x in (letter["westPhone"], letter["eastPhone"])]
    phones = [x for x in phones if x]
    cell = lambda v: "<td><strong>" + esc(v) + "</strong></td>" if any(x in str(v) for x in phones) else "<td>" + esc(v) + "</td>"
    rows = "".join("<tr>" + cell(a) + cell(b) + "</tr>" for a, b in letter["sites"])
    second = esc(paragraphs[2]).replace(esc(WARNING), "<strong>" + esc(WARNING) + "</strong>", 1)
    return (
        '<p class="snow-subject"><strong>'
        + esc(paragraphs[0])
        + '</strong></p><p class="snow-para">'
        + esc(paragraphs[1])
        + '</p><p class="snow-para">'
        + second
        + '</p><p class="snow-para">'
        + esc(paragraphs[3])
        + "</p>"
        + ('<table class="snow-sites snow-sites-v10"><thead><tr><th scope="col">West Side</th><th scope="col">East Side</th></tr></thead><tbody>')
        + rows
        + '</tbody></table><p class="snow-para snow-closing">'
        + esc(letter["closing"])
        + "</p>"
    )


def cover_format(snap):
    recorded = snap.get("frozen", {}).get("snowCoverFormat")
    if recorded in (9, 10) and not isinstance(recorded, bool):
        return recorded
    return 10 if snap.get("authoringVersion", 0) >= 10 and not snap.get("replaces") else 9
