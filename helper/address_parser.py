"""Local CRF parsing with USPS mailing abbreviations; raw inputs are retained."""

import json
from runtime_paths import resource
import re

try:
    import usaddress as PARSER
except ImportError:
    PARSER = None
SUFFIX = json.loads(resource("postal_suffixes.json").read_text(encoding="utf-8"))["aliases"]
STATES = {k.upper(): v for k, v in json.loads(resource("postal_states.json").read_text(encoding="utf-8")).items()}
STATES.update({v: v for v in STATES.values()})
DIRECTIONS = {"NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W", "NORTHEAST": "NE", "NORTHWEST": "NW", "SOUTHEAST": "SE", "SOUTHWEST": "SW"}
UNITS = {
    "HANGAR": "HNGR",
    "APARTMENT": "APT",
    "SUITE": "STE",
    "ROOM": "RM",
    "FLOOR": "FL",
    "BUILDING": "BLDG",
    "DEPARTMENT": "DEPT",
    "OFFICE": "OFC",
    "BASEMENT": "BSMT",
    "FRONT": "FRNT",
    "LOBBY": "LBBY",
    "PENTHOUSE": "PH",
    "REAR": "REAR",
    "SPACE": "SPC",
    "TRAILER": "TRLR",
    "LOWER": "LOWR",
    "UPPER": "UPPR",
    "UNIT": "UNIT",
}


def available():
    return PARSER is not None


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").replace(".", "").replace(",", "")).strip().upper()


def owner_key(parts):
    if parts.get("USPSBoxID"):
        return "PO BOX " + clean(parts["USPSBoxID"]) + "|" + str(parts.get("ZipCode", ""))[:5]
    key = " ".join(
        clean(parts.get(k, ""))
        for k in (
            "AddressNumber",
            "AddressNumberSuffix",
            "StreetNamePreDirectional",
            "StreetNamePreType",
            "StreetName",
            "StreetNamePostType",
            "StreetNamePostDirectional",
        )
        if parts.get(k)
    )
    if parts.get("OccupancyIdentifier"):
        key += " UNIT " + clean(parts["OccupancyIdentifier"])
    return key + "|" + str(parts.get("ZipCode", ""))[:5]


def parse_address(raw):
    if not isinstance(raw, str) or not 0 < len(raw) <= 3000:
        raise ValueError("Enter a mailing address of at most 3000 characters")
    result = {
        "raw": raw,
        "parts": {},
        "type": "ambiguous",
        "standardized": [],
        "recipientLine": "",
        "warning": "Review the entered address; it is ambiguous.",
        "ownerKey": "",
        "available": available(),
    }
    if PARSER is None:
        return {**result, "type": "unavailable", "warning": "address parser unavailable"}
    try:
        parts, kind = PARSER.tag(raw)
    except PARSER.RepeatedLabelError:
        return result
    if kind not in ("Street Address", "PO Box"):
        return result
    parts = dict(parts)
    state = STATES.get(clean(parts.get("StateName")))
    zipcode = parts.get("ZipCode", "")
    if not state or not re.fullmatch(r"\d{5}(?:-\d{4})?", zipcode) or not parts.get("PlaceName"):
        return {**result, "parts": parts}
    parts["StateName"] = state
    for key in ("StreetNamePreDirectional", "StreetNamePostDirectional"):
        if key in parts:
            parts[key] = DIRECTIONS.get(clean(parts[key]), clean(parts[key]))
    if "StreetNamePostType" in parts:
        parts["StreetNamePostType"] = SUFFIX.get(clean(parts["StreetNamePostType"]), clean(parts["StreetNamePostType"]))
    if "OccupancyType" in parts:
        parts["OccupancyType"] = UNITS.get(clean(parts["OccupancyType"]), clean(parts["OccupancyType"]))
    if parts.get("OccupancyIdentifier"):
        parts["OccupancyIdentifier"] = clean(parts["OccupancyIdentifier"]).lstrip("#").strip()
    if kind == "PO Box":
        if not parts.get("USPSBoxID"):
            return {**result, "parts": parts}
        street = "PO BOX " + clean(parts["USPSBoxID"])
        type_name = "po-box"
    else:
        if not parts.get("AddressNumber") or not parts.get("StreetName"):
            return {**result, "parts": parts}
        street = " ".join(
            clean(parts.get(k, ""))
            for k in (
                "AddressNumber",
                "AddressNumberSuffix",
                "StreetNamePreDirectional",
                "StreetNamePreType",
                "StreetName",
                "StreetNamePostType",
                "StreetNamePostDirectional",
            )
            if parts.get(k)
        )
        if parts.get("OccupancyIdentifier"):
            street += " " + (parts.get("OccupancyType") or "UNIT") + " " + parts["OccupancyIdentifier"]
        type_name = "street"
    recipient = parts.get("Recipient", "")
    return {
        **result,
        "parts": parts,
        "type": type_name,
        "standardized": [street, clean(parts["PlaceName"]) + ", " + state + " " + zipcode],
        "recipientLine": recipient,
        "warning": "",
        "ownerKey": owner_key(parts),
    }
