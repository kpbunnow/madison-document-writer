"""Build-time readings of the verbatim MGO schedule; never executed by clients."""

import re
from decimal import Decimal

AUTHORIZATION = {
    "by": "Building Inspection Division directive",
    "date": "2026-10-11",
    "basis": "Amount computed from MGO 1.08(3) text, Rev. 28, Update 3 (exported 2026-09-14)",
}


def interpret(entry, version):
    raw = version["rawText"]
    text = " ".join(raw.split())
    o = entry["ordinance"]
    amounts = [int(Decimal(x.replace(",", "")) * 100) for x in re.findall(r"\$([\d,]+(?:\.\d+)?)", text)]
    fields = []
    reason = ""
    if "mandatory appearance" in text.lower():
        rule = {"kind": "mandatory"}
    elif "/inch" in text:
        fields = [{"key": "diameter", "label": "Tree diameter in whole inches", "min": 1, "whole": True}]
        if "offense, or" in text:
            fields.insert(0, {"key": "removed", "label": "Was the tree removed?", "boolean": True})
            rule = {"kind": "tree-alternative", "offenseCents": amounts[0], "perInchCents": amounts[1]}
        elif o == "23.24(3)":
            rule = {"kind": "tree-increment", "initialCents": 25000, "firstInchCents": 3000, "laterInchCents": 15000, "threshold": 3}
        else:
            rule = {"kind": "per-inch", "perInchCents": amounts[0]}
    elif o == "29.40(4)(b)":
        fields = [
            {"key": "area", "label": "Building floor area in square feet", "min": 0},
            {"key": "days", "label": "Days of noncompliance", "min": 0, "whole": True},
        ]
        rule = {
            "kind": "building-duration",
            "areaThreshold": 100000,
            "daysThreshold": 365,
            "largeCents": [300000, 1000000],
            "smallCents": [200000, 800000],
        }
    elif o == "10.185(6)(b)":
        fields = [{"key": "tons", "label": "Tons not recycled", "min": 0}]
        rule = {
            "kind": "bands",
            "field": "tons",
            "bands": [
                {"min": 0, "max": 1, "maxInclusive": False, "cents": 25000},
                {"min": 1, "max": 2, "maxInclusive": True, "cents": 50000},
                {"min": 2, "minExclusive": True, "cents": 100000},
            ],
        }
    elif o == "10.185(6)(a)2.":
        fields = [{"key": "percent", "label": "Recycling percentage shortfall", "min": 0, "max": 100}]
        rule = {
            "kind": "bands",
            "field": "percent",
            "bands": [
                {"min": 1, "max": 10, "maxInclusive": True, "cents": 25000},
                {"min": 10, "minExclusive": True, "max": 20, "maxInclusive": True, "cents": 50000},
                {"min": 20, "minExclusive": True, "max": 100, "maxInclusive": True, "cents": 100000},
            ],
        }
    elif o in ("8.14(2)(c)2.", "8.14(2)(c)3."):
        fields = [{"key": "fee", "label": "Unpaid parking fee in dollars", "min": 0}]
        rule = {
            "kind": "bands",
            "field": "fee",
            "bands": [
                {"min": 0, "max": 20, "maxInclusive": True, "cents": 2500},
                {"min": 20.05, "max": 50, "maxInclusive": True, "cents": 5500},
                {"min": 50.05, "cents": 10500},
            ],
        }
    elif amounts:
        if re.search(r"\b(?:days|size|inches|tons|percent)\b|%", text, re.I) and o != "29.40(3)(b)":
            raise ValueError("Quantity row requires an explicit reading: " + o)
        rule = {"kind": "tiers", "amountsCents": amounts, "lastOpenEnded": True}
        if o == "29.40(3)(b)":
            rule["priorCitationWarningDays"] = 90
    else:
        rule = {"kind": "not-determined"}
        reason = "The schedule text does not state a deposit amount."
    classification = (
        "mandatory appearance"
        if rule["kind"] == "mandatory"
        else "measured"
        if fields
        else "stale"
        if version.get("stale")
        else "verified"
        if version["status"] == "verified"
        else "not-determined"
        if reason
        else "calculated"
    )
    result = {
        **version,
        "rule": rule,
        "measurements": fields,
        "classification": classification,
        "reason": reason,
        "authorization": AUTHORIZATION,
        "status": "not-determined"
        if reason
        else "stale"
        if version.get("stale")
        else "verified"
        if version["status"] == "verified"
        else "calculated",
    }
    if rule["kind"] == "tiers":
        result["tiers"] = [{"ordinal": n, "amountCents": v, "openEnded": n == len(amounts)} for n, v in enumerate(amounts, 1)]
    else:
        result["tiers"] = []
    if version.get("stale"):
        result["notice"] = (
            "1.08(3)(a) lists this number as “"
            + version["description"]
            + "”; the current code at "
            + o
            + " is “"
            + {
                "27.05(2)(s)": "Removal of Debris",
                "29.21": "Board of Building Code, Fire Code, Conveyance Code and Licensing Appeals",
                "30.01(5)": "HVAC Permit Fee Schedule",
            }.get(o, "Different offense")
            + "”. The deposit follows the scheduled number."
        )
    return result
