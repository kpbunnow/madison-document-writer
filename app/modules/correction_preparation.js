import { inspAt } from "./inspection_facts.js";
import { validISO } from "./calendar.js";
import { recordCorrectionTypeAllowed, isEffective, isHistoryDoc, specialType } from "./document_rules.js";
import { recordDay } from "../assets/shared.js";
import { stableJSON, clone } from "./record_values.js";
import { CASE_CORRECTION_FIELDS, FIELD_NAMES } from "./document_types.js";
import { correctionSource, doc, docCase, docInsp, docsFor, eventsFor, kase, recordHead, reinsp, reinspFor } from "./writer_queries.js";
import { isLLC } from "./mailing_rules.js";
import { workspaceState } from "./workspace_state.js";

// Existing correction comparisons, checks and retained snapshot preparation; no save confirmation.
export function createCorrectionPreparation(services) {
  function correctionChanges(d) {
    const old = correctionSource(d);
    if (!old) return [];
    const out = [],
      add = (path, label, a, b) => {
        if (stableJSON(a) !== stableJSON(b))
          out.push({ path, label, before: a === undefined ? null : clone(a), after: b === undefined ? null : clone(b) });
      };
    add(
      "actionDate",
      "Original action date used in current reports",
      (old.revision && (old.revision.actionDate || old.revision.originalIssued)) || old.mailed || recordDay(old.issuedAt),
      d.correction.actionDate,
    );
    CASE_CORRECTION_FIELDS.forEach((k) => add("case." + k, FIELD_NAMES[k], docCase(old)[k], docCase(d)[k]));
    ["type", "mailed", "inspDate", "inspTime", "inspectorId"].forEach((k) =>
      add(k, FIELD_NAMES[k], k === "inspectorId" ? docInsp(old).id : old[k], d[k]),
    );
    if (d.type === "bestInterestExtension" && d.authoringVersion >= 15) {
      add("special.reason", "Reasons for Additional Time", old.special?.reason, d.special?.reason);
      if (d.authoringVersion < 16)
        add("special.noSafety", "Selected items exclude safety, security and urgent obligations", old.special?.noSafety, d.special?.noSafety);
    }
    if (d.type === "vacancyExtension" && d.authoringVersion >= 16) {
      add("special.scope", "Scope", old.special?.scope, d.special?.scope);
      add("special.unit", "Apartment / unit identifier", old.special?.unit, d.special?.unit);
      add("special.reviewDate", "Next scheduled review inspection", old.special?.reviewDate, d.special?.reviewDate);
    }
    d.items.forEach((it) => {
      const was = old.items.find((x) => x.id === it.id);
      if (!was) return;
      ["text", "title", "sections", "due", "abate", "note", "withdrawn", "withdrawalReason", "done", "doneOn"].forEach((k) =>
        add("item." + it.no + "." + k, "Item " + it.no + " · " + FIELD_NAMES[k], was[k], it[k]),
      );
      const visit = reinsp(old.fromReinspId),
        res = visit && (visit.results || {})[it.srcItemId];
      if (res && !res.carried) {
        const oc = (d.correction.outcomes || {})[it.id] || res.oc;
        add("visit.item." + it.no + ".outcome", "Visit · item " + it.no + " outcome", res.oc, oc);
      }
      const a = (old.cits || {})[it.id] || {},
        b = (d.cits || {})[it.id] || {};
      new Set(Object.keys(a).concat(Object.keys(b))).forEach((k) =>
        add(
          "citation." + it.no + "." + k,
          "Citation for item " +
            it.no +
            " · " +
            ({
              base: "Base deposit",
              amount: "Total deposit",
              cc: "Court costs",
              assessments: "Assessment breakdown",
              overrideBasis: "Approved pricing basis",
            }[k] ||
              FIELD_NAMES[k] ||
              k),
          a[k],
          b[k],
        ),
      );
    });
    return out;
  }

  function correctionEligibility(d, ownDraft) {
    if (!d || d.draft) return "Select an issued document.";
    if (d.superseded) return "This version has already been replaced. Open its current revision.";
    const latest = docsFor(d.caseId).find((x) => !x.draft && !x.superseded);
    if (!latest || latest.id !== d.id)
      return (
        "Later documents depend on this record. Add a record note here, then corr" + "ect the current document if its contents also need to change."
      );
    if (reinspFor(d.caseId).some((r) => r.sourceDocId === d.id))
      return (
        "An inspection already uses this document. Add a record note here and cor" +
        "rect its follow-up. Discard an unfinished worksheet first if it was star" +
        "ted in error."
      );
    const draft = docsFor(d.caseId).find((x) => x.draft && x.id !== ownDraft);
    if (draft) return "Finish or discard the existing document draft before starting a correction.";
    return "";
  }

  function correctionChecks(d) {
    const c = d.correction,
      src = correctionSource(d);
    if (!c) return [];
    const issue = correctionEligibility(src, d.id),
      sameHead = stableJSON(c.expectedHead) === stableJSON(recordHead(d.caseId));
    const sameItems = !!src && stableJSON(src.items.map((i) => [i.id, i.no])) === stableJSON(d.items.map((i) => [i.id, i.no]));
    const substantive = correctionChanges(d).some((x) => !["mailed", "inspectorId"].includes(x.path));
    const caseConflict = CASE_CORRECTION_FIELDS.some(
      (k) => stableJSON(c.case[k]) !== stableJSON(docCase(src)[k]) && stableJSON(kase(d.caseId)[k]) !== stableJSON(c.caseBaseline[k]),
    );
    return [
      {
        ok: !issue && sameHead,
        t:
          issue ||
          (!sameHead
            ? "The case changed after this correction was started. Keep this draft for " +
              "reference, open the shared case, then start from its current version."
            : "The correction is based on the current case record"),
      },
      { ok: sameItems, t: "Previously issued item identities, order and numbers must stay unchanged" },
      {
        ok:
          !specialType(src?.type) ||
          ["mode", "releases", "scope", "unit", "effective", "affected", "deadlineMode", "reviewDate", "expiryDate"].every(
            (key) => stableJSON(d.special?.[key]) === stableJSON(src.special?.[key]),
          ),
        t: "Use a new action to change restriction, release, scope or conditional extension facts",
      },
      {
        ok: !!src && c.case.number === docCase(src).number && correctionTypeAllowed(src, d.type),
        t: "Case number stays fixed. A different follow-up type must use the same re" + "corded visit and the existing referral path",
      },
      { ok: c.reason.trim().length >= 10 && c.reason.trim().length <= 1000, t: "Explain the error and correction (10–1,000 characters)" },
      {
        ok: validISO(c.actionDate) && c.actionDate <= recordDay(services.today),
        t: "The original action date used in current reports must be a real date no later than today",
      },
      { ok: substantive, t: "Make a content correction; changing only the mailing date or signer is not a correction" },
      { ok: !caseConflict, t: "Case details selected for future documents must not have changed in another working copy" },
      ...correctionVisitChecks(d),
      {
        ok: d.items.every(
          (i) => !i.done || i.withdrawn || (validISO(i.doneOn) && i.doneOn <= recordDay(services.today) && i.doneOn >= docCase(d).date),
        ),
        t: "Compliance dates must be real dates between the initial inspection and today",
      },
      {
        ok: d.items.every((i) => !i.withdrawn || String(i.withdrawalReason || "").trim().length >= 10),
        t: "Each withdrawn item needs its own reason (at least 10 characters)",
      },
      {
        ok: !(d.type === "citation" || isHistoryDoc(d) || specialType(d.type)) || c.externalReference.trim().length >= 10,
        t: "Record court / City Attorney instructions or the reviewed division amend" + "ment reference before issuing this correction",
      },
      {
        ok: !!workspaceState.CASEDIR && !!workspaceState.CASEDIR.helper,
        t: "Start the current local helper and connect the shared case folder before saving a correction",
      },
    ];
  }

  function makeCorrectionAttempt(d) {
    const addressFault = services.validateAndStandardizeAddresses(docCase(d), d.type === "citation" && isLLC(docCase(d)));
    if (addressFault) throw new Error(addressFault.message);
    const c = d.correction,
      old = correctionSource(d),
      at = new Date(Math.max(Date.now(), ...eventsFor(d.caseId).map((e) => Date.parse(e.at) + 1))).toISOString();
    const snap = clone(d);
    ["draft", "correction", "pendingAmendment"].forEach((k) => delete snap[k]);
    snap.status = "Final";
    snap.authoringVersion = Math.max(11, old.authoringVersion || 0);
    delete snap.dueWork;
    delete snap.selectionCache;
    snap.frozen = services.freezeSources(d);
    snap.replaces = old.id;
    if (isHistoryDoc(d) || services.hasItemInspectionHistory(d)) snap.items.forEach((it) => (it.hist = clone(services.documentItemHistory(d, it))));
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
    const changes = correctionChanges(d),
      caseChanges = {};
    CASE_CORRECTION_FIELDS.forEach((k) => {
      if (stableJSON(c.case[k]) !== stableJSON(docCase(old)[k]))
        caseChanges[k] = { before: c.caseBaseline[k] === undefined ? null : c.caseBaseline[k], after: c.case[k] === undefined ? null : c.case[k] };
    });
    if (caseChanges.ownerAddr)
      caseChanges.ownerAddressParsed = { before: c.caseBaseline.ownerAddressParsed || null, after: c.case.ownerAddressParsed || null };
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
    if (!recordCorrectionTypeAllowed(src, type)) return false;
    if (type === src.type || historyOnly) return true;
    // Not isReferredCase: a correction's own source document does not count as the earlier referral.
    const priorReferral = docsFor(src.caseId).some((x) => isEffective(x) && x.id !== src.id && isHistoryDoc(x));
    return !priorReferral || ["referralUpdate", "compliance"].includes(type);
  }

  function correctionVisitPatch(d) {
    const src = correctionSource(d),
      r = src && reinsp(src.fromReinspId);
    if (!r) return null;
    const results = {};
    d.items.forEach((it) => {
      const old = src.items.find((x) => x.id === it.id),
        key = it.srcItemId,
        res = r.results[key];
      if (!res || res.carried || it.withdrawn || !old) return;
      const outcome = (d.correction.outcomes || {})[it.id] || (it.done ? "corrected" : old.done ? "none" : res.oc);
      const result = clone(res);
      result.oc = outcome;
      if (it.done) result.on = it.doneOn;
      else if (outcome !== res.oc || (!res.manualDate && (!res.on || res.on === r.date))) result.on = d.inspDate || r.date;
      if (old.note !== it.note) result.note = it.note || "";
      if (old.due !== it.due) result.due = it.due || "";
      if (stableJSON(result) !== stableJSON(res)) results[key] = result;
    });
    if (!Object.keys(results).length && d.inspDate === src.inspDate && d.inspTime === src.inspTime) return null;
    return { id: r.id, baseEventId: r.eventId, date: d.inspDate || r.date, time: d.inspTime || "", results };
  }

  function correctionVisitChecks(d) {
    const src = correctionSource(d),
      r = src && reinsp(src.fromReinspId);
    if (!r) return [];
    const patch = correctionVisitPatch(d),
      date = d.inspDate || r.date,
      initial = docCase(d).date,
      previous = doc(r.sourceDocId);
    const results = { ...r.results, ...((patch && patch.results) || {}) };
    return [
      {
        ok: validISO(date) && date >= inspAt(previous).date && date <= recordDay(services.today),
        t: "The corrected visit must fall between the source inspection and today",
      },
      {
        ok: Object.values(results).every((x) => x.carried || (validISO(x.on || date) && (x.on || date) >= initial && (x.on || date) <= date)),
        t: "Corrected result dates must not fall after their inspection",
      },
      { ok: d.items.every((i) => !i.done || i.withdrawn || i.doneOn <= date), t: "Compliance must be observed no later than the recorded visit" },
    ];
  }
  return { correctionChanges, correctionEligibility, correctionChecks, makeCorrectionAttempt, correctionTypeAllowed, correctionVisitPatch };
}
