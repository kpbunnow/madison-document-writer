import { WriterState } from "./state.js";
import { clone, byTime } from "./record_values.js";
import { eventsFor } from "./writer_queries.js";
import { clearProhibitedCitations } from "./document_rules.js";
import { nowISO } from "./calendar.js";

// Local drafts coordinate snapshots, ordered writes and restoration; low-level database and UI access are supplied.
export function createDraftPersistence(services) {
  function draftBundle() {
    const cases = WriterState.CASES.slice();
    const events = {};
    cases.forEach((k) => {
      const evs = eventsFor(k.id);
      if (evs.length) events[k.id] = clone(evs);
    });
    return {
      docs: WriterState.DOCS.filter((d) => d.draft),
      reinsp: WriterState.REINSP.filter((r) => r.draft),
      cases: cases,
      events: events,
      work: clone(WriterState.WORK),
      recordAttempts: clone(WriterState.RECORD_ATTEMPTS),
      integrityRecords: services.recordIntegrity.snapshot(),
      checkpoints: clone(WriterState.SAVE_CHECKPOINTS),
      seq: WriterState.seq,
      at: nowISO(),
    };
  }

  async function saveDrafts() {
    if (!WriterState.WRITER_ACCESS || (!WriterState.WORKSPACE_RESTORED && !WriterState.WRITER_READY)) return false;
    if (WriterState.WORK_PATCH) await WriterState.WORK_PATCH;
    services.captureWork();
    const generation = ++WriterState.LOCAL_CHANGED,
      snapshot = clone(draftBundle());
    WriterState.LOCAL_SAVE.saving = true;
    services.updateSaveStatus();
    const task = WriterState.LOCAL_SAVE_CHAIN.then(() => services.idbSet("drafts", snapshot));
    WriterState.LOCAL_SAVE_CHAIN = task.catch(() => false);
    const kept = await task;
    if (generation === WriterState.LOCAL_CHANGED) {
      WriterState.LOCAL_SAVE = { ok: kept, at: kept ? nowISO() : WriterState.LOCAL_SAVE.at, saving: false };
      if (kept && !WriterState.draftTimer) WriterState.DIRTY = false;
      services.updateSaveStatus();
    }
    if (kept && generation === WriterState.LOCAL_CHANGED) services.scheduleRecoveryBackup();
    return kept;
  }

  function scheduleDraftSave() {
    WriterState.DIRTY = true;
    ++WriterState.LOCAL_CHANGED;
    if (!services.IDB_OK) {
      WriterState.LOCAL_SAVE.ok = false;
      services.updateSaveStatus();
      return;
    }
    if (WriterState.draftTimer) clearTimeout(WriterState.draftTimer);
    WriterState.draftTimer = setTimeout(() => {
      WriterState.draftTimer = null;
      saveDrafts();
    }, 1500);
  }

  async function restoreDrafts() {
    const b = await services.idbGet("drafts", services.IDB_OK);
    if (b && b.work) {
      WriterState.WORK = b.work;
      WriterState.WORK.entry = WriterState.WORK.entry || {};
      WriterState.WORK.recordForms = WriterState.WORK.recordForms || {};
      WriterState.state.acc = WriterState.WORK.acc || null;
    }
    if (b && b.recordAttempts) WriterState.RECORD_ATTEMPTS = b.recordAttempts;
    if (b && b.checkpoints && typeof b.checkpoints === "object") WriterState.SAVE_CHECKPOINTS = b.checkpoints;
    if (!b || !Array.isArray(b.cases)) return;
    if (typeof b.seq === "number") WriterState.seq = Math.max(WriterState.seq, b.seq);
    (b.cases || []).forEach((k) => {
      if (!WriterState.CASES.some((c) => c.id === k.id || c.number === k.number)) WriterState.CASES.push(k);
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
      if (!WriterState.DOCS.some((x) => x.id === d.id)) WriterState.DOCS.unshift(d);
    });
    (b.reinsp || []).forEach((r) => {
      clearProhibitedCitations(r);
      if (!WriterState.REINSP.some((x) => x.id === r.id)) WriterState.REINSP.push(r);
    });
    services.project();
    services.render();
    const n = (b.docs || []).length + (b.reinsp || []).length;
    if (n) services.toast(n + " unfinished draft" + (n === 1 ? "" : "s") + " restored from this machine");
  }
  return { draftBundle, saveDrafts, scheduleDraftSave, restoreDrafts };
}
