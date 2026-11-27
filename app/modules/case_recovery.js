import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { recoveryState as recovery } from "./recovery_state.js";
import { badIds, caseFileFault } from "./case_file_rules.js";
import { SCHEMA } from "./document_types.js";
import { stableJSON, clone } from "./record_values.js";
import { doc, eventsFor } from "./writer_queries.js";
import { project } from "./case_records.js";
import { canonicalJSON } from "./record_integrity.js";

/* The fields an import-only recovery owns: the case-number lookup entry and the retained import review. Everything else
   in the working context belongs to cases already in the workspace. */
const IMPORT_FIELDS = ["acc", "entry"];
function requireRecoveryIntegrity(records, k) {
  if (records === undefined) return;
  try {
    if (!Array.isArray(records) || records.some((f) => !k || caseFileFault(f) || f.case.number !== k.number))
      throw new Error("Unrelated or malformed retained evidence");
    canonicalJSON(records);
  } catch {
    throw new Error("The backup has invalid or unrelated integrity records.");
  }
}

function importOnlyWork(current, saved) {
  const work = clone(current || {});
  IMPORT_FIELDS.forEach((field) => {
    if (saved && saved[field] !== undefined) work[field] = clone(saved[field]);
    else delete work[field];
  });
  return work;
}
export function recoverySharedConflict(value) {
  return ["invalid", "history-conflict", "conflict", "shared-history"].includes(value?.kind);
}

function requireRecoveryShape(b, row) {
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
    badIds(b.bundle)
  )
    throw new Error("Invalid or unsupported recovery backup");
  requireRecoveryIntegrity(b.bundle.integrityRecords, b.bundle.cases[0]);
}

function requireRelatedRecoveryWork(b, k, cid) {
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
            return caseFileFault(file) || file.case.id !== cid || file.case.number !== k.number;
          } catch {
            return true;
          }
        })(),
    )
  )
    throw new Error("Backup contains unrelated or invalid work");
}

function requireRecoveryReferences(services, b, k, cid) {
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
        (!b.bundle.reinsp.some((r) => r.draft && services.walkIdentity(r) === b.bundle.work.walk.context) ||
          !b.bundle.reinsp.some(
            (r) =>
              r.id === b.bundle.work.walk.context.split("|")[1] &&
              (b.bundle.events[cid] || []).some(
                (e) => e.payload?.snapshot?.id === r.sourceDocId && e.payload.snapshot.items.some((it) => it.id === b.bundle.work.walk.item),
              ),
          ))))
  )
    throw new Error("Backup has inconsistent document or walk-through references");
}

function recoverySelectionChanged(selection, b) {
  return selection !== recovery.RECOVERY_SELECT_SEQ || recovery.RECOVERY.selected !== b || editor.state.modal !== "recovery";
}

function requireCompatibleLocalHistory(b, k, current) {
  if (current && (current.id !== k.id || current.number !== k.number)) throw new Error("The case number or identity conflicts with local work.");
  if (current) {
    const backed = new Map((b.bundle.events[k.id] || []).map((e) => [e.id, e]));
    if (eventsFor(k.id).some((e) => !backed.has(e.id) || stableJSON(e) !== stableJSON(backed.get(e.id))) || current.id !== k.id)
      throw new Error("The local case has different issued history. Export both copies and reconcile before restoring.");
  }
}

function recoveryWorkMatches(b, k) {
  return (
    stableJSON(workspace.DOCS.filter((d) => d.draft && d.caseId === k.id)) === stableJSON(b.bundle.docs) &&
    stableJSON(workspace.REINSP.filter((r) => r.draft && r.caseId === k.id)) === stableJSON(b.bundle.reinsp) &&
    stableJSON(workspace.PENDING.filter((p) => p.cid === k.id)) === stableJSON(b.pending) &&
    stableJSON(Object.fromEntries(Object.entries(editor.WORK.recordForms || {}).filter(([id]) => doc(id.split(":")[0])?.caseId === k.id))) ===
      stableJSON(b.bundle.work.recordForms) &&
    stableJSON(editor.WORK.walk?.context?.startsWith(k.id + "|") ? editor.WORK.walk : null) === stableJSON(b.bundle.work.walk || null)
  );
}

function stageRecoveredCase(services, b, k) {
  const current = services.draftBundle(),
    records = b.bundle.integrityRecords || [];
  return {
    ...current,
    ...(records.length
      ? { integrityRecords: (current.integrityRecords || []).filter((f) => f.case?.number !== k.number).concat(clone(records)) }
      : {}),
    cases: workspace.CASES.filter((c) => c.id !== k.id).concat([clone(k)]),
    docs: workspace.DOCS.filter((d) => d.draft && d.caseId !== k.id).concat(clone(b.bundle.docs)),
    reinsp: workspace.REINSP.filter((r) => r.draft && r.caseId !== k.id).concat(clone(b.bundle.reinsp)),
    events: { ...workspace.EVENTS, [k.id]: clone(b.bundle.events[k.id] || []) },
    recordAttempts: {
      ...Object.fromEntries(Object.entries(editor.RECORD_ATTEMPTS).filter(([, x]) => x.cid !== k.id)),
      ...clone(b.bundle.recordAttempts || {}),
    },
    checkpoints: { ...workspace.SAVE_CHECKPOINTS, [k.id]: clone(b.bundle.checkpoints?.[k.id] || null) },
    seq: Math.max(workspace.seq, b.bundle.seq || 0),
    work: {
      ...clone(editor.WORK),
      walk: b.bundle.work.walk ? clone(b.bundle.work.walk) : editor.WORK.walk?.context?.startsWith(k.id + "|") ? null : editor.WORK.walk,
      recordForms: {
        ...Object.fromEntries(Object.entries(editor.WORK.recordForms || {}).filter(([id]) => doc(id.split(":")[0])?.caseId !== k.id)),
        ...clone(b.bundle.work.recordForms),
      },
    },
  };
}

function applyRecoveredCase(staged, pending) {
  workspace.CASES = staged.cases;
  workspace.DOCS = staged.docs;
  workspace.REINSP = staged.reinsp;
  workspace.EVENTS = staged.events;
  editor.RECORD_ATTEMPTS = staged.recordAttempts;
  workspace.SAVE_CHECKPOINTS = staged.checkpoints;
  workspace.PENDING = pending;
  editor.WORK = staged.work;
  workspace.seq = staged.seq;
}

async function applyConfirmedRecovery(services, staged, pending, b) {
  // Invalid verdicts remain restorable as read-only evidence; no proof changes before durable acknowledgment.
  if (b.bundle.integrityRecords?.length) await services.recordIntegrity.restore(b.bundle.integrityRecords);
  applyRecoveredCase(staged, pending);
}

async function scopedListRecovery(services) {
  const token = ++recovery.RECOVERY_SELECT_SEQ;
  recovery.RECOVERY.loading = true;
  recovery.RECOVERY.selected = null;
  recovery.RECOVERY.selectedRow = null;
  recovery.RECOVERY.shared = null;
  editor.state.modal = "recovery";
  services.render();
  try {
    const result = await services.helperJSON("/draft-backups/list");
    if (editor.state.modal !== "recovery" || recovery.RECOVERY_SELECT_SEQ !== token) return;
    recovery.RECOVERY.list = result.backups;
    recovery.RECOVERY.error = "";
  } catch (e) {
    if (editor.state.modal !== "recovery" || recovery.RECOVERY_SELECT_SEQ !== token) return;
    recovery.RECOVERY.error = e.message;
    recovery.RECOVERY.list = [];
  }
  recovery.RECOVERY.loading = false;
  services.render();
}

// Individual-case recovery coordination; UI, helper/shared comparison and device storage stay supplied.
// The shared record's state for a backup, compared with the backed-up history.
async function caseRecoverySharedState(services, backup) {
  const k = backup.bundle.cases[0];
  if (!k) return "Import recovery has no shared case record.";
  try {
    const opened = await services.helperJSON("/cases/resolve?number=" + encodeURIComponent(k.number));
    const sf = opened.file,
      fault = caseFileFault(sf);
    if (fault) return { kind: "invalid", detail: "Shared record unreadable: " + fault };
    return services.compareSharedCase(k, backup.bundle.events[k.id] || [], sf, backup.bundle.checkpoints?.[k.id], true);
  } catch (e) {
    return {
      kind: e.name === "NotFoundError" ? "missing" : e.definitive ? "invalid" : "unavailable",
      detail:
        e.name === "NotFoundError" ? "No shared case record exists yet." : "Shared record unavailable; publication will recheck it. " + e.message,
    };
  }
}

// A backup is restorable only when its shape, history, related work and references are consistent.
function validateCaseRecovery(services, b, row) {
  requireRecoveryShape(b, row);
  const k = b.bundle.cases[0],
    cid = k?.id;
  if (k) {
    if (
      k.number !== b.number ||
      caseFileFault({ format: "madison-case-file", schema: SCHEMA, case: k, inspectors: [], events: b.bundle.events[cid] || [] })
    )
      throw new Error("Invalid backed-up case history");
  }
  requireRelatedRecoveryWork(b, k, cid);
  requireRecoveryReferences(services, b, k, cid);
  return true;
}

// Commit the recovered drafts and pending saves together, rolling back browser storage if the second write fails.
async function persistCaseRecovery(services, staged, pending) {
  if (services.IDB_OK) {
    try {
      const db = await services.idb();
      return await new Promise((resolve) => {
        const tx = db.transaction("kv", "readwrite"),
          store = tx.objectStore("kv");
        store.put(pending, "pending");
        store.put(staged, "drafts");
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      });
    } catch {
      return false;
    }
  }
  // The synthetic harness has no IndexedDB and exercises failure/rollback with services.idbSet.
  const oldPending = await services.idbGet("pending"),
    oldDrafts = await services.idbGet("drafts");
  if (!(await services.idbSet("pending", pending))) return false;
  if (await services.idbSet("drafts", staged)) return true;
  if (!(await services.idbSet("pending", oldPending || [])) || !(await services.idbSet("drafts", oldDrafts || services.draftBundle())))
    throw new Error("Browser storage rollback failed. Keep this tab open and export the workspace.");
  return false;
}

// Different local work is first saved as a recovery copy, then replaced only after confirmation. False stops the restore.
async function confirmRecoveryReplacement(services, b, k, local, selection) {
  const same = recoveryWorkMatches(b, k);
  if (!same) {
    const copy = services.recoverySnapshot(k.id, services.recoveryCaseKey(k.id));
    copy.preReplacement = true;
    await services.helperJSON("/draft-backups/write", { workspace: services.RECOVERY_WORKSPACE, case: copy.case, backup: copy });
    if (recoverySelectionChanged(selection, b)) return false;
    if (
      !services.confirm(
        "Local work differs (" +
          (local || "existing case") +
          "). A recovery copy was saved first. Replace this case with the selected backup from " +
          b.at +
          "?",
      )
    )
      return false;
  }
  return true;
}

// An import recovery restores only the import's own working fields onto an empty import form.
async function restoreImportRecovery(services, b) {
  if (services.hasSetupWork()) throw new Error("Import recovery needs an empty import form.");
  // Only the import's own fields come back; other cases' record forms and walkthrough progress stay as they are.
  const staged = { ...services.draftBundle(), work: importOnlyWork(editor.WORK, b.bundle.work) };
  if (!(await services.idbSet("drafts", staged))) throw new Error("Browser storage could not save the imported work.");
  editor.WORK = staged.work;
  editor.state.acc = editor.WORK.acc || null;
  editor.state.modal = null;
  editor.state.screen = "import";
  services.render();
}

export function createCaseRecovery(services) {
  async function selectRecovery(row) {
    const token = ++recovery.RECOVERY_SELECT_SEQ;
    recovery.RECOVERY.loading = false;
    recovery.RECOVERY.selected = null;
    recovery.RECOVERY.selectedRow = null;
    recovery.RECOVERY.shared = null;
    services.render();
    const result = row.imported
      ? { backup: row.imported }
      : await services.helperJSON("/draft-backups/read", { workspace: row.workspace, case: row.case, name: row.name });
    if (editor.state.modal !== "recovery" || recovery.RECOVERY_SELECT_SEQ !== token) return;
    const backup = result.backup;
    validateCaseRecovery(services, backup, row);
    const shared = await caseRecoverySharedState(services, backup);
    if (editor.state.modal !== "recovery" || recovery.RECOVERY_SELECT_SEQ !== token) return;
    recovery.RECOVERY.selected = backup;
    recovery.RECOVERY.selectedRow = row;
    recovery.RECOVERY.shared = shared;
    services.render();
  }

  async function restoreRecovery() {
    const b = recovery.RECOVERY.selected;
    if (!b) return;
    const selection = recovery.RECOVERY_SELECT_SEQ;
    const row = recovery.RECOVERY.list.find((x) => x.workspace === b.workspace && x.case === b.case && x.number === b.number);
    if (!row) {
      services.toast("Select a backup again.");
      return;
    }
    try {
      validateCaseRecovery(services, b, row);
      const currentShared = await caseRecoverySharedState(services, b);
      if (recoverySelectionChanged(selection, b)) return;
      recovery.RECOVERY.shared = currentShared;
      if (recoverySharedConflict(currentShared))
        throw new Error("Review the changed shared record before restoring this draft. Export the backup first.");
      const k = b.bundle.cases[0];
      // Awaited inside the try, so a refusal still reaches the catch below.
      if (!k) return await restoreImportRecovery(services, b);
      const current = workspace.CASES.find((c) => c.id === k.id || c.number === k.number);
      requireCompatibleLocalHistory(b, k, current);
      const local = current && services.caseUnsaved(current);
      if (current && !(await confirmRecoveryReplacement(services, b, k, local, selection))) return;
      const staged = stageRecoveredCase(services, b, k);
      const pending = workspace.PENDING.filter((p) => p.cid !== k.id).concat(clone(b.pending));
      if (!(await persistCaseRecovery(services, staged, pending)))
        throw new Error("Browser storage could not commit the recovery; previous work was retained.");
      await applyConfirmedRecovery(services, staged, pending, b);
      services.clearWalk();
      project();
      editor.state.modal = null;
      editor.state.screen = "cases";
      services.render();
      await services.refreshArtifactLocations();
      services.toast("Recovered " + k.number + " as unfinished work. No document was issued.");
    } catch (e) {
      services.toast("Recovery kept the current workspace: " + e.message);
    }
  }
  return {
    listRecovery: () => scopedListRecovery(services),
    selectRecovery,
    validateRecovery: (b, row) => validateCaseRecovery(services, b, row),
    restoreRecovery,
    ...(__TEST_BUILD__
      ? {
          recoverySharedState: (backup) => caseRecoverySharedState(services, backup),
          persistRecoveryState: (staged, pending) => persistCaseRecovery(services, staged, pending),
        }
      : {}),
  };
}
