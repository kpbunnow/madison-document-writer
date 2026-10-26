import { nowISO } from "./calendar.js";
import { kase } from "./writer_queries.js";
import { WriterState } from "./state.js";
// Held saves retry current records, preserving failed and newly queued work.

export function createPendingCaseSaves(services) {
  async function queuePending(name, body, cid) {
    WriterState.PENDING = WriterState.PENDING.filter((p) => p.name !== name);
    WriterState.PENDING.push({ name: name, body: body, cid: cid || "", at: nowISO() });
    const kept = await services.idbSet("pending", WriterState.PENDING);
    if (!kept) services.toast("This machine would not store the held file — keep the program open until the folder is back");
    return kept;
  }

  async function restorePending() {
    const p = await services.idbGet("pending", services.IDB_OK);
    if (Array.isArray(p) && p.length) {
      WriterState.PENDING = p;
      services.render();
    }
  }

  async function flushPending() {
    if (!WriterState.CASEDIR || WriterState.NEEDGRANT || !WriterState.PENDING.length) return 0;
    const still = [];
    let done = 0;
    const batch = WriterState.PENDING.slice();
    for (let n = 0; n < batch.length; n++) {
      const p = batch[n];
      if (!p.cid || !WriterState.CASES.some((k) => k.id === p.cid)) {
        const loaded = services.loadCaseFile(p.body, false);
        if (!loaded) {
          still.push(p);
          continue;
        }
        p.cid = loaded.id;
      }
      // write the case as it stands now, not the body that failed earlier
      let body = p.body;
      if (p.cid && WriterState.CASES.some((k) => k.id === p.cid)) {
        try {
          await services.mergeSharedFile(p.cid, p.name);
        } catch (err) {
          still.push(p);
          continue;
        }
        try {
          body = JSON.stringify(services.caseFile(p.cid), null, 2);
        } catch (err) {
          body = p.body;
        }
      }
      const r = await services.writeToFolder(p.name, body);
      if (r.ok) {
        done++;
        if (p.cid && WriterState.CASES.some((k) => k.id === p.cid)) {
          services.rememberSaved(kase(p.cid), r.file || JSON.parse(body));
          await services.writeSummary(p.cid, r.file || JSON.parse(body));
        }
      } else still.push(p);
    }
    WriterState.PENDING = still.concat(WriterState.PENDING.filter((p) => batch.indexOf(p) < 0));
    await services.idbSet("pending", WriterState.PENDING);
    await services.saveDrafts();
    if (done) {
      services.toast(done + " held case file" + (done === 1 ? "" : "s") + " written to the share");
      services.render();
    }
    return done;
  }
  return { queuePending, restorePending, flushPending };
}
