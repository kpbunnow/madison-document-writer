import { normParcel as dep_normParcel } from "../assets/shared.js";
import { inspAt as dep_inspAt, lookupForf as dep_lookupForf, toast as dep_toast } from "./court_and_deposits.js";
import { renderKeep as dep_renderKeep } from "./inspection_import.js";
import {
  citationPricingDate as dep_citationPricingDate,
  correctionSource as dep_correctionSource,
  daysBetween as dep_daysBetween,
  doc as dep_doc,
  docCase as dep_docCase,
  isLocked as dep_isLocked,
  itemLibraryKey as dep_itemLibraryKey,
  libraryReview as dep_libraryReview,
  snow as dep_snow,
} from "./app_core.js";
import {
  CITATION_POLICY as dep_CITATION_POLICY,
  canonicalOrdinance as dep_canonicalOrdinance,
  cents as dep_cents,
  resolveCitationAmount as dep_resolveCitationAmount,
  respondentKey as dep_respondentKey,
  sameSite as dep_sameSite,
  siteBasis as dep_siteBasis,
  tierLabel as dep_tierLabel,
  tierOrdinal as dep_tierOrdinal,
  withinWindow as dep_withinWindow,
} from "./citation_policy.js";
import { WriterState } from "./state.js";
import { authFetch } from "./helper_transport.js";
/* Mutable drafts only. Frozen documents and pending save identities are untouched. */
export function initCitationPricing() {
  let shared = [],
    busy = null,
    loadedAt = 0,
    localHistorySignature = "";
  const key = (i) => dep_itemLibraryKey(i) || "";
  function priorOffenses({ ordinanceEntry, respondent, violationDate, excludeId = "", staged = [] }) {
    if (!ordinanceEntry) return [];
    const records = shared
        .filter((x) => x.case.number !== respondent.number)
        .concat(
          WriterState.DOCS.filter((d) => !d.draft && !d.void && !d.superseded && d.type === "citation" && d.id !== excludeId).map((d) => ({
            case: dep_docCase(d),
            document: d,
          })),
        ),
      out = [],
      seen = new Set();
    for (const record of records) {
      const k = record.case,
        d = record.document;
      const siteSeason = ordinanceEntry.window?.kind === "site-season",
        differentOwner =
          String(k.owner || "")
            .trim()
            .toUpperCase() !==
          String(respondent.owner || "")
            .trim()
            .toUpperCase();
      if (siteSeason && differentOwner && !dep_CITATION_POLICY.snowCountPriorDifferentOwner) continue;
      if (
        ordinanceEntry.window === "site" || siteSeason
          ? !dep_sameSite(k, respondent)
          : !dep_respondentKey(respondent) || dep_respondentKey(k) !== dep_respondentKey(respondent)
      )
        continue;
      for (const i of d.items || []) {
        if (!i.cite || i.withdrawn) continue;
        const c = d.cits?.[i.id],
          f = c && dep_lookupForf([c.ord], key(i), c.scheduleEntryId, c.pricedOn || c.issued);
        const date = c?.violDate || d.inspDate || k.date;
        if (f?.id !== ordinanceEntry.id || !dep_withinWindow(date, violationDate, f.window) || seen.has(c.num)) continue;
        seen.add(c.num);
        out.push({
          number: c.num,
          date,
          caseNumber: k.number,
          ...(siteSeason ? { differentOwner, inspectionId: (d.inspDate || k.date) + "T" + (d.inspTime || k.time || "") } : {}),
        });
      }
    }
    return out.concat(
      staged
        .filter((s) => s.entryId === ordinanceEntry.id && dep_withinWindow(s.date, violationDate, ordinanceEntry.window))
        .map((s) => ({ number: s.number, date: s.date, caseNumber: respondent.number, prepared: true })),
    );
  }
  function unchangedCorrection(d, i, c) {
    const original = dep_correctionSource(d)?.cits?.[i.id];
    return original &&
      dep_canonicalOrdinance(original.ord) === dep_canonicalOrdinance(c.ord) &&
      !(d.authoringVersion >= 9 && c.overrideBasis && c.overrideBasis.authorizationId !== original.overrideBasis?.authorizationId)
      ? original
      : null;
  }
  function determined(d, i, c) {
    return (
      d?.authoringVersion >= 8 &&
      !c.historicalDeposit &&
      dep_resolveCitationAmount({
        ordinance: c.ord,
        libraryItem: key(i),
        entryId: c.scheduleEntryId,
        tier: c.tier || 1,
        date: c.pricedOn || c.issued,
        measurements: c.measurements || {},
      }).kind === "priced"
    );
  }
  function refresh(d) {
    if (!d || !d.draft || d.pendingAmendment || dep_isLocked(d)) return;
    dep_libraryReview.refresh(d);
    dep_snow.prepare(d);
    const current = JSON.stringify(WriterState.DOCS.filter((x) => !x.draft).map((x) => [x.id, x.void, x.superseded, x.eventId]));
    if (localHistorySignature && current !== localHistorySignature) loadedAt = 0;
    localHistorySignature = current;
    d.authoringVersion = 11;
    for (const [id, request] of Object.entries(d.depositRequests || {})) {
      const item = d.items.find((i) => i.id === id && i.cite && !i.withdrawn);
      if (!item) continue;
      const price = dep_resolveCitationAmount({
        ordinance: request.ord,
        libraryItem: key(item),
        entryId: request.scheduleEntryId,
        tier: request.tier || 1,
        date: dep_citationPricingDate(request, d),
        measurements: request.measurements || {},
      });
      if (price.kind === "priced" && !request.measurementFields?.length) {
        d.cits = d.cits || {};
        d.cits[id] = { ...request, ...price, depositMode: "schedule" };
        delete d.cits[id].kind;
        delete d.cits[id].reason;
        delete d.cits[id].reconfirmDeposit;
        delete d.depositRequests[id];
      } else if (price.kind === "needs-measurement") {
        request.measurementFields = price.fields;
        request.reason = price.reason;
      }
    }
    const respondent = dep_docCase(d),
      staged = [];
    for (const i of d.items.filter((i) => i.cite && !i.withdrawn)) {
      const c = d.cits?.[i.id];
      if (!c || Object.hasOwn(c, "ordEditingFrom")) continue;
      const original = unchangedCorrection(d, i, c);
      if (original) {
        c.historicalDeposit = true;
        continue;
      }
      delete c.historicalDeposit;
      const f = dep_lookupForf([c.ord], key(i), c.scheduleEntryId, dep_citationPricingDate(c, d)),
        date = c.violDate || dep_inspAt(d).date;
      const history = priorOffenses({
        ordinanceEntry: f,
        respondent,
        parcel: dep_normParcel(respondent.parcel) || respondent.address,
        violationDate: date,
        excludeId: d.correction?.targetId || d.id,
        staged,
      });
      c.countedOffenses = history;
      c.computedTier = history.length + 1;
      c.pricingWarning = history.some((x) => x.differentOwner)
        ? "Prior citation at this property was issued to a different owner"
        : f?.rule?.priorCitationWarningDays && history.some((x) => dep_daysBetween(x.date, date) < f.rule.priorCitationWarningDays)
          ? "A prior " + c.ord + " citation for this respondent is under 90 days old."
          : "";
      const siteWindow = f && (f.window === "site" || f.window?.kind === "site-season");
      if (siteWindow && d.authoringVersion >= 10) {
        c.siteMatch = dep_siteBasis(respondent);
        const what = f.window?.kind === "site-season" ? "Prior snow citations" : "Prior citations at this property";
        const note =
          c.siteMatch === "address"
            ? "Matched prior citations by address; no parcel number."
            : c.siteMatch === "unavailable"
              ? what + " could not be checked for this property."
              : "";
        if (note) c.pricingWarning = (c.pricingWarning ? c.pricingWarning + ". " : "") + note;
      } else delete c.siteMatch;
      if (c.depositMode && c.depositMode !== "schedule") {
        const at = dep_citationPricingDate(c, d);
        try {
          if (c.depositMode === "total") delete c.assessments;
          c.pricedOn = at;
          c.policyVersionHash = dep_CITATION_POLICY.versionHash;
        } catch (error) {
          /* The date check identifies incomplete dates. */
        }
      }
      if ((c.depositMode || "schedule") === "schedule") {
        const ordinal = String(c.tierOverrideSource || "").trim().length >= 10 ? dep_tierOrdinal(c.tierOverride) : c.computedTier;
        c.tier = dep_tierLabel(ordinal);

        const priced = dep_resolveCitationAmount({
          ordinance: c.ord,
          libraryItem: key(i),
          entryId: c.scheduleEntryId,
          tier: ordinal,
          date: dep_citationPricingDate(c, d),
          measurements: c.measurements || {},
        });
        if (priced.kind === "priced") {
          Object.assign(c, priced);
          delete c.kind;
          delete c.reconfirmDeposit;
        } else if (priced.kind !== "needs-measurement" && dep_cents(c.amount) > 0) {
          c.reconfirmDeposit = true;
          c.depositReason = priced.reason;
        } else {
          d.depositRequests = d.depositRequests || {};
          d.depositRequests[i.id] = { ...c, reason: priced.reason, measurementFields: priced.fields || [] };
          delete d.cits[i.id];
        }
        if (priced.rowDescription && (!c.descEdited || priced.rowSelectionNotice)) c.desc = priced.rowDescription.toUpperCase().replace(/\.$/, "");
        else if (!c.descEdited)
          c.desc = String(dep_snow.is(d) ? dep_CITATION_POLICY.snowDefaultDescription : i.title || f?.desc || "")
            .toUpperCase()
            .replace(/\.$/, "");
      }
      if (f && c.ord) staged.push({ entryId: f.id, date, number: c.num });
    }
  }
  function chargeFault(d, i, c) {
    if (!c.preparedSections) return "";
    const sections = (i.sections || []).map(dep_canonicalOrdinance).filter(Boolean);
    if (sections.includes(dep_canonicalOrdinance(c.ord))) return "";
    return String(c.differentChargeSource || "").trim().length >= 10
      ? ""
      : "Choose a charge from the item’s current sections, or confirm a different charge with its approved source.";
  }
  async function loadShared(d, force = false) {
    if (!d || d.pendingAmendment || !WriterState.HELPER?.ok || !WriterState.CASEDIR?.helper) return true;
    refresh(d);
    if (!force && Date.now() - loadedAt < 15000) {
      refresh(d);
      return true;
    }
    if (!busy)
      busy = (async () => {
        try {
          const response = await authFetch("/citations/history", { cache: "no-store" }),
            data = await response.json();
          if (!response.ok || !data.ok || !Array.isArray(data.history)) throw new Error(data.error || "Citation history unavailable");
          shared = data.history;
          loadedAt = Date.now();
          return true;
        } catch (e) {
          return false;
        } finally {
          busy = null;
        }
      })();
    const before = signature(d),
      ok = await busy;
    if (ok) {
      refresh(d);
      if (before !== signature(d)) dep_toast("Citation history changed. Review the updated offense tiers and deposits before issuance.");
    }
    return ok;
  }
  function ensureShared(d) {
    if (!WriterState.HELPER?.ok || !WriterState.CASEDIR?.helper || Date.now() - loadedAt < 15000 || busy) return;
    const old = loadedAt;
    void loadShared(d).then((ok) => {
      if (ok && loadedAt !== old && WriterState.state.docId === d.id && d.draft && !d.pendingAmendment) dep_renderKeep();
    });
  }
  const signature = (d) => JSON.stringify(Object.entries(d.cits || {}).map(([id, c]) => [id, c.tier, c.base, c.cc, c.amount, c.countedOffenses]));
  const historyFault = (d) =>
    WriterState.HELPER?.ok &&
    WriterState.CASEDIR?.helper &&
    !loadedAt &&
    d?.items.some((i) => i.cite && (d.cits?.[i.id]?.depositMode || "schedule") === "schedule")
      ? "Shared citation history must finish checking. Use Refresh citation history; reconnect if it is unavailable."
      : "";
  function hint(d, i, c) {
    const f = dep_lookupForf([c.ord], key(i), c.scheduleEntryId, dep_citationPricingDate(c, d)),
      history = (c.countedOffenses || [])
        .map((x) => x.number + " (" + x.date + ", " + x.caseNumber + (x.prepared ? ", prepared in this issuance" : "") + ")")
        .join("; ");
    return (
      (i.citationReviewNotice ? i.citationReviewNotice + ". " : "") +
      (c.rowSelectionNotice ? c.rowSelectionNotice + ". " : "") +
      (c.pricingWarning ? c.pricingWarning + " " : "") +
      (c.historicalDeposit
        ? "Retained original citation deposit."
        : f
          ? f.why + " [" + f.resolvedVia + "]. " + f.raw
          : "No matching verified schedule. Choose an approved base or total and record its source.") +
      " Computed tier: " +
      (c.tier || "1st") +
      ". Counted citations: " +
      (history || "none") +
      "."
    );
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest?.("[data-refresh-citation-history]")) return;
    const d = dep_doc(WriterState.state.docId);
    if (!d || !d.draft || d.pendingAmendment) return;
    void loadShared(d, true).then((ok) => {
      if (WriterState.state.docId !== d.id) return;
      if (!ok) dep_toast("Shared citation history is unavailable. Reconnect and try Refresh citation history.");
      dep_renderKeep();
    });
  });
  return { refresh, determined, priorOffenses, chargeFault, loadShared, ensureShared, signature, historyFault, hint, unchangedCorrection };
}
