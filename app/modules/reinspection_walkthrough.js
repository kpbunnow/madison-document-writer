import { recordDay as dep_recordDay } from "../assets/shared.js";
import {
  fmtDate as dep_fmtDate,
  fmtTime as dep_fmtTime,
  inspAt as dep_inspAt,
  parseDate as dep_parseDate,
  parseTime as dep_parseTime,
  toast as dep_toast,
  validISO as dep_validISO,
} from "./court_and_deposits.js";
import {
  caseFileName as dep_caseFileName,
  caseNumberAllowed as dep_caseNumberAllowed,
  loadCaseFile as dep_loadCaseFile,
  shell as dep_shell,
  sourceDocFor as dep_sourceDocFor,
  stableJSON as dep_stableJSON,
} from "./workspace_shell.js";
import {
  listCaseFolder as dep_listCaseFolder,
  saveDrafts as dep_saveDrafts,
  scheduleDraftSave as dep_scheduleDraftSave,
  startReinspection as dep_startReinspection,
} from "./case_files.js";
import { importResumePanel as dep_importResumePanel, workingNotesPanel as dep_workingNotesPanel } from "./issuance_and_corrections.js";
import { recoveryStatusHTML as dep_recoveryStatusHTML, unissuedVisitFor as dep_unissuedVisitFor } from "./draft_recovery.js";
import { caseSearchText as dep_caseSearchText } from "./language_catalog.js";
import {
  independentArtifact as dep_independentArtifact,
  inspectionIdentity as dep_inspectionIdentity,
  inspectionUsed as dep_inspectionUsed,
  sameInspection as dep_sameInspection,
  pdfTransferState as dep_pdfTransferState,
  remindersPanel as dep_remindersPanel,
  workspaceTasks as dep_workspaceTasks,
} from "./case_timeline.js";
import {
  accelaPlan as dep_accelaPlan,
  cancelCaseLookup as dep_cancelCaseLookup,
  checkLookupShared as dep_checkLookupShared,
  dueCheck as dep_dueCheck,
  lookupCard as dep_lookupCard,
  newDoc as dep_newDoc,
  render as dep_render,
  renderKeep as dep_renderKeep,
} from "./inspection_import.js";
import {
  ACC_CASEFIELDS as dep_ACC_CASEFIELDS,
  ACC_COLS as dep_ACC_COLS,
  ACC_EXPANDED_MAX as dep_ACC_EXPANDED_MAX,
  ACC_LABEL as dep_ACC_LABEL,
  ACC_MAX as dep_ACC_MAX,
  ACC_REQUIRED as dep_ACC_REQUIRED,
  ACC_STATUS as dep_ACC_STATUS,
  DOC_TYPES as dep_DOC_TYPES,
  OUTCOMES as dep_OUTCOMES,
  STATUS_OF as dep_STATUS_OF,
  accAll as dep_accAll,
  accColIx as dep_accColIx,
  accInspector as dep_accInspector,
  accKids as dep_accKids,
  accNorm as dep_accNorm,
  accStatusEligible as dep_accStatusEligible,
  inspectionKind as dep_inspectionKind,
  statusRule as dep_statusRule,
  accStr as dep_accStr,
  accText as dep_accText,
  accTime as dep_accTime,
  accXml as dep_accXml,
  addDays as dep_addDays,
  citationPricing as dep_citationPricing,
  clone as dep_clone,
  daysBetween as dep_daysBetween,
  doc as dep_doc,
  docCase as dep_docCase,
  docsFor as dep_docsFor,
  doneItems as dep_doneItems,
  draftDocFor as dep_draftDocFor,
  draftReinspFor as dep_draftReinspFor,
  effectiveFiled as dep_effectiveFiled,
  esc as dep_esc,
  insp as dep_insp,
  isHistoryDoc as dep_isHistoryDoc,
  iso as dep_iso,
  kase as dep_kase,
  nowISO as dep_nowISO,
  ocOf as dep_ocOf,
  originalNotice as dep_originalNotice,
  reinsp as dep_reinsp,
  snow as dep_snow,
  uid as dep_uid,
  unchecked as dep_unchecked,
} from "./app_core.js";
import { app_languagediscoveryContext, app_workspacequeueContext } from "./app_view_contexts.js";
import { INSPECTORS as dep_INSPECTORS } from "./data/inspectors.js";
import { activeRestrictions as dep_activeRestrictions } from "./new_documents.js";
import { WriterState } from "./state.js";
import { languageScreen } from "./language_discovery.js";
import { workspaceQueue, queueMatches } from "./workspace_queue.js";
/* app functions; direct dependencies use explicit shared state. */

function walkIdentity(r) {
  return r && r.caseId + "|" + r.id + "|" + r.sourceDocId;
}

function clearWalk() {
  WriterState.state.riWalk = false;
  WriterState.state.riWalkContext = null;
  WriterState.state.riWalkItem = null;
  WriterState.state.riWalkUndo = null;
  WriterState.state.riWalkSkipped = [];
  WriterState.state.riWalkStage = "outcome";
}

function restoreWalkFor(r) {
  const saved = WriterState.WORK.walk;
  if (saved?.context !== walkIdentity(r)) {
    WriterState.WORK.walk = null;
    return;
  }
  WriterState.state.riWalk = true;
  WriterState.state.riWalkContext = saved.context;
  WriterState.state.riWalkItem = saved.item;
  WriterState.state.riWalkUndo = saved.undo || null;
  WriterState.state.riWalkMode = saved.mode === "details" ? "details" : "quick";
  WriterState.state.riWalkSkipped = Array.isArray(saved.skipped) ? saved.skipped : [];
  WriterState.state.riWalkStage = saved.stage === "details" ? "details" : "outcome";
  if (!ensureWalkContext()) WriterState.WORK.walk = null;
}

function ensureWalkContext() {
  const r = WriterState.state.screen === "reinspect" && dep_reinsp(WriterState.state.reinspId);
  if (!r || !r.draft || r.docId || WriterState.state.riWalkContext !== walkIdentity(r)) {
    clearWalk();
    return false;
  }
  const src = dep_doc(r.sourceDocId);
  if (!src || src.caseId !== r.caseId) {
    clearWalk();
    return false;
  }
  if (
    WriterState.state.riWalkItem &&
    !src.items.some((it) => it.id === WriterState.state.riWalkItem && !it.withdrawn && !(r.results[it.id] || {}).carried)
  ) {
    clearWalk();
    return false;
  }
  if (WriterState.state.riWalkUndo && !src.items.some((it) => it.id === WriterState.state.riWalkUndo.itemId && !it.withdrawn))
    WriterState.state.riWalkUndo = null;
  WriterState.state.riWalkSkipped = WriterState.state.riWalkSkipped.filter((id) =>
    src.items.some((it) => it.id === id && !it.withdrawn && !(r.results[id] || {}).carried),
  );
  return true;
}

function nextWalkItem(r) {
  const src = r && dep_doc(r.sourceDocId);
  return (src && src.items.find((it) => !it.withdrawn && !(r.results[it.id] || {}).carried && !dep_ocOf(r, it.id))) || null;
}

function focusWalkItem() {
  const current = document.querySelector('[data-ri-walk-current="true"]');
  if (!current) {
    document.querySelector('[data-riwalk="off"]')?.focus();
    return;
  }
  const action = current.querySelector("[data-setoc]:not([disabled])");
  if (action) action.focus();
  else current.focus();
  if (current.scrollIntoView) current.scrollIntoView({ block: "center", behavior: "smooth" });
}

function focusWalkDetails() {
  const current = document.querySelector('[data-ri-walk-current="true"]');
  const el = current?.querySelector("[data-rinote], [data-ridate]");
  if (el) {
    el.focus();
    el.scrollIntoView?.({ block: "center" });
  } else focusWalkItem();
}

function walkItemReady(r, id) {
  if (!editableWalkItem(r, id)) return false;
  const result = r.results[id] || {},
    intent = r.followupIntent || "undecided";
  const source = dep_doc(r.sourceDocId),
    on = result.manualDate ? result.on : result.on || r.date;
  if (!result.oc || !dep_validISO(on) || on < dep_docCase(source).date || on > r.date) return false;
  if (result.oc === "corrected") return true;
  return !["extension", "citation"].includes(intent) || dep_dueCheck(result.due, r.date).ok;
}

function advanceWalk(r) {
  if (!WriterState.state.riWalk || !ensureWalkContext()) return false;
  if (
    WriterState.state.riWalkStage === "details" &&
    WriterState.state.riWalkItem &&
    !walkItemReady(r, WriterState.state.riWalkItem) &&
    !WriterState.state.riWalkSkipped.includes(WriterState.state.riWalkItem)
  ) {
    dep_toast("This item needs a valid date and, for an extension or citation, a new due date. Use Skip for now to continue.");
    focusWalkDetails();
    return false;
  }
  const next = nextWalkItem(r);
  WriterState.state.riWalkItem = next?.id || null;
  WriterState.state.riWalkStage = "outcome";
  dep_scheduleDraftSave();
  dep_render();
  focusWalkItem();
  return true;
}

function skipWalkDetails(r) {
  if (!WriterState.state.riWalk || !ensureWalkContext() || WriterState.state.riWalkStage !== "details") return false;
  if (!WriterState.state.riWalkSkipped.includes(WriterState.state.riWalkItem)) WriterState.state.riWalkSkipped.push(WriterState.state.riWalkItem);
  dep_scheduleDraftSave();
  return advanceWalk(r);
}

function returnWalkDetails(r) {
  if (!WriterState.state.riWalk || !ensureWalkContext()) return false;
  const src = dep_doc(r.sourceDocId),
    item = src.items.find((it) => editableWalkItem(r, it.id) && (!walkItemReady(r, it.id) || WriterState.state.riWalkSkipped.includes(it.id)));
  if (!item) return false;
  WriterState.state.riWalkItem = item.id;
  WriterState.state.riWalkStage = dep_ocOf(r, item.id) ? "details" : "outcome";
  WriterState.state.riWalkSkipped = WriterState.state.riWalkSkipped.filter((id) => id !== item.id);
  dep_scheduleDraftSave();
  dep_render();
  WriterState.state.riWalkStage === "details" ? focusWalkDetails() : focusWalkItem();
  return true;
}

function previousWalk(r) {
  if (!WriterState.state.riWalk || !ensureWalkContext()) return false;
  const src = dep_doc(r.sourceDocId),
    eligible = src.items.filter((i) => editableWalkItem(r, i.id));
  const ix = eligible.findIndex((i) => i.id === WriterState.state.riWalkItem),
    prior = eligible[ix < 0 ? eligible.length - 1 : ix - 1];
  if (!prior) return false;
  WriterState.state.riWalkItem = prior.id;
  WriterState.state.riWalkStage = dep_ocOf(r, prior.id) ? "details" : "outcome";
  dep_scheduleDraftSave();
  dep_render();
  WriterState.state.riWalkStage === "details" ? focusWalkDetails() : focusWalkItem();
  return true;
}

function editableWalkItem(r, id) {
  const src = r && dep_doc(r.sourceDocId),
    it = src && src.caseId === r.caseId && src.items.find((x) => x.id === id);
  return !!(
    WriterState.state.screen === "reinspect" &&
    r &&
    r.id === WriterState.state.reinspId &&
    r.draft &&
    !r.docId &&
    it &&
    !it.withdrawn &&
    !(r.results[id] || {}).carried
  );
}

function recordReinspectionOutcome(id, outcome) {
  const r = dep_reinsp(WriterState.state.reinspId);
  if (!editableWalkItem(r, id) || !dep_OUTCOMES.some((o) => o.id === outcome)) return false;
  if (WriterState.state.riWalk && (!ensureWalkContext() || !WriterState.state.riWalk)) return false;
  const cur = r.results[id] || {};
  if (cur.oc === outcome) return false;
  const before = Object.prototype.hasOwnProperty.call(r.results, id) ? dep_clone(cur) : null;
  const result = {
    oc: outcome,
    on: cur.on || r.date,
    manualDate: !!cur.manualDate,
    due: outcome === "corrected" ? "" : cur.due || "",
    note: cur.note || "",
    cite: outcome === "corrected" ? false : !!cur.cite,
  };
  if (WriterState.state.riWalk) WriterState.state.riWalkUndo = { context: walkIdentity(r), itemId: id, before, after: dep_clone(result) };
  else WriterState.state.riWalkUndo = null;
  r.results[id] = result;
  WriterState.state.riWalkSkipped = WriterState.state.riWalkSkipped.filter((x) => x !== id);
  if (WriterState.state.riWalk) {
    if (WriterState.state.riWalkMode === "details") {
      WriterState.state.riWalkItem = id;
      WriterState.state.riWalkStage = "details";
    } else {
      const next = nextWalkItem(r);
      WriterState.state.riWalkItem = (next && next.id) || null;
      WriterState.state.riWalkStage = "outcome";
    }
  }
  WriterState.DIRTY = true;
  dep_scheduleDraftSave();
  if (WriterState.state.riWalk) {
    dep_render();
    WriterState.state.riWalkStage === "details" ? focusWalkDetails() : focusWalkItem();
  } else dep_renderKeep();
  return true;
}

function undoWalkOutcome() {
  const r = dep_reinsp(WriterState.state.reinspId),
    undo = WriterState.state.riWalkUndo;
  if (!WriterState.state.riWalk || !ensureWalkContext() || !undo || undo.context !== walkIdentity(r) || !editableWalkItem(r, undo.itemId))
    return false;
  const current = r.results[undo.itemId];
  if (!current || current.oc !== undo.after.oc) {
    dep_toast("The outcome changed since Undo was recorded. Review the item before changing it.");
    return false;
  }
  if (dep_stableJSON(current) === dep_stableJSON(undo.after)) {
    if (undo.before) r.results[undo.itemId] = dep_clone(undo.before);
    else delete r.results[undo.itemId];
  } else {
    r.results[undo.itemId] = { ...dep_clone(current), oc: undo.before?.oc || "" };
    dep_toast("Outcome undone; later note, date and due details were kept on this item.");
  }
  WriterState.state.riWalkUndo = null;
  WriterState.state.riWalkItem = undo.itemId;
  WriterState.state.riWalkStage = "outcome";
  WriterState.DIRTY = true;
  dep_scheduleDraftSave();
  dep_render();
  focusWalkItem();
  return true;
}

function narrativeFor(r, it) {
  const k = dep_kase(r.caseId),
    src = dep_doc(r.sourceDocId),
    oc = dep_ocOf(r, it.id),
    res = r.results[it.id] || {};
  const first = dep_originalNotice(r.caseId),
    firstDate = (first && k.date) || k.date || (first || {}).created;
  const what = String(it.title || "the violation").replace(/\.$/, "");
  const label = (dep_DOC_TYPES.find((t) => t.id === (src || {}).type) || {}).label || "notice";
  const art = /^[AEIOU]/i.test(label) ? "An " : "A ";
  return (
    "Initial inspection on " +
    dep_fmtDate(firstDate) +
    " documented the following violation: " +
    what +
    ". " +
    art +
    label.toLowerCase() +
    " was issued with a compliance date of " +
    dep_fmtDate(it.due) +
    ". " +
    "Re-inspection on " +
    dep_fmtDate(res.on || r.date) +
    " found " +
    ((dep_OUTCOMES.find((o) => o.id === oc) || {}).found || "the violation uncorrected") +
    "." +
    (res.note ? " " + String(res.note).trim().replace(/\s+/g, " ") : "")
  );
}

function uiIcon(name) {
  const paths = {
    tools: "M9 3h6l1 4 4 1v6l-4 1-1 4H9l-1-4-4-1V8l4-1z M9 11a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
    search: "M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14 M15 15l6 6",
    calendar: "M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4",
    files: "M5 3h9l5 5v13H5z M14 3v6h5 M8 13h8 M8 17h8",
    recover: "M4 11a8 8 0 1 1 2 7 M4 4v7h7 M12 8v5l3 2",
    sync: "M4 7h14l-4-4 M20 17H6l4 4 M18 7l-4 4 M6 17l4-4",
    cases: "M3 6h7l2 2h9v12H3z M3 6V4h7l2 2",
    import: "M12 3v12m-5-5 5 5 5-5 M4 16v5h16v-5",
    library: "M4 3h12a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3z M4 17h15 M8 7h7 M8 11h7",
    reports: "M4 21V3 M4 21h17 M8 17v-5 M13 17V7 M18 17V4",
  };
  return (
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="curr' +
    'entColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="rou' +
    'nd" aria-hidden="true"><path d="' +
    `${paths[name] || paths.cases}` +
    '"/></svg>'
  );
}

function caseState(k) {
  const current = dep_sourceDocFor(k.id),
    draft = dep_draftDocFor(k.id),
    visit = dep_draftReinspFor(k.id) || dep_unissuedVisitFor(k.id),
    last = dep_docsFor(k.id).find((d) => !d.draft && !d.superseded);
  const live = dep_docsFor(k.id).filter((d) => !d.draft && !d.void && !d.superseded);
  const withdrawn = !!current && current.items.length > 0 && current.items.every((i) => i.withdrawn);
  const restrictions = dep_activeRestrictions(live),
    vacancy = live.find((d) => d.type === "vacancyExtension"),
    reviewDue = vacancy?.special?.reviewDate || "";
  const closed = dep_snow.isCase(k)
    ? !!current && !!current.filedAt && current.frozen?.snowCloseOnFiling !== false
    : !restrictions.length && (withdrawn || (!!current && current.type === "compliance") || (!current && !!last && !!last.void));
  const dates =
    current && !dep_isHistoryDoc(current)
      ? (current.items || [])
          .filter((i) => !i.done && !i.withdrawn && dep_validISO(i.due))
          .map((i) => i.due)
          .sort()
      : [];
  const due = dates[0] || "",
    days = due ? dep_daysBetween(dep_recordDay(today), due) : null;
  const late = !closed && !!due && due < dep_recordDay(today),
    soon = !closed && !!due && !late && days >= 0 && days <= 7;
  const pendingRecord = Object.values(WriterState.RECORD_ATTEMPTS).find((x) => x.cid === k.id) || null;
  const pendingDoc = dep_docsFor(k.id).find((d) => d.pendingAmendment) || null;
  const pendingSync = WriterState.PENDING.some((p) => p.cid === k.id || (!!dep_caseFileName(k) && p.name === dep_caseFileName(k)));
  const filingDoc = live.find((d) => dep_independentArtifact(d) && !dep_effectiveFiled(d)) || null;
  const artifactIssue = live.find((d) => ["artifact conflict", "missing or unavailable"].includes(dep_pdfTransferState(d))) || null;
  const numberIssue = !dep_caseNumberAllowed(k);
  const attention = !!(
    restrictions.length ||
    (reviewDue && reviewDue <= dep_addDays(dep_recordDay(today), 7)) ||
    numberIssue ||
    draft ||
    visit ||
    late ||
    soon ||
    pendingRecord ||
    pendingDoc ||
    pendingSync ||
    filingDoc ||
    artifactIssue
  );
  return {
    restrictions,
    reviewDue,
    current: current || last,
    draft,
    visit,
    closed,
    due,
    days,
    late,
    soon,
    pendingRecord,
    pendingDoc,
    pendingSync,
    filingDoc,
    artifactIssue,
    attention,
    label:
      dep_snow.isCase(k) && current
        ? "Cited – snow"
        : restrictions.length
          ? "Occupancy restricted"
          : numberIssue
            ? "Case number needs correction"
            : draft
              ? draft.correction
                ? "Correction draft"
                : "Document draft"
              : visit
                ? visit.draft
                  ? "Reinspection draft"
                  : "Visit needs document"
                : withdrawn || (!current && last && last.void)
                  ? "Withdrawn"
                  : closed
                    ? "Closed"
                    : current
                      ? dep_STATUS_OF[current.type] || "Issued"
                      : last?.special?.mode === "release"
                        ? "Restriction released"
                        : last
                          ? dep_STATUS_OF[last.type] || "Issued"
                          : "Ready to start",
  };
}

function screenCases() {
  const rows = WriterState.CASES.map((k) => ({ k, st: caseState(k) })),
    tasks = dep_workspaceTasks(rows);
  // Retire legacy metric selection into the single visible View control.
  if (WriterState.state.metric) {
    WriterState.state.caseFilter =
      { drafts: "continue", overdue: "overdue", soon: "soon", open: "open", imports: "all" }[WriterState.state.metric] || "resolution";
    WriterState.state.metric = "";
  }
  const queue = workspaceQueue(rows, tasks, app_workspacequeueContext()),
    query = String(WriterState.state.caseQ || "")
      .toLowerCase()
      .trim();
  const views = [
    ["attention", "Needs attention"],
    ["continue", "Continue work"],
    ["deadlines", "Deadlines"],
    ["resolution", "Needs resolution"],
    ["all", "All cases"],
    ["soon", "Due within 7 days"],
    ["overdue", "Past due"],
    ["open", "Open"],
    ["closed", "Closed"],
  ];
  if (WriterState.state.caseFilter === "drafts") WriterState.state.caseFilter = "continue";
  if (!views.some(([key]) => key === WriterState.state.caseFilter)) WriterState.state.caseFilter = "attention";
  const count = (filter) => queue.filter((row) => queueMatches(row, filter)).length;
  const filtered = queue.filter(
    (row) =>
      queueMatches(row, WriterState.state.caseFilter) &&
      (!query || dep_caseSearchText(row.k).includes(query)) &&
      (!WriterState.state.caseInspector || row.k.inspectorId === WriterState.state.caseInspector),
  );
  const table = filtered
    .map((row) => {
      const { k, st, proof } = row,
        documents = dep_docsFor(k.id);
      const secondary = row.facts.filter((t) => !["open", "drafts"].includes(t.key));
      const detailActions = secondary
        .map(
          (t) =>
            '<div class="queue-detail-task"><span>' +
            `${dep_esc(t.label)}` +
            '</span><button class="btn btn-sm" ' +
            `${t.action}` +
            ">Review</button></div>",
        )
        .join("");
      return (
        '<tr data-queue-case="' +
        `${dep_esc(k.id)}` +
        '"><td><div class="addr">' +
        `${dep_esc(k.address)}` +
        '</div><div class="mono">' +
        `${dep_esc(k.number)}` +
        '</div>\n      <details class="queue-details"><summary>Case details &amp; ' +
        "history" +
        `${secondary.length ? " · " + secondary.length + " task" + (secondary.length === 1 ? "" : "s") : ""}` +
        '</summary><div class="doclinks"><p>' +
        `${dep_esc(k.owner)}` +
        "</p>" +
        `${detailActions}` +
        "\n      " +
        "".concat(
          !dep_caseNumberAllowed(k)
            ? '<p class="save-error">Case number needs correction. Open the document and use its case details checks.</p>'
            : "",
        ) +
        "\n      <p>Record verification: " +
        `${dep_esc(proof.label)}` +
        "</p>" +
        "".concat(
          proof.valid === false
            ? "<p>" +
                `${dep_esc(proof.eventId || "")}` +
                " · " +
                `${dep_esc(proof.lastGoodCommitTime || "Last good commit unavailable")}` +
                '</p><button class="btn btn-sm" data-sync-safety>Review record problem</b' +
                "utton>"
            : "",
        ) +
        "\n      " +
        "".concat(
          documents
            .map(
              (d) =>
                '<button data-open="' +
                `${dep_esc(d.id)}` +
                '" class="' +
                `${d.void ? "voidlink" : d.draft ? "" : "fin"}` +
                '">' +
                `${d.void ? "VOID · " : d.superseded ? "REPLACED · " : d.revision ? "REV " + d.revision.number + " · " : ""}` +
                "" +
                `${dep_esc((dep_DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type)}` +
                " <span>" +
                `${dep_fmtDate(d.mailed || d.created)}` +
                "" +
                `${d.draft ? " · Draft" : ""}` +
                "</span></button>",
            )
            .join(""),
        ) +
        '\n      <button data-exportcase="' +
        `${dep_esc(k.id)}` +
        '">Download case record</button><button data-timeline="' +
        `${dep_esc(k.id)}` +
        '">Case timeline</button>\n      ' +
        "".concat(
          st.visit?.draft
            ? `<button data-discardri="${dep_esc(st.visit.id)}">Discard reinspection draft</button>`
            : st.draft
              ? `<button data-discard="${dep_esc(st.draft.id)}">Discard document draft</button>`
              : "",
        ) +
        '\n      <button data-rmcase="' +
        `${dep_esc(k.id)}` +
        '">Put away case</button></div></details></td>\n      <td><span class="pil' +
        "l " +
        `${row.resolution ? "late" : st.closed ? "closed" : row.continuing ? "draft" : "open"}` +
        '">' +
        `${dep_esc(row.resolution && !row.continuing ? "Needs resolution" : st.label)}` +
        '</span><p class="queue-reason">' +
        `${dep_esc(row.reason)}` +
        "</p>" +
        "".concat(row.continuing && row.resolution ? '<span class="queue-secondary">Also needs resolution · see case details</span>' : "") +
        "" +
        "".concat(
          st.visit
            ? '<span class="muted">' +
                `${dep_doneItems(st.visit).length}` +
                " corrected, " +
                `${dep_unchecked(st.visit).length}` +
                " still to result</span>"
            : "",
        ) +
        "</td>\n      <td>" +
        "".concat(
          st.due && !st.closed
            ? '<span class="' +
                `${st.late ? "pill late" : st.soon ? "case-date-soon" : "mono"}` +
                '">' +
                `${dep_fmtDate(st.due)}` +
                "</span>" +
                "".concat(
                  st.late
                    ? '<div class="muted">Past due</div>'
                    : st.soon
                      ? '<div class="muted">' +
                        (st.days === 0 ? "Due today" : st.days === 1 ? "Due tomorrow" : "Due in " + st.days + " days") +
                        "</div>"
                      : "",
                ) +
                ""
            : '<span class="muted">—</span>',
        ) +
        "</td>\n      <td>" +
        `${dep_esc(dep_insp(k.inspectorId).name)}` +
        '</td><td><div class="case-next"><button class="btn btn-sm btn-primary qu' +
        'eue-primary" ' +
        `${row.action}` +
        ">" +
        `${dep_esc(row.label)}` +
        "</button></div></td></tr>"
      );
    })
    .join("");
  const importCount = tasks.find((t) => t.key === "imports").count;
  // Pending operations without a loaded case must remain reachable.
  const orphan = WriterState.PENDING.filter((p) => !WriterState.CASES.some((k) => k.id === p.cid || dep_caseFileName(k) === p.name));
  const activeLabel = views.find(([key]) => key === WriterState.state.caseFilter)[1];
  return dep_shell(
    "Your workspace",
    "Building Inspection",
    '<button class="btn" data-global-search>' +
      `${uiIcon("search")}` +
      ' Search all shared cases</button><button class="btn btn-primary" data-na' +
      'v="import">' +
      `${uiIcon("import")}` +
      " Import inspection</button>",
    "" +
      `${dep_importResumePanel()}` +
      "" +
      "".concat(WriterState.PREFLIGHT_NOTICE ? `<div class="banner info" role="status">${dep_esc(WriterState.PREFLIGHT_NOTICE)}</div>` : "") +
      '\n     <div class="workspace-lead"><div><h2>' +
      `${WriterState.CASES.length ? activeLabel : "Start with a case"}` +
      "</h2><p>" +
      "".concat(
        WriterState.CASES.length
          ? "One next action per case. Open case details for other tasks and history."
          : "Import an Accela report or open a saved case to begin.",
      ) +
      "</p></div></div>\n     " +
      "".concat(
        WriterState.CASES.length
          ? '<div class="queue-summary" role="group" aria-label="Filter workspace cas' +
              'es">' +
              "".concat(
                [
                  ["continue", "Continue work"],
                  ["deadlines", "Deadlines"],
                  ["resolution", "Needs resolution"],
                  ["all", "All cases"],
                ]
                  .map(
                    ([key, label]) =>
                      '<button class="btn queue-summary-button" data-queue-view="' +
                      `${key}` +
                      '" aria-pressed="' +
                      `${WriterState.state.caseFilter === key}` +
                      '"><span>' +
                      `${label}` +
                      "</span><strong>" +
                      `${count(key)}` +
                      "</strong></button>",
                  )
                  .join(""),
              ) +
              "</div>"
          : "",
      ) +
      "\n     " +
      "".concat(
        orphan.length
          ? '<div class="banner warn">' +
              `${orphan.length}` +
              " queued case file" +
              `${orphan.length === 1 ? "" : "s"}` +
              ' outside the loaded cases. <button class="btn btn-sm" data-sync-safety>R' +
              "eview queued saves</button></div>"
          : "",
      ) +
      '\n     <div class="card">' +
      "".concat(
        !WriterState.CASES.length
          ? '<div class="empty-state"><div class="empty-icon">' +
              `${uiIcon("cases")}` +
              "</div><h2>A clear desk. A clear next step.</h2><p>Bring in the case deta" +
              "ils, choose the violations, then review and issue. Your unfinished work " +
              'is saved on this device.</p><button class="btn btn-primary" data-nav="im' +
              'port">Import Inspection Result</button> <button class="btn" data-openfil' +
              "e>Open saved case</button></div>"
          : '<div class="case-tools"><label><span class="sr-only">Search this workspa' +
              'ce</span><input type="search" id="case-search" value="' +
              `${dep_esc(WriterState.state.caseQ)}` +
              '" placeholder="Search this workspace…"></label>\n      <label class="case' +
              '-view"><span>View</span><select id="case-filter" aria-label="View cases"' +
              ">" +
              "".concat(
                views
                  .map(
                    ([key, label]) =>
                      `<option value="${key}" ${WriterState.state.caseFilter === key ? "selected" : ""}>${label} (${count(key)})</option>`,
                  )
                  .join(""),
              ) +
              '</select></label>\n      <select id="case-inspector" aria-label="Filter b' +
              'y inspector"><option value="">All inspectors</option>' +
              "".concat(
                dep_INSPECTORS
                  .filter((i) => WriterState.CASES.some((k) => k.inspectorId === i.id))
                  .map(
                    (i) =>
                      '<option value="' +
                      `${dep_esc(i.id)}` +
                      '" ' +
                      `${WriterState.state.caseInspector === i.id ? "selected" : ""}` +
                      ">" +
                      `${dep_esc(i.name)}` +
                      "</option>",
                  )
                  .join(""),
              ) +
              '</select></div>\n      <p class="queue-filter-note">' +
              `${filtered.length}` +
              " of " +
              `${count(WriterState.state.caseFilter)}` +
              " cases in " +
              `${activeLabel}` +
              "" +
              `${query ? " · workspace search applied" : ""}` +
              "" +
              `${WriterState.state.caseInspector ? " · inspector filter applied" : ""}` +
              ". Counts include all loaded cases; a case can belong to more than one vi" +
              "ew." +
              "".concat(query || WriterState.state.caseInspector ? ' <button class="lnk" data-queue-reset>Clear search and inspector</button>' : "") +
              '</p>\n      <div class="case-table-wrap"><table class="list case-table"><' +
              'caption class="sr-only">' +
              `${dep_esc(activeLabel)}` +
              " · workspace cases and recommended actions</caption><thead><tr><th scope" +
              '="col">Property / case</th><th scope="col">Status / next step</th><th sc' +
              'ope="col">Next due</th><th scope="col">Inspector</th><th scope="col">Nex' +
              "t action</th></tr></thead><tbody>" +
              "".concat(
                table ||
                  '<tr><td colspan="5"><div class="empty">' +
                    `${query || WriterState.state.caseInspector ? "No cases match these filters." : "No cases in this view."}` +
                    ' <button class="lnk" data-queue-reset>Clear search and inspector</button' +
                    '> <button class="lnk" id="case-showall">View all cases</button></div></t' +
                    "d></tr>",
              ) +
              '</tbody></table></div><div class="case-count">' +
              `${WriterState.CASES.length}` +
              " cases on this device. Use Search all shared cases for records outside t" +
              "his workspace." +
              `${importCount ? " An import is waiting for review above." : ""}` +
              "</div>",
      ) +
      '</div>\n     <div class="queue-support"><button class="btn btn-sm" data-s' +
      'ync-safety>Saved work &amp; connection</button><div id="recovery-status"' +
      ' class="hint" aria-live="polite">' +
      `${dep_recoveryStatusHTML()}` +
      "</div>" +
      `${WriterState.CASES.length ? '<button class="lnk" id="btn-clear">Put away cases</button>' : ""}` +
      "</div>\n     " +
      `${dep_remindersPanel()}` +
      "" +
      `${dep_workingNotesPanel()}` +
      "",
  );
}

async function accInflate(bytes, limit = dep_ACC_EXPANDED_MAX) {
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  w.write(bytes).catch(() => {});
  w.close().catch(() => {});
  const rd = ds.readable.getReader(),
    parts = [];
  let n = 0;
  for (;;) {
    const x = await rd.read();
    if (x.done) break;
    n += x.value.length;
    if (n > limit) {
      await rd.cancel();
      throw new Error("The expanded workbook is too large. Export a report for one case.");
    }
    parts.push(x.value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  parts.forEach((p) => {
    out.set(p, o);
    o += p.length;
  });
  return out;
}

async function accUnzip(buf, want) {
  const u8 = new Uint8Array(buf),
    dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const fail = (m) => {
    throw new Error(m);
  };
  if (u8.length < 22 || dv.getUint32(0, true) !== 0x04034b50) fail("it is not an Excel .xlsx file");
  let e = -1;
  for (let p = u8.length - 22; p >= Math.max(0, u8.length - 65557); p--)
    if (dv.getUint32(p, true) === 0x06054b50) {
      e = p;
      break;
    }
  if (e < 0) fail("the file is incomplete or damaged");
  const count = dv.getUint16(e + 10, true),
    cdOff = dv.getUint32(e + 16, true);
  if (cdOff === 0xffffffff || cdOff >= u8.length) fail("the file is incomplete or damaged");
  const dec = new TextDecoder("utf-8"),
    out = {};
  let p = cdOff,
    total = 0;
  for (let n = 0; n < count; n++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) fail("the file is incomplete or damaged");
    const method = dv.getUint16(p + 10, true),
      csize = dv.getUint32(p + 20, true),
      usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true),
      xlen = dv.getUint16(p + 30, true),
      clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (!want(name)) continue;
    if (usize > dep_ACC_EXPANDED_MAX - total) fail("The expanded workbook is too large. Export a report for one case.");
    if (lho + 30 > u8.length || dv.getUint32(lho, true) !== 0x04034b50) fail("the file is incomplete or damaged");
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    if (start + csize > u8.length) fail("the file is incomplete or damaged");
    const raw = u8.subarray(start, start + csize);
    let bytes;
    if (method === 0) bytes = raw;
    else if (method === 8) {
      try {
        bytes = await accInflate(raw, dep_ACC_EXPANDED_MAX - total);
      } catch (err) {
        fail(/expanded workbook/.test(err.message) ? err.message : "the file is incomplete or damaged");
      }
    } else fail("the file uses a compression this program cannot read");
    total += bytes.length;
    if (total > dep_ACC_EXPANDED_MAX) fail("The expanded workbook is too large. Export a report for one case.");
    out[name] = dec.decode(bytes);
  }
  return out;
}

async function readXlsx(buf) {
  const files = await accUnzip(buf, (n) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/i.test(n));
  const key = (n) => Object.keys(files).find((k) => k.toLowerCase() === n.toLowerCase());
  if (!key("xl/workbook.xml")) throw new Error("it is not an Excel workbook");
  const wb = dep_accXml(files[key("xl/workbook.xml")]);
  if (dep_accAll(wb, "workbookPr").some((p) => /^(1|true)$/i.test(p.getAttribute("date1904") || "")))
    throw new Error("This workbook uses the 1904 date system. Export the SSRS report again using the standard 1900 date system.");
  const sheet = dep_accAll(wb, "sheet")[0];
  if (!sheet) throw new Error("the workbook has no sheets");
  let rid = "";
  Array.prototype.forEach.call(sheet.attributes, (a) => {
    if (a.localName === "id" && a.name !== "sheetId") rid = a.value;
  });
  let target = "";
  if (key("xl/_rels/workbook.xml.rels")) {
    const rel = dep_accAll(dep_accXml(files[key("xl/_rels/workbook.xml.rels")]), "Relationship").find((r) => r.getAttribute("Id") === rid);
    if (rel) target = rel.getAttribute("Target") || "";
  }
  let path = target.charAt(0) === "/" ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
  if (!target || !key(path))
    path =
      Object.keys(files)
        .filter((n) => /^xl\/worksheets\//i.test(n))
        .sort()[0] || "";
  if (!path || !key(path)) throw new Error("the workbook has no readable sheet");
  const sst = key("xl/sharedStrings.xml") ? dep_accAll(dep_accXml(files[key("xl/sharedStrings.xml")]), "si").map(dep_accText) : [];
  const ws = dep_accXml(files[key(path)]);
  const rows = [];
  dep_accAll(ws, "row").forEach((rw) => {
    const row = [];
    let next = 0;
    dep_accKids(rw, "c").forEach((c) => {
      const r = c.getAttribute("r"),
        ix = r ? dep_accColIx(r) : next;
      next = ix + 1;
      const t = c.getAttribute("t") || "",
        v = dep_accKids(c, "v")[0],
        vt = v ? v.textContent : "";
      let val;
      if (t === "s") val = sst[+vt] !== undefined ? sst[+vt] : "";
      else if (t === "inlineStr") {
        const is = dep_accKids(c, "is")[0];
        val = is ? dep_accText(is) : "";
      } else if (t === "str" || t === "e") val = vt;
      else if (t === "b") val = vt === "1" ? "TRUE" : "FALSE";
      else val = vt === "" ? "" : Number(vt);
      if (ix >= 0) row[ix] = val;
    });
    rows.push(row);
  });
  return rows;
}

function accSerial(v) {
  if (typeof v !== "number" || !isFinite(v) || v <= 0) return null;
  let days = Math.floor(v),
    mins = Math.round((v - days) * 1440);
  if (mins >= 1440) {
    days++;
    mins -= 1440;
  }
  return { date: dep_iso(new Date(Date.UTC(1899, 11, 30 + days, 12))), mins: mins };
}

function accWhen(dv, tv) {
  let date = null;
  // R36: the Inspection Time column is authoritative. Any time carried in the date column is ignored, with no comparison warning.
  const s = accSerial(dv);
  if (s) date = s.date;
  else if (dep_accStr(dv)) date = dep_parseDate(dep_accStr(dv).split(/[\sT]+/)[0]);
  const textTime = dep_accStr(tv) || typeof tv === "number" ? dep_accTime(tv) : null;
  return { date: date, time: textTime || "", warn: "" };
}

function accParcel(v) {
  const raw = dep_accStr(v);
  if (/^\d{12}$/.test(raw)) return { v: raw.slice(0, 4) + "-" + raw.slice(4, 7) + "-" + raw.slice(7, 11) + "-" + raw.slice(11), warn: "" };
  if (/^\d{4}-\d{3}-\d{4}-\d$/.test(raw)) return { v: raw, warn: "" };
  return { v: raw, warn: raw ? "Parcel number " + raw + " is not 12 digits — imported as delivered" : "" };
}

function accelaTable(grid) {
  const res = { cases: [], errors: [], notes: [], excluded: { scheduled: 0, assist: 0 } };
  const known = Object.keys(dep_ACC_COLS).map((k) => dep_ACC_COLS[k]);
  const hr = grid.findIndex(
    (r) => r && r.some((v) => dep_accNorm(v) === "case number") && r.filter((v) => known.indexOf(dep_accNorm(v)) >= 0).length >= 4,
  );
  if (hr < 0) {
    res.errors.push("No Accela report table was found — the file has no Case Number header row");
    return res;
  }
  const col = {};
  grid[hr].forEach((v, ix) => {
    let h = dep_accNorm(v);
    if (h === "case type name" || h === "casetype" || h === "casetypename") h = "case type";
    if (!h) return;
    const k = Object.keys(dep_ACC_COLS).find((k) => dep_ACC_COLS[k] === h);
    if (k) {
      if (col[k] === undefined) col[k] = ix;
    } else res.notes.push('Column "' + dep_accStr(v) + '" is not part of the Accela report and was ignored');
  });
  const miss = dep_ACC_REQUIRED.filter((k) => col[k] === undefined);
  if (miss.length) {
    res.errors.push(
      "The report is missing the column" + (miss.length === 1 ? "" : "s") + " " + miss.map(dep_ACC_LABEL).join(", ") + " — nothing was imported",
    );
    return res;
  }
  Object.keys(dep_ACC_COLS)
    .filter(
      (k) =>
        dep_ACC_REQUIRED.indexOf(k) < 0 && k !== "detail" && k !== "zoning" && k !== "caseType" && k !== "recordCategory" && col[k] === undefined,
    )
    .forEach((k) => res.notes.push("The report has no " + dep_ACC_LABEL(k) + " column"));
  const get = (r, k) => (col[k] === undefined ? "" : r[col[k]]);
  const by = {};
  grid.slice(hr + 1).forEach((r) => {
    if (!r) return;
    const num = dep_accStr(get(r, "number"));
    if (!num) return;
    if (/^scheduled$/i.test(dep_accStr(get(r, "status")))) {
      res.excluded.scheduled++;
      return;
    }
    if (/^assist$/i.test(dep_accStr(get(r, "type")))) {
      res.excluded.assist++;
      return;
    } // Excluded from selection and retained import history.
    let c = by[num];
    if (!c) {
      c = by[num] = { number: num, raw: {}, conflicts: [], rows: [] };
      res.cases.push(c);
      dep_ACC_CASEFIELDS.forEach((f) => {
        c.raw[f] = dep_accStr(get(r, f));
      });
    } else
      dep_ACC_CASEFIELDS.forEach((f) => {
        const v = dep_accStr(get(r, f));
        if (v !== c.raw[f] && !c.conflicts.some((x) => x.f === f)) c.conflicts.push({ f: f, a: c.raw[f], b: v });
      });
    const w = accWhen(get(r, "date"), get(r, "time"));
    const type = dep_accStr(get(r, "type")),
      status = dep_accStr(get(r, "status"));
    const kind = dep_inspectionKind(type),
      tk = kind || "other",
      rule = dep_statusRule(type, status);
    const st = dep_ACC_STATUS[dep_accNorm(status)];
    const name = dep_accStr(get(r, "inspector")),
      ins = dep_accInspector(name);
    const row = {
      caseType: dep_accStr(get(r, "caseType")),
      recordCategory: dep_accStr(get(r, "recordCategory")),
      i: c.rows.length,
      type: type,
      typeKey: tk,
      date: w.date || "",
      time: w.time,
      status: status,
      rule: rule,
      inspectorName: name,
      inspectorId: ins ? ins.id : "",
      selectable: true,
      why: "",
      warn: [],
    };
    if (w.warn) row.warn.push(w.warn);
    if (!w.date) {
      row.selectable = false;
      row.why = "No inspection date";
    } else if (st?.why) {
      row.selectable = false;
      row.why = st.why;
    } else if (rule.error) {
      row.selectable = false;
      row.why = rule.error;
    }
    c.rows.push(row);
  });
  if (!res.cases.length)
    res.errors.push(
      res.excluded.scheduled || res.excluded.assist
        ? "No eligible completed inspection: " +
            (res.excluded.scheduled && res.excluded.assist
              ? "only Scheduled and Assist rows were returned."
              : res.excluded.scheduled
                ? "only Scheduled rows were returned; the inspection has not been completed."
                : "only Assist rows were returned; choose a completed Initial Inspection or Reinspection.")
        : "The report has a header row but no case rows",
    );
  res.cases.forEach((c) => {
    c.rows.sort((a, b) => !a.date - !b.date || (a.date + a.time < b.date + b.time ? -1 : a.date + a.time > b.date + b.time ? 1 : 0));
    const done = c.rows.filter((r) => r.selectable && dep_accStatusEligible(r.status, r.type));
    c.sel = done.length === 1 ? done[0].i : null;
  });
  return res;
}

const INITIAL_EXISTS = "An Initial Inspection result can only start a new case, and this case already exists.";
const NO_CASE = "No case exists for this inspection. Import its Initial Inspection first.";

function baseLookupPlan(acc) {
  const p = { blockers: [], warnings: [], diff: [], notes: (acc && acc.notes) || [] };
  if (!acc) {
    p.blockers.push("No report loaded");
    return p;
  }
  if (acc.errors && acc.errors.length) {
    p.blockers = acc.errors.slice();
    return p;
  }
  const c = acc.cases[acc.caseIx || 0];
  if (!c) {
    p.blockers.push("Choose a case");
    return p;
  }
  p.c = c;
  const r = c.raw,
    par = accParcel(r.parcel),
    cut = r.address.indexOf(",");
  const hist = r.historic && !/^no$/i.test(r.historic),
    lm = r.landmark && !/^no$/i.test(r.landmark) ? r.landmark : "";
  p.f = {
    address: (cut < 0 ? r.address : r.address.slice(0, cut)).trim().toUpperCase(),
    siteCity:
      cut < 0
        ? ""
        : r.address
            .slice(cut + 1)
            .trim()
            .toUpperCase(),
    parcel: par.v,
    historic: !!hist,
    historicDistrict: hist ? r.historic : "",
    landmark: lm,
    description: r.description,
    owner: r.owner,
    ownerAddr: r.ownerAddr
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
  };
  c.conflicts.forEach((x) =>
    p.blockers.push("The report gives two different values for " + dep_ACC_LABEL(x.f) + ' on this case: "' + x.a + '" and "' + x.b + '"'),
  );
  if (!p.f.address) p.blockers.push("The report has no site address for this case");
  if (!/^CB\d{4}-\d{3}-\d{5}$/.test(c.number)) p.warnings.push("Case number " + c.number + " does not follow the usual CB2026-000-00000 pattern");
  if (par.warn) p.warnings.push(par.warn);
  const inits = c.rows.filter((x) => x.typeKey === "initial" && x.date);
  p.initial = inits[0] || null;
  if (inits.length > 1)
    p.warnings.push("The report lists " + inits.length + " initial inspections — the earliest, " + dep_fmtDate(inits[0].date) + ", is used");
  const k = WriterState.CASES.find((x) => dep_accStr(x.number).toUpperCase() === dep_accStr(c.number).toUpperCase()) || null;
  p.existing = k;
  const row = c.rows.find((x) => x.i === acc.sel) || null;
  p.row = row;
  const snowCase = dep_snow.isCase(k) || dep_snow.matchesImport(row);
  if (!row)
    p.blockers.push(
      c.rows.some((x) => x.selectable && dep_accStatusEligible(x.status, x.type))
        ? "Choose the inspection result you are documenting."
        : "No eligible inspection result is available: " +
            [
              ...new Set(
                c.rows.map(
                  (x) =>
                    x.why ||
                    (dep_accStatusEligible(x.status, x.type) ? "Missing required inspection fields" : "status " + (x.status || "not supplied")),
                ),
              ),
            ].join("; ") +
            ". Correct the source in Accela and retrieve it again.",
    );
  else {
    if (!row.selectable) p.blockers.push("That inspection cannot be written from — " + row.why);
    else if (row.rule?.error) p.blockers.push(row.rule.error + ". Set the specific result in Accela and retrieve it again.");
    if (row.date && row.date > dep_recordDay(today)) p.blockers.push("The selected inspection date is in the future.");
    if (!row.inspectorId)
      p.blockers.push(
        row.inspectorName
          ? 'Inspector "' + row.inspectorName + '" is not on the roster — nothing can be signed in that name'
          : "The report names no inspector for that inspection",
      );
    row.warn.forEach((w) => p.warnings.push(w));
  }
  // the case keeps the initial inspection; a follow-up carries its own
  if (snowCase && row) {
    p.date = k?.date || row.date;
    p.time = k?.time || row.time;
  } else if (k && dep_originalNotice(k.id)) {
    p.date = k.date;
    p.time = k.time || "";
    if (p.initial && (p.initial.date !== k.date || p.initial.time !== (k.time || "")))
      p.warnings.push(
        "The issued case keeps its initial inspection date/time. Correct a record" +
          "ing error through document correction so reporting retains its audit tra" +
          "il.",
      );
  } else if (p.initial) {
    p.date = p.initial.date;
    p.time = p.initial.time;
  } else if (k && dep_validISO(k.date)) {
    p.date = k.date;
    p.time = k.time || "";
    p.warnings.push("The report has no Initial Inspection row — the case keeps its initial inspection of " + dep_fmtDate(k.date));
  } else {
    p.needDate = true;
    p.date = dep_validISO(acc.manualDate) ? acc.manualDate : "";
    p.time = dep_parseTime(acc.manualTime || "") || "";
    if (!p.date) p.blockers.push("The report has no Initial Inspection row — enter the initial inspection date below");
  }
  const src = k ? dep_sourceDocFor(k.id) : null;
  p.next = k && src ? "reinspect" : "notice";
  // R53 Refresh from Accela: importing the same inspection again while its draft or worksheet is unissued
  // updates the stored Accela status instead of being refused as already used.
  const pending = k && row ? (row.typeKey === "initial" ? dep_draftDocFor(k.id) : dep_draftReinspFor(k.id)) : null;
  p.refresh = row && pending?.importInspection && dep_sameInspection(pending.importInspection, dep_inspectionIdentity(row)) ? pending : null;
  if (k && !p.refresh) {
    p.used = row && dep_inspectionUsed(k, row);
    const unfinished = dep_draftDocFor(k.id) || dep_draftReinspFor(k.id) || dep_unissuedVisitFor(k.id);
    if (p.used)
      p.blockers.push(
        "This inspection has already been used to generate a document. Choose Con" + "tinue existing case to continue or correct that document.",
      );
    else if (unfinished) p.blockers.push("This case has unfinished work. Choose Continue existing case before importing another inspection.");
    else if (!src) p.blockers.push("This case already exists. Choose Continue existing case to finish and issue its Official Notice first.");
    else if (caseState(k).closed) p.blockers.push("This case is completed. Choose Continue existing case; new observations require a new case.");
    else if (row) {
      if (row.typeKey === "initial") p.blockers.push(INITIAL_EXISTS);
      const at = dep_inspAt(src);
      if (row.date < at.date || (row.date === at.date && row.time && at.time && row.time < at.time))
        p.blockers.push("Select a reinspection on or after the latest issued document’s inspection.");
    }
  } else if (row && row.typeKey !== "initial") p.blockers.push(NO_CASE);
  // R53 referral rules: Reinspection/CA Referral is the case's first referral; CA Reinspection requires one.
  if (k && !p.refresh && row?.rule && !row.rule.error) {
    const referred = dep_docsFor(k.id).some((d) => !d.draft && !d.void && !d.superseded && (d.type === "referral" || d.type === "referralUpdate"));
    if (row.rule.firstReferral && referred) p.blockers.push("This case is already with the City Attorney. Use a CA Reinspection.");
    if (row.rule.needsReferral && !referred)
      p.blockers.push("This case has not been referred to the City Attorney. Use a Reinspection with status CA Referral for the first referral.");
  }
  if (k && !p.refresh && row?.typeKey === "initial" && !p.blockers.includes(INITIAL_EXISTS)) p.blockers.push(INITIAL_EXISTS);
  p.rule = row?.rule || null;
  if (snowCase) {
    p.next = "snow";
    if (k && src && !dep_snow.is(src)) p.blockers.push("Snow removal cases cite only MGO 10.28. Create a separate case for other violations.");
    else
      p.blockers = p.blockers.filter(
        (t) =>
          !t.startsWith("This case is completed.") &&
          !t.startsWith("This case already exists.") &&
          !t.startsWith("The initial inspection belongs") &&
          !t.startsWith("No existing case was found."),
      );
    if (row?.rule && !row.rule.error && !row.rule.cite)
      p.blockers.push("Snow removal inspections are imported with status Citation (" + row.type + " status " + row.status + " has no snow rule).");
    if (row) {
      p.date = k?.date || row.date;
      p.time = k?.time || row.time;
    }
  }
  if (k) {
    if (k.address !== p.f.address)
      p.warnings.push(
        "The case is on file as " +
          k.address +
          "; the report reads " +
          p.f.address +
          ". The address on file is kept so the case keeps writing to its own case file.",
      );
    const show = (v) => (Array.isArray(v) ? v.join(" / ") : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v || ""));
    const cmp = [
      ["siteCity", "City, state, ZIP"],
      ["parcel", "Parcel"],
      ["description", "Case description"],
      ["owner", "Owner"],
      ["ownerAddr", "Owner mailing address"],
      ["historic", "Historic district"],
      ["historicDistrict", "District name"],
      ["landmark", "Landmark"],
    ];
    cmp.forEach(([f, l]) => {
      if (show(k[f]) !== show(p.f[f])) p.diff.push({ l: l, was: show(k[f]), now: show(p.f[f]) });
    });
    if (p.date && (k.date !== p.date || (k.time || "") !== p.time))
      p.diff.push({
        l: "Initial inspection",
        was: dep_fmtDate(k.date) + " " + dep_fmtTime(k.time || ""),
        now: dep_fmtDate(p.date) + " " + dep_fmtTime(p.time),
      });
    if (row && row.inspectorId && row.inspectorId !== k.inspectorId)
      p.diff.push({ l: "Case inspector", was: dep_insp(k.inspectorId).name || "", now: dep_insp(row.inspectorId).name || "" });
    // where Accela and the record disagree
    const live = dep_docsFor(k.id).filter((d) => !d.draft && !d.void && !d.superseded);
    [
      ["citation", "Citation", "citation"],
      ["official notice", "Official Notice", "notice"],
    ].forEach(([s, label, ty]) => {
      const a = c.rows.filter((x) => dep_accNorm(x.status) === s).length,
        m = live.filter((d) => d.type === ty).length;
      if (a > m) p.warnings.push("Accela shows " + a + " " + label + (a === 1 ? "" : "s") + " on this case; the case file has " + m);
    });
  }
  return p;
}

async function readAccelaFile(file) {
  if (!file || WriterState.state.screen !== "import") return;
  dep_cancelCaseLookup();
  const serial = WriterState.LOOKUP_SERIAL;
  const active = () => serial === WriterState.LOOKUP_SERIAL && WriterState.state.screen === "import";
  WriterState.LOOKUP_ERROR = "";
  WriterState.LOOKUP_BUSY = true;
  dep_render();
  try {
    if (file.size > dep_ACC_MAX) throw new Error("That file is " + Math.round(file.size / 1048576) + " MB — an Accela report is a few KB.");
    const grid = await readXlsx(await file.arrayBuffer());
    if (!active()) return;
    const t = accelaTable(grid);
    const acc = {
      fileName: file.name,
      errors: t.errors,
      notes: t.notes,
      cases: t.cases,
      caseIx: 0,
      sel: t.cases.length ? t.cases[0].sel : null,
      manualDate: "",
      manualTime: "",
    };
    WriterState.state.acc = acc;
    await accelaFromShare(active);
    if (!active()) return;
    dep_scheduleDraftSave();
    dep_toast(t.errors.length ? "The report could not be imported" : "Report read — review the inspection");
  } catch (err) {
    if (active()) {
      WriterState.state.acc = {
        fileName: file.name,
        errors: ["That file could not be read — " + (err.message || "it is not an Excel .xlsx file") + ". Nothing was imported."],
        cases: [],
      };
      dep_scheduleDraftSave();
    }
  } finally {
    if (serial === WriterState.LOOKUP_SERIAL) {
      WriterState.LOOKUP_BUSY = false;
      if (WriterState.state.screen === "import") dep_render();
    }
  }
}

async function accelaFromShare(isCurrent = () => true) {
  const acc = WriterState.state.acc;
  if (!acc || !acc.cases || !acc.cases.length) return;
  const caseIx = acc.caseIx || 0,
    serial = WriterState.LOOKUP_SERIAL;
  const active = () =>
    isCurrent() &&
    serial === WriterState.LOOKUP_SERIAL &&
    WriterState.state.screen === "import" &&
    WriterState.state.acc === acc &&
    (acc.caseIx || 0) === caseIx;
  if (WriterState.CASEDIR?.helper) {
    try {
      await dep_checkLookupShared(acc, active);
    } catch (e) {
      if (active()) acc.shareError = e.message;
    }
    return;
  }
  if (!WriterState.CASEDIR) return;
  if (WriterState.NEEDGRANT) {
    acc.shareError = "Reconnect the shared case folder before importing.";
    return;
  }
  acc.shareError = "";
  const c = acc.cases[caseIx],
    tail = (" - " + c.number + ".json").toLowerCase();
  const hits = (await dep_listCaseFolder()).filter((f) => f.name.toLowerCase().endsWith(tail));
  if (!active()) return;
  if (hits.length > 1) {
    acc.shareError = "More than one shared file has this case number. Resolve the duplicate records before importing.";
    return;
  }
  const hit = hits[0];
  if (!hit) return;
  try {
    const f = await (await WriterState.CASEDIR.getFileHandle(hit.name)).getFile();
    const text = await f.text();
    if (!active()) return;
    const keep = { screen: WriterState.state.screen, dirty: WriterState.DIRTY, docId: WriterState.state.docId };
    try {
      if (!dep_loadCaseFile(text)) acc.shareError = "The existing case could not be merged. Open the existing record and resolve the conflict.";
    } finally {
      WriterState.state.screen = keep.screen;
      WriterState.DIRTY = keep.dirty;
      WriterState.state.docId = keep.docId;
    }
  } catch (err) {
    if (active()) {
      acc.shareError = "The existing case file could not be read. Reconnect the share and retry.";
      dep_toast(acc.shareError);
    }
  }
}

/* R53: record the Accela status rule on a draft or worksheet. Initial No Occupancy and Abatement statuses use the
   established initial-action document; reinspection worksheets show the status card instead of Choose next action. */
function applyImportRule(target, rule) {
  target.importRule = rule;
  if (target.results) {
    target.followupIntent = rule.choose ? "" : rule.doc;
    return;
  }
  if (rule.doc !== "notice") {
    target.selectionCache = target.selectionCache || {};
    target.special = dep_clone(target.selectionCache[rule.doc] || {});
    target.type = rule.doc;
    target.initialAction = true;
  } else if (target.initialAction) {
    target.type = "notice";
    target.initialAction = false;
  }
}

function baseLookupAccept() {
  const acc = WriterState.state.acc,
    p = dep_accelaPlan(acc);
  // the guard is here, not only on the button
  if (p.blockers.length) {
    dep_toast(p.blockers[0]);
    dep_render();
    return null;
  }
  const c = p.c,
    row = p.row,
    f = p.f;
  let k = p.existing;
  const fields = {
    siteCity: f.siteCity,
    parcel: f.parcel,
    description: f.description,
    owner: f.owner,
    ownerAddr: f.ownerAddr.slice(),
    historic: f.historic,
    historicDistrict: f.historicDistrict,
    landmark: f.landmark,
    date: p.date,
    time: p.time,
    inspectorId: row.inspectorId,
    accela: {
      pulled: dep_nowISO(),
      file: acc.fileName || "",
      ...(acc.source ? { source: dep_clone(acc.source) } : {}),
      inspections: c.rows.map((x) => ({ type: x.type, date: x.date, time: x.time, status: x.status, inspector: x.inspectorName })),
    },
  };
  // the address on file is kept: the case-file name is built from it
  if (k) Object.assign(k, fields);
  else {
    k = { id: dep_uid("k"), number: c.number, address: f.address, ...fields };
    WriterState.CASES.push(k);
  }
  dep_snow.imported(k, row);
  const importRule = row.rule && !row.rule.error ? dep_clone(row.rule) : null;
  if (p.refresh && importRule) {
    WriterState.state.acc = null;
    WriterState.WORK.acc = null;
    applyImportRule(p.refresh, importRule);
    WriterState.DIRTY = true;
    dep_saveDrafts();
    dep_render();
    dep_toast("Accela status refreshed: " + importRule.status + " \u2192 " + importRule.label);
    return k;
  }
  WriterState.state.acc = null;
  WriterState.WORK.acc = null;
  WriterState.DIRTY = true;
  if (p.next === "snow") {
    k.caseType = "snow-10.28";
    dep_newDoc(k.id, "citation");
    const d = dep_doc(WriterState.state.docId);
    d.inspDate = row.date;
    d.inspTime = row.time;
    d.importInspection = dep_inspectionIdentity(row);
    dep_snow.prepare(d);
    dep_citationPricing.refresh(d);
    dep_saveDrafts();
    dep_render();
    return k;
  }
  if (p.next === "reinspect") {
    const open = dep_draftReinspFor(k.id);
    if (open) {
      dep_startReinspection(k.id, row);
      dep_saveDrafts();
      dep_render();
      dep_toast("Case updated — the open worksheet of " + dep_fmtDate(row.date) + " is on screen");
      return k;
    }
    dep_startReinspection(k.id, row);
    const worksheet = dep_draftReinspFor(k.id);
    if (worksheet && importRule) applyImportRule(worksheet, importRule);
    dep_saveDrafts();
    dep_render();
    dep_toast("Reinspection of " + dep_fmtDate(row.date) + " opened from the Accela report");
    return k;
  }
  if (p.next === "notice") {
    const dd = dep_draftDocFor(k.id);
    if (dd) {
      WriterState.state.docId = dd.id;
      WriterState.state.screen = "write";
      dep_saveDrafts();
      dep_render();
      dep_toast("Case updated — its draft is on screen");
      return k;
    }
    dep_newDoc(k.id, "notice");
    const created = dep_doc(WriterState.state.docId);
    if (created) {
      created.importInspection = dep_inspectionIdentity(row);
      if (importRule) applyImportRule(created, importRule);
      dep_saveDrafts();
    }
    return k;
  }
  WriterState.state.screen = "cases";
  dep_saveDrafts();
  dep_render();
  dep_toast("Case " + k.number + " updated from the Accela report");
  return k;
}

function accelaPanel() {
  const acc = WriterState.state.acc,
    p = dep_accelaPlan(acc);
  const cancel = '<button class="btn" id="acc-cancel">Clear import</button>';
  if (acc.errors?.length)
    return (
      '<section class="card acc"><div class="card-h"><h2>Import review</h2></di' +
      'v><div class="card-b">' +
      `${acc.errors.map((e) => `<p class="banner alert">${dep_esc(e)}</p>`).join("")}` +
      "" +
      `${cancel}` +
      "</div></section>"
    );
  const c = p.c,
    k = p.existing;
  if (!c) return "";
  const choices = c.rows.filter((x) => x.selectable && dep_accStatusEligible(x.status, x.type));
  const pick =
    acc.cases.length > 1
      ? '<div class="f"><span>Choose a case from this report</span><div class="ch' +
        'ipbar">' +
        "".concat(
          acc.cases
            .map(
              (x, ix) =>
                '<button class="cchip" data-acccase="' +
                `${ix}` +
                '" aria-pressed="' +
                `${ix === (acc.caseIx || 0)}` +
                '" ' +
                `${WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
                ">" +
                `${dep_esc(x.number)}` +
                "</button>",
            )
            .join(""),
        ) +
        "</div></div>"
      : "";
  const summary = (x) =>
    "<strong>" +
    `${dep_esc(x.type)}` +
    " · " +
    `${dep_fmtDate(x.date)}` +
    "</strong><span>Result: " +
    `${dep_esc(x.status)}` +
    "</span><span>" +
    `${x.time ? dep_esc(dep_fmtTime(x.time)) : "Time not supplied"}` +
    " · " +
    `${dep_esc(x.inspectorName || "Inspector not supplied")}` +
    "</span>";
  const inspections =
    choices.length > 1
      ? '<fieldset class="import-choices"><legend>Choose the inspection result yo' +
        'u are documenting</legend><p class="hint">Several eligible inspection re' +
        "sults are available; choose one to continue.</p>" +
        "".concat(
          choices
            .map(
              (x) =>
                '<button class="import-inspection ' +
                `${x.i === acc.sel ? "is-selected" : ""}` +
                '" data-accsel="' +
                `${x.i}` +
                '" aria-pressed="' +
                `${x.i === acc.sel}` +
                '" ' +
                `${WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
                ">" +
                `${summary(x)}` +
                "<span>" +
                `${x.i === acc.sel ? "Selected" : "Select inspection"}` +
                "</span></button>",
            )
            .join(""),
        ) +
        "</fieldset>"
      : choices.length === 1
        ? `<div class="import-selected">${summary(choices[0])}</div>`
        : "";
  const unfinished = k && (dep_draftDocFor(k.id) || dep_draftReinspFor(k.id) || dep_unissuedVisitFor(k.id));
  const visibleBlockers = p.blockers.filter((b) => !(choices.length > 1 && b === "Choose the inspection result you are documenting."));
  const label = k ? "Import later inspection" : p.next === "snow" ? "Start snow citation" : "Start Official Notice";
  return (
    '<section class="card acc import-review"><div class="card-h"><div><h2>' +
    `${dep_esc(c.number)}` +
    "</h2><p>" +
    `${dep_esc(k?.address || p.f.address)}` +
    '</p></div><span class="pill">' +
    `${k ? "Existing case" : "New case"}` +
    '</span></div><div class="card-b">\n    ' +
    `${pick}` +
    "\n    " +
    "".concat(
      k
        ? '<div class="import-continuity"><h3>Continue existing case</h3><p>' +
            "".concat(unfinished ? "Keep working on the saved draft or worksheet." : "Open the current case and its document history.") +
            ' This does not import these inspection details.</p><button class="btn ' +
            `${unfinished ? "btn-primary" : ""}` +
            '" data-import-workspace="' +
            `${dep_esc(k.id)}` +
            '">Continue existing case</button></div><h3>Import later inspection</h3><' +
            'p class="hint">Use an unused completed inspection to start ' +
            `${p.next === "snow" ? "a snow citation" : "a reinspection worksheet"}` +
            ". Existing issued documents stay unchanged.</p>"
        : "",
    ) +
    "\n    " +
    `${inspections}` +
    "\n    " +
    "".concat(
      p.needDate
        ? '<div class="grid g2"><label class="f"><span>Initial inspection date</spa' +
            'n><input type="date" id="acc-date" value="' +
            `${dep_esc(acc.manualDate || "")}` +
            '"></label><label class="f"><span>Initial inspection time</span><input ty' +
            'pe="time" id="acc-time" value="' +
            `${dep_esc(acc.manualTime || "")}` +
            '"></label></div>'
        : "",
    ) +
    "\n    " +
    `${p.warnings.map((w) => `<p class="banner warn">${dep_esc(w)}</p>`).join("")}` +
    "\n    " +
    "".concat(
      visibleBlockers.length
        ? '<div class="banner alert"><div><strong>' +
            `${dep_esc(visibleBlockers[0])}` +
            "</strong>" +
            "".concat(
              visibleBlockers.length > 1
                ? `<ul>${visibleBlockers
                    .slice(1)
                    .map((b) => `<li>${dep_esc(b)}</li>`)
                    .join("")}</ul>`
                : "",
            ) +
            "</div></div>"
        : "",
    ) +
    "\n    " +
    "".concat(acc.shareError ? '<button class="btn" id="lookup-recheck">Check shared record and retry</button>' : "") +
    "\n    " +
    "".concat(
      k && p.diff.length
        ? '<details class="import-changes"><summary>Case detail changes (' +
            `${p.diff.length}` +
            ")</summary><dl>" +
            "".concat(
              p.diff
                .map(
                  (x) =>
                    "<dt>" +
                    `${dep_esc(x.l)}` +
                    "</dt><dd><span>On file: " +
                    `${dep_esc(x.was || "Not supplied")}` +
                    "</span><strong>After import: " +
                    `${dep_esc(x.now || "Not supplied")}` +
                    "</strong></dd>",
                )
                .join(""),
            ) +
            "</dl></details>"
        : "",
    ) +
    '\n    <details class="import-source"><summary>Source and import details</' +
    "summary><p>" +
    `${dep_esc(acc.fileName || "SSRS Excel report")}` +
    "</p>" +
    "".concat(
      acc.source?.kind === "sql"
        ? "<p>Retrieved " +
            `${dep_esc(new Date(acc.source.retrievedAt).toLocaleString())}` +
            ". This is a saved snapshot; use Find case again to refresh it.</p>"
        : "",
    ) +
    "" +
    `${(p.notes || []).map((n) => `<p>${dep_esc(n)}</p>`).join("")}` +
    "<p>Completed, Official Notice, Citation and Compliance results are avail" +
    "able. Scheduled, Pending, Assist and unknown statuses cannot be imported" +
    ". Blank inspection times stay blank until explicitly corrected.</p></det" +
    'ails>\n    <p class="hint">Case details change only when you confirm. Sav' +
    "e and continue later keeps this review on this device when saving succee" +
    'ds.</p>\n    <div class="acc-go"><button class="btn ' +
    `${unfinished ? "" : "btn-primary"}` +
    '" id="acc-go" ' +
    `${p.blockers.length || WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
    ">" +
    `${label}` +
    "</button>" +
    `${cancel}` +
    "</div>\n  </div></section>"
  );
}

function pickAccelaFile() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  inp.onchange = () => {
    const file = inp.files && inp.files[0];
    if (file) readAccelaFile(file);
  };
  inp.click();
}

function screenImport() {
  const caseTypeChoice =
    '<label class="f no-print"><span>Case workflow for a new case</span><sele' +
    'ct id="new-case-type"><option value="">Standard code violation</option><' +
    'option value="snow-10.28" ' +
    (WriterState.WORK.entry?.["new-case-type"] === "snow-10.28" ? "selected" : "") +
    ">Snow removal (MGO 10.28)</option></select></label>";
  return dep_shell(
    "Import Inspection Result",
    "Bring in case details",
    '<button class="btn" id="btn-savework">Save &amp; continue later</button>',
    '<div style="max-width:980px">\n      ' +
      `${dep_lookupCard()}` +
      "\n      " +
      `${WriterState.state.acc ? accelaPanel() : ""}` +
      '\n      <details class="card import-alternative"><summary>Import an SSRS ' +
      'Excel report instead</summary><div class="card-b"><div class="acc-drop" ' +
      'id="acc-drop"><p>Load or drop the Accela case report exported as .xlsx.<' +
      '/p><button class="btn" id="acc-pick" ' +
      `${WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
      ">Load Accela report</button></div></div></details>\n      <details class=" +
      '"import-workflow"><summary>New-case workflow</summary>' +
      `${caseTypeChoice}` +
      '<p class="hint">Snow Removal records select the snow workflow automatica' +
      "lly. Use this setting only when the source does not identify the workflo" +
      "w.</p></details>\n      </div>",
  );
}

function screenLibrary() {
  return languageScreen(app_languagediscoveryContext());
}

function priorCitations(caseId, no) {
  let n = 0;
  const now = new Date(dep_recordDay(today) + "T12:00:00"),
    cutoff = dep_iso(
      new Date(now.getFullYear() - 1, now.getMonth(), Math.min(now.getDate(), new Date(now.getFullYear() - 1, now.getMonth() + 1, 0).getDate()), 12),
    );
  dep_docsFor(caseId).forEach((x) => {
    if (x.draft || x.void || x.superseded || x.type !== "citation") return;
    const date = (x.revision && (x.revision.actionDate || x.revision.originalIssued)) || x.mailed || dep_recordDay(x.issuedAt);
    if (!dep_validISO(date) || date < cutoff || date > dep_recordDay(today)) return;
    if (x.items.some((i) => String(i.no) === String(no) && i.cite && !i.withdrawn)) n++;
  });
  return n;
}

export {
  walkIdentity,
  clearWalk,
  restoreWalkFor,
  ensureWalkContext,
  nextWalkItem,
  focusWalkItem,
  focusWalkDetails,
  walkItemReady,
  advanceWalk,
  skipWalkDetails,
  returnWalkDetails,
  previousWalk,
  editableWalkItem,
  recordReinspectionOutcome,
  undoWalkOutcome,
  narrativeFor,
  uiIcon,
  caseState,
  screenCases,
  accInflate,
  accUnzip,
  readXlsx,
  accSerial,
  accWhen,
  accParcel,
  accelaTable,
  baseLookupPlan,
  readAccelaFile,
  accelaFromShare,
  baseLookupAccept,
  accelaPanel,
  pickAccelaFile,
  screenImport,
  screenLibrary,
  priorCitations,
};
