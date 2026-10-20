import { mailingDateMessage as dep_mailingDateMessage, mailingMaxDay as dep_mailingMaxDay, recordDay as dep_recordDay } from "../assets/shared.js";
import {
  emailDocument as dep_emailDocument,
  filePdf as dep_filePdf,
  freezeSources as dep_freezeSources,
  inspAt as dep_inspAt,
  parseTime as dep_parseTime,
  printJob as dep_printJob,
  rnd12 as dep_rnd12,
  toast as dep_toast,
  validISO as dep_validISO,
} from "./court_and_deposits.js";
import {
  badIds as dep_badIds,
  caseFileFault as dep_caseFileFault,
  evid as dep_evid,
  helperJSON as dep_helperJSON,
  idb as dep_idb,
  idbGet as dep_idbGet,
  idbSet as dep_idbSet,
  project as dep_project,
  sourceDocFor as dep_sourceDocFor,
  stableJSON as dep_stableJSON,
} from "./workspace_shell.js";
import {
  caseUnsaved as dep_caseUnsaved,
  downloadFile as dep_downloadFile,
  draftBundle as dep_draftBundle,
  saveDrafts as dep_saveDrafts,
} from "./case_files.js";
import { clearWalk as dep_clearWalk, walkIdentity as dep_walkIdentity } from "./reinspection_walkthrough.js";
import {
  captureWork as dep_captureWork,
  commitAmendment as dep_commitAmendment,
  hasSetupWork as dep_hasSetupWork,
} from "./issuance_and_corrections.js";
import { compareSharedCase as dep_compareSharedCase, refreshCatalog as dep_refreshCatalog } from "./language_catalog.js";
import {
  commitCitationEdits as dep_commitCitationEdits,
  dueContext as dep_dueContext,
  dueDateSpacingConflicts as dep_dueDateSpacingConflicts,
  refreshArtifactLocations as dep_refreshArtifactLocations,
} from "./case_timeline.js";
import { cancelCaseLookup as dep_cancelCaseLookup, dueCheck as dep_dueCheck, render as dep_render } from "./inspection_import.js";
import {
  ENTRY_IDS as dep_ENTRY_IDS,
  IDB_OK as dep_IDB_OK,
  ID_OK as dep_ID_OK,
  ISSUE_EVENT as dep_ISSUE_EVENT,
  OUTCOMES as dep_OUTCOMES,
  RECOVERY_CASE_KEYS as dep_RECOVERY_CASE_KEYS,
  RECOVERY_WORKSPACE as dep_RECOVERY_WORKSPACE,
  RECOVERY_WORKSPACE_KEY as dep_RECOVERY_WORKSPACE_KEY,
  REFERRED_ONLY as dep_REFERRED_ONLY,
  SCHEMA as dep_SCHEMA,
  blockers as dep_blockers,
  citationPricing as dep_citationPricing,
  clone as dep_clone,
  deliveredByCitation as dep_deliveredByCitation,
  distinctDues as dep_distinctDues,
  doc as dep_doc,
  docCase as dep_docCase,
  docInsp as dep_docInsp,
  docsFor as dep_docsFor,
  esc as dep_esc,
  eventsFor as dep_eventsFor,
  initialCitations as dep_initialCitations,
  insp as dep_insp,
  isEffective as dep_isEffective,
  isHistoryDoc as dep_isHistoryDoc,
  kase as dep_kase,
  libraryKey as dep_libraryKey,
  navigation as dep_navigation,
  newDocuments as dep_newDocuments,
  nowISO as dep_nowISO,
  originalNotice as dep_originalNotice,
  recordFormKey as dep_recordFormKey,
  recordHead as dep_recordHead,
  recordIntegrity as dep_recordIntegrity,
  recordNow as dep_recordNow,
  reinsp as dep_reinsp,
  reinspFor as dep_reinspFor,
  snow as dep_snow,
  unchecked as dep_unchecked,
} from "./app_core.js";
import { BUILD as dep_BUILD } from "./data/build_identity.js";
import { LIBRARY as dep_LIBRARY } from "./data/library.js";
import { specialType as dep_specialType } from "./new_documents.js";
import { WriterState } from "./state.js";
/* app functions; direct dependencies use explicit shared state. */

function restoreWorkControls() {
  if (WriterState.state.screen === "import")
    dep_ENTRY_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && WriterState.WORK.entry[id] !== undefined) el.value = WriterState.WORK.entry[id];
    });
  const form = WriterState.WORK.recordForms[dep_recordFormKey()];
  if (form) {
    [
      ["record-action-text", "text"],
      ["record-action-external", "external"],
      ["record-action-inspector", "actor"],
    ].forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el && !el.disabled) el.value = form[key] || "";
    });
  }
}

async function saveAndContinue() {
  if (WriterState.state.screen === "import") dep_cancelCaseLookup();
  dep_captureWork();
  if (WriterState.draftTimer) {
    clearTimeout(WriterState.draftTimer);
    WriterState.draftTimer = null;
  }
  return dep_navigation.leave(() => {
    WriterState.state.modal = null;
    WriterState.state.picker = false;
    WriterState.state.screen = "cases";
    WriterState.state.riFilter = "";
    WriterState.DIRTY = false;
    dep_render();
    dep_toast("Work saved on this device. Continue from your workspace when ready.");
  });
}

function downloadWorkspace() {
  dep_captureWork();
  const bundle = dep_clone(dep_draftBundle());
  dep_downloadFile(
    "Madison-workspace-" + dep_recordDay(today) + ".json",
    JSON.stringify(
      { format: "madison-workspace-backup", version: 2, build: dep_BUILD, exported: dep_nowISO(), bundle, pending: dep_clone(WriterState.PENDING) },
      null,
      2,
    ),
  );
  dep_toast("Workspace backup downloaded, including unfinished work. Keep it in an approved location.");
}

function restoreWorkspaceFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    try {
      const file = input.files[0];
      if (file) await restoreWorkspaceBackup(JSON.parse(await file.text()));
    } catch (e) {
      dep_toast("Backup was not restored: " + e.message);
    }
  };
  input.click();
}

async function restoreWorkspaceBackup(value) {
  if (!value || value.format !== "madison-workspace-backup" || ![1, 2].includes(value.version) || !value.bundle)
    throw new Error("Choose a Madison workspace backup.");
  const b = value.bundle;
  if (WriterState.CASES.length || dep_hasSetupWork() || Object.values(WriterState.WORK.recordForms || {}).some((x) => x.text || x.external))
    throw new Error("Restore in an empty workspace or browser profile. Existing work has been kept; download its backup first.");
  if (!Array.isArray(b.cases) || !Array.isArray(b.docs) || !Array.isArray(b.reinsp) || !b.events || dep_badIds(b))
    throw new Error("The backup has invalid working records.");
  const numbers = new Set(),
    ids = new Set();
  b.cases.forEach((k) => {
    if (numbers.has(k.number) || ids.has(k.id)) throw new Error("Duplicate cases in the backup.");
    numbers.add(k.number);
    ids.add(k.id);
    if (WriterState.CASES.some((c) => c.id === k.id || c.number === k.number))
      throw new Error(
        "Case " +
          k.number +
          (" is already on this workspace. Its current work has been kept. Restore t" +
            "his backup in an empty browser profile, or put away that case only after" +
            " saving its work."),
      );
    const fault = dep_caseFileFault({ format: "madison-case-file", schema: dep_SCHEMA, case: k, inspectors: [], events: b.events[k.id] || [] });
    if (fault) throw new Error(fault);
  });
  b.docs.forEach((d) => {
    if (
      !d.draft ||
      !ids.has(d.caseId) ||
      !dep_ID_OK.test(d.id) ||
      !Array.isArray(d.items) ||
      d.items.some((i) => !i.id || !Array.isArray(i.sections))
    )
      throw new Error("Invalid document draft.");
  });
  b.reinsp.forEach((r) => {
    if (!r.draft || !ids.has(r.caseId) || !dep_ID_OK.test(r.id) || !r.results || typeof r.results !== "object")
      throw new Error("Invalid inspection worksheet.");
  });
  if (Object.keys(b.events).some((cid) => !ids.has(cid)) || (value.pending && !Array.isArray(value.pending)))
    throw new Error("The backup contains unrelated case records.");
  const draftIds = b.docs.map((d) => d.id),
    visitIds = b.reinsp.map((r) => r.id);
  if (new Set(draftIds).size !== draftIds.length || new Set(visitIds).size !== visitIds.length)
    throw new Error("Duplicate working paper identities.");
  for (const p of value.pending || []) {
    let file;
    try {
      file = JSON.parse(p.body);
    } catch (e) {
      throw new Error("Invalid pending case file.");
    }
    if (!ids.has(p.cid) || file.case?.id !== p.cid || dep_caseFileFault(file)) throw new Error("Invalid pending case record.");
  }
  for (const holder of Object.values(b.recordAttempts || {})) {
    if (
      !ids.has(holder.cid) ||
      !holder.pendingAmendment ||
      !["document.voided", "document.annotated", "document.reconciled", "document.served"].includes(holder.pendingAmendment.type)
    )
      throw new Error("Invalid pending record action.");
  }
  const merged = {
    ...dep_draftBundle(),
    cases: WriterState.CASES.concat(b.cases),
    docs: WriterState.DOCS.filter((d) => d.draft).concat(b.docs),
    reinsp: WriterState.REINSP.filter((r) => r.draft).concat(b.reinsp),
    events: { ...WriterState.EVENTS, ...b.events },
    recordAttempts: { ...WriterState.RECORD_ATTEMPTS, ...(b.recordAttempts || {}) },
    checkpoints: { ...WriterState.SAVE_CHECKPOINTS, ...(b.checkpoints || {}) },
    integrityRecords: b.integrityRecords || [],
    seq: Math.max(WriterState.seq, b.seq || 0),
    work: dep_clone(b.work || WriterState.WORK),
  };
  if (!(await dep_idbSet("drafts", merged))) throw new Error("This device cannot save the restored workspace. Nothing has been changed.");
  await dep_recordIntegrity.restore(merged.integrityRecords);
  WriterState.CASES = merged.cases;
  WriterState.EVENTS = merged.events;
  WriterState.DOCS = merged.docs;
  WriterState.REINSP = merged.reinsp;
  WriterState.RECORD_ATTEMPTS = merged.recordAttempts;
  WriterState.SAVE_CHECKPOINTS = merged.checkpoints;
  WriterState.WORK = merged.work;
  WriterState.WORK.entry = WriterState.WORK.entry || {};
  WriterState.WORK.recordForms = WriterState.WORK.recordForms || {};
  WriterState.state.acc = WriterState.WORK.acc || null;
  WriterState.seq = merged.seq;
  // Recoverable case snapshots remain in bundle.events even if queue storage fails.
  WriterState.PENDING = WriterState.PENDING.concat((value.pending || []).filter((p) => ids.has(p.cid)));
  await dep_idbSet("pending", WriterState.PENDING);
  dep_project();
  WriterState.state.screen = "cases";
  WriterState.state.modal = null;
  dep_render();
  await dep_saveDrafts();
  await dep_refreshArtifactLocations();
  dep_toast("Workspace restored. Unfinished work is ready to continue; nothing was issued by restoring it.");
  return true;
}

function unissuedVisitFor(cid) {
  const src = dep_sourceDocFor(cid);
  if (!src) return null;
  return (
    dep_reinspFor(cid)
      .filter((r) => !r.draft && r.sourceDocId === src.id && !dep_docsFor(cid).some((d) => !d.draft && d.fromReinspId === r.id))
      .slice(-1)[0] || null
  );
}

function worksheetFaults(r, type) {
  const src = r && dep_doc(r.sourceDocId);
  if (!r || !src) return ["The inspection source is missing. Reopen the case record."];
  const faults = [],
    initial = dep_docCase(src).date || "",
    earliest = dep_inspAt(src).date || initial;
  if (!dep_validISO(r.date) || r.date > dep_recordDay(today) || r.date < earliest)
    faults.push("Inspection date must be between the source inspection and today.");
  if (!dep_parseTime(r.time)) faults.push("Enter the reinspection time before generating a document.");
  if (!dep_insp(r.inspectorId).name) faults.push("Select the inspector who performed this inspection.");
  if (dep_unchecked(r).length) faults.push("Choose an outcome for every item.");
  dep_newDocuments
    .continuingItems(
      src,
      dep_reinspFor(r.caseId).filter((x) => x.id !== r.id),
    )
    .forEach((it) => {
      const res = r.results[it.id];
      if (!res) return;
      if (it.withdrawn) {
        if (res.oc !== "withdrawn") faults.push("Withdrawn items must remain withdrawn.");
        return;
      }
      if (it.done) {
        if (res.oc !== "corrected" || res.on !== it.doneOn || !res.carried)
          faults.push("Previously confirmed compliance must carry forward unchanged.");
        return;
      }
      if (!dep_OUTCOMES.some((o) => o.id === res.oc)) faults.push("Choose a valid inspection outcome.");
      const on = res.manualDate ? res.on : res.on || r.date;
      if (!dep_validISO(on) || on < initial || on > r.date) faults.push("Result dates must be between the initial inspection and this visit.");
      if (type && ["extension", "citation"].includes(type) && res.oc !== "corrected" && !dep_dueCheck(res.due, r.date).ok)
        faults.push("Set a future due date for each outstanding item.");
    });
  if (src.type === "compliance" || src.items.every((i) => i.withdrawn))
    faults.push("This case is completed. New observations require a new case; correct a r" + "ecording error through the document history.");
  if (["extension", "citation"].includes(type) && dep_distinctDues(dep_dueContext(r, true)).length > 3)
    faults.push("Use no more than three distinct due dates.");
  if (["extension", "citation"].includes(type) && dep_dueDateSpacingConflicts(dep_dueContext(r, true)).length)
    faults.push("Keep distinct due dates at least seven days apart.");
  return [...new Set(faults)];
}

function changeVisitDate(r, date) {
  const old = r.date;
  r.date = date;
  Object.values(r.results).forEach((res) => {
    if (!res.carried && !res.manualDate && (!res.on || res.on === old)) res.on = date;
  });
}

function cleanVisit(r) {
  const out = dep_clone(r);
  ["draft", "previousDraft", "previousWorksheet", "expectedHead", "dueWork", "followupIntent"].forEach((k) => delete out[k]);
  Object.values(out.results || {}).forEach((res) => {
    if (!res.on && !res.manualDate && !res.carried) res.on = out.date;
  });
  return out;
}

function returnToWorksheet(d) {
  const r = d && dep_reinsp(d.fromReinspId);
  if (!d || !d.draft || d.pendingAmendment || d.correction || !r || !r.draft) return false;
  r.previousDraft = dep_clone(d);
  r.previousWorksheet = cleanVisit(r);
  r.docId = null;
  WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== d.id);
  WriterState.state.reinspId = r.id;
  WriterState.state.screen = "reinspect";
  WriterState.state.modal = null;
  WriterState.DIRTY = true;
  dep_saveDrafts();
  dep_render();
  dep_toast("Inspection reopened. A copy of the previous document draft is retained below.");
  return true;
}

function restorePreviousDraft(r) {
  if (!r || !r.draft || !r.previousDraft || r.docId) return false;
  const d = dep_clone(r.previousDraft),
    snapshot = dep_clone(r.previousWorksheet);
  Object.assign(r, snapshot, { draft: true });
  delete r.previousDraft;
  delete r.previousWorksheet;
  WriterState.DOCS.unshift(d);
  r.docId = d.id;
  WriterState.state.docId = d.id;
  WriterState.state.screen = "write";
  WriterState.DIRTY = true;
  dep_saveDrafts();
  dep_render();
  return true;
}

function discardWorksheet(id) {
  const r = dep_reinsp(id);
  if (!r || !r.draft) return false;
  const d = r.docId && dep_doc(r.docId);
  if (d && d.pendingAmendment) {
    dep_toast("Confirm the pending document save before discarding this inspection.");
    return false;
  }
  if (d) {
    WriterState.state.docId = d.id;
    WriterState.state.screen = "write";
    dep_render();
    dep_toast("This inspection has a document draft. Use Review inspection from that document before discarding the worksheet.");
    return false;
  }
  WriterState.REINSP = WriterState.REINSP.filter((x) => x.id !== id);
  WriterState.state.reinspId = null;
  dep_clearWalk();
  WriterState.WORK.walk = null;
  dep_saveDrafts();
  dep_render();
  return true;
}

function lifecycleChecks(d) {
  if (d && d.initialPreview) return [];
  if (!d || !d.draft || d.correction) return [];
  if (dep_snow.is(d)) return dep_snow.lifecycle(d);
  if (dep_specialType(d.type)) return dep_newDocuments.specialLifecycle(d);
  const faults = [],
    src = d.fromDocId ? dep_doc(d.fromDocId) : null,
    r = d.fromReinspId ? dep_reinsp(d.fromReinspId) : null;
  const first = dep_originalNotice(d.caseId),
    current = dep_sourceDocFor(d.caseId),
    baseline = d.expectedHead;
  if (Array.isArray(baseline) && dep_stableJSON(baseline) !== dep_stableJSON(dep_recordHead(d.caseId)))
    faults.push("The case record changed after this draft began. Reopen the current case and review the draft before issuing.");
  if (d.type === "notice" && first) faults.push("A case can have only one original notice. Use its correction history.");
  if (d.type !== "notice" && (!src || !dep_isEffective(src) || !current || current.id !== src.id))
    faults.push("The follow-up must use the current issued document.");
  if (src && (src.type === "compliance" || src.items.every((i) => i.withdrawn)))
    faults.push("This case is completed; start a new case for new observations.");
  if (d.type !== "notice" && !r && !(d.type === "citation" && src && src.type === "notice"))
    faults.push("This follow-up needs its recorded inspection.");
  if (r) {
    faults.push(...worksheetFaults(r, d.type));
    if (r.sourceDocId !== d.fromDocId) faults.push("The document and inspection have different source documents.");
    if (d.inspDate !== r.date || (d.inspTime || "") !== (r.time || ""))
      faults.push("Review the inspection: its date/time differs from this document.");
  }
  if (src && dep_stableJSON(src.items.map((i) => String(i.no))) !== dep_stableJSON(d.items.map((i) => String(i.no))))
    faults.push("Every issued item must retain its number and order through the follow-up.");
  if (d.type !== "notice" && dep_REFERRED_ONLY.indexOf(d.type) < 0 && dep_docsFor(d.caseId).some((x) => dep_isEffective(x) && dep_isHistoryDoc(x)))
    faults.push("A referred case permits only referral updates or compliance.");
  if (d.type === "referralUpdate" && !dep_docsFor(d.caseId).some((x) => dep_isEffective(x) && dep_isHistoryDoc(x)))
    faults.push("Issue the initial referral before a referral update.");
  if (d.type === "citation") {
    const numbers = d.items
      .filter((i) => i.cite && !i.withdrawn)
      .map((i) => ((d.cits || {})[i.id] || {}).num)
      .filter(Boolean);
    if (
      new Set(numbers).size !== numbers.length ||
      dep_docsFor(d.caseId).some((x) => !x.draft && Object.values(x.cits || {}).some((c) => numbers.includes(c.num)))
    )
      faults.push("Each new citation needs a unique citation number. Corrections retain their existing number.");
    d.items
      .filter((i) => i.cite && !i.withdrawn)
      .forEach((i) => {
        const c = d.cits[i.id] || {};
        if (!dep_validISO(c.issued) || c.issued < dep_inspAt(d).date || c.issued > dep_recordDay(today))
          faults.push("Citation issue dates must be between the inspection and today.");
      });
  }
  if (dep_validISO(d.mailed) && (d.mailed < dep_inspAt(d).date || d.mailed > dep_mailingMaxDay(d.type))) faults.push(dep_mailingDateMessage(d.type));
  return [...new Set(faults)].map((t) => ({ ok: false, t }));
}

function makePublication(d) {
  const r = d.fromReinspId ? dep_reinsp(d.fromReinspId) : null;
  const base = dep_recordHead(d.caseId),
    events = [];
  let at = Date.parse(dep_recordNow(d.caseId));
  if (r && r.draft) {
    const snapshot = cleanVisit(r);
    snapshot.docId = d.id;
    events.push({
      id: dep_evid(),
      at: new Date(at++).toISOString(),
      by: r.inspectorId,
      type: "reinspection.recorded",
      payload: { reinspId: r.id, reinspection: snapshot, sourceDocId: r.sourceDocId, expectedHead: base, lifecycle: 1 },
    });
  }
  const release = dep_newDocuments.releaseVisit(d);
  if (release)
    events.push({
      id: dep_evid(),
      at: new Date(at++).toISOString(),
      by: release.inspectorId,
      type: "reinspection.recorded",
      payload: {
        reinspId: release.id,
        reinspection: release,
        sourceDocId: release.sourceDocId,
        expectedHead: base.concat(events.map((e) => e.id)).sort(),
        lifecycle: 1,
      },
    });
  const snap = dep_clone(d);
  ["draft", "pendingAmendment", "publicationEvents", "expectedHead", "publicationError", "emailSelection"].forEach((k) => delete snap[k]);
  snap.status = "Final";
  snap.authoringVersion = 11;
  delete snap.dueWork;
  delete snap.selectionCache;
  snap.frozen = dep_freezeSources(d);
  if (d.type === "notice") {
    snap.cits = {};
    delete snap.initialCitationId;
  }
  const attempt = {
    id: dep_evid(),
    at: new Date(at).toISOString(),
    by: dep_docInsp(d).id,
    type: dep_ISSUE_EVENT[d.type],
    payload: {
      docId: d.id,
      snapshot: snap,
      fromReinspId: d.fromReinspId || "",
      fromDocId: d.fromDocId || "",
      expectedHead: base.concat(events.map((e) => e.id)).sort(),
      lifecycle: 1,
    },
  };
  d.publicationEvents = events;
  return dep_initialCitations.enabled(d) ? dep_initialCitations.group(d, attempt) : attempt;
}

async function publishDocument(d) {
  if (d && dep_recordIntegrity.blocked(d.caseId)) {
    dep_toast("This record was changed outside the program. Open read-only and refer it for review.");
    return false;
  }
  if (!d || !d.draft || d.correction || WriterState.AMENDMENT_BUSY) return false;
  if (!d.pendingAmendment) dep_commitCitationEdits(d);
  if (!WriterState.CASEDIR || !WriterState.CASEDIR.helper) {
    WriterState.state.amendmentError = "Connect the current local helper and shared case folder. The document remains a draft.";
    await dep_saveDrafts();
    WriterState.state.modal = null;
    dep_render();
    return false;
  }
  if (!d.pendingAmendment && d.type === "notice" && !(await dep_refreshCatalog())) {
    WriterState.state.amendmentError = "Current catalog review status could not be checked. Draft retained; reconnect before issuing.";
    await dep_saveDrafts();
    WriterState.state.modal = null;
    dep_render();
    return false;
  }
  if (!d.pendingAmendment && (d.type === "citation" || dep_initialCitations.enabled(d))) {
    dep_initialCitations.prepare(d);
    dep_citationPricing.refresh(d);
    const before = dep_citationPricing.signature(d);
    if (!(await dep_citationPricing.loadShared(d, true))) {
      WriterState.state.amendmentError = "Shared citation history could not be checked. Reconnect before issuing.";
      await dep_saveDrafts();
      dep_render();
      return false;
    }
    if (before !== dep_citationPricing.signature(d)) {
      WriterState.state.amendmentError = "Citation history changed the deposit or tier. Review the updated charges before issuing.";
      await dep_saveDrafts();
      WriterState.state.modal = null;
      dep_render();
      return false;
    }
  }
  if (!d.pendingAmendment && dep_blockers(d).length) {
    dep_toast("Resolve the document and inspection checks before issuing.");
    return false;
  }
  const cid = d.caseId,
    id = d.id,
    wanted = dep_initialCitations.enabled(d),
    sendEmail = !!d.emailedTo && d.emailedTo.length > 0;
  const attempt = d.pendingAmendment || makePublication(d);
  WriterState.state.modal = null;
  const preparedJobs = new Map();
  if (wanted && !d.pendingAmendment) {
    try {
      for (const event of (d.publicationEvents || []).concat(attempt)) {
        const snapshot = event.payload?.snapshot;
        if (!snapshot || dep_deliveredByCitation(snapshot)) continue;
        const job = dep_printJob(snapshot);
        if (!job || !String(job.html || "").trim()) throw new Error("An initial document could not be rendered.");
        preparedJobs.set(snapshot.id, job);
      }
      const expected = (d.publicationEvents || [])
        .concat(attempt)
        .filter((e) => e.payload?.snapshot && !dep_deliveredByCitation(e.payload.snapshot)).length;
      if (preparedJobs.size !== expected || !expected) throw new Error("The initial documents must be prepared.");
    } catch (e) {
      WriterState.state.amendmentError = "The initial citation could not be prepared. Draft retained; no issuance was sent. " + e.message;
      await dep_saveDrafts();
      dep_render();
      return false;
    }
  }
  WriterState.state.publicationBusy = id;
  if (!(await dep_commitAmendment(cid, attempt, d))) {
    WriterState.state.publicationBusy = null;
    WriterState.state.modal = null;
    dep_render();
    return false;
  }
  delete WriterState.WORK.recordForms[id + ":final"];
  WriterState.state.amendmentError = "";
  WriterState.state.docId = id;
  WriterState.state.screen = "write";
  dep_render();
  const issuedDocs = [dep_doc(id)].filter((x) => !dep_deliveredByCitation(x));
  if (wanted) {
    const citation = dep_doc(attempt.payload.snapshot.id);
    if (citation && citation.type === "citation") {
      issuedDocs.push(citation);
      WriterState.state.docId = citation.id;
    }
  }
  // Both official snapshots are committed before either PDF is filed. Each filing
  // is independent and recoverable; a lost save response retries the same pair.
  try {
    for (const issued of issuedDocs) {
      try {
        const job = preparedJobs.get(issued.id) || dep_printJob(issued);
        if (!(await dep_filePdf(issued, job))) dep_toast("Document issued. Use File issued PDF to produce its copy.");
        else if (sendEmail) await dep_emailDocument(issued, dep_clone(issued.emailedTo), true, job);
      } catch (e) {
        dep_toast("Document issued; its PDF needs a retry. Use File issued PDF.");
      }
    }
    await dep_saveDrafts();
    return true;
  } finally {
    WriterState.state.publicationBusy = null;
    dep_render();
  }
}

function publicationPanel(d) {
  if (!d || !d.draft || d.correction) return "";
  const waiting = !!d.pendingAmendment;
  return (
    "" +
    "".concat(
      waiting
        ? '<div class="banner warn"><div><strong>Save confirmation needed.</strong>' +
            " Keep this draft. Retry the exact save before editing, printing or start" +
            'ing another action. <button class="btn" id="btn-retrypublish">Confirm sa' +
            "ve</button></div></div>"
        : "",
    ) +
    "" +
    "".concat(
      WriterState.state.amendmentError ? '<div class="banner alert" role="alert">' + dep_esc(WriterState.state.amendmentError) + "</div>" : "",
    ) +
    ""
  );
}

function recoveryWorkspace() {
  try {
    let id = localStorage.getItem(dep_RECOVERY_WORKSPACE_KEY);
    if (!/^[a-f0-9]{32}$/.test(id || "")) {
      id = dep_rnd12() + dep_rnd12();
      localStorage.setItem(dep_RECOVERY_WORKSPACE_KEY, id);
    }
    return id;
  } catch (e) {
    return null;
  }
}

function recoveryCaseKey(cid) {
  try {
    const map = JSON.parse(localStorage.getItem(dep_RECOVERY_CASE_KEYS) || "{}");
    if (!/^[a-f0-9]{32}$/.test(map[cid] || "")) {
      map[cid] = dep_rnd12() + dep_rnd12();
      localStorage.setItem(dep_RECOVERY_CASE_KEYS, JSON.stringify(map));
    }
    return map[cid];
  } catch (e) {
    return null;
  }
}

function recoveryIncluded(cid) {
  const ds = WriterState.DOCS.filter((d) => d.draft && d.caseId === cid),
    rs = WriterState.REINSP.filter((r) => r.draft && r.caseId === cid);
  const acts = Object.values(WriterState.RECORD_ATTEMPTS).filter((x) => x.cid === cid);
  const pending = WriterState.PENDING.filter((p) => p.cid === cid);
  const forms = Object.keys(WriterState.WORK.recordForms || {}).filter((id) =>
    WriterState.DOCS.some((d) => d.id === id.split(":")[0] && d.caseId === cid),
  );
  return [
    ...(ds.length ? [ds.length + " document draft(s)"] : []),
    ...(rs.length ? [rs.length + " worksheet(s)"] : []),
    ...(forms.length ? [forms.length + " record form(s)"] : []),
    ...(acts.length ? [acts.length + " pending correction/record action(s)"] : []),
    ...(pending.length ? [pending.length + " held shared operation(s)"] : []),
  ];
}

function recoverySnapshot(cid, key) {
  const k = dep_kase(cid),
    b = dep_draftBundle();
  return {
    format: "madison-draft-recovery",
    version: 1,
    build: dep_BUILD,
    workspace: dep_RECOVERY_WORKSPACE,
    case: key,
    number: k.number,
    at: dep_nowISO(),
    included: recoveryIncluded(cid),
    bundle: {
      integrityRecords: b.integrityRecords.filter((f) => f.case.number === k.number),
      cases: [dep_clone(k)],
      docs: dep_clone(b.docs.filter((d) => d.caseId === cid)),
      reinsp: dep_clone(b.reinsp.filter((r) => r.caseId === cid)),
      events: { [cid]: dep_clone(dep_eventsFor(cid)) },
      recordAttempts: Object.fromEntries(Object.entries(WriterState.RECORD_ATTEMPTS).filter(([, v]) => v.cid === cid)),
      checkpoints: { [cid]: dep_clone(WriterState.SAVE_CHECKPOINTS[cid] || null) },
      seq: b.seq,
      work: {
        entry: {},
        acc: null,
        walk: WriterState.WORK.walk?.context?.startsWith(cid + "|") ? dep_clone(WriterState.WORK.walk) : null,
        recordForms: Object.fromEntries(
          Object.entries(WriterState.WORK.recordForms || {}).filter(([id]) => dep_doc(id.split(":")[0])?.caseId === cid),
        ),
      },
    },
    pending: dep_clone(WriterState.PENDING.filter((p) => p.cid === cid)),
  };
}

function recoveryJobs() {
  if (!dep_RECOVERY_WORKSPACE) throw new Error("Browser workspace identity cannot be stored");
  const jobs = WriterState.CASES.filter((k) => recoveryIncluded(k.id).length).map((k) => ({ cid: k.id, key: recoveryCaseKey(k.id) }));
  if (WriterState.state.acc || WriterState.WORK.acc || String(WriterState.WORK.entry?.["lookup-number"] || "").trim())
    jobs.push({ cid: null, key: "00000000000000000000000000000000" });
  return jobs.map((job) => {
    if (!job.key) throw new Error("Case backup identity cannot be stored");
    const backup = job.cid
      ? recoverySnapshot(job.cid, job.key)
      : {
          format: "madison-draft-recovery",
          version: 1,
          build: dep_BUILD,
          workspace: dep_RECOVERY_WORKSPACE,
          case: job.key,
          number: "Import in progress",
          at: dep_nowISO(),
          included: ["saved import work"],
          bundle: {
            cases: [],
            docs: [],
            reinsp: [],
            events: {},
            recordAttempts: {},
            checkpoints: {},
            seq: WriterState.seq,
            work: dep_clone(WriterState.WORK),
          },
          pending: [],
        };
    return { workspace: dep_RECOVERY_WORKSPACE, case: job.key, backup };
  });
}

async function backupUnfinished(jobs) {
  if (!jobs.length) return;
  const errors = [];
  for (const job of jobs) {
    const signature = dep_stableJSON({ bundle: job.backup.bundle, pending: job.backup.pending, included: job.backup.included });
    const key = job.workspace + "|" + job.case;
    if (WriterState.RECOVERY_SIGNATURES[key] === signature) continue;
    try {
      await dep_helperJSON("/draft-backups/write", job);
      WriterState.RECOVERY_SIGNATURES[key] = signature;
      WriterState.RECOVERY.at = dep_nowISO();
    } catch (error) {
      errors.push((job.backup.number || job.case) + ": " + error.message);
    }
  }
  WriterState.RECOVERY.error = errors.join("; ");
}

function scheduleRecoveryBackup() {
  if (!WriterState.HELPER) return;
  clearTimeout(WriterState.RECOVERY_TIMER);
  WriterState.RECOVERY_TIMER = setTimeout(() => {
    let jobs;
    try {
      jobs = recoveryJobs();
    } catch (e) {
      WriterState.RECOVERY.error = e.message;
      renderRecoveryStatus();
      return;
    }
    WriterState.RECOVERY_NEXT = jobs; // Keep only the latest successfully saved browser state.
    if (WriterState.RECOVERY_BUSY) return;
    WriterState.RECOVERY_BUSY = true;
    (async () => {
      while (WriterState.RECOVERY_NEXT) {
        const pending = WriterState.RECOVERY_NEXT;
        WriterState.RECOVERY_NEXT = null;
        try {
          await backupUnfinished(pending);
        } catch (e) {
          WriterState.RECOVERY.error = e.message || String(e);
        }
        renderRecoveryStatus();
      }
      WriterState.RECOVERY_BUSY = false;
    })().catch((e) => {
      WriterState.RECOVERY_BUSY = false;
      WriterState.RECOVERY.error = e.message;
      renderRecoveryStatus();
    });
  }, 700);
}

function renderRecoveryStatus() {
  const el = document.getElementById("recovery-status");
  if (el) el.innerHTML = recoveryStatusHTML();
}

function recoveryStatusHTML() {
  return !WriterState.HELPER
    ? '<span class="save-error" role="status">Automatic backup unavailable. Sta' +
        'rt the local helper; device autosave is separate. <button class="lnk" da' +
        "ta-setup-health>Check connection</button></span>"
    : WriterState.RECOVERY.error
      ? '<div class="save-error" role="alert">Automatic backup needs attention. D' +
        'evice autosave is separate. <button class="lnk" data-sync-safety>Review ' +
        'saved work</button><details data-saved-detail="automatic-backup"><summar' +
        "y>Backup details</summary>" +
        `${dep_esc(WriterState.RECOVERY.error)}` +
        " · Last successful backup: " +
        `${dep_esc(WriterState.RECOVERY.at || "none")}` +
        "</details></div>"
      : WriterState.RECOVERY.at
        ? '<div>Automatic recovery copy available. <details data-saved-detail="auto' +
          'matic-backup"><summary>Backup details</summary>' +
          `${dep_esc(WriterState.RECOVERY.at)}` +
          "</details></div>"
        : "<span>Automatic backup waiting for its first save. Device autosave is separate.</span>";
}

async function listRecovery() {
  WriterState.RECOVERY.loading = true;
  WriterState.state.modal = "recovery";
  dep_render();
  try {
    WriterState.RECOVERY.list = (await dep_helperJSON("/draft-backups/list")).backups;
    WriterState.RECOVERY.error = "";
  } catch (e) {
    WriterState.RECOVERY.error = e.message;
    WriterState.RECOVERY.list = [];
  }
  WriterState.RECOVERY.loading = false;
  dep_render();
}

async function selectRecovery(row) {
  const token = ++WriterState.RECOVERY_SELECT_SEQ;
  WriterState.RECOVERY.selected = null;
  WriterState.RECOVERY.shared = null;
  dep_render();
  const result = row.imported
    ? { backup: row.imported }
    : await dep_helperJSON("/draft-backups/read", { workspace: row.workspace, case: row.case, name: row.name });
  if (WriterState.state.modal !== "recovery" || WriterState.RECOVERY_SELECT_SEQ !== token) return;
  const backup = result.backup;
  validateRecovery(backup, row);
  const shared = await recoverySharedState(backup);
  if (WriterState.state.modal !== "recovery" || WriterState.RECOVERY_SELECT_SEQ !== token) return;
  WriterState.RECOVERY.selected = backup;
  WriterState.RECOVERY.shared = shared;
  dep_render();
}

async function recoverySharedState(backup) {
  const k = backup.bundle.cases[0];
  if (!k) return "Import recovery has no shared case record.";
  try {
    const opened = await dep_helperJSON("/cases/resolve?number=" + encodeURIComponent(k.number));
    const sf = opened.file,
      fault = dep_caseFileFault(sf);
    if (fault) return { kind: "invalid", detail: "Shared record unreadable: " + fault };
    return dep_compareSharedCase(k, backup.bundle.events[k.id] || [], sf, backup.bundle.checkpoints?.[k.id], true);
  } catch (e) {
    return {
      kind: e.name === "NotFoundError" ? "missing" : e.definitive ? "invalid" : "unavailable",
      detail:
        e.name === "NotFoundError" ? "No shared case record exists yet." : "Shared record unavailable; publication will recheck it. " + e.message,
    };
  }
}

function recoverySharedConflict(value) {
  return ["invalid", "history-conflict", "conflict", "shared-history"].includes(value?.kind);
}

function validateRecovery(b, row) {
  if (
    !b ||
    b.format !== "madison-draft-recovery" ||
    b.version !== 1 ||
    b.workspace !== row.workspace ||
    b.case !== row.case ||
    !b.bundle ||
    !Array.isArray(b.bundle.cases) ||
    !Array.isArray(b.bundle.docs) ||
    !Array.isArray(b.bundle.reinsp) ||
    !b.bundle.events ||
    !b.bundle.work ||
    typeof b.bundle.work.recordForms !== "object" ||
    !b.bundle.work.recordForms ||
    !Array.isArray(b.pending) ||
    b.bundle.cases.length > 1 ||
    dep_badIds(b.bundle)
  )
    throw new Error("Invalid or unsupported recovery backup");
  const k = b.bundle.cases[0],
    cid = k?.id;
  if (k) {
    if (
      k.number !== b.number ||
      dep_caseFileFault({ format: "madison-case-file", schema: dep_SCHEMA, case: k, inspectors: [], events: b.bundle.events[cid] || [] })
    )
      throw new Error("Invalid backed-up case history");
  }
  if (
    b.bundle.docs.some((d) => !d.draft || d.caseId !== cid || !Array.isArray(d.items)) ||
    b.bundle.reinsp.some((r) => !r.draft || r.caseId !== cid || !r.results) ||
    Object.keys(b.bundle.events).some((id) => id !== cid) ||
    Object.values(b.bundle.recordAttempts || {}).some((x) => x.cid !== cid) ||
    b.pending.some(
      (p) =>
        p.cid !== cid ||
        (() => {
          try {
            const file = JSON.parse(p.body);
            return dep_caseFileFault(file) || file.case.id !== cid || file.case.number !== k.number;
          } catch (e) {
            return true;
          }
        })(),
    )
  )
    throw new Error("Backup contains unrelated or invalid work");
  const docs = new Map(b.bundle.docs.map((d) => [d.id, d]));
  if (
    k &&
    (b.bundle.reinsp.some((r) => {
      const source = (b.bundle.events[cid] || []).find((e) => e.payload?.snapshot?.id === r.sourceDocId)?.payload.snapshot;
      return !source || source.caseId !== cid || Object.keys(r.results).some((id) => !source.items.some((it) => it.id === id));
    }) ||
      Object.keys(b.bundle.work.recordForms).some((id) => {
        const docId = id.split(":")[0];
        return !docs.has(docId) && !(b.bundle.events[cid] || []).some((e) => e.payload?.snapshot?.id === docId);
      }) ||
      (b.bundle.work.walk &&
        (!b.bundle.reinsp.some((r) => r.draft && dep_walkIdentity(r) === b.bundle.work.walk.context) ||
          !b.bundle.reinsp.some(
            (r) =>
              r.id === b.bundle.work.walk.context.split("|")[1] &&
              (b.bundle.events[cid] || []).some(
                (e) => e.payload?.snapshot?.id === r.sourceDocId && e.payload.snapshot.items.some((it) => it.id === b.bundle.work.walk.item),
              ),
          ))))
  )
    throw new Error("Backup has inconsistent document or walk-through references");
  return true;
}

async function persistRecoveryState(staged, pending) {
  if (dep_IDB_OK) {
    try {
      const db = await dep_idb();
      return await new Promise((resolve) => {
        const tx = db.transaction("kv", "readwrite"),
          store = tx.objectStore("kv");
        store.put(pending, "pending");
        store.put(staged, "drafts");
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      });
    } catch (e) {
      return false;
    }
  }
  // The synthetic harness has no IndexedDB and exercises failure/rollback with idbSet.
  const oldPending = await dep_idbGet("pending"),
    oldDrafts = await dep_idbGet("drafts");
  if (!(await dep_idbSet("pending", pending))) return false;
  if (await dep_idbSet("drafts", staged)) return true;
  if (!(await dep_idbSet("pending", oldPending || [])) || !(await dep_idbSet("drafts", oldDrafts || dep_draftBundle())))
    throw new Error("Browser storage rollback failed. Keep this tab open and export the workspace.");
  return false;
}

async function restoreRecovery() {
  const b = WriterState.RECOVERY.selected;
  if (!b) return;
  const selection = WriterState.RECOVERY_SELECT_SEQ;
  const row = WriterState.RECOVERY.list.find((x) => x.workspace === b.workspace && x.case === b.case && x.number === b.number);
  if (!row) {
    dep_toast("Select a backup again.");
    return;
  }
  try {
    validateRecovery(b, row);
    const currentShared = await recoverySharedState(b);
    if (selection !== WriterState.RECOVERY_SELECT_SEQ || WriterState.RECOVERY.selected !== b || WriterState.state.modal !== "recovery") return;
    WriterState.RECOVERY.shared = currentShared;
    if (recoverySharedConflict(currentShared))
      throw new Error("Review the changed shared record before restoring this draft. Export the backup first.");
    const k = b.bundle.cases[0];
    if (!k) {
      if (dep_hasSetupWork()) throw new Error("Import recovery needs an empty import form.");
      const staged = { ...dep_draftBundle(), work: dep_clone(b.bundle.work) };
      if (!(await dep_idbSet("drafts", staged))) throw new Error("Browser storage could not save the imported work.");
      WriterState.WORK = staged.work;
      WriterState.state.acc = WriterState.WORK.acc || null;
      WriterState.state.modal = null;
      WriterState.state.screen = "import";
      dep_render();
      return;
    }
    const current = WriterState.CASES.find((c) => c.id === k.id || c.number === k.number);
    if (current && (current.id !== k.id || current.number !== k.number)) throw new Error("The case number or identity conflicts with local work.");
    if (current) {
      const backed = new Map((b.bundle.events[k.id] || []).map((e) => [e.id, e]));
      if (dep_eventsFor(k.id).some((e) => !backed.has(e.id) || dep_stableJSON(e) !== dep_stableJSON(backed.get(e.id))) || current.id !== k.id)
        throw new Error("The local case has different issued history. Export both copies and reconcile before restoring.");
    }
    const local = current && dep_caseUnsaved(current);
    if (current) {
      const same =
        dep_stableJSON(WriterState.DOCS.filter((d) => d.draft && d.caseId === k.id)) === dep_stableJSON(b.bundle.docs) &&
        dep_stableJSON(WriterState.REINSP.filter((r) => r.draft && r.caseId === k.id)) === dep_stableJSON(b.bundle.reinsp) &&
        dep_stableJSON(WriterState.PENDING.filter((p) => p.cid === k.id)) === dep_stableJSON(b.pending) &&
        dep_stableJSON(
          Object.fromEntries(Object.entries(WriterState.WORK.recordForms || {}).filter(([id]) => dep_doc(id.split(":")[0])?.caseId === k.id)),
        ) === dep_stableJSON(b.bundle.work.recordForms) &&
        dep_stableJSON(WriterState.WORK.walk?.context?.startsWith(k.id + "|") ? WriterState.WORK.walk : null) ===
          dep_stableJSON(b.bundle.work.walk || null);
      if (!same) {
        const copy = recoverySnapshot(k.id, recoveryCaseKey(k.id));
        copy.preReplacement = true;
        await dep_helperJSON("/draft-backups/write", { workspace: dep_RECOVERY_WORKSPACE, case: copy.case, backup: copy });
        if (selection !== WriterState.RECOVERY_SELECT_SEQ || WriterState.RECOVERY.selected !== b || WriterState.state.modal !== "recovery") return;
        if (
          !confirm(
            "Local work differs (" +
              (local || "existing case") +
              "). A recovery copy was saved first. Replace this case with the selected backup from " +
              b.at +
              "?",
          )
        )
          return;
      }
    }
    const staged = {
      ...dep_draftBundle(),
      cases: WriterState.CASES.filter((c) => c.id !== k.id).concat([dep_clone(k)]),
      docs: WriterState.DOCS.filter((d) => d.draft && d.caseId !== k.id).concat(dep_clone(b.bundle.docs)),
      reinsp: WriterState.REINSP.filter((r) => r.draft && r.caseId !== k.id).concat(dep_clone(b.bundle.reinsp)),
      events: { ...WriterState.EVENTS, [k.id]: dep_clone(b.bundle.events[k.id] || []) },
      recordAttempts: {
        ...Object.fromEntries(Object.entries(WriterState.RECORD_ATTEMPTS).filter(([, x]) => x.cid !== k.id)),
        ...dep_clone(b.bundle.recordAttempts || {}),
      },
      checkpoints: { ...WriterState.SAVE_CHECKPOINTS, [k.id]: dep_clone(b.bundle.checkpoints?.[k.id] || null) },
      seq: Math.max(WriterState.seq, b.bundle.seq || 0),
      work: {
        ...dep_clone(WriterState.WORK),
        walk: b.bundle.work.walk
          ? dep_clone(b.bundle.work.walk)
          : WriterState.WORK.walk?.context?.startsWith(k.id + "|")
            ? null
            : WriterState.WORK.walk,
        recordForms: {
          ...Object.fromEntries(Object.entries(WriterState.WORK.recordForms || {}).filter(([id]) => dep_doc(id.split(":")[0])?.caseId !== k.id)),
          ...dep_clone(b.bundle.work.recordForms),
        },
      },
    };
    const pending = WriterState.PENDING.filter((p) => p.cid !== k.id).concat(dep_clone(b.pending));
    if (!(await persistRecoveryState(staged, pending))) throw new Error("Browser storage could not commit the recovery; previous work was retained.");
    WriterState.CASES = staged.cases;
    WriterState.DOCS = staged.docs;
    WriterState.REINSP = staged.reinsp;
    WriterState.EVENTS = staged.events;
    WriterState.RECORD_ATTEMPTS = staged.recordAttempts;
    WriterState.SAVE_CHECKPOINTS = staged.checkpoints;
    WriterState.PENDING = pending;
    WriterState.WORK = staged.work;
    WriterState.seq = staged.seq;
    dep_clearWalk();
    dep_project();
    WriterState.state.modal = null;
    WriterState.state.screen = "cases";
    dep_render();
    await dep_refreshArtifactLocations();
    dep_toast("Recovered " + k.number + " as unfinished work. No document was issued.");
  } catch (e) {
    dep_toast("Recovery kept the current workspace: " + e.message);
  }
}

function recoveryModal() {
  const b = WriterState.RECOVERY.selected,
    k = b?.bundle?.cases?.[0],
    local = k && WriterState.CASES.find((c) => c.id === k.id || c.number === k.number);
  return (
    '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
    '" aria-label="Recover unfinished work">\n    <div class="modal-h"><h2>Rec' +
    'over unfinished work</h2></div><div class="modal-b">\n      <p>Backups ar' +
    "e separate from issued case files. Select one case. Nothing is issued du" +
    "ring recovery.</p>\n      <label>Import an exported individual recovery J" +
    'SON <input id="recovery-import" type="file" accept=".json,application/js' +
    'on"></label>\n      ' +
    "".concat(WriterState.RECOVERY.error ? `<div class="banner alert" role="alert">${dep_esc(WriterState.RECOVERY.error)}</div>` : "") +
    "\n      " +
    "".concat(
      WriterState.RECOVERY.loading
        ? "Reading backups…"
        : '<div class="folderlist">' +
            "".concat(
              WriterState.RECOVERY.list
                .map(
                  (x, i) =>
                    '<button data-recovery-row="' +
                    `${i}` +
                    '" ' +
                    `${x.error ? "disabled" : ""}` +
                    ">" +
                    `${dep_esc(x.number || "Unknown case")}` +
                    " · " +
                    `${dep_esc(x.at || x.name)}` +
                    " · " +
                    `${dep_esc((x.included || []).join(", ") || x.error || "No listed drafts")}` +
                    " · workspace " +
                    `${dep_esc(x.workspace.slice(0, 8))}` +
                    "</button>",
                )
                .join("") || "No backups found.",
            ) +
            "</div>",
    ) +
    "\n      " +
    "".concat(
      b
        ? '<div class="banner info"><strong>' +
            `${dep_esc(b.number)}` +
            " · " +
            `${dep_esc(b.at)}` +
            "</strong><p>Included: " +
            `${dep_esc(b.included.join(", ") || "import work")}` +
            ". Local: " +
            `${dep_esc(local ? dep_caseUnsaved(local) || "case present, no unfinished work" : "case absent")}` +
            ". Shared: " +
            `${dep_esc(WriterState.RECOVERY.shared?.detail || "Checking shared record…")}` +
            "</p>\n        " +
            "".concat(
              WriterState.RECOVERY.shared?.fields?.length
                ? "<table><thead><tr><th>Field</th><th>Backup</th><th>Shared</th></tr></the" +
                    "ad><tbody>" +
                    "".concat(
                      WriterState.RECOVERY.shared.fields
                        .map((f) =>
                          "".concat(
                            "<tr><td>",
                            dep_esc(f.field),
                            "</td><td>",
                            dep_esc(JSON.stringify(f.local) ?? "(absent)"),
                            "</td><td>",
                            dep_esc(JSON.stringify(f.shared) ?? "(absent)"),
                            "</td></tr>",
                          ),
                        )
                        .join(""),
                    ) +
                    "</tbody></table>"
                : "",
            ) +
            "\n        </div>"
        : "",
    ) +
    '\n      </div><div class="modal-f">' +
    "".concat(
      b
        ? '<button class="btn btn-primary" data-recovery-restore ' +
            `${recoverySharedConflict(WriterState.RECOVERY.shared) ? "disabled" : ""}` +
            '>Restore selected case</button><button class="btn" data-recovery-export>' +
            "Export selected backup</button>" +
            `${k ? `<button class="btn" data-recovery-shared>Open current shared case</button>` : ""}` +
            ""
        : "",
    ) +
    '<button class="btn" data-sync-safety>Saved work &amp; connection</button' +
    '><button class="btn" data-close="modal">Close</button></div></div></div>'
  );
}

function keepCatalogForms() {
  try {
    localStorage.setItem("madison-catalog-forms-v1", JSON.stringify(WriterState.CATALOG_FORMS));
  } catch (e) {
    WriterState.CATALOG_ERROR = "Review form could not be stored on this device.";
  }
}

function catalogKey(i) {
  return dep_libraryKey({ c: dep_LIBRARY[i.ci].code, g: dep_LIBRARY[i.ci].groups[i.gi].code, o: i.o });
}

export {
  restoreWorkControls,
  saveAndContinue,
  downloadWorkspace,
  restoreWorkspaceFile,
  restoreWorkspaceBackup,
  unissuedVisitFor,
  worksheetFaults,
  changeVisitDate,
  cleanVisit,
  returnToWorksheet,
  restorePreviousDraft,
  discardWorksheet,
  lifecycleChecks,
  makePublication,
  publishDocument,
  publicationPanel,
  recoveryWorkspace,
  recoveryCaseKey,
  recoveryIncluded,
  recoverySnapshot,
  recoveryJobs,
  backupUnfinished,
  scheduleRecoveryBackup,
  renderRecoveryStatus,
  recoveryStatusHTML,
  listRecovery,
  selectRecovery,
  recoverySharedState,
  recoverySharedConflict,
  validateRecovery,
  persistRecoveryState,
  restoreRecovery,
  recoveryModal,
  keepCatalogForms,
  catalogKey,
};
