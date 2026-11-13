/* Reinspection worksheet: give every item that has no result yet the same outcome in one step (owner direction
   2026-11-13). Items already resulted are never overwritten, each item goes through the ordinary single-item recorder,
   and the step can be undone while its message is shown. Not offered in One item at a time. */
import { editorState as editor } from "./editor_state.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { doc, reinsp } from "./writer_queries.js";
import { OUTCOMES } from "./document_types.js";
import { clone, stableJSON } from "./record_values.js";

export const BATCH_OUTCOMES = ["corrected", "none"];

// Items of the worksheet's source document that still need a result.
export function unresultedItems(r) {
  const src = r && doc(r.sourceDocId);
  return src ? src.items.filter((it) => !it.withdrawn && !(r.results[it.id] || {}).oc && !(r.results[it.id] || {}).carried) : [];
}

// Revert only fields still equal to what this batch wrote; later edits retain their own values.
function restoreResult(current, before, after) {
  const restored = clone(current);
  for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after)])) {
    if (Object.hasOwn(current, key) !== Object.hasOwn(after, key) || stableJSON(current[key]) !== stableJSON(after[key])) continue;
    if (before && Object.hasOwn(before, key))
      Object.defineProperty(restored, key, { value: clone(before[key]), enumerable: true, configurable: true, writable: true });
    else delete restored[key];
  }
  return restored;
}

function undoItem(r, change) {
  const { id, before, after, written } = change,
    current = r.results[id],
    item = doc(r.sourceDocId)?.items.find((it) => it.id === id);
  if (!item || item.withdrawn || current !== written || current.carried || current.oc !== after.oc) return false;
  if (stableJSON(current) === stableJSON(after)) {
    if (before) r.results[id] = clone(before);
    else delete r.results[id];
  } else r.results[id] = restoreResult(current, before, after);
  return true;
}

function undoRemaining(services, context, changes) {
  const current = reinsp(context.id);
  if (!current?.draft || current.docId || current.caseId !== context.caseId || current.sourceDocId !== context.sourceDocId) return;
  if (doc(current.sourceDocId)?.caseId !== current.caseId || !changes.filter((change) => undoItem(current, change)).length) return;
  workspace.DIRTY = true;
  services.saveDrafts();
  services.render();
}

export function recordRemaining(services, outcome) {
  const r = reinsp(editor.state.reinspId);
  if (editor.state.screen !== "reinspect" || editor.state.riWalk || !r || !BATCH_OUTCOMES.includes(outcome)) return 0;
  const changes = unresultedItems(r).flatMap((it) => {
    const before = Object.hasOwn(r.results, it.id) ? clone(r.results[it.id]) : null;
    if (!services.recordReinspectionOutcome(it.id, outcome)) return [];
    return [{ id: it.id, before, after: clone(r.results[it.id]), written: r.results[it.id] }];
  });
  if (!changes.length) return 0;
  const label = OUTCOMES.find((o) => o.id === outcome).label,
    context = { id: r.id, caseId: r.caseId, sourceDocId: r.sourceDocId };
  services.toastUndo(changes.length + (changes.length === 1 ? " item" : " items") + " marked " + label + ". Change any that differ.", () =>
    undoRemaining(services, context, changes),
  );
  return changes.length;
}

export function createReinspectionBatch(services) {
  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-ri-batch]");
    if (button) recordRemaining(services, button.dataset.riBatch);
  });
}
