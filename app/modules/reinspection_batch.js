/* Reinspection worksheet: give every item that has no result yet the same outcome in one step (owner direction
   2026-11-13). Items already resulted are never overwritten, each item goes through the ordinary single-item recorder,
   and the step can be undone while its message is shown. Not offered in One item at a time. */
import { editorState as editor } from "./editor_state.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { doc, reinsp } from "./writer_queries.js";
import { OUTCOMES } from "./document_types.js";

export const BATCH_OUTCOMES = ["corrected", "none"];

// Items of the worksheet's source document that still need a result.
export function unresultedItems(r) {
  const src = r && doc(r.sourceDocId);
  return src ? src.items.filter((it) => !it.withdrawn && !(r.results[it.id] || {}).oc && !(r.results[it.id] || {}).carried) : [];
}

export function recordRemaining(services, outcome) {
  const r = reinsp(editor.state.reinspId);
  if (editor.state.screen !== "reinspect" || editor.state.riWalk || !r || !BATCH_OUTCOMES.includes(outcome)) return 0;
  const done = unresultedItems(r)
    .map((it) => it.id)
    .filter((id) => services.recordReinspectionOutcome(id, outcome));
  if (!done.length) return 0;
  const label = OUTCOMES.find((o) => o.id === outcome).label;
  services.toastUndo(done.length + (done.length === 1 ? " item" : " items") + " marked " + label + ". Change any that differ.", () => {
    const current = reinsp(r.id);
    if (!current || !current.draft || current.docId) return;
    for (const id of done) if ((current.results[id] || {}).oc === outcome) delete current.results[id];
    workspace.DIRTY = true;
    services.saveDrafts();
    services.render();
  });
  return done.length;
}

export function createReinspectionBatch(services) {
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-ri-batch]");
    if (button) recordRemaining(services, button.dataset.riBatch);
  });
}
