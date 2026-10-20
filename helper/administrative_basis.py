"""Common receipt validation with explicit pricing primitives; no import cycle."""

import re
import case_integrity as integrity


def actor(data):
    if not isinstance(data, dict):
        raise ValueError("Expected an administrative decision object")
    for key, minimum in [("administrator", 2), ("reason", 20), ("sourceReference", 1)]:
        if not isinstance(data.get(key), str) or not minimum <= len(data[key].strip()) <= 1000:
            raise ValueError("Enter the named administrator, reason of at least 20 characters, and source reference")
    if data.get("confirmed") is not True:
        raise ValueError("Confirm the administrative decision")


def validate_basis(citation, snap, *, canonical_ordinance, cents, ordinal):
    basis = citation.get("overrideBasis")
    actor(basis or {})
    if not isinstance(basis, dict) or basis.get("version") != 1 or not re.fullmatch(r"[0-9a-f]{32}", str(basis.get("authorizationId", ""))):
        raise ValueError("Administrator override needs its helper authorization")
    hashed = {k: v for k, v in basis.items() if k != "authorizationHash"}
    if integrity.hash_bytes(integrity.canonical(hashed)) != basis.get("authorizationHash"):
        raise ValueError("Administrator override authorization changed")
    case = snap.get("frozen", {}).get("case", {})
    if any(
        basis.get(k) != v
        for k, v in [
            ("caseNumber", case.get("number")),
            ("citationNumber", citation.get("num")),
            ("ordinance", canonical_ordinance(citation.get("ord"))),
            ("pricingDate", citation.get("pricedOn") or citation.get("issued")),
            ("mode", citation.get("depositMode")),
            ("totalCents", cents(citation.get("amount"))),
            ("policyVersionHash", citation.get("policyVersionHash")),
        ]
    ):
        raise ValueError("Administrator override no longer matches this citation; authorize it again")
    if (
        basis.get("approvedTier") != ordinal(citation.get("tier"))
        or basis.get("scheduleEntryId", "") != (citation.get("scheduleEntryId") or "")
        or basis.get("measurements", {}) != (citation.get("measurements") or {})
    ):
        raise ValueError("Administrator override pricing facts changed; authorize it again")
    if basis["mode"] == "base" and (basis.get("baseCents") != cents(citation.get("base")) or basis.get("courtCents") != cents(citation.get("cc"))):
        raise ValueError("Administrator override base or assessments changed")
    return True
