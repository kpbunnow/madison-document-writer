import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { dueContext, dueDateSpacingConflicts } from "./deadline_assignment.js";
import { inspAt } from "./inspection_facts.js";
import { recordDay } from "../assets/shared.js";
import { clone } from "./record_values.js";
import { OUTCOMES } from "./document_types.js";
import { doc, docCase, docsFor, insp, reinsp, reinspFor, unchecked } from "./writer_queries.js";
import { distinctDues } from "./document_rules.js";
import { parseTime, validISO } from "./calendar.js";

export function changeVisitDate(r, date) {
  const old = r.date;
  r.date = date;
  Object.values(r.results).forEach((res) => {
    if (!res.carried && !res.manualDate && (!res.on || res.on === old)) res.on = date;
  });
}

export function cleanVisit(r) {
  const out = clone(r);
  ["draft", "previousDraft", "previousWorksheet", "expectedHead", "dueWork", "followupIntent"].forEach((k) => delete out[k]);
  Object.values(out.results || {}).forEach((res) => {
    if (!res.on && !res.manualDate && !res.carried) res.on = out.date;
  });
  return out;
}

// Worksheet queries/validation and retained draft transitions; peer/UI/persistence adapters stay supplied.
export function createWorksheetWorkflow(services) {
  function unissuedVisitFor(cid) {
    const src = services.sourceDocFor(cid);
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
    if (!validISO(r.date) || r.date > recordDay(services.today) || r.date < earliest)
      faults.push("Inspection date must be between the source inspection and today.");
    if (!parseTime(r.time)) faults.push("Enter the reinspection time before generating a document.");
    if (!insp(r.inspectorId).name) faults.push("Select the inspector who performed this inspection.");
    if (unchecked(r).length) faults.push("Choose an outcome for every item.");
    services.newDocuments
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
        if (
          type &&
          ["extension", "bestInterestExtension", "citation"].includes(type) &&
          res.oc !== "corrected" &&
          !services.dueCheck(res.due, r.date).ok
        )
          faults.push("Set a future due date for each outstanding item.");
      });
    if (src.type === "compliance" || src.items.every((i) => i.withdrawn))
      faults.push("This case is completed. New observations require a new case; correct a recording error through the document history.");
    if (["extension", "bestInterestExtension", "citation"].includes(type) && distinctDues(dueContext(r, true)).length > 3)
      faults.push("Use no more than three distinct due dates.");
    if (["extension", "bestInterestExtension", "citation"].includes(type) && dueDateSpacingConflicts(dueContext(r, true)).length)
      faults.push("Keep distinct due dates at least seven days apart.");
    return [...new Set(faults)];
  }

  function returnToWorksheet(d) {
    const r = d && reinsp(d.fromReinspId);
    if (!d || !d.draft || d.pendingAmendment || d.correction || !r || !r.draft) return false;
    r.previousDraft = clone(d);
    r.previousWorksheet = cleanVisit(r);
    r.docId = null;
    workspace.DOCS = workspace.DOCS.filter((x) => x.id !== d.id);
    editor.state.reinspId = r.id;
    editor.state.screen = "reinspect";
    editor.state.modal = null;
    workspace.DIRTY = true;
    services.saveDrafts();
    services.render();
    services.toast("Inspection reopened. A copy of the previous document draft is retained below.");
    return true;
  }

  function restorePreviousDraft(r) {
    if (!r || !r.draft || !r.previousDraft || r.docId) return false;
    const d = clone(r.previousDraft),
      snapshot = clone(r.previousWorksheet);
    Object.assign(r, snapshot, { draft: true });
    delete r.previousDraft;
    delete r.previousWorksheet;
    workspace.DOCS.unshift(d);
    r.docId = d.id;
    editor.state.docId = d.id;
    editor.state.screen = "write";
    workspace.DIRTY = true;
    services.saveDrafts();
    services.render();
    return true;
  }

  function discardWorksheet(id) {
    const r = reinsp(id);
    if (!r || !r.draft) return false;
    const d = r.docId && doc(r.docId);
    if (d && d.pendingAmendment) {
      services.toast("Confirm the pending document save before discarding this inspection.");
      return false;
    }
    if (d) {
      editor.state.docId = d.id;
      editor.state.screen = "write";
      services.render();
      services.toast("This inspection has a document draft. Use Review inspection from that document before discarding the worksheet.");
      return false;
    }
    workspace.REINSP = workspace.REINSP.filter((x) => x.id !== id);
    editor.state.reinspId = null;
    services.clearWalk();
    editor.WORK.walk = null;
    services.saveDrafts();
    services.render();
    return true;
  }
  return { unissuedVisitFor, worksheetFaults, returnToWorksheet, restorePreviousDraft, discardWorksheet };
}
