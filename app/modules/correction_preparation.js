import { inspAt } from "./inspection_facts.js";
import { validISO } from "./calendar.js";
import { recordCorrectionTypeAllowed, isEffective, isHistoryDoc, specialType } from "./document_rules.js";
import { recordDay } from "../assets/shared.js";
import { stableJSON, clone } from "./record_values.js";
import { CASE_CORRECTION_FIELDS, FIELD_NAMES } from "./document_types.js";
import { correctionSource, doc, docCase, docInsp, docsFor, eventsFor, kase, recordHead, reinsp, reinspFor } from "./writer_queries.js";
import { isLLC } from "./mailing_rules.js";
import { workspaceState } from "./workspace_state.js";

/* Correction calculations below are pure over the draft, its source and an explicit `view` of lookups. The factory's
   provider (`correctionLookups`) supplies the live workspace reads; each lookup is still made at the same point,
   in the same order and as lazily as before, so read order, short-circuits and refusal order are unchanged. */

const CORRECTED_ITEM_FIELDS = ["text", "title", "sections", "due", "abate", "note", "withdrawn", "withdrawalReason", "done", "doneOn"];
const CITATION_CHANGE_LABELS = {
  base: "Base deposit",
  amount: "Total deposit",
  cc: "Court costs",
  assessments: "Assessment breakdown",
  overrideBasis: "Approved pricing basis",
};
const SPECIAL_FACT_KEYS = ["mode", "releases", "scope", "unit", "effective", "affected", "deadlineMode", "reviewDate", "expiryDate"];

function compareBestInterestCorrectionFields(d, old, add) {
  add("special.reason", "Reasons for Additional Time", old.special?.reason, d.special?.reason);
  if (d.authoringVersion < 16)
    add("special.noSafety", "Selected items exclude safety, security and urgent obligations", old.special?.noSafety, d.special?.noSafety);
}

function compareVacancyCorrectionFields(d, old, add) {
  add("special.scope", "Scope", old.special?.scope, d.special?.scope);
  add("special.unit", "Apartment / unit identifier", old.special?.unit, d.special?.unit);
  add("special.reviewDate", "Next scheduled review inspection", old.special?.reviewDate, d.special?.reviewDate);
}

function compareSpecialCorrectionFields(d, old, add) {
  if (d.type === "bestInterestExtension" && d.authoringVersion >= 15) compareBestInterestCorrectionFields(d, old, add);
  if (d.type === "vacancyExtension" && d.authoringVersion >= 16) compareVacancyCorrectionFields(d, old, add);
}

function correctionFieldAdder(out) {
  return (path, label, a, b) => {
    if (stableJSON(a) !== stableJSON(b))
      out.push({ path, label, before: a === undefined ? null : clone(a), after: b === undefined ? null : clone(b) });
  };
}

function correctionCitationChanges(d, old, it, add) {
  const a = (old.cits || {})[it.id] || {},
    b = (d.cits || {})[it.id] || {};
  new Set(Object.keys(a).concat(Object.keys(b))).forEach((k) =>
    add("citation." + it.no + "." + k, "Citation for item " + it.no + " · " + (CITATION_CHANGE_LABELS[k] || FIELD_NAMES[k] || k), a[k], b[k]),
  );
}

function correctionItemChanges(d, old, it, add, view) {
  const was = old.items.find((x) => x.id === it.id);
  if (!was) return;
  CORRECTED_ITEM_FIELDS.forEach((k) => add("item." + it.no + "." + k, "Item " + it.no + " · " + FIELD_NAMES[k], was[k], it[k]));
  const visit = view.visitOf(old.fromReinspId),
    res = visit && (visit.results || {})[it.srcItemId];
  if (res && !res.carried) {
    const oc = (d.correction.outcomes || {})[it.id] || res.oc;
    add("visit.item." + it.no + ".outcome", "Visit · item " + it.no + " outcome", res.oc, oc);
  }
  correctionCitationChanges(d, old, it, add);
}

// Every recorded difference between the draft and the document it corrects, in display order.
function correctionChangeList(d, old, view) {
  const out = [],
    add = correctionFieldAdder(out);
  add(
    "actionDate",
    "Original action date used in current reports",
    (old.revision && (old.revision.actionDate || old.revision.originalIssued)) || old.mailed || recordDay(old.issuedAt),
    d.correction.actionDate,
  );
  // An empty list and a missing one are the same recipients: older frozen cases have no emails or ccList key.
  const listValue = (v) => (Array.isArray(v) && !v.length ? undefined : v);
  CASE_CORRECTION_FIELDS.forEach((k) => add("case." + k, FIELD_NAMES[k], listValue(view.caseOf(old)[k]), listValue(view.caseOf(d)[k])));
  ["type", "mailed", "inspDate", "inspTime", "inspectorId"].forEach((k) =>
    add(k, FIELD_NAMES[k], k === "inspectorId" ? view.inspectorOf(old).id : old[k], d[k]),
  );
  compareSpecialCorrectionFields(d, old, add);
  d.items.forEach((it) => correctionItemChanges(d, old, it, add, view));
  return out;
}

function correctionEligibilityFault(d, ownDraft, view) {
  if (!d || d.draft) return "Select an issued document.";
  if (d.superseded) return "This version has already been replaced. Open its current revision.";
  const latest = view.documentsOf(d.caseId).find((x) => !x.draft && !x.superseded);
  if (!latest || latest.id !== d.id)
    return "Later documents depend on this record. Add a record note here, then correct the current document if its contents also need to change.";
  if (view.visitsOf(d.caseId).some((r) => r.sourceDocId === d.id))
    return "An inspection already uses this document. Add a record note here and correct its follow-up. Discard an unfinished worksheet first if it was started in error.";
  const draft = view.documentsOf(d.caseId).find((x) => x.draft && x.id !== ownDraft);
  if (draft) return "Finish or discard the existing document draft before starting a correction.";
  return "";
}

function correctionTypeFits(src, type, historyOnly, view) {
  if (!recordCorrectionTypeAllowed(src, type)) return false;
  if (type === src.type || historyOnly) return true;
  // Not isReferredCase: a correction's own source document does not count as the earlier referral.
  const priorReferral = view.documentsOf(src.caseId).some((x) => isEffective(x) && x.id !== src.id && isHistoryDoc(x));
  return !priorReferral || ["referralUpdate", "compliance"].includes(type);
}

function correctionVisitOutcome(d, old, it, res) {
  return (d.correction.outcomes || {})[it.id] || (it.done ? "corrected" : old.done ? "none" : res.oc);
}

function correctionVisitDate(result, d, r, it, res) {
  if (it.done) result.on = it.doneOn;
  else if (result.oc !== res.oc || (!res.manualDate && (!res.on || res.on === r.date))) result.on = d.inspDate || r.date;
}

// The corrected result for one item, or null when the visit result is unchanged or not correctable.
function correctionVisitResult(d, src, r, it) {
  const old = src.items.find((x) => x.id === it.id),
    key = it.srcItemId,
    res = r.results[key];
  if (!res || res.carried || it.withdrawn || !old) return null;
  const result = clone(res);
  result.oc = correctionVisitOutcome(d, old, it, res);
  correctionVisitDate(result, d, r, it, res);
  if (old.note !== it.note) result.note = it.note || "";
  if (old.due !== it.due) result.due = it.due || "";
  return stableJSON(result) !== stableJSON(res) ? [key, result] : null;
}

function correctionVisitPatchFor(d, view) {
  const src = view.source(d),
    r = src && view.visitOf(src.fromReinspId);
  if (!r) return null;
  const results = {};
  d.items.forEach((it) => {
    const changed = correctionVisitResult(d, src, r, it);
    if (changed) results[changed[0]] = changed[1];
  });
  if (!Object.keys(results).length && d.inspDate === src.inspDate && d.inspTime === src.inspTime) return null;
  return { id: r.id, baseEventId: r.eventId, date: d.inspDate || r.date, time: d.inspTime || "", results };
}

function correctionVisitCheckList(d, view) {
  const src = view.source(d),
    r = src && view.visitOf(src.fromReinspId);
  if (!r) return [];
  const patch = view.visitPatch(d),
    date = d.inspDate || r.date,
    initial = view.caseOf(d).date,
    previous = view.documentOf(r.sourceDocId);
  const results = { ...r.results, ...((patch && patch.results) || {}) };
  return [
    {
      ok: validISO(date) && date >= view.inspectionOf(previous).date && date <= recordDay(view.today()),
      t: "The corrected visit must fall between the source inspection and today",
    },
    {
      ok: Object.values(results).every((x) => x.carried || (validISO(x.on || date) && (x.on || date) >= initial && (x.on || date) <= date)),
      t: "Corrected result dates must not fall after their inspection",
    },
    { ok: d.items.every((i) => !i.done || i.withdrawn || i.doneOn <= date), t: "Compliance must be observed no later than the recorded visit" },
  ];
}

// Facts the checks compare, computed before any check entry and in the original order.
function correctionCheckFacts(d, c, src, view) {
  const issue = view.eligibility(src, d.id),
    sameHead = stableJSON(c.expectedHead) === stableJSON(view.head(d.caseId));
  const sameItems = !!src && stableJSON(src.items.map((i) => [i.id, i.no])) === stableJSON(d.items.map((i) => [i.id, i.no]));
  const substantive = view.changes(d).some((x) => !["mailed", "inspectorId"].includes(x.path));
  const caseConflict = CASE_CORRECTION_FIELDS.some(
    (k) => stableJSON(c.case[k]) !== stableJSON(view.caseOf(src)[k]) && stableJSON(view.liveCase(d.caseId)[k]) !== stableJSON(c.caseBaseline[k]),
  );
  return { issue, sameHead, sameItems, substantive, caseConflict };
}

function correctionRecordChecks(d, c, src, facts, view) {
  return [
    {
      ok: !facts.issue && facts.sameHead,
      t:
        facts.issue ||
        (!facts.sameHead
          ? "The case changed after this correction was started. Keep this draft for reference, open the shared case, then start from its current version."
          : "The correction is based on the current case record"),
    },
    { ok: facts.sameItems, t: "Previously issued item identities, order and numbers must stay unchanged" },
    {
      ok: !specialType(src?.type) || SPECIAL_FACT_KEYS.every((key) => stableJSON(d.special?.[key]) === stableJSON(src.special?.[key])),
      t: "Use a new action to change restriction, release, scope or conditional extension facts",
    },
    {
      ok: !!src && c.case.number === view.caseOf(src).number && view.typeAllowed(src, d.type),
      t: "Case number stays fixed. A different follow-up type must use the same recorded visit and the existing referral path",
    },
  ];
}

function correctionContentChecks(c, facts, view) {
  return [
    { ok: c.reason.trim().length >= 10 && c.reason.trim().length <= 1000, t: "Explain the error and correction (10–1,000 characters)" },
    {
      ok: validISO(c.actionDate) && c.actionDate <= recordDay(view.today()),
      t: "The original action date used in current reports must be a real date no later than today",
    },
    { ok: facts.substantive, t: "Make a content correction; changing only the mailing date or signer is not a correction" },
    { ok: !facts.caseConflict, t: "Case details selected for future documents must not have changed in another working copy" },
  ];
}

function correctionItemChecks(d, c, view) {
  return [
    {
      ok: d.items.every(
        (i) => !i.done || i.withdrawn || (validISO(i.doneOn) && i.doneOn <= recordDay(view.today()) && i.doneOn >= view.caseOf(d).date),
      ),
      t: "Compliance dates must be real dates between the initial inspection and today",
    },
    {
      ok: d.items.every((i) => !i.withdrawn || String(i.withdrawalReason || "").trim().length >= 10),
      t: "Each withdrawn item needs its own reason (at least 10 characters)",
    },
    {
      ok: !(d.type === "citation" || isHistoryDoc(d) || specialType(d.type)) || c.externalReference.trim().length >= 10,
      t: "Record court / City Attorney instructions or the reviewed division amendment reference before issuing this correction",
    },
    {
      ok: !!view.caseFolder() && !!view.caseFolder().helper,
      t: "Start the current local helper and connect the shared case folder before saving a correction",
    },
  ];
}

// Every readiness check for a correction draft, in display order; [] when the draft is not a correction.
function correctionCheckList(d, view) {
  const c = d.correction,
    src = view.source(d);
  if (!c) return [];
  const facts = correctionCheckFacts(d, c, src, view);
  return [
    ...correctionRecordChecks(d, c, src, facts, view),
    ...correctionContentChecks(c, facts, view),
    ...view.visitChecks(d),
    ...correctionItemChecks(d, c, view),
  ];
}

// The retained snapshot before signer/history facts are frozen into it.
function prepareCorrectionSnapshot(d, old) {
  const snap = clone(d);
  ["draft", "correction", "pendingAmendment"].forEach((k) => delete snap[k]);
  snap.status = "Final";
  snap.authoringVersion = Math.max(11, old.authoringVersion || 0);
  delete snap.dueWork;
  delete snap.selectionCache;
  return snap;
}

function finishCorrectionSnapshot(snap, old, c) {
  delete snap.publicationEvents;
  delete snap.expectedHead;
  snap.revision = {
    number: ((old.revision || {}).number || 0) + 1,
    rootId: (old.revision || {}).rootId || old.id,
    targetId: old.id,
    originalIssued: (old.revision || {}).originalIssued || old.mailed || recordDay(old.issuedAt),
    actionDate: c.actionDate,
    reason: c.reason.trim(),
    externalReference: c.externalReference.trim(),
  };
}

function correctionCaseChanges(c, old, view) {
  const caseChanges = {};
  CASE_CORRECTION_FIELDS.forEach((k) => {
    if (stableJSON(c.case[k]) !== stableJSON(view.caseOf(old)[k]))
      caseChanges[k] = { before: c.caseBaseline[k] === undefined ? null : c.caseBaseline[k], after: c.case[k] === undefined ? null : c.case[k] };
  });
  if (caseChanges.ownerAddr)
    caseChanges.ownerAddressParsed = { before: c.caseBaseline.ownerAddressParsed || null, after: c.case.ownerAddressParsed || null };
  return caseChanges;
}

// Existing correction comparisons, checks and retained snapshot preparation; no save confirmation.
export function createCorrectionPreparation(services) {
  // The live reads every correction calculation uses. Bound per call, so later service bindings and the owner's own
  // operations (which tests may replace by name) are always the current ones.
  function correctionLookups() {
    return {
      source: correctionSource,
      caseOf: docCase,
      liveCase: kase,
      inspectorOf: docInsp,
      documentOf: doc,
      documentsOf: docsFor,
      visitOf: reinsp,
      visitsOf: reinspFor,
      head: recordHead,
      inspectionOf: inspAt,
      today: () => services.today,
      caseFolder: () => workspaceState.CASEDIR,
      eligibility: (d, ownDraft) => correctionEligibility(d, ownDraft),
      changes: (d) => correctionChanges(d),
      typeAllowed: (src, type) => correctionTypeAllowed(src, type),
      visitPatch: (d) => correctionVisitPatch(d),
      visitChecks: (d) => correctionVisitChecks(d),
    };
  }

  function correctionChanges(d) {
    const old = correctionSource(d);
    if (!old) return [];
    return correctionChangeList(d, old, correctionLookups());
  }

  function correctionEligibility(d, ownDraft) {
    return correctionEligibilityFault(d, ownDraft, correctionLookups());
  }

  function correctionChecks(d) {
    return correctionCheckList(d, correctionLookups());
  }

  function makeCorrectionAttempt(d) {
    const addressFault = services.validateAndStandardizeAddresses(docCase(d), d.type === "citation" && isLLC(docCase(d)));
    if (addressFault) throw new Error(addressFault.message);
    const c = d.correction,
      old = correctionSource(d),
      at = new Date(Math.max(Date.now(), ...eventsFor(d.caseId).map((e) => Date.parse(e.at) + 1))).toISOString();
    const snap = prepareCorrectionSnapshot(d, old);
    snap.frozen = services.freezeSources(d);
    snap.replaces = old.id;
    if (isHistoryDoc(d) || services.hasItemInspectionHistory(d)) snap.items.forEach((it) => (it.hist = clone(services.documentItemHistory(d, it))));
    finishCorrectionSnapshot(snap, old, c);
    const changes = correctionChanges(d),
      caseChanges = correctionCaseChanges(c, old, correctionLookups());
    return {
      id: services.evid(),
      at,
      by: docInsp(d).id,
      type: "correction.issued",
      payload: {
        docId: d.id,
        snapshot: snap,
        replaces: old.id,
        baseEventId: c.baseEventId,
        reason: c.reason.trim(),
        changes,
        caseChanges,
        visitCorrection: correctionVisitPatch(d),
        expectedHead: c.expectedHead,
        reviewedAt: at,
      },
    };
  }

  function correctionTypeAllowed(src, type, historyOnly = false) {
    return correctionTypeFits(src, type, historyOnly, correctionLookups());
  }

  function correctionVisitPatch(d) {
    return correctionVisitPatchFor(d, correctionLookups());
  }

  function correctionVisitChecks(d) {
    return correctionVisitCheckList(d, correctionLookups());
  }
  return { correctionChanges, correctionEligibility, correctionChecks, makeCorrectionAttempt, correctionTypeAllowed, correctionVisitPatch };
}
