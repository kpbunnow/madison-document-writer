import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { startupState as startup } from "./startup_state.js";
import { clone, byTime } from "./record_values.js";
import { eventsFor } from "./writer_queries.js";
import { clearProhibitedCitations } from "./document_rules.js";
import { nowISO } from "./calendar.js";

// Local drafts coordinate snapshots, ordered writes and restoration; low-level database and UI access are supplied.
function restoreDraftContext(b) {
  if (b && b.work) {
    editor.WORK = b.work;
    editor.WORK.entry = editor.WORK.entry || {};
    editor.WORK.recordForms = editor.WORK.recordForms || {};
    editor.state.acc = editor.WORK.acc || null;
  }
  if (b && b.recordAttempts) editor.RECORD_ATTEMPTS = b.recordAttempts;
  if (b && b.checkpoints && typeof b.checkpoints === "object") workspace.SAVE_CHECKPOINTS = b.checkpoints;
}

export function createDraftPersistence(services) {
  function draftBundle() {
    const cases = workspace.CASES.slice();
    const events = {};
    cases.forEach((k) => {
      const evs = eventsFor(k.id);
      if (evs.length) events[k.id] = clone(evs);
    });
    return {
      docs: workspace.DOCS.filter((d) => d.draft),
      reinsp: workspace.REINSP.filter((r) => r.draft),
      cases: cases,
      events: events,
      work: clone(editor.WORK),
      recordAttempts: clone(editor.RECORD_ATTEMPTS),
      integrityRecords: services.recordIntegrity.snapshot(),
      checkpoints: clone(workspace.SAVE_CHECKPOINTS),
      seq: workspace.seq,
      at: nowISO(),
    };
  }

  async function saveDrafts() {
    if (!startup.WRITER_ACCESS || (!startup.WORKSPACE_RESTORED && !startup.WRITER_READY)) return false;
    if (editor.WORK_PATCH) await editor.WORK_PATCH;
    services.captureWork();
    const generation = ++editor.LOCAL_CHANGED,
      snapshot = clone(draftBundle());
    editor.LOCAL_SAVE.saving = true;
    services.updateSaveStatus();
    const task = editor.LOCAL_SAVE_CHAIN.then(() => services.idbSet("drafts", snapshot));
    editor.LOCAL_SAVE_CHAIN = task.catch(() => false);
    const kept = await task;
    if (generation === editor.LOCAL_CHANGED) {
      editor.LOCAL_SAVE = { ok: kept, at: kept ? nowISO() : editor.LOCAL_SAVE.at, saving: false };
      if (kept && !editor.draftTimer) workspace.DIRTY = false;
      services.updateSaveStatus();
    }
    if (kept && generation === editor.LOCAL_CHANGED) services.scheduleRecoveryBackup();
    return kept;
  }

  async function restoreDrafts() {
    const b = await services.idbGet("drafts", services.IDB_OK);
    restoreDraftContext(b);
    if (!b || !Array.isArray(b.cases)) return;
    if (typeof b.seq === "number") workspace.seq = Math.max(workspace.seq, b.seq);
    (b.cases || []).forEach((k) => {
      if (!workspace.CASES.some((c) => c.id === k.id || c.number === k.number)) workspace.CASES.push(k);
    });
    // the history a draft depends on, restored before the draft is shown
    const evs = b.events || {};
    Object.keys(evs).forEach((cid) => {
      const have = {};
      eventsFor(cid).forEach((e) => {
        have[e.id] = 1;
      });
      (evs[cid] || []).forEach((e) => {
        if (e && e.id && !have[e.id]) eventsFor(cid).push(e);
      });
      eventsFor(cid).sort(byTime);
    });
    await services.recordIntegrity.restore(b.integrityRecords);
    // Drafts saved before their status prohibited citations are restored without the stale marks.
    (b.docs || []).forEach((d) => {
      clearProhibitedCitations(d);
      if (!workspace.DOCS.some((x) => x.id === d.id)) workspace.DOCS.unshift(d);
    });
    (b.reinsp || []).forEach((r) => {
      clearProhibitedCitations(r);
      if (!workspace.REINSP.some((x) => x.id === r.id)) workspace.REINSP.push(r);
    });
    services.project();
    services.render();
    const n = (b.docs || []).length + (b.reinsp || []).length;
    if (n) services.toast(n + " unfinished draft" + (n === 1 ? "" : "s") + " restored from this machine");
  }
  return { draftBundle, saveDrafts, restoreDrafts };
}
