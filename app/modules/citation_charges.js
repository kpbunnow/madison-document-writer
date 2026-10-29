import { canonicalOrdinance, cents, assessmentCents, resolveOrdinance, resolveCitationAmount } from "./citation_policy.js";
import { CITFEES } from "./document_types.js";
import { correctionSource } from "./writer_queries.js";
import { clone } from "./record_values.js";
import { itemLibraryKey } from "./document_rules.js";

export function chargeChoices(i) {
  const seen = new Set();
  return (i?.sections || [])
    .map((s) => ({ value: canonicalOrdinance(s) || String(s || "").trim(), label: String(s || "").trim() }))
    .filter((x) => x.value && !seen.has(x.value) && seen.add(x.value));
}

export const choosesCharge = (i) => (i?.sections || []).length > 1;

export const CHARGE_DERIVED = [
  "scheduleEntryId",
  "pricedEntryId",
  "base",
  "cc",
  "amount",
  "assessments",
  "resolvedVia",
  "depositSource",
  "depositReason",
  "differentChargeSource",
  "reconfirmDeposit",
  "depositEditInvalid",
  "depositApproved",
  "measurements",
  "measurementFields",
  "rowDescription",
  "rowSelectionNotice",
  "mandatoryAppearance",
  "pricedOn",
  "policyVersionHash",
  "overrideBasis",
  "tierOverride",
  "tierOverrideSource",
  "historicalDeposit",
  "countedOffenses",
  "computedTier",
  "pricingWarning",
  "siteMatch",
  "chargeStale",
  "reason",
];

const CHARGE_IDENTITY = [
  "scheduleEntryId",
  "pricedEntryId",
  "rowDescription",
  "rowSelectionNotice",
  "measurements",
  "measurementFields",
  "mandatoryAppearance",
  "overrideBasis",
  "tierOverride",
  "tierOverrideSource",
  "depositApproved",
  "depositEditInvalid",
  "historicalDeposit",
  "chargeStale",
  "differentChargeSource",
];

function clearChargeBasis(c, i) {
  // An explicit choice among several sections starts from nothing: every derived and approved value goes.
  const full = choosesCharge(i);
  for (const key of full ? CHARGE_DERIVED : CHARGE_IDENTITY) delete c[key];
  if (full) c.depositMode = "schedule";
  c.autoFilledCharge = false;
}

const chargeValue = (v) => canonicalOrdinance(v) || String(v || "").trim();

export function feeLines(base, cc, date) {
  const b = cents(base) ?? 0,
    c = cc === "" || cc == null ? CITFEES.courtCosts * 100 : (cents(cc) ?? 0),
    v = assessmentCents(b, c, date);
  return {
    cents: v,
    rows: [
      { k: "Base cash deposit", v: v.base / 100, note: "MGO 1.08(3)(a)–(b)" },
      { k: "Penalty assessment", v: v.penalty / 100, note: "Wis. Stat. 757.05" },
      { k: "Jail assessment", v: v.jail / 100, note: "Greater of 1% or $10, Wis. Stat. 302.46(1)" },
      { k: "Crime lab assessment", v: v.crimeLab / 100, note: "Wis. Stat. 165.755" },
      { k: "Court costs", v: v.court / 100, note: "Wis. Stat. 814.65" },
    ],
    total: v.total / 100,
  };
}

export function lookupForf(sections, libraryKey = "", entryId = "", date) {
  if ((sections || []).length !== 1) return null;
  return resolveOrdinance(sections[0], libraryKey, entryId, date);
}

function refreshChangedDepositRequest(services, d, i, c, iid) {
  if (d.depositRequests?.[iid] === c) {
    const price = resolveCitationAmount({
      ordinance: c.ord,
      libraryItem: itemLibraryKey(i),
      entryId: c.scheduleEntryId,
      tier: c.tier || 1,
      date: services.citationPricingDate(c, d),
      measurements: c.measurements || {},
    });
    c.reason = price.reason || "Choose an approved deposit basis.";
    c.measurementFields = price.fields || [];
  }
}

export function createCitationCharges(services) {
  function changeCharge(d, iid, value) {
    const i = (d.items || []).find((x) => x.id === iid),
      c = d.cits?.[iid] || d.depositRequests?.[iid];
    if (!c) return false;
    const ord = chargeValue(value);
    if (ord === chargeValue(c.ord)) {
      c.ord = ord;
      return false;
    }
    c.ord = ord;
    clearChargeBasis(c, i);
    const original = d.correction && correctionSource(d)?.cits?.[iid];
    if (original && chargeValue(original.ord) === ord) {
      // Returning to the unchanged original restores its complete retained basis, including absent fields.
      // Do not run applyDeposit: it resets the method and approvals before refresh recognizes a correction.
      for (const key of [...CHARGE_DERIVED, "depositMode", "tier"]) {
        if (Object.hasOwn(original, key)) c[key] = clone(original[key]);
        else delete c[key];
      }
      d.cits = d.cits || {};
      d.cits[iid] = c;
      delete d.depositRequests?.[iid];
      services.citationPricing.refresh(d);
      return true;
    }
    if (d.cits?.[iid] === c) {
      applyDeposit(d, iid, ord);
      return true;
    }
    services.citationPricing.refresh(d);
    refreshChangedDepositRequest(services, d, i, c, iid);
    return true;
  }

  function applyDeposit(d, iid, ord) {
    const c = (d.cits || {})[iid];
    if (!c) return;
    d.authoringVersion = Math.max(11, d.authoringVersion || 0);
    c.depositMode = "schedule";
    delete c.depositApproved;
    delete c.tierOverrideSource;
    c.ord = canonicalOrdinance(ord) || String(ord || "");
    services.citationPricing.refresh(d);
    const el = services.document.querySelector('[data-cit="' + iid + '|amount"]');
    if (el) el.textContent = c.amount;
    return c.amount;
  }
  return { changeCharge, applyDeposit };
}
