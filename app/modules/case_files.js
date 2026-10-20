import { SUMMARY_DIR as dep_SUMMARY_DIR, recordDay as dep_recordDay } from "../assets/shared.js";
import { checkHelper as dep_checkHelper, toast as dep_toast } from "./court_and_deposits.js";
import {
  caseDetails as dep_caseDetails,
  caseFile as dep_caseFile,
  caseFileFault as dep_caseFileFault,
  caseFileName as dep_caseFileName,
  caseNumberAllowed as dep_caseNumberAllowed,
  grantCaseFolder as dep_grantCaseFolder,
  helperJSON as dep_helperJSON,
  idbGet as dep_idbGet,
  idbSet as dep_idbSet,
  loadCaseFile as dep_loadCaseFile,
  mergeCaseEvents as dep_mergeCaseEvents,
  migrate as dep_migrate,
  project as dep_project,
  rememberSaved as dep_rememberSaved,
  restoreCaseFolder as dep_restoreCaseFolder,
  sourceDocFor as dep_sourceDocFor,
  stableJSON as dep_stableJSON,
  summarize as dep_summarize,
} from "./workspace_shell.js";
import { clearWalk as dep_clearWalk, restoreWalkFor as dep_restoreWalkFor } from "./reinspection_walkthrough.js";
import { captureWork as dep_captureWork } from "./issuance_and_corrections.js";
import {
  downloadWorkspace as dep_downloadWorkspace,
  scheduleRecoveryBackup as dep_scheduleRecoveryBackup,
  unissuedVisitFor as dep_unissuedVisitFor,
} from "./draft_recovery.js";
import { refreshCatalog as dep_refreshCatalog } from "./language_catalog.js";
import {
  initWriterHandoff as dep_initWriterHandoff,
  inspectionIdentity as dep_inspectionIdentity,
  markWriterReady as dep_markWriterReady,
  refreshArtifactLocations as dep_refreshArtifactLocations,
} from "./case_timeline.js";
import { render as dep_render } from "./inspection_import.js";
import {
  CASEDIR_EXPECT as dep_CASEDIR_EXPECT,
  COMMITTED as dep_COMMITTED,
  IDB_OK as dep_IDB_OK,
  STATE_NAMES as dep_STATE_NAMES,
  US_STATES as dep_US_STATES,
  addressParser as dep_addressParser,
  byTime as dep_byTime,
  ccList as dep_ccList,
  clone as dep_clone,
  doc as dep_doc,
  docCase as dep_docCase,
  docsFor as dep_docsFor,
  draftDocFor as dep_draftDocFor,
  draftReinspFor as dep_draftReinspFor,
  emailList as dep_emailList,
  eventsFor as dep_eventsFor,
  kase as dep_kase,
  newDocuments as dep_newDocuments,
  nowISO as dep_nowISO,
  recordHead as dep_recordHead,
  recordIntegrity as dep_recordIntegrity,
  reinsp as dep_reinsp,
  snow as dep_snow,
  summaryName as dep_summaryName,
  uid as dep_uid,
} from "./app_core.js";
import { app_savedworkContext } from "./app_view_contexts.js";
import { WriterState } from "./state.js";
import { localSaveText, updateLocalPresentation } from "./saved_work.js";
import { caseStoreRequest } from "./contracts.js";
/* app functions; direct dependencies use explicit shared state. */

function helperFolder() {
  return {
    name: dep_CASEDIR_EXPECT,
    kind: "directory",
    helper: true,
    queryPermission: async () => "granted",
    requestPermission: async () => "granted",
    async getFileHandle(name) {
      return {
        kind: "file",
        name,
        async getFile() {
          const result = await dep_helperJSON("/cases/open?name=" + encodeURIComponent(name));
          if (result.file.schema >= 5) await dep_recordIntegrity.verify(result.file, result.integrity);
          dep_COMMITTED.set(dep_summaryName(result.file.case), result);
          const body = JSON.stringify(result.file);
          return { size: body.length, lastModified: Date.now(), text: async () => body };
        },
      };
    },
    async *entries() {
      const result = await dep_helperJSON("/cases/list");
      for (const f of result.files) yield [f.name, { kind: "file", getFile: async () => ({ size: f.size, lastModified: f.mod }) }];
    },
  };
}

async function writeToFolder(name, body) {
  if (dep_recordIntegrity.status(JSON.parse(body).case).valid === false)
    return { ok: false, why: "This record was changed outside the program. Read-only." };
  if (WriterState.CASEDIR && WriterState.CASEDIR.helper) {
    try {
      const file = JSON.parse(body),
        base = dep_COMMITTED.get(dep_summaryName(file.case));
      const local = WriterState.CASES.find((k) => k.number === file.case.number),
        checkpoint = local && WriterState.SAVE_CHECKPOINTS[local.id];
      const result = await dep_helperJSON(
        "/cases/save",
        caseStoreRequest({ name: name, file: file, baseRevision: (base && base.revision) || "", baseCase: checkpoint ? checkpoint.case : null }),
      );
      if (result.file.schema >= 5) await dep_recordIntegrity.verify(result.file, result.integrity);
      dep_COMMITTED.set(dep_summaryName(result.file.case), result);
      const current = WriterState.CASES.find((k) => k.number === result.file.case.number);
      if (current) {
        const saved = dep_caseDetails(result.file.case),
          submitted = dep_caseDetails(file.case);
        new Set(Object.keys(submitted).concat(Object.keys(saved))).forEach((key) => {
          if (key === "id") return;
          if (dep_stableJSON(current[key]) === dep_stableJSON(submitted[key])) {
            if (saved[key] === undefined) delete current[key];
            else current[key] = dep_clone(saved[key]);
          }
        });
        dep_mergeCaseEvents(current, dep_clone(result.file));
        dep_project();
      }
      WriterState.LASTWRITE = { name: result.name, ok: true, why: "", at: dep_nowISO(), bytes: body.length };
      return { ok: true, file: result.file, name: result.name };
    } catch (error) {
      WriterState.LASTWRITE = { name: name, ok: false, why: error.message, at: dep_nowISO() };
      return { ok: false, why: error.message };
    }
  }
  if (JSON.parse(body).schema >= 5) {
    const why = "Schema 5 requires the local helper to maintain the integrity chain.";
    WriterState.LASTWRITE = { name, ok: false, why, at: dep_nowISO() };
    return { ok: false, why };
  }
  if (!WriterState.CASEDIR) return { ok: false, why: "no folder linked" };
  if (WriterState.NEEDGRANT) return { ok: false, why: "permission", needGrant: true };
  try {
    const fh = await WriterState.CASEDIR.getFileHandle(name, { create: true });
    const ws = await fh.createWritable();
    await ws.write(body);
    await ws.close();
    WriterState.LASTWRITE = { name: name, ok: true, why: "", at: dep_nowISO(), bytes: body.length };
    return { ok: true };
  } catch (err) {
    const n = (err && err.name) || "";
    const why = n === "NotAllowedError" || n === "SecurityError" ? "permission" : (err && err.message) || n || "the folder refused the write";
    WriterState.LASTWRITE = { name: name, ok: false, why: (n ? n + ": " : "") + why, at: dep_nowISO() };
    if (why === "permission") {
      WriterState.NEEDGRANT = true;
      return { ok: false, why: "permission", needGrant: true };
    }
    return { ok: false, why: why };
  }
}

async function writeIndexFile(name, body) {
  if (WriterState.CASEDIR && WriterState.CASEDIR.helper) {
    const committed = dep_COMMITTED.get(name);
    if (!committed) return { ok: false, why: "The case has not been read or saved yet" };
    try {
      await dep_helperJSON("/cases/summary", { name: committed.name, revision: committed.revision, summary: JSON.parse(body) });
      return { ok: true };
    } catch (error) {
      return { ok: false, why: error.message };
    }
  }
  if (JSON.parse(body).schema >= 5) {
    const why = "Schema 5 requires the local helper to maintain the integrity chain.";
    WriterState.LASTWRITE = { name, ok: false, why, at: dep_nowISO() };
    return { ok: false, why };
  }
  if (!WriterState.CASEDIR) return { ok: false, why: "no folder linked" };
  if (WriterState.NEEDGRANT) return { ok: false, why: "permission" };
  try {
    const dir = await WriterState.CASEDIR.getDirectoryHandle(dep_SUMMARY_DIR, { create: true });
    const fh = await dir.getFileHandle(name, { create: true });
    const ws = await fh.createWritable();
    await ws.write(body);
    await ws.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, why: (err && (err.message || err.name)) || "the folder refused the write" };
  }
}

async function writeSummary(cid, saved) {
  const k = dep_kase(cid);
  if (!dep_caseNumberAllowed(k)) {
    dep_toast("Case number needs correction before reporting");
    return false;
  }
  const name = dep_summaryName(k);
  let body;
  try {
    body = JSON.stringify(dep_summarize(saved || dep_caseFile(cid)));
  } catch (err) {
    WriterState.LASTINDEX = { name: name, ok: false, why: "could not be assembled: " + ((err && err.message) || err), at: dep_nowISO() };
    return false;
  }
  const r = await writeIndexFile(name, body);
  WriterState.LASTINDEX = { name: name, ok: r.ok, why: r.why || "", at: dep_nowISO() };
  return r.ok;
}

async function rebuildIndex() {
  if (!WriterState.CASEDIR) {
    dep_toast("Link the case folder first");
    return null;
  }
  if (WriterState.NEEDGRANT) await dep_grantCaseFolder(true);
  if (WriterState.NEEDGRANT) {
    dep_toast("The browser did not grant access to " + WriterState.DIRNAME + " — the index was not rebuilt");
    return null;
  }
  const files = (await listCaseFolder()).filter((x) => x.name.charAt(0) !== "_");
  const out = { written: 0, refused: [], failed: [], total: files.length, at: dep_nowISO() };
  WriterState.state.reindex = { running: true, done: 0, total: files.length };
  dep_render();
  for (let n = 0; n < files.length; n++) {
    const nm = files[n].name;
    let f;
    try {
      const fh = await WriterState.CASEDIR.getFileHandle(nm);
      f = dep_migrate(JSON.parse(await (await fh.getFile()).text()));
    } catch (err) {
      out.refused.push(nm + " \u2014 " + ((err && err.message) || "not readable"));
      continue;
    }
    const fault = dep_caseFileFault(f);
    if (fault) {
      out.refused.push(nm + " \u2014 " + fault);
      continue;
    }
    let body;
    try {
      body = JSON.stringify(dep_summarize(f));
    } catch (err) {
      out.refused.push(nm + " \u2014 could not be summarized: " + ((err && err.message) || err));
      continue;
    }
    const r = await writeIndexFile(dep_summaryName(f["case"]), body);
    if (r.ok) out.written++;
    else out.failed.push(nm + " \u2014 " + r.why);
    WriterState.state.reindex.done = n + 1;
  }
  WriterState.state.reindex = out;
  WriterState.LASTINDEX = {
    name: out.written + " of " + out.total + " case files",
    ok: !out.failed.length,
    why: out.failed.length ? out.failed.length + " could not be written" : "",
    at: out.at,
  };
  dep_render();
  dep_toast(
    "Reporting index rebuilt \u2014 " +
      out.written +
      " of " +
      out.total +
      " case file" +
      (out.total === 1 ? "" : "s") +
      (out.refused.length ? ", " + out.refused.length + " refused" : "") +
      (out.failed.length ? ", " + out.failed.length + " not written" : ""),
  );
  return out;
}

async function listCaseFolder() {
  if (!WriterState.CASEDIR || WriterState.NEEDGRANT) return [];
  const out = [];
  try {
    for await (const [name, h] of WriterState.CASEDIR.entries()) {
      if (h.kind === "file" && /\.json$/i.test(name)) {
        let size = 0,
          mod = 0;
        try {
          const f = await h.getFile();
          size = f.size;
          mod = f.lastModified;
        } catch (e) {
          /* Unreadable optional directory metadata stays unknown; opening and saving still validate actual bytes. */
        }
        out.push({ name: name, size: size, mod: mod });
      }
    }
  } catch (e) {
    dep_toast("Could not read the case folder — " + (e.message || e));
    WriterState.state.folderError = e.message || String(e);
  }
  return out.sort((a, b) => b.mod - a.mod);
}

async function openFromFolder(name) {
  if (!WriterState.CASEDIR) return;
  try {
    const fh = await WriterState.CASEDIR.getFileHandle(name);
    const f = await fh.getFile();
    const raw = await f.text(),
      record = JSON.parse(raw);
    if (record.schema >= 5) await dep_recordIntegrity.verify(record);
    dep_loadCaseFile(raw);
  } catch (e) {
    dep_toast("Could not open " + name);
  }
}

function downloadFile(name, body) {
  const blob = new Blob([body], { type: "application/json" });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function queuePending(name, body, cid) {
  WriterState.PENDING = WriterState.PENDING.filter((p) => p.name !== name);
  WriterState.PENDING.push({ name: name, body: body, cid: cid || "", at: dep_nowISO() });
  const kept = await dep_idbSet("pending", WriterState.PENDING);
  if (!kept) dep_toast("This machine would not store the held file — keep the program open until the folder is back");
  return kept;
}

async function restorePending() {
  const p = await dep_idbGet("pending");
  if (Array.isArray(p) && p.length) {
    WriterState.PENDING = p;
    dep_render();
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
      const loaded = dep_loadCaseFile(p.body, false);
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
        await mergeSharedFile(p.cid, p.name);
      } catch (err) {
        still.push(p);
        continue;
      }
      try {
        body = JSON.stringify(dep_caseFile(p.cid), null, 2);
      } catch (err) {
        body = p.body;
      }
    }
    const r = await writeToFolder(p.name, body);
    if (r.ok) {
      done++;
      if (p.cid && WriterState.CASES.some((k) => k.id === p.cid)) {
        dep_rememberSaved(dep_kase(p.cid), r.file || JSON.parse(body));
        await writeSummary(p.cid, r.file || JSON.parse(body));
      }
    } else still.push(p);
  }
  WriterState.PENDING = still.concat(WriterState.PENDING.filter((p) => batch.indexOf(p) < 0));
  await dep_idbSet("pending", WriterState.PENDING);
  await saveDrafts();
  if (done) {
    dep_toast(done + " held case file" + (done === 1 ? "" : "s") + " written to the share");
    dep_render();
  }
  return done;
}

async function mergeSharedFile(cid, name) {
  if (!WriterState.CASEDIR || WriterState.NEEDGRANT) return 0;
  const k = dep_kase(cid);
  if (!k.id) return 0;
  let text = null;
  try {
    const fh = await WriterState.CASEDIR.getFileHandle(name); // absent is the normal first save
    text = await (await fh.getFile()).text();
  } catch (err) {
    if (err && (err.name === "NotFoundError" || err.message === "missing")) return 0;
    throw new Error("The existing case file could not be read; it has not been overwritten");
  }
  let f;
  try {
    f = dep_migrate(JSON.parse(text));
  } catch (err) {
    throw new Error("The existing case file is unreadable; it has not been overwritten");
  }
  const fault = dep_caseFileFault(f);
  if (fault) throw new Error("The existing case file is invalid: " + fault);
  if (String((f["case"] || {}).number || "") !== String(k.number || "")) throw new Error("The existing file belongs to another case");
  if (f.schema >= 5) {
    const status = await dep_recordIntegrity.verify(f);
    if (!status.valid) throw new Error("This record was changed outside the program. Open read-only.");
  }
  const added = dep_mergeCaseEvents(k, f);
  if (added) dep_project();
  return added;
}

async function saveCaseFile(cid) {
  if (!dep_caseNumberAllowed(dep_kase(cid))) {
    dep_toast("Case number must use 3–80 letters, numbers or hyphens");
    return false;
  }
  const k = dep_kase(cid),
    name = dep_caseFileName(k);
  let body;
  try {
    body = JSON.stringify(dep_caseFile(cid), null, 2);
    if (typeof body !== "string" || !body.length) throw new Error("The case did not produce a readable record");
  } catch (err) {
    dep_toast("The case could not be exported — " + ((err && err.message) || "unknown error"));
    return false;
  }

  if (!WriterState.CASEDIR) {
    if (JSON.parse(body).schema >= 5) {
      dep_downloadWorkspace();
      dep_toast("Workspace backup downloaded. Connect the current helper to save a verified case record.");
      return false;
    }
    WriterState.LASTWRITE = { name: name, ok: true, why: "downloads folder (no case folder linked)", at: dep_nowISO(), bytes: body.length };
    dep_rememberSaved(k, JSON.parse(body));
    downloadFile(name, body);
    WriterState.DIRTY = false;
    dep_toast("Saved to your downloads — " + name + " (the case folder is not linked)");
    dep_render();
    return true;
  }
  // Chrome asks to confirm the folder once a session. Finalizing is a click, so
  // ask now rather than queueing the file behind a message nobody reads.
  if (WriterState.NEEDGRANT) await dep_grantCaseFolder(true);

  let merged = 0;
  try {
    merged = await mergeSharedFile(cid, name);
  } catch (err) {
    await queuePending(name, body, cid);
    dep_toast(err.message);
    dep_render();
    return false;
  }
  try {
    body = JSON.stringify(dep_caseFile(cid), null, 2);
    if (typeof body !== "string" || !body.length) throw new Error("The case did not produce a readable record");
  } catch (err) {
    dep_toast("The case could not be exported — " + ((err && err.message) || "unknown error"));
    return false;
  }

  let r = await writeToFolder(name, body);
  if (!r.ok && r.needGrant) {
    await dep_grantCaseFolder(true);
    r = await writeToFolder(name, body);
  }
  if (r.ok) {
    // a held copy of this same file is now out of date and must not be
    // written over the newer one when the queue next flushes
    if (WriterState.PENDING.some((p) => p.name === name)) {
      WriterState.PENDING = WriterState.PENDING.filter((p) => p.name !== name);
      await dep_idbSet("pending", WriterState.PENDING);
    }
    WriterState.DIRTY = false;
    dep_rememberSaved(k, r.file || JSON.parse(body));
    await writeSummary(cid, r.file || JSON.parse(body));
    await saveDrafts();
    dep_toast(
      "Saved to " +
        WriterState.DIRNAME +
        " \u2014 " +
        name +
        (merged ? " (merged " + merged + " event" + (merged === 1 ? "" : "s") + " another inspector had written)" : ""),
    );
    dep_render();
    return true;
  }

  await queuePending(name, body, cid);
  dep_toast(
    r.needGrant
      ? "The browser is still waiting for permission on " + WriterState.DIRNAME + " — the file is held and will write once you reconnect"
      : "Could not write to " + WriterState.DIRNAME + " (" + r.why + ") — the file is held and will write when the folder is reachable",
  );
  dep_render();
  return false;
}

function draftBundle() {
  const cases = WriterState.CASES.slice();
  const events = {};
  cases.forEach((k) => {
    const evs = dep_eventsFor(k.id);
    if (evs.length) events[k.id] = dep_clone(evs);
  });
  return {
    docs: WriterState.DOCS.filter((d) => d.draft),
    reinsp: WriterState.REINSP.filter((r) => r.draft),
    cases: cases,
    events: events,
    work: dep_clone(WriterState.WORK),
    recordAttempts: dep_clone(WriterState.RECORD_ATTEMPTS),
    integrityRecords: dep_recordIntegrity.snapshot(),
    checkpoints: dep_clone(WriterState.SAVE_CHECKPOINTS),
    seq: WriterState.seq,
    at: dep_nowISO(),
  };
}

async function saveDrafts() {
  if (!WriterState.WRITER_ACCESS) return false;
  if (WriterState.WORK_PATCH) await WriterState.WORK_PATCH;
  dep_captureWork();
  const generation = ++WriterState.LOCAL_CHANGED,
    snapshot = dep_clone(draftBundle());
  WriterState.LOCAL_SAVE.saving = true;
  updateSaveStatus();
  const task = WriterState.LOCAL_SAVE_CHAIN.then(() => dep_idbSet("drafts", snapshot));
  WriterState.LOCAL_SAVE_CHAIN = task.catch(() => false);
  const kept = await task;
  if (generation === WriterState.LOCAL_CHANGED) {
    WriterState.LOCAL_SAVE = { ok: kept, at: kept ? dep_nowISO() : WriterState.LOCAL_SAVE.at, saving: false };
    if (kept && !WriterState.draftTimer) WriterState.DIRTY = false;
    updateSaveStatus();
  }
  if (kept && generation === WriterState.LOCAL_CHANGED) dep_scheduleRecoveryBackup();
  return kept;
}

function updateSaveStatus() {
  const el = document.getElementById("save-status");
  if (el) {
    el.textContent = localSaveText(app_savedworkContext());
    el.classList.toggle("save-error", !WriterState.LOCAL_SAVE.ok);
  }
  updateLocalPresentation(app_savedworkContext());
}

function scheduleDraftSave() {
  WriterState.DIRTY = true;
  ++WriterState.LOCAL_CHANGED;
  if (!dep_IDB_OK) {
    WriterState.LOCAL_SAVE.ok = false;
    updateSaveStatus();
    return;
  }
  if (WriterState.draftTimer) clearTimeout(WriterState.draftTimer);
  WriterState.draftTimer = setTimeout(() => {
    WriterState.draftTimer = null;
    saveDrafts();
  }, 1500);
}

async function restoreDrafts() {
  const b = await dep_idbGet("drafts");
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
    dep_eventsFor(cid).forEach((e) => {
      have[e.id] = 1;
    });
    (evs[cid] || []).forEach((e) => {
      if (e && e.id && !have[e.id]) dep_eventsFor(cid).push(e);
    });
    dep_eventsFor(cid).sort(dep_byTime);
  });
  await dep_recordIntegrity.restore(b.integrityRecords);
  (b.docs || []).forEach((d) => {
    if (!WriterState.DOCS.some((x) => x.id === d.id)) WriterState.DOCS.unshift(d);
  });
  (b.reinsp || []).forEach((r) => {
    if (!WriterState.REINSP.some((x) => x.id === r.id)) WriterState.REINSP.push(r);
  });
  dep_project();
  dep_render();
  const n = (b.docs || []).length + (b.reinsp || []).length;
  if (n) dep_toast(n + " unfinished draft" + (n === 1 ? "" : "s") + " restored from this machine");
}

async function discardDraft(id) {
  const d = dep_doc(id);
  if (d && d.pendingAmendment) {
    dep_toast("Retry the pending save before discarding this correction.");
    return false;
  }
  WriterState.DOCS = WriterState.DOCS.filter((d) => !(d.draft && d.id === id));
  WriterState.REINSP = WriterState.REINSP.filter((r) => !(r.draft && r.id === id));
  if (WriterState.state.reinspId === id) {
    dep_clearWalk();
    WriterState.WORK.walk = null;
  }
  // a worksheet still pointing at the discarded follow-up reads as finished
  // and will not write another one
  WriterState.REINSP.forEach((r) => {
    if (r.draft && r.docId === id) r.docId = null;
  });
  await saveDrafts();
  dep_render();
}

async function bootStorage() {
  if (navigator.locks && navigator.locks.request) {
    WriterState.WRITER_ACCESS = false;
    const acquired = await new Promise((resolve) =>
      navigator.locks
        .request("madison-writer-workspace", { ifAvailable: true }, (lock) => {
          if (!lock) {
            resolve(false);
            return;
          }
          resolve(true);
          return new Promise(() => {}); // held until this tab closes
        })
        .catch(() => resolve(false)),
    );
    if (!acquired) {
      document.getElementById("app").innerHTML =
        '<main style="max-width:620px;margin:12vh auto;padding:28px;font-family:s' +
        'ystem-ui"><h1>Document Writer is already open</h1><p>Continue in your ex' +
        "isting Writer tab. To use this tab, close the other Writer tab and reloa" +
        "d this page.</p><button data-reload-tab>Reload this tab</button> <a href" +
        '="madison-reports.html">Open Reports</a></main>';
      document.querySelector("[data-reload-tab]").addEventListener("click", () => location.reload());
      return;
    }
  }
  WriterState.WRITER_ACCESS = true;
  dep_initWriterHandoff();
  await dep_checkHelper();
  if (WriterState.HELPER) await dep_refreshCatalog();
  await dep_restoreCaseFolder();
  await restorePending();
  await restoreDrafts();
  await dep_recordIntegrity.refresh();
  await dep_refreshArtifactLocations();
  await flushPending();
  dep_markWriterReady();
  if (WriterState.HELPER) dep_scheduleRecoveryBackup();
}

function pickCaseFile() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json,application/json";
  inp.onchange = () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onerror = () => dep_toast("That file could not be read from this machine");
    fr.onload = () => {
      try {
        dep_loadCaseFile(String(fr.result));
      } catch (err) {
        dep_toast("That case file was not loaded — " + ((err && err.message) || "it could not be read"));
      }
    };
    fr.readAsText(file);
  };
  inp.click();
}

function postalTitle(word) {
  if (/^[A-Z][a-z].*[A-Z]/.test(word)) return word; // keep intentional spelling such as McFarland
  return word.toLowerCase().replace(/(^|[-'’])([a-z])/g, (_, edge, letter) => edge + letter.toUpperCase());
}

function standardStreetAddress(value) {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  const street = raw.replace(/,\s*(?=(?:apt|apartment|ste|suite|unit|fl|floor|rm|room)\b|#)/gi, " ");
  const match = street.match(/^(\d+[A-Za-z]?(?:[-/]\d+[A-Za-z]?)?)\s+(.+)$/);
  if (!match || street.includes(",") || !/[A-Za-z]/.test(match[2]) || /\bP\.?\s*O\.?\s+BOX\b/i.test(street)) return "";
  const suffix = {
    street: "St",
    st: "St",
    avenue: "Ave",
    ave: "Ave",
    boulevard: "Blvd",
    blvd: "Blvd",
    road: "Rd",
    rd: "Rd",
    drive: "Dr",
    dr: "Dr",
    lane: "Ln",
    ln: "Ln",
    court: "Ct",
    ct: "Ct",
    circle: "Cir",
    cir: "Cir",
    parkway: "Pkwy",
    pkwy: "Pkwy",
    place: "Pl",
    pl: "Pl",
    terrace: "Ter",
    ter: "Ter",
    highway: "Hwy",
    hwy: "Hwy",
    apartment: "Apt",
    apt: "Apt",
    suite: "Ste",
    ste: "Ste",
    floor: "Fl",
    fl: "Fl",
    room: "Rm",
    rm: "Rm",
    unit: "Unit",
  };
  const directionWords = { north: "N", south: "S", east: "E", west: "W", northeast: "NE", northwest: "NW", southeast: "SE", southwest: "SW" };
  const directions = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);
  const parts = street.split(" ");
  const formatted = parts
    .map((part, index) => {
      if (index === 0) return part.toUpperCase();
      const bare = part.replace(/\.$/, "");
      const key = bare.toLowerCase();
      if (directionWords[key]) return directionWords[key];
      if (directions.has(bare.toUpperCase())) return bare.toUpperCase();
      return suffix[key] || postalTitle(bare);
    })
    .join(" ");
  return formatted;
}

function standardCityStateZip(value) {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  const zipMatch = raw.match(/^(.*?)[,\s]+(\d{5}(?:-?\d{4})?)$/);
  if (!zipMatch) return "";
  const area = zipMatch[1].replace(/,\s*$/, "").trim(),
    zip = zipMatch[2].replace(/^(\d{5})(\d{4})$/, "$1-$2");
  // Prefer the longest complete state name; no partial suffix matches.
  const states = Object.entries(dep_STATE_NAMES)
    .sort((a, b) => b[0].length - a[0].length)
    .concat(Array.from(dep_US_STATES, (x) => [x.toLowerCase(), x]));
  let city = "",
    state = "";
  for (const [name, abbr] of states) {
    const suffix = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = area.match(new RegExp("^(.+?)(?:,\\s*|\\s+)(" + suffix + ")$", "i"));
    if (match) {
      city = match[1].trim();
      state = abbr;
      break;
    }
  }
  if (!state || !city || !/^[A-Za-z][A-Za-z .'-]*$/.test(city)) return "";
  return (
    city
      .split(/(\s+|[-'])/)
      .map((part) => (/^[A-Za-z]/.test(part) ? postalTitle(part) : part))
      .join("") +
    ", " +
    state +
    " " +
    zip
  );
}

function addressProblem(name, street, city) {
  if (!String(name || "").trim()) return "Enter the recipient name.";
  if (!standardStreetAddress(street)) return "Enter a street address with a street number and name (for example, 123 Main St).";
  if (!standardCityStateZip(city))
    return (
      "Enter city, a complete state name or two-letter abbreviation, and ZIP (f" +
      "or example, Madison, WI 53703). Check ambiguous or unsupported state tex" +
      "t."
    );
  return "";
}

function validateAndStandardizeAddresses(k, requireAgent = false, normalize = true) {
  const parsedFault = dep_addressParser.fault(k);
  if (parsedFault) return parsedFault;
  const normalized = [];
  for (let ix = 0; ix < dep_ccList(k).length; ix++) {
    const c = dep_ccList(k)[ix];
    if (!String(c.name || "").trim() && !String(c.addr || "").trim() && !String(c.city || "").trim()) continue;
    if (dep_addressParser.accepted(c.addressParsed, [c.addr || "", c.city || ""]) && String(c.name || "").trim()) continue;
    const problem = addressProblem(c.name, c.addr, c.city);
    if (problem) {
      const field = !String(c.name || "").trim() ? "name" : !standardStreetAddress(c.addr) ? "addr" : "city";
      return { message: "Copy " + (ix + 1) + ": " + problem, scope: "copy", index: ix, field, selector: '[data-cc="' + ix + "|" + field + '"]' };
    }
    normalized.push([c, String(c.name).trim(), standardStreetAddress(c.addr), standardCityStateZip(c.city)]);
  }
  const a = k.agent || {},
    entered = [a.name, a.addr, a.city].some((v) => String(v || "").trim());
  const acceptedAgent = dep_addressParser.accepted(a.addressParsed, [a.addr || "", a.city || ""]) && String(a.name || "").trim();
  if ((requireAgent || entered) && !acceptedAgent) {
    const problem = addressProblem(a.name, a.addr, a.city);
    if (problem) {
      const field = !String(a.name || "").trim() ? "name" : !standardStreetAddress(a.addr) ? "addr" : "city";
      return { message: "Registered agent: " + problem, scope: "agent", index: 0, field, selector: '[data-agent="' + field + '"]' };
    }
  }
  if (normalize) {
    normalized.forEach(([c, name, addr, city]) => {
      c.name = name;
      c.addr = addr;
      c.city = city;
    });
    if (entered && !acceptedAgent) {
      a.addr = standardStreetAddress(a.addr);
      a.city = standardCityStateZip(a.city);
      a.name = String(a.name).trim();
      k.agent = a;
    }
  }
  return null;
}

function recipientPreview(c) {
  if (dep_addressParser.accepted(c.addressParsed, [c.addr || "", c.city || ""])) return "Accepted mailing lines: " + [c.addr, c.city].join(" · ");
  const street = standardStreetAddress(c.addr),
    city = standardCityStateZip(c.city);
  return street && city ? "Printed as: " + street + " · " + city : "";
}

function addCC(cid) {
  const current = dep_doc(WriterState.state.docId),
    k = current && current.caseId === cid && current.correction ? dep_docCase(current) : dep_kase(cid);
  k.ccList = dep_ccList(k).concat([{ name: "", addr: "", city: "" }]);
  WriterState.DIRTY = true;
  dep_render();
}

function removeCC(cid, ix) {
  const current = dep_doc(WriterState.state.docId),
    k = current && current.caseId === cid && current.correction ? dep_docCase(current) : dep_kase(cid);
  k.ccList = dep_ccList(k).filter((_, n) => n !== ix);
  WriterState.DIRTY = true;
  dep_render();
}

function addEmail(cid) {
  const current = dep_doc(WriterState.state.docId),
    k = current && current.caseId === cid && current.correction ? dep_docCase(current) : dep_kase(cid);
  k.emails = dep_emailList(k).concat([{ addr: "", kind: "Property Owner" }]);
  WriterState.DIRTY = true;
  dep_render();
}

function removeEmail(cid, ix) {
  const current = dep_doc(WriterState.state.docId),
    k = current && current.caseId === cid && current.correction ? dep_docCase(current) : dep_kase(cid);
  k.emails = dep_emailList(k).filter((_, n) => n !== ix);
  WriterState.DIRTY = true;
  dep_render();
}

function caseUnsaved(k) {
  if (Object.values(WriterState.RECORD_ATTEMPTS).some((x) => x.cid === k.id)) return "record change awaiting save confirmation";
  if (WriterState.PENDING.some((p) => p.cid === k.id || (!!dep_caseFileName(k) && p.name === dep_caseFileName(k))))
    return "case file waiting to reach the share";
  const evs = dep_eventsFor(k.id);
  const drafts = WriterState.DOCS.some((d) => d.draft && d.caseId === k.id) || WriterState.REINSP.some((r) => r.draft && r.caseId === k.id);
  if (drafts) return "unfinished drafts";
  if (!evs.length && !WriterState.SAVE_CHECKPOINTS[k.id]) return "case details saved only on this device";
  if (!k.savedAt) return "issued documents never written to the share";
  const checkpoint = WriterState.SAVE_CHECKPOINTS[k.id];
  if (checkpoint) {
    const known = new Set(checkpoint.events || []);
    return evs.some((e) => !known.has(e.id)) || dep_stableJSON(dep_caseDetails(k)) !== dep_stableJSON(dep_caseDetails(checkpoint.case))
      ? "changes made since the last save"
      : "";
  }
  const newest =
    evs
      .map((e) => e.at)
      .sort()
      .slice(-1)[0] || "";
  return newest > k.savedAt ? "changes made since the last save" : "";
}

function removeCase(cid) {
  if (Object.values(WriterState.RECORD_ATTEMPTS).some((x) => x.cid === cid) || dep_docsFor(cid).some((x) => x.pendingAmendment)) {
    dep_toast("Confirm pending record saves before putting this case away.");
    return false;
  }
  WriterState.CASES = WriterState.CASES.filter((c) => c.id !== cid);
  WriterState.DOCS = WriterState.DOCS.filter((d) => d.caseId !== cid);
  WriterState.REINSP = WriterState.REINSP.filter((r) => r.caseId !== cid);
  if (dep_reinsp(WriterState.state.reinspId)?.caseId === cid) {
    dep_clearWalk();
    WriterState.WORK.walk = null;
  }
  delete WriterState.EVENTS[cid];
  if (WriterState.state.docId && !dep_doc(WriterState.state.docId)) WriterState.state.docId = null;
  saveDrafts();
}

function clearCases(which) {
  const gone = [];
  WriterState.CASES.slice().forEach((k) => {
    const risky = caseUnsaved(k);
    if (which === "safe" && risky) return;
    gone.push(k.number);
    removeCase(k.id);
  });
  WriterState.state.modal = null;
  WriterState.state.screen = "cases";
  dep_render();
  dep_toast(gone.length ? gone.length + " case" + (gone.length === 1 ? "" : "s") + " cleared from the list" : "Nothing to clear");
}

function startReinspection(cid, importedRow) {
  if (dep_snow.isCase(dep_kase(cid))) {
    dep_toast("Snow cases cite each inspection directly; import the next snow inspection instead of creating a reinspection.");
    return;
  }
  if (dep_recordIntegrity.blocked(cid)) {
    dep_toast("This record was changed outside the program. Read-only.");
    return;
  }
  dep_clearWalk();
  const correction = dep_draftDocFor(cid);
  if (correction && correction.correction) {
    WriterState.state.docId = correction.id;
    WriterState.state.screen = "write";
    dep_render();
    dep_toast("Finish or discard the correction before starting another inspection");
    return;
  }
  const unfinished = dep_draftDocFor(cid);
  if (unfinished) {
    WriterState.state.docId = unfinished.id;
    WriterState.state.screen = "write";
    dep_render();
    dep_toast("Continue the unfinished document first.");
    return;
  }
  const open = dep_draftReinspFor(cid) || dep_unissuedVisitFor(cid);
  if (open) {
    if (importedRow) {
      const oldDate = open.date;
      open.date = importedRow.date;
      open.time = importedRow.time || "";
      open.inspectorId = importedRow.inspectorId || open.inspectorId;
      open.importInspection = dep_inspectionIdentity(importedRow);
      Object.values(open.results || {}).forEach((res) => {
        if (!res.carried && !res.manualDate && (!res.on || res.on === oldDate)) res.on = open.date;
      });
    }
    WriterState.state.reinspId = open.id;
    WriterState.state.screen = "reinspect";
    dep_restoreWalkFor(open);
    dep_render();
    return;
  }
  const src = dep_sourceDocFor(cid);
  if (!src || !src.items.length) {
    dep_toast("Finish and issue the notice first — a reinspection works off the document the owner received");
    return;
  }
  if (src.type === "compliance" || src.items.every((i) => i.withdrawn)) {
    dep_toast("This case is completed. Use a new case for new observations or correct a" + " recording error from the document history.");
    return;
  }
  const k = dep_kase(cid);
  const r = {
    expectedHead: dep_recordHead(cid),
    id: dep_uid("r"),
    caseId: cid,
    sourceDocId: src.id,
    date: (importedRow && importedRow.date) || dep_recordDay(today),
    time: (importedRow && importedRow.time) || "",
    draft: true,
    inspectorId: (importedRow && importedRow.inspectorId) || k.inspectorId,
    results: {},
    docId: null,
    ...(importedRow ? { importInspection: dep_inspectionIdentity(importedRow) } : {}),
  };
  dep_newDocuments.continuingItems(src).forEach((it) => {
    if (it.done || it.withdrawn)
      r.results[it.id] = { oc: it.withdrawn ? "withdrawn" : "corrected", on: it.doneOn || "", due: "", note: "", cite: false, carried: true };
  });
  WriterState.WORK.walk = null;
  WriterState.REINSP.push(r);
  WriterState.state.reinspId = r.id;
  WriterState.state.screen = "reinspect";
  WriterState.DIRTY = true;
  saveDrafts();
  dep_render();
}

export {
  helperFolder,
  writeToFolder,
  writeIndexFile,
  writeSummary,
  rebuildIndex,
  listCaseFolder,
  openFromFolder,
  downloadFile,
  queuePending,
  restorePending,
  flushPending,
  mergeSharedFile,
  saveCaseFile,
  draftBundle,
  saveDrafts,
  updateSaveStatus,
  scheduleDraftSave,
  restoreDrafts,
  discardDraft,
  bootStorage,
  pickCaseFile,
  postalTitle,
  standardStreetAddress,
  standardCityStateZip,
  addressProblem,
  validateAndStandardizeAddresses,
  recipientPreview,
  addCC,
  removeCC,
  addEmail,
  removeEmail,
  caseUnsaved,
  removeCase,
  clearCases,
  startReinspection,
};
