"""Cash-deposit validation phases. The store supplies amount parsing, the pricing owner and the legacy resolver;
this module performs no file operations or persistence and preserves the original policy/read/refusal order."""

from decimal import Decimal
import re


def _validate_zero_base(base, snap, pricing):
    if snap.get("authoringVersion", 0) >= 8 and base == 0 and not pricing.policy().get("allowZeroBaseDeposits", False):
        raise ValueError("A zero forfeiture needs City Attorney approval")


def _assessment_total(base, costs, c, snap, issued, pricing):
    if snap.get("authoringVersion", 0) >= 6:
        lines = pricing.assessment_cents(int(base * 100), int(costs * 100), at=c.get("pricedOn") or issued)
        expected = Decimal(lines["total"]) / 100
        if c.get("assessments") is not None and c["assessments"] != lines:
            raise ValueError("The recorded jail/assessment figures do not match the shared policy")
        return expected
    return Decimal(pricing.assessment_cents(int(base * 100), int(costs * 100), legacy=True)["total"]) / 100


def _validate_total(total, costs, expected, c, issued, pricing):
    if not Decimal(15) <= costs <= Decimal(pricing.policy_at(c.get("pricedOn") or issued)["fees"]["ccMaxCents"]) / 100 or total != expected:
        raise ValueError("The citation deposit does not match its base and assessments")


def _scheduled_base(c, issued, item, pricing):
    value = pricing.base_cents(
        pricing.resolve(c["ord"], pricing.item_key(item), c.get("scheduleEntryId", ""), at=c.get("pricedOn") or issued),
        c.get("tier", "1st"),
        c.get("measurements"),
    )
    return None if value is None else Decimal(value) / 100


def _validate_schedule(base, costs, c, snap, issued, item, pricing, legacy_base):
    current_policy = snap.get("authoringVersion", 0) >= 6
    expected_base = _scheduled_base(c, issued, item, pricing) if current_policy else legacy_base(c["ord"], c.get("tier", "1st"))
    expected_costs = Decimal(pricing.court_cents(c.get("pricedOn") or issued)) / 100 if current_policy else Decimal(48)
    if expected_base is None or base != expected_base or costs != expected_costs:
        raise ValueError("Scheduled deposit does not match the selected ordinance and tier; use an approved base or total with its source")


def validate_cash_citation(*, amount, c, mode, check_date_window, snap, issued, item, pricing, legacy_base):
    total = amount(c.get("amount"))
    if total <= 0:
        raise ValueError("A cash deposit must be positive")
    if mode != "total" and (check_date_window or snap.get("authoringVersion", 0) < 6):
        base, costs = amount(c.get("base")), amount(c.get("cc"))
        _validate_zero_base(base, snap, pricing)
        expected = _assessment_total(base, costs, c, snap, issued, pricing)
        _validate_total(total, costs, expected, c, issued, pricing)
        if mode == "schedule" and snap.get("authoringVersion", 0) >= 5 and check_date_window:
            _validate_schedule(base, costs, c, snap, issued, item, pricing, legacy_base)


def _legacy_entry(entries, ordinance):
    match = next((f for f in entries if f["o"] == ordinance), None)
    if match is None:
        children = [f for f in entries if f["o"].startswith(ordinance + "(") and f.get("t")]
        if len(children) == 1:
            match = children[0]
    return match


def _legacy_fallback(entries):
    # Eager transformation preserves refusal order for malformed later entries.
    return [
        {
            "ch": f["ch"] + (["22"] if f["id"] == "ladder-12-month" else []),
            "sec": f["sec"],
            "t": [{"a": t["amountCents"] / 100, "l": ("1st" if t["ordinal"] == 1 else "2nd" if t["ordinal"] == 2 else "3rd+")} for t in f["tiers"]],
        }
        for f in entries
    ]


def _legacy_conflict(match, amounts, tiers):
    return "1st" in match.get("r", "") and "2nd" in match.get("r", "") and amounts != [Decimal(str(t["a"])) for t in tiers]


def legacy_scheduled_base(policy, ordinance, tier):
    match = _legacy_entry(policy["legacyEntries"], ordinance)
    if match:
        amounts = [Decimal(m.replace(",", "")) for m in re.findall(r"\$([\d,]+(?:\.\d+)?)", match.get("r", ""))]
        tiers = match.get("t", [])
        if _legacy_conflict(match, amounts, tiers):
            return None
    else:
        section = re.match(r"^(\d+)\.(\d+)", ordinance)
        match = next((f for f in _legacy_fallback(policy["fallback"]) if section and (section[1] in f["ch"] or section[0] in f["sec"])), None)
        tiers = match.get("t", []) if match else []
    pick = next((t for t in tiers if t["l"] == tier), tiers[-1] if tiers else None)
    return Decimal(str(pick["a"])) if pick else None
