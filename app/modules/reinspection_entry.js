import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { inspectionIdentity } from "./inspection_facts.js";
import { recordDay } from "../assets/shared.js";
import { draftDocFor, draftReinspFor, kase, recordHead } from "./writer_queries.js";

export function createReinspectionEntry(services) {
  function startReinspection(cid, importedRow) {
    if (services.snow.isCase(kase(cid))) {
      services.toast("Snow cases cite each inspection directly; import the next snow inspection instead of creating a reinspection.");
      return;
    }
    if (services.recordIntegrity.blocked(cid)) {
      services.toast("This record was changed outside the program. Read-only.");
      return;
    }
    services.clearWalk();
    const correction = draftDocFor(cid);
    if (correction && correction.correction) {
      editor.state.docId = correction.id;
      editor.state.screen = "write";
      services.render();
      services.toast("Finish or discard the correction before starting another inspection");
      return;
    }
    const unfinished = draftDocFor(cid);
    if (unfinished) {
      editor.state.docId = unfinished.id;
      editor.state.screen = "write";
      services.render();
      services.toast("Continue the unfinished document first.");
      return;
    }
    const open = draftReinspFor(cid) || services.unissuedVisitFor(cid);
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
      editor.state.reinspId = open.id;
      editor.state.screen = "reinspect";
      services.restoreWalkFor(open);
      services.render();
      return;
    }
    const src = services.sourceDocFor(cid);
    if (!src || !src.items.length) {
      services.toast("Finish and issue the notice first — a reinspection works off the document the owner received");
      return;
    }
    if (src.type === "compliance" || src.items.every((i) => i.withdrawn)) {
      services.toast("This case is completed. Use a new case for new observations or correct a" + " recording error from the document history.");
      return;
    }
    const k = kase(cid);
    const r = {
      expectedHead: recordHead(cid),
      id: services.uid("r"),
      caseId: cid,
      sourceDocId: src.id,
      date: (importedRow && importedRow.date) || recordDay(services.today),
      time: (importedRow && importedRow.time) || "",
      draft: true,
      inspectorId: (importedRow && importedRow.inspectorId) || k.inspectorId,
      results: {},
      docId: null,
      ...(importedRow ? { importInspection: inspectionIdentity(importedRow) } : {}),
    };
    services.newDocuments.continuingItems(src).forEach((it) => {
      if (it.done || it.withdrawn)
        r.results[it.id] = { oc: it.withdrawn ? "withdrawn" : "corrected", on: it.doneOn || "", due: "", note: "", cite: false, carried: true };
    });
    editor.WORK.walk = null;
    workspace.REINSP.push(r);
    editor.state.reinspId = r.id;
    editor.state.screen = "reinspect";
    workspace.DIRTY = true;
    services.saveDrafts();
    services.render();
  }
  return { startReinspection };
}
