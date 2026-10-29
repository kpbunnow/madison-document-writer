"""Build-time readings of the verbatim MGO schedule; never executed by clients."""

import re
from decimal import Decimal

AUTHORIZATION = {
    "by": "Building Inspection Division directive",
    "date": "2026-10-11",
    "basis": "Amount computed from MGO 1.08(3) text, Rev. 28, Update 3 (exported 2026-09-14)",
}


STALE_NAMES = {
    "27.05(2)(s)": "Removal of Debris",
    "29.21": "Board of Building Code, Fire Code, Conveyance Code and Licensing Appeals",
    "30.01(5)": "HVAC Permit Fee Schedule",
}


def _tree_rule(o, text, amounts):
    fields = [{"key": "diameter", "label": "Tree diameter in whole inches", "min": 1, "whole": True}]
    if "offense, or" in text:
        fields.insert(0, {"key": "removed", "label": "Was the tree removed?", "boolean": True})
        return fields, {"kind": "tree-alternative", "offenseCents": amounts[0], "perInchCents": amounts[1]}
    if o == "23.24(3)":
        return fields, {"kind": "tree-increment", "initialCents": 25000, "firstInchCents": 3000, "laterInchCents": 15000, "threshold": 3}
    return fields, {"kind": "per-inch", "perInchCents": amounts[0]}


def _building_rule(o, text, amounts):
    fields = [
        {"key": "area", "label": "Building floor area in square feet", "min": 0},
        {"key": "days", "label": "Days of noncompliance", "min": 0, "whole": True},
    ]
    return fields, {
        "kind": "building-duration",
        "areaThreshold": 100000,
        "daysThreshold": 365,
        "largeCents": [300000, 1000000],
        "smallCents": [200000, 800000],
    }


def _tons_rule(o, text, amounts):
    fields = [{"key": "tons", "label": "Tons not recycled", "min": 0}]
    return fields, {
        "kind": "bands",
        "field": "tons",
        "bands": [
            {"min": 0, "max": 1, "maxInclusive": False, "cents": 25000},
            {"min": 1, "max": 2, "maxInclusive": True, "cents": 50000},
            {"min": 2, "minExclusive": True, "cents": 100000},
        ],
    }


def _percent_rule(o, text, amounts):
    fields = [{"key": "percent", "label": "Recycling percentage shortfall", "min": 0, "max": 100}]
    return fields, {
        "kind": "bands",
        "field": "percent",
        "bands": [
            {"min": 1, "max": 10, "maxInclusive": True, "cents": 25000},
            {"min": 10, "minExclusive": True, "max": 20, "maxInclusive": True, "cents": 50000},
            {"min": 20, "minExclusive": True, "max": 100, "maxInclusive": True, "cents": 100000},
        ],
    }


def _parking_rule(o, text, amounts):
    fields = [{"key": "fee", "label": "Unpaid parking fee in dollars", "min": 0}]
    return fields, {
        "kind": "bands",
        "field": "fee",
        "bands": [
            {"min": 0, "max": 20, "maxInclusive": True, "cents": 2500},
            {"min": 20.05, "max": 50, "maxInclusive": True, "cents": 5500},
            {"min": 50.05, "cents": 10500},
        ],
    }


def _tier_rule(o, text, amounts):
    if re.search(r"\b(?:days|size|inches|tons|percent)\b|%", text, re.I) and o != "29.40(3)(b)":
        raise ValueError("Quantity row requires an explicit reading: " + o)
    rule = {"kind": "tiers", "amountsCents": amounts, "lastOpenEnded": True}
    if o == "29.40(3)(b)":
        rule["priorCitationWarningDays"] = 90
    return [], rule


# Readings in priority order: the first whose condition holds decides the rule and its measured fields.
READINGS = [
    (lambda o, text, amounts: "mandatory appearance" in text.lower(), lambda o, text, amounts: ([], {"kind": "mandatory"})),
    (lambda o, text, amounts: "/inch" in text, _tree_rule),
    (lambda o, text, amounts: o == "29.40(4)(b)", _building_rule),
    (lambda o, text, amounts: o == "10.185(6)(b)", _tons_rule),
    (lambda o, text, amounts: o == "10.185(6)(a)2.", _percent_rule),
    (lambda o, text, amounts: o in ("8.14(2)(c)2.", "8.14(2)(c)3."), _parking_rule),
    (lambda o, text, amounts: bool(amounts), _tier_rule),
]


def _read_rule(o, text, amounts):
    for applies, build in READINGS:
        if applies(o, text, amounts):
            fields, rule = build(o, text, amounts)
            return fields, rule, ""
    return [], {"kind": "not-determined"}, "The schedule text does not state a deposit amount."


def _classification(rule, fields, version, reason):
    return (
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


def _status(version, reason):
    return "not-determined" if reason else "stale" if version.get("stale") else "verified" if version["status"] == "verified" else "calculated"


def _stale_notice(o, version):
    return (
        "1.08(3)(a) lists this number as “"
        + version["description"]
        + "”; the current code at "
        + o
        + " is “"
        + STALE_NAMES.get(o, "Different offense")
        + "”. The deposit follows the scheduled number."
    )


def interpret(entry, version):
    raw = version["rawText"]
    text = " ".join(raw.split())
    o = entry["ordinance"]
    amounts = [int(Decimal(x.replace(",", "")) * 100) for x in re.findall(r"\$([\d,]+(?:\.\d+)?)", text)]
    fields, rule, reason = _read_rule(o, text, amounts)
    result = {
        **version,
        "rule": rule,
        "measurements": fields,
        "classification": _classification(rule, fields, version, reason),
        "reason": reason,
        "authorization": AUTHORIZATION,
        "status": _status(version, reason),
    }
    if rule["kind"] == "tiers":
        result["tiers"] = [{"ordinal": n, "amountCents": v, "openEnded": n == len(amounts)} for n, v in enumerate(amounts, 1)]
    else:
        result["tiers"] = []
    if version.get("stale"):
        result["notice"] = _stale_notice(o, version)
    return result
