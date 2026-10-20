import { recordDay as dep_recordDay } from "../assets/shared.js";
import {
  applyDeposit as dep_applyDeposit,
  citationNumber as dep_citationNumber,
  emailDocument as dep_emailDocument,
  filePdf as dep_filePdf,
  fmtDate as dep_fmtDate,
  freezeSources as dep_freezeSources,
  inspAt as dep_inspAt,
  nextCourtDate as dep_nextCourtDate,
  printJob as dep_printJob,
  toast as dep_toast,
  validISO as dep_validISO,
} from "./court_and_deposits.js";
import {
  appendEvent as dep_appendEvent,
  caseDetails as dep_caseDetails,
  caseFile as dep_caseFile,
  caseFileName as dep_caseFileName,
  evid as dep_evid,
  helperJSON as dep_helperJSON,
  idbSet as dep_idbSet,
  mergeCaseEvents as dep_mergeCaseEvents,
  project as dep_project,
  rememberSaved as dep_rememberSaved,
  sourceDocFor as dep_sourceDocFor,
  stableJSON as dep_stableJSON,
} from "./workspace_shell.js";
import {
  saveDrafts as dep_saveDrafts,
  validateAndStandardizeAddresses as dep_validateAndStandardizeAddresses,
  writeSummary as dep_writeSummary,
} from "./case_files.js";
import { ensureWalkContext as dep_ensureWalkContext, priorCitations as dep_priorCitations } from "./reinspection_walkthrough.js";
import { cleanVisit as dep_cleanVisit, publishDocument as dep_publishDocument, unissuedVisitFor as dep_unissuedVisitFor } from "./draft_recovery.js";
import { commitCitationEdits as dep_commitCitationEdits } from "./case_timeline.js";
import { render as dep_render } from "./inspection_import.js";
import {
  CASE_CORRECTION_FIELDS as dep_CASE_CORRECTION_FIELDS,
  COMMITTED as dep_COMMITTED,
  DOC_TYPES as dep_DOC_TYPES,
  ENTRY_IDS as dep_ENTRY_IDS,
  FIELD_NAMES as dep_FIELD_NAMES,
  OUTCOMES as dep_OUTCOMES,
  blockers as dep_blockers,
  byTime as dep_byTime,
  citationPricing as dep_citationPricing,
  clone as dep_clone,
  correctionSource as dep_correctionSource,
  courtTime as dep_courtTime,
  deliveredByCitation as dep_deliveredByCitation,
  depositStep as dep_depositStep,
  doc as dep_doc,
  docBlocks as dep_docBlocks,
  docBody as dep_docBody,
  docCase as dep_docCase,
  docInsp as dep_docInsp,
  docsFor as dep_docsFor,
  draftDocFor as dep_draftDocFor,
  draftReinspFor as dep_draftReinspFor,
  emailList as dep_emailList,
  esc as dep_esc,
  eventsFor as dep_eventsFor,
  insp as dep_insp,
  isEffective as dep_isEffective,
  isHistoryDoc as dep_isHistoryDoc,
  isLLC as dep_isLLC,
  kase as dep_kase,
  nowISO as dep_nowISO,
  recordFormKey as dep_recordFormKey,
  recordHead as dep_recordHead,
  recordIntegrity as dep_recordIntegrity,
  recordNow as dep_recordNow,
  reinsp as dep_reinsp,
  reinspFor as dep_reinspFor,
  summaryName as dep_summaryName,
  uid as dep_uid,
} from "./app_core.js";
import { canonicalOrdinance as dep_canonicalOrdinance } from "./citation_policy.js";
import { INSPECTORS as dep_INSPECTORS } from "./data/inspectors.js";
import { specialType as dep_specialType } from "./new_documents.js";
import { WriterState } from "./state.js";
/* app functions; direct dependencies use explicit shared state. */

function citationTier(caseId, no) {
  const n = dep_priorCitations(caseId, no);
  return n === 0 ? "1st" : n === 1 ? "2nd" : "3rd+";
}

function itemHistory(caseId, no) {
  // every citation raised on this item, with the visit it came from
  const cits = [];
  dep_docsFor(caseId).forEach((x) => {
    if (x.draft || x.void || x.superseded || x.type !== "citation") return;
    const ci = x.items.find((i) => String(i.no) === String(no) && i.cite && !i.withdrawn);
    if (!ci) return;
    const c = (x.cits || {})[ci.id] || {};
    if (c.num) cits.push({ num: c.num, from: String(x.fromReinspId || ""), issued: c.issued || x.mailed || "" });
  });
  const used = {};
  const out = [];
  dep_reinspFor(caseId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((r) => {
      const src = dep_doc(r.sourceDocId);
      if (!src) return;
      const it = src.items.find((x) => String(x.no) === String(no));
      if (!it) return;
      const res = r.results[it.id];
      if (!res || !res.oc) return;
      const hit = cits.find((c) => c.from === String(r.id) && !used[c.num]);
      if (hit) used[hit.num] = 1;
      out.push({ visitId: r.id, on: res.on || r.date, oc: res.oc, note: String(res.note || "").trim(), cit: hit ? hit.num : "" });
    });
  // a citation issued with the original notice has no visit behind it, so it
  // is listed on its own line rather than dropped
  cits
    .filter((c) => !used[c.num])
    .forEach((c) => {
      out.unshift({ on: c.issued || "", oc: "cited", note: "", cit: c.num });
    });
  return out;
}

function runFinalize(d) {
  if (!d || !d.draft) return;
  return d.correction ? issueCorrection(d) : dep_publishDocument(d);
}

function citationFromNotice(noticeId) {
  const src = dep_doc(noticeId);
  if (!src) return null;
  const existing = dep_docsFor(src.caseId).find((d) => d.type === "citation" && d.fromDocId === src.id && !d.fromReinspId);
  if (existing) return existing;
  const cited = src.items.filter((i) => i.cite && !i.done && !i.withdrawn);
  if (!cited.length) return null;
  const nd = {
    id: dep_uid("d"),
    caseId: src.caseId,
    type: "citation",
    created: dep_recordDay(today),
    status: "Draft",
    draft: true,
    mailed: dep_recordDay(today),
    cc: "",
    cits: {},
    fromDocId: src.id,
    expectedHead: dep_recordHead(src.caseId),
    inspectorId: dep_docInsp(src).id,
    inspDate: dep_inspAt(src).date,
    inspTime: dep_inspAt(src).time || "",
    items: src.items.map((it) => ({
      ...it,
      id: dep_uid("x"),
      srcItemId: it.id,
      done: !!it.done,
      doneOn: it.doneOn || "",
      cite: !!it.cite && !it.done && !it.withdrawn,
      hist: null,
    })),
  };
  WriterState.DOCS.unshift(nd);
  nd.items
    .filter((i) => i.cite)
    .forEach((i) => {
      const sections = (i.sections || []).map(dep_canonicalOrdinance),
        ord = sections.length === 1 ? sections[0] : "";
      nd.cits[i.id] = {
        deptId: dep_docInsp(src).badge || "",
        num: dep_citationNumber(),
        courtTime: dep_courtTime(),
        comment:
          "Inspection on " +
          dep_fmtDate(dep_inspAt(src).date) +
          " documented the following violation: " +
          String(i.title || "").replace(/\.$/, "") +
          ". This citation relates to the Official Notice dated " +
          dep_fmtDate(src.mailed) +
          ".",
        ord,
        preparedSections: sections,
        autoFilledCharge: !!ord,
        desc: String(i.title || "").toUpperCase(),
        issued: nd.mailed,
        courtDate: dep_nextCourtDate(nd.mailed),
        depositMode: "schedule",
      };
      dep_applyDeposit(nd, i.id, ord);
    });
  WriterState.DIRTY = true;
  dep_saveDrafts();
  dep_depositStep.openNext(nd);
  return nd;
}

function recordReinspection(r, quiet) {
  if (!r || !r.draft) return null;
  const snap = dep_cleanVisit(r);
  const ev = dep_appendEvent(
    r.caseId,
    "reinspection.recorded",
    { reinspId: r.id, reinspection: snap, sourceDocId: r.sourceDocId },
    null,
    r.inspectorId,
  );
  WriterState.REINSP = WriterState.REINSP.filter((x) => x.id !== r.id);
  dep_project();
  dep_saveDrafts();
  if (!quiet) {
    dep_toast("Reinspection of " + dep_fmtDate(r.date) + " recorded");
    dep_render();
  }
  return ev;
}

function changeText(v) {
  return v == null
    ? "—"
    : typeof v === "boolean"
      ? v
        ? "Yes"
        : "No"
      : Array.isArray(v)
        ? v.map(changeText).join("; ")
        : typeof v === "object"
          ? Object.entries(v)
              .map(([k, x]) => k + ": " + changeText(x))
              .join("; ")
          : String(v) || "—";
}

function correctionChanges(d) {
  const old = dep_correctionSource(d);
  if (!old) return [];
  const out = [],
    add = (path, label, a, b) => {
      if (dep_stableJSON(a) !== dep_stableJSON(b))
        out.push({ path, label, before: a === undefined ? null : dep_clone(a), after: b === undefined ? null : dep_clone(b) });
    };
  add(
    "actionDate",
    "Original action date used in current reports",
    (old.revision && (old.revision.actionDate || old.revision.originalIssued)) || old.mailed || dep_recordDay(old.issuedAt),
    d.correction.actionDate,
  );
  dep_CASE_CORRECTION_FIELDS.forEach((k) => add("case." + k, dep_FIELD_NAMES[k], dep_docCase(old)[k], dep_docCase(d)[k]));
  ["type", "mailed", "inspDate", "inspTime", "inspectorId"].forEach((k) =>
    add(k, dep_FIELD_NAMES[k], k === "inspectorId" ? dep_docInsp(old).id : old[k], d[k]),
  );
  d.items.forEach((it) => {
    const was = old.items.find((x) => x.id === it.id);
    if (!was) return;
    ["text", "title", "sections", "due", "abate", "note", "withdrawn", "withdrawalReason", "done", "doneOn"].forEach((k) =>
      add("item." + it.no + "." + k, "Item " + it.no + " · " + dep_FIELD_NAMES[k], was[k], it[k]),
    );
    const visit = dep_reinsp(old.fromReinspId),
      res = visit && (visit.results || {})[it.srcItemId];
    if (res && !res.carried) {
      const oc = (d.correction.outcomes || {})[it.id] || res.oc;
      add("visit.item." + it.no + ".outcome", "Visit · item " + it.no + " outcome", res.oc, oc);
    }
    const a = (old.cits || {})[it.id] || {},
      b = (d.cits || {})[it.id] || {};
    new Set(Object.keys(a).concat(Object.keys(b))).forEach((k) =>
      add("citation." + it.no + "." + k, "Citation for item " + it.no + " · " + (dep_FIELD_NAMES[k] || k), a[k], b[k]),
    );
  });
  return out;
}

function correctionEligibility(d, ownDraft) {
  if (!d || d.draft) return "Select an issued document.";
  if (d.superseded) return "This version has already been replaced. Open its current revision.";
  const latest = dep_docsFor(d.caseId).find((x) => !x.draft && !x.superseded);
  if (!latest || latest.id !== d.id)
    return (
      "Later documents depend on this record. Add a record note here, then corr" + "ect the current document if its contents also need to change."
    );
  if (dep_reinspFor(d.caseId).some((r) => r.sourceDocId === d.id))
    return (
      "An inspection already uses this document. Add a record note here and cor" +
      "rect its follow-up. Discard an unfinished worksheet first if it was star" +
      "ted in error."
    );
  const draft = dep_docsFor(d.caseId).find((x) => x.draft && x.id !== ownDraft);
  if (draft) return "Finish or discard the existing document draft before starting a correction.";
  return "";
}

function startCorrection(docId) {
  const existing = dep_docsFor((dep_doc(docId) || {}).caseId).find((x) => x.draft && x.correction && x.correction.targetId === docId);
  if (existing) {
    WriterState.state.docId = existing.id;
    WriterState.state.screen = "write";
    dep_render();
    return existing;
  }
  const src = dep_doc(docId),
    fault = correctionEligibility(src);
  if (fault) {
    dep_toast(fault);
    return null;
  }
  const d = dep_clone(src);
  [
    "frozen",
    "void",
    "superseded",
    "annotations",
    "reconciliation",
    "accelaAt",
    "accelaRef",
    "filedAt",
    "filedRef",
    "issuedAt",
    "issuedBy",
    "eventId",
    "revision",
    "replaces",
    "emailedTo",
  ].forEach((k) => delete d[k]);
  const savedEmails = (Array.isArray(dep_kase(src.caseId).emails) ? dep_kase(src.caseId).emails : []).concat(
    Array.isArray(dep_docCase(src).emails) ? dep_docCase(src).emails : [],
  );
  const issuedEmails = Array.isArray(src.emailedTo) ? src.emailedTo : [];
  const allEmails = savedEmails.concat(issuedEmails.map((e) => ({ addr: e.addr, kind: e.kind || "Other", on: true })));
  const emailMap = new Map();
  allEmails.forEach((e) => {
    const addr = String(e.addr || "").trim();
    if (addr) {
      const key = addr.toLowerCase() + "|" + (e.kind || "Other");
      if (!emailMap.has(key)) emailMap.set(key, Object.assign({}, e, { addr }));
    }
  });
  issuedEmails.forEach((e) => {
    const addr = String(e.addr || "").trim();
    if (addr) {
      const key = addr.toLowerCase() + "|" + (e.kind || "Other");
      emailMap.set(key, { addr, kind: e.kind || "Other", on: true });
    }
  });
  const emailRows = Array.from(emailMap.values());
  d.id = dep_uid("d");
  d.draft = true;
  d.status = "Draft";
  d.created = dep_recordDay(today);
  d.mailed = dep_recordDay(today);
  d.inspectorId = dep_kase(src.caseId).inspectorId || dep_docInsp(src).id;
  d.correction = {
    targetId: src.id,
    baseEventId: src.eventId,
    expectedHead: dep_recordHead(src.caseId),
    reason: "",
    case: dep_clone(dep_docCase(src)),
    caseBaseline: dep_caseDetails(dep_kase(src.caseId)),
    body: dep_docBody(src),
    blocks: dep_clone(dep_docBlocks(src)),
    updateCase: true,
    externalReference: "",
    reviewed: false,
    outcomes: {},
    actionDate: (src.revision && (src.revision.actionDate || src.revision.originalIssued)) || src.mailed || dep_recordDay(src.issuedAt),
  };
  d.correction.case.emails = emailRows;
  d.emailSelection = emailRows.filter((e) => e.on !== false).map((e) => e.addr + "|" + (e.kind || "Other"));
  WriterState.DOCS.unshift(d);
  WriterState.state.docId = d.id;
  WriterState.state.screen = "write";
  WriterState.DIRTY = true;
  dep_saveDrafts();
  dep_render();
  dep_toast("Correction draft opened. The issued record is unchanged until you review and save.");
  return d;
}

function correctionChecks(d) {
  const c = d.correction,
    src = dep_correctionSource(d);
  if (!c) return [];
  const issue = correctionEligibility(src, d.id),
    sameHead = dep_stableJSON(c.expectedHead) === dep_stableJSON(dep_recordHead(d.caseId));
  const sameItems = !!src && dep_stableJSON(src.items.map((i) => [i.id, i.no])) === dep_stableJSON(d.items.map((i) => [i.id, i.no]));
  const substantive = correctionChanges(d).some((x) => !["mailed", "inspectorId"].includes(x.path));
  const caseConflict = dep_CASE_CORRECTION_FIELDS.some(
    (k) =>
      dep_stableJSON(c.case[k]) !== dep_stableJSON(dep_docCase(src)[k]) &&
      dep_stableJSON(dep_kase(d.caseId)[k]) !== dep_stableJSON(c.caseBaseline[k]),
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
      ok: !!src && c.case.number === dep_docCase(src).number && correctionTypeAllowed(src, d.type),
      t: "Case number stays fixed. A different follow-up type must use the same re" + "corded visit and the existing referral path",
    },
    { ok: c.reason.trim().length >= 10 && c.reason.trim().length <= 1000, t: "Explain the error and correction (10–1,000 characters)" },
    {
      ok: dep_validISO(c.actionDate) && c.actionDate <= dep_recordDay(today),
      t: "The original action date used in current reports must be a real date no later than today",
    },
    { ok: substantive, t: "Make a content correction; changing only the mailing date or signer is not a correction" },
    { ok: !caseConflict, t: "Case details selected for future documents must not have changed in another working copy" },
    ...correctionVisitChecks(d),
    {
      ok: d.items.every(
        (i) => !i.done || i.withdrawn || (dep_validISO(i.doneOn) && i.doneOn <= dep_recordDay(today) && i.doneOn >= dep_docCase(d).date),
      ),
      t: "Compliance dates must be real dates between the initial inspection and today",
    },
    {
      ok: d.items.every((i) => !i.withdrawn || String(i.withdrawalReason || "").trim().length >= 10),
      t: "Each withdrawn item needs its own reason (at least 10 characters)",
    },
    {
      ok: !(d.type === "citation" || dep_isHistoryDoc(d) || dep_specialType(d.type)) || c.externalReference.trim().length >= 10,
      t: "Record court / City Attorney instructions or the reviewed division amend" + "ment reference before issuing this correction",
    },
    {
      ok: !!WriterState.CASEDIR && !!WriterState.CASEDIR.helper,
      t: "Start the current local helper and connect the shared case folder before saving a correction",
    },
  ];
}

function correctionHistoryFault(events) {
  const docs = new Map(),
    changed = new Set();
  for (const ev of events.slice().sort(dep_byTime)) {
    const p = ev.payload || {};
    if (/\.issued$/.test(ev.type) && p.snapshot) {
      if (docs.has(p.snapshot.id)) return "Two issued records share a document identity";
      if (ev.type === "correction.issued") {
        const old = docs.get(p.replaces);
        if (!old || old.eventId !== p.baseEventId || changed.has(p.replaces))
          return "Conflicting corrections: keep both drafts for review and reopen the current shared case";
        if (!String(p.reason || "").trim() || !p.snapshot.revision) return "A correction is missing its reason or revision link";
        if (
          !correctionTypeAllowed(old, p.snapshot.type, true) ||
          dep_stableJSON(old.items.map((i) => [i.id, i.no])) !== dep_stableJSON(p.snapshot.items.map((i) => [i.id, i.no]))
        )
          return "A correction changed the document type or item identities";
        changed.add(p.replaces);
      }
      docs.set(p.snapshot.id, Object.assign({}, p.snapshot, { eventId: ev.id }));
    }
  }
  return "";
}

function makeCorrectionAttempt(d) {
  const addressFault = dep_validateAndStandardizeAddresses(dep_docCase(d), d.type === "citation" && dep_isLLC(dep_docCase(d)));
  if (addressFault) throw new Error(addressFault.message);
  const c = d.correction,
    old = dep_correctionSource(d),
    at = new Date(Math.max(Date.now(), ...dep_eventsFor(d.caseId).map((e) => Date.parse(e.at) + 1))).toISOString();
  const snap = dep_clone(d);
  ["draft", "correction", "pendingAmendment"].forEach((k) => delete snap[k]);
  snap.status = "Final";
  snap.authoringVersion = Math.max(11, old.authoringVersion || 0);
  delete snap.dueWork;
  delete snap.selectionCache;
  snap.frozen = dep_freezeSources(d);
  snap.replaces = old.id;
  if (dep_isHistoryDoc(d)) snap.items.forEach((it) => (it.hist = dep_clone(documentItemHistory(d, it))));
  delete snap.publicationEvents;
  delete snap.expectedHead;
  snap.revision = {
    number: ((old.revision || {}).number || 0) + 1,
    rootId: (old.revision || {}).rootId || old.id,
    targetId: old.id,
    originalIssued: (old.revision || {}).originalIssued || old.mailed || dep_recordDay(old.issuedAt),
    actionDate: c.actionDate,
    reason: c.reason.trim(),
    externalReference: c.externalReference.trim(),
  };
  const changes = correctionChanges(d),
    caseChanges = {};
  dep_CASE_CORRECTION_FIELDS.forEach((k) => {
    if (dep_stableJSON(c.case[k]) !== dep_stableJSON(dep_docCase(old)[k]))
      caseChanges[k] = { before: c.caseBaseline[k] === undefined ? null : c.caseBaseline[k], after: c.case[k] === undefined ? null : c.case[k] };
  });
  if (caseChanges.ownerAddr)
    caseChanges.ownerAddressParsed = { before: c.caseBaseline.ownerAddressParsed || null, after: c.case.ownerAddressParsed || null };
  return {
    id: dep_evid(),
    at,
    by: dep_docInsp(d).id,
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

async function commitAmendment(cid, attempt, draft) {
  if (WriterState.AMENDMENT_BUSY) return false;
  if (!WriterState.CASEDIR || !WriterState.CASEDIR.helper) {
    dep_toast("Start the current local helper to save this record change safely.");
    return false;
  }
  WriterState.AMENDMENT_BUSY = true;
  try {
    // The attempt is durable before any request. If its response is lost, the
    // same event identity is retried, never a second revision.
    if (draft) {
      draft.pendingAmendment = attempt;
      if (!(await dep_saveDrafts())) throw new Error("The pending action could not be saved on this device. Keep this tab open and retry.");
    }
    const localBefore = dep_caseDetails(dep_kase(cid));
    const candidate = dep_caseFile(cid),
      key = dep_summaryName(candidate.case),
      base = dep_COMMITTED.get(key),
      checkpoint = WriterState.SAVE_CHECKPOINTS[cid];
    const existing = candidate.events.find((e) => e.id === attempt.id);
    for (const event of (draft && draft.publicationEvents) || [])
      if (!candidate.events.some((e) => e.id === event.id)) candidate.events.push(dep_clone(event));
    if (!existing) candidate.events.push(dep_clone(attempt));
    for (const event of (draft && draft.publicationEvents) || [])
      if (!candidate.inspectors.some((i) => i.id === event.by) && dep_insp(event.by).name) candidate.inspectors.push(dep_clone(dep_insp(event.by)));
    if (!candidate.inspectors.some((i) => i.id === attempt.by) && dep_insp(attempt.by).name)
      candidate.inspectors.push(dep_clone(dep_insp(attempt.by)));
    Object.entries(attempt.payload.caseChanges || {}).forEach(([k, v]) => {
      if (v.after === null) delete candidate.case[k];
      else candidate.case[k] = dep_clone(v.after);
    });
    const result = await dep_helperJSON("/cases/save", {
      name: base ? base.name : dep_caseFileName(candidate.case),
      file: candidate,
      baseRevision: (base && base.revision) || "",
      baseCase: checkpoint ? checkpoint.case : null,
      idempotencyEvent: attempt.id,
    });
    dep_COMMITTED.set(key, result);
    const k = dep_kase(cid),
      savedCase = Object.assign({}, dep_caseDetails(result.file.case), { id: cid });
    new Set(Object.keys(localBefore).concat(Object.keys(savedCase))).forEach((key) => {
      if (key === "id") return;
      if (dep_stableJSON(k[key]) === dep_stableJSON(localBefore[key])) {
        if (savedCase[key] === undefined) delete k[key];
        else k[key] = dep_clone(savedCase[key]);
      }
    });
    dep_mergeCaseEvents(k, dep_clone(result.file));
    if (draft) {
      WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== draft.id);
      if (draft.publicationEvents) WriterState.REINSP = WriterState.REINSP.filter((r) => !(r.draft && r.id === attempt.payload.fromReinspId));
      if (draft.recordKey) delete WriterState.RECORD_ATTEMPTS[draft.recordKey];
    }
    const formModes = { "document.annotated": "recordnote", "document.reconciled": "reconcile", "document.voided": "void" };
    if (formModes[attempt.type]) {
      delete WriterState.WORK.recordForms[attempt.payload.docId + ":" + formModes[attempt.type]];
      if (WriterState.state.docId === attempt.payload.docId && WriterState.state.modal === formModes[attempt.type]) WriterState.state.modal = null;
    }
    dep_project();
    dep_rememberSaved(k, result.file);
    WriterState.LASTWRITE = { name: result.name, ok: true, why: "", at: dep_nowISO() };
    const savedIds = new Set(result.file.events.map((e) => e.id));
    if (dep_eventsFor(cid).every((e) => savedIds.has(e.id)) && dep_stableJSON(dep_caseDetails(k)) === dep_stableJSON(savedCase))
      WriterState.PENDING = WriterState.PENDING.filter((p) => p.cid !== cid);
    await dep_idbSet("pending", WriterState.PENDING);
    await dep_writeSummary(cid, result.file);
    await dep_saveDrafts();
    return true;
  } catch (error) {
    // Validation/conflict rejections are definitive. Network and server errors
    // may follow a committed write; retain the exact attempt for confirmation.
    if (draft && error.name === "StorageError" && error.definitive !== false) {
      delete draft.pendingAmendment;
      delete draft.publicationEvents;
      if (draft.recordKey) delete WriterState.RECORD_ATTEMPTS[draft.recordKey];
    }
    if (draft) await dep_saveDrafts();
    WriterState.state.amendmentError = /failed to fetch|networkerror|network request failed/i.test(error.message)
      ? "The shared save could not be confirmed. Your exact request is retained. " + "Reconnect and use Confirm save or Retry save."
      : error.message;
    dep_toast(WriterState.state.amendmentError);
    return false;
  } finally {
    WriterState.AMENDMENT_BUSY = false;
    dep_render();
  }
}

async function issueCorrection(d) {
  if (d && dep_recordIntegrity.blocked(d.caseId)) {
    dep_toast("This record was changed outside the program. Open read-only and refer it for review.");
    return false;
  }
  if (!d || !d.correction) return false;
  if (!d.pendingAmendment) dep_commitCitationEdits(d);
  if (!d.pendingAmendment && d.type === "citation" && !(await dep_citationPricing.loadShared(d, true))) {
    WriterState.state.amendmentError = "Shared citation history could not be checked. Reconnect before correcting the citation.";
    await dep_saveDrafts();
    dep_render();
    return false;
  }
  if (!d.pendingAmendment && (dep_blockers(d).length || !d.correction.reviewed)) {
    dep_toast("Review the changes and resolve the checks before issuing the correction.");
    return false;
  }
  const attempt = d.pendingAmendment || makeCorrectionAttempt(d);
  if (!(await commitAmendment(d.caseId, attempt, d))) {
    WriterState.state.modal = null;
    dep_render();
    return false;
  }
  WriterState.state.modal = null;
  WriterState.state.amendmentError = "";
  WriterState.state.docId = d.id;
  WriterState.state.screen = "write";
  dep_render();
  window.scrollTo(0, 0);
  const issued = dep_doc(d.id),
    sendEmail = !!issued.emailedTo && issued.emailedTo.length > 0;
  try {
    const job = dep_printJob(issued);
    if (!(await dep_filePdf(issued, job))) dep_toast("Correction saved. Use File issued PDF to produce its copy.");
    else if (sendEmail) await dep_emailDocument(issued, dep_clone(issued.emailedTo), true, job);
  } catch (e) {
    dep_toast("Correction saved; PDF filing needs a retry.");
  }
  dep_render();
  return true;
}

async function voidDocument(docId, reason, externalReference = "", actor = "") {
  const d = dep_doc(docId),
    fault = correctionEligibility(d);
  if (fault || d.void || String(reason || "").trim().length < 10) {
    dep_toast(fault || "Provide a specific reason of at least 10 characters.");
    return false;
  }
  if ((d.type === "citation" || dep_isHistoryDoc(d) || dep_specialType(d.type)) && String(externalReference).trim().length < 10) {
    dep_toast("Record the court or City Attorney withdrawal instructions / reference.");
    return false;
  }
  const attempt = {
    id: dep_evid(),
    at: dep_recordNow(d.caseId),
    by: actor || dep_kase(d.caseId).inspectorId,
    type: "document.voided",
    payload: { docId, reason: reason.trim(), externalReference, expectedHead: dep_recordHead(d.caseId) },
  };
  if (!(await commitRecordAttempt(d.caseId, attempt))) return false;
  WriterState.state.modal = null;
  dep_render();
  dep_toast("Document withdrawn. Its original and reason remain in the case history.");
  return true;
}

async function addRecordNote(docId, text, actor = "") {
  const d = dep_doc(docId);
  if (!d || d.draft || String(text || "").trim().length < 10) {
    dep_toast("Enter a specific record note (at least 10 characters).");
    return false;
  }
  const attempt = {
    id: dep_evid(),
    at: dep_recordNow(d.caseId),
    by: actor || dep_kase(d.caseId).inspectorId,
    type: "document.annotated",
    payload: { docId, text: text.trim() },
  };
  if (!(await commitRecordAttempt(d.caseId, attempt))) return false;
  WriterState.state.modal = null;
  dep_render();
  dep_toast("Record note saved. The issued document is unchanged.");
  return true;
}

async function reconcileDocument(docId, reference, actor = "") {
  const d = dep_doc(docId);
  if (!d || d.draft || String(reference || "").trim().length < 10) {
    dep_toast("Record who was notified, when, and the filing reference (at least 10 characters).");
    return false;
  }
  const attempt = {
    id: dep_evid(),
    at: dep_recordNow(d.caseId),
    by: actor || dep_kase(d.caseId).inspectorId,
    type: "document.reconciled",
    payload: { docId, reference: reference.trim() },
  };
  if (!(await commitRecordAttempt(d.caseId, attempt))) return false;
  WriterState.state.modal = null;
  dep_render();
  dep_toast("Follow-through recorded.");
  return true;
}

function correctionDiffHTML(d) {
  const changes = correctionChanges(d);
  return (
    '<div class="change-table"><table><caption>Changes from the issued versio' +
    "n</caption><thead><tr><th>Field</th><th>Previously issued</th><th>Correc" +
    "tion draft</th></tr></thead><tbody>" +
    "".concat(
      changes
        .map(
          (c) =>
            "<tr><th>" +
            `${dep_esc(c.label)}` +
            "</th><td>" +
            `${dep_esc(changeText(c.before))}` +
            "</td><td>" +
            `${dep_esc(changeText(c.after))}` +
            "</td></tr>",
        )
        .join("") || '<tr><td colspan="3">No changes yet.</td></tr>',
    ) +
    "</tbody></table></div>"
  );
}

function correctionPanel(d) {
  if (!d.correction) return "";
  const c = d.correction,
    locked = !!d.pendingAmendment;
  return (
    '<section class="card correction-panel no-print"><div class="card-b"><div' +
    ' class="revision-eyebrow">Correction draft · revision ' +
    `${((dep_correctionSource(d) || {}).revision || {}).number + 1 || 1}` +
    "</div><h2>Fix the record without losing its history</h2><p>The prior ver" +
    "sion remains on record while you work. Item numbers, inspection history " +
    "and unchanged deadlines carry forward. Changed conditions belong in a ne" +
    "w reinspection.</p>\n    " +
    "".concat(
      locked
        ? '<div class="banner warn">The save response was not confirmed. Retry the ' +
            "exact save to check the shared record before editing or discarding this " +
            'draft. <button class="btn" id="btn-retrycorrection">Retry save</button><' +
            "/div>"
        : "",
    ) +
    "\n    " +
    "".concat(WriterState.state.amendmentError ? `<div class="banner alert" role="alert">${dep_esc(WriterState.state.amendmentError)}</div>` : "") +
    '\n    <label class="f"><span>What was wrong, and why is this correction n' +
    'eeded?</span><textarea id="correction-reason" rows="2" maxlength="1000" ' +
    `${locked ? "disabled" : ""}` +
    ">" +
    `${dep_esc(c.reason)}` +
    '</textarea></label>\n    <p class="hint">Changed case details are saved f' +
    "or future documents and current reports. The original issued copy remain" +
    "s unchanged. Case number stays fixed.</p>\n    " +
    "".concat(
      d.type === "citation" || dep_isHistoryDoc(d) || dep_specialType(d.type)
        ? '<label class="f"><span>Court / City Attorney / division amendment instru' +
            'ctions or reference</span><textarea id="correction-external" rows="2" ' +
            `${locked ? "disabled" : ""}` +
            ">" +
            `${dep_esc(c.externalReference)}` +
            '</textarea><span class="hint">Confirm the required process with the rece' +
            "iving office. Saving here does not amend an external court or attorney r" +
            "ecord.</span></label>"
        : "",
    ) +
    "\n    <details><summary>Property record details and original action date<" +
    '/summary><label class="f"><span>Original action date used in current rep' +
    'orts</span><input type="date" id="correction-action-date" value="' +
    `${dep_esc(c.actionDate)}` +
    '" max="' +
    `${dep_recordDay(today)}` +
    '" ' +
    `${locked ? "disabled" : ""}` +
    '><span class="hint">Keep this date unless the original issue date was re' +
    "corded incorrectly. This differs from the mailing date of this new corre" +
    "cted copy. A change is included in the review and audit trail.</span></l" +
    'abel><div class="grid g2"><label class="f"><span>Parcel</span><input dat' +
    'a-case="parcel" value="' +
    `${dep_esc(c.case.parcel || "")}` +
    '" ' +
    `${locked ? "disabled" : ""}` +
    '></label><label class="f"><span>City / state / ZIP</span><input data-cas' +
    'e="siteCity" value="' +
    `${dep_esc(c.case.siteCity || "")}` +
    '" ' +
    `${locked ? "disabled" : ""}` +
    "></label></div></details>\n    " +
    `${locked ? "" : correctionVisitEditor(d)}` +
    "\n    <details><summary>Compare with the issued version</summary>" +
    `${correctionDiffHTML(d)}` +
    '</details>\n    <div class="correction-actions"><button class="btn" data-' +
    'open="' +
    `${dep_esc(c.targetId)}` +
    '">View previous version</button><button class="btn" id="btn-exportcorrec' +
    'tion">Download draft changes</button><button class="btn" data-discard="' +
    `${dep_esc(d.id)}` +
    '" ' +
    `${locked ? "disabled" : ""}` +
    '>Discard correction</button><button class="btn" id="btn-reviewcorrection' +
    '" ' +
    `${locked ? "disabled" : ""}` +
    ">Review correction</button></div>\n  </div></section>"
  );
}

function recordHistoryHTML(d) {
  if (d.draft) return "";
  const chain = dep_docsFor(d.caseId)
    .filter((x) => !x.draft && ((x.revision || {}).rootId || x.id) === ((d.revision || {}).rootId || d.id))
    .slice()
    .reverse();
  const notes = d.annotations || [],
    follow = !!d.void,
    pending = follow && !d.reconciliation;
  const finishing = !!WriterState.state.publicationBusy && dep_doc(WriterState.state.publicationBusy)?.caseId === d.caseId;
  return (
    '<section class="card record-history no-print"><div class="card-b"><h2>Do' +
    "cument record</h2>\n    " +
    "".concat(
      pending
        ? '<div class="banner warn"><div><strong>Follow-through still needs recordi' +
            "ng.</strong> Notify affected recipients and update Accela and any court " +
            "/ attorney records as applicable. Opening an email draft does not confir" +
            'm delivery. <button class="btn" id="btn-reconcile">Record follow-through' +
            "</button></div></div>"
        : d.reconciliation
          ? "<p>Follow-through recorded by " +
            `${dep_esc(dep_insp(d.reconciliation.by).name || d.reconciliation.by)}` +
            " on " +
            `${dep_esc(dep_fmtDate(dep_recordDay(d.reconciliation.at)))}` +
            ": " +
            `${dep_esc(d.reconciliation.reference)}` +
            "</p>"
          : "",
    ) +
    "\n    " +
    "".concat(
      Object.values(WriterState.RECORD_ATTEMPTS)
        .filter((x) => x.cid === d.caseId && x.pendingAmendment.payload.docId === d.id)
        .map(
          (x) =>
            '<div class="banner warn">A record change is awaiting save confirmation. ' +
            'Its exact request is retained. <button class="btn" data-resumerecord="' +
            `${dep_esc(x.recordKey)}` +
            '">Confirm save</button></div>',
        )
        .join(""),
    ) +
    "\n    <details><summary>Version history · " +
    `${chain.length}` +
    " " +
    `${chain.length === 1 ? "version" : "versions"}` +
    "" +
    `${notes.length ? " · " + notes.length + " record notes" : ""}` +
    '</summary><ol class="record-chain">' +
    "".concat(
      chain
        .map(
          (x) =>
            '<li><button class="lnk" data-open="' +
            `${dep_esc(x.id)}` +
            '">' +
            `${x.revision ? "Revision " + x.revision.number : "Original"}` +
            " · " +
            `${dep_esc(dep_fmtDate(dep_recordDay((x.revision && x.revision.at) || x.issuedAt)))}` +
            "</button> <span>" +
            `${x.superseded ? "Replaced" : x.void ? "Withdrawn" : "Current version"}` +
            "</span>" +
            `${x.revision ? `<p>${dep_esc(x.revision.reason)}</p>` : ""}` +
            "</li>",
        )
        .join(""),
    ) +
    "</ol>\n    " +
    "".concat(
      notes.length
        ? "<h3>Record notes</h3>" +
            "".concat(
              notes
                .map(
                  (n) =>
                    "<p><strong>" +
                    `${dep_esc(dep_fmtDate(dep_recordDay(n.at)))}` +
                    " · " +
                    `${dep_esc(dep_insp(n.by).name || n.by)}` +
                    "</strong><br>" +
                    `${dep_esc(n.text)}` +
                    "</p>",
                )
                .join(""),
            ) +
            ""
        : '<p class="hint">Record notes explain earlier errors without changing the issued copy.</p>',
    ) +
    "\n    </details>" +
    "".concat(finishing ? '<p class="hint" id="record-save-progress" role="status">Finishing document save…</p>' : "") +
    '<div class="correction-actions"><button class="btn" id="btn-recordnote" ' +
    `${finishing ? 'disabled aria-describedby="record-save-progress"' : ""}` +
    '>Add record note</button> <button class="btn" id="btn-original">Print or' +
    "iginal issued copy</button></div></div></section>"
  );
}

function revisionPrintNote(d) {
  if (d.draft) return '<div class="revision-print"><strong>DRAFT · NOT ISSUED</strong></div>';
  const r = d.revision;
  if (!r) return "";
  return (
    '<div class="revision-print"><strong>CORRECTED DOCUMENT · Revision ' +
    `${dep_esc(r.number)}` +
    "</strong><br>Replaces document " +
    `${dep_esc(r.targetId)}` +
    ", originally issued " +
    `${dep_esc(dep_fmtDate(r.originalIssued))}` +
    ". This revision: " +
    `${dep_esc(d.id)}` +
    ".<br>" +
    `${dep_esc(r.reason)}` +
    "</div>"
  );
}

function recordActionModal() {
  const mode = WriterState.state.modal,
    d = dep_doc(WriterState.state.docId);
  if (!d || !["void", "recordnote", "reconcile"].includes(mode)) return "";
  const kinds = { void: "document.voided", recordnote: "document.annotated", reconcile: "document.reconciled" };
  const held = Object.values(WriterState.RECORD_ATTEMPTS).find(
    (x) => x.cid === d.caseId && x.pendingAmendment.payload.docId === d.id && x.pendingAmendment.type === kinds[mode],
  );
  const heldPayload = held ? held.pendingAmendment.payload : null;
  const savedForm = WriterState.WORK.recordForms[d.id + ":" + mode] || {};
  const titles = { void: "Withdraw this document", recordnote: "Add a record note", reconcile: "Record follow-through" };
  const texts = {
    void:
      "Use a correction for an error that can be fixed. Withdrawal ends this do" +
      "cument without a replacement; the previous active document may become cu" +
      "rrent. Nothing is deleted. Review any affected recipients and external r" +
      "ecords.",
    recordnote:
      "Explain an error or clarification in an earlier record. This note does n" +
      "ot change the issued document, deadlines, inspection results or report c" +
      "ounts. Correct the latest document as well if it carries the same error.",
    reconcile:
      "Record completed notification and filing actions: recipients, date, deli" +
      "very method and Accela / court / attorney references as applicable. This" +
      " is your confirmation of work completed outside the program.",
  };
  return (
    '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
    '"><div class="modal-h"><h2>' +
    `${titles[mode]}` +
    '</h2></div><div class="modal-b"><p>' +
    "".concat(held ? "The previous save is awaiting confirmation. Retry its retained request before entering another change." : texts[mode]) +
    "</p>" +
    "".concat(WriterState.state.amendmentError ? `<div class="banner alert" role="alert">${dep_esc(WriterState.state.amendmentError)}</div>` : "") +
    '<label class="f"><span>Inspector making this record change</span><select' +
    ' id="record-action-inspector" ' +
    `${held ? "disabled" : ""}` +
    ">" +
    "".concat(
      dep_INSPECTORS
        .map(
          (i) =>
            '<option value="' +
            `${dep_esc(i.id)}` +
            '" ' +
            `${i.id === (held ? held.pendingAmendment.by : dep_kase(d.caseId).inspectorId) ? "selected" : ""}` +
            ">" +
            `${dep_esc(i.name)}` +
            "</option>",
        )
        .join(""),
    ) +
    '</select></label><label class="f"><span>' +
    "".concat(mode === "void" ? "Reason for withdrawal" : mode === "reconcile" ? "Completed actions and references" : "Record note") +
    '</span><textarea id="record-action-text" rows="4" maxlength="4000" ' +
    `${held ? "disabled" : ""}` +
    ">" +
    "".concat(heldPayload ? dep_esc(heldPayload.reason || heldPayload.text || heldPayload.reference) : dep_esc(savedForm.text || "")) +
    "</textarea></label>" +
    "".concat(
      mode === "void" && (d.type === "citation" || dep_isHistoryDoc(d) || dep_specialType(d.type))
        ? '<label class="f"><span>Court / City Attorney instructions or reference</' +
            'span><textarea id="record-action-external" rows="2" ' +
            `${held ? "disabled" : ""}` +
            ">" +
            `${heldPayload ? dep_esc(heldPayload.externalReference || "") : dep_esc(savedForm.external || "")}` +
            "</textarea></label>"
        : "",
    ) +
    '</div><div class="modal-f"><button class="btn" data-close="modal">Cancel' +
    '</button><button class="btn" id="btn-savework">Save &amp; continue later' +
    '</button><button class="btn btn-primary" id="record-action-go">' +
    `${held ? "Confirm previous save" : mode === "void" ? "Confirm withdrawal" : "Save to case record"}` +
    "</button></div></div></div>"
  );
}

function correctionTypeAllowed(src, type, historyOnly = false) {
  if (type === src.type) return true;
  if (dep_specialType(src.type)) return false;
  if (!src.fromReinspId || src.type === "citation" || !["extension", "referral", "referralUpdate", "compliance"].includes(type)) return false;
  if (historyOnly) return true;
  const priorReferral = dep_docsFor(src.caseId).some((x) => dep_isEffective(x) && x.id !== src.id && dep_isHistoryDoc(x));
  return !priorReferral || ["referralUpdate", "compliance"].includes(type);
}

function correctionVisitPatch(d) {
  const src = dep_correctionSource(d),
    r = src && dep_reinsp(src.fromReinspId);
  if (!r) return null;
  const results = {};
  d.items.forEach((it) => {
    const old = src.items.find((x) => x.id === it.id),
      key = it.srcItemId,
      res = r.results[key];
    if (!res || res.carried || it.withdrawn || !old) return;
    const outcome = (d.correction.outcomes || {})[it.id] || (it.done ? "corrected" : old.done ? "none" : res.oc);
    const result = dep_clone(res);
    result.oc = outcome;
    if (it.done) result.on = it.doneOn;
    else if (outcome !== res.oc || (!res.manualDate && (!res.on || res.on === r.date))) result.on = d.inspDate || r.date;
    if (old.note !== it.note) result.note = it.note || "";
    if (old.due !== it.due) result.due = it.due || "";
    if (dep_stableJSON(result) !== dep_stableJSON(res)) results[key] = result;
  });
  if (!Object.keys(results).length && d.inspDate === src.inspDate && d.inspTime === src.inspTime) return null;
  return { id: r.id, baseEventId: r.eventId, date: d.inspDate || r.date, time: d.inspTime || "", results };
}

function correctionVisitChecks(d) {
  const src = dep_correctionSource(d),
    r = src && dep_reinsp(src.fromReinspId);
  if (!r) return [];
  const patch = correctionVisitPatch(d),
    date = d.inspDate || r.date,
    initial = dep_docCase(d).date,
    previous = dep_doc(r.sourceDocId);
  const results = { ...r.results, ...((patch && patch.results) || {}) };
  return [
    {
      ok: dep_validISO(date) && date >= dep_inspAt(previous).date && date <= dep_recordDay(today),
      t: "The corrected visit must fall between the source inspection and today",
    },
    {
      ok: Object.values(results).every((x) => x.carried || (dep_validISO(x.on || date) && (x.on || date) >= initial && (x.on || date) <= date)),
      t: "Corrected result dates must not fall after their inspection",
    },
    { ok: d.items.every((i) => !i.done || i.withdrawn || i.doneOn <= date), t: "Compliance must be observed no later than the recorded visit" },
  ];
}

function documentItemHistory(d, it) {
  if (!d.correction || !dep_isHistoryDoc(d)) return it.hist || [];
  const patch = correctionVisitPatch(d),
    r = patch && dep_reinsp(patch.id);
  if (!r) return it.hist || [];
  const res = patch.results[it.srcItemId] || r.results[it.srcItemId];
  return itemHistory(d.caseId, it.no).map((x) =>
    x.visitId === r.id && res ? { ...x, on: res.on || patch.date, oc: res.oc, note: res.note || "" } : x,
  );
}

function correctionVisitEditor(d) {
  const src = dep_correctionSource(d),
    r = src && dep_reinsp(src.fromReinspId);
  if (!r) return "";
  const allowed = dep_DOC_TYPES.filter((t) => t.ready && correctionTypeAllowed(src, t.id));
  return (
    '<details class="correction-visit"><summary>Correct the recorded visit or' +
    ' follow-up type</summary><p class="hint">Use this only to correct a reco' +
    "rding error from the same visit. It amends that visit in the audit trail" +
    " without counting another inspection. New observations require a new rei" +
    "nspection.</p>\n    " +
    "".concat(
      allowed.length > 1
        ? '<label class="f"><span>Correct document type</span><select id="correctio' +
            'n-type">' +
            "".concat(
              allowed.map((t) => `<option value="${dep_esc(t.id)}" ${t.id === d.type ? "selected" : ""}>${dep_esc(t.label)}</option>`).join(""),
            ) +
            "</select></label>"
        : "",
    ) +
    "\n    " +
    "".concat(
      d.items
        .map((it) => {
          const res = r.results[it.srcItemId];
          if (!res || res.carried || it.withdrawn) return "";
          return (
            '<div class="grid g2"><label class="f"><span>Item ' +
            `${dep_esc(it.no)}` +
            ' · recorded outcome</span><select data-correction-outcome="' +
            `${dep_esc(it.id)}` +
            '">' +
            "".concat(
              dep_OUTCOMES
                .map(
                  (o) =>
                    '<option value="' +
                    `${dep_esc(o.id)}` +
                    '" ' +
                    `${((d.correction.outcomes || {})[it.id] || res.oc) === o.id ? "selected" : ""}` +
                    ">" +
                    `${dep_esc(o.label)}` +
                    "</option>",
                )
                .join(""),
            ) +
            "</select></label>" +
            "".concat(
              it.done
                ? '<label class="f"><span>Compliance date</span><input type="date" data-fie' +
                    'ld="doneOn" data-id="' +
                    `${dep_esc(it.id)}` +
                    '" value="' +
                    `${dep_esc(it.doneOn)}` +
                    '" max="' +
                    `${dep_recordDay(today)}` +
                    '"></label>'
                : "",
            ) +
            "</div>"
          );
        })
        .join(""),
    ) +
    "</details>"
  );
}

async function commitRecordAttempt(cid, attempt) {
  const key = cid + "_" + attempt.payload.docId + "_" + attempt.type.replace(/[^a-z]/gi, "");
  const holder = WriterState.RECORD_ATTEMPTS[key] || { id: null, cid, recordKey: key, pendingAmendment: attempt };
  WriterState.RECORD_ATTEMPTS[key] = holder;
  return commitAmendment(cid, holder.pendingAmendment, holder);
}

function hasSetupWork() {
  return !!WriterState.state.acc || !!String(WriterState.WORK.entry?.["lookup-number"] || "").trim();
}

function importResumePanel() {
  const acc = WriterState.state.acc || WriterState.WORK.acc;
  if (acc) {
    const c = acc.cases && acc.cases[acc.caseIx || 0],
      number = c && c.number,
      address = c && c.address;
    const detail = [number, address].filter(Boolean).join(" · ");
    const issue = acc.shareError ? "The shared record needs attention before you can confirm." : "";
    return (
      '<section class="attention-import" aria-label="Import awaiting review"><d' +
      'iv class="attention-import-copy"><span class="attention-eyebrow">Import ' +
      "awaiting review</span><strong>" +
      `${dep_esc(detail || acc.fileName || "Inspection result")}` +
      "</strong><span>" +
      `${dep_esc(issue || "Review the inspection result and confirm what to do next.")}` +
      '</span></div><button class="btn btn-primary" data-nav="import">Review im' +
      "port</button></section>"
    );
  }
  const number = String(WriterState.WORK.entry?.["lookup-number"] || "").trim();
  return number
    ? '<section class="attention-import" aria-label="Import in progress"><div c' +
        'lass="attention-import-copy"><span class="attention-eyebrow">Import in p' +
        "rogress</span><strong>Case " +
        `${dep_esc(number)}` +
        "</strong><span>Your case search is saved on this device.</span></div><bu" +
        'tton class="btn btn-primary" data-nav="import">Continue search</button><' +
        "/section>"
    : "";
}

function workingNotesPanel() {
  const forms = Object.entries(WriterState.WORK.recordForms || {}).filter(
    ([key, v]) => dep_doc(key.slice(0, key.lastIndexOf(":"))) && String(v.text || v.external || "").trim(),
  );
  if (!forms.length) return "";
  const names = { void: "withdrawal review", recordnote: "record note", reconcile: "follow-through" };
  return (
    '<div class="banner info"><div><strong>Record work in progress</strong><div class="doclinks">' +
    forms
      .map(([key]) => {
        const cut = key.lastIndexOf(":"),
          d = dep_doc(key.slice(0, cut));
        return (
          '<button class="btn" data-worknote="' +
          dep_esc(key) +
          '">Continue ' +
          dep_esc(names[key.slice(cut + 1)] || "record work") +
          " · " +
          dep_esc(dep_kase(d.caseId).number) +
          "</button>"
        );
      })
      .join("") +
    "</div></div></div>"
  );
}

function filingPanel(d) {
  if (!d || d.draft || d.void || d.superseded || d.filedAt) return "";
  if (dep_deliveredByCitation(d))
    return (
      '<div class="banner info no-print"><div><strong>Delivered within the cita' +
      "tion.</strong> This Official Notice record holds the case deadlines. It " +
      "was not mailed separately; the citation letter carried its order languag" +
      "e.</div></div>"
    );
  return (
    '<div class="banner warn no-print"><div><strong>PDF filing needed.</stron' +
    'g> The case record is issued. <button class="btn" id="btn-retryfiling">F' +
    "ile issued PDF</button> Keep any manually saved copy with the case recor" +
    "d.</div></div>"
  );
}

function needsInitialCitation(d) {
  return (
    !!d &&
    dep_isEffective(d) &&
    d.type === "notice" &&
    dep_sourceDocFor(d.caseId)?.id === d.id &&
    d.items.some((i) => i.cite && !i.withdrawn) &&
    !dep_draftDocFor(d.caseId) &&
    !dep_draftReinspFor(d.caseId) &&
    !dep_unissuedVisitFor(d.caseId) &&
    !dep_docsFor(d.caseId).some((x) => x.type === "citation" && x.fromDocId === d.id && !x.fromReinspId)
  );
}

function citationRecoveryPanel(d) {
  return needsInitialCitation(d)
    ? '<div class="banner info no-print"><div><strong>This notice has items sel' +
        'ected for citation.</strong> <button class="btn" id="btn-continuecitatio' +
        'n">Create citation draft</button></div></div>'
    : "";
}

function captureWork() {
  if (WriterState.state.screen === "reinspect" && WriterState.state.riWalk && dep_ensureWalkContext())
    WriterState.WORK.walk = {
      context: WriterState.state.riWalkContext,
      item: WriterState.state.riWalkItem,
      undo: dep_clone(WriterState.state.riWalkUndo),
      skipped: dep_clone(WriterState.state.riWalkSkipped),
      mode: WriterState.state.riWalkMode,
      stage: WriterState.state.riWalkStage,
    };
  // Input/change listeners own every edit, including an explicit clear. A finishing save must not capture a transient empty control over typed work.
  if (WriterState.state.screen === "import")
    dep_ENTRY_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && WriterState.WORK.entry[id] === undefined) WriterState.WORK.entry[id] = el.value;
    });
  WriterState.WORK.acc = WriterState.state.acc ? dep_clone(WriterState.state.acc) : null;
  if (WriterState.state.modal === "final") {
    const d = dep_doc(WriterState.state.docId),
      boxes = [...document.querySelectorAll("[data-finsend]")];
    if (d && d.draft && !d.pendingAmendment && boxes.length) {
      const list = dep_emailList(dep_kase(d.caseId)).filter((e) => String(e.addr || "").trim());
      d.emailSelection = boxes
        .filter((b) => b.checked)
        .map((b) => list[+b.dataset.finsend])
        .filter(Boolean)
        .map((e) => e.addr + "|" + (e.kind || "Other"));
    }
  }
  if (["void", "recordnote", "reconcile"].includes(WriterState.state.modal)) {
    const text = document.getElementById("record-action-text");
    /* R35: the input listener records every user edit (including clearing a field). A re-rendered dialog can briefly
       show empty fields, and saves call captureWork, so the DOM fills only fields never recorded; it never overwrites typed text. */
    if (text) {
      const key = dep_recordFormKey(),
        prev = WriterState.WORK.recordForms[key] || {},
        dom = {
          text: text.value,
          external: (document.getElementById("record-action-external") || {}).value || "",
          actor: (document.getElementById("record-action-inspector") || {}).value || "",
        };
      WriterState.WORK.recordForms[key] = Object.fromEntries(Object.keys(dom).map((f) => [f, prev[f] !== undefined ? prev[f] : dom[f]]));
    }
  }
}

export {
  citationTier,
  itemHistory,
  runFinalize,
  citationFromNotice,
  recordReinspection,
  changeText,
  correctionChanges,
  correctionEligibility,
  startCorrection,
  correctionChecks,
  correctionHistoryFault,
  makeCorrectionAttempt,
  commitAmendment,
  issueCorrection,
  voidDocument,
  addRecordNote,
  reconcileDocument,
  correctionDiffHTML,
  correctionPanel,
  recordHistoryHTML,
  revisionPrintNote,
  recordActionModal,
  correctionTypeAllowed,
  correctionVisitPatch,
  correctionVisitChecks,
  documentItemHistory,
  correctionVisitEditor,
  commitRecordAttempt,
  hasSetupWork,
  importResumePanel,
  workingNotesPanel,
  filingPanel,
  needsInitialCitation,
  citationRecoveryPanel,
  captureWork,
};
