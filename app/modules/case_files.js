import { caseFile, caseNumberAllowed } from "./case_records.js";
import { inspectionIdentity } from "./inspection_facts.js";
import { recordDay } from "../assets/shared.js";
import { checkHelper, toast } from "./court_and_deposits.js";
import { caseDetails, stableJSON } from "./record_values.js";
import { grantCaseFolder, restoreCaseFolder, sourceDocFor, summarize } from "./workspace_shell.js";
import { caseFileFault, caseFileName, summaryName } from "./case_file_rules.js";
import { migrate } from "./case_migrations.js";
import {
  initWriterHandoff,
  markWriterReady,
  markWriterFailed,
  refreshArtifactLocations,
  clearWalk,
  restoreWalkFor,
  refreshCatalog,
  IDB_OK,
  addressParser,
  newDocuments,
  recordIntegrity,
  snow,
  uid,
  app_savedworkContext,
  saveDrafts,
  restoreDrafts,
  writeIndexFile,
  restorePending,
  flushPending,
  loadCaseFile,
  scheduleRecoveryBackup,
} from "./app_core.js";

import { unissuedVisitFor } from "./draft_recovery.js";

import { render } from "./app_screens.js";

import { STATE_NAMES, US_STATES, ccList, emailList } from "./mailing_rules.js";
import { doc, docCase, docsFor, draftDocFor, draftReinspFor, eventsFor, kase, recordHead, reinsp } from "./writer_queries.js";

import { nowISO } from "./calendar.js";

import { WriterState } from "./state.js";
import { localSaveText, updateLocalPresentation } from "./saved_work.js";

/* app functions; direct dependencies use explicit shared state. */

async function writeSummary(cid, saved) {
  const k = kase(cid);
  if (!caseNumberAllowed(k)) {
    toast("Case number needs correction before reporting");
    return false;
  }
  const name = summaryName(k);
  let body;
  try {
    body = JSON.stringify(summarize(saved || caseFile(cid)));
  } catch (err) {
    WriterState.LASTINDEX = { name: name, ok: false, why: "could not be assembled: " + ((err && err.message) || err), at: nowISO() };
    return false;
  }
  const r = await writeIndexFile(name, body);
  WriterState.LASTINDEX = { name: name, ok: r.ok, why: r.why || "", at: nowISO() };
  return r.ok;
}

async function rebuildIndex() {
  if (!WriterState.CASEDIR) {
    toast("Link the case folder first");
    return null;
  }
  if (WriterState.NEEDGRANT) await grantCaseFolder(true);
  if (WriterState.NEEDGRANT) {
    toast("The browser did not grant access to " + WriterState.DIRNAME + " — the index was not rebuilt");
    return null;
  }
  const files = (await listCaseFolder()).filter((x) => x.name.charAt(0) !== "_");
  const out = { written: 0, refused: [], failed: [], total: files.length, at: nowISO() };
  WriterState.state.reindex = { running: true, done: 0, total: files.length };
  render();
  for (let n = 0; n < files.length; n++) {
    const nm = files[n].name;
    let f;
    try {
      const fh = await WriterState.CASEDIR.getFileHandle(nm);
      f = migrate(JSON.parse(await (await fh.getFile()).text()));
    } catch (err) {
      out.refused.push(nm + " \u2014 " + ((err && err.message) || "not readable"));
      continue;
    }
    const fault = caseFileFault(f);
    if (fault) {
      out.refused.push(nm + " \u2014 " + fault);
      continue;
    }
    let body;
    try {
      body = JSON.stringify(summarize(f));
    } catch (err) {
      out.refused.push(nm + " \u2014 could not be summarized: " + ((err && err.message) || err));
      continue;
    }
    const r = await writeIndexFile(summaryName(f["case"]), body);
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
  render();
  toast(
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
    toast("Could not read the case folder — " + (e.message || e));
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
    if (record.schema >= 5) await recordIntegrity.verify(record);
    loadCaseFile(raw);
  } catch (e) {
    toast("Could not open " + name);
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
  if (!IDB_OK) {
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

async function discardDraft(id) {
  const d = doc(id);
  if (d && d.pendingAmendment) {
    toast("Retry the pending save before discarding this correction.");
    return false;
  }
  WriterState.DOCS = WriterState.DOCS.filter((d) => !(d.draft && d.id === id));
  WriterState.REINSP = WriterState.REINSP.filter((r) => !(r.draft && r.id === id));
  if (WriterState.state.reinspId === id) {
    clearWalk();
    WriterState.WORK.walk = null;
  }
  // a worksheet still pointing at the discarded follow-up reads as finished
  // and will not write another one
  WriterState.REINSP.forEach((r) => {
    if (r.draft && r.docId === id) r.docId = null;
  });
  await saveDrafts();
  render();
}

async function bootStorage() {
  try {
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
            return new Promise((release) => {
              WriterState.releaseWorkspaceLock = release;
            }); // held until this tab closes or Writer stops
          })
          .catch(() => resolve(false)),
      );
      if (!acquired) {
        WriterState.STARTUP_STATUS = "locked";
        WriterState.releaseWriterReady(false);
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
    initWriterHandoff();
    await checkHelper();
    if (WriterState.HELPER) await refreshCatalog();
    await restoreCaseFolder();
    await restorePending();
    await restoreDrafts();
    // Internal pending-write recovery may save only after every retained draft has been read.
    WriterState.WORKSPACE_RESTORED = true;
    await recordIntegrity.refresh();
    await refreshArtifactLocations();
    await flushPending();
    markWriterReady();
    if (WriterState.HELPER) scheduleRecoveryBackup();
  } catch (error) {
    markWriterFailed(error);
  }
}

function pickCaseFile() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".json,application/json";
  inp.onchange = () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onerror = () => toast("That file could not be read from this machine");
    fr.onload = () => {
      try {
        loadCaseFile(String(fr.result));
      } catch (err) {
        toast("That case file was not loaded — " + ((err && err.message) || "it could not be read"));
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
  const states = Object.entries(STATE_NAMES)
    .sort((a, b) => b[0].length - a[0].length)
    .concat(Array.from(US_STATES, (x) => [x.toLowerCase(), x]));
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
  const parsedFault = addressParser.fault(k);
  if (parsedFault) return parsedFault;
  const normalized = [];
  for (let ix = 0; ix < ccList(k).length; ix++) {
    const c = ccList(k)[ix];
    if (!String(c.name || "").trim() && !String(c.addr || "").trim() && !String(c.city || "").trim()) continue;
    if (addressParser.accepted(c.addressParsed, [c.addr || "", c.city || ""]) && String(c.name || "").trim()) continue;
    const problem = addressProblem(c.name, c.addr, c.city);
    if (problem) {
      const field = !String(c.name || "").trim() ? "name" : !standardStreetAddress(c.addr) ? "addr" : "city";
      return { message: "Copy " + (ix + 1) + ": " + problem, scope: "copy", index: ix, field, selector: '[data-cc="' + ix + "|" + field + '"]' };
    }
    normalized.push([c, String(c.name).trim(), standardStreetAddress(c.addr), standardCityStateZip(c.city)]);
  }
  const a = k.agent || {},
    entered = [a.name, a.addr, a.city].some((v) => String(v || "").trim());
  const acceptedAgent = addressParser.accepted(a.addressParsed, [a.addr || "", a.city || ""]) && String(a.name || "").trim();
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
  if (addressParser.accepted(c.addressParsed, [c.addr || "", c.city || ""])) return "Accepted mailing lines: " + [c.addr, c.city].join(" · ");
  const street = standardStreetAddress(c.addr),
    city = standardCityStateZip(c.city);
  return street && city ? "Printed as: " + street + " · " + city : "";
}

function addCC(cid) {
  const current = doc(WriterState.state.docId),
    k = current && current.caseId === cid && current.correction ? docCase(current) : kase(cid);
  k.ccList = ccList(k).concat([{ name: "", addr: "", city: "" }]);
  WriterState.DIRTY = true;
  render();
}

function removeCC(cid, ix) {
  const current = doc(WriterState.state.docId),
    k = current && current.caseId === cid && current.correction ? docCase(current) : kase(cid);
  k.ccList = ccList(k).filter((_, n) => n !== ix);
  WriterState.DIRTY = true;
  render();
}

function addEmail(cid) {
  const current = doc(WriterState.state.docId),
    k = current && current.caseId === cid && current.correction ? docCase(current) : kase(cid);
  k.emails = emailList(k).concat([{ addr: "", kind: "Property Owner" }]);
  WriterState.DIRTY = true;
  render();
}

function removeEmail(cid, ix) {
  const current = doc(WriterState.state.docId),
    k = current && current.caseId === cid && current.correction ? docCase(current) : kase(cid);
  k.emails = emailList(k).filter((_, n) => n !== ix);
  WriterState.DIRTY = true;
  render();
}

function caseUnsaved(k) {
  if (Object.values(WriterState.RECORD_ATTEMPTS).some((x) => x.cid === k.id)) return "record change awaiting save confirmation";
  if (WriterState.PENDING.some((p) => p.cid === k.id || (!!caseFileName(k) && p.name === caseFileName(k))))
    return "case file waiting to reach the share";
  const evs = eventsFor(k.id);
  const drafts = WriterState.DOCS.some((d) => d.draft && d.caseId === k.id) || WriterState.REINSP.some((r) => r.draft && r.caseId === k.id);
  if (drafts) return "unfinished drafts";
  if (!evs.length && !WriterState.SAVE_CHECKPOINTS[k.id]) return "case details saved only on this device";
  if (!k.savedAt) return "issued documents never written to the share";
  const checkpoint = WriterState.SAVE_CHECKPOINTS[k.id];
  if (checkpoint) {
    const known = new Set(checkpoint.events || []);
    return evs.some((e) => !known.has(e.id)) || stableJSON(caseDetails(k)) !== stableJSON(caseDetails(checkpoint.case))
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
  if (Object.values(WriterState.RECORD_ATTEMPTS).some((x) => x.cid === cid) || docsFor(cid).some((x) => x.pendingAmendment)) {
    toast("Confirm pending record saves before removing this case from this workspace.");
    return false;
  }
  WriterState.CASES = WriterState.CASES.filter((c) => c.id !== cid);
  WriterState.DOCS = WriterState.DOCS.filter((d) => d.caseId !== cid);
  WriterState.REINSP = WriterState.REINSP.filter((r) => r.caseId !== cid);
  if (reinsp(WriterState.state.reinspId)?.caseId === cid) {
    clearWalk();
    WriterState.WORK.walk = null;
  }
  delete WriterState.EVENTS[cid];
  if (WriterState.state.docId && !doc(WriterState.state.docId)) WriterState.state.docId = null;
  saveDrafts();
}

function clearCases(which) {
  const gone = [];
  WriterState.CASES.slice().forEach((k) => {
    const risky = caseUnsaved(k);
    if (which === "safe" && risky) return;
    if (removeCase(k.id) !== false) gone.push(k.number);
  });
  WriterState.state.modal = null;
  WriterState.state.screen = "cases";
  render();
  toast(
    gone.length
      ? gone.length + " case" + (gone.length === 1 ? "" : "s") + " removed from this workspace. Shared case records are not deleted."
      : "Nothing to remove",
  );
}

function startReinspection(cid, importedRow) {
  if (snow.isCase(kase(cid))) {
    toast("Snow cases cite each inspection directly; import the next snow inspection instead of creating a reinspection.");
    return;
  }
  if (recordIntegrity.blocked(cid)) {
    toast("This record was changed outside the program. Read-only.");
    return;
  }
  clearWalk();
  const correction = draftDocFor(cid);
  if (correction && correction.correction) {
    WriterState.state.docId = correction.id;
    WriterState.state.screen = "write";
    render();
    toast("Finish or discard the correction before starting another inspection");
    return;
  }
  const unfinished = draftDocFor(cid);
  if (unfinished) {
    WriterState.state.docId = unfinished.id;
    WriterState.state.screen = "write";
    render();
    toast("Continue the unfinished document first.");
    return;
  }
  const open = draftReinspFor(cid) || unissuedVisitFor(cid);
  if (open) {
    if (importedRow) {
      const oldDate = open.date;
      open.date = importedRow.date;
      open.time = importedRow.time || "";
      open.inspectorId = importedRow.inspectorId || open.inspectorId;
      open.importInspection = inspectionIdentity(importedRow);
      Object.values(open.results || {}).forEach((res) => {
        if (!res.carried && !res.manualDate && (!res.on || res.on === oldDate)) res.on = open.date;
      });
    }
    WriterState.state.reinspId = open.id;
    WriterState.state.screen = "reinspect";
    restoreWalkFor(open);
    render();
    return;
  }
  const src = sourceDocFor(cid);
  if (!src || !src.items.length) {
    toast("Finish and issue the notice first — a reinspection works off the document the owner received");
    return;
  }
  if (src.type === "compliance" || src.items.every((i) => i.withdrawn)) {
    toast("This case is completed. Use a new case for new observations or correct a" + " recording error from the document history.");
    return;
  }
  const k = kase(cid);
  const r = {
    expectedHead: recordHead(cid),
    id: uid("r"),
    caseId: cid,
    sourceDocId: src.id,
    date: (importedRow && importedRow.date) || recordDay(today),
    time: (importedRow && importedRow.time) || "",
    draft: true,
    inspectorId: (importedRow && importedRow.inspectorId) || k.inspectorId,
    results: {},
    docId: null,
    ...(importedRow ? { importInspection: inspectionIdentity(importedRow) } : {}),
  };
  newDocuments.continuingItems(src).forEach((it) => {
    if (it.done || it.withdrawn)
      r.results[it.id] = { oc: it.withdrawn ? "withdrawn" : "corrected", on: it.doneOn || "", due: "", note: "", cite: false, carried: true };
  });
  WriterState.WORK.walk = null;
  WriterState.REINSP.push(r);
  WriterState.state.reinspId = r.id;
  WriterState.state.screen = "reinspect";
  WriterState.DIRTY = true;
  saveDrafts();
  render();
}

export {
  writeSummary,
  rebuildIndex,
  listCaseFolder,
  openFromFolder,
  downloadFile,
  updateSaveStatus,
  scheduleDraftSave,
  discardDraft,
  bootStorage,
  pickCaseFile,
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
