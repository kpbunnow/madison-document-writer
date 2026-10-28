import { recoveryState as recovery } from "./recovery_state.js";
import { badIds, caseFileFault } from "./case_file_rules.js";
import { SCHEMA } from "./document_types.js";
import { stableJSON, clone } from "./record_values.js";
import { doc, eventsFor } from "./writer_queries.js";
import { project } from "./case_records.js";
import { WriterState } from "./state.js";

export function recoverySharedConflict(value) {
  return ["invalid", "history-conflict", "conflict", "shared-history"].includes(value?.kind);
}

// Individual-case recovery coordination; UI, helper/shared comparison and device storage stay supplied.
export function createCaseRecovery(services) {
  async function listRecovery() {
    recovery.RECOVERY.loading = true;
    WriterState.state.modal = "recovery";
    services.render();
    try {
      recovery.RECOVERY.list = (await services.helperJSON("/draft-backups/list")).backups;
      recovery.RECOVERY.error = "";
    } catch (e) {
      recovery.RECOVERY.error = e.message;
      recovery.RECOVERY.list = [];
    }
    recovery.RECOVERY.loading = false;
    services.render();
  }

  async function selectRecovery(row) {
    const token = ++recovery.RECOVERY_SELECT_SEQ;
    recovery.RECOVERY.selected = null;
    recovery.RECOVERY.shared = null;
    services.render();
    const result = row.imported
      ? { backup: row.imported }
      : await services.helperJSON("/draft-backups/read", { workspace: row.workspace, case: row.case, name: row.name });
    if (WriterState.state.modal !== "recovery" || recovery.RECOVERY_SELECT_SEQ !== token) return;
    const backup = result.backup;
    validateRecovery(backup, row);
    const shared = await recoverySharedState(backup);
    if (WriterState.state.modal !== "recovery" || recovery.RECOVERY_SELECT_SEQ !== token) return;
    recovery.RECOVERY.selected = backup;
    recovery.RECOVERY.shared = shared;
    services.render();
  }

  async function recoverySharedState(backup) {
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
      badIds(b.bundle)
    )
      throw new Error("Invalid or unsupported recovery backup");
    const k = b.bundle.cases[0],
      cid = k?.id;
    if (k) {
      if (
        k.number !== b.number ||
        caseFileFault({ format: "madison-case-file", schema: SCHEMA, case: k, inspectors: [], events: b.bundle.events[cid] || [] })
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
              return caseFileFault(file) || file.case.id !== cid || file.case.number !== k.number;
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
    return true;
  }

  async function persistRecoveryState(staged, pending) {
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
      } catch (e) {
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
      validateRecovery(b, row);
      const currentShared = await recoverySharedState(b);
      if (selection !== recovery.RECOVERY_SELECT_SEQ || recovery.RECOVERY.selected !== b || WriterState.state.modal !== "recovery") return;
      recovery.RECOVERY.shared = currentShared;
      if (recoverySharedConflict(currentShared))
        throw new Error("Review the changed shared record before restoring this draft. Export the backup first.");
      const k = b.bundle.cases[0];
      if (!k) {
        if (services.hasSetupWork()) throw new Error("Import recovery needs an empty import form.");
        const staged = { ...services.draftBundle(), work: clone(b.bundle.work) };
        if (!(await services.idbSet("drafts", staged))) throw new Error("Browser storage could not save the imported work.");
        WriterState.WORK = staged.work;
        WriterState.state.acc = WriterState.WORK.acc || null;
        WriterState.state.modal = null;
        WriterState.state.screen = "import";
        services.render();
        return;
      }
      const current = WriterState.CASES.find((c) => c.id === k.id || c.number === k.number);
      if (current && (current.id !== k.id || current.number !== k.number)) throw new Error("The case number or identity conflicts with local work.");
      if (current) {
        const backed = new Map((b.bundle.events[k.id] || []).map((e) => [e.id, e]));
        if (eventsFor(k.id).some((e) => !backed.has(e.id) || stableJSON(e) !== stableJSON(backed.get(e.id))) || current.id !== k.id)
          throw new Error("The local case has different issued history. Export both copies and reconcile before restoring.");
      }
      const local = current && services.caseUnsaved(current);
      if (current) {
        const same =
          stableJSON(WriterState.DOCS.filter((d) => d.draft && d.caseId === k.id)) === stableJSON(b.bundle.docs) &&
          stableJSON(WriterState.REINSP.filter((r) => r.draft && r.caseId === k.id)) === stableJSON(b.bundle.reinsp) &&
          stableJSON(WriterState.PENDING.filter((p) => p.cid === k.id)) === stableJSON(b.pending) &&
          stableJSON(
            Object.fromEntries(Object.entries(WriterState.WORK.recordForms || {}).filter(([id]) => doc(id.split(":")[0])?.caseId === k.id)),
          ) === stableJSON(b.bundle.work.recordForms) &&
          stableJSON(WriterState.WORK.walk?.context?.startsWith(k.id + "|") ? WriterState.WORK.walk : null) ===
            stableJSON(b.bundle.work.walk || null);
        if (!same) {
          const copy = services.recoverySnapshot(k.id, services.recoveryCaseKey(k.id));
          copy.preReplacement = true;
          await services.helperJSON("/draft-backups/write", { workspace: services.RECOVERY_WORKSPACE, case: copy.case, backup: copy });
          if (selection !== recovery.RECOVERY_SELECT_SEQ || recovery.RECOVERY.selected !== b || WriterState.state.modal !== "recovery") return;
          if (
            !services.confirm(
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
        ...services.draftBundle(),
        cases: WriterState.CASES.filter((c) => c.id !== k.id).concat([clone(k)]),
        docs: WriterState.DOCS.filter((d) => d.draft && d.caseId !== k.id).concat(clone(b.bundle.docs)),
        reinsp: WriterState.REINSP.filter((r) => r.draft && r.caseId !== k.id).concat(clone(b.bundle.reinsp)),
        events: { ...WriterState.EVENTS, [k.id]: clone(b.bundle.events[k.id] || []) },
        recordAttempts: {
          ...Object.fromEntries(Object.entries(WriterState.RECORD_ATTEMPTS).filter(([, x]) => x.cid !== k.id)),
          ...clone(b.bundle.recordAttempts || {}),
        },
        checkpoints: { ...WriterState.SAVE_CHECKPOINTS, [k.id]: clone(b.bundle.checkpoints?.[k.id] || null) },
        seq: Math.max(WriterState.seq, b.bundle.seq || 0),
        work: {
          ...clone(WriterState.WORK),
          walk: b.bundle.work.walk
            ? clone(b.bundle.work.walk)
            : WriterState.WORK.walk?.context?.startsWith(k.id + "|")
              ? null
              : WriterState.WORK.walk,
          recordForms: {
            ...Object.fromEntries(Object.entries(WriterState.WORK.recordForms || {}).filter(([id]) => doc(id.split(":")[0])?.caseId !== k.id)),
            ...clone(b.bundle.work.recordForms),
          },
        },
      };
      const pending = WriterState.PENDING.filter((p) => p.cid !== k.id).concat(clone(b.pending));
      if (!(await persistRecoveryState(staged, pending)))
        throw new Error("Browser storage could not commit the recovery; previous work was retained.");
      WriterState.CASES = staged.cases;
      WriterState.DOCS = staged.docs;
      WriterState.REINSP = staged.reinsp;
      WriterState.EVENTS = staged.events;
      WriterState.RECORD_ATTEMPTS = staged.recordAttempts;
      WriterState.SAVE_CHECKPOINTS = staged.checkpoints;
      WriterState.PENDING = pending;
      WriterState.WORK = staged.work;
      WriterState.seq = staged.seq;
      services.clearWalk();
      project();
      WriterState.state.modal = null;
      WriterState.state.screen = "cases";
      services.render();
      await services.refreshArtifactLocations();
      services.toast("Recovered " + k.number + " as unfinished work. No document was issued.");
    } catch (e) {
      services.toast("Recovery kept the current workspace: " + e.message);
    }
  }
  return {
    listRecovery,
    selectRecovery,
    validateRecovery,
    restoreRecovery,
    ...(__TEST_BUILD__ ? { recoverySharedState, persistRecoveryState } : {}),
  };
}
