/* Browser interpretation of the exact generated policy also read by Python. */
import { CITATION_POLICY as P } from "./data/citation_policy.js";
export const CITATION_POLICY = P;
export function canonicalOrdinance(value) {
  let t = String(value || "")
    .trim()
    .replace(new RegExp(P.prefix, "i"), "")
    .replace(/\s+/g, "")
    .replace(/^sps/i, "SPS")
    .replace(/\(([^)]+)\)/g, (_, x) => "(" + x.toLowerCase() + ")");
  if (/\)\d+$/.test(t)) t += ".";
  return new RegExp(P.grammar).test(t) ? t : "";
}
export const tierLabel = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
export const tierOrdinal = (t) => Math.max(1, parseInt(String(t), 10) || 1);
export function cents(value) {
  const t = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(t)) return null;
  const [whole, fraction = ""] = t.split("."),
    n = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(n) ? n : null;
}
export function courtCents(issued) {
  return policyAt(issued).fees.courtRates.at(-1).cents;
}
export function assessmentCents(base, court, date) {
  const f = (date ? policyAt(date) : P).fees,
    penalty = Math.floor((base * f.penaltyPercent + 50) / 100),
    jail = Math.max(f.jailMinimumCents, Math.floor((base * f.jailPercent + 50) / 100));
  return { base, penalty, jail, crimeLab: f.crimeLabCents, court, total: base + penalty + jail + f.crimeLabCents + court };
}
function compatible(e, via, charge, description) {
  const ready = (!!e.rule && e.rule.kind !== "not-determined") || (e.status === "verified" && !e.stale);
  return {
    ...e,
    o: e.ordinance || charge,
    desc: description || e.description || "",
    raw: e.rawText,
    tiers: ready ? e.tiers.map((t) => ({ a: t.amountCents / 100, l: tierLabel(t.ordinal), ordinal: t.ordinal })) : [],
    resolvedVia: via,
    exact: via === "exact",
    why: ready
      ? (e.notice ? e.notice + " " : "") + "Priced under " + (e.ordinance || "MGO 1.08(3)(b)") + ", " + (e.description || e.rawText)
      : "Manual deposit required: " + (e.stale ? "the scheduled charge is stale." : "this row has no division verification."),
  };
}
function exactOrdinanceSelection(exact, entryId, charge, mapping) {
  const chosen = entryId
    ? exact.find((e) => e.id === entryId)
    : exact.length === 1 || exact.every((e) => e.rule && JSON.stringify(e.rule) === JSON.stringify(exact[0].rule))
      ? exact[0]
      : null;
  return chosen
    ? compatible(chosen, "exact", charge, mapping?.printedDescription)
    : {
        o: charge,
        id: "ambiguous-" + charge,
        desc: "",
        tiers: [],
        raw: "",
        resolvedVia: "none",
        why: "Choose the scheduled offense; this ordinance has multiple rows.",
      };
}

export function resolveOrdinance(value, libraryKey = "", entryId = "", date) {
  const P = date ? policyAt(date) : CITATION_POLICY;
  const charge = canonicalOrdinance(value);
  if (!charge || P.excludedPhantoms.includes(charge) || charge.startsWith("SPS")) return null;
  let exact = P.entries.filter((e) => e.ordinance === charge);
  const mapping = P.itemMappings[libraryKey]?.find((m) => m.chargedOrdinance === charge) || P.chargeMappings[charge];
  if (mapping?.status === "manual-only" && !(date >= "2026-10-11" && exact.length))
    return {
      ...compatible({ tiers: [], status: "manual-only", rawText: mapping.source }, "none", charge, mapping.printedDescription),
      id: "manual-" + charge,
    };
  if (exact.length) return exactOrdinanceSelection(exact, entryId, charge, mapping);
  if (["verified", "calculated"].includes(mapping?.status)) {
    exact = P.entries.filter((e) => e.ordinance === mapping.scheduleOrdinance);
    if (exact.length === 1) return compatible(exact[0], "mapped:" + mapping.scheduleOrdinance, charge, mapping.printedDescription);
  }
  // An enumerated ancestor never authorizes a subdivision by itself.
  if (P.entries.some((e) => charge.startsWith(e.ordinance) && /^[\(\d]/.test(charge.slice(e.ordinance.length)))) return null;
  const children = P.entries.filter((e) => e.ordinance.startsWith(charge + "("));
  if (children.length === 1) return compatible(children[0], "child:" + children[0].ordinance, charge, mapping?.printedDescription);
  const section = /^(\d+)\.(\d+)/.exec(charge),
    fb = P.fallback.find((e) => e.ch.includes(section[1]) || e.sec.includes(section[0]));
  return fb ? compatible({ ...fb, id: fb.id + ":" + charge }, "ladder", charge, mapping?.printedDescription) : null;
}
export function respondentKey(k) {
  const p = k.ownerAddressParsed;
  if (p?.accepted && JSON.stringify(p.acceptedLines) === JSON.stringify(k.ownerAddr)) return p.ownerKey || "";
  const lines = (k.ownerAddr || []).map((x) => String(x || "").trim()).filter(Boolean),
    zip = /(\d{5})(?:-\d{4})?\s*$/.exec(lines.at(-1) || "");
  const street = lines
    .slice(0, -1)
    .reverse()
    .find((x) => /^(\d|P\.?\s*O\.?\s*BOX\b|POBOX\b)/i.test(x));
  if (!zip || !street) return "";
  const normalized = street
    .toUpperCase()
    .replace(/\bP\.?\s*O\.?\s*BOX\b/g, "PO BOX")
    .replace(/\bPOBOX\b/g, "PO BOX")
    .replace(/#\s*/g, " UNIT ")
    .replace(/[^A-Z0-9 \/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => P.streetWords[w] || w)
    .join(" ")
    .replace(/\bUNIT UNIT\b/g, "UNIT");
  return normalized + "|" + zip[1];
}
/* R34: property matching for site and site-season windows; mirrored exactly by citation_pricing.py. */
function normalizedParcel(value) {
  const d = String(value == null ? "" : value).replace(/[\s-]/g, "");
  return /^\d{12}$/.test(d) ? d : "";
}
function propertyKey(address) {
  const t = String(address || "")
    .split(",")[0]
    .toUpperCase()
    .replace(/#\s*/g, " UNIT ")
    .replace(/[^A-Z0-9 \/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/^\d/.test(t)) return "";
  return t
    .split(" ")
    .map((w) => P.streetWords[w] || w)
    .join(" ")
    .replace(/\bUNIT UNIT\b/g, "UNIT");
}
export function sameSite(a, b) {
  const pa = normalizedParcel(a?.parcel),
    pb = normalizedParcel(b?.parcel);
  if (pa && pb) return pa === pb;
  const ka = propertyKey(a?.address),
    kb = propertyKey(b?.address);
  if (ka || kb) return !!ka && ka === kb;
  const ra = String(a?.address || "")
    .trim()
    .toUpperCase();
  return (
    !!ra &&
    ra ===
      String(b?.address || "")
        .trim()
        .toUpperCase()
  );
}
export const siteBasis = (k) => (normalizedParcel(k?.parcel) ? "parcel" : propertyKey(k?.address) ? "address" : "unavailable");
export function withinWindow(date, violationDate, window) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !violationDate || date > violationDate) return false;
  if (typeof window === "string") return true;
  if (window.kind === "site-season") {
    const start = window.startMonthDay || "07-01",
      year = Number(violationDate.slice(0, 4)) - (violationDate.slice(5) < start ? 1 : 0);
    return date >= year + "-" + start;
  }
  const [y, m, d] = violationDate.split("-").map(Number),
    months = window.months || 12 * window.years;
  const target = new Date(Date.UTC(y, m - 1 - months, 1)),
    last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const cutoff = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10);
  return date >= cutoff;
}

// Division choice pending City Attorney: issue date selects the law in force.
export const pricingDateBasis = P.pricingDateBasis || "issue";
export const citationPricingDate = (c, d, inspectionDate = "") =>
  pricingDateBasis === "violation" ? c.violDate || d?.inspDate || d?.frozen?.case?.date || inspectionDate : c.issued || d?.mailed;
export const formatDollarsOnLegacyReprints = false;
const depositNumbers = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function formatDeposit(value) {
  const n = cents(value);
  return n > 0 ? "$" + depositNumbers.format(n / 100) : "";
}
function amountSchedule(o, libraryItem, entryId, date, measurements) {
  let f = null;
  if (o === "29.40(4)(b)" && Number.isFinite(measurements.area)) {
    const selected = policyAt(date).entries.find((e) => e.ordinance === o && e.sizeBand === (measurements.area >= 100000 ? "large" : "small"));
    if (selected) f = resolveOrdinance(o, libraryItem, selected.id, date);
  }
  if (!f) f = o ? resolveOrdinance(o, libraryItem, entryId, date) : null;
  return f;
}

function mandatoryDeposit(f, tier, date) {
  return {
    kind: "priced",
    mandatoryAppearance: true,
    amount: "",
    base: "",
    cc: "",
    assessments: null,
    tier: tierLabel(tierOrdinal(tier)),
    depositSource: f.raw,
    pricedOn: date,
    policyVersionHash: P.versionHash,
  };
}

function scheduledMeasurement(f, tier, measurements, o) {
  const measuredBase = f?.rule ? ruleBase(f, tier, measurements) : null;
  if (f?.rule?.kind === "bands" && Number.isFinite(measurements[f.rule.field]) && measuredBase === null)
    return {
      measuredBase,
      fault: { kind: "needs-basis", reason: "The schedule states no amount for this measured value. Record an approved manual basis." },
    };
  if (f?.measurements?.length && measuredBase === null)
    return { measuredBase, fault: { kind: "needs-measurement", reason: "Enter the measurement required by the schedule.", fields: f.measurements } };
  if (!f?.tiers?.length && measuredBase === null)
    return {
      measuredBase,
      fault: {
        kind: "needs-basis",
        reason:
          f?.why ||
          (!o ? "Choose one complete ordinance." : "No verified fixed deposit for this ordinance. Enter an approved base or total and source."),
      },
    };
  return { measuredBase, fault: null };
}

function amountRowSelection(f, entryId, measurements) {
  return f?.rule?.kind === "building-duration"
    ? {
        scheduleEntryId: f.id,
        rowDescription: f.description,
        ...(entryId && entryId !== f.id
          ? {
              rowSelectionNotice:
                "Floor area of " +
                new Intl.NumberFormat("en-US").format(measurements.area) +
                " sq ft matches the " +
                (f.sizeBand === "large" ? "100,000 sq ft or more" : "less than 100,000 sq ft") +
                " row",
            }
          : {}),
      }
    : {};
}

export function resolveCitationAmount({ ordinance, libraryItem = "", tier = 1, date, entryId = "", measurements = {} }) {
  const o = canonicalOrdinance(ordinance);
  let f;
  try {
    f = amountSchedule(o, libraryItem, entryId, date, measurements);
  } catch (e) {
    return { kind: "needs-basis", reason: "Enter a valid pricing date." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !Number.isFinite(Date.parse(date + "T00:00:00Z")))
    return { kind: "needs-basis", reason: "Enter a valid issue date." };
  if (f?.rule?.kind === "mandatory") return mandatoryDeposit(f, tier, date);
  const { measuredBase, fault } = scheduledMeasurement(f, tier, measurements, o);
  if (fault) return fault;
  const ordinal = tierOrdinal(tier),
    b = measuredBase ?? Math.round(f.tiers[Math.min(ordinal, f.tiers.length) - 1].a * 100),
    cc = courtCents(date),
    v = assessmentCents(b, cc, date);
  const row = amountRowSelection(f, entryId, measurements);
  return {
    ...row,
    kind: "priced",
    mandatoryAppearance: false,
    measurements,
    base: b / 100,
    cc: cc / 100,
    amount: (v.total / 100).toFixed(2),
    assessments: v,
    tier: tierLabel(ordinal),
    resolvedVia: f.resolvedVia,
    pricedEntryId: f.id,
    depositSource: f.raw || f.why,
    pricedOn: date,
    policyVersionHash: P.versionHash,
  };
}

const datedPolicyCache = new Map();
export function policyAt(date) {
  if (datedPolicyCache.has(date)) return datedPolicyCache.get(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date)
    throw new Error("Enter a valid pricing date.");
  const pick = (rows) => {
    const v = rows.find((v) => (!v.from || v.from <= date) && (!v.to || date <= v.to));
    if (!v) throw new Error("No reviewed policy for this date.");
    return v;
  };
  if (!P.parameters) return P;
  const values = Object.fromEntries(Object.entries(P.parameters).map(([k, v]) => [k, pick(v)]));
  let entries, fallback;
  const result = {
    ...P,
    fees: {
      ...P.fees,
      penaltyPercent: values.penalty.percent,
      jailMinimumCents: values.jail.floorCents,
      jailPercent: values.jail.percent,
      crimeLabCents: values.crimeLab.cents,
      courtRates: [{ effectiveDate: values.court.from || "0001-01-01", cents: values.court.cents }],
      ccMaxCents: Math.max(4800, values.court.cents),
    },
    get entries() {
      return (entries ??= P.entries.map((e) => ({
        ...e,
        rule: undefined,
        measurements: undefined,
        classification: undefined,
        notice: undefined,
        authorization: undefined,
        ...pick(e.versions),
      })));
    },
    get fallback() {
      return (fallback ??= P.fallback.map((e) => ({
        ...e,
        rule: undefined,
        measurements: undefined,
        classification: undefined,
        notice: undefined,
        authorization: undefined,
        ...pick(e.versions),
      })));
    },
  };
  if (datedPolicyCache.size >= 128) datedPolicyCache.delete(datedPolicyCache.keys().next().value);
  datedPolicyCache.set(date, result);
  return result;
}

function ruleMeasurementsValid(entry, r, m) {
  for (const f of entry.measurements || []) {
    if (r.kind === "tree-alternative" && f.key === "diameter" && m.removed === false) continue;
    const v = m[f.key];
    if (f.boolean) {
      if (typeof v !== "boolean") return false;
    } else if (typeof v !== "number" || !Number.isFinite(v) || v < (f.min ?? 0) || v > (f.max ?? Infinity) || (f.whole && !Number.isInteger(v)))
      return false;
  }
  return true;
}

function ruleBase(entry, tier, measurements = {}) {
  const r = entry.rule,
    m = measurements;
  if (!r) return null;
  if (r.kind === "tiers") return r.amountsCents[Math.min(tierOrdinal(tier), r.amountsCents.length) - 1];
  if (!ruleMeasurementsValid(entry, r, m)) return null;
  if (r.kind === "per-inch") return m.diameter * r.perInchCents;
  if (r.kind === "tree-alternative") return m.removed ? m.diameter * r.perInchCents : r.offenseCents;
  if (r.kind === "tree-increment")
    return r.initialCents + Math.min(m.diameter, r.threshold) * r.firstInchCents + Math.max(0, m.diameter - r.threshold) * r.laterInchCents;
  if (r.kind === "building-duration") return r[m.area >= r.areaThreshold ? "largeCents" : "smallCents"][m.days >= r.daysThreshold ? 1 : 0];
  if (r.kind === "bands") {
    const n = m[r.field];
    return (
      r.bands.find((b) => (b.minExclusive ? n > b.min : n >= b.min) && (b.max == null || (b.maxInclusive ? n <= b.max : n < b.max)))?.cents ?? null
    );
  }
  return null;
}
