import { caseFileFault, mergeCaseDetails, correctionHistoryFault } from "./case_file_rules.js";

import { migrate } from "./case_migrations.js";
import { replayEvents, summarizeRecord } from "./case_projection.js";

import { caseDetails, stableJSON, byTime, clone } from "./record_values.js";

import { APPROVED_PRINT_STYLE } from "./data/approved_print_style.js";
import { SUMMARY_DIR, caseNumberKey, validCaseNumber } from "../assets/shared.js";
import { fmtDate, fmtTime, toast } from "./court_and_deposits.js";
import { flushPending, helperFolder, saveDrafts, writeToFolder } from "./case_files.js";

import { refreshArtifactLocations } from "./case_timeline.js";
import { render } from "./app_screens.js";
import { CASEDIR_EXPECT, FS_OK, IDB_OK, navigation, recordIntegrity, storageMode } from "./app_core.js";

import { EVENT_TYPES, SCHEMA } from "./document_types.js";
import { nowISO } from "./calendar.js";
import { doc, docCase, docsFor, eventsFor, insp, kase } from "./writer_queries.js";

import { esc } from "./presentation_format.js";
import { supplemental } from "./document_rules.js";
import { app_savedworkContext } from "./app_view_contexts.js";

import { BUILD, LOGO } from "./data/build_identity.js";
import { INSPECTORS } from "./data/inspectors.js";
import { LIBRARY } from "./data/library.js";

import { WriterState } from "./state.js";
import { authFetch } from "./helper_transport.js";
import { connectionBanner } from "./saved_work.js";
import { makeEvent } from "./contracts.js";
/* app functions; direct dependencies use explicit shared state. */

function printableHTML(documentOverride, sheetOverride) {
  const d = documentOverride || doc(WriterState.state.docId);
  if (!d) return "";
  const k = docCase(d);
  const sheet = sheetOverride || document.querySelector(".desk");
  if (!sheet) {
    toast("Nothing to print");
    return;
  }
  const clone = sheet.cloneNode(true);
  // A compact editor preference must never suppress a copy in printable HTML,
  // including the fallback path that clones an already enhanced editor.
  clone.querySelectorAll("[data-editor-extra-copy]").forEach((n) => n.removeAttribute("data-editor-extra-copy"));
  clone.querySelectorAll(".grip,.gbtn,.rm,.addrow,.no-print").forEach((n) => n.remove());
  clone.querySelectorAll("[contenteditable]").forEach((n) => n.removeAttribute("contenteditable"));
  // native inputs do not print reliably — swap them for their values
  clone.querySelectorAll("input,select,button").forEach((n) => {
    const s = document.createElement("span");
    s.textContent =
      n.tagName === "SELECT"
        ? (n.options[n.selectedIndex] || {}).text || ""
        : n.type === "date"
          ? n.value
            ? fmtDate(n.value)
            : ""
          : n.type === "time"
            ? fmtTime(n.value)
            : n.value || n.textContent || "";
    if (n.classList.contains("hdr-time")) {
      s.style.display = "block";
      s.textContent = " " + s.textContent;
    }
    n.replaceWith(s);
  });
  // Approved print CSS is frozen independently of screen-code formatting.
  const css = APPROVED_PRINT_STYLE;
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' +
    esc(k.number || "Official Notice") +
    "</title>" +
    "" +
    "<style>" +
    css +
    "</style>" +
    "<style>html,body{background:#fff;margin:0;padding:24px}" +
    // the sheet already carries the page margins; a @page margin on top of them
    // would push the address block out of the envelope window
    "@page{size:letter;margin:0}" +
    (".desk{background:none!important;border:0!important;padding:0!important;b" + "order-radius:0!important;overflow:visible!important}") +
    ".sheet{width:8.5in!important;min-height:11in!important;margin:0 auto 24px!important;" +
    "padding:.4in .6in .7in!important;" +
    "position:relative!important;box-sizing:border-box!important;" +
    "break-after:page!important;page-break-after:always!important;" +
    ("box-shadow:0 2px 10px rgba(0,0,0,.15);background:#fff!important;font-siz" + "e:9.6pt!important;line-height:1.42!important}") +
    ".sheet table.notice{display:table!important}.sheet table.notice thead{display:table-header-group!important}" +
    ".sheet table.notice tbody{display:table-row-group!important}" +
    (".sheet table.notice tr{display:table-row!important;background:none!impor" + "tant;border:0!important;padding:0!important;margin:0!important}") +
    (".sheet table.notice td{display:table-cell!important;border-bottom:.75px " +
      "solid #999!important;padding:7px 6px!important;margin:0!important}") +
    ".sheet .c-no{width:34px!important;font:inherit!important;border-bottom:.75px solid #999!important}" +
    ".sheet .c-sec::before,.sheet .c-ab::before,.sheet .corr::before,.sheet .c-due::before{display:none!important}" +
    ".sheet .n-owner,.sheet .n-body{border:0!important;background:none!important;padding:0!important}" +
    ".sheet .n-foot{position:absolute!important;left:.6in!important;right:.6in!important;" +
    "bottom:.34in!important;margin-top:0!important;border-top:1px solid #000!important;padding-top:6px!important}" +
    ".sheet .n-owner{position:absolute!important;left:.875in!important;top:2in!important;width:4in!important;" +
    "max-height:1.1in!important;margin:0!important;outline:0!important;" +
    "font-family:Arial,Helvetica,sans-serif!important;font-size:10pt!important;" +
    "line-height:1.32!important;text-transform:uppercase!important}" +
    ".sheet .n-winspace{display:block!important;height:1.5in!important}" +
    ".sheet .n-head{min-height:1.3in!important;max-height:1.58in!important;overflow:hidden!important;" +
    "display:flex!important;align-items:flex-start!important;box-sizing:border-box!important}" +
    ".sheet .n-meta{display:grid!important;font-size:9pt!important;" +
    "grid-template-columns:minmax(0,1fr) minmax(0,1.12fr)!important;gap:0 18px!important}" +
    ".sheet .n-col{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;" +
    "gap:2px 8px!important;align-content:start!important;margin:0!important}" +
    ".sheet .n-meta dt{white-space:nowrap!important}.sheet .n-col dd{margin:0!important}" +
    ".ed{border:0!important;background:none!important;padding:0!important;min-height:0!important}" +
    ".cit{width:8.5in!important;min-height:11in!important;box-sizing:border-box!important;" +
    "padding:.5in!important;margin:0 auto 24px!important;background:#fff!important;font-size:8pt!important;" +
    "break-after:page!important;page-break-after:always!important}" +
    (".cit:last-child,.sheet:last-child{margin-bottom:0!important;break-after:" + "auto!important;page-break-after:auto!important}") +
    ".cit-bar{display:grid!important;grid-template-columns:2.85in .78in 1.05in .72in 1fr!important}" +
    ".cit-dollar .cit-bar{grid-template-columns:2.6in .78in 1.55in .72in 1fr!important}" +
    ".cit-bar>div{display:flex!important;flex-direction:column!important;justify-content:center!important}" +
    ".cit-cols{display:grid!important;grid-template-columns:2.9in 1fr!important}" +
    ".cit-mid{display:grid!important;grid-template-columns:1fr 1.85in!important}" +
    ".cit-mid-l{display:flex!important;flex-direction:column!important}" +
    ".cit-when{display:grid!important;grid-template-columns:2.9in 1fr!important}" +
    ".cit-sign{display:grid!important;grid-template-columns:1.7in 1.25in .8in 1.15in 1fr!important}" +
    ".cit-ord{display:grid!important;grid-template-columns:1fr 1.15in!important}" +
    ".cit-bar>div+div,.cit-cols>div+div{border-left:1px solid #000!important;border-top:0!important}" +
    (".cit-when>div+div,.cit-sign>div+div,.cit-ord>div+div{border-left:.6px so" + "lid #000!important;border-top:0!important}") +
    ".cit-cells{display:flex!important;flex-direction:row!important}" +
    ".cit-cells>span{border-right:.6px solid #000!important;border-bottom:0!important;padding:0 5px 0 0!important}" +
    ".cit-cells>span:last-child{border-right:0!important}" +
    ("@media print{html,body{padding:0}.sheet,.cit{box-shadow:none!important;m" + "argin-bottom:0!important}}</style></head><body>") +
    clone.outerHTML +
    "</body></html>";
  return html;
}

function printNotice(job) {
  const d = (job && doc(job.docId)) || doc(WriterState.state.docId);
  if (!d) return;
  const k = kase(d.caseId);
  const html = (job && job.html) || printableHTML();
  if (!html) {
    toast("Nothing to print");
    return;
  }
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  let w = null;
  try {
    w = window.open(url, "_blank");
  } catch (err) {
    w = null;
  }
  if (w) {
    toast("Opened in a new tab — use your browser Print");
    let fired = false;
    const go = () => {
      if (fired) return;
      fired = true;
      try {
        w.focus();
        w.print();
      } catch (err) {
        /* The browser may refuse printing; the original PDF and manual print command remain available. */
      }
    };
    try {
      w.addEventListener("load", go);
    } catch (err) {
      /* The explicit print command remains available if the browser refuses the optional load listener. */
    }
    setTimeout(go, 1200);
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = "notice-" + (k.number || "draft") + ".html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Pop-up blocked — notice downloaded. Open the file and print.");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function storageReport() {
  const rows = [
    ["This build", BUILD],
    [
      "Served from",
      (function () {
        const L = (typeof window !== "undefined" && window.location) || null;
        if (!L) return "unknown";
        return L.protocol === "file:" ? "a file path — the folder features are unavailable here" : L.origin || L.href || "unknown";
      })(),
    ],
    ["Folder access (File System Access API)", FS_OK ? "available" : "NOT AVAILABLE in this browser or origin"],
    ["Local storage for drafts (IndexedDB)", IDB_OK ? "available" : "NOT AVAILABLE"],
    [
      "Case folder",
      WriterState.HELPER && WriterState.HELPER.caseStore
        ? WriterState.HELPER.caseDir
        : WriterState.CASEDIR
          ? (WriterState.DIRNAME || "linked") + (WriterState.DIRNAME === CASEDIR_EXPECT ? "" : '   <-- expected "' + CASEDIR_EXPECT + '"')
          : "not linked — files go to your downloads",
    ],
    ["Folder permission", !WriterState.CASEDIR ? "—" : WriterState.NEEDGRANT ? "waiting for you to reconnect" : "granted"],
    ["Mode", storageMode()],
    [
      "Files waiting to write",
      String(WriterState.PENDING.length) + (WriterState.PENDING.length ? " (" + WriterState.PENDING.map((p) => p.name).join(", ") + ")" : ""),
    ],
    [
      "PDF helper",
      WriterState.HELPER
        ? WriterState.HELPER.chrome
          ? "running, Chrome found"
          : "running, but Chrome was NOT found"
        : "not running — documents will print instead",
    ],
    ["PDF folder", WriterState.HELPER && WriterState.HELPER.out ? WriterState.HELPER.out : "—"],
    ["Outlook", !WriterState.HELPER ? "—" : WriterState.HELPER.outlook ? "found" : "NOT found — email falls back to your default mail program"],
    [
      "Last write",
      WriterState.LASTWRITE
        ? (WriterState.LASTWRITE.ok ? "OK — " : "FAILED — ") +
          WriterState.LASTWRITE.name +
          (WriterState.LASTWRITE.why ? " (" + WriterState.LASTWRITE.why + ")" : "") +
          (WriterState.LASTWRITE.bytes ? " · " + WriterState.LASTWRITE.bytes + " bytes" : "") +
          " · " +
          fmtDate(String(WriterState.LASTWRITE.at).slice(0, 10))
        : "nothing written yet this session",
    ],
    [
      "Reporting index",
      WriterState.LASTINDEX
        ? (WriterState.LASTINDEX.ok ? "OK — " : "FAILED — ") +
          SUMMARY_DIR +
          "\\" +
          WriterState.LASTINDEX.name +
          (WriterState.LASTINDEX.why ? " (" + WriterState.LASTINDEX.why + ")" : "") +
          " · " +
          fmtDate(String(WriterState.LASTINDEX.at).slice(0, 10))
        : "no summary written yet this session",
    ],
  ];
  return `<table class="diag"><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join("")}</tbody></table>`;
}

function reindexReport() {
  const r = WriterState.state.reindex;
  if (!r) return "";
  if (r.running)
    return (
      '<div class="banner info" style="margin-top:14px"><div>Rebuilding the rep' +
      "orting index &mdash; " +
      `${esc(r.done)}` +
      " of " +
      `${esc(r.total)}` +
      " case files read.</div></div>"
    );
  const bad = r.refused.concat(r.failed);
  return (
    '<div class="banner ' +
    `${bad.length ? "warn" : "ok"}` +
    '" style="margin-top:14px"><div><strong>Reporting index rebuilt: ' +
    `${esc(r.written)}` +
    " of " +
    `${esc(r.total)}` +
    " case file" +
    `${r.total === 1 ? "" : "s"}` +
    " summarized.</strong>\n    " +
    `${bad.length ? `<ul class="reidx">${bad.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}` +
    "</div></div>"
  );
}

async function testWrite() {
  if (!WriterState.CASEDIR) {
    toast("Link the case folder first");
    return;
  }
  if (WriterState.NEEDGRANT) await grantCaseFolder(true);
  if (WriterState.CASEDIR.helper) {
    try {
      await helperJSON("/cases/probe", {});
      toast("The shared case folder is writable");
    } catch (err) {
      toast("Test write FAILED — " + err.message);
    }
    render();
    return;
  }
  const name = "_write-test.json";
  const r = await writeToFolder(name, JSON.stringify({ test: true, at: nowISO() }, null, 2));
  toast(r.ok ? "Test file written to " + WriterState.DIRNAME + " — look for " + name : "Test write FAILED — " + (r.why || "unknown reason"));
  render();
}

function storageBar() {
  return connectionBanner(app_savedworkContext());
}

/* The screen frame. title and crumb are plain text and are escaped here (callers never pre-escape them);
   actions and body are HTML built by the caller. */
function shell(title, crumb, actions, body) {
  const nav = navigation.rail();
  return (
    '<div class="app">\n    <aside class="rail no-print">\n      <div class="ra' +
    'il-brand"><img class="rail-logo" src="' +
    `${LOGO}` +
    '" alt="City of Madison Building Inspection"><div class="rail-sub">Docume' +
    'nt Writer</div></div>\n      <nav class="writer-navigation" aria-label="M' +
    'ain navigation">' +
    `${nav}` +
    '</nav>\n      <div class="rail-foot"><strong>Building Inspection</strong>' +
    'City of Madison<span id="save-status" role="status" aria-live="polite">D' +
    'rafts save on this device</span><span class="build" title="Which build i' +
    's running">Build ' +
    `${esc(BUILD)}` +
    '</span></div>\n    </aside>\n    <div class="main">\n      <header class="t' +
    'opbar no-print"><div><span class="crumb">' +
    `${esc(crumb)}` +
    "</span><h1>" +
    `${esc(title)}` +
    '</h1></div><div class="topbar-actions">' +
    `${actions || ""}` +
    '</div></header>\n      <div class="content">' +
    `${recordIntegrity.banner()}` +
    "" +
    `${storageBar()}` +
    "" +
    `${body}` +
    "</div>\n    </div></div>"
  );
}

function sourceDocFor(cid) {
  // Only a document that has actually been issued can be reinspected: it is
  // the numbered list the owner received. DOCS is newest first.
  const w = docsFor(cid).filter((d) => !d.draft && !d.void && !d.superseded && d.items.length);
  return w.find((d) => !supplemental(d)) || w[0] || null;
}

function evid() {
  const r = () => Math.random().toString(36).slice(2, 10);
  return "ev_" + Date.now().toString(36) + "_" + r() + r().slice(0, 4);
}

function appendEvent(cid, type, payload, at, by) {
  if (EVENT_TYPES.indexOf(type) < 0) throw new Error("unknown event type " + type);
  const latest = eventsFor(cid).reduce((n, e) => Math.max(n, Date.parse(e.at) || 0), 0);
  const recorded = nowISO();
  const ordered = new Date(Math.max(Date.parse(recorded), latest + 1)).toISOString();
  const ev = makeEvent(evid(), at || ordered, by || kase(cid).inspectorId || "", type, payload || {});
  eventsFor(cid).push(ev);
  WriterState.DIRTY = true;
  return ev;
}

function replay(cid) {
  return replayEvents(eventsFor(cid));
}

function project() {
  WriterState.DOCS = WriterState.DOCS.filter((d) => d.draft);
  WriterState.REINSP = WriterState.REINSP.filter((r) => r.draft);
  WriterState.CASES.forEach((k) => {
    const st = replay(k.id);
    st.documents.forEach((d) => WriterState.DOCS.push(d));
    st.reinspections.forEach((r) => WriterState.REINSP.push(r));
  });
  WriterState.DOCS.sort((a, b) => {
    const at = a.draft ? "9999" : a.issuedAt || "",
      bt = b.draft ? "9999" : b.issuedAt || "";
    return at === bt ? 0 : at < bt ? 1 : -1;
  });
}

function rememberSaved(k, file) {
  const details = caseDetails(file.case);
  details.id = k.id;
  WriterState.SAVE_CHECKPOINTS[k.id] = { case: details, events: (file.events || []).map((e) => e.id) };
  k.savedAt = nowISO();
}

function caseFile(cid) {
  const k = kase(cid),
    evs = eventsFor(cid).slice().sort(byTime);
  const used = {};
  evs.forEach((e) => {
    if (e.by) used[e.by] = 1;
  });
  used[k.inspectorId] = 1;
  return {
    format: "madison-case-file",
    schema: SCHEMA,
    exported: nowISO(),
    exportedBy: insp(k.inspectorId).name || "",
    case: caseDetails(k),
    inspectors: INSPECTORS.filter((i) => used[i.id]),
    events: clone(evs),
  };
}

function caseNumberAllowed(k) {
  return (
    !!k && (validCaseNumber(k.number) || (!!caseNumberKey(k.number) && !!(k.savedAt || WriterState.SAVE_CHECKPOINTS[k.id] || eventsFor(k.id).length)))
  );
}

function bumpSeq(o) {
  const scan = (v) => {
    if (typeof v === "string") {
      const m = /^[a-z](\d+)$/.exec(v);
      if (m) WriterState.seq = Math.max(WriterState.seq, +m[1]);
    } else if (v && typeof v === "object") Object.keys(v).forEach((kk) => scan(v[kk]));
  };
  scan(o);
}

function mergeCaseEvents(k, f) {
  const inc = f["case"];
  if (k.id !== inc.id) {
    (f.events || []).forEach((e) => {
      const p = e.payload || {};
      if (p.snapshot && p.snapshot.caseId === inc.id) p.snapshot.caseId = k.id;
      if (p.reinspection && p.reinspection.caseId === inc.id) p.reinspection.caseId = k.id;
      if (p.caseId === inc.id) p.caseId = k.id;
    });
  }
  const combined = new Map(eventsFor(k.id).map((e) => [e.id, e]));
  (f.events || []).forEach((e) => {
    const old = combined.get(e.id);
    if (old && stableJSON(old) !== stableJSON(e)) throw new Error("Conflicting content for an existing event");
    combined.set(e.id, e);
  });
  const fault = correctionHistoryFault(Array.from(combined.values()));
  if (fault) throw new Error(fault);
  const have = {};
  eventsFor(k.id).forEach((e) => {
    have[e.id] = 1;
  });
  let added = 0;
  (f.events || []).forEach((e) => {
    if (!have[e.id]) {
      eventsFor(k.id).push(e);
      added++;
    }
  });
  if (added) eventsFor(k.id).sort(byTime);
  return added;
}

function loadCaseFile(text, isSaved = true) {
  let f;
  try {
    f = JSON.parse(text);
  } catch (err) {
    toast("That file is not readable JSON");
    return null;
  }
  if (!f || f.format !== "madison-case-file" || !f["case"]) {
    toast("Not a Madison case file");
    return null;
  }
  if (f.schema >= 5 && !recordIntegrity.hasProof(f)) {
    void recordIntegrity.verify(f).then(() => {
      loadCaseFile(JSON.stringify(f), isSaved);
    });
    return null;
  }
  try {
    f = migrate(f);
  } catch (err) {
    toast(err.message);
    return null;
  }
  const fault = caseFileFault(f);
  if (fault) {
    toast("That case file was not loaded — " + fault);
    return null;
  }
  // nothing is touched until the whole file has been accepted and replayed
  const undo = {
    events: clone(WriterState.EVENTS),
    cases: clone(WriterState.CASES),
    inspectors: INSPECTORS.length,
    docs: WriterState.DOCS.slice(),
    reinsp: WriterState.REINSP.slice(),
  };
  let k = null,
    added = 0;
  try {
    bumpSeq(f);
    (f.inspectors || []).forEach((i) => {
      if (!INSPECTORS.some((x) => x.id === i.id || x.name === i.name)) INSPECTORS.push(i);
    });
    const inc = f["case"];
    k = WriterState.CASES.find((c) => c.number === inc.number);
    if (!k) {
      k = clone(inc);
      WriterState.CASES.push(k);
    } else if (isSaved) {
      const combined = mergeCaseDetails(k, inc, WriterState.SAVE_CHECKPOINTS[k.id] && WriterState.SAVE_CHECKPOINTS[k.id].case);
      Object.keys(k).forEach((key) => delete k[key]);
      Object.assign(k, combined);
    }
    added = mergeCaseEvents(k, f);
    project();
    if (WriterState.DOCS.some((x) => !x || !Array.isArray(x.items))) throw new Error("a document did not replay");
  } catch (err) {
    WriterState.EVENTS = undo.events;
    WriterState.CASES = undo.cases;
    INSPECTORS.length = undo.inspectors;
    WriterState.DOCS = undo.docs;
    WriterState.REINSP = undo.reinsp;
    project();
    render();
    toast("That case file was not loaded — " + ((err && err.message) || "it could not be replayed"));
    return null;
  }
  const inc = f["case"];
  WriterState.state.screen = "cases";
  WriterState.DIRTY = false;
  render();
  const st = replay(k.id);
  if (isSaved) rememberSaved(k, f);
  saveDrafts();
  refreshArtifactLocations();
  toast(
    "Loaded " +
      inc.number +
      " — " +
      st.documents.length +
      " document" +
      (st.documents.length === 1 ? "" : "s") +
      ", " +
      st.reinspections.length +
      " reinspection" +
      (st.reinspections.length === 1 ? "" : "s") +
      (added ? "" : " (nothing new)"),
  );
  return k;
}

function idb() {
  if (WriterState.IDBCONN) return WriterState.IDBCONN;
  WriterState.IDBCONN = new Promise((res, rej) => {
    if (!IDB_OK) return rej(new Error("no indexeddb"));
    const rq = indexedDB.open("madison-doc-writer", 1);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains("kv")) rq.result.createObjectStore("kv");
    };
    rq.onsuccess = () => {
      const db = rq.result;
      db.onversionchange = () => {
        try {
          db.close();
        } catch (e) {
          /* The connection is already being retired; clear its reference even when close reports an error. */
        }
        WriterState.IDBCONN = null;
      };
      db.onclose = () => {
        WriterState.IDBCONN = null;
      };
      res(db);
    };
    rq.onerror = () => rej(rq.error);
  });
  WriterState.IDBCONN.catch(() => {
    WriterState.IDBCONN = null;
  });
  return WriterState.IDBCONN;
}

async function idbGet(key, required = false) {
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const rq = db.transaction("kv", "readonly").objectStore("kv").get(key);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  } catch (e) {
    WriterState.IDBCONN = null;
    if (required) throw e;
    return undefined;
  }
}

async function idbSet(key, val) {
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(val, key);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  } catch (e) {
    WriterState.IDBCONN = null;
    return false;
  }
}

async function linkCaseFolder() {
  if (WriterState.HELPER && WriterState.HELPER.caseStore) {
    await restoreCaseFolder();
    await flushPending();
    toast("Using " + WriterState.HELPER.caseDir);
    return true;
  }
  if (!FS_OK) {
    toast("Direct folder access needs the program opened from the localhost address");
    return false;
  }
  try {
    const h = await window.showDirectoryPicker({ id: "madison-cases", mode: "readwrite" });
    const was = WriterState.DIRNAME;
    WriterState.CASEDIR = h;
    WriterState.DIRNAME = h.name;
    WriterState.NEEDGRANT = false;
    await idbSet("casedir", h);
    await flushPending();
    toast(was && was !== h.name ? "Now writing to " + h.name + " instead of " + was : "Linked to " + h.name + " — case files will be written there");
    render();
    return true;
  } catch (err) {
    return false;
  }
}

async function restoreCaseFolder() {
  if (WriterState.HELPER && WriterState.HELPER.caseStore) {
    WriterState.CASEDIR = helperFolder();
    WriterState.DIRNAME = CASEDIR_EXPECT;
    WriterState.NEEDGRANT = false;
    render();
    return;
  }
  if (!FS_OK) return;
  const h = await idbGet("casedir");
  if (!h) return;
  WriterState.CASEDIR = h;
  WriterState.DIRNAME = h.name || "case folder";
  try {
    const p = await h.queryPermission({ mode: "readwrite" });
    WriterState.NEEDGRANT = p !== "granted";
  } catch (e) {
    WriterState.NEEDGRANT = true;
  }
  render();
}

async function grantCaseFolder(quiet) {
  if (!WriterState.CASEDIR) return false;
  try {
    const p = await WriterState.CASEDIR.requestPermission({ mode: "readwrite" });
    WriterState.NEEDGRANT = p !== "granted";
    if (!WriterState.NEEDGRANT && !quiet) {
      toast("Reconnected to " + WriterState.DIRNAME);
      await flushPending();
    }
    if (!quiet) render();
    return !WriterState.NEEDGRANT;
  } catch (e) {
    return false;
  }
}

async function helperJSON(url, body) {
  const response = await authFetch(
    url,
    body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  const data = await response.json();
  if (!response.ok || !data.ok) {
    const error = new Error(data.error || "The local helper could not complete that action");
    error.name = data.missing ? "NotFoundError" : "StorageError";
    error.definitive = response.status >= 400 && response.status < 500;
    throw error;
  }
  if (data.file) await recordIntegrity.verify(data.file, data.integrity);
  return data;
}

export {
  caseNumberAllowed,
  printableHTML,
  printNotice,
  storageReport,
  reindexReport,
  testWrite,
  shell,
  sourceDocFor,
  evid,
  appendEvent,
  project,
  rememberSaved,
  caseFile,
  mergeCaseEvents,
  loadCaseFile,
  idb,
  idbGet,
  idbSet,
  linkCaseFolder,
  restoreCaseFolder,
  grantCaseFolder,
  helperJSON,
};

export function summarize(f) {
  return summarizeRecord(f, {
    inspectors: INSPECTORS,
    library: LIBRARY,
    cases: WriterState.CASES,
    integrity: recordIntegrity.status(f["case"] || {}),
    build: BUILD,
    written: nowISO(),
  });
}
