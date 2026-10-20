import { mailingMaxDay as dep_mailingMaxDay, recordDay as dep_recordDay, validCaseNumber as dep_validCaseNumber } from "../assets/shared.js";
import {
  checks as dep_checks,
  fmtDate as dep_fmtDate,
  fmtTime as dep_fmtTime,
  inspAt as dep_inspAt,
  longDate as dep_longDate,
  parseTime as dep_parseTime,
  printJob as dep_printJob,
  toast as dep_toast,
  validISO as dep_validISO,
} from "./court_and_deposits.js";
import {
  caseDetails as dep_caseDetails,
  helperJSON as dep_helperJSON,
  loadCaseFile as dep_loadCaseFile,
  reindexReport as dep_reindexReport,
  shell as dep_shell,
  sourceDocFor as dep_sourceDocFor,
  stableJSON as dep_stableJSON,
  storageReport as dep_storageReport,
} from "./workspace_shell.js";
import {
  caseUnsaved as dep_caseUnsaved,
  recipientPreview as dep_recipientPreview,
  saveDrafts as dep_saveDrafts,
  scheduleDraftSave as dep_scheduleDraftSave,
  updateSaveStatus as dep_updateSaveStatus,
  validateAndStandardizeAddresses as dep_validateAndStandardizeAddresses,
} from "./case_files.js";
import {
  accelaFromShare as dep_accelaFromShare,
  accelaTable as dep_accelaTable,
  baseLookupAccept as dep_baseLookupAccept,
  baseLookupPlan as dep_baseLookupPlan,
  clearWalk as dep_clearWalk,
  editableWalkItem as dep_editableWalkItem,
  ensureWalkContext as dep_ensureWalkContext,
  nextWalkItem as dep_nextWalkItem,
  screenCases as dep_screenCases,
  screenImport as dep_screenImport,
  screenLibrary as dep_screenLibrary,
  walkIdentity as dep_walkIdentity,
  walkItemReady as dep_walkItemReady,
} from "./reinspection_walkthrough.js";
import {
  captureWork as dep_captureWork,
  citationRecoveryPanel as dep_citationRecoveryPanel,
  correctionDiffHTML as dep_correctionDiffHTML,
  correctionEligibility as dep_correctionEligibility,
  correctionPanel as dep_correctionPanel,
  documentItemHistory as dep_documentItemHistory,
  filingPanel as dep_filingPanel,
  recordActionModal as dep_recordActionModal,
  recordHistoryHTML as dep_recordHistoryHTML,
  revisionPrintNote as dep_revisionPrintNote,
} from "./issuance_and_corrections.js";
import {
  publicationPanel as dep_publicationPanel,
  recoveryModal as dep_recoveryModal,
  restoreWorkControls as dep_restoreWorkControls,
  returnToWorksheet as dep_returnToWorksheet,
  unissuedVisitFor as dep_unissuedVisitFor,
  worksheetFaults as dep_worksheetFaults,
} from "./draft_recovery.js";
import {
  catalogDraftNotice as dep_catalogDraftNotice,
  preflightCase as dep_preflightCase,
  sharedChangeModal as dep_sharedChangeModal,
} from "./language_catalog.js";
import {
  citationReview as dep_citationReview,
  dueContext as dep_dueContext,
  dueDateSpacingConflicts as dep_dueDateSpacingConflicts,
  duePanel as dep_duePanel,
} from "./case_timeline.js";
import { enhanceDialog as dep_enhanceDialog, paginate as dep_paginate, refreshSheet as dep_refreshSheet } from "./document_pagination.js";
import {
  A11Y as dep_A11Y,
  ACC_COLS as dep_ACC_COLS,
  ACC_LABEL as dep_ACC_LABEL,
  BOXN as dep_BOXN,
  BOXY as dep_BOXY,
  CASEDIR_EXPECT as dep_CASEDIR_EXPECT,
  COMMITTED as dep_COMMITTED,
  DOC_TYPES as dep_DOC_TYPES,
  EMAIL_KINDS as dep_EMAIL_KINDS,
  LOOKUP_READY as dep_LOOKUP_READY,
  MINDUE as dep_MINDUE,
  OC_WORD as dep_OC_WORD,
  OUTCOMES as dep_OUTCOMES,
  SQL_COLUMNS as dep_SQL_COLUMNS,
  accStatusEligible as dep_accStatusEligible,
  accStr as dep_accStr,
  agentLines as dep_agentLines,
  blockers as dep_blockers,
  ccLines as dep_ccLines,
  ccList as dep_ccList,
  checkAttr as dep_checkAttr,
  checkTarget as dep_checkTarget,
  citSelector as dep_citSelector,
  clone as dep_clone,
  countBlanks as dep_countBlanks,
  daysBetween as dep_daysBetween,
  deliveredByCitation as dep_deliveredByCitation,
  distinctDues as dep_distinctDues,
  doc as dep_doc,
  docBlocks as dep_docBlocks,
  docBody as dep_docBody,
  docCase as dep_docCase,
  docInsp as dep_docInsp,
  docsFor as dep_docsFor,
  doneItems as dep_doneItems,
  draftDocFor as dep_draftDocFor,
  draftReinspFor as dep_draftReinspFor,
  dueItems as dep_dueItems,
  editableBlanks as dep_editableBlanks,
  emailList as dep_emailList,
  esc as dep_esc,
  eventsFor as dep_eventsFor,
  frozenOf as dep_frozenOf,
  globalCourt as dep_globalCourt,
  globalCourtContact as dep_globalCourtContact,
  globalCourtCopies as dep_globalCourtCopies,
  globalCourtInstructions as dep_globalCourtInstructions,
  hasOwnInsp as dep_hasOwnInsp,
  initialCitations as dep_initialCitations,
  insp as dep_insp,
  isEffective as dep_isEffective,
  isHistoryDoc as dep_isHistoryDoc,
  isLLC as dep_isLLC,
  isLocked as dep_isLocked,
  iso as dep_iso,
  itemLibraryKey as dep_itemLibraryKey,
  itemSelector as dep_itemSelector,
  kase as dep_kase,
  markBlanks as dep_markBlanks,
  money as dep_money,
  navigation as dep_navigation,
  newDocuments as dep_newDocuments,
  nl2 as dep_nl2,
  ocOf as dep_ocOf,
  openItems as dep_openItems,
  ownerLines as dep_ownerLines,
  recordHead as dep_recordHead,
  recordIntegrity as dep_recordIntegrity,
  reinsp as dep_reinsp,
  reinspFor as dep_reinspFor,
  snow as dep_snow,
  structEditable as dep_structEditable,
  summaryName as dep_summaryName,
  uid as dep_uid,
  unchecked as dep_unchecked,
} from "./app_core.js";
import { app_languagediscoveryContext, app_savedworkContext } from "./app_view_contexts.js";
import {
  CITATION_POLICY as dep_CITATION_POLICY,
  cents as dep_cents,
  formatDeposit as dep_formatDeposit,
  formatDollarsOnLegacyReprints as dep_formatDollarsOnLegacyReprints,
} from "./citation_policy.js";
import { LOGO as dep_LOGO } from "./data/build_identity.js";
import { INSPECTORS as dep_INSPECTORS } from "./data/inspectors.js";
import { alignedExtension as dep_alignedExtension, specialType as dep_specialType } from "./new_documents.js";
import { WriterState } from "./state.js";
import { authFetch } from "./helper_transport.js";
import { languagePicker, rememberLanguageFocus, restoreLanguageFocus } from "./language_discovery.js";
import { documentSaveHTML } from "./saved_work.js";
/* app functions; direct dependencies use explicit shared state. */

function openImportWorkspace(cid) {
  const k = dep_kase(cid);
  if (!k) return;
  cancelCaseLookup();
  dep_captureWork();
  dep_preflightCase(cid, "continue existing case", () => {
    const draft = dep_draftDocFor(cid),
      visit = dep_draftReinspFor(cid) || dep_unissuedVisitFor(cid),
      current = dep_sourceDocFor(cid);
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
    dep_saveDrafts();
    render();
  });
}

function lookupCard() {
  return (
    '<div class="card lookup-card"><div class="card-h"><h2>Find a case</h2><s' +
    'pan class="pill">City database</span></div><div class="card-b">\n  <p>Ent' +
    "er the case number to retrieve its property, owner and inspection detail" +
    's.</p>\n  <form id="lookup-form" class="lookup-row" aria-busy="' +
    `${WriterState.LOOKUP_BUSY}` +
    '">\n    <label class="f"><span>Case number</span><input type="text" id="l' +
    'ookup-number" maxlength="80" autocomplete="off" spellcheck="false" place' +
    'holder="CB2026-000-00000" value="' +
    `${dep_esc(WriterState.WORK.entry["lookup-number"] || "")}` +
    '" ' +
    `${WriterState.LOOKUP_BUSY ? "readonly" : ""}` +
    '></label>\n    <button class="btn btn-primary" type="submit" ' +
    `${WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
    ">" +
    `${WriterState.LOOKUP_BUSY ? "Finding case…" : "Find case"}` +
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
    "".concat(WriterState.LOOKUP_ERROR ? `<div class="banner alert"><div>${dep_esc(WriterState.LOOKUP_ERROR)}</div></div>` : "") +
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
  const keys = Object.keys(dep_ACC_COLS);
  const grid = [keys.map((k) => dep_ACC_LABEL(k))];
  const warnings = [];
  result.rows.forEach((row) => {
    if (!row || dep_accStr(row.CaseNumber).toUpperCase() !== number) throw new Error("The database returned a different case. Nothing was imported.");
    if (/^yes$/i.test(dep_accStr(row.IndividualLandmark)) && !dep_accStr(row.Landmark))
      throw new Error(
        "The database marks this property as an individual landmark but supplies " + "no landmark name. Correct the source record before importing.",
      );
    if (/^yes$/i.test(dep_accStr(row.HistoricDistrict)) && !dep_accStr(row.HistoricDistrictName))
      throw new Error("The database marks this property as historic but supplies no district na" + "me. Correct the source record before importing.");
    grid.push(
      keys.map((k) =>
        k === "number"
          ? number
          : k === "detail" || k === "zoning"
            ? ""
            : k === "date" && /T00:00:00$/.test(row.InspectionDate || "")
              ? row.InspectionDate.slice(0, 10)
              : (row[dep_SQL_COLUMNS[k]] ?? ""),
      ),
    );
  });
  const table = dep_accelaTable(grid);
  if (table.errors.length) throw new Error(table.errors.join(" "));
  if (table.cases.length !== 1) throw new Error("More than one case was returned. Nothing was imported.");
  const c = table.cases[0],
    eligible = c.rows.filter((r) => r.selectable && dep_accStatusEligible(r.status, r.type));
  // No arbitrary choice when several completed inspections are available.
  const sel = eligible.length === 1 ? eligible[0].i : null;
  if (eligible.length > 1) warnings.push("Several completed inspections are available. Select the inspection you are documenting.");
  return {
    fileName: "Case lookup · " + number,
    source: dep_clone(result.source),
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
  const number = dep_accStr(acc.cases[acc.caseIx || 0].number).toUpperCase();
  const listing = await dep_helperJSON("/cases/list");
  if (!isCurrent()) return false;
  if (!Array.isArray(listing.files)) throw new Error("The shared case list could not be checked. Retry when the shared folder is available.");
  const tail = (" - " + number + ".json").toLowerCase();
  const hits = listing.files.filter((f) => typeof f.name === "string" && f.name.toLowerCase().endsWith(tail));
  if (hits.length > 1)
    throw new Error("More than one shared file has this case number. Ask the record administrator to resolve the duplicate files.");
  const locals = WriterState.CASES.filter((k) => dep_accStr(k.number).toUpperCase() === number);
  if (locals.length > 1 || locals.some((k) => k.number !== number))
    throw new Error("The local workspace has duplicate or differently capitalized case number" + "s. Resolve the existing record before importing.");
  if (hits.length) {
    const result = await dep_helperJSON("/cases/open?name=" + encodeURIComponent(hits[0].name));
    if (!isCurrent()) return false;
    if (dep_accStr(result.file?.case?.number).toUpperCase() !== number)
      throw new Error("The shared filename and case number disagree. The existing record has been kept.");
    const keep = { screen: WriterState.state.screen, docId: WriterState.state.docId, dirty: WriterState.DIRTY };
    let loaded;
    try {
      loaded = dep_loadCaseFile(JSON.stringify(result.file));
    } finally {
      WriterState.state.screen = keep.screen;
      WriterState.state.docId = keep.docId;
      WriterState.DIRTY = keep.dirty;
    }
    if (!loaded) throw new Error("The existing shared case could not be merged. Resolve the case-file or local-edit conflict before importing.");
    dep_COMMITTED.set(dep_summaryName(result.file.case), result);
  }
  acc.shareError = "";
  return true;
}

function lookupPlanSignature(acc) {
  const p = accelaPlan(acc);
  return dep_stableJSON({
    caseNumber: p.c?.number,
    documents: p.existing ? dep_docsFor(p.existing.id) : [],
    visits: p.existing ? dep_reinspFor(p.existing.id) : [],
    sel: acc.sel,
    date: p.date,
    time: p.time,
    next: p.next,
    existing: p.existing ? dep_caseDetails(p.existing) : null,
    diff: p.diff,
    blockers: p.blockers,
    warnings: p.warnings,
    head: p.existing ? dep_eventsFor(p.existing.id) : [],
  });
}

function lookupCanOpen(acc) {
  const p = accelaPlan(acc),
    c = acc.cases[0];
  // R37: a Record Category of "Snow Removal" advances a new case directly to the 10.28 snow citation draft.
  return (
    !p.existing &&
    (p.next === "notice" || (p.next === "snow" && dep_snow.matchesImport(p.row))) &&
    !p.blockers.length &&
    !p.warnings.length &&
    c.rows.filter((r) => r.selectable && dep_accStatusEligible(r.status, r.type)).length === 1 &&
    p.row?.typeKey === "initial" &&
    dep_accStatusEligible(p.row.status, p.row.type)
  );
}

async function findDatabaseCase() {
  if (WriterState.LOOKUP_BUSY) return;
  dep_captureWork();
  const number = dep_accStr(WriterState.WORK.entry["lookup-number"]).toUpperCase();
  WriterState.WORK.entry["lookup-number"] = number;
  if (!dep_validCaseNumber(number)) {
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
    if (!(await dep_saveDrafts()))
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
    WriterState.WORK.acc = dep_clone(acc);
    if (!(await dep_saveDrafts()))
      throw new Error("Case retrieved, but this device could not save the review. Keep the page open or download a workspace backup.");
    if (active() && !acc.shareError && lookupCanOpen(acc)) {
      dep_LOOKUP_READY.add(acc);
      try {
        acceptAccela();
      } finally {
        dep_LOOKUP_READY.delete(acc);
      }
    } else if (active()) dep_toast("Case retrieved — review the inspection and details");
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
      await dep_saveDrafts();
      render();
    }
  }
}

async function confirmDatabaseCase() {
  const acc = WriterState.state.acc;
  if (WriterState.LOOKUP_BUSY || !acc) return;
  WriterState.LOOKUP_ERROR = "";
  acc.shareError = "";
  const before = lookupPlanSignature(acc);
  WriterState.LOOKUP_BUSY = true;
  const serial = ++WriterState.LOOKUP_SERIAL;
  const active = () => serial === WriterState.LOOKUP_SERIAL && WriterState.state.screen === "import" && WriterState.state.acc === acc;
  render();
  try {
    if (WriterState.CASEDIR?.helper || acc.source?.kind === "sql") {
      if (!(await checkLookupShared(acc, active)) || !active()) return;
    } else {
      await dep_accelaFromShare(active);
      if (!active()) return;
    }
    if (before !== lookupPlanSignature(acc)) {
      dep_toast("The shared record changed. Review the refreshed details and confirm again.");
      return;
    }
    dep_LOOKUP_READY.add(acc);
    try {
      acceptAccela();
    } finally {
      dep_LOOKUP_READY.delete(acc);
    }
  } catch (e) {
    if (active()) acc.shareError = e.message;
  } finally {
    if (serial === WriterState.LOOKUP_SERIAL) {
      WriterState.LOOKUP_BUSY = false;
      await dep_saveDrafts();
      render();
    }
  }
}

function accelaPlan(acc) {
  const p = dep_baseLookupPlan(acc);
  if (acc) {
    if (acc.shareError) p.blockers.push(acc.shareError);
    if (p.existing && dep_docsFor(p.existing.id).some((d) => d.pendingIssue || d.pendingAmendment))
      p.blockers.push("Confirm the pending document save on this case before importing new details.");
  }
  return p;
}

function acceptAccela() {
  if ((WriterState.state.acc?.source?.kind === "sql" || WriterState.CASEDIR?.helper) && !dep_LOOKUP_READY.has(WriterState.state.acc)) {
    dep_toast("Check the shared record before confirming this lookup.");
    return null;
  }
  const direct = WriterState.state.acc?.source?.kind === "sql";
  const result = dep_baseLookupAccept();
  if (result && direct) {
    delete WriterState.WORK.entry["lookup-number"];
    dep_scheduleDraftSave();
  }
  return result;
}

function caseCheckFields(d) {
  if (dep_isLocked(d) || d.correction || d.type !== "notice") return "";
  return (
    '<details class="card case-check-fields no-print"><summary>Property recor' +
    'd details</summary><div class="card-b"><label class="f"><span>Parcel num' +
    'ber</span><input data-case="parcel" value="' +
    `${dep_esc(dep_docCase(d).parcel || "")}` +
    '" aria-label="Parcel number"></label></div></details>'
  );
}

function attachCheckTargets(d, c) {
  if (c.ok || c.targets?.length) return c;
  const t = c.t.toLowerCase(),
    targets = [],
    add = (s, l, a) => targets.push(dep_checkTarget(s, l, a));
  const visit = () => add("#btn-editvisit", "Review inspection", "visit");
  if (/parcel/.test(t)) add('[data-case="parcel"]', "Parcel number");
  else if (/registered agent/.test(t)) ["name", "addr", "city"].forEach((f) => add('[data-agent="' + f + '"]', "Registered agent " + f, "contacts"));
  else if (/mailing block/.test(t)) add('[data-case="ownerBlock"]', "Mailing block");
  else if (/case number/.test(t)) {
    if (!dep_validCaseNumber(dep_docCase(d).number)) add('[data-case="number"]', "Case number");
    if (!dep_docCase(d).address) add('[data-case="address"]', "Property address");
  } else if (/signing/.test(t)) add('[data-doc="inspectorId"]', "Signing inspector");
  else if (/explain the error/.test(t)) add("#correction-reason", "Correction reason");
  else if (/amendment instructions/.test(t)) add("#correction-external", "Amendment reference");
  else if (/original action date/.test(t)) add("#correction-action-date", "Original action date");
  else if (/mailing date|mailed date/.test(t)) add('[data-doc="mailed"]', "Mailed date");
  else if (/inspection|outcome|result date|compliance date|marked corrected/.test(t) && d.fromReinspId && !d.correction) visit();
  else if (/inspection date/.test(t)) add(d.inspDate !== undefined ? '[data-doc="inspDate"]' : '[data-case="date"]', "Inspection date");
  else if (/three distinct due dates/.test(t)) dep_dueItems(d).forEach((i) => add(dep_itemSelector(i.id, "due"), "Item " + i.no + " due date"));
  else if (/duplicate items|only once/.test(t)) d.items.forEach((i) => add('[data-del="' + dep_checkAttr(i.id) + '"]', "Item " + i.no));
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
        fields.forEach((f) => add(dep_citSelector(i.id, f), "Item " + i.no + " · " + f));
      });
  } else if (/withdrawn item needs/.test(t))
    d.items
      .filter((i) => i.withdrawn && String(i.withdrawalReason || "").trim().length < 10)
      .forEach((i) => add('[data-withdraw="' + dep_checkAttr(i.id) + '"]', "Item " + i.no + " withdrawal reason"));
  else if (/compliance dates/.test(t))
    d.items
      .filter((i) => i.done && !i.withdrawn && (!dep_validISO(i.doneOn) || i.doneOn > dep_recordDay(today) || i.doneOn < dep_docCase(d).date))
      .forEach((i) => add(dep_itemSelector(i.id, "doneOn"), "Item " + i.no + " compliance date"));
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
    `${dep_esc(c.t)}` +
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
                    `${dep_esc(target.label)}` +
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
  const src = dep_doc(r.sourceDocId);
  if (!src) return [];
  const out = [],
    add = (t, selector, label) => out.push({ ok: false, t, targets: [dep_checkTarget(selector, label)] });
  const dueRelevant = !r.followupIntent || r.followupIntent === "undecided" || ["extension", "citation"].includes(r.followupIntent);
  const initial = dep_docCase(src).date || "",
    earliest = dep_inspAt(src).date || initial;
  if (!dep_validISO(r.date) || r.date > dep_recordDay(today) || r.date < earliest)
    add("Inspection date must be between the source inspection and today.", "#ri-date", "Reinspection date");
  if (!dep_parseTime(r.time)) add("Enter the reinspection time before generating a document.", "#ri-time", "Reinspection time");
  if (!dep_insp(r.inspectorId).name) add("Select the inspector who performed this inspection.", "#ri-insp", "Inspector");
  src.items.forEach((i) => {
    const res = r.results[i.id] || {},
      on = res.manualDate ? res.on : res.on || r.date;
    if (i.done || i.withdrawn) return;
    if (!dep_OUTCOMES.some((o) => o.id === res.oc))
      add("Item " + i.no + ": choose an outcome.", '[data-setoc][data-item="' + dep_checkAttr(i.id) + '"]', "Item " + i.no + " outcome");
    else {
      if (!dep_validISO(on) || on < initial || on > r.date)
        add(
          "Item " + i.no + ": result date must be between the initial inspection and this visit.",
          '[data-ridate="' + dep_checkAttr(i.id) + '"]',
          "Item " + i.no + " result date",
        );
      if (dueRelevant && res.oc !== "corrected" && !dueCheck(res.due, dep_recordDay(today)).ok)
        out.push({
          ok: false,
          soft: true,
          t: "Item " + i.no + ": set a future due date for an extension or citation. Referrals need no due date.",
          targets: [dep_checkTarget('[data-ridue="' + dep_checkAttr(i.id) + '"]', "Item " + i.no + " new due date")],
        });
    }
  });
  if (dueRelevant && dep_distinctDues(dep_dueContext(r, true)).length > 3)
    out.push({
      ok: false,
      t: "Use no more than three distinct due dates for an extension or citation.",
      targets: dep_dueContext(r, true).map((i) => dep_checkTarget('[data-ridue="' + dep_checkAttr(i.id) + '"]', "Item " + i.no + " new due date")),
    });
  const spacing = dep_dueDateSpacingConflicts(dep_dueContext(r, true));
  if (dueRelevant && spacing.length) {
    const items = [...new Map(spacing.flatMap((x) => x.items).map((i) => [i.id, i])).values()];
    out.push({
      ok: false,
      t: "Keep distinct due dates at least seven days apart.",
      targets: items.map((i) => dep_checkTarget('[data-ridue="' + dep_checkAttr(i.id) + '"]', "Item " + i.no + " new due date")),
    });
  }
  for (const t of dep_worksheetFaults(r))
    if (!out.some((c) => c.t === t) && !/outcome|Result dates/.test(t))
      out.push({ ok: false, t, targets: [dep_checkTarget('[data-nav="cases"]', "Open case in Workspace", "workspace")] });
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
  const d = dep_doc(WriterState.state.docId),
    r = dep_reinsp(WriterState.state.reinspId);
  const list =
    WriterState.state.screen === "write" && d && !dep_isLocked(d)
      ? dep_checks(d)
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
  const d = dep_doc(WriterState.state.docId);
  dep_captureWork();
  WriterState.state.modal = null;
  WriterState.state.picker = false;
  if (target.action === "workspace") {
    openImportWorkspace(d?.caseId || dep_reinsp(WriterState.state.reinspId)?.caseId);
    return;
  }
  if (target.action === "catalog") {
    WriterState.state.screen = "library";
    WriterState.state.languageMode = "admin";
    WriterState.state.catalogAdminStatus = "review";
    const it = dep_doc(WriterState.state.docId)?.items.find((i) => i.id === target.itemId);
    if (it) WriterState.state.catalogAdminKey = dep_itemLibraryKey(it);
    render();
    return;
  }
  if (target.action?.startsWith("recipient:")) {
    const k = d && dep_docCase(d);
    if (!k) return;
    WriterState.state.ccProblem = dep_validateAndStandardizeAddresses(k, d.type === "citation" && dep_isLLC(k), false);
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
    if (!d || !dep_returnToWorksheet(d)) {
      dep_toast("Open the existing case in Workspace to review its recorded inspection.");
      return;
    }
    const r = dep_reinsp(WriterState.state.reinspId);
    WriterState.state.riFilter = "";
    dep_clearWalk();
    WriterState.WORK.walk = null;
    render();
    const check = worksheetChecks(r).find((c) => !c.soft) || worksheetChecks(r)[0];
    target = check?.targets[0] || dep_checkTarget("#ri-date", "Reinspection date");
  } else {
    if (WriterState.state.screen === "reinspect") {
      WriterState.state.riFilter = "";
      dep_clearWalk();
      WriterState.WORK.walk = null;
    }
    if (target.action === "contacts") WriterState.state.modal = "cc";
    render();
  }
  if (target.action === "guidance") {
    dep_toast(message);
    return;
  }
  const el = document.querySelector(target.selector);
  if (!el) {
    dep_toast(message + " Open the existing case to review the retained record.");
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
  if (!dep_validISO(due) || !dep_validISO(from || dep_recordDay(today))) return { ok: false, msg: "Enter a real calendar date" };
  const n = dep_daysBetween(from || dep_recordDay(today), due);
  if (n < 1) return { ok: false, msg: "Must be a future date" };
  if (n < 7) return { ok: true, warn: true, msg: n + " day" + (n === 1 ? "" : "s") + " — unusually short" };
  if (n > 180) return { ok: true, warn: true, msg: n + " days — unusually long" };
  return { ok: true, msg: n + " days" };
}

function screenReinspect() {
  const r = dep_reinsp(WriterState.state.reinspId);
  if (!r) {
    WriterState.state.screen = "cases";
    return dep_screenCases();
  }
  const k = dep_kase(r.caseId),
    src = dep_doc(r.sourceDocId);
  if (!src) {
    WriterState.state.screen = "cases";
    return dep_screenCases();
  }
  const srcLabel = (dep_DOC_TYPES.find((t) => t.id === src.type) || {}).label || src.type;
  const closed = !!r.docId,
    readOnly = closed || !r.draft;

  const shown = (it) => {
    const oc = dep_ocOf(r, it.id);
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
      const late = it.due && dep_daysBetween(it.due, r.date) > 0;
      const open = oc && oc !== "corrected" && oc !== "withdrawn";
      const carried = !!res.carried,
        lock = readOnly || carried;
      const dc = open ? dueCheck(res.due, r.date) : null;
      const walkHidden = !readOnly && WriterState.state.riWalk && WriterState.state.riWalkItem && !walkCurrent;
      return (
        '<div class="ri-item ' +
        `${walkCurrent ? "ri-walk-current" : ""}` +
        '" data-ri-item="' +
        `${dep_esc(it.id)}` +
        '" data-oc="' +
        `${dep_esc(oc)}` +
        '" ' +
        `${walkHidden ? "hidden" : ""}` +
        " " +
        `${walkCurrent ? 'data-ri-walk-current="true" aria-current="step" tabindex="-1"' : ""}` +
        '>\n      <div class="ri-top">\n        <span class="ri-no">' +
        `${dep_esc(it.no || String(ix + 1))}` +
        '.</span>\n        <span class="ri-ttl">' +
        `${dep_esc(it.title || "Violation item")}` +
        "</span>\n        " +
        `${(it.sections || []).map((x) => `<span class="cite-sec">${dep_esc(x)}</span>`).join("")}` +
        '\n        <span class="ri-due ' +
        `${late ? "over" : ""}` +
        '">Was due ' +
        `${dep_fmtDate(it.due)}` +
        '</span>\n      </div>\n      <div class="ri-body">' +
        `${dep_markBlanks(it.text || "")}` +
        '</div>\n      <div class="seg" role="group" aria-label="Result for item ' +
        `${dep_esc(it.no || String(ix + 1))}` +
        '">\n        ' +
        "".concat(
          dep_OUTCOMES
            .map(
              (o) =>
                '<button data-setoc="' +
                `${dep_esc(o.id)}` +
                '" data-item="' +
                `${dep_esc(it.id)}` +
                '" ' +
                `${lock ? "disabled" : ""}` +
                ' aria-pressed="' +
                `${oc === o.id ? "true" : "false"}` +
                '">' +
                `${dep_esc(o.label)}` +
                "</button>",
            )
            .join(""),
        ) +
        "\n      </div>\n      " +
        "".concat(
          carried
            ? '<p class="ri-carried">' +
                "".concat(
                  oc === "withdrawn"
                    ? "Withdrawn as entered in error; excluded from compliance counts."
                    : "Cleared on " + dep_esc(dep_fmtDate(res.on)) + " and carried forward.",
                ) +
                "</p>"
            : "",
        ) +
        "\n      " +
        "".concat(
          oc
            ? '<div class="ri-fields">\n        <label class="f"><span>Result date</span' +
                '>\n          <input type="date" data-ridate="' +
                `${dep_esc(it.id)}` +
                '" value="' +
                `${dep_esc(res.on || r.date)}` +
                '" max="' +
                `${dep_recordDay(today)}` +
                '" ' +
                `${lock ? "disabled" : ""}` +
                '><span class="hint">When this result was observed; no later than this vi' +
                "sit.</span></label>\n        " +
                "".concat(
                  open && (!r.followupIntent || r.followupIntent === "undecided" || ["extension", "citation"].includes(r.followupIntent))
                    ? '<label class="f"><span>Next due date</span>\n          <input type="date"' +
                        ' data-ridue="' +
                        `${dep_esc(it.id)}` +
                        '" value="' +
                        `${dep_esc(res.due || "")}` +
                        '" min="' +
                        `${dep_MINDUE()}` +
                        '" ' +
                        `${lock ? "disabled" : ""}` +
                        '>\n          <span class="hint ' +
                        `${dc.ok ? (dc.warn ? "warnt" : "") : "badt"}` +
                        '">' +
                        `${dep_esc(dc.msg)}` +
                        "</span></label>"
                    : "<div></div>",
                ) +
                '\n      </div>\n      <label class="f ri-note"><span>' +
                `${oc === "noaccess" ? "Access attempt and observations" : "Notes " + (open ? "" : "(optional)")}` +
                '</span>\n        <textarea rows="2" data-rinote="' +
                `${dep_esc(it.id)}` +
                '" placeholder="What you observed, who you spoke to, anything worth havin' +
                'g on the file" ' +
                `${lock ? "disabled" : ""}` +
                ">" +
                `${dep_esc(res.note || "")}` +
                "</textarea>" +
                "".concat(
                  oc === "noaccess"
                    ? '<span class="hint">Describe the access attempted, contact made and areas' +
                        " you could not inspect. No access is not a finding of compliance.</span>"
                    : "",
                ) +
                "</label>\n      " +
                "".concat(
                  open
                    ? '<label class="ri-cite"><input type="checkbox" data-ricite="' +
                        `${dep_esc(it.id)}` +
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

  const done = dep_doneItems(r).length,
    open = dep_openItems(r).length,
    left = dep_unchecked(r).length;
  const activeCount = src.items.filter((it) => !it.withdrawn).length;
  const recorded = activeCount - left,
    withdrawn = src.items.length - activeCount;
  const next = WriterState.state.riWalk ? dep_nextWalkItem(r) : null;
  const rowsShown = src.items.filter((it) => {
    const oc = dep_ocOf(r, it.id);
    if (WriterState.state.riFilter === "corrected") return oc === "corrected";
    if (WriterState.state.riFilter === "open") return oc && oc !== "corrected" && oc !== "withdrawn";
    if (WriterState.state.riFilter === "todo") return !oc;
    return true;
  }).length;
  const cited = dep_openItems(r).filter((i) => (r.results[i.id] || {}).cite);
  const badDue = dep_openItems(r).filter((i) => !dueCheck((r.results[i.id] || {}).due, r.date).ok);
  const prior = dep_reinspFor(r.caseId).filter((x) => x.id !== r.id && x.docId);
  const referred = dep_docsFor(r.caseId).some((x) => !x.draft && !x.void && !x.superseded && dep_isHistoryDoc(x));
  const walkPanel = !readOnly
    ? '<div class="ri-walk-panel ' +
      `${WriterState.state.riWalk ? "active" : ""}` +
      '" aria-label="Reinspection walk-through">\n    <div class="ri-walk-copy">' +
      "<strong>" +
      `${WriterState.state.riWalk ? "Walk-through on" : "Walk through items one at a time"}` +
      '</strong>\n      <span aria-live="polite">' +
      "".concat(
        WriterState.state.riWalk
          ? WriterState.state.riWalkStage === "details"
            ? "Complete item " +
              `${dep_esc(src.items.find((i) => i.id === WriterState.state.riWalkItem)?.no || "")}` +
              " details, then choose Next item. " +
              `${left}` +
              " without outcomes."
            : next
              ? "Next: item " +
                `${dep_esc(next.no || String(src.items.indexOf(next) + 1))}` +
                " of " +
                `${src.items.length}` +
                " · " +
                `${left}` +
                " left to result."
              : "All items have a result. Review the dates, notes and due dates before creating a document."
          : "Keep each outcome deliberate. The next unanswered item will be brought into focus.",
      ) +
      "</span>\n      " +
      "".concat(
        WriterState.state.riWalk
          ? "<small>Keyboard: <kbd>1</kbd> Corrected · <kbd>2</kbd> Progress · <kbd>3" +
              "</kbd> No change · <kbd>4</kbd> No access · <kbd>U</kbd> Undo</small>"
          : "<small>Keyboard shortcuts are available while walk-through is on. They a" + "re ignored while typing in a field.</small>",
      ) +
      '\n    </div>\n    <label class="f"><span>After an outcome</span><select id' +
      '="ri-walk-mode" ' +
      `${WriterState.state.riWalk ? "" : "disabled"}` +
      '><option value="quick" ' +
      `${WriterState.state.riWalkMode === "quick" ? "selected" : ""}` +
      '>Quick: next unanswered item</option><option value="details" ' +
      `${WriterState.state.riWalkMode === "details" ? "selected" : ""}` +
      ">Complete details, then next</option></select></label>\n    " +
      "".concat(WriterState.state.riWalk ? '<button class="btn btn-sm" data-riwalk-prev>Previous item</button>' : "") +
      "\n    " +
      "".concat(
        WriterState.state.riWalk && WriterState.state.riWalkStage === "details"
          ? '<button class="btn btn-primary btn-sm" data-riwalk-next>Next item</butto' +
              'n><button class="btn btn-sm" data-riwalk-skip>Skip for now</button>'
          : "",
      ) +
      "\n    " +
      "".concat(
        WriterState.state.riWalk &&
          src.items.some((it) => dep_editableWalkItem(r, it.id) && (!dep_walkItemReady(r, it.id) || WriterState.state.riWalkSkipped.includes(it.id)))
          ? '<button class="btn btn-sm" data-riwalk-return>Return to unfinished details</button>'
          : "",
      ) +
      "\n    " +
      "".concat(
        WriterState.state.riWalk && WriterState.state.riWalkUndo
          ? '<button class="btn btn-sm" data-riwalk-undo title="Undo the last walk-th' + 'rough result (U)">Undo last result <kbd>U</kbd></button>'
          : "",
      ) +
      '\n    <button class="btn ' +
      `${WriterState.state.riWalk ? "" : "btn-primary"}` +
      ' btn-sm" data-riwalk="' +
      `${WriterState.state.riWalk ? "off" : "on"}` +
      '" aria-pressed="' +
      `${WriterState.state.riWalk ? "true" : "false"}` +
      '">' +
      `${WriterState.state.riWalk ? "Review all items (pause)" : "Start walk-through"}` +
      "</button>\n  </div>"
    : "";

  let verdict;
  if (closed) {
    const nd = dep_doc(r.docId),
      ndl = (dep_DOC_TYPES.find((t) => t.id === (nd || {}).type) || {}).label || "follow-up";
    verdict =
      '<div class="banner ok"><div><strong>' +
      "".concat(dep_doc(r.docId) && dep_doc(r.docId).draft ? "A follow-up document is being drafted." : "This reinspection is finished.") +
      "</strong> " +
      `${dep_esc(ndl)}` +
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
      `${dep_esc(srcLabel.toLowerCase())}` +
      " needs an outcome before you create a draft.</div></div>";
  } else if (!open) {
    verdict =
      '<div class="banner ok"><div><strong>Everything on this ' +
      `${dep_esc(srcLabel.toLowerCase())}` +
      " was corrected.</strong> Write the compliance letter to tell the owner t" +
      "he case is closed. It records the visit and carries the date each item w" +
      "as met.</div></div>";
  } else if (badDue.length && ["extension", "citation"].includes(r.followupIntent)) {
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
              dep_esc(r.importRule.status) +
              " sets the next document: " +
              dep_esc(r.importRule.label) +
              "." +
              (r.importRule.cite ? " Tick the items you are citing." : "") +
              (r.importRule.allCorrected ? " Every item must be marked Corrected." : "")
            : "Choose the next action: an extension to allow more time, a referral to s" +
              "end the case to the City Attorney, or a citation. Citations are at your " +
              "discretion for any item past its due date — tick the items you are citin" +
              "g.",
      ) +
      " Item numbers stay as they are on the " +
      `${dep_esc(srcLabel.toLowerCase())}` +
      ".</div></div>";
  }

  return dep_shell(
    dep_esc(k.address),
    `${dep_esc(k.number)} · Reinspection · working off the ${dep_esc(srcLabel.toLowerCase())}`,
    '<button class="btn" id="btn-savework">Save &amp; continue later</button>',
    '<div class="reinspection-workspace" data-worksheet-context="' +
      `${dep_esc(dep_walkIdentity(r))}` +
      '"><p class="ri-source">Inspecting against the ' +
      `${dep_esc(srcLabel.toLowerCase())}` +
      " issued " +
      `${dep_fmtDate(src.mailed || src.created)}` +
      ". Original item numbers and wording stay with the issued document.</p>\n " +
      '    <div class="card ri-visit" style="margin-bottom:16px"><div class="ca' +
      'rd-b">\n       <div class="grid g2">\n         <label class="f"><span>Actu' +
      'al inspection date and time</span><span class="ri-when"><input type="dat' +
      'e" id="ri-date" value="' +
      `${dep_esc(r.date)}` +
      '" max="' +
      `${dep_recordDay(today)}` +
      '" ' +
      `${readOnly ? "disabled" : ""}` +
      '><input type="time" id="ri-time" value="' +
      `${dep_esc(r.time || "")}` +
      '" aria-label="Reinspection time" ' +
      `${readOnly ? "disabled" : ""}` +
      '></span><span class="hint">The physical visit. Item result dates and fut' +
      'ure deadlines are separate below.</span></label>\n         <label class="' +
      'f"><span>Inspector</span><select id="ri-insp" ' +
      `${readOnly ? "disabled" : ""}` +
      ">" +
      "".concat(
        dep_INSPECTORS.map((x) => `<option value="${x.id}" ${r.inspectorId === x.id ? "selected" : ""}>${dep_esc(x.name)}</option>`).join(""),
      ) +
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
                      `${dep_fmtDate(x.date)}` +
                      "</strong> — " +
                      `${dep_doneItems(x).length}` +
                      " corrected, " +
                      `${dep_openItems(x).length}` +
                      " outstanding · " +
                      `${dep_esc(dep_insp(x.inspectorId).name)}` +
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
      `${rows}` +
      "\n\n     " +
      "".concat(
        !readOnly
          ? '<details class="ri-checks"><summary>Inspection checks · ' +
              worksheetChecks(r).filter((c) => !c.soft).length +
              " to resolve before a document</summary>" +
              worksheetCheckPanel(r) +
              dep_duePanel(r, true) +
              "</details>"
          : "",
      ) +
      "\n     " +
      `${verdict}` +
      "\n     " +
      "".concat(!closed ? dep_newDocuments.chooser(r) : `<button class="btn" data-open="${dep_esc(r.docId)}">Open the document</button>`) +
      '\n     <div class="ri-foot"><button class="btn" id="btn-risave">Save &amp' +
      "; continue later</button></div></div>",
  );
}

function noticeHTML(d) {
  const aligned = dep_alignedExtension(d);
  const k = dep_docCase(d),
    i = dep_docInsp(d),
    blocks = dep_docBlocks(d),
    locked = dep_isLocked(d);
  const ce = locked ? "" : 'contenteditable="true"';
  const dis = locked ? "disabled" : "";
  let last = null;
  // while the first notice is still a draft the numbering follows the order;
  // after it is issued the stored number is what the owner has in hand
  const struct = dep_structEditable(d);
  const rows = d.items
    .map((it, ix) => {
      let head = "";
      const g = (it.group || "").trim();
      if (g !== last) {
        last = g;
        if (g)
          head =
            '<tr class="grp"><td colspan="5"><span class="ed" ' +
            `${ce}` +
            ' data-field="group" data-id="' +
            `${dep_esc(it.id)}` +
            '">' +
            `${dep_esc(g)}` +
            "</span></td></tr>";
      }
      const b = dep_countBlanks(it.text);
      const num = struct ? String(ix + 1) : it.no || String(ix + 1);
      const rce = (it.done && !d.correction) || it.withdrawn ? "" : ce;
      return (
        head +
        ('<tr data-row="' +
          `${dep_esc(it.id)}` +
          '" class="' +
          `${(it.done && d.type !== "compliance") || (d.correction && it.withdrawn) ? "done" : ""}` +
          '">\n      <td class="c-no">\n        ' +
          "".concat(
            struct
              ? '<span class="grip no-print" data-grip="' +
                  `${dep_esc(it.id)}` +
                  '" role="button" tabindex="0" aria-label="Reorder item ' +
                  `${dep_esc(num)}` +
                  '; use up or down arrow" title="Drag or use arrow keys to reorder">&#1026' +
                  '2;</span><button class="gbtn no-print" data-move="' +
                  `${dep_esc(it.id)}` +
                  '" data-direction="up" aria-label="Move item ' +
                  `${dep_esc(num)}` +
                  ' up" ' +
                  `${ix === 0 ? "disabled" : ""}` +
                  '>↑</button><button class="gbtn no-print" data-move="' +
                  `${dep_esc(it.id)}` +
                  '" data-direction="down" aria-label="Move item ' +
                  `${dep_esc(num)}` +
                  ' down" ' +
                  `${ix === d.items.length - 1 ? "disabled" : ""}` +
                  '>↓</button>\n          <button class="gbtn no-print" data-grpbtn="' +
                  `${dep_esc(it.id)}` +
                  '" aria-label="Location heading for item ' +
                  `${dep_esc(num)}` +
                  '" title="Location heading">&#9143;</button>'
              : "",
          ) +
          '\n        <span class="num">' +
          `${dep_esc(num)}` +
          '.</span>\n        <span class="bl" data-blanks="' +
          `${dep_esc(it.id)}` +
          '" style="' +
          `${b ? "" : "display:none"}` +
          '">' +
          `${b}` +
          "&nbsp;blank" +
          `${b === 1 ? "" : "s"}` +
          '</span></td>\n      <td class="c-sec"><div class="sec-list ed" ' +
          `${rce}` +
          ' data-field="sections" data-id="' +
          `${dep_esc(it.id)}` +
          '" data-ph="section">' +
          `${it.sections.map((x) => dep_esc(d.authoringVersion >= 9 ? it.printedReferences?.[x] || x : x)).join("<br>")}` +
          '</div></td>\n      <td class="c-ab">' +
          "".concat(
            it.done
              ? "&mdash;"
              : d.type !== "notice"
                ? `<span class="ab-fixed">${it.abate ? "Yes" : "No"}</span>`
                : '<button class="ab-btn" data-abate="' +
                  `${dep_esc(it.id)}` +
                  '" data-on="' +
                  `${it.abate ? 1 : 0}` +
                  '" ' +
                  `${dis}` +
                  ">" +
                  `${it.abate ? "Yes" : "No"}` +
                  "</button>",
          ) +
          '</td>\n      <td class="corr">' +
          "".concat(
            it.withdrawn ? `<p class="withdrawn-note"><strong>Withdrawn as entered in error.</strong> ${dep_esc(it.withdrawalReason || "")}</p>` : "",
          ) +
          '<div class="ed" ' +
          `${rce}` +
          ' data-field="text" data-id="' +
          `${dep_esc(it.id)}` +
          '" data-ph="Corrective action" style="white-space:pre-wrap">' +
          `${dep_editableBlanks(it.text)}` +
          "</div>" +
          `${d.draft ? dep_catalogDraftNotice(it) : ""}` +
          "\n        " +
          "".concat(
            dep_isHistoryDoc(d)
              ? dep_documentItemHistory(d, it)
                  .filter((x) => x.note)
                  .map(
                    (x) =>
                      '<div class="it-note"><span class="it-note-h">Inspector\'s note &middot; ' +
                      `${dep_esc(dep_fmtDate(x.on))}` +
                      "</span>" +
                      `${dep_esc(x.note)}` +
                      "</div>",
                  )
                  .join("")
              : it.note
                ? '<div class="it-note"><span class="it-note-h">Inspector\'s note &middot; ' +
                  `${dep_esc(dep_fmtDate(it.noteOn))}` +
                  '</span><span class="ed" ' +
                  `${rce}` +
                  ' data-field="note" data-id="' +
                  `${dep_esc(it.id)}` +
                  '" style="white-space:pre-wrap">' +
                  `${dep_esc(it.note)}` +
                  "</span></div>"
                : "",
          ) +
          "</td>\n      " +
          "".concat(
            struct && !it.done
              ? '<td class="c-cite no-print"><label title="Issue a citation with this not' +
                  'ice"><input type="checkbox" data-notecite="' +
                  `${dep_esc(it.id)}` +
                  '" ' +
                  `${it.cite ? "checked" : ""}` +
                  "><span>Cite</span></label></td>"
              : "",
          ) +
          '\n      <td class="c-due">' +
          "".concat(
            it.withdrawn
              ? `<span class="done-note withdrawn-note"><strong>Withdrawn</strong>Entered in error</span>`
              : dep_isHistoryDoc(d)
                ? it.done
                  ? `<span class="done-note"><strong>Corrected</strong>${dep_esc(dep_fmtDate(it.doneOn))}</span>`
                  : '<span class="visit-list">' +
                    "".concat(
                      dep_documentItemHistory(d, it).length
                        ? dep_documentItemHistory(d, it)
                            .map(
                              (x) =>
                                `<span><b>${dep_esc(dep_fmtDate(x.on))}</b><em>${dep_esc(dep_OC_WORD[x.oc] || x.oc)}</em>${
                                  x.cit ? `<i>Citation ${dep_esc(x.cit)}</i>` : ""
                                }</span>`,
                            )
                            .join("")
                        : '<span class="muted">no reinspection recorded</span>',
                    ) +
                    "</span>"
                : d.type === "compliance"
                  ? `<span class="mono">${dep_esc(dep_fmtDate(it.doneOn || it.due))}</span>`
                  : it.done
                    ? `<span class="done-note"><strong>Corrected</strong>${dep_esc(dep_fmtDate(it.doneOn))}</span>`
                    : aligned &&
                        d.type === "vacancyExtension" &&
                        d.special?.deadlineMode === "conditional" &&
                        d.special.affected?.includes(String(it.no))
                      ? '<span class="conditional-due">Conditional — see conditions above</span>'
                      : '<input type="date" class="d-in due-in" data-field="due" data-id="' +
                        `${dep_esc(it.id)}` +
                        '" value="' +
                        `${dep_esc(it.due || "")}` +
                        '" min="' +
                        `${d.correction ? "" : dep_MINDUE()}` +
                        '" aria-label="Due date for item ' +
                        `${dep_esc(num)}` +
                        '" ' +
                        `${dis}` +
                        ">",
          ) +
          "\n        " +
          "".concat(
            d.correction && !locked
              ? '<button class="lnk no-print" data-withdraw="' +
                  `${dep_esc(it.id)}` +
                  '">' +
                  `${it.withdrawn ? "Restore item" : "Withdraw item"}` +
                  "</button>"
              : "",
          ) +
          "" +
          "".concat(
            struct
              ? '<button class="rm no-print" data-del="' +
                  `${dep_esc(it.id)}` +
                  '" aria-label="Remove item ' +
                  `${dep_esc(num)}` +
                  '" title="Remove this item">&times;</button>'
              : "",
          ) +
          "</td></tr>")
      );
    })
    .join("");

  const result =
    '<div class="sheet' +
    `${d.void ? " voided" : ""}` +
    '">\n    ' +
    "".concat(
      d.void
        ? '<div class="void-wm" aria-hidden="true"><span>VOID</span></div>\n      <d' +
            'iv class="void-note">Voided ' +
            `${dep_esc(dep_fmtDate(dep_recordDay(d.void.at)))}` +
            "" +
            `${d.void.reason ? " &mdash; " + dep_esc(d.void.reason) : ""}` +
            "</div>"
        : "",
    ) +
    '\n    <div class="n-head"><img class="n-seal" src="' +
    `${dep_LOGO}` +
    '" alt="City of Madison Building Inspection">\n      <div class="n-headmai' +
    'n"><div class="n-title' +
    `${!aligned && (dep_DOC_TYPES.find((x) => x.id === d.type) || {}).stacked ? " stacked" : ""}` +
    '"' +
    (aligned ? ' style="font-size:11pt!important"' : "") +
    ">" +
    "".concat(
      (function () {
        const ty = dep_DOC_TYPES.find((x) => x.id === d.type) || {};
        if (!ty.pfx) return "Building Inspection Official Notice";
        return ty.stacked && !aligned
          ? `<span class="pfx">${dep_esc(ty.pfx)}</span><br>${dep_esc(ty.heading || "Building Inspection Official Notice")}`
          : `<span class="pfx">${dep_esc(ty.pfx)} - </span>Building Inspection Official Notice`;
      })(),
    ) +
    '</div>\n      <div class="n-meta">\n        <dl class="n-col">\n          <' +
    'dt>Case number:</dt><dd><strong class="ed" ' +
    `${ce}` +
    ' data-case="number" aria-readonly="' +
    `${dep_eventsFor(d.caseId).length ? "true" : "false"}` +
    '">' +
    `${dep_esc(k.number)}` +
    "</strong></dd>\n          <dt>Inspection date:</dt><dd>" +
    "".concat(
      dep_hasOwnInsp(d)
        ? '<input type="date" class="d-in hdr-in" data-doc="inspDate" value="' +
            `${dep_esc(d.inspDate || "")}` +
            '" aria-label="Inspection date" ' +
            `${dis}` +
            '><input type="time" class="d-in hdr-in hdr-time" data-doc="inspTime" val' +
            'ue="' +
            `${dep_esc(d.inspTime || "")}` +
            '" aria-label="Inspection time" ' +
            `${dis}` +
            ">"
        : '<input type="date" class="d-in hdr-in" data-case="date" value="' +
            `${dep_esc(k.date || "")}` +
            '" aria-label="Inspection date" ' +
            `${dis}` +
            '><input type="time" class="d-in hdr-in hdr-time" data-case="time" value=' +
            '"' +
            `${dep_esc(k.time || "")}` +
            '" aria-label="Inspection time" ' +
            `${dis}` +
            ">",
    ) +
    '</dd>\n          <dt>Mailed date:</dt><dd><input type="date" class="d-in ' +
    'hdr-in" data-doc="mailed" value="' +
    `${dep_esc(d.mailed || "")}` +
    '" max="' +
    `${dep_mailingMaxDay(dep_initialCitations.enabled(d) ? "citation" : d.type)}` +
    '" aria-label="Mailed date" ' +
    `${dis}` +
    '></dd>\n        </dl>\n        <dl class="n-col">\n          <dt>Property:<' +
    '/dt><dd><strong class="ed" ' +
    `${ce}` +
    ' data-case="address">' +
    `${dep_esc(k.address)}` +
    "</strong></dd>\n          <dt>Inspector:</dt><dd>" +
    "".concat(
      locked
        ? `<span class="n-insp-name">${dep_esc(i.name)}</span>`
        : '<select class="d-in hdr-in" data-doc="inspectorId" aria-label="Signing i' +
            'nspector">' +
            "".concat(dep_INSPECTORS.map((x) => `<option value="${x.id}" ${i.id === x.id ? "selected" : ""}>${dep_esc(x.name)}</option>`).join("")) +
            "</select>",
    ) +
    '\n            <div class="n-insp-l">' +
    `${dep_esc(i.title)}` +
    '</div>\n            <div class="n-insp-l">' +
    `${dep_esc(i.phone)}` +
    '</div>\n            <div class="n-insp-l">' +
    `${dep_esc(i.email)}` +
    '</div></dd>\n        </dl>\n      </div></div></div>\n\n    <div class="n-ow' +
    'ner"><div class="ed" ' +
    `${ce}` +
    ' data-case="ownerBlock" data-ph="Owner and mailing address" style="white' +
    '-space:pre-wrap">' +
    `${dep_esc(dep_ownerLines(k).join("\n"))}` +
    "</div>" +
    "".concat(
      d.draft && !dep_isLocked(d) ? '<button class="btn btn-sm no-print" data-parse-address="owner|0">Preview mailing address</button>' : "",
    ) +
    '</div>\n    <div class="win-note no-print">Envelope window</div>\n    <div' +
    ' class="n-winspace" aria-hidden="true"></div>\n\n    ' +
    `${dep_revisionPrintNote(d)}` +
    '\n    <div class="n-body">' +
    `${dep_docBody(d)}` +
    "</div>\n\n\n    " +
    "".concat(
      d.type !== "compliance" && d.items.some((x) => x.done)
        ? '<p class="n-ruled">Items already corrected are listed below ruled throug' +
            "h, with the date we confirmed them. The remaining items are still outsta" +
            "nding.</p>"
        : "",
    ) +
    '\n    <table class="notice"><thead><tr><th class="c-no">Item No.</th><th ' +
    'class="c-sec">Violation Section No.</th><th class="c-ab">Abate</th><th>C' +
    "orrections Required</th>" +
    `${struct ? '<th class="c-cite no-print">Cite</th>' : ""}` +
    '<th class="c-due">' +
    `${dep_isHistoryDoc(d) ? "" : d.type === "compliance" ? "Date Complied" : "Due Date"}` +
    "</th></tr></thead>\n      <tbody>" +
    "".concat(rows || '<tr class="n-empty"><td colspan="6">No items yet — add the first violation below.</td></tr>') +
    "</tbody></table>\n    " +
    (aligned
      ? '<div class="extension-signer"><p>' +
        dep_esc((d.correction ? null : dep_frozenOf(d)?.authorizedSigner)?.name || d.special?.signerName || "◯") +
        "\n" +
        dep_esc((d.correction ? null : dep_frozenOf(d)?.authorizedSigner)?.title || d.special?.signerTitle || "◯") +
        "</p></div>"
      : "") +
    "".concat(
      !struct ? "" : '<div class="addwrap no-print"><button class="btn btn-primary addrow" id=' + '"btn-add">Add violation item</button></div>',
    ) +
    "\n    " +
    "".concat(
      (function () {
        // the agent is served a copy as a matter of course
        const ag = dep_agentLines(k);
        const cc = dep_ccList(k)
          .filter((c) => dep_ccLines(c, !!d.draft).length)
          .concat(ag.length ? [{ name: ag[0], addr: ag[1] || "", city: ag[2] || "", agent: true }] : []);
        const sent = d.emailedTo || [],
          draftMail = d.draft
            ? dep_emailList(k).filter(
                (e) => e.on !== false && (!Array.isArray(d.emailSelection) || d.emailSelection.includes(e.addr + "|" + (e.kind || "Other"))),
              )
            : [],
          mailRows = (d.draft ? draftMail : sent).filter((e) => String(e.addr || "").trim());
        if (!cc.length && !mailRows.length) return "";
        return (
          '<div class="n-cc">\n        ' +
          "".concat(
            cc.length
              ? '<div class="cc-row"><span class="cc-l">CC:</span><div class="cc-set">' +
                  "".concat(
                    cc
                      .map(
                        (c) =>
                          '<div class="cc-one">' +
                          `${dep_ccLines(c, !!d.draft)
                            .map((l) => `<div>${dep_esc(l)}</div>`)
                            .join("")}` +
                          "" +
                          `${c.agent ? '<div class="cc-role">Registered agent</div>' : ""}` +
                          "</div>",
                      )
                      .join(""),
                  ) +
                  "</div></div>"
              : "",
          ) +
          "\n        " +
          "".concat(
            mailRows.length
              ? '<div class="cc-row cc-mail"><span class="cc-l">' +
                  `${d.draft ? "Email recipients:" : "Email copy prepared for:"}` +
                  '</span><div class="cc-set">' +
                  `${mailRows.map((e) => `<div>${dep_esc(e.kind || "Other")} &mdash; ${dep_esc(e.addr)}</div>`).join("")}` +
                  "</div></div>"
              : "",
          ) +
          "\n      </div>"
        );
      })(),
    ) +
    "\n    " +
    "".concat(
      blocks.length ? `<div class="n-notes">${blocks.map((b) => `<h4>${dep_esc(b.label)}</h4><div>${dep_nl2(b.text)}</div>`).join("")}</div>` : "",
    ) +
    '\n    <div class="n-foot"><span class="mono">' +
    `${dep_esc(k.number)}` +
    "</span></div>\n  </div>";
  if (dep_snow.is(d) && d.authoringVersion >= 9)
    return result
      .replace('<div class="n-body">', '<div class="n-body snow-cover">')
      .replace(/<table class="notice">[\s\S]*?<\/table>/, "")
      .replace(/<div class="addwrap no-print">[\s\S]*?<\/div>/, "");
  if (!dep_specialType(d.type) || aligned) return result;
  const narrative = dep_docBody(d).match(/<p>[\s\S]*?<\/p>/g) || [];
  return result
    .replace('<div class="n-head">', '<div class="n-head r26-header">')
    .replace(/<div class="n-body">[\s\S]*?<\/div>/, '<div class="n-body"></div>')
    .replace(/<p class="n-ruled">[\s\S]*?<\/p>/, "")
    .replace(
      /<table class="notice">[\s\S]*?<\/table>/,
      '<table class="notice r26-narrative"><thead><tr><th aria-label="Order and conditions"></th></tr></thead><tbody>' +
        narrative.map((p) => "<tr><td>" + p + "</td></tr>").join("") +
        "</tbody></table>",
    );
}

function documentHTML(d) {
  return noticeHTML(d) + (d.type === "citation" ? citationFaces(d, true) : "");
}

function citField(d, iid, f, ph, locked) {
  const raw = ((d.cits || {})[iid] || {})[f] ?? "";
  const v = ["courtDate", "issued"].includes(f)
    ? dep_fmtDate(raw)
    : f === "courtTime"
      ? dep_fmtTime(raw)
      : f === "ord" && d.authoringVersion >= 8
        ? String(raw).replace(/^SPS(?=\d)/, "SPS ")
        : raw;
  return (
    '<span class="ed cf" ' +
    `${locked ? "" : 'contenteditable="true"'}` +
    ' data-cit="' +
    `${dep_esc(iid)}` +
    "|" +
    `${dep_esc(f)}` +
    '" data-ph="' +
    `${dep_esc(ph)}` +
    '">' +
    `${dep_esc(v)}` +
    "</span>"
  );
}

function citAmount(d, it) {
  // Rendering retained documents never recalculates or changes their evidence.
  const amount = ((d.cits || {})[it.id] || {}).amount;
  return d.authoringVersion >= 7 || dep_formatDollarsOnLegacyReprints ? dep_formatDeposit(amount) : String(amount ?? "");
}

function citationFaces(d, locked) {
  locked = true;
  const source = dep_frozenOf(d) || {},
    COURT =
      source.court ||
      (d.authoringVersion >= 9
        ? { ...dep_globalCourt(), room: "RM#203,", caseNumberLabel: dep_CITATION_POLICY.mc2000CaseNumberLabel }
        : dep_globalCourt()),
    CIT_COPIES = source.courtCopies || dep_globalCourtCopies(),
    CIT_INSTRUCTIONS = source.courtInstructions || dep_globalCourtInstructions(),
    COURT_CONTACT = source.courtContact || dep_globalCourtContact();

  const k = dep_docCase(d),
    i = dep_docInsp(d);
  const cited = d.items.filter((x) => x.cite && !x.withdrawn);
  if (cited.some((x) => !(d.authoringVersion >= 8 && d.cits?.[x.id]?.mandatoryAppearance) && !(dep_cents(d.cits?.[x.id]?.amount) > 0)))
    return (
      '<p class="banner alert no-print">Citation needs deposit. <button class="btn" data-open-deposit="' +
      dep_esc(d.id) +
      '">Complete deposit</button></p>'
    );
  if (!cited.length) return "";
  if (d.draft && cited.some((it) => d.cits?.[it.id]?.mandatoryAppearance))
    return (
      '<p class="banner alert no-print">Mandatory-appearance citation preview i' +
      "s on hold until the division approves defendant instructions. Your draft" +
      " is retained.</p>"
    );
  const addr = dep_ownerLines(k).slice(1).join(", ");
  const face = (it, copy) => {
    const c = (d.cits || {})[it.id] || {};
    return (
      '<section class="cit' +
      `${d.authoringVersion >= 9 ? " cit-v9" : ""}` +
      "" +
      `${d.authoringVersion >= 9 && dep_snow.is(d) ? " cit-snow" : ""}` +
      "" +
      `${d.authoringVersion >= 7 || dep_formatDollarsOnLegacyReprints ? " cit-dollar" : ""}` +
      '"><div class="cit-form">\n\n    <div class="cit-bar">\n      <div class="ci' +
      't-idbar"><span class="cit-no">' +
      `${citField(d, it.id, "num", "Citation number", locked)}` +
      '</span>\n        <span class="cit-title">WISCONSIN UNIFORM MUNICIPAL<br>C' +
      'OURT CITATION AND COMPLAINT</span></div>\n      <div class="cit-juv">' +
      `${dep_BOXY}` +
      ' Juvenile</div>\n      <div class="cit-dep"><div class="cit-dep-l">Deposi' +
      't Permitted</div>\n        <div class="amt' +
      `${d.authoringVersion >= 9 && c.mandatoryAppearance ? " cit-mandatory" : ""}` +
      '">' +
      "".concat(dep_esc(d.authoringVersion >= 9 && c.mandatoryAppearance ? "NONE – MANDATORY APPEARANCE" : citAmount(d, it))) +
      '</div></div>\n      <div class="cit-tender"><div>' +
      `${dep_BOXY}` +
      " Cash</div><div>" +
      `${dep_BOXY}` +
      ' Card</div></div>\n      <div class="cit-cfu">(For court use only)</div>\n' +
      '    </div>\n\n    <div class="cit-cols">\n      <div class="cit-l">\n       ' +
      ' <div class="cit-h">You Are Notified To Appear</div>\n        <div class=' +
      '"cit-sm">Is this a mandatory appearance? &nbsp; ' +
      `${d.authoringVersion >= 8 && c.mandatoryAppearance ? dep_BOXN : dep_BOXY}` +
      " Yes &nbsp; " +
      `${d.authoringVersion >= 8 && c.mandatoryAppearance ? dep_BOXY : dep_BOXN}` +
      ' No</div>\n        <div class="cit-sm">(Read the reverse side of this cit' +
      'ation for court information)</div>\n        <div class="cit-dt"><b>Date:<' +
      "/b>" +
      `${citField(d, it.id, "courtDate", "00/00/0000", locked)}` +
      '</div>\n        <div class="cit-dt"><b>Time:</b>' +
      `${citField(d, it.id, "courtTime", "09:30 AM", locked)}` +
      "\n          <span>" +
      `${+(dep_parseTime(c.courtTime) || "00:00").slice(0, 2) < 12 ? dep_BOXN : dep_BOXY}` +
      " AM &nbsp; " +
      `${+(dep_parseTime(c.courtTime) || "00:00").slice(0, 2) >= 12 ? dep_BOXN : dep_BOXY}` +
      ' PM</span></div>\n        <div class="cit-court">' +
      `${dep_esc(COURT.name)}` +
      "<br>" +
      `${dep_esc(COURT.room)}` +
      "<br>" +
      `${dep_esc(COURT.addr)}` +
      "<br>" +
      `${dep_esc(COURT.city)}` +
      '</div>\n        <div class="cit-sm">Plaintiff: &nbsp; ' +
      `${dep_BOXN}` +
      " City &nbsp; " +
      `${dep_BOXY}` +
      " Village &nbsp; " +
      `${dep_BOXY}` +
      ' Town</div>\n        <div class="cit-sm">OF: MADISON</div>\n      </div>\n ' +
      '     <div class="cit-r">\n        <div class="cit-f"><div class="cit-cell' +
      's"><span class="cit-lab">Defendant Name - Last</span><span class="cit-la' +
      'b">First</span><span class="cit-lab">MI</span></div>\n          <div clas' +
      's="v">' +
      `${dep_esc(dep_ownerLines(k)[0] || "")}` +
      '</div></div>\n        <div class="cit-f"><div class="cit-cells"><span cla' +
      'ss="cit-lab">Street Address</span><span class="cit-lab">Post Office</spa' +
      'n><span class="cit-lab">State</span><span class="cit-lab">Zip Code</span' +
      '></div>\n          <div class="v">' +
      `${dep_esc(addr)}` +
      '</div></div>\n        <div class="cit-f"><div class="cit-cells"><span cla' +
      'ss="cit-lab">Driver License Number or Other I.D. (specify)</span><span c' +
      'lass="cit-lab">State</span><span class="cit-lab">Exp Yr.</span></div></d' +
      'iv>\n        <div class="cit-f"><div class="cit-cells"><span class="cit-l' +
      'ab">Date of Birth</span><span class="cit-lab">Sex</span><span class="cit' +
      '-lab">Race</span><span class="cit-lab">Height</span><span class="cit-lab' +
      '">Weight</span><span class="cit-lab">Hair</span><span class="cit-lab">Ey' +
      'es</span></div></div>\n        <div class="cit-f"><div class="cit-cells">' +
      '<span class="cit-lab">License Plate Number</span><span class="cit-lab">P' +
      'late Type</span><span class="cit-lab">State</span><span class="cit-lab">' +
      'Exp Yr.</span></div></div>\n        <div class="cit-f" style="border-bott' +
      'om:0"><div class="cit-ord">\n          <div><span class="cit-lab">Defenda' +
      'nt Violated: &nbsp; Ordinance No.</span>\n            <div class="v">' +
      `${citField(d, it.id, "ord", "Ordinance number", locked)}` +
      '</div></div>\n          <div><span class="cit-lab">Adopting State Statute' +
      ' No.</span>\n            <div class="v">' +
      `${citField(d, it.id, "statute", "", locked)}` +
      "</div></div>\n        </div></div>\n      </div>\n    </div>\n\n    <div clas" +
      's="cit-desc"><span class="cit-lab">Description of Violation</span>\n     ' +
      ' <div class="v">' +
      `${citField(d, it.id, "desc", "e.g. IMPROPER MAINTENANCE OF EXTERIOR PROPERTY AREA", locked)}` +
      '</div></div>\n\n    <div class="cit-mid">\n      <div class="cit-mid-l">\n  ' +
      '      <div class="cit-when">\n          <div><div class="cit-cells"><span' +
      ' class="cit-lab">Week Day</span><span class="cit-lab">Month - Day - Year' +
      '</span><span class="cit-lab">Time</span></div>\n            <div class="v' +
      '">' +
      `${dep_esc(dep_longDate(c.violDate || dep_inspAt(d).date))}` +
      " " +
      `${dep_esc(dep_fmtTime(c.violTime || dep_inspAt(d).time))}` +
      '</div></div>\n          <div><span class="cit-lab">At:</span> <span class' +
      '="v">' +
      `${dep_esc(k.address || "")}` +
      '</span>\n            <div class="cit-lab" style="margin-top:3px">County: ' +
      '<span class="v">Dane</span></div></div>\n        </div>\n        <div clas' +
      's="cit-served">\n          <div>Citation Served: &nbsp; ' +
      `${dep_BOXY}` +
      " Personally &nbsp;&nbsp; " +
      `${dep_BOXN}` +
      " Mailed to defendant&rsquo;s last known address</div>\n          <div>" +
      `${dep_BOXY}` +
      " Left with person residing at defendant&rsquo;s residence: &nbsp; Name _" +
      "_____________________ &nbsp; Age ____</div>\n        </div>\n      </div>\n" +
      '      <div class="cit-agent"><span class="cit-lab">Registered Agent</spa' +
      'n>\n        <div class="v agent">' +
      `${
        dep_agentLines(k, !!d.draft)
          .map((l) => `<div>${dep_esc(l)}</div>`)
          .join("") || "&nbsp;"
      }` +
      '</div></div>\n    </div>\n\n    <div class="cit-sign">\n      <div><span cla' +
      'ss="cit-lab">Print Officer Name</span><div class="v">' +
      `${dep_esc(i.name || "")}` +
      '</div></div>\n      <div><span class="cit-lab">Department</span><div clas' +
      's="v">Building Inspection</div></div>\n      <div><span class="cit-lab">I' +
      '.D. No.</span><div class="v">' +
      "".concat(
        ((d.cits || {})[it.id] || {}).deptId
          ? citField(d, it.id, "deptId", "0000", locked)
          : '<span class="ed cf" ' +
              `${locked ? "" : 'contenteditable="true"'}` +
              ' data-cit="' +
              `${dep_esc(it.id)}` +
              '|deptId" data-ph="0000">' +
              `${dep_esc(i.badge || "")}` +
              "</span>",
      ) +
      '</div></div>\n      <div><span class="cit-lab">Date Citation Issued</span' +
      '><div class="v">' +
      `${citField(d, it.id, "issued", dep_fmtDate(d.mailed || ""), locked)}` +
      '</div></div>\n      <div><span class="cit-lab">' +
      "".concat(dep_esc(d.authoringVersion >= 9 ? COURT.caseNumberLabel || dep_CITATION_POLICY.mc2000CaseNumberLabel : "Agency Case Number")) +
      '</span><div class="v">' +
      `${dep_esc(k.number || "")}` +
      "</div></div>\n    </div>\n\n    </div>\n    " +
      "".concat(
        c.assessments
          ? '<div class="cit-assessments">Base ' +
              "".concat(
                d.authoringVersion >= 8
                  ? dep_formatDeposit((c.assessments.base / 100).toFixed(2)) || "$0.00"
                  : "$" + dep_money(c.assessments.base / 100),
              ) +
              " · Penalty " +
              "".concat(
                d.authoringVersion >= 8
                  ? dep_formatDeposit((c.assessments.penalty / 100).toFixed(2)) || "$0.00"
                  : "$" + dep_money(c.assessments.penalty / 100),
              ) +
              " · Jail " +
              "".concat(
                d.authoringVersion >= 8
                  ? dep_formatDeposit((c.assessments.jail / 100).toFixed(2)) || "$0.00"
                  : "$" + dep_money(c.assessments.jail / 100),
              ) +
              " · Crime lab " +
              "".concat(
                d.authoringVersion >= 8
                  ? dep_formatDeposit((c.assessments.crimeLab / 100).toFixed(2)) || "$0.00"
                  : "$" + dep_money(c.assessments.crimeLab / 100),
              ) +
              " · Court " +
              "".concat(
                d.authoringVersion >= 8
                  ? dep_formatDeposit((c.assessments.court / 100).toFixed(2)) || "$0.00"
                  : "$" + dep_money(c.assessments.court / 100),
              ) +
              "</div>"
          : "",
      ) +
      '\n    <div class="cit-foot"><span>MC-2000, 02/06' +
      "".concat(d.revision ? ` · Corrected rev. ${dep_esc(d.revision.number)} · ${dep_esc(d.id)}` : d.draft ? " · DRAFT" : "") +
      "</span><span>" +
      `${dep_esc(copy.label)}` +
      "</span></div>\n    " +
      "".concat(
        copy.comment || (d.authoringVersion === 9 && dep_snow.is(d))
          ? '<div class="cit-cmt"><div class="cit-lab">VIOLATION COMMENT:</div>\n     ' +
              ' <span class="ed" ' +
              `${locked ? "" : 'contenteditable="true"'}` +
              ' data-cit="' +
              `${dep_esc(it.id)}` +
              '|comment" data-ph="Inspection history: initial inspection, notice issued' +
              ', reinspection findings">' +
              `${dep_esc(c.comment || "")}` +
              "</span></div>"
          : "",
      ) +
      "\n    " +
      "".concat(
        copy.record
          ? '<div class="cit-rec">\n      <div class="cit-rec-h">' +
              `${dep_esc(copy.record)}` +
              '</div>\n      <div class="cit-rec-g">\n        <div>\n          <div class=' +
              '"cit-rec-f">Date of Disposition</div>\n          <div class="cit-rec-f">P' +
              'LEA:</div>\n          <div class="cit-rec-o">' +
              `${dep_BOXY}` +
              " Guilty &nbsp; " +
              `${dep_BOXY}` +
              " No Contest &nbsp; " +
              `${dep_BOXY}` +
              ' Not Guilty</div>\n          <div class="cit-rec-f">Other Disposition:</d' +
              'iv>\n          <div class="cit-rec-f last">Court Officer:</div>\n        <' +
              '/div>\n        <div>\n          <div class="cit-rec-f">FINDING:</div>\n    ' +
              '      <div class="cit-rec-o">' +
              `${dep_BOXY}` +
              " Guilty &nbsp;&nbsp; " +
              `${dep_BOXY}` +
              ' Dismissed</div>\n          <div class="cit-rec-o">' +
              `${dep_BOXY}` +
              " Default &nbsp; " +
              `${dep_BOXY}` +
              ' Forfeiture</div>\n          <div class="cit-rec-o">' +
              `${dep_BOXY}` +
              ' Not Guilty &nbsp; $ ____________</div>\n          <div class="cit-rec-f ' +
              'last">Comments:</div>\n        </div>\n      </div></div>'
          : "",
      ) +
      "\n    " +
      "".concat(
        copy.instructions
          ? '<div class="cit-inst">\n      <div class="cit-inst-h">INSTRUCTIONS &ndash' +
              "; READ CAREFULLY</div>\n      " +
              `${CIT_INSTRUCTIONS}` +
              '\n      <div class="cit-inst-c">\n        <div>' +
              `${dep_esc(COURT_CONTACT.name)}` +
              "<br>" +
              `${dep_esc(COURT_CONTACT.addr)}` +
              "<br>" +
              `${dep_esc(COURT_CONTACT.city)}` +
              "</div>\n        <div>" +
              `${dep_esc(COURT_CONTACT.phone)}` +
              "<br>" +
              `${dep_esc(COURT_CONTACT.fax)}` +
              "<br>" +
              `${dep_esc(COURT_CONTACT.email)}` +
              "</div>\n      </div></div>"
          : "",
      ) +
      "\n    </section>"
    );
  };
  return cited.map((it) => CIT_COPIES.map((cp) => face(it, cp)).join("")).join("");
}

/* R42 presentation only: storage/publication and fixed print construction stay in their owners. */
function editorReadiness(d) {
  const list = d.draft ? dep_checks(d) : [],
    required = list.filter((c) => !c.ok && !c.soft),
    advice = list.filter((c) => !c.ok && c.soft);
  return { list, required, advice, held: !!d.draft && d.items.some((i) => i.cite && !i.withdrawn && d.cits?.[i.id]?.mandatoryAppearance) };
}

function checkChip(d, readiness = editorReadiness(d)) {
  const { required, advice } = readiness;
  return (
    '<span class="cchip ' +
    `${required.length ? "bad" : "good"}` +
    '" id="chk-chip">' +
    "".concat(
      required.length
        ? required.length + " required check" + (required.length === 1 ? "" : "s") + " remaining"
        : advice.length
          ? "Ready for review · " + advice.length + " advisory check" + (advice.length === 1 ? "" : "s")
          : "Ready for review",
    ) +
    "</span>"
  );
}

function editorChecksHTML(d, readiness = editorReadiness(d)) {
  const { list, required, advice } = readiness;
  return (
    "" +
    "".concat(
      !required.length && !advice.length
        ? '<p class="hint">Required checks are complete. Review the document and recipients before issuing.</p>'
        : "",
    ) +
    "" +
    "".concat(list.map((c, ix) => (!c.ok ? checkRowHTML(c, ix).replace('id="check-msg-doc-', 'id="editor-check-msg-doc-') : "")).join("")) +
    '<details class="passed-checks"><summary>' +
    `${list.filter((c) => c.ok).length}` +
    " checks passed</summary>" +
    `${list.map((c, ix) => (c.ok ? checkRowHTML(c, ix) : "")).join("")}` +
    "</details>"
  );
}

function editorPrimary(d, ready = editorReadiness(d)) {
  const locked = dep_isLocked(d);
  if (dep_recordIntegrity.status(dep_kase(d.caseId)).valid === false)
    return { label: "Review record problem", attrs: `data-sync-safety="${dep_esc(d.caseId)}"` };
  const pending = Object.values(WriterState.RECORD_ATTEMPTS).find((x) => x.cid === d.caseId && x.pendingAmendment?.payload?.docId === d.id);
  if (pending) return { label: "Confirm saved action", attrs: `data-resumerecord="${dep_esc(pending.recordKey)}"` };
  if (d.pendingAmendment)
    return { label: "Confirm save", attrs: 'data-editor-command="' + (d.correction ? "btn-retrycorrection" : "btn-retrypublish") + '"' };
  if (WriterState.state.publicationBusy && dep_doc(WriterState.state.publicationBusy)?.caseId === d.caseId)
    return { label: "Finishing document save…", attrs: "disabled" };
  if (d.draft && locked) return { label: "Review saved work", attrs: `data-sync-safety="${dep_esc(d.caseId)}"` };
  if (!locked)
    return { label: ready.held ? "Review held draft" : ready.required.length ? "Continue review" : "Review &amp; issue", attrs: 'id="btn-final"' };
  if (!d.void && !d.superseded && !d.filedAt && !dep_deliveredByCitation(d))
    return { label: "Finish PDF filing", attrs: 'data-editor-command="btn-retryfiling"' };
  return { label: "Print issued PDF", attrs: 'id="btn-print"' };
}

function editorEnhance() {
  const d = dep_doc(WriterState.state.docId);
  if (!d || WriterState.state.screen !== "write") return;
  const count = ((dep_frozenOf(d) || {}).courtCopies || dep_globalCourtCopies()).length || 1;
  for (const parent of document.querySelectorAll(".document-workspace .desk,.document-workspace .initial-citation-previews")) {
    parent.querySelectorAll(".cit").forEach((face, index) => face.toggleAttribute("data-editor-extra-copy", index % count !== 0));
  }
}

function editorSync() {
  const d = dep_doc(WriterState.state.docId);
  if (!d || !document.querySelector(".document-workspace")) return;
  const readiness = editorReadiness(d);
  const chip = document.getElementById("chk-chip");
  if (chip) chip.outerHTML = checkChip(d, readiness);
  for (const label of document.querySelectorAll("[data-editor-readiness]"))
    label.outerHTML = checkChip(d, readiness).replace('id="chk-chip"', "data-editor-readiness");
  const panel = document.getElementById("checkbox-panel");
  if (panel) {
    const open = panel.querySelector(".passed-checks")?.open;
    panel.innerHTML = editorChecksHTML(d, readiness);
    if (open) panel.querySelector(".passed-checks").open = true;
  }
  const button = document.getElementById("btn-final");
  if (button) button.innerHTML = editorPrimary(d, readiness).label;
  const review = document.querySelector('[data-editor-section="editor-review"]'),
    required = readiness.required.length;
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

function editorNavigate(id) {
  dep_captureWork();
  const section = document.getElementById(id);
  if (!section) return;
  const target = section.querySelector("h2");
  target?.focus({ preventScroll: true });
  section.scrollIntoView?.({ block: "start" });
}

function editorPreview() {
  const d = dep_doc(WriterState.state.docId);
  if (!d) return;
  const invoker = document.activeElement;
  dep_captureWork();
  try {
    const job = dep_printJob(dep_initialCitations.enabled(d) ? dep_initialCitations.preview(d) : d);
    if (!job) return;
    invoker?.focus({ preventScroll: true });
    dep_A11Y.utility(
      "Print preview",
      "<p>" +
        "".concat(
          d.draft
            ? "Draft layout only. This document has not been issued."
            : "Layout from retained document data. Use Print issued PDF for the verified archived original.",
        ) +
        ' All court copies are included when applicable.</p><iframe class="editor' +
        '-preview-frame" title="Read-only document layout preview" sandbox="allow' +
        '-same-origin" srcdoc="' +
        `${dep_esc(job.html)}` +
        '"></iframe>',
    );
    const dialog = document.getElementById("utility-dialog"),
      frame = dialog?.querySelector(".editor-preview-frame");
    // Scripts remain sandboxed. Forward Escape from the child document to the native dialog.
    frame?.addEventListener("load", () =>
      frame.contentDocument?.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          dialog.close();
        }
      }),
    );
    dialog?.querySelector("[data-utility-close]")?.focus();
  } catch (error) {
    invoker?.focus({ preventScroll: true });
    dep_toast(error.message || "This draft is not ready for a print preview. Complete its citation checks first.");
  }
}

function screenWrite() {
  const d = dep_doc(WriterState.state.docId);
  if (!d) {
    WriterState.state.screen = "cases";
    return dep_screenCases();
  }
  dep_snow.prepare(d);
  const k = dep_docCase(d),
    locked = dep_isLocked(d),
    ready = editorReadiness(d),
    primary = editorPrimary(d, ready);
  const more =
    locked && !d.pendingAmendment
      ? "" +
        "".concat(
          !d.draft && !dep_correctionEligibility(d)
            ? '<button class="btn" id="btn-correct">' +
                `${d.void ? "Restore with correction" : "Correct document"}` +
                "</button>" +
                `${d.void ? "" : '<button class="btn" id="btn-void">Withdraw…</button>'}` +
                ""
            : "",
        ) +
        '<button class="btn" id="btn-savecase">Save case file</button>' +
        `${dep_isEffective(d) ? '<button class="btn" id="btn-email">Email…</button>' : ""}` +
        ""
      : "";
  const actions =
    "" +
    `${d.draft ? '<button class="btn" id="btn-save">Save &amp; continue later</button>' : ""}` +
    '<button class="btn btn-primary editor-primary" ' +
    `${primary.attrs}` +
    ">" +
    `${primary.label}` +
    "</button>" +
    "".concat(more ? '<details class="editor-more"><summary>Document actions</summary><div>' + more + "</div></details>" : "") +
    "";
  const tyLabel = (dep_DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type;
  const fr = d.fromReinspId ? dep_reinsp(d.fromReinspId) : null;
  const editable = !locked;
  const meta =
    '<div class="editor-context no-print"><div><strong>' +
    `${dep_esc(tyLabel)}` +
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
              : "Issued " + dep_fmtDate(d.mailed || d.created),
    ) +
    "" +
    `${d.revision ? " · revision " + dep_esc(d.revision.number) : ""}` +
    '</span></div><button class="btn btn-sm" data-nav="cases">Back to Workspa' +
    "ce</button></div>";
  const inspection =
    '<div class="editor-taskbar no-print">' +
    `${editable ? '<button class="btn" id="btn-cc">Copies &amp; email…</button>' : ""}` +
    "" +
    "".concat(fr && fr.draft && !d.correction && !d.pendingAmendment ? '<button class="btn" id="btn-editvisit">Review inspection</button>' : "") +
    '<p class="hint">' +
    "".concat(
      locked
        ? "Issued details are retained with the document."
        : "Edit inspection, property and mailing details on the working document be" + "low. Required checks link to the exact field.",
    ) +
    "</p></div>" +
    "".concat(
      dep_newDocuments.initialPanel(d)
        ? '<details class="editor-initial-options no-print"><summary>Other initial inspection actions</summary>' +
            dep_newDocuments.initialPanel(d) +
            "</details>"
        : "",
    ) +
    "" +
    `${dep_newDocuments.details(d)}` +
    "" +
    `${caseCheckFields(d)}` +
    "" +
    `${dep_snow.factsForm(d)}` +
    "" +
    `${dep_correctionPanel(d)}` +
    "";
  const work =
    '<div class="editor-taskbar no-print">' +
    `${dep_structEditable(d) ? '<button class="btn" id="btn-add-top">+ Select violations</button>' : ""}` +
    '<p class="hint">' +
    "".concat(
      editable ? "Edit the working document directly. Fill-in bubbles mark details that still need an entry." : "Read-only retained document.",
    ) +
    " " +
    `${d.items.filter((x) => !x.done && !x.withdrawn).length}` +
    " outstanding" +
    `${d.items.some((x) => x.done) ? ", " + d.items.filter((x) => x.done).length + " corrected" : ""}` +
    ".</p></div>" +
    `${dep_citationReview(d)}` +
    "" +
    "".concat(
      dep_initialCitations.enabled(d) && d.authoringVersion >= 11
        ? '<div class="banner info no-print" id="initial-citation-replaces"><div><s' +
            "trong>This inspection will be issued as a citation.</strong> The owner r" +
            "eceives only the citation letter and its court copies. The letter carrie" +
            "s the items, due dates, appeal and rent-abatement language shown on this" +
            " working paper, which is not mailed as a separate Official Notice.</div>" +
            "</div>"
        : "",
    ) +
    '<div class="editor-preview-tools no-print"><span>Working document' +
    "".concat(d.type === "citation" || dep_initialCitations.enabled(d) ? " · one representative court copy per charge" : "") +
    '</span><button class="btn" data-editor-preview ' +
    "".concat(ready.held ? 'disabled title="Division-approved mandatory appearance instructions are required"' : "") +
    ">Print preview" +
    `${d.type === "citation" || dep_initialCitations.enabled(d) ? " · all copies" : ""}` +
    '</button></div><div class="desk">' +
    `${documentHTML(d)}` +
    "</div>" +
    "".concat(
      dep_initialCitations.enabled(d)
        ? '<div class="initial-citation-previews no-print" aria-label="Initial citation previews">' +
            citationFaces(dep_initialCitations.preview(d), true) +
            "</div>"
        : "",
    ) +
    "" +
    `${dep_specialType(d.type) ? "" : dep_duePanel(d, false)}` +
    "";
  const review =
    '<div class="docpanel no-print"><div class="chipstrip">' +
    `${!locked ? checkChip(d, ready) : '<span class="cchip">This document is read-only</span>'}` +
    '<button class="btn btn-sm" id="btn-checks" aria-controls="checkbox-panel' +
    '" aria-expanded="true">Hide checks</button></div><div id="checkbox-panel' +
    '">' +
    "".concat(
      !locked
        ? editorChecksHTML(d, ready)
        : "<p>Issued text and history are retained. Use Document actions for a corr" + "ection, or Print issued PDF for the archived original.</p>",
    ) +
    "</div></div>" +
    `${dep_recordHistoryHTML(d)}` +
    "" +
    `${dep_newDocuments.actionPanel(d)}` +
    "";
  return dep_shell(
    dep_esc(k.address),
    `${dep_esc(k.number)} · ${dep_esc(tyLabel)}`,
    actions,
    '<div class="document-workspace" data-editor-doc="' +
      `${dep_esc(d.id)}` +
      '">' +
      `${meta}` +
      "" +
      `${documentSaveHTML(app_savedworkContext(), d)}` +
      "" +
      `${dep_publicationPanel(d)}` +
      "" +
      `${dep_filingPanel(d)}` +
      "" +
      `${dep_citationRecoveryPanel(d)}` +
      "" +
      "".concat(
        d.superseded
          ? '<div class="banner warn no-print"><div><strong>This is a replaced versio' +
              'n.</strong> <button class="lnk" data-open="' +
              `${dep_esc(d.superseded.replacedBy)}` +
              '">Open the corrected document</button></div></div>'
          : "",
      ) +
      '<nav class="editor-sections no-print" aria-label="Document tasks"><butto' +
      'n data-editor-section="editor-inspection">Inspection &amp; recipients</b' +
      'utton><button data-editor-section="editor-items">Items &amp; due dates</' +
      'button><button data-editor-section="editor-review">Review' +
      `${!locked && ready.required.length ? " · " + ready.required.length : ""}` +
      "</button></nav>" +
      "".concat(
        !locked
          ? '<div class="editor-readiness no-print">' +
              checkChip(d, ready).replace('id="chk-chip"', "data-editor-readiness") +
              "<span>Required checks link to the field that needs attention.</span></div>"
          : "",
      ) +
      "" +
      `${editorSection("editor-inspection", "Inspection and recipients", inspection)}` +
      "" +
      `${editorSection("editor-items", "Items and due dates", work)}` +
      "" +
      `${editorSection("editor-review", "Review", review)}` +
      "</div>",
  );
}

function pickerHTML() {
  return languagePicker(app_languagediscoveryContext());
}

function modalHTML() {
  if (WriterState.state.modal === "shared-change") return dep_sharedChangeModal();
  if (WriterState.state.modal === "recovery") return dep_recoveryModal();
  if (["void", "recordnote", "reconcile"].includes(WriterState.state.modal)) return dep_recordActionModal();
  if (WriterState.state.modal === "sendto") {
    const d = dep_doc(WriterState.state.sendDoc) || dep_doc(WriterState.state.docId);
    if (!d) return "";
    const k = dep_kase(d.caseId),
      list = dep_emailList(k).filter((e) => String(e.addr || "").trim());
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
        <span><strong>${dep_esc(e.kind || "Other")}</strong> ${dep_esc(e.addr)}</span></label>`,
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
    const d = dep_doc(WriterState.state.docId);
    if (!d) return "";
    const k = dep_docCase(d),
      cc = dep_ccList(k),
      em = dep_emailList(k),
      needAgent = d.type === "citation" && dep_isLLC(k),
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
          : "Anything entered here appears on future documents for " + dep_esc(k.number) + ". Issued copies stay unchanged.",
      ) +
      "</div></div>\n      " +
      "".concat(
        problem
          ? '<div class="banner alert" id="cc-address-error" role="alert"><div><stron' +
              "g>Check this address:</strong> " +
              `${dep_esc(problem.message)}` +
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
                  `${dep_esc(c.name || "")}` +
                  '" placeholder="Name" aria-label="Copy ' +
                  `${ix + 1}` +
                  ' name"' +
                  `${invalid("copy", ix, "name")}` +
                  '>\n          <input type="text" data-cc="' +
                  `${ix}` +
                  '|addr" value="' +
                  `${dep_esc(c.addr || "")}` +
                  '" placeholder="Street number and name (123 Main St, Apt 4)" aria-label="' +
                  "Copy " +
                  `${ix + 1}` +
                  ' street number and name"' +
                  `${invalid("copy", ix, "addr")}` +
                  '>\n          <input type="text" data-cc="' +
                  `${ix}` +
                  '|city" value="' +
                  `${dep_esc(c.city || "")}` +
                  '" placeholder="City, ST ZIP (Madison, WI 53703)" aria-label="Copy ' +
                  `${ix + 1}` +
                  ' city, state and ZIP"' +
                  `${invalid("copy", ix, "city")}` +
                  '>\n          <p class="rec-preview" data-recipient-preview="copy|' +
                  `${ix}` +
                  '">' +
                  `${dep_esc(dep_recipientPreview(c))}` +
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
                  `${dep_EMAIL_KINDS.map((x) => `<option ${e.kind === x ? "selected" : ""}>${dep_esc(x)}</option>`).join("")}` +
                  '</select>\n          <input type="email" data-em="' +
                  `${ix}` +
                  '|addr" value="' +
                  `${dep_esc(e.addr || "")}` +
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
          ? dep_esc(k.owner) + " reads as a company, so a citation cannot be served without an agent."
          : "Only needed when the owner is a company. Printed on the citation."
      }` +
      '</p>\n      <div class="rec"><div class="rec-n">&nbsp;</div><div class="r' +
      'ec-f">\n        <input type="text" data-agent="name" value="' +
      `${dep_esc((k.agent || {}).name || "")}` +
      '" placeholder="Agent name" aria-label="Registered agent name"' +
      `${invalid("agent", 0, "name")}` +
      '>\n        <input type="text" data-agent="addr" value="' +
      `${dep_esc((k.agent || {}).addr || "")}` +
      '" placeholder="Street number and name (123 Main St, Apt 4)" aria-label="' +
      'Registered agent street number and name"' +
      `${invalid("agent", 0, "addr")}` +
      '>\n        <input type="text" data-agent="city" value="' +
      `${dep_esc((k.agent || {}).city || "")}` +
      '" placeholder="City, ST ZIP (Madison, WI 53703)" aria-label="Registered ' +
      'agent city, state and ZIP"' +
      `${invalid("agent", 0, "city")}` +
      '>\n        <p class="rec-preview" data-recipient-preview="agent|0">' +
      `${dep_esc(dep_recipientPreview(k.agent || {}))}` +
      '</p><button class="btn btn-sm" data-parse-address="agent|0">Preview stan' +
      'dardized agent address</button>\n      </div><div style="width:34px"></di' +
      'v></div>\n      </div><div class="modal-f"><button class="btn" id="btn-sa' +
      'vework">Save &amp; continue later</button><button class="btn btn-primary' +
      '" data-close="modal">Done</button></div></div></div>'
    );
  }
  if (WriterState.state.modal === "clear") {
    const risky = WriterState.CASES.filter((k) => dep_caseUnsaved(k)),
      safe = WriterState.CASES.filter((k) => !dep_caseUnsaved(k));
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
      '">\n      <div class="modal-h"><h2>Clear cases off the list</h2></div><di' +
      'v class="modal-b">\n      <div class="banner info"><div>The list is your ' +
      "working desk, not the record. Clearing a case does not touch its file on" +
      " the share &mdash; <strong>Open case file</strong> brings it straight ba" +
      "ck.</div></div>\n      " +
      "".concat(
        safe.length
          ? '<p class="hint"><strong>' +
              `${safe.length}` +
              " case" +
              `${safe.length === 1 ? "" : "s"}` +
              " safe to clear</strong> &mdash; all current case details and issued hist" +
              "ory are saved to the share; no unfinished work remains.</p>\n        <ul " +
              'class="clearlist">' +
              "".concat(
                safe
                  .slice(0, 12)
                  .map((k) => `<li>${dep_esc(k.number)} &middot; ${dep_esc(k.address)}</li>`)
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
              " work that has not reached the share.</strong> Clearing " +
              `${risky.length === 1 ? "it" : "them"}` +
              ' would lose that work.</div></div>\n        <ul class="clearlist">' +
              "".concat(
                risky
                  .map(
                    (k) =>
                      "<li>" +
                      `${dep_esc(k.number)}` +
                      " &middot; " +
                      `${dep_esc(k.address)}` +
                      ' <span class="muted">&mdash; ' +
                      `${dep_esc(dep_caseUnsaved(k))}` +
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
          ? '<button class="btn btn-primary" data-clearcases="safe">Clear the ' +
              `${safe.length}` +
              " safe case" +
              `${safe.length === 1 ? "" : "s"}` +
              "</button>"
          : "",
      ) +
      "\n        " +
      "".concat(risky.length ? `<button class="btn" data-clearcases="all">Clear all ${WriterState.CASES.length}, losing that work</button>` : "") +
      "\n      </div></div></div>"
    );
  }
  if (WriterState.state.modal === "storage") {
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
      '">\n      <div class="modal-h"><h2>Where documents are going</h2></div><d' +
      'iv class="modal-b">\n      ' +
      `${dep_storageReport()}` +
      "\n      " +
      "".concat(
        WriterState.CASEDIR && WriterState.DIRNAME !== dep_CASEDIR_EXPECT
          ? '<div class="banner warn" style="margin-top:14px"><div><strong>Case files' +
              " are going to a folder called &ldquo;" +
              `${dep_esc(WriterState.DIRNAME)}` +
              "&rdquo;, not &ldquo;" +
              `${dep_esc(dep_CASEDIR_EXPECT)}` +
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
      `${dep_reindexReport()}` +
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
      `${dep_esc(WriterState.state.folderQ || "")}` +
      '" placeholder="Address or case number…"></label>' +
      "".concat(WriterState.state.folderError ? `<div class="banner warn">${dep_esc(WriterState.state.folderError)}</div>` : "") +
      "\n      " +
      "".concat(
        fs.length
          ? '<div class="folderlist">' +
              "".concat(
                fs
                  .map(
                    (f) =>
                      '<button data-openfolder="' +
                      `${dep_esc(f.name)}` +
                      '">' +
                      `${dep_esc(f.name.replace(/\.json$/i, ""))}` +
                      "\n        <span>" +
                      `${(f.size / 1024).toFixed(0)}` +
                      " KB &middot; " +
                      `${f.mod ? dep_fmtDate(dep_iso(new Date(f.mod))) : ""}` +
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
  const d = dep_doc(WriterState.state.docId),
    ch = dep_checks(d),
    bad = dep_blockers(d);
  const notes = ch.filter((c) => !c.ok && c.soft);
  const ty = (dep_DOC_TYPES.find((t) => t.id === d.type) || {}).label || "document";
  return (
    '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
    '">\n    <div class="modal-h"><h2>' +
    `${d.correction ? "Review correction" : "Finalize this " + dep_esc(ty.toLowerCase())}` +
    '</h2></div><div class="modal-b">\n      ' +
    "".concat(
      d.correction
        ? "<p><strong>Reason:</strong> " +
            `${dep_esc(d.correction.reason)}` +
            "</p>" +
            `${dep_correctionDiffHTML(d)}` +
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
    `${ch.map((c, ix) => (!c.ok ? checkRowHTML(c, ix) : "")).join("")}` +
    '\n      <details class="passed-checks"><summary>' +
    `${ch.filter((c) => c.ok).length}` +
    " checks passed</summary>" +
    "".concat(
      ch
        .filter((c) => c.ok)
        .map((c) => `<div class="check pass"><span class="m">✓</span><span>${dep_esc(c.t)}</span></div>`)
        .join(""),
    ) +
    '</details>\n      <label class="f" style="margin-top:16px"><span>Mailed d' +
    'ate</span><input type="date" id="fin-mailed" value="' +
    `${dep_esc(d.mailed || dep_recordDay(today))}` +
    '" max="' +
    `${dep_mailingMaxDay(dep_initialCitations.enabled(d) ? "citation" : d.type)}` +
    '" ' +
    `${d.correction ? "disabled" : ""}` +
    "></label>\n      " +
    "".concat(
      (function () {
        if (!WriterState.HELPER || !WriterState.HELPER.chrome) return "";
        const list = dep_emailList(d.correction ? dep_docCase(d) : dep_kase(d.caseId)).filter((e) => String(e.addr || "").trim());
        if (!list.length)
          return (
            '<p class="hint" style="margin-top:14px">No email recipients on this case' +
            ". Add them under <strong>Copies &amp; email</strong> if you want this se" +
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
                  `${dep_esc(e.kind || "Other")}` +
                  "</strong> " +
                  `${dep_esc(e.addr)}` +
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
    `${dep_esc((dep_kase(d.caseId).address || "PROPERTY") + " - " + (dep_kase(d.caseId).number || "CASE"))}` +
    '.json</span>.</p></div>\n    <div class="modal-f"><button class="btn" dat' +
    'a-close="modal">' +
    `${bad.length ? "Back to the document" : "Cancel"}` +
    '</button><button class="btn" id="btn-savework">Save &amp; continue later' +
    '</button>\n      <button class="btn btn-primary" id="fin-go" ' +
    `${bad.length ? 'disabled title="Clear the outstanding checks first"' : ""}` +
    ">" +
    "".concat(d.correction ? "Save &amp; issue correction" : dep_initialCitations.enabled(d) ? "Issue citation" : "Issue document") +
    "</button></div></div></div>"
  );
}

function overlayHTML() {
  return WriterState.state.modal ? modalHTML() : WriterState.state.picker ? pickerHTML() : "";
}

function render() {
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
  const editingDoc = sameDocument ? dep_doc(WriterState.state.docId) : null;
  const editingItem = active?.dataset?.field === "text" && editingDoc?.items.find((item) => item.id === active.dataset.id);
  // Reuse a live text field across passive refreshes so input still reaches its handler.
  // New model text, locks, dialogs and navigation always use the newly rendered field.
  const keepEditing =
    editingItem &&
    !WriterState.state.modal &&
    !WriterState.state.picker &&
    active.isContentEditable &&
    previous.contains(active) &&
    !dep_isLocked(editingDoc) &&
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
  const initialOptions = previous?.querySelector(".editor-initial-options");
  const keepInitialOptions = WriterState.state.screen === "write" && previous?.dataset.editorDoc === WriterState.state.docId && initialOptions?.open;
  const initialFocus =
    keepInitialOptions && initialOptions.contains(active)
      ? active.tagName === "SUMMARY"
        ? "summary"
        : active.matches("[data-initial-action]")
          ? "[data-initial-action]"
          : ""
      : "";
  const worksheet = document.querySelector("[data-worksheet-context]"),
    inspectionChecks = document.querySelector(".ri-checks");
  const keepInspectionChecks =
    WriterState.state.screen === "reinspect" &&
    worksheet?.dataset.worksheetContext === dep_walkIdentity(dep_reinsp(WriterState.state.reinspId)) &&
    inspectionChecks?.open;
  const inspectionCheckFocus =
    keepInspectionChecks && inspectionChecks.contains(active)
      ? active.tagName === "SUMMARY"
        ? "summary"
        : active.matches(".check-link")
          ? '.check-link[data-check-index="' + active.dataset.checkIndex + '"][data-check-target="' + active.dataset.checkTarget + '"]'
          : ""
      : "";
  dep_A11Y.rememberFocus();
  dep_ensureWalkContext();
  document.getElementById("app").innerHTML =
    WriterState.state.screen === "cases"
      ? dep_screenCases()
      : WriterState.state.screen === "import"
        ? dep_screenImport()
        : WriterState.state.screen === "library"
          ? dep_screenLibrary()
          : WriterState.state.screen === "tools"
            ? dep_navigation.screen()
            : WriterState.state.screen === "write"
              ? screenWrite()
              : WriterState.state.screen === "caseactions"
                ? dep_newDocuments.caseActionScreen()
                : WriterState.state.screen === "actions"
                  ? dep_newDocuments.actionScreen()
                  : WriterState.state.screen === "reinspect"
                    ? screenReinspect()
                    : dep_screenCases();
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
    dep_paginate();
    editorEnhance();
  }
  dep_restoreWorkControls();
  dep_updateSaveStatus();
  dep_enhanceDialog();
  highlightOpenChecks();
  dep_A11Y.enhance();
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
    const current = document.querySelector('[data-charge="' + dep_checkAttr(charge) + '"] [data-review-details="' + dep_checkAttr(key) + '"]');
    if (current) current.open = true;
  }
  // Background helper refreshes must keep the current document's action visible.
  if (keepInitialOptions) {
    const current = document.querySelector(".editor-initial-options");
    if (current) {
      current.open = true;
      if (initialFocus && !WriterState.state.modal && !WriterState.state.picker) current.querySelector(initialFocus)?.focus({ preventScroll: true });
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
  if (WriterState.DIRTY) dep_scheduleDraftSave();
  render();
  window.scrollTo(0, y);
}

function renumber(d) {
  d.items.forEach((it, ix) => {
    it.no = String(ix + 1);
  });
}

function moveItem(id, direction, grip = false) {
  const d = dep_doc(WriterState.state.docId);
  if (!d || !dep_structEditable(d)) return false;
  const ix = d.items.findIndex((it) => it.id === id),
    to = ix + (direction === "up" ? -1 : 1);
  if (ix < 0 || to < 0 || to >= d.items.length) return false;
  [d.items[ix], d.items[to]] = [d.items[to], d.items[ix]];
  renumber(d);
  WriterState.DIRTY = true;
  dep_refreshSheet();
  const target = document.querySelector(
    grip ? '[data-grip="' + dep_checkAttr(id) + '"]' : '[data-move="' + dep_checkAttr(id) + '"][data-direction="' + direction + '"]',
  );
  (target || document.querySelector('[data-grip="' + dep_checkAttr(id) + '"]'))?.focus();
  dep_toast("Item " + (to + 1) + " moved " + direction);
  return true;
}

function newDoc(caseId, type) {
  if (dep_snow.isCase(dep_kase(caseId)) && type !== "notice" && type !== "citation") {
    dep_toast("Snow cases offer only the snow citation.");
    return;
  }
  if (dep_snow.isCase(dep_kase(caseId))) type = "citation";
  if (dep_recordIntegrity.blocked(caseId)) {
    dep_toast("This record was changed outside the program. Read-only.");
    return;
  }
  const nd = {
    id: dep_uid("d"),
    caseId: caseId,
    type: type,
    created: dep_recordDay(today),
    status: "Draft",
    draft: true,
    mailed: dep_recordDay(today),
    authoringVersion: 12,
    items: [],
    cc: "",
    cits: {},
    expectedHead: dep_recordHead(caseId),
  };
  WriterState.DOCS.unshift(nd);
  if (dep_snow.isCase(dep_kase(caseId))) dep_snow.addDefault(nd);
  WriterState.state.docId = nd.id;
  WriterState.state.screen = "write";
  WriterState.DIRTY = true;
  dep_saveDrafts();
  render();
  dep_toast(((dep_DOC_TYPES.find((t) => t.id === type) || {}).label || type) + " started");
}

export {
  openImportWorkspace,
  lookupCard,
  cancelCaseLookup,
  sqlReport,
  checkLookupShared,
  lookupPlanSignature,
  lookupCanOpen,
  findDatabaseCase,
  confirmDatabaseCase,
  accelaPlan,
  acceptAccela,
  caseCheckFields,
  attachCheckTargets,
  checkRowHTML,
  worksheetChecks,
  worksheetCheckPanel,
  highlightOpenChecks,
  focusCheckTarget,
  dueCheck,
  screenReinspect,
  noticeHTML,
  documentHTML,
  citField,
  citAmount,
  citationFaces,
  checkChip,
  editorChecksHTML,
  editorPrimary,
  editorEnhance,
  editorSync,
  editorNavigate,
  editorPreview,
  screenWrite,
  pickerHTML,
  modalHTML,
  overlayHTML,
  render,
  renderKeep,
  renumber,
  moveItem,
  newDoc,
};
