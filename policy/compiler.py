"""Compile a reviewed effective-date parameter tree; no legal defaults are inferred."""

from datetime import date, timedelta
import hashlib
import json
from pathlib import Path
import re
import yaml
from deposit_interpreter import interpret


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _validate_version_source_and_dates(v, label):
    if not v.get("source") or not v["source"].get("codification"):
        raise ValueError("Missing legal source: " + label)
    if v.get("from") is not None:
        date.fromisoformat(v["from"])
    if v.get("to") is not None:
        date.fromisoformat(v["to"])
    if v.get("from") and v.get("to") and v["from"] > v["to"]:
        raise ValueError("Reversed date range: " + label)


def _validate_verified_version(v, label):
    if v.get("status") == "verified":
        if not v.get("review", {}).get("reviewer") or not v.get("review", {}).get("date"):
            raise ValueError("Verified value lacks reviewer: " + label)
        amounts = [int(round(float(x.replace(",", "")) * 100)) for x in re.findall(r"\$([\d,]+(?:\.\d+)?)", v["rawText"])]
        if amounts != [t["amountCents"] for t in v["tiers"]]:
            raise ValueError("Tiers disagree with retained row text: " + label)


def versions(rows, label):
    if not rows or rows[0].get("from") is not None or rows[-1].get("to") is not None:
        raise ValueError("Incomplete retained-baseline date coverage: " + label)
    for n, v in enumerate(rows):
        _validate_version_source_and_dates(v, label)
        if n and (not rows[n - 1].get("to") or (date.fromisoformat(rows[n - 1]["to"]) + timedelta(days=1)).isoformat() != v.get("from")):
            raise ValueError("Overlap or gap in date ranges: " + label)
        _validate_verified_version(v, label)


def unchanged(old, new):
    if isinstance(old, list):
        return isinstance(new, list) and len(new) >= len(old) and all(unchanged(a, b) for a, b in zip(old, new))
    if isinstance(old, dict):
        return isinstance(new, dict) and all(k in new and (k == "to" and v is None or unchanged(v, new[k])) for k, v in old.items())
    return old == new


def _validate_library_provisions(library, grammar):
    for category in library:
        for group in category["groups"]:
            for item in group["items"]:
                key = json.dumps([category["code"], group["code"], item["o"]], separators=(",", ":"))
                for section in item.get("s", []):
                    if section not in item.get("citationManualSections", {}) and not item.get("citationMapping"):
                        raise ValueError("Missing explicit provision review/manual marker: " + key + " " + section)
                    normalized = re.sub(r"\(([^)]+)\)", lambda m: "(" + m[1].lower() + ")", section.replace(" ", ""))
                    if re.search(r"\)\d+$", normalized):
                        normalized += "."
                    if not re.fullmatch(grammar, normalized):
                        raise ValueError("Invalid library ordinance: " + key + " " + section)


def _validate_retained_schedule_entry(entry, grammar):
    if not re.fullmatch(grammar, entry["ordinance"]):
        raise ValueError("Invalid schedule ordinance: " + entry["ordinance"])
    if entry["status"] == "verified":
        raw = [int(round(float(x.replace(",", "")) * 100)) for x in re.findall(r"\$([\d,]+(?:\.\d+)?)", entry["rawText"])]
        if raw != [tier["amountCents"] for tier in entry["tiers"]] or not entry.get("review") or entry["stale"]:
            raise ValueError("Verified schedule data disagrees with source/review: " + entry["id"])


def validate_retained_sources(root):
    root = Path(root)
    grammar = read(root / "policy/sources/citation_policy_source.json")["grammar"]
    library = json.loads((root / "app/assets/library.js").read_text(encoding="utf-8").split("=", 1)[1].rsplit(";", 1)[0])
    _validate_library_provisions(library, grammar)
    entries = json.loads((root / "app/assets/deposits.js").read_text(encoding="utf-8").split("const DEPOSITS=", 1)[1].rsplit(";", 1)[0])
    for entry in entries:
        _validate_retained_schedule_entry(entry, grammar)


def _annotate_building_size_bands(entries):
    for entry in entries:
        if entry["ordinance"] == "29.40(4)(b)":
            for version in entry["versions"]:
                version["sizeBand"] = "small" if "Less than" in version["description"] else "large"


def _apply_snow_policy(p):
    date.fromisoformat("2001-" + p.get("snowSeasonStartMonthDay", "07-01"))
    for entry in p["entries"]:
        if entry["ordinance"] == "10.28":
            entry["window"] = {"kind": "site-season", "startMonthDay": p.get("snowSeasonStartMonthDay", "07-01")}
            entry["divisionReading"] = (
                "Count issued citations at the property during the same snow season, "
                "including a previous owner by default; division letter reading, ordi"
                "nance lookback is silent."
            )
            for version in entry["versions"]:
                version["window"] = dict(entry["window"])


def _validate_legislation_examples(p, folder):
    import citation_pricing as pricing

    previous = pricing.policy
    try:
        pricing.policy = lambda: p
        for path in sorted((folder / "tests").glob("*.yaml")):
            for test in yaml.safe_load(path.read_text(encoding="utf-8")) or []:
                at = str(test["date"])
                entry = pricing.resolve(test["ordinance"], entry_id=test.get("entryId", ""), at=at)
                base = pricing.base_cents(entry, test["tier"])
                total = pricing.assessment_cents(base, pricing.court_cents(at), at=at)["total"] if base is not None else None
                if (base, total) != (test["base"], test["total"]):
                    raise ValueError("Legislation example does not compute: " + str(test))
    finally:
        pricing.policy = previous


def compile_policy(root):
    validate_retained_sources(root)
    folder = Path(root) / "policy"
    p = read(folder / "metadata.json")
    parameters = read(folder / "surcharges.json")
    if p.get("pricingDateBasis") not in ("issue", "violation"):
        raise ValueError("Choose one pricing date basis")
    for name, rows in parameters.items():
        versions(rows, name)
    entries = [entry for path in sorted((folder / "schedule").glob("*.json")) for entry in read(path)]
    ladders = read(folder / "ladders.json")
    if len({e["id"] for e in entries}) != len(entries):
        raise ValueError("Duplicate schedule identity")
    for e in entries + ladders:
        versions(e["versions"], e["id"])
    for relative, old in read(folder / "version-ledger.json").items():
        if not unchanged(old, read(folder / relative)):
            raise ValueError("An old policy version was edited or deleted: " + relative)
    # The directive authorizes deriving rules from every retained source version.
    # Its date is authorization, not a newly invented legal effective date.
    for entry in entries:
        entry["versions"] = [{**interpret(entry, version), "sourceStatus": version["status"]} for version in entry["versions"]]
    from library_ordinances import audit

    p["libraryAudit"] = audit(root)
    _annotate_building_size_bands(entries)
    p.update(parameters=parameters, entries=[{**e["versions"][-1], **e} for e in entries], fallback=[{**e["versions"][-1], **e} for e in ladders])
    _apply_snow_policy(p)
    p["fees"] = {
        "penaltyPercent": parameters["penalty"][-1]["percent"],
        "jailMinimumCents": parameters["jail"][-1]["floorCents"],
        "jailPercent": parameters["jail"][-1]["percent"],
        "crimeLabCents": parameters["crimeLab"][-1]["cents"],
        "courtRates": [{"effectiveDate": v["from"] or "0001-01-01", "cents": v["cents"]} for v in parameters["court"]],
        "ccMinCents": 1500,
        "ccMaxCents": max(4800, *[v["cents"] for v in parameters["court"]]),
    }
    p["versionHash"] = hashlib.sha256(json.dumps(p, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    _validate_legislation_examples(p, folder)
    return p
