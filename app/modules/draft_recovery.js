import { recoverySharedConflict } from "./case_recovery.js";
import { recordDay } from "../assets/shared.js";
import { dueContext, dueDateSpacingConflicts } from "./deadline_assignment.js";
import { inspAt } from "./inspection_facts.js";
import { toast } from "./court_and_deposits.js";
import { sourceDocFor } from "./workspace_shell.js";
import { clone } from "./record_values.js";
import { caseUnsaved } from "./case_files.js";
import {
  clearWalk,
  dueCheck,
  cancelCaseLookup,
  ENTRY_IDS,
  navigation,
  newDocuments,
  recordFormKey,
  restoreWorkspaceBackup,
  saveDrafts,
} from "./app_core.js";
import { render } from "./app_screens.js";
import { captureWork } from "./issuance_and_corrections.js";

import { OUTCOMES } from "./document_types.js";

import { doc, docCase, docsFor, insp, reinsp, reinspFor, unchecked } from "./writer_queries.js";

import { distinctDues, libraryKey } from "./document_rules.js";
import { esc } from "./presentation_format.js";
import { parseTime, validISO } from "./calendar.js";
import { LIBRARY } from "./data/library.js";

import { WriterState } from "./state.js";
/* app functions; direct dependencies use explicit shared state. */

function restoreWorkControls() {
  if (WriterState.state.screen === "import")
    ENTRY_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && WriterState.WORK.entry[id] !== undefined) el.value = WriterState.WORK.entry[id];
    });
  const form = WriterState.WORK.recordForms[recordFormKey()];
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
  if (WriterState.state.screen === "import") cancelCaseLookup();
  captureWork();
  if (WriterState.draftTimer) {
    clearTimeout(WriterState.draftTimer);
    WriterState.draftTimer = null;
  }
  return navigation.leave(() => {
    WriterState.state.modal = null;
    WriterState.state.picker = false;
    WriterState.state.screen = "cases";
    WriterState.state.riFilter = "";
    WriterState.DIRTY = false;
    render();
    toast("Work saved on this device. Continue from your workspace when ready.");
  });
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
      toast("Backup was not restored: " + e.message);
    }
  };
  input.click();
}

function unissuedVisitFor(cid) {
  const src = sourceDocFor(cid);
  if (!src) return null;
  return (
    reinspFor(cid)
      .filter((r) => !r.draft && r.sourceDocId === src.id && !docsFor(cid).some((d) => !d.draft && d.fromReinspId === r.id))
      .slice(-1)[0] || null
  );
}

function worksheetFaults(r, type) {
  const src = r && doc(r.sourceDocId);
  if (!r || !src) return ["The inspection source is missing. Reopen the case record."];
  const faults = [],
    initial = docCase(src).date || "",
    earliest = inspAt(src).date || initial;
  if (!validISO(r.date) || r.date > recordDay(today) || r.date < earliest)
    faults.push("Inspection date must be between the source inspection and today.");
  if (!parseTime(r.time)) faults.push("Enter the reinspection time before generating a document.");
  if (!insp(r.inspectorId).name) faults.push("Select the inspector who performed this inspection.");
  if (unchecked(r).length) faults.push("Choose an outcome for every item.");
  newDocuments
    .continuingItems(
      src,
      reinspFor(r.caseId).filter((x) => x.id !== r.id),
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
      if (!OUTCOMES.some((o) => o.id === res.oc)) faults.push("Choose a valid inspection outcome.");
      const on = res.manualDate ? res.on : res.on || r.date;
      if (!validISO(on) || on < initial || on > r.date) faults.push("Result dates must be between the initial inspection and this visit.");
      // R62: a Best Interest Extension takes its due dates from the worksheet, as a normal Extension does.
      if (type && ["extension", "bestInterestExtension", "citation"].includes(type) && res.oc !== "corrected" && !dueCheck(res.due, r.date).ok)
        faults.push("Set a future due date for each outstanding item.");
    });
  if (src.type === "compliance" || src.items.every((i) => i.withdrawn))
    faults.push("This case is completed. New observations require a new case; correct a r" + "ecording error through the document history.");
  if (["extension", "bestInterestExtension", "citation"].includes(type) && distinctDues(dueContext(r, true)).length > 3)
    faults.push("Use no more than three distinct due dates.");
  if (["extension", "bestInterestExtension", "citation"].includes(type) && dueDateSpacingConflicts(dueContext(r, true)).length)
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
  const out = clone(r);
  ["draft", "previousDraft", "previousWorksheet", "expectedHead", "dueWork", "followupIntent"].forEach((k) => delete out[k]);
  Object.values(out.results || {}).forEach((res) => {
    if (!res.on && !res.manualDate && !res.carried) res.on = out.date;
  });
  return out;
}

function returnToWorksheet(d) {
  const r = d && reinsp(d.fromReinspId);
  if (!d || !d.draft || d.pendingAmendment || d.correction || !r || !r.draft) return false;
  r.previousDraft = clone(d);
  r.previousWorksheet = cleanVisit(r);
  r.docId = null;
  WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== d.id);
  WriterState.state.reinspId = r.id;
  WriterState.state.screen = "reinspect";
  WriterState.state.modal = null;
  WriterState.DIRTY = true;
  saveDrafts();
  render();
  toast("Inspection reopened. A copy of the previous document draft is retained below.");
  return true;
}

function restorePreviousDraft(r) {
  if (!r || !r.draft || !r.previousDraft || r.docId) return false;
  const d = clone(r.previousDraft),
    snapshot = clone(r.previousWorksheet);
  Object.assign(r, snapshot, { draft: true });
  delete r.previousDraft;
  delete r.previousWorksheet;
  WriterState.DOCS.unshift(d);
  r.docId = d.id;
  WriterState.state.docId = d.id;
  WriterState.state.screen = "write";
  WriterState.DIRTY = true;
  saveDrafts();
  render();
  return true;
}

function discardWorksheet(id) {
  const r = reinsp(id);
  if (!r || !r.draft) return false;
  const d = r.docId && doc(r.docId);
  if (d && d.pendingAmendment) {
    toast("Confirm the pending document save before discarding this inspection.");
    return false;
  }
  if (d) {
    WriterState.state.docId = d.id;
    WriterState.state.screen = "write";
    render();
    toast("This inspection has a document draft. Use Review inspection from that document before discarding the worksheet.");
    return false;
  }
  WriterState.REINSP = WriterState.REINSP.filter((x) => x.id !== id);
  WriterState.state.reinspId = null;
  clearWalk();
  WriterState.WORK.walk = null;
  saveDrafts();
  render();
  return true;
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
        `${esc(WriterState.RECOVERY.error)}` +
        " · Last successful backup: " +
        `${esc(WriterState.RECOVERY.at || "none")}` +
        "</details></div>"
      : WriterState.RECOVERY.at
        ? '<div>Automatic recovery copy available. <details data-saved-detail="auto' +
          'matic-backup"><summary>Backup details</summary>' +
          `${esc(WriterState.RECOVERY.at)}` +
          "</details></div>"
        : "<span>Automatic backup waiting for its first save. Device autosave is separate.</span>";
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
    "".concat(WriterState.RECOVERY.error ? `<div class="banner alert" role="alert">${esc(WriterState.RECOVERY.error)}</div>` : "") +
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
                    `${esc(x.number || "Unknown case")}` +
                    " · " +
                    `${esc(x.at || x.name)}` +
                    " · " +
                    `${esc((x.included || []).join(", ") || x.error || "No listed drafts")}` +
                    " · workspace " +
                    `${esc(x.workspace.slice(0, 8))}` +
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
            `${esc(b.number)}` +
            " · " +
            `${esc(b.at)}` +
            "</strong><p>Included: " +
            `${esc(b.included.join(", ") || "import work")}` +
            ". Local: " +
            `${esc(local ? caseUnsaved(local) || "case present, no unfinished work" : "case absent")}` +
            ". Shared: " +
            `${esc(WriterState.RECOVERY.shared?.detail || "Checking shared record…")}` +
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
                            esc(f.field),
                            "</td><td>",
                            esc(JSON.stringify(f.local) ?? "(absent)"),
                            "</td><td>",
                            esc(JSON.stringify(f.shared) ?? "(absent)"),
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
  return libraryKey({ c: LIBRARY[i.ci].code, g: LIBRARY[i.ci].groups[i.gi].code, o: i.o });
}

export {
  restoreWorkControls,
  saveAndContinue,
  restoreWorkspaceFile,
  unissuedVisitFor,
  worksheetFaults,
  changeVisitDate,
  cleanVisit,
  returnToWorksheet,
  restorePreviousDraft,
  discardWorksheet,
  recoveryStatusHTML,
  renderRecoveryStatus,
  recoveryModal,
  keepCatalogForms,
  catalogKey,
};
