import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { caseFileName, summaryName } from "./case_file_rules.js";
import { caseDetails, stableJSON, clone } from "./record_values.js";
import { kase, insp, eventsFor } from "./writer_queries.js";
import { nowISO } from "./calendar.js";

/* Commit phases. Each takes the owner's `services` and runs in the order the single save used to. */
function startable(services) {
  if (editor.AMENDMENT_BUSY) return false;
  if (!workspace.CASEDIR || !workspace.CASEDIR.helper) {
    services.toast("Start the current local helper to save this record change safely.");
    return false;
  }
  return true;
}

// The attempt is durable before any request. If its response is lost, the
// same event identity is retried, never a second revision.
async function retainAttempt(services, attempt, draft) {
  if (!draft) return;
  draft.pendingAmendment = attempt;
  if (!(await services.saveDrafts())) throw new Error("The pending action could not be saved on this device. Keep this tab open and retry.");
}

function stageCandidate(services, cid, attempt, draft) {
  const localBefore = caseDetails(kase(cid));
  const candidate = services.caseFile(cid),
    key = summaryName(candidate.case),
    base = services.COMMITTED.get(key),
    checkpoint = workspace.SAVE_CHECKPOINTS[cid];
  const existing = candidate.events.find((e) => e.id === attempt.id);
  for (const event of (draft && draft.publicationEvents) || [])
    if (!candidate.events.some((e) => e.id === event.id)) candidate.events.push(clone(event));
  if (!existing) candidate.events.push(clone(attempt));
  for (const event of (draft && draft.publicationEvents) || [])
    if (!candidate.inspectors.some((i) => i.id === event.by) && insp(event.by).name) candidate.inspectors.push(clone(insp(event.by)));
  if (!candidate.inspectors.some((i) => i.id === attempt.by) && insp(attempt.by).name) candidate.inspectors.push(clone(insp(attempt.by)));
  Object.entries(attempt.payload.caseChanges || {}).forEach(([k, v]) => {
    if (v.after === null) delete candidate.case[k];
    else candidate.case[k] = clone(v.after);
  });
  return { localBefore, candidate, key, base, checkpoint };
}

async function saveCandidate(services, attempt, staged) {
  const { candidate, key, base, checkpoint } = staged;
  const result = await services.helperJSON("/cases/save", {
    name: base ? base.name : caseFileName(candidate.case),
    file: candidate,
    baseRevision: (base && base.revision) || "",
    baseCase: checkpoint ? checkpoint.case : null,
    idempotencyEvent: attempt.id,
  });
  services.COMMITTED.set(key, result);
  return result;
}

// Fields the inspector did not touch locally take the saved values; local edits stay.
function mergeSaved(services, cid, localBefore, result) {
  const k = kase(cid),
    savedCase = Object.assign({}, caseDetails(result.file.case), { id: cid });
  new Set(Object.keys(localBefore).concat(Object.keys(savedCase))).forEach((key) => {
    if (key === "id") return;
    if (stableJSON(k[key]) === stableJSON(localBefore[key])) {
      if (savedCase[key] === undefined) delete k[key];
      else k[key] = clone(savedCase[key]);
    }
  });
  services.mergeCaseEvents(k, clone(result.file));
  return { k, savedCase };
}

function settleDraft(draft, attempt) {
  if (!draft) return;
  workspace.DOCS = workspace.DOCS.filter((x) => x.id !== draft.id);
  if (draft.publicationEvents) workspace.REINSP = workspace.REINSP.filter((r) => !(r.draft && r.id === attempt.payload.fromReinspId));
  if (draft.recordKey) delete editor.RECORD_ATTEMPTS[draft.recordKey];
}

const FORM_MODES = { "document.annotated": "recordnote", "document.reconciled": "reconcile", "document.voided": "void" };

function closeRecordForm(attempt) {
  if (!FORM_MODES[attempt.type]) return;
  delete editor.WORK.recordForms[attempt.payload.docId + ":" + FORM_MODES[attempt.type]];
  if (editor.state.docId === attempt.payload.docId && editor.state.modal === FORM_MODES[attempt.type]) editor.state.modal = null;
}

async function confirmSaved(services, cid, merged, result) {
  const { k, savedCase } = merged;
  services.project();
  services.rememberSaved(k, result.file);
  workspace.LASTWRITE = { name: result.name, ok: true, why: "", at: nowISO() };
  const savedIds = new Set(result.file.events.map((e) => e.id));
  if (eventsFor(cid).every((e) => savedIds.has(e.id)) && stableJSON(caseDetails(k)) === stableJSON(savedCase))
    workspace.PENDING = workspace.PENDING.filter((p) => p.cid !== cid);
  await services.idbSet("pending", workspace.PENDING);
  await services.writeSummary(cid, result.file);
  await services.saveDrafts();
}

// Validation/conflict rejections are definitive. Network and server errors
// may follow a committed write; retain the exact attempt for confirmation.
async function failCommit(services, error, draft) {
  if (draft && error.name === "StorageError" && error.definitive !== false) {
    delete draft.pendingAmendment;
    delete draft.publicationEvents;
    if (draft.recordKey) delete editor.RECORD_ATTEMPTS[draft.recordKey];
  }
  if (draft) await services.saveDrafts();
  editor.state.amendmentError = /failed to fetch|networkerror|network request failed/i.test(error.message)
    ? "The shared save could not be confirmed. Your exact request is retained. " + "Reconnect and use Confirm save or Retry save."
    : error.message;
  services.toast(editor.state.amendmentError);
}

// Shared request/confirmation boundary. Construction performs no I/O or workspace reads.
// Persistence, helper validation and projection authority stay in supplied adapters.
export function createRecordCommit(services) {
  async function commitAmendment(cid, attempt, draft) {
    if (!startable(services)) return false;
    editor.AMENDMENT_BUSY = true;
    try {
      await retainAttempt(services, attempt, draft);
      const staged = stageCandidate(services, cid, attempt, draft);
      const result = await saveCandidate(services, attempt, staged);
      const merged = mergeSaved(services, cid, staged.localBefore, result);
      settleDraft(draft, attempt);
      closeRecordForm(attempt);
      await confirmSaved(services, cid, merged, result);
      return true;
    } catch (error) {
      await failCommit(services, error, draft);
      return false;
    } finally {
      editor.AMENDMENT_BUSY = false;
      services.render();
    }
  }
  return { commitAmendment };
}
