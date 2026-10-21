"""Named, confirmed administrative decisions, with helper-owned audit receipts."""

from datetime import datetime, timezone
import copy
import json
from pathlib import Path
import re
import uuid
import case_integrity as integrity
import citation_pricing as pricing

from administrative_basis import actor, validate_basis as shared_validate_basis


def validate_basis(citation, snap):
    return shared_validate_basis(citation, snap, canonical_ordinance=pricing.canonical_ordinance, cents=pricing.cents, ordinal=pricing.ordinal)


def authorize_override(folder, data):
    from case_store import atomic_write, file_lock

    actor(data)
    if not re.fullmatch(r"[A-Za-z0-9-]{3,80}", str(data.get("caseNumber", ""))) or not re.fullmatch(
        r"[A-Za-z0-9-]+", str(data.get("citationNumber", ""))
    ):
        raise ValueError("Choose a case and its citation number")
    if data.get("measurements") is not None and not isinstance(data["measurements"], dict):
        raise ValueError("Measurements must be an object")
    charge = pricing.canonical_ordinance(data.get("ordinance"))
    at = data.get("pricingDate")
    entry = pricing.resolve(charge, entry_id=data.get("scheduleEntryId", ""), at=at)
    if (
        not pricing.ready(entry)
        or (entry.get("rule") or {}).get("kind") == "mandatory"
        or pricing.base_cents(entry, data.get("tier", 1), data.get("measurements")) is None
    ):
        raise ValueError("Choose a determined money deposit; mandatory appearance permits no deposit")
    amount = pricing.cents(data.get("amount"))
    if amount is None or amount <= 0 or data.get("mode") not in ("base", "total"):
        raise ValueError("Enter a positive approved base or total")
    mode = data["mode"]
    cost = pricing.court_cents(at)
    lines = pricing.assessment_cents(amount, cost, at=at) if mode == "base" else None
    basis = {
        k: copy.deepcopy(data.get(k))
        for k in ("administrator", "reason", "sourceReference", "confirmed", "caseNumber", "citationNumber", "pricingDate")
    }
    basis.update(
        approvedTier=pricing.ordinal(data.get("tier", 1)),
        scheduleEntryId=data.get("scheduleEntryId") or "",
        measurements=copy.deepcopy(data.get("measurements") or {}),
        version=1,
        authorizationId=uuid.uuid4().hex,
        approvedAt=datetime.now(timezone.utc).isoformat(),
        ordinance=charge,
        mode=mode,
        baseCents=amount if mode == "base" else None,
        courtCents=cost if mode == "base" else None,
        totalCents=lines["total"] if lines else amount,
        scheduledBaseCents=pricing.base_cents(entry, data.get("tier", 1), data.get("measurements")),
        policyVersionHash=pricing.policy()["versionHash"],
    )
    basis["authorizationHash"] = integrity.hash_bytes(integrity.canonical(basis))
    target = Path(folder) / "_administration/deposit-overrides"
    target.mkdir(parents=True, exist_ok=True)
    with file_lock(Path(folder), "deposit-override-administration"):
        atomic_write(target / (basis["authorizationId"] + ".json"), json.dumps(basis, ensure_ascii=False, separators=(",", ":")).encode())
    return {
        "ok": True,
        "tier": pricing.tier_label(basis["approvedTier"]),
        "overrideBasis": basis,
        "depositMode": mode,
        "base": amount / 100 if mode == "base" else "",
        "cc": cost / 100 if mode == "base" else "",
        "amount": f"{basis['totalCents'] / 100:.2f}",
        "assessments": lines,
        "depositSource": basis["sourceReference"] + " — " + basis["reason"],
    }


def verify_override(folder, snap, citation):
    validate_basis(citation, snap)
    if folder is None:
        raise ValueError("Administrator override receipt must be verified in the case folder")
    basis = citation["overrideBasis"]
    path = Path(folder) / "_administration/deposit-overrides" / (basis["authorizationId"] + ".json")
    try:
        receipt = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        raise ValueError("Administrator override authorization receipt is missing or damaged") from None
    if receipt != basis:
        raise ValueError("Administrator override receipt does not match this citation")


def update_letter(folder, data):
    from case_store import atomic_write, file_lock
    import snow_rules

    actor(data)
    letter = copy.deepcopy(data.get("letter"))
    snow_rules.validate_letter(letter, review_required=True)
    target = Path(folder) / "_administration"
    target.mkdir(parents=True, exist_ok=True)
    with file_lock(Path(folder), "snow-letter-administration"):
        previous = snow_rules.read_letter(folder)
        audit = {
            "at": datetime.now(timezone.utc).isoformat(),
            "administrator": data["administrator"],
            "reason": data["reason"],
            "sourceReference": data["sourceReference"],
            "before": previous,
            "after": letter,
        }
        history = target / "snow-letter-changes"
        history.mkdir(exist_ok=True)
        atomic_write(history / (uuid.uuid4().hex + ".json"), json.dumps(audit, ensure_ascii=False).encode())
        atomic_write(target / "snow_letter.json", json.dumps(letter, ensure_ascii=False, indent=2).encode())
    return {"ok": True, "letter": letter}
