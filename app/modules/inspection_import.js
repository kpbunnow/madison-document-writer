import { helperStop } from "./helper_stopped.js";
import { mailingMaxDay, recordDay, validCaseNumber } from "../assets/shared.js";
import { checks, fmtDate, inspAt, parseTime, toast, validISO } from "./court_and_deposits.js";
import { caseDetails, helperJSON, loadCaseFile, reindexReport, shell, sourceDocFor, stableJSON, storageReport } from "./workspace_shell.js";
import { caseUnsaved, recipientPreview, saveDrafts, scheduleDraftSave, updateSaveStatus, validateAndStandardizeAddresses } from "./case_files.js";
import {
  accelaFromShare,
  accelaTable,
  baseLookupAccept,
  baseLookupPlan,
  clearWalk,
  editableWalkItem,
  ensureWalkContext,
  nextWalkItem,
  screenCases,
  screenImport,
  screenLibrary,
  walkIdentity,
  walkItemReady,
} from "./reinspection_walkthrough.js";
import {
  captureWork,
  citationRecoveryPanel,
  correctionDiffHTML,
  correctionEligibility,
  correctionPanel,
  filingPanel,
  recordActionModal,
  recordHistoryHTML,
} from "./issuance_and_corrections.js";
import { publicationPanel, recoveryModal, restoreWorkControls, returnToWorksheet, unissuedVisitFor, worksheetFaults } from "./draft_recovery.js";
import { preflightCase, sharedChangeModal } from "./language_catalog.js";
import { citationReview, dueContext, dueDateSpacingConflicts, duePanel } from "./case_timeline.js";
import { enhanceDialog, paginate, refreshSheet } from "./document_pagination.js";
import {
  A11Y,
  ACC_COLS,
  ACC_LABEL,
  CASEDIR_EXPECT,
  COMMITTED,
  DOC_TYPES,
  EMAIL_KINDS,
  LOOKUP_READY,
  MINDUE,
  OUTCOMES,
  SQL_COLUMNS,
  accStatusEligible,
  accStr,
  blockers,
  ccList,
  checkAttr,
  checkTarget,
  citSelector,
  clone,
  daysBetween,
  deliveredByCitation,
  distinctDues,
  doc,
  docCase,
  docsFor,
  doneItems,
  draftDocFor,
  draftReinspFor,
  dueItems,
  emailList,
  esc,
  eventsFor,
  frozenOf,
  globalCourtCopies,
  initialCitations,
  insp,
  isEffective,
  isHistoryDoc,
  isLLC,
  isLocked,
  iso,
  itemLibraryKey,
  itemSelector,
  kase,
  markBlanks,
  navigation,
  newDocuments,
  ocOf,
  openItems,
  recordHead,
  recordIntegrity,
  reinsp,
  reinspFor,
  snow,
  structEditable,
  summaryName,
  uid,
  unchecked,
} from "./app_core.js";
import { app_languagediscoveryContext, app_savedworkContext } from "./app_view_contexts.js";
import { INSPECTORS } from "./data/inspectors.js";
import { specialType } from "./new_documents.js";
import { WriterState } from "./state.js";
import { documentHTML, citationFaces } from "./document_render.js";
import { authFetch } from "./helper_transport.js";
import { languagePicker, rememberLanguageFocus, restoreLanguageFocus } from "./language_discovery.js";
import { documentSaveHTML, localSaveText } from "./saved_work.js";
/* app functions; direct dependencies use explicit shared state. */

function openImportWorkspace(cid) {
  const k = kase(cid);
  if (!k) return;
  cancelCaseLookup();
  captureWork();
  preflightCase(cid, "continue existing case", () => {
    const draft = draftDocFor(cid),
      visit = draftReinspFor(cid) || unissuedVisitFor(cid),
      current = sourceDocFor(cid);
    WriterState.state.modal = null;
    WriterState.state.picker = false;
    if (draft) {
      WriterState.state.docId = draft.id;
      WriterState.state.screen = "write";
    } else if (visit) {
      WriterState.state.reinspId = visit.id;
      WriterState.state.screen = "reinspect";
    } else if (current) {
      WriterState.state.docId = current.id;
      WriterState.state.screen = "write";
    } else {
      WriterState.state.screen = "cases";
      WriterState.state.caseQ = k.number;
      WriterState.state.caseFilter = "all";
      WriterState.state.caseInspector = "";
    }
    saveDrafts();
    render();
  });
}

function lookupCard() {
  return (
    '<div class="card lookup-card"><div class="card-h"><h2>Find Accela inspection</h2><s' +
    'pan class="pill">City database</span></div><div class="card-b">\n  <p>Ent' +
    "er the case number to retrieve its property, owner and inspection detail" +
    's.</p>\n  <form id="lookup-form" class="lookup-row" aria-busy="' +
    `${WriterState.LOOKUP_BUSY}` +
    '">\n    <label class="f"><span>Case number</span><input type="text" id="l' +
    'ookup-number" maxlength="80" autocomplete="off" spellcheck="false" place' +
    'holder="CB2026-000-00000" value="' +
    `${esc(WriterState.WORK.entry["lookup-number"] || "")}` +
    '" ' +
    `${WriterState.LOOKUP_BUSY ? "readonly" : ""}` +
    '></label>\n    <button class="btn btn-primary" type="submit" ' +
    `${WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
    ">" +
    `${WriterState.LOOKUP_BUSY ? "Finding inspection…" : "Find Accela inspection"}` +
    "</button>\n    " +
    "".concat(
      WriterState.LOOKUP_BUSY
        ? '<button class="btn" type="button" id="lookup-cancel">Cancel lookup</button>'
        : !WriterState.state.acc
          ? '<button class="btn" type="button" id="acc-cancel">Clear search</button>'
          : "",
    ) +
    '\n  </form>\n  <p class="hint">Uses your Windows account. A single eligibl' +
    "e initial inspection opens a draft notice when all checks pass. Multiple" +
    " or later results open for review. Your search and review can be saved f" +
    'or later.</p>\n  <div role="status" aria-live="polite">' +
    "".concat(WriterState.LOOKUP_ERROR ? `<div class="banner alert"><div>${esc(WriterState.LOOKUP_ERROR)}</div></div>` : "") +
    "</div>\n  </div></div>"
  );
}

function cancelCaseLookup() {
  ++WriterState.LOOKUP_SERIAL;
  if (WriterState.LOOKUP_CONTROLLER) WriterState.LOOKUP_CONTROLLER.abort();
  WriterState.LOOKUP_CONTROLLER = null;
  WriterState.LOOKUP_BUSY = false;
}

function sqlReport(result, number) {
  if (!result || !Array.isArray(result.rows) || result.rows.length > 1000 || result.caseNumber !== number || result.source?.kind !== "sql")
    throw new Error("Unexpected case response. Nothing was imported.");
  if (!result.rows.length) throw new Error("No case was found for " + number + ". Check the complete case number and try again.");
  const keys = Object.keys(ACC_COLS);
  const grid = [keys.map((k) => ACC_LABEL(k))];
  const warnings = [];
  result.rows.forEach((row) => {
    if (!row || accStr(row.CaseNumber).toUpperCase() !== number) throw new Error("The database returned a different case. Nothing was imported.");
    if (/^yes$/i.test(accStr(row.IndividualLandmark)) && !accStr(row.Landmark))
      throw new Error(
        "The database marks this property as an individual landmark but supplies " + "no landmark name. Correct the source record before importing.",
      );
    if (/^yes$/i.test(accStr(row.HistoricDistrict)) && !accStr(row.HistoricDistrictName))
      throw new Error("The database marks this property as historic but supplies no district na" + "me. Correct the source record before importing.");
    grid.push(
      keys.map((k) =>
        k === "number"
          ? number
          : k === "detail" || k === "zoning"
            ? ""
            : k === "date" && /T00:00:00$/.test(row.InspectionDate || "")
              ? row.InspectionDate.slice(0, 10)
              : (row[SQL_COLUMNS[k]] ?? ""),
      ),
    );
  });
  const table = accelaTable(grid);
  if (table.errors.length) throw new Error(table.errors.join(" "));
  if (table.cases.length !== 1) throw new Error("More than one case was returned. Nothing was imported.");
  const c = table.cases[0],
    eligible = c.rows.filter((r) => r.selectable && accStatusEligible(r.status, r.type));
  // No arbitrary choice when several completed inspections are available.
  const sel = eligible.length === 1 ? eligible[0].i : null;
  if (eligible.length > 1) warnings.push("Several completed inspections are available. Select the inspection you are documenting.");
  return {
    fileName: "Case lookup · " + number,
    source: clone(result.source),
    errors: [],
    notes: table.notes.concat(warnings),
    cases: table.cases,
    caseIx: 0,
    sel,
    manualDate: "",
    manualTime: "",
  };
}

async function checkLookupShared(acc, isCurrent = () => true) {
  const number = accStr(acc.cases[acc.caseIx || 0].number).toUpperCase();
  const listing = await helperJSON("/cases/list");
  if (!isCurrent()) return false;
  if (!Array.isArray(listing.files)) throw new Error("The shared case list could not be checked. Retry when the shared folder is available.");
  const tail = (" - " + number + ".json").toLowerCase();
  const hits = listing.files.filter((f) => typeof f.name === "string" && f.name.toLowerCase().endsWith(tail));
  if (hits.length > 1)
    throw new Error("More than one shared file has this case number. Ask the record administrator to resolve the duplicate files.");
  const locals = WriterState.CASES.filter((k) => accStr(k.number).toUpperCase() === number);
  if (locals.length > 1 || locals.some((k) => k.number !== number))
    throw new Error("The local workspace has duplicate or differently capitalized case number" + "s. Resolve the existing record before importing.");
  if (hits.length) {
    const result = await helperJSON("/cases/open?name=" + encodeURIComponent(hits[0].name));
    if (!isCurrent()) return false;
    if (accStr(result.file?.case?.number).toUpperCase() !== number)
      throw new Error("The shared filename and case number disagree. The existing record has been kept.");
    const keep = { screen: WriterState.state.screen, docId: WriterState.state.docId, dirty: WriterState.DIRTY };
    let loaded;
    try {
      loaded = loadCaseFile(JSON.stringify(result.file));
    } finally {
      WriterState.state.screen = keep.screen;
      WriterState.state.docId = keep.docId;
      WriterState.DIRTY = keep.dirty;
    }
    if (!loaded) throw new Error("The existing shared case could not be merged. Resolve the case-file or local-edit conflict before importing.");
    COMMITTED.set(summaryName(result.file.case), result);
  }
  acc.shareError = "";
  return true;
}

function lookupPlanSignature(acc) {
  const p = accelaPlan(acc);
  return stableJSON({
    caseNumber: p.c?.number,
    documents: p.existing ? docsFor(p.existing.id) : [],
    visits: p.existing ? reinspFor(p.existing.id) : [],
    sel: acc.sel,
    date: p.date,
    time: p.time,
    next: p.next,
    existing: p.existing ? caseDetails(p.existing) : null,
    diff: p.diff,
    blockers: p.blockers,
    warnings: p.warnings,
    head: p.existing ? eventsFor(p.existing.id) : [],
  });
}

function lookupCanOpen(acc) {
  const p = accelaPlan(acc),
    c = acc.cases[0];
  // R37: a Record Category of "Snow Removal" advances a new case directly to the 10.28 snow citation draft.
  return (
    !p.existing &&
    (p.next === "notice" || (p.next === "snow" && snow.matchesImport(p.row))) &&
    !p.blockers.length &&
    !p.warnings.length &&
    c.rows.filter((r) => r.selectable && accStatusEligible(r.status, r.type)).length === 1 &&
    p.row?.typeKey === "initial" &&
    accStatusEligible(p.row.status, p.row.type)
  );
}

async function findDatabaseCase() {
  if (WriterState.LOOKUP_BUSY) return;
  captureWork();
  const number = accStr(WriterState.WORK.entry["lookup-number"]).toUpperCase();
  WriterState.WORK.entry["lookup-number"] = number;
  if (!validCaseNumber(number)) {
    WriterState.LOOKUP_ERROR = "Enter a complete case number using letters, numbers and hyphens.";
    render();
    return;
  }
  WriterState.LOOKUP_ERROR = "";
  WriterState.LOOKUP_BUSY = true;
  const serial = ++WriterState.LOOKUP_SERIAL;
  const controller = new AbortController();
  WriterState.LOOKUP_CONTROLLER = controller;
  const active = () => serial === WriterState.LOOKUP_SERIAL && WriterState.state.screen === "import";
  render();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    if (!(await saveDrafts()))
      throw new Error("Your search could not be saved on this device. Keep this screen open or download a workspace backup.");
    if (!active()) return;
    const response = await authFetch("/case-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseNumber: number }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!active()) return;
    if (!response.ok || !result.ok) throw new Error(result.error || "The case lookup could not be completed.");
    const acc = sqlReport(result, number);
    try {
      if (!(await checkLookupShared(acc, active))) return;
    } catch (e) {
      acc.shareError = e.message;
    }
    if (!active()) return;
    WriterState.state.acc = acc;
    WriterState.WORK.acc = clone(acc);
    if (!(await saveDrafts()))
      throw new Error("Case retrieved, but this device could not save the review. Keep the page open or download a workspace backup.");
    if (active() && !acc.shareError && lookupCanOpen(acc)) {
      LOOKUP_READY.add(acc);
      try {
        acceptAccela();
      } finally {
        LOOKUP_READY.delete(acc);
      }
    } else if (active()) toast("Case retrieved — review the inspection and details");
  } catch (error) {
    if (active())
      WriterState.LOOKUP_ERROR =
        error.name === "AbortError"
          ? "The lookup timed out. Your work is kept; retry when the network is available."
          : error.message || "The lookup failed. Your work is kept.";
  } finally {
    clearTimeout(timer);
    if (serial === WriterState.LOOKUP_SERIAL) {
      WriterState.LOOKUP_BUSY = false;
      WriterState.LOOKUP_CONTROLLER = null;
      await saveDrafts();
      render();
    }
  }
}

/* R59: any eligible listed candidate of the current case can be chosen. R62: an inspection already used on the
   case is not listed, so it cannot be chosen. Each change bumps the selection token. */
function selectImportInspection(index) {
  const acc = WriterState.state.acc,
    c = acc?.cases?.[acc.caseIx || 0];
  if (!c || !(accelaPlan(acc).candidates || []).some((r) => r.i === index && r.selectable && accStatusEligible(r.status, r.type))) return false;
  acc.sel = index;
  WriterState.ACC_SELECTION_SERIAL++;
  return true;
}

async function confirmDatabaseCase() {
  const acc = WriterState.state.acc;
  if (WriterState.LOOKUP_BUSY || !acc) return;
  WriterState.LOOKUP_ERROR = "";
  acc.shareError = "";
  const before = lookupPlanSignature(acc);
  WriterState.LOOKUP_BUSY = true;
  const serial = ++WriterState.LOOKUP_SERIAL,
    selection = WriterState.ACC_SELECTION_SERIAL,
    selected = acc.sel;
  // A shared-record result started for an earlier selection never confirms the current one.
  const sameSelection = () => selection === WriterState.ACC_SELECTION_SERIAL && acc.sel === selected;
  const active = () =>
    serial === WriterState.LOOKUP_SERIAL && WriterState.state.screen === "import" && WriterState.state.acc === acc && sameSelection();
  render();
  try {
    if (WriterState.CASEDIR?.helper || acc.source?.kind === "sql") {
      if (!(await checkLookupShared(acc, active)) || !active()) return;
    } else {
      await accelaFromShare(active);
      if (!active()) return;
    }
    if (before !== lookupPlanSignature(acc)) {
      toast("The shared record changed. Review the refreshed details and confirm again.");
      return;
    }
    LOOKUP_READY.add(acc);
    try {
      acceptAccela();
    } finally {
      LOOKUP_READY.delete(acc);
    }
  } catch (e) {
    if (active()) acc.shareError = e.message;
  } finally {
    if (serial === WriterState.LOOKUP_SERIAL) {
      WriterState.LOOKUP_BUSY = false;
      if (!sameSelection() && WriterState.state.acc === acc) toast("The selected inspection changed. Review it and confirm again.");
      await saveDrafts();
      render();
    }
  }
}

function accelaPlan(acc) {
  const p = baseLookupPlan(acc);
  if (acc) {
    if (acc.shareError) p.blockers.push(acc.shareError);
    if (p.existing && docsFor(p.existing.id).some((d) => d.pendingIssue || d.pendingAmendment))
      p.blockers.push("Confirm the pending document save on this case before importing new details.");
  }
  return p;
}

function acceptAccela() {
  if ((WriterState.state.acc?.source?.kind === "sql" || WriterState.CASEDIR?.helper) && !LOOKUP_READY.has(WriterState.state.acc)) {
    toast("Check the shared record before confirming this lookup.");
    return null;
  }
  const direct = WriterState.state.acc?.source?.kind === "sql";
  const result = baseLookupAccept();
  if (result && direct) {
    delete WriterState.WORK.entry["lookup-number"];
    scheduleDraftSave();
  }
  return result;
}

function attachCheckTargets(d, c) {
  if (c.ok || c.targets?.length) return c;
  const t = c.t.toLowerCase(),
    targets = [],
    add = (s, l, a) => targets.push(checkTarget(s, l, a));
  const visit = () => add("#btn-editvisit", "Review inspection", "visit");
  // The parcel comes only from the Accela import; its check names that correction instead of a field.
  if (/parcel/.test(t)) return c;
  else if (/registered agent/.test(t)) ["name", "addr", "city"].forEach((f) => add('[data-agent="' + f + '"]', "Registered agent " + f, "contacts"));
  else if (/mailing block/.test(t)) add('[data-case="ownerBlock"]', "Mailing block");
  else if (/case number/.test(t)) {
    if (!validCaseNumber(docCase(d).number)) add('[data-case="number"]', "Case number");
    if (!docCase(d).address) add('[data-case="address"]', "Property address");
  } else if (/signing/.test(t)) add('[data-doc="inspectorId"]', "Signing inspector");
  else if (/explain the error/.test(t)) add("#correction-reason", "Correction reason");
  else if (/amendment instructions/.test(t)) add("#correction-external", "Amendment reference");
  else if (/original action date/.test(t)) add("#correction-action-date", "Original action date");
  else if (/mailing date|mailed date/.test(t)) add('[data-doc="mailed"]', "Mailed date");
  else if (/inspection|outcome|result date|compliance date|marked corrected/.test(t) && d.fromReinspId && !d.correction) visit();
  else if (/inspection date/.test(t)) add(d.inspDate !== undefined ? '[data-doc="inspDate"]' : '[data-case="date"]', "Inspection date");
  else if (/three distinct due dates/.test(t)) dueItems(d).forEach((i) => add(itemSelector(i.id, "due"), "Item " + i.no + " due date"));
  else if (/duplicate items|only once/.test(t)) d.items.forEach((i) => add('[data-del="' + checkAttr(i.id) + '"]', "Item " + i.no));
  else if (/citation|deposit|court|officer/.test(t)) {
    d.items
      .filter((i) => i.cite && !i.withdrawn)
      .forEach((i) => {
        const cc = (d.cits || {})[i.id] || {};
        let fields = /court date/.test(t)
          ? ["courtDate"]
          : /badge|officer/.test(t)
            ? ["deptId"]
            : /unique citation|citation number/.test(t)
              ? ["num"]
              : /issue dates/.test(t)
                ? ["issued"]
                : /deposit/.test(t)
                  ? [
                      "depositMode",
                      "ord",
                      ...(cc.depositMode === "total" ? ["amount"] : ["base", "cc"]),
                      ...(cc.depositMode && cc.depositMode !== "schedule" ? ["depositSource"] : []),
                    ]
                  : ["num", "courtDate", "amount", "ord", "desc"].filter((f) => !String(cc[f] || "").trim());
        fields.forEach((f) => add(citSelector(i.id, f), "Item " + i.no + " · " + f));
      });
  } else if (/withdrawn item needs/.test(t))
    d.items
      .filter((i) => i.withdrawn && String(i.withdrawalReason || "").trim().length < 10)
      .forEach((i) => add('[data-withdraw="' + checkAttr(i.id) + '"]', "Item " + i.no + " withdrawal reason"));
  else if (/compliance dates/.test(t))
    d.items
      .filter((i) => i.done && !i.withdrawn && (!validISO(i.doneOn) || i.doneOn > recordDay(today) || i.doneOn < docCase(d).date))
      .forEach((i) => add(itemSelector(i.id, "doneOn"), "Item " + i.no + " compliance date"));
  // Record conflicts have no editable field. Direct the inspector to the existing case.
  if (!targets.length) add('[data-nav="cases"]', "Open case in Workspace", "workspace");
  return { ...c, targets };
}

function checkRowHTML(c, ix, worksheet = false) {
  return (
    '<div class="check ' +
    `${c.ok ? "pass" : c.soft ? "note" : "fail"}` +
    '"><span class="m">' +
    `${c.ok ? "✓" : c.soft ? "·" : "!"}` +
    '</span><div><span id="check-msg-' +
    `${worksheet ? "visit" : "doc"}` +
    "-" +
    `${ix}` +
    '">' +
    `${esc(c.t)}` +
    "</span>" +
    "".concat(
      !c.ok
        ? '<div class="check-links">' +
            "".concat(
              (c.targets || [])
                .map(
                  (target, n) =>
                    '<button type="button" class="check-link" data-check-index="' +
                    `${ix}` +
                    '" data-check-target="' +
                    `${n}` +
                    '" ' +
                    `${worksheet === true ? 'data-check-worksheet="1"' : ""}` +
                    ">" +
                    `${esc(target.label)}` +
                    "</button>",
                )
                .join(""),
            ) +
            "</div>"
        : "",
    ) +
    "</div></div>"
  );
}

function worksheetChecks(r) {
  const src = doc(r.sourceDocId);
  if (!src) return [];
  const out = [],
    add = (t, selector, label) => out.push({ ok: false, t, targets: [checkTarget(selector, label)] });
  const dueRelevant =
    !r.followupIntent || r.followupIntent === "undecided" || ["extension", "bestInterestExtension", "citation"].includes(r.followupIntent);
  const initial = docCase(src).date || "",
    earliest = inspAt(src).date || initial;
  if (!validISO(r.date) || r.date > recordDay(today) || r.date < earliest)
    add("Inspection date must be between the source inspection and today.", "#ri-date", "Reinspection date");
  if (!parseTime(r.time)) add("Enter the reinspection time before generating a document.", "#ri-time", "Reinspection time");
  if (!insp(r.inspectorId).name) add("Select the inspector who performed this inspection.", "#ri-insp", "Inspector");
  src.items.forEach((i) => {
    const res = r.results[i.id] || {},
      on = res.manualDate ? res.on : res.on || r.date;
    if (i.done || i.withdrawn) return;
    if (!OUTCOMES.some((o) => o.id === res.oc))
      add("Item " + i.no + ": choose an outcome.", '[data-setoc][data-item="' + checkAttr(i.id) + '"]', "Item " + i.no + " outcome");
    else {
      if (!validISO(on) || on < initial || on > r.date)
        add(
          "Item " + i.no + ": result date must be between the initial inspection and this visit.",
          '[data-ridate="' + checkAttr(i.id) + '"]',
          "Item " + i.no + " result date",
        );
      if (dueRelevant && res.oc !== "corrected" && !dueCheck(res.due, recordDay(today)).ok)
        out.push({
          ok: false,
          soft: true,
          t: "Item " + i.no + ": set a future due date for an extension or citation. Referrals need no due date.",
          targets: [checkTarget('[data-ridue="' + checkAttr(i.id) + '"]', "Item " + i.no + " new due date")],
        });
    }
  });
  if (dueRelevant && distinctDues(dueContext(r, true)).length > 3)
    out.push({
      ok: false,
      t: "Use no more than three distinct due dates for an extension or citation.",
      targets: dueContext(r, true).map((i) => checkTarget('[data-ridue="' + checkAttr(i.id) + '"]', "Item " + i.no + " new due date")),
    });
  const spacing = dueDateSpacingConflicts(dueContext(r, true));
  if (dueRelevant && spacing.length) {
    const items = [...new Map(spacing.flatMap((x) => x.items).map((i) => [i.id, i])).values()];
    out.push({
      ok: false,
      t: "Keep distinct due dates at least seven days apart.",
      targets: items.map((i) => checkTarget('[data-ridue="' + checkAttr(i.id) + '"]', "Item " + i.no + " new due date")),
    });
  }
  for (const t of worksheetFaults(r))
    if (!out.some((c) => c.t === t) && !/outcome|Result dates/.test(t))
      out.push({ ok: false, t, targets: [checkTarget('[data-nav="cases"]', "Open case in Workspace", "workspace")] });
  return out;
}

function worksheetCheckPanel(r) {
  const list = worksheetChecks(r);
  return list.length
    ? '<section class="card no-print"><div class="card-h"><h2>Inspection checks' +
        '</h2></div><div class="card-b">' +
        `${list.map((c, ix) => checkRowHTML(c, ix, true)).join("")}` +
        "</div></section>"
    : "";
}

function highlightOpenChecks() {
  document.querySelectorAll(".check-open").forEach((el) => {
    el.classList.remove("check-open");
    el.removeAttribute("data-open-check");
    if (el.dataset.checkDesc) {
      el.removeAttribute("data-check-desc");
      el.removeAttribute("aria-describedby");
    }
    el.removeAttribute("aria-invalid");
  });
  const d = doc(WriterState.state.docId),
    r = reinsp(WriterState.state.reinspId);
  const list =
    WriterState.state.screen === "write" && d && !isLocked(d)
      ? checks(d)
      : WriterState.state.screen === "reinspect" && r && r.draft && !r.docId
        ? worksheetChecks(r)
        : [];
  list.forEach((c, ix) => {
    if (c.ok) return;
    (c.targets || []).forEach((t) => {
      if (t.action && !["contacts"].includes(t.action) && !t.action.startsWith("recipient:")) return;
      document.querySelectorAll(t.selector).forEach((el) => {
        el.classList.add("check-open");
        el.setAttribute("data-open-check", c.t);
        const id =
          (WriterState.state.screen === "write" && !WriterState.state.modal ? "editor-" : "") +
          "check-msg-" +
          (WriterState.state.screen === "reinspect" ? "visit" : "doc") +
          "-" +
          ix;
        if (document.getElementById(id) && !el.getAttribute("aria-describedby")) {
          el.setAttribute("aria-describedby", id);
          el.dataset.checkDesc = id;
        }
        if (!c.soft) el.setAttribute("aria-invalid", "true");
      });
    });
  });
}

function focusCheckTarget(target, message) {
  const d = doc(WriterState.state.docId);
  captureWork();
  WriterState.state.modal = null;
  WriterState.state.picker = false;
  if (target.action === "workspace") {
    openImportWorkspace(d?.caseId || reinsp(WriterState.state.reinspId)?.caseId);
    return;
  }
  if (target.action === "catalog") {
    WriterState.state.screen = "library";
    WriterState.state.languageMode = "admin";
    WriterState.state.catalogAdminStatus = "review";
    const it = doc(WriterState.state.docId)?.items.find((i) => i.id === target.itemId);
    if (it) WriterState.state.catalogAdminKey = itemLibraryKey(it);
    render();
    return;
  }
  if (target.action?.startsWith("recipient:")) {
    const k = d && docCase(d);
    if (!k) return;
    WriterState.state.ccProblem = validateAndStandardizeAddresses(k, d.type === "citation" && isLLC(k), false);
    WriterState.state.modal = "cc";
    render();
    const parts = target.action.split(":");
    const exact = parts[1] === "agent" ? '[data-agent="' + parts[3] + '"]' : '[data-cc="' + parts[2] + "|" + parts[3] + '"]';
    const field = document.querySelector(WriterState.state.ccProblem?.selector || exact);
    field?.focus();
    field?.scrollIntoView?.({ block: "center" });
    return;
  }
  if (target.action === "visit") {
    if (!d || !returnToWorksheet(d)) {
      toast("Open the existing case in Workspace to review its recorded inspection.");
      return;
    }
    const r = reinsp(WriterState.state.reinspId);
    WriterState.state.riFilter = "";
    clearWalk();
    WriterState.WORK.walk = null;
    render();
    const check = worksheetChecks(r).find((c) => !c.soft) || worksheetChecks(r)[0];
    target = check?.targets[0] || checkTarget("#ri-date", "Reinspection date");
  } else {
    if (WriterState.state.screen === "reinspect") {
      WriterState.state.riFilter = "";
      clearWalk();
      WriterState.WORK.walk = null;
    }
    if (target.action === "contacts") WriterState.state.modal = "cc";
    render();
  }
  if (target.action === "guidance") {
    toast(message);
    return;
  }
  const el = document.querySelector(target.selector);
  if (!el) {
    toast(message + " Open the existing case to review the retained record.");
    return;
  }
  for (let parent = el.parentElement; parent; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true;
  el.classList.add("check-focus");
  el.setAttribute("tabindex", el.getAttribute("tabindex") || "0");
  el.scrollIntoView?.({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
  setTimeout(() => el.classList.remove("check-focus"), 2200);
}

function dueCheck(due, from) {
  if (!due) return { ok: false, msg: "Needs a new due date" };
  if (!validISO(due) || !validISO(from || recordDay(today))) return { ok: false, msg: "Enter a real calendar date" };
  const n = daysBetween(from || recordDay(today), due);
  if (n < 1) return { ok: false, msg: "Must be a future date" };
  if (n < 7) return { ok: true, warn: true, msg: n + " day" + (n === 1 ? "" : "s") + " — unusually short" };
  if (n > 180) return { ok: true, warn: true, msg: n + " days — unusually long" };
  return { ok: true, msg: n + " days" };
}

function screenReinspect() {
  const r = reinsp(WriterState.state.reinspId);
  if (!r) {
    WriterState.state.screen = "cases";
    return screenCases();
  }
  const k = kase(r.caseId),
    src = doc(r.sourceDocId);
  if (!src) {
    WriterState.state.screen = "cases";
    return screenCases();
  }
  const srcLabel = (DOC_TYPES.find((t) => t.id === src.type) || {}).label || src.type;
  const closed = !!r.docId,
    readOnly = closed || !r.draft;

  const shown = (it) => {
    const oc = ocOf(r, it.id);
    if (WriterState.state.riFilter === "corrected") return oc === "corrected";
    if (WriterState.state.riFilter === "open") return oc && oc !== "corrected" && oc !== "withdrawn";
    if (WriterState.state.riFilter === "todo") return !oc;
    return true;
  };
  const rows = src.items
    .filter(shown)
    .map((it) => {
      const ix = src.items.indexOf(it);
      const res = r.results[it.id] || {},
        oc = res.oc || "";
      const walkCurrent = !readOnly && WriterState.state.riWalk && WriterState.state.riWalkItem === it.id;
      const late = it.due && daysBetween(it.due, r.date) > 0;
      const open = oc && oc !== "corrected" && oc !== "withdrawn";
      const carried = !!res.carried,
        lock = readOnly || carried;
      const dc = open ? dueCheck(res.due, r.date) : null;
      const walkHidden = !readOnly && WriterState.state.riWalk && WriterState.state.riWalkItem && !walkCurrent;
      return (
        '<div class="ri-item ' +
        `${walkCurrent ? "ri-walk-current" : ""}` +
        '" data-ri-item="' +
        `${esc(it.id)}` +
        '" data-oc="' +
        `${esc(oc)}` +
        '" ' +
        `${walkHidden ? "hidden" : ""}` +
        " " +
        `${walkCurrent ? 'data-ri-walk-current="true" aria-current="step" tabindex="-1"' : ""}` +
        '>\n      <div class="ri-top">\n        <span class="ri-no">' +
        `${esc(it.no || String(ix + 1))}` +
        '.</span>\n        <span class="ri-ttl">' +
        `${esc(it.title || "Violation item")}` +
        "</span>\n        " +
        `${(it.sections || []).map((x) => `<span class="cite-sec">${esc(x)}</span>`).join("")}` +
        '\n        <span class="ri-due ' +
        `${late ? "over" : ""}` +
        '">Was due ' +
        `${fmtDate(it.due)}` +
        '</span>\n      </div>\n      <div class="ri-body">' +
        `${markBlanks(it.text || "")}` +
        '</div>\n      <div class="seg" role="group" aria-label="Result for item ' +
        `${esc(it.no || String(ix + 1))}` +
        '">\n        ' +
        "".concat(
          OUTCOMES.map(
            (o) =>
              '<button data-setoc="' +
              `${esc(o.id)}` +
              '" data-item="' +
              `${esc(it.id)}` +
              '" ' +
              `${lock ? "disabled" : ""}` +
              ' aria-pressed="' +
              `${oc === o.id ? "true" : "false"}` +
              '">' +
              `${esc(o.label)}` +
              "</button>",
          ).join(""),
        ) +
        "\n      </div>\n      " +
        "".concat(
          carried
            ? '<p class="ri-carried">' +
                "".concat(
                  oc === "withdrawn"
                    ? "Withdrawn as entered in error; excluded from compliance counts."
                    : "Cleared on " + esc(fmtDate(res.on)) + " and carried forward.",
                ) +
                "</p>"
            : "",
        ) +
        "\n      " +
        "".concat(
          oc
            ? '<div class="ri-fields">\n        <label class="f"><span>Result date</span' +
                '>\n          <input type="date" data-ridate="' +
                `${esc(it.id)}` +
                '" value="' +
                `${esc(res.on || r.date)}` +
                '" max="' +
                `${recordDay(today)}` +
                '" ' +
                `${lock ? "disabled" : ""}` +
                '><span class="hint">When this result was observed; no later than this vi' +
                "sit.</span></label>\n        " +
                "".concat(
                  open &&
                    (!r.followupIntent ||
                      r.followupIntent === "undecided" ||
                      ["extension", "bestInterestExtension", "citation"].includes(r.followupIntent))
                    ? '<label class="f"><span>Next due date</span>\n          <input type="date"' +
                        ' data-ridue="' +
                        `${esc(it.id)}` +
                        '" value="' +
                        `${esc(res.due || "")}` +
                        '" min="' +
                        `${MINDUE()}` +
                        '" ' +
                        `${lock ? "disabled" : ""}` +
                        '>\n          <span class="hint ' +
                        `${dc.ok ? (dc.warn ? "warnt" : "") : "badt"}` +
                        '">' +
                        `${esc(dc.msg)}` +
                        "</span></label>"
                    : "<div></div>",
                ) +
                '\n      </div>\n      <label class="f ri-note"><span>' +
                `${oc === "noaccess" ? "Access attempt and observations" : "Notes " + (open ? "" : "(optional)")}` +
                '</span>\n        <textarea rows="2" data-rinote="' +
                `${esc(it.id)}` +
                '" placeholder="What you observed, who you spoke to, anything worth havin' +
                'g on the file" ' +
                `${lock ? "disabled" : ""}` +
                ">" +
                `${esc(res.note || "")}` +
                "</textarea>" +
                "".concat(
                  oc === "noaccess"
                    ? '<span class="hint">Describe the access attempted, contact made and areas' +
                        " you could not inspect. No access is not a finding of compliance.</span>"
                    : "",
                ) +
                "</label>\n      " +
                "".concat(
                  open && (r.importRule?.cite || res.cite)
                    ? '<label class="ri-cite"><input type="checkbox" data-ricite="' +
                        `${esc(it.id)}` +
                        '" ' +
                        `${res.cite ? "checked" : ""}` +
                        " " +
                        `${lock ? "disabled" : ""}` +
                        ">\n        <span>Issue a citation for this item</span></label>"
                    : "",
                ) +
                ""
            : "",
        ) +
        "\n      </div>"
      );
    })
    .join("");

  const done = doneItems(r).length,
    open = openItems(r).length,
    left = unchecked(r).length;
  const activeCount = src.items.filter((it) => !it.withdrawn).length;
  const recorded = activeCount - left,
    withdrawn = src.items.length - activeCount;
  const next = WriterState.state.riWalk ? nextWalkItem(r) : null;
  const rowsShown = src.items.filter((it) => {
    const oc = ocOf(r, it.id);
    if (WriterState.state.riFilter === "corrected") return oc === "corrected";
    if (WriterState.state.riFilter === "open") return oc && oc !== "corrected" && oc !== "withdrawn";
    if (WriterState.state.riFilter === "todo") return !oc;
    return true;
  }).length;
  const cited = openItems(r).filter((i) => (r.results[i.id] || {}).cite);
  const badDue = openItems(r).filter((i) => !dueCheck((r.results[i.id] || {}).due, r.date).ok);
  const prior = reinspFor(r.caseId).filter((x) => x.id !== r.id && x.docId);
  const referred = docsFor(r.caseId).some((x) => !x.draft && !x.void && !x.superseded && isHistoryDoc(x));
  const walkOn = WriterState.state.riWalk;
  // Current step of one-item review, from the existing walk state; outcomes are only ever chosen by the inspector.
  const walkStep = !walkOn
    ? 0
    : !WriterState.state.riWalkItem
      ? 4
      : WriterState.state.riWalkStage === "details"
        ? walkItemReady(r, WriterState.state.riWalkItem)
          ? 3
          : 2
        : 1;
  const walkSteps = ["Record the outcome", "Complete required details", "Continue to the next item", "Review the inspection and permitted follow-up"];
  const walkKeys = OUTCOMES.map((o, ix) => "<kbd>" + (ix + 1) + "</kbd> " + esc(o.label)).join(" · ") + " · <kbd>U</kbd> Undo the last outcome";
  const walkPanel = !readOnly
    ? '<div class="ri-walk-panel ' +
      `${walkOn ? "active" : ""}` +
      '" role="group" aria-label="Reinspection review mode">\n    <div class="ri-walk-modes" role="group" aria-label="How to review items">' +
      '<button type="button" class="btn btn-sm ' +
      `${walkOn ? "" : "btn-primary"}` +
      '" data-riwalk="off" aria-pressed="' +
      `${walkOn ? "false" : "true"}` +
      '">Review all items</button><button type="button" class="btn btn-sm ' +
      `${walkOn ? "btn-primary" : ""}` +
      '" data-riwalk="on" aria-pressed="' +
      `${walkOn ? "true" : "false"}` +
      '">One item at a time</button></div>\n    <div class="ri-walk-copy">' +
      "<strong>" +
      `${walkOn ? "One item at a time" : "Review all items"}` +
      '</strong>\n      <span aria-live="polite">' +
      "".concat(
        walkOn
          ? WriterState.state.riWalkStage === "details"
            ? "Complete item " +
              `${esc(src.items.find((i) => i.id === WriterState.state.riWalkItem)?.no || "")}` +
              " details, then choose Next item. " +
              `${left}` +
              " without outcomes."
            : next
              ? "Next: item " +
                `${esc(next.no || String(src.items.indexOf(next) + 1))}` +
                " of " +
                `${src.items.length}` +
                " · " +
                `${left}` +
                " left to result."
              : "All items have a result. Review the dates, notes and due dates before creating a document."
          : "Every item is shown. Choose One item at a time to bring the next unanswered item into focus.",
      ) +
      "</span>\n    </div>\n    " +
      "".concat(
        walkOn
          ? '<ol class="ri-walk-steps" aria-label="One item at a time steps">' +
              walkSteps
                .map(
                  (label, ix) =>
                    '<li data-walk-step="' +
                    (ix + 1) +
                    '"' +
                    (walkStep === ix + 1 ? ' aria-current="step" class="current"' : "") +
                    ">" +
                    label +
                    "</li>",
                )
                .join("") +
              "</ol>"
          : "",
      ) +
      '\n    <label class="f"><span>After an outcome</span><select id' +
      '="ri-walk-mode" ' +
      `${walkOn ? "" : "disabled"}` +
      '><option value="quick" ' +
      `${WriterState.state.riWalkMode === "quick" ? "selected" : ""}` +
      '>Go to next unanswered item</option><option value="details" ' +
      `${WriterState.state.riWalkMode === "details" ? "selected" : ""}` +
      ">Complete details first</option></select></label>\n    " +
      "".concat(walkOn ? '<button class="btn btn-sm" data-riwalk-prev>Previous item</button>' : "") +
      "\n    " +
      "".concat(
        walkOn && WriterState.state.riWalkStage === "details"
          ? '<button class="btn btn-primary btn-sm" data-riwalk-next>Next item</butto' +
              'n><button class="btn btn-sm" data-riwalk-skip>Skip for now</button>'
          : "",
      ) +
      "\n    " +
      "".concat(
        walkOn && src.items.some((it) => editableWalkItem(r, it.id) && (!walkItemReady(r, it.id) || WriterState.state.riWalkSkipped.includes(it.id)))
          ? '<button class="btn btn-sm" data-riwalk-return>Return to unfinished details</button>'
          : "",
      ) +
      "\n    " +
      "".concat(
        walkOn && WriterState.state.riWalkUndo
          ? '<button class="btn btn-sm" data-riwalk-undo title="Undo the last walk-th' + 'rough result (U)">Undo last result <kbd>U</kbd></button>'
          : "",
      ) +
      '\n    <details class="ri-walk-tips"><summary>Keyboard shortcuts and tips</summary>' +
      "<p>In One item at a time: " +
      walkKeys +
      ".</p><p>Shortcuts are ignored while typing in a field. Nothing is recorded until you choose an outcome; " +
      "follow-up choices stay limited to those the imported inspection result permits.</p><p>After an outcome: Go to next unanswered item moves on at once; " +
      "Complete details first keeps the item open for its date, notes and any new due date.</p></details>\n  </div>"
    : "";

  let verdict;
  if (closed) {
    const nd = doc(r.docId),
      ndl = (DOC_TYPES.find((t) => t.id === (nd || {}).type) || {}).label || "follow-up";
    verdict =
      '<div class="banner ok"><div><strong>' +
      "".concat(doc(r.docId) && doc(r.docId).draft ? "A follow-up document is being drafted." : "This reinspection is finished.") +
      "</strong> " +
      `${esc(ndl)}` +
      " written from " +
      `${open}` +
      " outstanding item" +
      `${open === 1 ? "" : "s"}` +
      ". Compatible additional scoped actions can use this same inspection.</di" +
      "v></div>";
  } else if (left) {
    verdict =
      '<div class="banner info"><div><strong>' +
      `${left}` +
      " item" +
      `${left === 1 ? "" : "s"}` +
      " still to result.</strong> Every item on the " +
      `${esc(srcLabel.toLowerCase())}` +
      " needs an outcome before you create a draft.</div></div>";
  } else if (!open) {
    verdict =
      '<div class="banner ok"><div><strong>Everything on this ' +
      `${esc(srcLabel.toLowerCase())}` +
      " was corrected.</strong> Write the compliance letter to tell the owner t" +
      "he case is closed. It records the visit and carries the date each item w" +
      "as met.</div></div>";
  } else if (badDue.length && ["extension", "bestInterestExtension", "citation"].includes(r.followupIntent)) {
    verdict =
      '<div class="banner warn"><div><strong>' +
      `${badDue.length}` +
      " outstanding item" +
      `${badDue.length === 1 ? "" : "s"}` +
      " need" +
      `${badDue.length === 1 ? "s" : ""}` +
      " a due date in the future.</strong> Set one on each item that was not co" +
      "rrected &mdash; unless you are referring the case for prosecution, which" +
      " sets no new date.</div></div>";
  } else {
    verdict =
      '<div class="banner info"><div><strong>' +
      `${open}` +
      " item" +
      `${open === 1 ? "" : "s"}` +
      " carr" +
      `${open === 1 ? "ies" : "y"}` +
      " forward" +
      `${done ? ", " + done + " corrected" : ""}` +
      ".</strong> " +
      "".concat(
        referred
          ? "This case is with the City Attorney, so the only documents left are an u" +
              "pdated referral or, once everything is put right, a compliance letter. E" +
              "xtensions and citations are no longer the division&rsquo;s to give."
          : r.importRule
            ? "The Accela status " +
              esc(r.importRule.status) +
              " sets the next document: " +
              esc(r.importRule.label) +
              "." +
              (r.importRule.cite ? " Tick the items you are citing." : "") +
              (r.importRule.allCorrected ? " Every item must be marked Corrected." : "")
            : "Choose the next action: an extension to allow more time, a referral to s" +
              "end the case to the City Attorney, or a citation. Citations are at your " +
              "discretion for any item past its due date — tick the items you are citin" +
              "g.",
      ) +
      " Item numbers stay as they are on the " +
      `${esc(srcLabel.toLowerCase())}` +
      ".</div></div>";
  }

  return shell(
    k.address,
    `${k.number} · Reinspection · working off the ${srcLabel.toLowerCase()}`,
    '<button class="btn" id="btn-savework">Save draft &amp; return to Workspace</button>',
    '<div class="reinspection-workspace" data-worksheet-context="' +
      `${esc(walkIdentity(r))}` +
      '"><p class="ri-source">Inspecting against the ' +
      `${esc(srcLabel.toLowerCase())}` +
      " issued " +
      `${fmtDate(src.mailed || src.created)}` +
      ". Original item numbers and wording stay with the issued document.</p>\n " +
      '    <div class="card ri-visit" style="margin-bottom:16px"><div class="ca' +
      'rd-b">\n       <div class="grid g2">\n         <label class="f"><span>Actu' +
      'al inspection date and time</span><span class="ri-when"><input type="dat' +
      'e" id="ri-date" value="' +
      `${esc(r.date)}` +
      '" max="' +
      `${recordDay(today)}` +
      '" ' +
      `${readOnly ? "disabled" : ""}` +
      '><input type="time" id="ri-time" value="' +
      `${esc(r.time || "")}` +
      '" aria-label="Reinspection time" ' +
      `${readOnly ? "disabled" : ""}` +
      '></span><span class="hint">The physical visit. Item result dates and fut' +
      'ure deadlines are separate below.</span></label>\n         <label class="' +
      'f"><span>Inspector</span><select id="ri-insp" ' +
      `${readOnly ? "disabled" : ""}` +
      ">" +
      "".concat(INSPECTORS.map((x) => `<option value="${x.id}" ${r.inspectorId === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")) +
      '</select></label>\n       </div>\n       <div class="ri-progress" role="st' +
      'atus"><strong>' +
      `${recorded}` +
      " of " +
      `${activeCount}` +
      " active items have a result</strong><span>" +
      `${left}` +
      " unresolved" +
      `${withdrawn ? " · " + withdrawn + " withdrawn (excluded)" : ""}` +
      ". Previously cleared items remain carried forward.</span><progress value" +
      '="' +
      `${recorded}` +
      '" max="' +
      `${activeCount || 1}` +
      '" aria-label="Active items with a result"></progress></div>\n       <div ' +
      'class="ri-sum" ' +
      `${WriterState.state.riWalk ? "hidden" : ""}` +
      '>\n         <button class="cchip ' +
      `${done ? "good" : ""}` +
      '" data-rifilter="corrected" aria-pressed="' +
      `${WriterState.state.riFilter === "corrected"}` +
      '" ' +
      `${WriterState.state.riWalk ? "disabled" : ""}` +
      ">" +
      `${done}` +
      ' corrected</button>\n         <button class="cchip ' +
      `${open ? "bad" : ""}` +
      '" data-rifilter="open" aria-pressed="' +
      `${WriterState.state.riFilter === "open"}` +
      '" ' +
      `${WriterState.state.riWalk ? "disabled" : ""}` +
      ">" +
      `${open}` +
      " outstanding</button>\n         " +
      "".concat(
        left
          ? '<button class="cchip" data-rifilter="todo" aria-pressed="' +
              `${WriterState.state.riFilter === "todo"}` +
              '" ' +
              `${WriterState.state.riWalk ? "disabled" : ""}` +
              ">" +
              `${left}` +
              " not yet resulted</button>"
          : "",
      ) +
      "\n         " +
      `${cited.length ? `<span class="cchip bad">${cited.length} to cite</span>` : ""}` +
      "\n         " +
      "".concat(
        WriterState.state.riFilter
          ? '<button class="lnk" data-rifilter="" ' +
              `${WriterState.state.riWalk ? "disabled" : ""}` +
              ">Show all " +
              `${src.items.length}` +
              "</button>"
          : "",
      ) +
      "\n       </div>\n       " +
      `${walkPanel}` +
      "\n       " +
      "".concat(
        WriterState.state.riFilter
          ? '<p class="ri-filtered">Showing ' +
              `${rowsShown}` +
              " of " +
              `${src.items.length}` +
              " items. This only changes what you are looking at &mdash; every item sti" +
              "ll goes on the document.</p>"
          : "",
      ) +
      "\n       </div></div>\n     " +
      "".concat(
        prior.length
          ? '<div class="card" style="margin-bottom:16px"><div class="card-h"><h2>Ear' +
              'lier visits</h2></div><div class="card-b"><ul class="hist">' +
              "".concat(
                prior
                  .map(
                    (x) =>
                      "<li><strong>" +
                      `${fmtDate(x.date)}` +
                      "</strong> — " +
                      `${doneItems(x).length}` +
                      " corrected, " +
                      `${openItems(x).length}` +
                      " outstanding · " +
                      `${esc(insp(x.inspectorId).name)}` +
                      "</li>",
                  )
                  .join(""),
              ) +
              "</ul></div></div>"
          : "",
      ) +
      '\n     <h2 class="ri-items-heading">' +
      "".concat(
        WriterState.state.riWalk && WriterState.state.riWalkItem
          ? "Current item · " + (left ? "next unresolved remains in order" : "reviewing recorded details")
          : WriterState.state.riFilter
            ? rowsShown + " of " + src.items.length + " items"
            : "Review all " + src.items.length + " items",
      ) +
      "</h2>\n     " +
      "".concat(
        r.previousDraft
          ? '<div class="banner info"><div>Previous document draft retained. <button ' +
              'class="btn" id="btn-previousdraft">Restore previous draft and inspection' +
              '</button><button class="btn" id="btn-exportprevious">Download previous d' +
              "raft</button></div></div>"
          : "",
      ) +
      "\n     " +
      `${!r.followupIntent || ["undecided", "extension", "bestInterestExtension", "citation"].includes(r.followupIntent) ? duePanel(r, true) : ""}` +
      `${rows}` +
      "\n\n     " +
      "".concat(
        !readOnly
          ? '<details class="ri-checks"><summary>Inspection checks · ' +
              worksheetChecks(r).filter((c) => !c.soft).length +
              " to resolve before a document</summary>" +
              worksheetCheckPanel(r) +
              "</details>"
          : "",
      ) +
      "\n     " +
      `${verdict}` +
      "\n     " +
      "".concat(!closed ? newDocuments.chooser(r) : `<button class="btn" data-open="${esc(r.docId)}">Open the document</button>`) +
      '\n     <div class="ri-foot"><button class="btn" id="btn-risave">Save draft &amp; return to Workspace</button></div></div>',
  );
}

function editorReadiness(d) {
  const list = d.draft ? checks(d) : [],
    required = list.filter((c) => !c.ok && !c.soft),
    advice = list.filter((c) => !c.ok && c.soft);
  return { list, required, advice, held: !!d.draft && d.items.some((i) => i.cite && !i.withdrawn && d.cits?.[i.id]?.mandatoryAppearance) };
}

// One readiness summary: the counts of required fixes and advisories for the editor's top line.
function readinessText(required, advice) {
  const fixes = required.length ? required.length + " required fix" + (required.length === 1 ? "" : "es") : "",
    notes = advice.length ? advice.length + " advisor" + (advice.length === 1 ? "y" : "ies") : "";
  return required.length ? [fixes, notes].filter(Boolean).join(" · ") : ["Ready for review", notes].filter(Boolean).join(" · ");
}

function checkChip(d, readiness = editorReadiness(d)) {
  const { required, advice } = readiness;
  return (
    '<span class="cchip ' +
    `${required.length ? "bad" : "good"}` +
    '" id="chk-chip" data-editor-readiness>' +
    readinessText(required, advice) +
    "</span>"
  );
}

// The first unresolved required check (or, with none, advisory) that names a field, as its index in checks(d).
function readinessFirst(readiness) {
  const at = (soft) => readiness.list.findIndex((c) => !c.ok && !!c.soft === soft && c.targets?.length);
  const required = at(false);
  if (required >= 0) return { index: required, label: "Go to first required field" };
  if (readiness.required.length) return null;
  const advisory = at(true);
  return advisory >= 0 ? { index: advisory, label: "Go to first advisory" } : null;
}

function readinessActionsHTML(readiness) {
  const first = readinessFirst(readiness);
  return (
    // The existing check-link path (data-check-index) focuses the field through focusCheckTarget.
    (first
      ? '<button type="button" class="btn btn-sm" data-readiness-first data-check-index="' +
        first.index +
        '" data-check-target="0">' +
        first.label +
        "</button>"
      : "") + '<button type="button" class="lnk" data-open-checklist aria-haspopup="dialog">Open full checklist</button>'
  );
}

// Narrow-screen task bar: next required field, Review and the primary action (which clicks the toolbar's own button).
function mobileBarActionsHTML(d, readiness = editorReadiness(d)) {
  const first = readinessFirst(readiness),
    primary = editorPrimary(d, readiness);
  return (
    (first && readiness.required.length
      ? '<button type="button" class="btn btn-sm" data-mobile-next data-check-index="' +
        first.index +
        '" data-check-target="0">Next required field</button>'
      : "") +
    '<button type="button" class="btn btn-sm" data-mobile-review>Review</button>' +
    '<button type="button" class="btn btn-primary btn-sm" data-mobile-primary ' +
    (primary.attrs === "disabled" ? "disabled" : "") +
    ">" +
    primary.label +
    "</button>"
  );
}

function mobileBarKey(d, readiness) {
  const primary = editorPrimary(d, readiness);
  return readinessKey(readiness) + "|" + readiness.required.length + "|" + primary.label + "|" + primary.attrs;
}

function mobileBarHTML(d, readiness) {
  return (
    '<div class="editor-mobile-bar no-print" role="region" aria-label="Document task actions">' +
    '<span class="editor-mobile-save" data-document-device-save>' +
    esc(localSaveText(app_savedworkContext())) +
    '</span><div class="editor-mobile-actions" data-bar-key="' +
    esc(mobileBarKey(d, readiness)) +
    '">' +
    mobileBarActionsHTML(d, readiness) +
    "</div></div>"
  );
}

function readinessKey(readiness) {
  const first = readinessFirst(readiness);
  return first ? first.index + ":" + first.label : "none";
}

function readinessLineHTML(d, readiness) {
  return (
    checkChip(d, readiness) +
    '<span class="readiness-actions" data-readiness-key="' +
    esc(readinessKey(readiness)) +
    '">' +
    readinessActionsHTML(readiness) +
    "</span>"
  );
}

/* R59: the Review dialog is the one review presentation. Blocking concerns come first, then advisories; each keeps
   its check-link to the exact field (the link closes the dialog). Passed checks stay collapsed. */
function reviewConcernsHTML(d, readiness = editorReadiness(d)) {
  if (isLocked(d))
    return (
      "<p data-review-readonly>This document is read-only. Issued text and history are retained. Use Document actions for a " +
      "correction, or Print issued PDF for the archived original.</p>"
    );
  const { list, required, advice } = readiness,
    rows = (soft) => list.map((c, ix) => (!c.ok && !!c.soft === soft ? checkRowHTML(c, ix) : "")).join(""),
    passed = list.filter((c) => c.ok).length;
  return (
    (!required.length && !advice.length
      ? '<div class="banner ok" data-review-clear><div>No concerns. This document is ready to issue.</div></div>'
      : "") +
    (required.length
      ? '<section data-review-blocking aria-labelledby="review-blocking-title"><h3 id="review-blocking-title">Must fix before issuing</h3>' +
        rows(false) +
        "</section>"
      : "") +
    (advice.length
      ? '<section data-review-advisories aria-labelledby="review-advisories-title"><h3 id="review-advisories-title">Advisories</h3>' +
        rows(true) +
        "</section>"
      : "") +
    (passed
      ? '<details class="passed-checks"><summary>' +
        passed +
        " check" +
        (passed === 1 ? "" : "s") +
        " passed</summary>" +
        list.map((c, ix) => (c.ok ? checkRowHTML(c, ix) : "")).join("") +
        "</details>"
      : "")
  );
}

function reviewModalHTML() {
  const d = doc(WriterState.state.docId);
  if (!d) return "";
  return (
    '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true" data-review-dialog><div class="modal-h"><h2>Review</h2></div>' +
    '<div class="modal-b">' +
    reviewConcernsHTML(d) +
    '</div><div class="modal-f"><button class="btn" data-close="modal">Close</button></div></div></div>'
  );
}

// Fields keep their aria-describedby text for unresolved checks now that the checklist lives in the Review dialog.
function editorCheckMessagesHTML(readiness) {
  return readiness.list.map((c, ix) => (!c.ok ? '<span id="editor-check-msg-doc-' + ix + '">' + esc(c.t) + "</span>" : "")).join("");
}

function editorPrimary(d, ready = editorReadiness(d)) {
  const locked = isLocked(d);
  if (recordIntegrity.status(kase(d.caseId)).valid === false) return { label: "Review record problem", attrs: `data-sync-safety="${esc(d.caseId)}"` };
  const pending = Object.values(WriterState.RECORD_ATTEMPTS).find((x) => x.cid === d.caseId && x.pendingAmendment?.payload?.docId === d.id);
  if (pending) return { label: "Confirm saved action", attrs: `data-resumerecord="${esc(pending.recordKey)}"` };
  if (d.pendingAmendment)
    return { label: "Confirm save", attrs: 'data-editor-command="' + (d.correction ? "btn-retrycorrection" : "btn-retrypublish") + '"' };
  if (WriterState.state.publicationBusy && doc(WriterState.state.publicationBusy)?.caseId === d.caseId)
    return { label: "Finishing document save…", attrs: "disabled" };
  if (d.draft && locked) return { label: "Review saved work", attrs: `data-sync-safety="${esc(d.caseId)}"` };
  if (!locked)
    // R59: Issue always opens the final confirmation, which re-runs blockers() and lists anything still to fix.
    return { label: ready.held ? "Review held draft" : "Issue", attrs: 'id="btn-final"' };
  if (!d.void && !d.superseded && !d.filedAt && !deliveredByCitation(d))
    return { label: "File issued PDF", attrs: 'data-editor-command="btn-retryfiling"' };
  return { label: "Print issued PDF", attrs: 'id="btn-print"' };
}

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-citation-copies]")) return;
  const d = doc(WriterState.state.docId);
  if (!d || WriterState.state.screen !== "write") return;
  WriterState.state.compactCitationCopies = WriterState.state.compactCitationCopies === d.id ? null : d.id;
  render();
  document.querySelector("[data-citation-copies]")?.focus();
});

function editorEnhance() {
  const d = doc(WriterState.state.docId);
  if (!d || WriterState.state.screen !== "write") return;
  const count = ((frozenOf(d) || {}).courtCopies || globalCourtCopies()).length || 1;
  for (const parent of document.querySelectorAll(".document-workspace .desk,.document-workspace .initial-citation-previews")) {
    parent
      .querySelectorAll(".cit")
      .forEach((face, index) =>
        face.toggleAttribute("data-editor-extra-copy", WriterState.state.compactCitationCopies === d.id && index % count !== 0),
      );
  }
}

function editorSync() {
  const d = doc(WriterState.state.docId);
  if (!d || !document.querySelector(".document-workspace")) return;
  const readiness = editorReadiness(d);
  const chip = document.getElementById("chk-chip");
  if (chip) chip.outerHTML = checkChip(d, readiness);
  const actions = document.querySelector(".editor-readiness .readiness-actions"),
    key = readinessKey(readiness);
  // Replace the actions only when they change, so a focused summary button keeps its focus.
  if (actions && actions.dataset.readinessKey !== key) {
    actions.innerHTML = readinessActionsHTML(readiness);
    actions.dataset.readinessKey = key;
  }
  const messages = document.querySelector("[data-editor-check-messages]");
  if (messages) messages.innerHTML = editorCheckMessagesHTML(readiness);
  const button = document.getElementById("btn-final");
  if (button) button.innerHTML = editorPrimary(d, readiness).label;
  const bar = document.querySelector(".editor-mobile-actions"),
    barKey = mobileBarKey(d, readiness);
  // Replace only on change, so a focused bar button keeps its focus.
  if (bar && bar.dataset.barKey !== barKey) {
    bar.innerHTML = mobileBarActionsHTML(d, readiness);
    bar.dataset.barKey = barKey;
  }
  const review = document.getElementById("btn-review"),
    required = isLocked(d) ? 0 : readiness.required.length;
  if (review) review.textContent = "Review" + (required ? " · " + required : "");
  editorEnhance();
}

function editorSection(id, title, body) {
  return body
    ? '<section class="editor-section" id="' +
        `${id}` +
        '" aria-labelledby="' +
        `${id}` +
        '-title"><h2 class="no-print" tabindex="-1" id="' +
        `${id}` +
        '-title">' +
        `${title}` +
        "</h2>" +
        `${body}` +
        "</section>"
    : "";
}

function screenWrite() {
  const d = doc(WriterState.state.docId);
  if (!d) {
    WriterState.state.screen = "cases";
    return screenCases();
  }
  snow.prepare(d);
  const k = docCase(d),
    locked = isLocked(d),
    ready = editorReadiness(d),
    primary = editorPrimary(d, ready);
  const more =
    locked && !d.pendingAmendment
      ? "" +
        "".concat(
          !d.draft && !correctionEligibility(d)
            ? '<button class="btn" id="btn-correct">' +
                `${d.void ? "Restore with correction" : "Correct document"}` +
                "</button>" +
                `${d.void ? "" : '<button class="btn" id="btn-void">Withdraw…</button>'}` +
                ""
            : "",
        ) +
        // Without a linked shared folder saveCaseFile downloads a workspace backup instead, so say so.
        (WriterState.CASEDIR
          ? '<button class="btn" id="btn-savecase">Save case to shared folder</button>'
          : '<button class="btn" id="btn-savecase" aria-describedby="savecase-note">Download workspace backup</button>' +
            '<p class="hint" id="savecase-note">Shared folder not connected — this downloads a backup; it does not save the shared case record.</p>' +
            `<button class="btn" data-safety-case="${esc(d.caseId)}" data-safety-action="storage">Connect shared folder</button>`) +
        `${isEffective(d) ? '<button class="btn" id="btn-email">Email…</button>' : ""}` +
        ""
      : "";
  const actions =
    "" +
    `${d.draft ? '<button class="btn" id="btn-save">Save draft &amp; return to Workspace</button>' : ""}` +
    '<button class="btn btn-primary editor-primary" ' +
    `${primary.attrs}` +
    ">" +
    `${primary.label}` +
    "</button>" +
    "".concat(more ? '<details class="editor-more"><summary>Document actions</summary><div>' + more + "</div></details>" : "") +
    "";
  const tyLabel = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type;
  const fr = d.fromReinspId ? reinsp(d.fromReinspId) : null;
  const editable = !locked;
  const meta =
    '<div class="editor-context no-print"><div><strong>' +
    `${esc(tyLabel)}` +
    "</strong><span>" +
    "".concat(
      d.pendingAmendment
        ? "Save confirmation needed"
        : d.void
          ? "Withdrawn"
          : d.superseded
            ? "Replaced version"
            : d.draft
              ? locked
                ? "Draft · read-only"
                : "Draft · not issued"
              : "Issued " + fmtDate(d.mailed || d.created),
    ) +
    "" +
    `${d.revision ? " · revision " + esc(d.revision.number) : ""}` +
    '</span></div><button class="btn btn-sm" data-nav="cases">Back to Workspa' +
    "ce</button></div>";
  // The Inspection section appears only when it holds something to act on; ordinary inspection, property and
  // mailing details are edited on the working document, where required checks link to the exact field.
  const reviewVisit = fr && fr.draft && !d.correction && !d.pendingAmendment,
    inspectionParts = `${newDocuments.details(d)}${snow.factsForm(d)}${correctionPanel(d)}`;
  const inspection =
    reviewVisit || inspectionParts
      ? '<div class="editor-taskbar no-print">' +
        "".concat(reviewVisit ? '<button class="btn" id="btn-editvisit">Review inspection</button>' : "") +
        '<p class="hint">' +
        "".concat(
          locked
            ? "Issued details are retained with the document."
            : "Edit inspection, property and mailing details on the working document be" + "low. Required checks link to the exact field.",
        ) +
        "</p></div>" +
        inspectionParts
      : "";
  const work =
    '<div class="editor-taskbar no-print">' +
    '<p class="hint">' +
    "".concat(
      editable ? "Edit the working document directly. Fill-in bubbles mark details that still need an entry." : "Read-only retained document.",
    ) +
    "".concat(editable && !structEditable(d) ? " Violations are carried from the earlier document; edit their due dates in the item rows." : "") +
    " " +
    `${d.items.filter((x) => !x.done && !x.withdrawn).length}` +
    " outstanding" +
    `${d.items.some((x) => x.done) ? ", " + d.items.filter((x) => x.done).length + " corrected" : ""}` +
    ".</p></div>" +
    `${citationReview(d)}` +
    "" +
    "".concat(
      initialCitations.enabled(d) && d.authoringVersion >= 11
        ? '<div class="banner info no-print" id="initial-citation-replaces"><div><s' +
            "trong>This inspection will be issued as a citation.</strong> The owner r" +
            "eceives only the citation letter and its court copies. The letter carrie" +
            "s the items, due dates, appeal and rent-abatement language shown on this" +
            " working paper, which is not mailed as a separate Official Notice.</div>" +
            "</div>"
        : "",
    ) +
    '<div class="editor-preview-tools no-print"><span>Working document' +
    "".concat(d.type === "citation" || initialCitations.enabled(d) ? " · four copies per charge in the issued PDF" : "") +
    "</span>" +
    `${d.type === "citation" || initialCitations.enabled(d) ? '<button type="button" class="btn no-print" data-citation-copies aria-expanded="' + (WriterState.state.compactCitationCopies !== d.id) + '">' + (WriterState.state.compactCitationCopies !== d.id ? "Show representative court copies" : "Show all four citation copies") + "</button>" : ""}` +
    '</div><div class="desk">' +
    `${documentHTML(d)}` +
    "</div>" +
    "".concat(
      initialCitations.enabled(d)
        ? '<div class="initial-citation-previews no-print" aria-label="Initial citation previews">' +
            citationFaces(initialCitations.preview(d), true) +
            "</div>"
        : "",
    ) +
    "" +
    `${specialType(d.type) ? "" : duePanel(d, false)}` +
    "";
  // R59: the checklist is in the Review dialog; the issued record and next actions stay on the page.
  const record = `${recordHistoryHTML(d)}${newDocuments.actionPanel(d)}`;
  return shell(
    k.address,
    `${k.number} · ${tyLabel}`,
    actions,
    '<div class="document-workspace" data-editor-doc="' +
      `${esc(d.id)}` +
      '">' +
      `${meta}` +
      "" +
      `${documentSaveHTML(app_savedworkContext(), d)}` +
      "" +
      `${publicationPanel(d)}` +
      "" +
      `${filingPanel(d)}` +
      "" +
      `${citationRecoveryPanel(d)}` +
      "" +
      "".concat(
        d.superseded
          ? '<div class="banner warn no-print"><div><strong>This is a replaced versio' +
              'n.</strong> <button class="lnk" data-open="' +
              `${esc(d.superseded.replacedBy)}` +
              '">Open the corrected document</button></div></div>'
          : "",
      ) +
      '<nav class="editor-sections no-print" aria-label="Document tasks">' +
      // Recipients opens the copies and email dialog itself rather than moving to a section.
      `${editable ? '<button id="btn-cc" aria-haspopup="dialog">Recipients</button>' : ""}` +
      // R59: Violation Items opens the violation picker (only where violations may be added); Review opens the
      // Review dialog. Neither scrolls the page.
      `${structEditable(d) ? '<button id="btn-add-top" aria-haspopup="dialog">Violation Items</button>' : ""}` +
      '<button id="btn-review" data-editor-review aria-haspopup="dialog">Review' +
      `${!locked && ready.required.length ? " · " + ready.required.length : ""}` +
      "</button></nav>" +
      "".concat(!locked ? '<div class="editor-readiness no-print">' + readinessLineHTML(d, ready) + "</div>" : "") +
      "" +
      `${editorSection("editor-inspection", "Inspection", inspection)}` +
      "" +
      `${editorSection("editor-items", "Violation items", work)}` +
      "" +
      `${record}` +
      `${!locked ? "<div hidden data-editor-check-messages>" + editorCheckMessagesHTML(ready) + "</div>" : ""}` +
      `${mobileBarHTML(d, ready)}` +
      "</div>",
  );
}

function pickerHTML() {
  return languagePicker(app_languagediscoveryContext());
}

function modalHTML() {
  if (WriterState.state.modal === "shared-change") return sharedChangeModal();
  if (WriterState.state.modal === "review") return reviewModalHTML();
  if (WriterState.state.modal === "recovery") return recoveryModal();
  if (["void", "recordnote", "reconcile"].includes(WriterState.state.modal)) return recordActionModal();
  if (WriterState.state.modal === "sendto") {
    const d = doc(WriterState.state.sendDoc) || doc(WriterState.state.docId);
    if (!d) return "";
    const k = kase(d.caseId),
      list = emailList(k).filter((e) => String(e.addr || "").trim());
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
      '">\n      <div class="modal-h"><h2>Send this document to</h2></div><div c' +
      'lass="modal-b">\n      <p class="hint">Choose recipients for the email dr' +
      "aft. Review and send it in your mail application. The issued document st" +
      "ays unchanged.</p>\n      " +
      "".concat(
        list
          .map(
            (e, ix) => `<label class="sendrow"><input type="checkbox" data-sendto="${ix}" checked>
        <span><strong>${esc(e.kind || "Other")}</strong> ${esc(e.addr)}</span></label>`,
          )
          .join(""),
      ) +
      '\n      </div><div class="modal-f">\n        <button class="btn" data-clos' +
      'e="modal">Cancel</button>\n        <button class="btn" id="btn-sendnone">' +
      'Send without recording</button>\n        <button class="btn btn-primary" ' +
      'id="btn-sendgo">Open the email</button>\n      </div></div></div>'
    );
  }
  if (WriterState.state.modal === "cc") {
    const d = doc(WriterState.state.docId);
    if (!d) return "";
    const k = docCase(d),
      cc = ccList(k),
      em = emailList(k),
      needAgent = d.type === "citation" && isLLC(k),
      problem = WriterState.state.ccProblem;
    const invalid = (scope, index, field) =>
      problem && problem.scope === scope && problem.index === index && problem.field === field
        ? ' aria-invalid="true" aria-describedby="cc-address-error"'
        : "";
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
      '">\n      <div class="modal-h"><h2>Copies, email and registered agent</h2' +
      '></div><div class="modal-b">\n      <div class="banner info"><div>' +
      "".concat(
        d.correction
          ? "These edits belong to this correction. Select the case-details option on" +
              " the correction panel to also use them for future documents."
          : "Anything entered here appears on future documents for " + esc(k.number) + ". Issued copies stay unchanged.",
      ) +
      "</div></div>\n      " +
      "".concat(
        problem
          ? '<div class="banner alert" id="cc-address-error" role="alert"><div><stron' +
              "g>Check this address:</strong> " +
              `${esc(problem.message)}` +
              "</div></div>"
          : "",
      ) +
      '\n\n      <h3 class="rec-h">Copies</h3>\n      <p class="hint">Printed at t' +
      "he foot of the document under &ldquo;CC:&rdquo;. Enter a numbered street" +
      " address and city, state and ZIP; the print preview below shows the stan" +
      "dardized lines.</p>\n      " +
      "".concat(
        cc.length
          ? cc
              .map(
                (c, ix) =>
                  '<div class="rec">\n        <div class="rec-n">' +
                  `${ix + 1}` +
                  '</div>\n        <div class="rec-f">\n          <input type="text" data-cc=' +
                  '"' +
                  `${ix}` +
                  '|name" value="' +
                  `${esc(c.name || "")}` +
                  '" placeholder="Name" aria-label="Copy ' +
                  `${ix + 1}` +
                  ' name"' +
                  `${invalid("copy", ix, "name")}` +
                  '>\n          <input type="text" data-cc="' +
                  `${ix}` +
                  '|addr" value="' +
                  `${esc(c.addr || "")}` +
                  '" placeholder="Street number and name (123 Main St, Apt 4)" aria-label="' +
                  "Copy " +
                  `${ix + 1}` +
                  ' street number and name"' +
                  `${invalid("copy", ix, "addr")}` +
                  '>\n          <input type="text" data-cc="' +
                  `${ix}` +
                  '|city" value="' +
                  `${esc(c.city || "")}` +
                  '" placeholder="City, ST ZIP (Madison, WI 53703)" aria-label="Copy ' +
                  `${ix + 1}` +
                  ' city, state and ZIP"' +
                  `${invalid("copy", ix, "city")}` +
                  '>\n          <p class="rec-preview" data-recipient-preview="copy|' +
                  `${ix}` +
                  '">' +
                  `${esc(recipientPreview(c))}` +
                  '</p><button class="btn btn-sm" data-parse-address="copy|' +
                  `${ix}` +
                  '">Preview standardized copy address</button>\n        </div>\n        <but' +
                  'ton class="btn btn-sm" data-rmcc="' +
                  `${ix}` +
                  '" aria-label="Remove copy ' +
                  `${ix + 1}` +
                  '">&times;</button></div>',
              )
              .join("")
          : '<p class="hint">No copies yet.</p>',
      ) +
      '\n      <button class="btn btn-sm" id="btn-addcc">Add a copy</button>\n\n  ' +
      '    <h3 class="rec-h">Email recipients</h3>\n      <p class="hint">Offere' +
      "d when you email a document. Recipients selected when finalizing are lis" +
      "ted on that document.</p>\n      " +
      "".concat(
        em.length
          ? em
              .map(
                (e, ix) =>
                  '<div class="rec">\n        <div class="rec-n">' +
                  `${ix + 1}` +
                  '</div>\n        <div class="rec-f rec-mail">\n          <select data-em="' +
                  `${ix}` +
                  '|kind" aria-label="Recipient ' +
                  `${ix + 1}` +
                  ' type">' +
                  `${EMAIL_KINDS.map((x) => `<option ${e.kind === x ? "selected" : ""}>${esc(x)}</option>`).join("")}` +
                  '</select>\n          <input type="email" data-em="' +
                  `${ix}` +
                  '|addr" value="' +
                  `${esc(e.addr || "")}` +
                  '" placeholder="name@example.com" aria-label="Recipient ' +
                  `${ix + 1}` +
                  ' email">\n        </div>\n        <button class="btn btn-sm" data-rmem="' +
                  `${ix}` +
                  '" aria-label="Remove recipient ' +
                  `${ix + 1}` +
                  '">&times;</button></div>',
              )
              .join("")
          : '<p class="hint">No email recipients yet.</p>',
      ) +
      '\n      <button class="btn btn-sm" id="btn-addem">Add an email recipient<' +
      '/button>\n\n      <h3 class="rec-h">Registered agent' +
      `${needAgent ? ' <span class="req">required</span>' : ""}` +
      '</h3>\n      <p class="hint">' +
      `${
        needAgent
          ? esc(k.owner) + " reads as a company, so a citation cannot be served without an agent."
          : "Only needed when the owner is a company. Printed on the citation."
      }` +
      '</p>\n      <div class="rec"><div class="rec-n">&nbsp;</div><div class="r' +
      'ec-f">\n        <input type="text" data-agent="name" value="' +
      `${esc((k.agent || {}).name || "")}` +
      '" placeholder="Agent name" aria-label="Registered agent name"' +
      `${invalid("agent", 0, "name")}` +
      '>\n        <input type="text" data-agent="addr" value="' +
      `${esc((k.agent || {}).addr || "")}` +
      '" placeholder="Street number and name (123 Main St, Apt 4)" aria-label="' +
      'Registered agent street number and name"' +
      `${invalid("agent", 0, "addr")}` +
      '>\n        <input type="text" data-agent="city" value="' +
      `${esc((k.agent || {}).city || "")}` +
      '" placeholder="City, ST ZIP (Madison, WI 53703)" aria-label="Registered ' +
      'agent city, state and ZIP"' +
      `${invalid("agent", 0, "city")}` +
      '>\n        <p class="rec-preview" data-recipient-preview="agent|0">' +
      `${esc(recipientPreview(k.agent || {}))}` +
      '</p><button class="btn btn-sm" data-parse-address="agent|0">Preview stan' +
      'dardized agent address</button>\n      </div><div style="width:34px"></di' +
      'v></div>\n      </div><div class="modal-f"><button class="btn btn-primary' +
      '" data-close="modal">Done</button></div></div></div>'
    );
  }
  if (WriterState.state.modal === "clear") {
    const risky = WriterState.CASES.filter((k) => caseUnsaved(k)),
      safe = WriterState.CASES.filter((k) => !caseUnsaved(k));
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
      '">\n      <div class="modal-h"><h2>Remove cases from this workspace</h2></div><di' +
      'v class="modal-b">\n      <div class="banner info"><div>This workspace is your ' +
      "working desk, not the record. Removing a case from this workspace does not delete its shared case record" +
      " &mdash; <strong>Open saved case</strong> brings it straight ba" +
      "ck.</div></div>\n      " +
      "".concat(
        safe.length
          ? '<p class="hint"><strong>' +
              `${safe.length}` +
              " case" +
              `${safe.length === 1 ? "" : "s"}` +
              " safe to remove</strong> &mdash; all current case details and issued hist" +
              "ory are saved to the share; no unfinished work remains.</p>\n        <ul " +
              'class="clearlist">' +
              "".concat(
                safe
                  .slice(0, 12)
                  .map((k) => `<li>${esc(k.number)} &middot; ${esc(k.address)}</li>`)
                  .join(""),
              ) +
              "" +
              `${safe.length > 12 ? `<li class="muted">and ${safe.length - 12} more</li>` : ""}` +
              "</ul>"
          : "",
      ) +
      "\n      " +
      "".concat(
        risky.length
          ? '<div class="banner warn" style="margin-top:14px"><div><strong>' +
              `${risky.length}` +
              " case" +
              `${risky.length === 1 ? " has" : "s have"}` +
              " work that has not reached the share.</strong> Removing " +
              `${risky.length === 1 ? "it" : "them"}` +
              ' would lose that work.</div></div>\n        <ul class="clearlist">' +
              "".concat(
                risky
                  .map(
                    (k) =>
                      "<li>" +
                      `${esc(k.number)}` +
                      " &middot; " +
                      `${esc(k.address)}` +
                      ' <span class="muted">&mdash; ' +
                      `${esc(caseUnsaved(k))}` +
                      "</span></li>",
                  )
                  .join(""),
              ) +
              "</ul>"
          : "",
      ) +
      '\n      </div><div class="modal-f">\n        <button class="btn" data-clos' +
      'e="modal">Cancel</button>\n        ' +
      "".concat(
        safe.length
          ? '<button class="btn btn-primary" data-clearcases="safe">Remove the ' +
              `${safe.length}` +
              " safe case" +
              `${safe.length === 1 ? "" : "s"}` +
              "</button>"
          : "",
      ) +
      "\n        " +
      "".concat(
        risky.length ? `<button class="btn" data-clearcases="all">Remove all ${WriterState.CASES.length}, losing that unsaved work</button>` : "",
      ) +
      "\n      </div></div></div>"
    );
  }
  if (WriterState.state.modal === "storage") {
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
      '">\n      <div class="modal-h"><h2>Where documents are going</h2></div><d' +
      'iv class="modal-b">\n      ' +
      `${storageReport()}` +
      "\n      " +
      "".concat(
        WriterState.CASEDIR && WriterState.DIRNAME !== CASEDIR_EXPECT
          ? '<div class="banner warn" style="margin-top:14px"><div><strong>Case files' +
              " are going to a folder called &ldquo;" +
              `${esc(WriterState.DIRNAME)}` +
              "&rdquo;, not &ldquo;" +
              `${esc(CASEDIR_EXPECT)}` +
              "&rdquo;.</strong>\n        If that is not where they belong, relink below" +
              ". Anything already written stays where it is &mdash; move those files ac" +
              "ross by hand.</div></div>"
          : "",
      ) +
      '\n      <p class="hint" style="margin-top:14px">' +
      "".concat(
        WriterState.CASEDIR && WriterState.CASEDIR.helper
          ? "Case files are saved through the local helper with a shared lock and a r" + "ecoverable previous copy. Drafts stay on this device."
          : "The browser only supplies the folder name. Write a test file to verify the destination.",
      ) +
      "</p>\n      " +
      `${reindexReport()}` +
      '<p><button class="btn" data-sync-safety>Back to saved work &amp; connect' +
      'ion</button></p>\n      </div><div class="modal-f">\n        ' +
      "".concat(
        WriterState.CASEDIR
          ? '<button class="btn" id="btn-reindex" ' +
              `${WriterState.state.reindex && WriterState.state.reindex.running ? "disabled" : ""}` +
              ">Rebuild reporting index</button>" +
              "".concat(
                WriterState.CASEDIR.helper
                  ? ""
                  : '<button class="btn" id="btn-testwrite">Write a test file</button><button' +
                      ' class="btn" id="btn-linkdir">Link a different folder…</button>',
              ) +
              ""
          : `<button class="btn" id="btn-linkdir">Link the case folder…</button>`,
      ) +
      '\n        <button class="btn btn-primary" data-close="modal">Close</butto' +
      "n></div></div></div>"
    );
  }
  if (WriterState.state.modal === "folder") {
    const fs = (WriterState.state.folder || []).filter((f) => f.name.toLowerCase().includes((WriterState.state.folderQ || "").toLowerCase()));
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
      '">\n      <div class="modal-h"><h2>Open a saved case</h2></div><div class' +
      '="modal-b"><label class="f"><span>Search saved cases</span><input type="' +
      'search" id="folder-search" value="' +
      `${esc(WriterState.state.folderQ || "")}` +
      '" placeholder="Address or case number…"></label>' +
      "".concat(WriterState.state.folderError ? `<div class="banner warn">${esc(WriterState.state.folderError)}</div>` : "") +
      "\n      " +
      "".concat(
        fs.length
          ? '<div class="folderlist">' +
              "".concat(
                fs
                  .map(
                    (f) =>
                      '<button data-openfolder="' +
                      `${esc(f.name)}` +
                      '">' +
                      `${esc(f.name.replace(/\.json$/i, ""))}` +
                      "\n        <span>" +
                      `${(f.size / 1024).toFixed(0)}` +
                      " KB &middot; " +
                      `${f.mod ? fmtDate(iso(new Date(f.mod))) : ""}` +
                      "</span></button>",
                  )
                  .join(""),
              ) +
              "</div>"
          : '<div class="banner info"><div>No case files in that folder yet.</div></div>',
      ) +
      '\n      </div><div class="modal-f"><button class="btn" data-close="modal"' +
      ">Close</button></div></div></div>"
    );
  }
  if (WriterState.state.modal !== "final") return "";
  const d = doc(WriterState.state.docId),
    ch = checks(d),
    bad = blockers(d);
  const notes = ch.filter((c) => !c.ok && c.soft);
  const ty = (DOC_TYPES.find((t) => t.id === d.type) || {}).label || "document";
  return (
    '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
    '">\n    <div class="modal-h"><h2>' +
    `${d.correction ? "Review correction" : "Finalize this " + esc(ty.toLowerCase())}` +
    '</h2></div><div class="modal-b">\n      ' +
    "".concat(
      d.correction
        ? "<p><strong>Reason:</strong> " +
            `${esc(d.correction.reason)}` +
            "</p>" +
            `${correctionDiffHTML(d)}` +
            '<p class="hint">Changed case details will also update future documents a' +
            "nd current reports. No new visit or enforcement action is counted. The p" +
            'revious version remains in history.</p><label class="correction-option">' +
            '<input type="checkbox" id="correction-reviewed" ' +
            `${d.correction.reviewed ? "checked" : ""}` +
            "> I reviewed the changes, dates and affected recipients.</label>"
        : "",
    ) +
    "\n      " +
    "".concat(
      bad.length
        ? '<div class="banner alert"><div><strong>' +
            `${bad.length}` +
            " thing" +
            `${bad.length === 1 ? "" : "s"}` +
            " to fix before this can be issued.</strong> Select a check below to go d" +
            "irectly to the field that needs attention.</div></div>"
        : notes.length
          ? '<div class="banner warn"><div><strong>Ready to issue.</strong> One thing' + " worth a second look, noted below.</div></div>"
          : '<div class="banner ok"><div>Every check passed.</div></div>',
    ) +
    "\n      " +
    // The decision: blocking failures and advisories link back to their fields; passed checks stay in the Review checklist.
    `${ch.map((c, ix) => (!c.ok ? checkRowHTML(c, ix) : "")).join("")}` +
    '\n      <label class="f" style="margin-top:16px"><span>Mailed d' +
    'ate</span><input type="date" id="fin-mailed" value="' +
    `${esc(d.mailed || recordDay(today))}` +
    '" max="' +
    `${mailingMaxDay(initialCitations.enabled(d) ? "citation" : d.type)}` +
    '" ' +
    `${d.correction ? "disabled" : ""}` +
    "></label>\n      " +
    "".concat(
      (function () {
        if (!WriterState.HELPER || !WriterState.HELPER.chrome) return "";
        const list = emailList(d.correction ? docCase(d) : kase(d.caseId)).filter((e) => String(e.addr || "").trim());
        if (!list.length)
          return (
            '<p class="hint" style="margin-top:14px">No email recipients on this case' +
            ". Add them under <strong>Recipients</strong> if you want this se" +
            "nt as well as filed.</p>"
          );
        return (
          '<div class="fin-send"><div class="flab">Email this document to</div>\n   ' +
          "       " +
          "".concat(
            list
              .map(
                (e, ix) =>
                  '<label class="sendrow"><input type="checkbox" data-finsend="' +
                  `${ix}` +
                  '" ' +
                  "".concat(
                    (Array.isArray(d.emailSelection) ? d.emailSelection.includes(e.addr + "|" + (e.kind || "Other")) : e.on !== false)
                      ? "checked"
                      : "",
                  ) +
                  ">\n            <span><strong>" +
                  `${esc(e.kind || "Other")}` +
                  "</strong> " +
                  `${esc(e.addr)}` +
                  "</span></label>",
              )
              .join(""),
          ) +
          '\n          <p class="hint">Selected recipients are listed on the documen' +
          "t. An email draft opens for you to review and send." +
          "".concat(
            WriterState.HELPER.outlook === false ? " Outlook was not found, so your default mail program will open without the attachment." : "",
          ) +
          "</p></div>"
        );
      })(),
    ) +
    '\n      <p class="hint">Finalizing locks the item text, wording and numbe' +
    "ring. Two things come out of it: the printable copy for the owner, and t" +
    'he case file you reopen on your next visit, saved as <span class="mono">' +
    `${esc((kase(d.caseId).address || "PROPERTY") + " - " + (kase(d.caseId).number || "CASE"))}` +
    '.json</span>.</p></div>\n    <div class="modal-f"><button class="btn" dat' +
    'a-close="modal">' +
    `${bad.length ? "Back to the document" : "Cancel"}` +
    '</button><button class="btn" id="btn-savework">Save draft &amp; return to Workspace' +
    '</button>\n      <button class="btn btn-primary" id="fin-go" ' +
    `${bad.length ? 'disabled title="Clear the outstanding checks first"' : WriterState.AMENDMENT_BUSY || WriterState.state.publicationBusy ? 'disabled title="The save is in progress"' : ""}` +
    ">" +
    "".concat(d.correction ? "Save &amp; issue correction" : initialCitations.enabled(d) ? "Issue citation" : "Issue document") +
    "</button></div></div></div>"
  );
}

function overlayHTML() {
  return WriterState.state.modal ? modalHTML() : WriterState.state.picker ? pickerHTML() : "";
}

function render() {
  if (helperStop.stopped) return; // Exit Document Writer replaced the page with its stopped state.
  if (WriterState.state.screen !== "cases") WriterState.state.issuedCase = ""; // R59: the issued-case highlight ends on navigation.
  const appRoot = document.getElementById("app"),
    sameImport = WriterState.state.screen === "import" && appRoot?.dataset?.renderScreen === "import";
  const importDisclosures = sameImport
    ? [...document.querySelectorAll(".import-alternative,.import-workflow")].map((el) => ({
        selector: el.classList.contains("import-alternative") ? ".import-alternative" : ".import-workflow",
        open: el.open,
        focus: el.contains(document.activeElement)
          ? document.activeElement.tagName === "SUMMARY"
            ? "summary"
            : document.activeElement.id
              ? document.activeElement.id
              : ""
          : "",
      }))
    : [];
  const languageFocus = rememberLanguageFocus(app_languagediscoveryContext());
  // A late save/filing repaint must not close actions the inspector just opened.
  const previous = document.querySelector(".document-workspace"),
    actions = document.querySelector(".editor-more"),
    active = document.activeElement;
  const importFocus =
    WriterState.state.screen === "import" && active?.id === "lookup-number" ? { start: active.selectionStart, end: active.selectionEnd } : null;
  const keepActions = WriterState.state.screen === "write" && previous?.dataset.editorDoc === WriterState.state.docId && actions?.open;
  const actionFocus = keepActions && actions.contains(active) ? (active.tagName === "SUMMARY" ? "summary" : active.id) : "";
  const sameDocument = WriterState.state.screen === "write" && previous?.dataset.editorDoc === WriterState.state.docId;
  const editingDoc = sameDocument ? doc(WriterState.state.docId) : null;
  const editingItem = active?.dataset?.field === "text" && editingDoc?.items.find((item) => item.id === active.dataset.id);
  // Reuse a live text field across passive refreshes so input still reaches its handler.
  // New model text, locks, dialogs and navigation always use the newly rendered field.
  const keepEditing =
    editingItem &&
    !WriterState.state.modal &&
    !WriterState.state.picker &&
    active.isContentEditable &&
    previous.contains(active) &&
    !isLocked(editingDoc) &&
    String(active.innerText ?? active.textContent ?? "") === String(editingItem.text ?? "");
  const selection = keepEditing && window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const caret =
    range && active.contains(range.startContainer) && active.contains(range.endContainer)
      ? { start: range.startContainer, startOffset: range.startOffset, end: range.endContainer, endOffset: range.endOffset }
      : null;
  const openDetails = sameDocument ? [...previous.querySelectorAll("details[id][open]")].map((el) => el.id) : [];
  const openPricing = sameDocument
    ? [...previous.querySelectorAll("[data-charge] [data-review-details][open]")].map((el) => [
        el.closest("[data-charge]").dataset.charge,
        el.dataset.reviewDetails,
      ])
    : [];
  // A background repaint of the same snow citation must keep focus in the snow fact being entered.
  const snowFocus = sameDocument && previous.contains(active) && active.dataset?.snow ? '[data-snow="' + checkAttr(active.dataset.snow) + '"]' : "";
  // A late save or filing repaint of the same document must not take focus from an identified form field
  // being typed in, such as the correction reason: its input already reached the model, so the new field
  // shows the same value. Dialogs, locks, navigation and changed model values use the newly rendered field.
  const fieldFocus =
    sameDocument &&
    !snowFocus &&
    previous.contains(active) &&
    active.id &&
    active.matches("input,textarea,select") &&
    !WriterState.state.modal &&
    !WriterState.state.picker &&
    !isLocked(editingDoc)
      ? {
          id: active.id,
          value: active.value,
          start: typeof active.selectionStart === "number" ? active.selectionStart : null,
          end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
        }
      : null;
  const worksheet = document.querySelector("[data-worksheet-context]"),
    inspectionChecks = document.querySelector(".ri-checks");
  const keepInspectionChecks =
    WriterState.state.screen === "reinspect" &&
    worksheet?.dataset.worksheetContext === walkIdentity(reinsp(WriterState.state.reinspId)) &&
    inspectionChecks?.open;
  const inspectionCheckFocus =
    keepInspectionChecks && inspectionChecks.contains(active)
      ? active.tagName === "SUMMARY"
        ? "summary"
        : active.matches(".check-link")
          ? '.check-link[data-check-index="' + active.dataset.checkIndex + '"][data-check-target="' + active.dataset.checkTarget + '"]'
          : ""
      : "";
  A11Y.rememberFocus();
  ensureWalkContext();
  document.getElementById("app").innerHTML =
    WriterState.state.screen === "cases"
      ? screenCases()
      : WriterState.state.screen === "import"
        ? screenImport()
        : WriterState.state.screen === "library"
          ? screenLibrary()
          : WriterState.state.screen === "tools"
            ? navigation.screen()
            : WriterState.state.screen === "write"
              ? screenWrite()
              : WriterState.state.screen === "caseactions"
                ? newDocuments.caseActionScreen()
                : WriterState.state.screen === "actions"
                  ? newDocuments.actionScreen()
                  : WriterState.state.screen === "reinspect"
                    ? screenReinspect()
                    : screenCases();
  if (keepEditing) {
    const replacement = [...appRoot.querySelectorAll('[data-field="text"]')].find((field) => field.dataset.id === active.dataset.id);
    if (replacement) {
      for (const attribute of [...active.attributes]) active.removeAttribute(attribute.name);
      for (const attribute of replacement.attributes) active.setAttribute(attribute.name, attribute.value);
      replacement.replaceWith(active);
    }
  }
  if (appRoot?.dataset) appRoot.dataset.renderScreen = WriterState.state.screen;
  document.getElementById("overlay").innerHTML = overlayHTML();
  if (WriterState.state.screen === "write") {
    paginate();
    editorEnhance();
  }
  restoreWorkControls();
  updateSaveStatus();
  enhanceDialog();
  highlightOpenChecks();
  A11Y.enhance();
  if (keepInspectionChecks) {
    const current = document.querySelector(".ri-checks");
    if (current) {
      current.open = true;
      if (inspectionCheckFocus) current.querySelector(inspectionCheckFocus)?.focus({ preventScroll: true });
    }
  }
  for (const kept of importDisclosures) {
    const current = document.querySelector(kept.selector);
    if (current) {
      current.open = kept.open;
      if (kept.focus) {
        const target = kept.focus === "summary" ? current.querySelector("summary") : document.getElementById(kept.focus);
        if (current.contains(target)) target?.focus({ preventScroll: true });
      }
    }
  }
  if (importFocus) {
    const input = document.getElementById("lookup-number");
    if (input) {
      input.focus({ preventScroll: true });
      if (Number.isInteger(importFocus.start) && Number.isInteger(importFocus.end)) input.setSelectionRange(importFocus.start, importFocus.end);
    }
  }
  if (keepActions) {
    const current = document.querySelector(".editor-more");
    if (current) {
      current.open = true;
      if (actionFocus && !WriterState.state.modal && !WriterState.state.picker) {
        const target = actionFocus === "summary" ? current.querySelector("summary") : document.getElementById(actionFocus);
        if (target && current.contains(target)) target.focus({ preventScroll: true });
      }
    }
  }
  // Keep identified disclosures through late history reads for this document only.
  // New validation may still open a previously closed disclosure.
  for (const id of openDetails) {
    const current = document.getElementById(id);
    if (current?.tagName === "DETAILS") current.open = true;
  }
  for (const [charge, key] of openPricing) {
    const current = document.querySelector('[data-charge="' + checkAttr(charge) + '"] [data-review-details="' + checkAttr(key) + '"]');
    if (current) current.open = true;
  }
  if (snowFocus && !WriterState.state.modal && !WriterState.state.picker)
    document.querySelector(".document-workspace " + snowFocus)?.focus({ preventScroll: true });
  if (fieldFocus && !WriterState.state.modal && !WriterState.state.picker) {
    const field = document.getElementById(fieldFocus.id);
    if (field && field.closest(".document-workspace") && field.value === fieldFocus.value && document.activeElement !== field) {
      field.focus({ preventScroll: true });
      if (fieldFocus.start !== null && typeof field.setSelectionRange === "function")
        try {
          field.setSelectionRange(fieldFocus.start, fieldFocus.end);
        } catch (error) {
          // Date and select controls have no text selection; focus alone is restored.
        }
    }
  }
  const q = document.getElementById("pk-q");
  if (q) {
    q.focus();
    q.setSelectionRange(q.value.length, q.value.length);
  }
  restoreLanguageFocus(app_languagediscoveryContext(), languageFocus);
  if (keepEditing && active.isConnected) {
    active.focus({ preventScroll: true });
    if (caret) {
      try {
        const restored = document.createRange();
        restored.setStart(caret.start, caret.startOffset);
        restored.setEnd(caret.end, caret.endOffset);
        selection.removeAllRanges();
        selection.addRange(restored);
      } catch (error) {
        // A browser may normalize a selection; the editing node and its text remain intact.
      }
    }
  }
}

function renderKeep() {
  const y = window.scrollY;
  if (WriterState.DIRTY) scheduleDraftSave();
  render();
  window.scrollTo(0, y);
}

function renumber(d) {
  d.items.forEach((it, ix) => {
    it.no = String(ix + 1);
  });
}

function moveItem(id, direction, grip = false) {
  const d = doc(WriterState.state.docId);
  if (!d || !structEditable(d)) return false;
  const ix = d.items.findIndex((it) => it.id === id),
    to = ix + (direction === "up" ? -1 : 1);
  if (ix < 0 || to < 0 || to >= d.items.length) return false;
  [d.items[ix], d.items[to]] = [d.items[to], d.items[ix]];
  renumber(d);
  WriterState.DIRTY = true;
  refreshSheet();
  const target = document.querySelector(
    grip ? '[data-grip="' + checkAttr(id) + '"]' : '[data-move="' + checkAttr(id) + '"][data-direction="' + direction + '"]',
  );
  (target || document.querySelector('[data-grip="' + checkAttr(id) + '"]'))?.focus();
  toast("Item " + (to + 1) + " moved " + direction);
  return true;
}

function newDoc(caseId, type) {
  if (snow.isCase(kase(caseId)) && type !== "notice" && type !== "citation") {
    toast("Snow cases offer only the snow citation.");
    return;
  }
  if (snow.isCase(kase(caseId))) type = "citation";
  if (recordIntegrity.blocked(caseId)) {
    toast("This record was changed outside the program. Read-only.");
    return;
  }
  const nd = {
    id: uid("d"),
    caseId: caseId,
    type: type,
    created: recordDay(today),
    status: "Draft",
    draft: true,
    mailed: recordDay(today),
    authoringVersion: 16,
    items: [],
    cc: "",
    cits: {},
    expectedHead: recordHead(caseId),
  };
  WriterState.DOCS.unshift(nd);
  if (snow.isCase(kase(caseId))) snow.addDefault(nd);
  WriterState.state.docId = nd.id;
  WriterState.state.screen = "write";
  WriterState.DIRTY = true;
  saveDrafts();
  render();
  toast(((DOC_TYPES.find((t) => t.id === type) || {}).label || type) + " started");
}

export {
  openImportWorkspace,
  lookupCard,
  cancelCaseLookup,
  checkLookupShared,
  findDatabaseCase,
  confirmDatabaseCase,
  selectImportInspection,
  accelaPlan,
  acceptAccela,
  attachCheckTargets,
  worksheetChecks,
  highlightOpenChecks,
  focusCheckTarget,
  dueCheck,
  editorSync,
  overlayHTML,
  render,
  renderKeep,
  renumber,
  moveItem,
  newDoc,
};
