import { inspectionIdentity } from "./inspection_facts.js";
import { recordDay } from "../assets/shared.js";
import { caseDetails, stableJSON } from "./record_values.js";
import { restoreCaseFolder, sourceDocFor } from "./workspace_shell.js";
import { caseFileName } from "./case_file_rules.js";
import {
  toast,
  initWriterHandoff,
  markWriterReady,
  markWriterFailed,
  refreshArtifactLocations,
  clearWalk,
  restoreWalkFor,
  refreshCatalog,
  newDocuments,
  recordIntegrity,
  snow,
  uid,
  saveDrafts,
  restoreDrafts,
  restorePending,
  flushPending,
  checkHelper,
  scheduleRecoveryBackup,
  unissuedVisitFor,
} from "./app_core.js";

import { render } from "./app_screens.js";

import { doc, docsFor, draftDocFor, draftReinspFor, eventsFor, kase, recordHead, reinsp } from "./writer_queries.js";

import { WriterState } from "./state.js";

/* app functions; direct dependencies use explicit shared state. */

async function discardDraft(id) {
  const d = doc(id);
  if (d && d.pendingAmendment) {
    toast("Retry the pending save before discarding this correction.");
    return false;
  }
  WriterState.DOCS = WriterState.DOCS.filter((d) => !(d.draft && d.id === id));
  WriterState.REINSP = WriterState.REINSP.filter((r) => !(r.draft && r.id === id));
  if (WriterState.state.reinspId === id) {
    clearWalk();
    WriterState.WORK.walk = null;
  }
  // a worksheet still pointing at the discarded follow-up reads as finished
  // and will not write another one
  WriterState.REINSP.forEach((r) => {
    if (r.draft && r.docId === id) r.docId = null;
  });
  await saveDrafts();
  render();
}

async function bootStorage() {
  try {
    if (navigator.locks && navigator.locks.request) {
      WriterState.WRITER_ACCESS = false;
      const acquired = await new Promise((resolve) =>
        navigator.locks
          .request("madison-writer-workspace", { ifAvailable: true }, (lock) => {
            if (!lock) {
              resolve(false);
              return;
            }
            resolve(true);
            return new Promise((release) => {
              WriterState.releaseWorkspaceLock = release;
            }); // held until this tab closes or Writer stops
          })
          .catch(() => resolve(false)),
      );
      if (!acquired) {
        WriterState.STARTUP_STATUS = "locked";
        WriterState.releaseWriterReady(false);
        document.getElementById("app").innerHTML =
          '<main style="max-width:620px;margin:12vh auto;padding:28px;font-family:s' +
          'ystem-ui"><h1>Document Writer is already open</h1><p>Continue in your ex' +
          "isting Writer tab. To use this tab, close the other Writer tab and reloa" +
          "d this page.</p><button data-reload-tab>Reload this tab</button> <a href" +
          '="madison-reports.html">Open Reports</a></main>';
        document.querySelector("[data-reload-tab]").addEventListener("click", () => location.reload());
        return;
      }
    }
    WriterState.WRITER_ACCESS = true;
    initWriterHandoff();
    await checkHelper();
    if (WriterState.HELPER) await refreshCatalog();
    await restoreCaseFolder();
    await restorePending();
    await restoreDrafts();
    // Internal pending-write recovery may save only after every retained draft has been read.
    WriterState.WORKSPACE_RESTORED = true;
    await recordIntegrity.refresh();
    await refreshArtifactLocations();
    await flushPending();
    markWriterReady();
    if (WriterState.HELPER) scheduleRecoveryBackup();
  } catch (error) {
    markWriterFailed(error);
  }
}

function caseUnsaved(k) {
  if (Object.values(WriterState.RECORD_ATTEMPTS).some((x) => x.cid === k.id)) return "record change awaiting save confirmation";
  if (WriterState.PENDING.some((p) => p.cid === k.id || (!!caseFileName(k) && p.name === caseFileName(k))))
    return "case file waiting to reach the share";
  const evs = eventsFor(k.id);
  const drafts = WriterState.DOCS.some((d) => d.draft && d.caseId === k.id) || WriterState.REINSP.some((r) => r.draft && r.caseId === k.id);
  if (drafts) return "unfinished drafts";
  if (!evs.length && !WriterState.SAVE_CHECKPOINTS[k.id]) return "case details saved only on this device";
  if (!k.savedAt) return "issued documents never written to the share";
  const checkpoint = WriterState.SAVE_CHECKPOINTS[k.id];
  if (checkpoint) {
    const known = new Set(checkpoint.events || []);
    return evs.some((e) => !known.has(e.id)) || stableJSON(caseDetails(k)) !== stableJSON(caseDetails(checkpoint.case))
      ? "changes made since the last save"
      : "";
  }
  const newest =
    evs
      .map((e) => e.at)
      .sort()
      .slice(-1)[0] || "";
  return newest > k.savedAt ? "changes made since the last save" : "";
}

function removeCase(cid) {
  if (Object.values(WriterState.RECORD_ATTEMPTS).some((x) => x.cid === cid) || docsFor(cid).some((x) => x.pendingAmendment)) {
    toast("Confirm pending record saves before removing this case from this workspace.");
    return false;
  }
  WriterState.CASES = WriterState.CASES.filter((c) => c.id !== cid);
  WriterState.DOCS = WriterState.DOCS.filter((d) => d.caseId !== cid);
  WriterState.REINSP = WriterState.REINSP.filter((r) => r.caseId !== cid);
  if (reinsp(WriterState.state.reinspId)?.caseId === cid) {
    clearWalk();
    WriterState.WORK.walk = null;
  }
  delete WriterState.EVENTS[cid];
  if (WriterState.state.docId && !doc(WriterState.state.docId)) WriterState.state.docId = null;
  saveDrafts();
}

function clearCases(which) {
  const gone = [];
  WriterState.CASES.slice().forEach((k) => {
    const risky = caseUnsaved(k);
    if (which === "safe" && risky) return;
    if (removeCase(k.id) !== false) gone.push(k.number);
  });
  WriterState.state.modal = null;
  WriterState.state.screen = "cases";
  render();
  toast(
    gone.length
      ? gone.length + " case" + (gone.length === 1 ? "" : "s") + " removed from this workspace. Shared case records are not deleted."
      : "Nothing to remove",
  );
}

function startReinspection(cid, importedRow) {
  if (snow.isCase(kase(cid))) {
    toast("Snow cases cite each inspection directly; import the next snow inspection instead of creating a reinspection.");
    return;
  }
  if (recordIntegrity.blocked(cid)) {
    toast("This record was changed outside the program. Read-only.");
    return;
  }
  clearWalk();
  const correction = draftDocFor(cid);
  if (correction && correction.correction) {
    WriterState.state.docId = correction.id;
    WriterState.state.screen = "write";
    render();
    toast("Finish or discard the correction before starting another inspection");
    return;
  }
  const unfinished = draftDocFor(cid);
  if (unfinished) {
    WriterState.state.docId = unfinished.id;
    WriterState.state.screen = "write";
    render();
    toast("Continue the unfinished document first.");
    return;
  }
  const open = draftReinspFor(cid) || unissuedVisitFor(cid);
  if (open) {
    if (importedRow) {
      const oldDate = open.date;
      open.date = importedRow.date;
      open.time = importedRow.time || "";
      open.inspectorId = importedRow.inspectorId || open.inspectorId;
      open.importInspection = inspectionIdentity(importedRow);
      Object.values(open.results || {}).forEach((res) => {
        if (!res.carried && !res.manualDate && (!res.on || res.on === oldDate)) res.on = open.date;
      });
    }
    WriterState.state.reinspId = open.id;
    WriterState.state.screen = "reinspect";
    restoreWalkFor(open);
    render();
    return;
  }
  const src = sourceDocFor(cid);
  if (!src || !src.items.length) {
    toast("Finish and issue the notice first — a reinspection works off the document the owner received");
    return;
  }
  if (src.type === "compliance" || src.items.every((i) => i.withdrawn)) {
    toast("This case is completed. Use a new case for new observations or correct a" + " recording error from the document history.");
    return;
  }
  const k = kase(cid);
  const r = {
    expectedHead: recordHead(cid),
    id: uid("r"),
    caseId: cid,
    sourceDocId: src.id,
    date: (importedRow && importedRow.date) || recordDay(today),
    time: (importedRow && importedRow.time) || "",
    draft: true,
    inspectorId: (importedRow && importedRow.inspectorId) || k.inspectorId,
    results: {},
    docId: null,
    ...(importedRow ? { importInspection: inspectionIdentity(importedRow) } : {}),
  };
  newDocuments.continuingItems(src).forEach((it) => {
    if (it.done || it.withdrawn)
      r.results[it.id] = { oc: it.withdrawn ? "withdrawn" : "corrected", on: it.doneOn || "", due: "", note: "", cite: false, carried: true };
  });
  WriterState.WORK.walk = null;
  WriterState.REINSP.push(r);
  WriterState.state.reinspId = r.id;
  WriterState.state.screen = "reinspect";
  WriterState.DIRTY = true;
  saveDrafts();
  render();
}

export { discardDraft, bootStorage, caseUnsaved, removeCase, clearCases, startReinspection };
