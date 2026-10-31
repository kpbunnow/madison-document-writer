from administrative_basis import validate_basis as shared_validate_basis

"""Independent helper interpreter of the generated, shared citation policy."""
from runtime_paths import resource

import calendar
from datetime import date
from functools import lru_cache
import json
import re


@lru_cache(maxsize=1)
def policy():
    return json.loads(resource("citation_policy.json").read_text(encoding="utf-8"))


def canonical_ordinance(value):
    p = policy()
    text = re.sub(p["prefix"], "", str(value or "").strip(), flags=re.I)
    text = re.sub(r"\s+", "", text)
    text = re.sub("^sps", "SPS", text, flags=re.I)
    text = re.sub(r"\(([^)]+)\)", lambda m: "(" + m[1].lower() + ")", text)
    if re.search(r"\)\d+$", text):
        text += "."
    return text if re.fullmatch(p["grammar"], text) else ""


def item_key(item):
    if item.get("libraryKey"):
        return item["libraryKey"]
    lib = item.get("lib")
    return json.dumps([lib.get(k) for k in ("c", "g", "o")], separators=(",", ":")) if lib else ""


def resolve(ordinance, library_key="", entry_id="", at=None):
    p, charge = policy_at(at) if at else policy(), canonical_ordinance(ordinance)
    if not charge or charge in p["excludedPhantoms"] or charge.startswith("SPS"):
        return None
    exact = [e for e in p["entries"] if e["ordinance"] == charge]
    mapping = next((m for m in p["itemMappings"].get(library_key, []) if m["chargedOrdinance"] == charge), None) or p["chargeMappings"].get(charge)
    if mapping and mapping["status"] == "manual-only" and not (at and at >= "2026-10-11" and exact):
        return None
    if exact:
        return (
            next((e for e in exact if e["id"] == entry_id), None)
            if entry_id
            else exact[0]
            if len(exact) == 1 or all(e.get("rule") == exact[0].get("rule") and e.get("rule") for e in exact)
            else None
        )
    if mapping and mapping["status"] in ("verified", "calculated"):
        mapped = [e for e in p["entries"] if e["ordinance"] == mapping["scheduleOrdinance"]]
        if len(mapped) == 1:
            return mapped[0]
    if any(charge.startswith(e["ordinance"]) and re.match(r"[\(\d]", charge[len(e["ordinance"]) :]) for e in p["entries"]):
        return None
    children = [e for e in p["entries"] if e["ordinance"].startswith(charge + "(")]
    if len(children) == 1:
        return children[0]
    section = re.match(r"(\d+)\.(\d+)", charge)
    fallback = next((e for e in p["fallback"] if section[1] in e["ch"] or section[0] in e["sec"]), None)
    return dict(fallback, id=fallback["id"] + ":" + charge) if fallback else None


def ready(entry):
    return bool(
        entry
        and (
            (entry.get("rule") or {}).get("kind") not in (None, "not-determined")
            or entry["status"] == "verified"
            and not entry.get("stale")
            and entry["tiers"]
        )
    )


def ordinal(tier):
    match = re.match(r"\d+", str(tier or ""))
    return max(1, int(match[0])) if match else 1


def tier_label(n):
    return str(n) + ("st" if n == 1 else "nd" if n == 2 else "rd" if n == 3 else "th")


def _base_measurements_valid(entry, kind, m):
    for f in entry.get("measurements", []):
        if kind == "tree-alternative" and f["key"] == "diameter" and m.get("removed") is False:
            continue
        value = m.get(f["key"])
        if f.get("boolean"):
            if not isinstance(value, bool):
                return False
        elif (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or value < f.get("min", 0)
            or value > f.get("max", float("inf"))
            or f.get("whole")
            and value != int(value)
        ):
            return False
    return True


def _measured_base_cents(kind, rule, m):
    if kind == "per-inch":
        return m["diameter"] * rule["perInchCents"]
    if kind == "tree-alternative":
        return m["diameter"] * rule["perInchCents"] if m["removed"] else rule["offenseCents"]
    if kind == "tree-increment":
        return (
            rule["initialCents"]
            + min(m["diameter"], rule["threshold"]) * rule["firstInchCents"]
            + max(0, m["diameter"] - rule["threshold"]) * rule["laterInchCents"]
        )
    if kind == "building-duration":
        return rule["largeCents" if m["area"] >= rule["areaThreshold"] else "smallCents"][int(m["days"] >= rule["daysThreshold"])]
    if kind == "bands":
        for band in rule["bands"]:
            n = m[rule["field"]]
            if (n > band["min"] if band.get("minExclusive") else n >= band["min"]) and (
                "max" not in band or (n <= band["max"] if band.get("maxInclusive") else n < band["max"])
            ):
                return band["cents"]
    return None


def base_cents(entry, tier, measurements=None):
    if not ready(entry):
        return None
    rule = entry.get("rule")
    m = measurements or {}
    if not rule:
        return entry["tiers"][min(ordinal(tier), len(entry["tiers"])) - 1]["amountCents"]
    kind = rule["kind"]
    if kind == "tiers":
        return rule["amountsCents"][min(ordinal(tier), len(rule["amountsCents"])) - 1]
    if kind == "mandatory":
        return None
    if not _base_measurements_valid(entry, kind, m):
        return None
    return _measured_base_cents(kind, rule, m)


def court_cents(issued):
    return fees_at(issued)["courtRates"][-1]["cents"]


def assessment_cents(base, court, legacy=False, at=None):
    f = fees_at(at) if at else policy()["fees"]
    penalty = (base * f["penaltyPercent"] + 50) // 100
    jail = f["jailMinimumCents"] if legacy else max(f["jailMinimumCents"], (base * f["jailPercent"] + 50) // 100)
    return {
        "base": base,
        "penalty": penalty,
        "jail": jail,
        "crimeLab": f["crimeLabCents"],
        "court": court,
        "total": base + penalty + jail + f["crimeLabCents"] + court,
    }


def respondent_key(case):
    parsed = case.get("ownerAddressParsed", {})
    if parsed.get("accepted") and parsed.get("acceptedLines") == case.get("ownerAddr"):
        return parsed.get("ownerKey", "")
    lines = [str(x).strip() for x in case.get("ownerAddr", []) if str(x).strip()]
    zipcode = re.search(r"(\d{5})(?:-\d{4})?\s*$", lines[-1] if lines else "")
    street = next((x for x in reversed(lines[:-1]) if re.match(r"^(\d|P\.?\s*O\.?\s*BOX\b|POBOX\b)", x, re.I)), None)
    if not zipcode or not street:
        return ""
    street = re.sub(r"\bP\.?\s*O\.?\s*BOX\b|\bPOBOX\b", "PO BOX", street.upper())
    street = re.sub(r"#\s*", " UNIT ", street)
    street = re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9 /-]", " ", street)).strip()
    street = " ".join(policy()["streetWords"].get(w, w) for w in street.split()).replace("UNIT UNIT", "UNIT")
    return street + "|" + zipcode[1]


def defendant_key(case):
    """The respondent for pricing: the Violator's mailing address when one is set on a non-snow case, otherwise the
    owner's. Mirrors citation_policy.js defendantKey; the case summary keeps the owner key."""
    copies = case.get("ccList") if isinstance(case.get("ccList"), list) else []
    violator = next((c for c in copies if isinstance(c, dict) and c.get("kind") == "Violator"), None)
    if violator is None or case.get("caseType") == "snow-10.28":
        return respondent_key(case)
    parsed = violator.get("addressParsed")
    return respondent_key(
        {"ownerAddr": [violator.get("addr", ""), violator.get("city", "")], "ownerAddressParsed": parsed if isinstance(parsed, dict) else {}}
    )


# R34: property matching for site and site-season windows; mirrors modules/citation_policy.js exactly.
def normalized_parcel(value):
    digits = re.sub(r"[\s-]", "", "" if value is None else str(value))
    return digits if re.fullmatch(r"\d{12}", digits) else ""


def property_key(address):
    text = str(address or "").split(",")[0].upper()
    text = re.sub(r"#\s*", " UNIT ", text)
    text = re.sub(r"[^A-Z0-9 /-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not re.match(r"\d", text):
        return ""
    words = policy().get("streetWords", {})
    return re.sub(r"\bUNIT UNIT\b", "UNIT", " ".join(words.get(w, w) for w in text.split(" ")))


def same_site(a, b):
    pa, pb = normalized_parcel(a.get("parcel")), normalized_parcel(b.get("parcel"))
    if pa and pb:
        return pa == pb
    ka, kb = property_key(a.get("address")), property_key(b.get("address"))
    if ka or kb:
        return bool(ka) and ka == kb
    ra = str(a.get("address") or "").strip().upper()
    return bool(ra) and ra == str(b.get("address") or "").strip().upper()


def site_basis(case):
    return "parcel" if normalized_parcel(case.get("parcel")) else "address" if property_key(case.get("address")) else "unavailable"


def season_start(day, start_month_day="07-01"):
    anchor = date.fromisoformat(day) if isinstance(day, str) else day
    month, day_number = map(int, start_month_day.split("-"))
    year = anchor.year - (1 if (anchor.month, anchor.day) < (month, day_number) else 0)
    return date(year, month, day_number)


def within_window(prior_date, violation_date, window):
    try:
        previous, anchor = date.fromisoformat(prior_date), date.fromisoformat(violation_date)
    except (ValueError, TypeError):
        return False
    if previous > anchor:
        return False
    if isinstance(window, str):
        return True
    if window.get("kind") == "site-season":
        return previous >= season_start(anchor, window.get("startMonthDay", "07-01"))
    months = window.get("months") or 12 * window["years"]
    y, m = divmod(anchor.year * 12 + anchor.month - 1 - months, 12)
    cutoff = date(y, m + 1, min(anchor.day, calendar.monthrange(y, m + 1)[1]))
    return previous >= cutoff


def prior_offenses(entry, respondent, violation_date, history, staged=()):
    out, seen = [], set()
    for record in history:
        case, snap = record["case"], record["document"]
        site_season = isinstance(entry["window"], dict) and entry["window"].get("kind") == "site-season"
        different_owner = str(case.get("owner", "")).strip().upper() != str(respondent.get("owner", "")).strip().upper()
        if site_season and different_owner and not policy().get("snowCountPriorDifferentOwner", True):
            continue
        if entry["window"] == "site" or site_season:
            if not same_site(case, respondent):
                continue
        elif not defendant_key(respondent) or defendant_key(case) != defendant_key(respondent):
            continue
        for item in snap.get("items", []):
            if not item.get("cite") or item.get("withdrawn"):
                continue
            cit = snap.get("cits", {}).get(item["id"], {})
            resolved = resolve(cit.get("ord"), item_key(item), cit.get("scheduleEntryId", ""), at=cit.get("pricedOn") or cit.get("issued"))
            observed = cit.get("violDate") or snap.get("inspDate") or case.get("date")
            if (
                not resolved
                or resolved["id"] != entry["id"]
                or not within_window(observed, violation_date, entry["window"])
                or cit.get("num") in seen
            ):
                continue
            seen.add(cit.get("num"))
            out.append(
                {
                    "number": cit.get("num"),
                    "date": observed,
                    "caseNumber": case.get("number"),
                    **(
                        {
                            "differentOwner": different_owner,
                            "inspectionId": str(snap.get("inspDate") or case.get("date")) + "T" + str(snap.get("inspTime") or case.get("time", "")),
                        }
                        if site_season
                        else {}
                    ),
                }
            )
    return out + [s for s in staged if s["entryId"] == entry["id"] and within_window(s["date"], violation_date, entry["window"])]


def _validate_snow_pricing(*, snap, history, case, original):
    if snap.get("authoringVersion", 0) >= 9 and snap.get("caseType") == "snow-10.28" and original is None:
        identity = str(snap.get("inspDate")) + "T" + str(snap.get("inspTime"))
        for record in history:
            other = record["document"]
            if (
                same_site(record["case"], case)
                and str(other.get("inspDate") or record["case"].get("date")) + "T" + str(other.get("inspTime") or record["case"].get("time", ""))
                == identity
                and any(canonical_ordinance(c.get("ord")) == "10.28" for c in other.get("cits", {}).values())
            ):
                raise ValueError("This snow inspection at the property already has a citation")


def _retains_pricing_basis(*, snap, item, cit, charge, original):
    old = (original or {}).get("cits", {}).get(item["id"])
    unchanged = old and charge == canonical_ordinance(old["ord"])
    if unchanged and all(
        cit.get(k) == old.get(k)
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
    ):
        return True
    if unchanged and not (
        snap.get("authoringVersion", 0) >= 9
        and cit.get("overrideBasis")
        and shared_validate_basis(cit, snap, canonical_ordinance=canonical_ordinance, cents=cents, ordinal=ordinal)
    ):
        raise ValueError("An unchanged charge retains the original citation deposit and pricing basis")
    return False


def _validate_pricing_selection(*, snap, item, cit, charge, case):
    sections = [canonical_ordinance(s) for s in item.get("sections", [])]
    if cit.get("preparedSections") is not None and charge not in sections and len(str(cit.get("differentChargeSource", "")).strip()) < 10:
        raise ValueError("Citation charge differs from the current item; record approved confirmation")
    entry = resolve(charge, item_key(item), cit.get("scheduleEntryId", ""), at=cit.get("pricedOn") or cit.get("issued"))
    if snap.get("authoringVersion", 0) >= 9 and entry and (entry.get("rule") or {}).get("kind") == "building-duration":
        area = (cit.get("measurements") or {}).get("area")
        selected = next(
            (
                e
                for e in policy_at(cit.get("pricedOn") or cit.get("issued"))["entries"]
                if e["ordinance"] == charge and e.get("sizeBand") == ("large" if isinstance(area, (int, float)) and area >= 100000 else "small")
            ),
            None,
        )
        if not selected or cit.get("scheduleEntryId") != selected["id"]:
            raise ValueError("Floor area must select the matching building-size schedule row")
    if (
        snap.get("authoringVersion", 0) >= 10
        and entry
        and (entry.get("window") == "site" or (isinstance(entry.get("window"), dict) and entry["window"].get("kind") == "site-season"))
        and cit.get("siteMatch") != site_basis(case)
    ):
        raise ValueError("Citation must record how prior citations at this property were matched")
    return entry


def _validate_calculated_deposit_mode(*, snap, cit, entry, mode):
    if (
        snap.get("authoringVersion", 0) >= 8
        and mode != "schedule"
        and not (
            snap.get("authoringVersion", 0) >= 9
            and cit.get("overrideBasis")
            and shared_validate_basis(cit, snap, canonical_ordinance=canonical_ordinance, cents=cents, ordinal=ordinal)
        )
        and ready(entry)
        and ((entry.get("rule") or {}).get("kind") == "mandatory" or base_cents(entry, cit.get("tier"), cit.get("measurements")) is not None)
    ):
        raise ValueError("This charge has a calculated deposit. Use Scheduled deposit.")


def _validate_pricing_override_history(*, cit, mode, entry, case, observed, history, staged):
    if cit.get("overrideBasis") and mode != "schedule" and entry:
        counted = prior_offenses(entry, case, observed, history, staged)
        if cit["overrideBasis"].get("approvedTier") != len(counted) + 1:
            raise ValueError("Citation history changed since administrator override; review it again")


def _scheduled_pricing_tier(*, cit, counted):
    expected_tier = len(counted) + 1
    if str(cit.get("tier")) != tier_label(ordinal(cit.get("tier"))):
        raise ValueError("Scheduled offense tier must use the computed ordinal label")
    source = str(cit.get("tierOverrideSource", "")).strip()
    if cit.get("tierOverride") not in (None, "") and len(source) < 10:
        raise ValueError("Approved tier override requires a recorded source")
    if len(source) >= 10:
        if not re.fullmatch(r"[1-9]\d*", str(cit.get("tierOverride", ""))):
            raise ValueError("An approved offense tier must be a positive whole number")
        expected_tier = int(cit["tierOverride"])
    return expected_tier


def _validate_scheduled_deposit(*, entry, cit, case, observed, history, staged):
    if not ready(entry):
        raise ValueError("Stale or unverified charge: use an approved manual deposit with its source")
    if (entry.get("rule") or {}).get("kind") == "mandatory":
        if not cit.get("mandatoryAppearance") or cit.get("amount") not in ("", None):
            raise ValueError("Mandatory appearance permits no deposit")
        return True
    if (
        entry["window"] != "site"
        and not (isinstance(entry["window"], dict) and entry["window"].get("kind") == "site-season")
        and not defendant_key(case)
    ):
        raise ValueError(("Scheduled pricing requires the respondent name and usable mailing address, or an approved manual basis"))
    counted = prior_offenses(entry, case, observed, history, staged)
    expected_tier = _scheduled_pricing_tier(cit=cit, counted=counted)
    from decimal import Decimal

    if ordinal(cit.get("tier")) != expected_tier or int(Decimal(str(cit.get("base"))) * 100) != base_cents(
        entry, expected_tier, cit.get("measurements")
    ):
        raise ValueError("Scheduled deposit expected tier " + tier_label(expected_tier) + "; review counted citations and base")
    return False


def validate_pricing(snap, history, original=None):
    case, staged = snap.get("frozen", {}).get("case", {}), []
    _validate_snow_pricing(snap=snap, history=history, case=case, original=original)
    for item in snap.get("items", []):
        if not item.get("cite") or item.get("withdrawn"):
            continue
        cit = snap["cits"][item["id"]]
        charge = canonical_ordinance(cit["ord"])
        if _retains_pricing_basis(snap=snap, item=item, cit=cit, charge=charge, original=original):
            continue
        entry = _validate_pricing_selection(snap=snap, item=item, cit=cit, charge=charge, case=case)
        observed = cit.get("violDate") or snap.get("inspDate") or case.get("date")
        mode = cit.get("depositMode", "schedule")
        _validate_calculated_deposit_mode(snap=snap, cit=cit, entry=entry, mode=mode)
        _validate_pricing_override_history(cit=cit, mode=mode, entry=entry, case=case, observed=observed, history=history, staged=staged)
        if mode == "schedule":
            if _validate_scheduled_deposit(entry=entry, cit=cit, case=case, observed=observed, history=history, staged=staged):
                continue
        if entry:
            staged.append({"entryId": entry["id"], "number": cit["num"], "date": observed, "caseNumber": case.get("number")})


def cents(value):
    text = str(value)
    if isinstance(value, bool) or not re.fullmatch(r"(?:0|[1-9]\d*)(?:\.\d{1,2})?", text):
        return None
    whole, _, fraction = text.partition(".")
    result = int(whole) * 100 + int(fraction.ljust(2, "0") or "0")
    return result if result <= 9007199254740991 else None


def policy_at(at):
    date.fromisoformat(at)
    p = policy()
    return _policy_at(at, p["versionHash"], id(p))


@lru_cache(maxsize=128)
def _policy_at(at, version_hash, identity):
    p = dict(policy())
    if not p.get("parameters"):
        return p

    def pick(rows):
        return next(v for v in rows if (v.get("from") is None or v["from"] <= at) and (v.get("to") is None or at <= v["to"]))

    p["fees"] = fees_at(at)
    for key in ("entries", "fallback"):
        p[key] = [
            {**e, **{k: None for k in ("rule", "classification", "authorization", "measurements", "notice", "reason")}, **pick(e["versions"])}
            if e.get("versions")
            else e
            for e in p[key]
        ]
    return p


def fees_at(at):
    date.fromisoformat(at)
    p = policy()
    return _fees_at(at, p["versionHash"], id(p))


@lru_cache(maxsize=128)
def _fees_at(at, version_hash, identity):
    p = policy()
    if not p.get("parameters"):
        return p["fees"]

    def pick(rows):
        return next(v for v in rows if (v.get("from") is None or v["from"] <= at) and (v.get("to") is None or at <= v["to"]))

    values = {k: pick(rows) for k, rows in p["parameters"].items()}
    return {
        **p["fees"],
        "penaltyPercent": values["penalty"]["percent"],
        "jailMinimumCents": values["jail"]["floorCents"],
        "jailPercent": values["jail"]["percent"],
        "crimeLabCents": values["crimeLab"]["cents"],
        "courtRates": [{"effectiveDate": values["court"].get("from") or "0001-01-01", "cents": values["court"]["cents"]}],
        "ccMaxCents": max(4800, values["court"]["cents"]),
    }
