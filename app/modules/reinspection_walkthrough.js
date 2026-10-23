import { recordDay } from "../assets/shared.js";
import { fmtDate, fmtTime, inspAt, parseDate, parseTime, toast, validISO } from "./court_and_deposits.js";
import { caseFileName, caseNumberAllowed, loadCaseFile, shell, sourceDocFor, stableJSON } from "./workspace_shell.js";
import { listCaseFolder, saveDrafts, scheduleDraftSave, startReinspection } from "./case_files.js";
import { importResumePanel, workingNotesPanel } from "./issuance_and_corrections.js";
import { recoveryStatusHTML, unissuedVisitFor } from "./draft_recovery.js";
import { caseSearchText, saveWorkflowPrefs } from "./language_catalog.js";
import {
  independentArtifact,
  inspectionIdentity,
  inspectionUsed,
  sameInspection,
  pdfTransferState,
  remindersPanel,
  workspaceTasks,
} from "./case_timeline.js";
import { accelaPlan, cancelCaseLookup, checkLookupShared, dueCheck, lookupCard, newDoc, render, renderKeep } from "./inspection_import.js";
import {
  clearProhibitedCitations,
  ACC_CASEFIELDS,
  ACC_COLS,
  ACC_EXPANDED_MAX,
  ACC_LABEL,
  ACC_MAX,
  ACC_REQUIRED,
  ACC_STATUS,
  DOC_TYPES,
  OUTCOMES,
  STATUS_OF,
  accAll,
  accColIx,
  accInspector,
  accKids,
  accNorm,
  accStatusEligible,
  inspectionKind,
  statusRule,
  accStr,
  accText,
  accTime,
  accXml,
  addDays,
  citationPricing,
  clone,
  daysBetween,
  doc,
  docCase,
  docsFor,
  doneItems,
  draftDocFor,
  draftReinspFor,
  effectiveFiled,
  esc,
  insp,
  isHistoryDoc,
  iso,
  kase,
  nowISO,
  ocOf,
  originalNotice,
  reinsp,
  snow,
  uid,
  unchecked,
} from "./app_core.js";
import { app_languagediscoveryContext, app_workspacequeueContext } from "./app_view_contexts.js";
import { INSPECTORS } from "./data/inspectors.js";
import { activeRestrictions } from "./new_documents.js";
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
  const r = WriterState.state.screen === "reinspect" && reinsp(WriterState.state.reinspId);
  if (!r || !r.draft || r.docId || WriterState.state.riWalkContext !== walkIdentity(r)) {
    clearWalk();
    return false;
  }
  const src = doc(r.sourceDocId);
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
  const src = r && doc(r.sourceDocId);
  return (src && src.items.find((it) => !it.withdrawn && !(r.results[it.id] || {}).carried && !ocOf(r, it.id))) || null;
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
  const source = doc(r.sourceDocId),
    on = result.manualDate ? result.on : result.on || r.date;
  if (!result.oc || !validISO(on) || on < docCase(source).date || on > r.date) return false;
  if (result.oc === "corrected") return true;
  return !["extension", "citation"].includes(intent) || dueCheck(result.due, r.date).ok;
}

function advanceWalk(r) {
  if (!WriterState.state.riWalk || !ensureWalkContext()) return false;
  if (
    WriterState.state.riWalkStage === "details" &&
    WriterState.state.riWalkItem &&
    !walkItemReady(r, WriterState.state.riWalkItem) &&
    !WriterState.state.riWalkSkipped.includes(WriterState.state.riWalkItem)
  ) {
    toast("This item needs a valid date and, for an extension or citation, a new due date. Use Skip for now to continue.");
    focusWalkDetails();
    return false;
  }
  const next = nextWalkItem(r);
  WriterState.state.riWalkItem = next?.id || null;
  WriterState.state.riWalkStage = "outcome";
  scheduleDraftSave();
  render();
  focusWalkItem();
  return true;
}

function skipWalkDetails(r) {
  if (!WriterState.state.riWalk || !ensureWalkContext() || WriterState.state.riWalkStage !== "details") return false;
  if (!WriterState.state.riWalkSkipped.includes(WriterState.state.riWalkItem)) WriterState.state.riWalkSkipped.push(WriterState.state.riWalkItem);
  scheduleDraftSave();
  return advanceWalk(r);
}

function returnWalkDetails(r) {
  if (!WriterState.state.riWalk || !ensureWalkContext()) return false;
  const src = doc(r.sourceDocId),
    item = src.items.find((it) => editableWalkItem(r, it.id) && (!walkItemReady(r, it.id) || WriterState.state.riWalkSkipped.includes(it.id)));
  if (!item) return false;
  WriterState.state.riWalkItem = item.id;
  WriterState.state.riWalkStage = ocOf(r, item.id) ? "details" : "outcome";
  WriterState.state.riWalkSkipped = WriterState.state.riWalkSkipped.filter((id) => id !== item.id);
  scheduleDraftSave();
  render();
  WriterState.state.riWalkStage === "details" ? focusWalkDetails() : focusWalkItem();
  return true;
}

function previousWalk(r) {
  if (!WriterState.state.riWalk || !ensureWalkContext()) return false;
  const src = doc(r.sourceDocId),
    eligible = src.items.filter((i) => editableWalkItem(r, i.id));
  const ix = eligible.findIndex((i) => i.id === WriterState.state.riWalkItem),
    prior = eligible[ix < 0 ? eligible.length - 1 : ix - 1];
  if (!prior) return false;
  WriterState.state.riWalkItem = prior.id;
  WriterState.state.riWalkStage = ocOf(r, prior.id) ? "details" : "outcome";
  scheduleDraftSave();
  render();
  WriterState.state.riWalkStage === "details" ? focusWalkDetails() : focusWalkItem();
  return true;
}

function editableWalkItem(r, id) {
  const src = r && doc(r.sourceDocId),
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
  const r = reinsp(WriterState.state.reinspId);
  if (!editableWalkItem(r, id) || !OUTCOMES.some((o) => o.id === outcome)) return false;
  if (WriterState.state.riWalk && (!ensureWalkContext() || !WriterState.state.riWalk)) return false;
  const cur = r.results[id] || {};
  if (cur.oc === outcome) return false;
  const before = Object.prototype.hasOwnProperty.call(r.results, id) ? clone(cur) : null;
  const result = {
    oc: outcome,
    on: cur.on || r.date,
    manualDate: !!cur.manualDate,
    due: outcome === "corrected" ? "" : cur.due || "",
    note: cur.note || "",
    cite: outcome === "corrected" ? false : !!cur.cite,
  };
  if (WriterState.state.riWalk) WriterState.state.riWalkUndo = { context: walkIdentity(r), itemId: id, before, after: clone(result) };
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
  scheduleDraftSave();
  if (WriterState.state.riWalk) {
    render();
    WriterState.state.riWalkStage === "details" ? focusWalkDetails() : focusWalkItem();
  } else renderKeep();
  return true;
}

function undoWalkOutcome() {
  const r = reinsp(WriterState.state.reinspId),
    undo = WriterState.state.riWalkUndo;
  if (!WriterState.state.riWalk || !ensureWalkContext() || !undo || undo.context !== walkIdentity(r) || !editableWalkItem(r, undo.itemId))
    return false;
  const current = r.results[undo.itemId];
  if (!current || current.oc !== undo.after.oc) {
    toast("The outcome changed since Undo was recorded. Review the item before changing it.");
    return false;
  }
  if (stableJSON(current) === stableJSON(undo.after)) {
    if (undo.before) r.results[undo.itemId] = clone(undo.before);
    else delete r.results[undo.itemId];
  } else {
    r.results[undo.itemId] = { ...clone(current), oc: undo.before?.oc || "" };
    toast("Outcome undone; later note, date and due details were kept on this item.");
  }
  WriterState.state.riWalkUndo = null;
  WriterState.state.riWalkItem = undo.itemId;
  WriterState.state.riWalkStage = "outcome";
  WriterState.DIRTY = true;
  scheduleDraftSave();
  render();
  focusWalkItem();
  return true;
}

function narrativeFor(r, it) {
  const k = kase(r.caseId),
    src = doc(r.sourceDocId),
    oc = ocOf(r, it.id),
    res = r.results[it.id] || {};
  const first = originalNotice(r.caseId),
    firstDate = (first && k.date) || k.date || (first || {}).created;
  const what = String(it.title || "the violation").replace(/\.$/, "");
  const label = (DOC_TYPES.find((t) => t.id === (src || {}).type) || {}).label || "notice";
  const art = /^[AEIOU]/i.test(label) ? "An " : "A ";
  return (
    "Initial inspection on " +
    fmtDate(firstDate) +
    " documented the following violation: " +
    what +
    ". " +
    art +
    label.toLowerCase() +
    " was issued with a compliance date of " +
    fmtDate(it.due) +
    ". " +
    "Re-inspection on " +
    fmtDate(res.on || r.date) +
    " found " +
    ((OUTCOMES.find((o) => o.id === oc) || {}).found || "the violation uncorrected") +
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
  const current = sourceDocFor(k.id),
    draft = draftDocFor(k.id),
    visit = draftReinspFor(k.id) || unissuedVisitFor(k.id),
    last = docsFor(k.id).find((d) => !d.draft && !d.superseded);
  const live = docsFor(k.id).filter((d) => !d.draft && !d.void && !d.superseded);
  const withdrawn = !!current && current.items.length > 0 && current.items.every((i) => i.withdrawn);
  const restrictions = activeRestrictions(live),
    vacancy = live.find((d) => d.type === "vacancyExtension"),
    reviewDue = vacancy?.special?.reviewDate || "";
  const closed = snow.isCase(k)
    ? !!current && !!current.filedAt && current.frozen?.snowCloseOnFiling !== false
    : !restrictions.length && (withdrawn || (!!current && current.type === "compliance") || (!current && !!last && !!last.void));
  const dates =
    current && !isHistoryDoc(current)
      ? (current.items || [])
          .filter((i) => !i.done && !i.withdrawn && validISO(i.due))
          .map((i) => i.due)
          .sort()
      : [];
  const due = dates[0] || "",
    days = due ? daysBetween(recordDay(today), due) : null;
  const late = !closed && !!due && due < recordDay(today),
    soon = !closed && !!due && !late && days >= 0 && days <= 7;
  const pendingRecord = Object.values(WriterState.RECORD_ATTEMPTS).find((x) => x.cid === k.id) || null;
  const pendingDoc = docsFor(k.id).find((d) => d.pendingAmendment) || null;
  const pendingSync = WriterState.PENDING.some((p) => p.cid === k.id || (!!caseFileName(k) && p.name === caseFileName(k)));
  const filingDoc = live.find((d) => independentArtifact(d) && !effectiveFiled(d)) || null;
  const artifactIssue = live.find((d) => ["artifact conflict", "missing or unavailable"].includes(pdfTransferState(d))) || null;
  const numberIssue = !caseNumberAllowed(k);
  const attention = !!(
    restrictions.length ||
    (reviewDue && reviewDue <= addDays(recordDay(today), 7)) ||
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
      snow.isCase(k) && current
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
                      ? STATUS_OF[current.type] || "Issued"
                      : last?.special?.mode === "release"
                        ? "Restriction released"
                        : last
                          ? STATUS_OF[last.type] || "Issued"
                          : "Ready to start",
  };
}

/* R59: after an issuance Workspace opens on a view that lists the case. The current view, search and inspector
   filter are kept when they already show it; only a filter that would hide it is relaxed (view to All cases,
   search or inspector cleared). The row stays highlighted until the next navigation away from Workspace. */
function revealIssuedCase(cid) {
  const s = WriterState.state,
    rows = WriterState.CASES.map((k) => ({ k, st: caseState(k) })),
    row = workspaceQueue(rows, workspaceTasks(rows), app_workspacequeueContext()).find((r) => r.k.id === cid);
  if (!row) return false;
  const before = [s.caseFilter, s.caseQ, s.caseInspector].join("|"),
    query = String(s.caseQ || "")
      .toLowerCase()
      .trim();
  if (!queueMatches(row, s.caseFilter)) s.caseFilter = "all";
  if (query && !caseSearchText(row.k).includes(query)) s.caseQ = "";
  if (s.caseInspector && row.k.inspectorId !== s.caseInspector) s.caseInspector = "";
  s.metric = "";
  s.modal = null;
  s.picker = false;
  s.screen = "cases";
  s.issuedCase = cid;
  if ([s.caseFilter, s.caseQ, s.caseInspector].join("|") !== before) saveWorkflowPrefs();
  return true;
}

function focusIssuedCase(cid) {
  const row = [...document.querySelectorAll("tr[data-issued-highlight]")].find((el) => el.dataset.queueCase === cid);
  if (!row) return;
  row.scrollIntoView?.({ block: "center" });
  row.focus({ preventScroll: true });
}

function screenCases() {
  const rows = WriterState.CASES.map((k) => ({ k, st: caseState(k) })),
    tasks = workspaceTasks(rows);
  // Retire legacy metric selection into the workspace views.
  if (WriterState.state.metric) {
    WriterState.state.caseFilter =
      { drafts: "continue", overdue: "overdue", soon: "soon", open: "open", imports: "all" }[WriterState.state.metric] || "resolution";
    WriterState.state.metric = "";
  }
  const queue = workspaceQueue(rows, tasks, app_workspacequeueContext()),
    query = String(WriterState.state.caseQ || "")
      .toLowerCase()
      .trim();
  // Quick views are the primary filter; More views holds the additional states.
  const quickViews = [
      ["attention", "Needs attention"],
      ["continue", "Continue work"],
      ["deadlines", "Deadlines"],
      ["resolution", "Needs resolution"],
      ["all", "All cases"],
    ],
    moreViews = [
      ["soon", "Due within 7 days"],
      ["overdue", "Past due"],
      ["open", "Open"],
      ["closed", "Closed"],
    ],
    views = [...quickViews, ...moreViews];
  if (WriterState.state.caseFilter === "drafts") WriterState.state.caseFilter = "continue";
  if (!views.some(([key]) => key === WriterState.state.caseFilter)) WriterState.state.caseFilter = "attention";
  const count = (filter) => queue.filter((row) => queueMatches(row, filter)).length;
  const filtered = queue.filter(
    (row) =>
      queueMatches(row, WriterState.state.caseFilter) &&
      (!query || caseSearchText(row.k).includes(query)) &&
      (!WriterState.state.caseInspector || row.k.inspectorId === WriterState.state.caseInspector),
  );
  const table = filtered
    .map((row) => {
      const { k, st, proof } = row,
        documents = docsFor(k.id);
      const secondary = row.facts.filter((t) => !["open", "drafts"].includes(t.key));
      const detailActions = secondary
        .map(
          (t) =>
            '<div class="queue-detail-task"><span>' +
            `${esc(t.label)}` +
            '</span><button class="btn btn-sm" ' +
            `${t.action}` +
            ">Review</button></div>",
        )
        .join("");
      const issued = WriterState.state.issuedCase === k.id;
      return (
        '<tr data-queue-case="' +
        `${esc(k.id)}` +
        '"' +
        (issued ? ' data-issued-highlight aria-current="true" class="check-focus" tabindex="-1"' : "") +
        '><td><div class="addr">' +
        `${esc(k.address)}` +
        '</div><div class="mono">' +
        `${esc(k.number)}` +
        '</div>\n      <details class="queue-details"><summary>Case details &amp; ' +
        "history" +
        `${secondary.length ? " · " + secondary.length + " task" + (secondary.length === 1 ? "" : "s") : ""}` +
        '</summary><div class="doclinks"><p>' +
        `${esc(k.owner)}` +
        "</p>" +
        `${detailActions}` +
        "\n      " +
        "".concat(
          !caseNumberAllowed(k) ? '<p class="save-error">Case number needs correction. Open the document and use its case details checks.</p>' : "",
        ) +
        "\n      <p>Record verification: " +
        `${esc(proof.label)}` +
        "</p>" +
        "".concat(
          proof.valid === false
            ? "<p>" +
                `${esc(proof.eventId || "")}` +
                " · " +
                `${esc(proof.lastGoodCommitTime || "Last good commit unavailable")}` +
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
                `${esc(d.id)}` +
                '" class="' +
                `${d.void ? "voidlink" : d.draft ? "" : "fin"}` +
                '">' +
                `${d.void ? "VOID · " : d.superseded ? "REPLACED · " : d.revision ? "REV " + d.revision.number + " · " : ""}` +
                "" +
                `${esc((DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type)}` +
                " <span>" +
                `${fmtDate(d.mailed || d.created)}` +
                "" +
                `${d.draft ? " · Draft" : ""}` +
                "</span></button>",
            )
            .join(""),
        ) +
        '\n      <button data-exportcase="' +
        `${esc(k.id)}` +
        '">Download case record</button><button data-timeline="' +
        `${esc(k.id)}` +
        '">Case timeline</button>\n      ' +
        "".concat(
          st.visit?.draft
            ? `<button data-discardri="${esc(st.visit.id)}">Discard reinspection draft</button>`
            : st.draft
              ? `<button data-discard="${esc(st.draft.id)}">Discard document draft</button>`
              : "",
        ) +
        '\n      <button data-rmcase="' +
        `${esc(k.id)}` +
        '">Remove from this workspace</button></div></details></td>\n      <td><span class="pil' +
        "l " +
        `${row.resolution ? "late" : st.closed ? "closed" : row.continuing ? "draft" : "open"}` +
        '">' +
        `${esc(row.resolution && !row.continuing ? "Needs resolution" : st.label)}` +
        '</span><p class="queue-reason">' +
        `${esc(row.reason)}` +
        "</p>" +
        "".concat(row.continuing && row.resolution ? '<span class="queue-secondary">Also needs resolution · see case details</span>' : "") +
        "" +
        "".concat(
          st.visit
            ? '<span class="muted">' + `${doneItems(st.visit).length}` + " corrected, " + `${unchecked(st.visit).length}` + " still to result</span>"
            : "",
        ) +
        "</td>\n      <td>" +
        "".concat(
          st.due && !st.closed
            ? '<span class="' +
                `${st.late ? "pill late" : st.soon ? "case-date-soon" : "mono"}` +
                '">' +
                `${fmtDate(st.due)}` +
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
        `${esc(insp(k.inspectorId).name)}` +
        '</td><td><div class="case-next"><button class="btn btn-sm btn-primary qu' +
        'eue-primary" ' +
        `${row.action}` +
        ">" +
        `${esc(row.label)}` +
        "</button></div></td></tr>"
      );
    })
    .join("");
  const importCount = tasks.find((t) => t.key === "imports").count;
  // Pending operations without a loaded case must remain reachable.
  const orphan = WriterState.PENDING.filter((p) => !WriterState.CASES.some((k) => k.id === p.cid || caseFileName(k) === p.name));
  const activeLabel = views.find(([key]) => key === WriterState.state.caseFilter)[1];
  return shell(
    "Your workspace",
    "Building Inspection",
    "",
    '<section class="card workspace-start" aria-labelledby="workspace-start-title"><div class="card-h"><h2 id="workspace-start-title">Start or find case work</h2></div><div class="card-b grid g2">' +
      '<div><button class="btn btn-primary" data-nav="import">' +
      uiIcon("import") +
      ' Import inspection</button><p class="hint">Start new work from an unused Accela inspection.</p></div>' +
      '<div><button class="btn" data-global-search>' +
      uiIcon("search") +
      ' Search shared case records</button><p class="hint">Find an existing case by number, address, owner, citation or parcel.</p></div></div></section>' +
      `${importResumePanel()}` +
      "" +
      "".concat(WriterState.PREFLIGHT_NOTICE ? `<div class="banner info" role="status">${esc(WriterState.PREFLIGHT_NOTICE)}</div>` : "") +
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
                quickViews
                  .map(
                    ([key, label]) =>
                      '<button class="btn queue-summary-button" data-queue-view="' +
                      `${key}` +
                      '" aria-pressed="' +
                      `${WriterState.state.caseFilter === key}` +
                      '"' +
                      `${key === "resolution" ? ' aria-describedby="queue-resolution-desc" title="Unconfirmed or queued saves, PDF filing and transfers, record problems and other blockers"' : ""}` +
                      "><span>" +
                      `${label}` +
                      "</span><strong>" +
                      `${count(key)}` +
                      "</strong></button>",
                  )
                  .join(""),
              ) +
              '</div><p class="hint queue-view-note"><span id="queue-resolution-desc">Needs resolution lists cases with unconfirmed or queued saves, PDF ' +
              "filing and transfers, record problems and other blockers.</span> Device save and connection problems appear in the Saved work &amp; " +
              "connection banner.</p>"
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
              'is saved on this device. Use the actions above to start or find case work.</p><button class="btn" data-openfil' +
              "e>Open saved case</button></div>"
          : '<div class="case-tools"><label><span class="sr-only">Search this workspa' +
              'ce</span><input type="search" id="case-search" value="' +
              `${esc(WriterState.state.caseQ)}` +
              '" placeholder="Search this workspace…"></label>\n      <label class="case' +
              '-view"><span class="sr-only">More views</span><select id="case-filter" aria-label="More views"' +
              ">" +
              `<option value="" ${moreViews.some(([key]) => key === WriterState.state.caseFilter) ? "" : "selected"}>More views…</option>` +
              "".concat(
                moreViews
                  .map(
                    ([key, label]) =>
                      `<option value="${key}" ${WriterState.state.caseFilter === key ? "selected" : ""}>${label} (${count(key)})</option>`,
                  )
                  .join(""),
              ) +
              '</select></label>\n      <select id="case-inspector" aria-label="Filter b' +
              'y inspector"><option value="">All inspectors</option>' +
              "".concat(
                INSPECTORS.filter((i) => WriterState.CASES.some((k) => k.inspectorId === i.id))
                  .map(
                    (i) =>
                      '<option value="' +
                      `${esc(i.id)}` +
                      '" ' +
                      `${WriterState.state.caseInspector === i.id ? "selected" : ""}` +
                      ">" +
                      `${esc(i.name)}` +
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
              `${esc(activeLabel)}` +
              " · workspace cases and recommended actions</caption><thead><tr><th scope" +
              '="col">Property / case</th><th scope="col">Status / next step</th><th sc' +
              'ope="col">Next due</th><th scope="col">Inspector</th><th scope="col">Nex' +
              "t action</th></tr></thead><tbody>" +
              "".concat(
                table ||
                  '<tr><td colspan="5"><div class="empty">' +
                    `${query || WriterState.state.caseInspector ? "No cases match these filters." : "No cases in this view."}` +
                    ' <button class="lnk" data-queue-reset>Clear search and inspector</button' +
                    '> <button class="lnk" id="case-showall">View all cases</button>' +
                    // The shared search opens with this workspace query prefilled; it is not submitted automatically.
                    "".concat(
                      query
                        ? ' <button class="btn btn-sm" data-shared-offer>Search shared case records for “' +
                            esc(String(WriterState.state.caseQ || "").trim()) +
                            "”</button>"
                        : "",
                    ) +
                    "</div></td></tr>",
              ) +
              '</tbody></table></div><div class="case-count">' +
              `${WriterState.CASES.length}` +
              " cases on this device. Use Search shared case records for records outsid" +
              "e this workspace." +
              `${importCount ? " An import is waiting for review above." : ""}` +
              "</div>",
      ) +
      '</div>\n     <div class="queue-support"><button class="btn btn-sm" data-s' +
      'ync-safety>Saved work &amp; connection</button><div id="recovery-status"' +
      ' class="hint" aria-live="polite">' +
      `${recoveryStatusHTML()}` +
      "</div>" +
      `${WriterState.CASES.length ? '<button class="lnk" id="btn-clear">Remove cases from this workspace</button>' : ""}` +
      "</div>\n     " +
      `${remindersPanel()}` +
      "" +
      `${workingNotesPanel()}` +
      "",
  );
}

async function accInflate(bytes, limit = ACC_EXPANDED_MAX) {
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
    if (usize > ACC_EXPANDED_MAX - total) fail("The expanded workbook is too large. Export a report for one case.");
    if (lho + 30 > u8.length || dv.getUint32(lho, true) !== 0x04034b50) fail("the file is incomplete or damaged");
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    if (start + csize > u8.length) fail("the file is incomplete or damaged");
    const raw = u8.subarray(start, start + csize);
    let bytes;
    if (method === 0) bytes = raw;
    else if (method === 8) {
      try {
        bytes = await accInflate(raw, ACC_EXPANDED_MAX - total);
      } catch (err) {
        fail(/expanded workbook/.test(err.message) ? err.message : "the file is incomplete or damaged");
      }
    } else fail("the file uses a compression this program cannot read");
    total += bytes.length;
    if (total > ACC_EXPANDED_MAX) fail("The expanded workbook is too large. Export a report for one case.");
    out[name] = dec.decode(bytes);
  }
  return out;
}

async function readXlsx(buf) {
  const files = await accUnzip(buf, (n) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/i.test(n));
  const key = (n) => Object.keys(files).find((k) => k.toLowerCase() === n.toLowerCase());
  if (!key("xl/workbook.xml")) throw new Error("it is not an Excel workbook");
  const wb = accXml(files[key("xl/workbook.xml")]);
  if (accAll(wb, "workbookPr").some((p) => /^(1|true)$/i.test(p.getAttribute("date1904") || "")))
    throw new Error("This workbook uses the 1904 date system. Export the SSRS report again using the standard 1900 date system.");
  const sheet = accAll(wb, "sheet")[0];
  if (!sheet) throw new Error("the workbook has no sheets");
  let rid = "";
  Array.prototype.forEach.call(sheet.attributes, (a) => {
    if (a.localName === "id" && a.name !== "sheetId") rid = a.value;
  });
  let target = "";
  if (key("xl/_rels/workbook.xml.rels")) {
    const rel = accAll(accXml(files[key("xl/_rels/workbook.xml.rels")]), "Relationship").find((r) => r.getAttribute("Id") === rid);
    if (rel) target = rel.getAttribute("Target") || "";
  }
  let path = target.charAt(0) === "/" ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
  if (!target || !key(path))
    path =
      Object.keys(files)
        .filter((n) => /^xl\/worksheets\//i.test(n))
        .sort()[0] || "";
  if (!path || !key(path)) throw new Error("the workbook has no readable sheet");
  const sst = key("xl/sharedStrings.xml") ? accAll(accXml(files[key("xl/sharedStrings.xml")]), "si").map(accText) : [];
  const ws = accXml(files[key(path)]);
  const rows = [];
  accAll(ws, "row").forEach((rw) => {
    const row = [];
    let next = 0;
    accKids(rw, "c").forEach((c) => {
      const r = c.getAttribute("r"),
        ix = r ? accColIx(r) : next;
      next = ix + 1;
      const t = c.getAttribute("t") || "",
        v = accKids(c, "v")[0],
        vt = v ? v.textContent : "";
      let val;
      if (t === "s") val = sst[+vt] !== undefined ? sst[+vt] : "";
      else if (t === "inlineStr") {
        const is = accKids(c, "is")[0];
        val = is ? accText(is) : "";
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
  return { date: iso(new Date(Date.UTC(1899, 11, 30 + days, 12))), mins: mins };
}

function accWhen(dv, tv) {
  let date = null;
  // R36: the Inspection Time column is authoritative. Any time carried in the date column is ignored, with no comparison warning.
  const s = accSerial(dv);
  if (s) date = s.date;
  else if (accStr(dv)) date = parseDate(accStr(dv).split(/[\sT]+/)[0]);
  const textTime = accStr(tv) || typeof tv === "number" ? accTime(tv) : null;
  return { date: date, time: textTime || "", warn: "" };
}

function accParcel(v) {
  const raw = accStr(v);
  if (/^\d{12}$/.test(raw)) return { v: raw.slice(0, 4) + "-" + raw.slice(4, 7) + "-" + raw.slice(7, 11) + "-" + raw.slice(11), warn: "" };
  if (/^\d{4}-\d{3}-\d{4}-\d$/.test(raw)) return { v: raw, warn: "" };
  return { v: raw, warn: raw ? "Parcel number " + raw + " is not 12 digits — imported as delivered" : "" };
}

function accelaTable(grid) {
  const res = { cases: [], errors: [], notes: [], excluded: { scheduled: 0, assist: 0 } };
  const known = Object.keys(ACC_COLS).map((k) => ACC_COLS[k]);
  const hr = grid.findIndex((r) => r && r.some((v) => accNorm(v) === "case number") && r.filter((v) => known.indexOf(accNorm(v)) >= 0).length >= 4);
  if (hr < 0) {
    res.errors.push("No Accela report table was found — the file has no Case Number header row");
    return res;
  }
  const col = {};
  grid[hr].forEach((v, ix) => {
    let h = accNorm(v);
    if (h === "case type name" || h === "casetype" || h === "casetypename") h = "case type";
    if (!h) return;
    const k = Object.keys(ACC_COLS).find((k) => ACC_COLS[k] === h);
    if (k) {
      if (col[k] === undefined) col[k] = ix;
    } else res.notes.push('Column "' + accStr(v) + '" is not part of the Accela report and was ignored');
  });
  const miss = ACC_REQUIRED.filter((k) => col[k] === undefined);
  if (miss.length) {
    res.errors.push(
      "The report is missing the column" + (miss.length === 1 ? "" : "s") + " " + miss.map(ACC_LABEL).join(", ") + " — nothing was imported",
    );
    return res;
  }
  Object.keys(ACC_COLS)
    .filter(
      (k) => ACC_REQUIRED.indexOf(k) < 0 && k !== "detail" && k !== "zoning" && k !== "caseType" && k !== "recordCategory" && col[k] === undefined,
    )
    .forEach((k) => res.notes.push("The report has no " + ACC_LABEL(k) + " column"));
  const get = (r, k) => (col[k] === undefined ? "" : r[col[k]]);
  const by = {};
  grid.slice(hr + 1).forEach((r) => {
    if (!r) return;
    const num = accStr(get(r, "number"));
    if (!num) return;
    if (/^scheduled$/i.test(accStr(get(r, "status")))) {
      res.excluded.scheduled++;
      return;
    }
    if (/^assist$/i.test(accStr(get(r, "type")))) {
      res.excluded.assist++;
      return;
    } // Excluded from selection and retained import history.
    let c = by[num];
    if (!c) {
      c = by[num] = { number: num, raw: {}, conflicts: [], rows: [] };
      res.cases.push(c);
      ACC_CASEFIELDS.forEach((f) => {
        c.raw[f] = accStr(get(r, f));
      });
    } else
      ACC_CASEFIELDS.forEach((f) => {
        const v = accStr(get(r, f));
        if (v !== c.raw[f] && !c.conflicts.some((x) => x.f === f)) c.conflicts.push({ f: f, a: c.raw[f], b: v });
      });
    const w = accWhen(get(r, "date"), get(r, "time"));
    const type = accStr(get(r, "type")),
      status = accStr(get(r, "status"));
    const kind = inspectionKind(type),
      tk = kind || "other",
      rule = statusRule(type, status);
    const st = ACC_STATUS[accNorm(status)];
    const name = accStr(get(r, "inspector")),
      ins = accInspector(name);
    const row = {
      caseType: accStr(get(r, "caseType")),
      recordCategory: accStr(get(r, "recordCategory")),
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
    const done = c.rows.filter((r) => r.selectable && accStatusEligible(r.status, r.type));
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
    p.blockers.push("The report gives two different values for " + ACC_LABEL(x.f) + ' on this case: "' + x.a + '" and "' + x.b + '"'),
  );
  if (!p.f.address) p.blockers.push("The report has no site address for this case");
  if (!/^CB\d{4}-\d{3}-\d{5}$/.test(c.number)) p.warnings.push("Case number " + c.number + " does not follow the usual CB2026-000-00000 pattern");
  if (par.warn) p.warnings.push(par.warn);
  const inits = c.rows.filter((x) => x.typeKey === "initial" && x.date);
  p.initial = inits[0] || null;
  if (inits.length > 1)
    p.warnings.push("The report lists " + inits.length + " initial inspections — the earliest, " + fmtDate(inits[0].date) + ", is used");
  const k = WriterState.CASES.find((x) => accStr(x.number).toUpperCase() === accStr(c.number).toUpperCase()) || null;
  p.existing = k;
  const row = c.rows.find((x) => x.i === acc.sel) || null;
  p.row = row;
  const snowCase = snow.isCase(k) || snow.matchesImport(row);
  if (!row)
    p.blockers.push(
      c.rows.some((x) => x.selectable && accStatusEligible(x.status, x.type))
        ? "Choose the inspection result you are documenting."
        : "No eligible inspection result is available: " +
            [
              ...new Set(
                c.rows.map(
                  (x) =>
                    x.why || (accStatusEligible(x.status, x.type) ? "Missing required inspection fields" : "status " + (x.status || "not supplied")),
                ),
              ),
            ].join("; ") +
            ". Correct the source in Accela and retrieve it again.",
    );
  else {
    if (!row.selectable) p.blockers.push("That inspection cannot be written from — " + row.why);
    else if (row.rule?.error) p.blockers.push(row.rule.error + ". Set the specific result in Accela and retrieve it again.");
    if (row.date && row.date > recordDay(today)) p.blockers.push("The selected inspection date is in the future.");
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
  } else if (k && originalNotice(k.id)) {
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
  } else if (k && validISO(k.date)) {
    p.date = k.date;
    p.time = k.time || "";
    p.warnings.push("The report has no Initial Inspection row — the case keeps its initial inspection of " + fmtDate(k.date));
  } else {
    p.needDate = true;
    p.date = validISO(acc.manualDate) ? acc.manualDate : "";
    p.time = parseTime(acc.manualTime || "") || "";
    if (!p.date) p.blockers.push("The report has no Initial Inspection row — enter the initial inspection date below");
  }
  const src = k ? sourceDocFor(k.id) : null;
  p.next = k && src ? "reinspect" : "notice";
  // R53 Refresh from Accela: importing the same inspection again while its draft or worksheet is unissued
  // updates the stored Accela status instead of being refused as already used.
  const pending = k && row ? (row.typeKey === "initial" ? draftDocFor(k.id) : draftReinspFor(k.id)) : null;
  p.refresh = row && pending?.importInspection && sameInspection(pending.importInspection, inspectionIdentity(row)) ? pending : null;
  if (k && !p.refresh) {
    p.used = row && inspectionUsed(k, row);
    const unfinished = draftDocFor(k.id) || draftReinspFor(k.id) || unissuedVisitFor(k.id);
    if (p.used)
      p.blockers.push(
        "This inspection has already been used to generate a document. Choose Con" +
          "tinue existing case to continue or correct that document." +
          // R59: a used result stays selectable so its reason is shown; another eligible result can still be chosen.
          (c.rows.filter((x) => x.selectable && accStatusEligible(x.status, x.type)).length > 1
            ? " To import a different inspection, choose another result above."
            : ""),
      );
    else if (unfinished) p.blockers.push("This case has unfinished work. Choose Continue existing case before importing another inspection.");
    else if (!src) p.blockers.push("This case already exists. Choose Continue existing case to finish and issue its Official Notice first.");
    else if (caseState(k).closed) p.blockers.push("This case is completed. Choose Continue existing case; new observations require a new case.");
    else if (row) {
      if (row.typeKey === "initial") p.blockers.push(INITIAL_EXISTS);
      const at = inspAt(src);
      if (row.date < at.date || (row.date === at.date && row.time && at.time && row.time < at.time))
        p.blockers.push("Select a reinspection on or after the latest issued document’s inspection.");
    }
  } else if (row && row.typeKey !== "initial") p.blockers.push(NO_CASE);
  // R53 referral rules: Reinspection/CA Referral is the case's first referral; CA Reinspection requires one.
  if (k && !p.refresh && row?.rule && !row.rule.error) {
    const referred = docsFor(k.id).some((d) => !d.draft && !d.void && !d.superseded && (d.type === "referral" || d.type === "referralUpdate"));
    if (row.rule.firstReferral && referred) p.blockers.push("This case is already with the City Attorney. Use a CA Reinspection.");
    if (row.rule.needsReferral && !referred)
      p.blockers.push("This case has not been referred to the City Attorney. Use a Reinspection with status CA Referral for the first referral.");
  }
  if (k && !p.refresh && row?.typeKey === "initial" && !p.blockers.includes(INITIAL_EXISTS)) p.blockers.push(INITIAL_EXISTS);
  p.rule = row?.rule || null;
  if (snowCase) {
    p.next = "snow";
    if (k && src && !snow.is(src)) p.blockers.push("Snow removal cases cite only MGO 10.28. Create a separate case for other violations.");
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
        was: fmtDate(k.date) + " " + fmtTime(k.time || ""),
        now: fmtDate(p.date) + " " + fmtTime(p.time),
      });
    if (row && row.inspectorId && row.inspectorId !== k.inspectorId)
      p.diff.push({ l: "Case inspector", was: insp(k.inspectorId).name || "", now: insp(row.inspectorId).name || "" });
    // where Accela and the record disagree
    const live = docsFor(k.id).filter((d) => !d.draft && !d.void && !d.superseded);
    [
      ["citation", "Citation", "citation"],
      ["official notice", "Official Notice", "notice"],
    ].forEach(([s, label, ty]) => {
      const a = c.rows.filter((x) => accNorm(x.status) === s).length,
        m = live.filter((d) => d.type === ty).length;
      if (a > m) p.warnings.push("Accela shows " + a + " " + label + (a === 1 ? "" : "s") + " on this case; the case file has " + m);
    });
  }
  return p;
}

async function readAccelaFile(file) {
  if (!file || WriterState.state.screen !== "import") return;
  cancelCaseLookup();
  const serial = WriterState.LOOKUP_SERIAL;
  const active = () => serial === WriterState.LOOKUP_SERIAL && WriterState.state.screen === "import";
  WriterState.LOOKUP_ERROR = "";
  WriterState.LOOKUP_BUSY = true;
  render();
  try {
    if (file.size > ACC_MAX) throw new Error("That file is " + Math.round(file.size / 1048576) + " MB — an Accela report is a few KB.");
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
    scheduleDraftSave();
    toast(t.errors.length ? "The report could not be imported" : "Report read — review the inspection");
  } catch (err) {
    if (active()) {
      WriterState.state.acc = {
        fileName: file.name,
        errors: ["That file could not be read — " + (err.message || "it is not an Excel .xlsx file") + ". Nothing was imported."],
        cases: [],
      };
      scheduleDraftSave();
    }
  } finally {
    if (serial === WriterState.LOOKUP_SERIAL) {
      WriterState.LOOKUP_BUSY = false;
      if (WriterState.state.screen === "import") render();
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
      await checkLookupShared(acc, active);
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
  const hits = (await listCaseFolder()).filter((f) => f.name.toLowerCase().endsWith(tail));
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
      if (!loadCaseFile(text)) acc.shareError = "The existing case could not be merged. Open the existing record and resolve the conflict.";
    } finally {
      WriterState.state.screen = keep.screen;
      WriterState.DIRTY = keep.dirty;
      WriterState.state.docId = keep.docId;
    }
  } catch (err) {
    if (active()) {
      acc.shareError = "The existing case file could not be read. Reconnect the share and retry.";
      toast(acc.shareError);
    }
  }
}

/* R53: record the Accela status rule on a draft or worksheet. Initial No Occupancy and Abatement statuses use the
   established initial-action document; reinspection worksheets show the status card instead of Choose next action. */
function applyImportRule(target, rule) {
  target.importRule = rule;
  clearProhibitedCitations(target);
  if (target.results) {
    target.followupIntent = rule.choose ? "" : rule.doc;
    return;
  }
  if (rule.doc !== "notice") {
    target.selectionCache = target.selectionCache || {};
    target.special = clone(target.selectionCache[rule.doc] || {});
    target.type = rule.doc;
    target.initialAction = true;
  } else if (target.initialAction) {
    target.type = "notice";
    target.initialAction = false;
  }
}

function baseLookupAccept() {
  const acc = WriterState.state.acc,
    p = accelaPlan(acc);
  // the guard is here, not only on the button
  if (p.blockers.length) {
    toast(p.blockers[0]);
    render();
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
      pulled: nowISO(),
      file: acc.fileName || "",
      ...(acc.source ? { source: clone(acc.source) } : {}),
      inspections: c.rows.map((x) => ({ type: x.type, date: x.date, time: x.time, status: x.status, inspector: x.inspectorName })),
    },
  };
  // the address on file is kept: the case-file name is built from it
  if (k) Object.assign(k, fields);
  else {
    k = { id: uid("k"), number: c.number, address: f.address, ...fields };
    WriterState.CASES.push(k);
  }
  snow.imported(k, row);
  const importRule = row.rule && !row.rule.error ? clone(row.rule) : null;
  if (p.refresh && importRule) {
    WriterState.state.acc = null;
    WriterState.WORK.acc = null;
    applyImportRule(p.refresh, importRule);
    WriterState.DIRTY = true;
    saveDrafts();
    render();
    toast("Accela status refreshed: " + importRule.status + " \u2192 " + importRule.label);
    return k;
  }
  WriterState.state.acc = null;
  WriterState.WORK.acc = null;
  WriterState.DIRTY = true;
  if (p.next === "snow") {
    k.caseType = "snow-10.28";
    newDoc(k.id, "citation");
    const d = doc(WriterState.state.docId);
    d.inspDate = row.date;
    d.inspTime = row.time;
    d.importInspection = inspectionIdentity(row);
    snow.prepare(d);
    citationPricing.refresh(d);
    saveDrafts();
    render();
    return k;
  }
  if (p.next === "reinspect") {
    const open = draftReinspFor(k.id);
    if (open) {
      startReinspection(k.id, row);
      saveDrafts();
      render();
      toast("Case updated — the open worksheet of " + fmtDate(row.date) + " is on screen");
      return k;
    }
    startReinspection(k.id, row);
    const worksheet = draftReinspFor(k.id);
    if (worksheet && importRule) applyImportRule(worksheet, importRule);
    saveDrafts();
    render();
    toast("Reinspection of " + fmtDate(row.date) + " opened from the Accela report");
    return k;
  }
  if (p.next === "notice") {
    const dd = draftDocFor(k.id);
    if (dd) {
      WriterState.state.docId = dd.id;
      WriterState.state.screen = "write";
      saveDrafts();
      render();
      toast("Case updated — its draft is on screen");
      return k;
    }
    newDoc(k.id, "notice");
    const created = doc(WriterState.state.docId);
    if (created) {
      created.importInspection = inspectionIdentity(row);
      if (importRule) applyImportRule(created, importRule);
      saveDrafts();
    }
    return k;
  }
  WriterState.state.screen = "cases";
  saveDrafts();
  render();
  toast("Case " + k.number + " updated from the Accela report");
  return k;
}

function accelaPanel() {
  const acc = WriterState.state.acc,
    p = accelaPlan(acc);
  const cancel = '<button class="btn" id="acc-cancel">Clear import</button>';
  if (acc.errors?.length)
    return (
      '<section class="card acc"><div class="card-h"><h2>Import review</h2></di' +
      'v><div class="card-b">' +
      `${acc.errors.map((e) => `<p class="banner alert">${esc(e)}</p>`).join("")}` +
      "" +
      `${cancel}` +
      "</div></section>"
    );
  const c = p.c,
    k = p.existing;
  if (!c) return "";
  const choices = c.rows.filter((x) => x.selectable && accStatusEligible(x.status, x.type));
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
                `${esc(x.number)}` +
                "</button>",
            )
            .join(""),
        ) +
        "</div></div>"
      : "";
  // R59: four labelled facts per candidate; selection is shown by the highlighted, pressed state only.
  const when = (x) => (x.date ? fmtDate(x.date) + (x.time ? " at " + fmtTime(x.time) : " · time not supplied") : "not supplied");
  const summary = (x) =>
    [
      ["Inspection type", x.type],
      ["Date", when(x)],
      ["Inspector", x.inspectorName],
      ["Status", x.status],
    ]
      .map(([label, value]) => '<span data-import-field="' + label + '">' + label + ": <strong>" + esc(value || "not supplied") + "</strong></span>")
      .join("");
  const blockerId = "acc-blockers";
  const visibleBlockers = p.blockers.filter((b) => !(choices.length > 1 && b === "Choose the inspection result you are documenting."));
  const inspections =
    choices.length > 1
      ? '<fieldset class="import-choices"><legend>Choose the inspection result yo' +
        'u are documenting</legend><p class="hint">Several eligible inspection re' +
        "sults are available; choose one to continue.</p>" +
        "".concat(
          choices
            .map(
              (x) =>
                '<button type="button" class="import-inspection ' +
                `${x.i === acc.sel ? "is-selected" : ""}` +
                '" data-accsel="' +
                `${x.i}` +
                '" aria-pressed="' +
                `${x.i === acc.sel}` +
                '" ' +
                `${x.i === acc.sel && visibleBlockers.length ? 'aria-describedby="' + blockerId + '"' : ""}` +
                " " +
                `${WriterState.LOOKUP_BUSY ? "disabled" : ""}` +
                ">" +
                `${summary(x)}` +
                "</button>",
            )
            .join(""),
        ) +
        "</fieldset>"
      : choices.length === 1
        ? `<div class="import-selected">${summary(choices[0])}</div>`
        : "";
  const unfinished = k && (draftDocFor(k.id) || draftReinspFor(k.id) || unissuedVisitFor(k.id));
  const label = k ? "Import inspection" : p.next === "snow" ? "Start snow citation" : "Start Official Notice";
  return (
    '<section class="card acc import-review"><div class="card-h"><div><h2>' +
    `${esc(c.number)}` +
    "</h2><p>" +
    `${esc(k?.address || p.f.address)}` +
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
            `${esc(k.id)}` +
            '">Continue existing case</button></div><h3>Inspection to import</h3><' +
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
            `${esc(acc.manualDate || "")}` +
            '"></label><label class="f"><span>Initial inspection time</span><input ty' +
            'pe="time" id="acc-time" value="' +
            `${esc(acc.manualTime || "")}` +
            '"></label></div>'
        : "",
    ) +
    "\n    " +
    `${p.warnings.map((w) => `<p class="banner warn">${esc(w)}</p>`).join("")}` +
    "\n    " +
    "".concat(
      visibleBlockers.length
        ? '<div class="banner alert" id="' +
            blockerId +
            '"><div><strong>' +
            `${esc(visibleBlockers[0])}` +
            "</strong>" +
            "".concat(
              visibleBlockers.length > 1
                ? `<ul>${visibleBlockers
                    .slice(1)
                    .map((b) => `<li>${esc(b)}</li>`)
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
                    `${esc(x.l)}` +
                    "</dt><dd><span>On file: " +
                    `${esc(x.was || "Not supplied")}` +
                    "</span><strong>After import: " +
                    `${esc(x.now || "Not supplied")}` +
                    "</strong></dd>",
                )
                .join(""),
            ) +
            "</dl></details>"
        : "",
    ) +
    '\n    <details class="import-source"><summary>Source and import details</' +
    "summary><p>" +
    `${esc(acc.fileName || "SSRS Excel report")}` +
    "</p>" +
    "".concat(
      acc.source?.kind === "sql"
        ? "<p>Retrieved " +
            `${esc(new Date(acc.source.retrievedAt).toLocaleString())}` +
            ". This is a saved snapshot; use Find Accela inspection again to refresh it.</p>"
        : "",
    ) +
    "" +
    `${(p.notes || []).map((n) => `<p>${esc(n)}</p>`).join("")}` +
    "<p>The inspection type and its result status decide the document: an In" +
    "itial Inspection with Official Notice, Citation, No Occupancy or an Abat" +
    "ement result; a Reinspection with CA Referral (City Attorney Referral), " +
    "Compliance, Citation, Ext" +
    "ension Processing or No Occupancy; a CA Reinspection with Compliance or " +
    "Non Compliance. Completed, Scheduled, Pending, Assist and unknown statuse" +
    "s cannot be imported. Blank inspection times stay blank until explicitly" +
    " corrected.</p></det" +
    'ails>\n    <p class="hint">Case details change only when you confirm. Sav' +
    "e draft &amp; return to Workspace keeps this review on this device when saving succee" +
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
  return shell(
    "Import inspection",
    "Bring in case details",
    '<button class="btn" id="btn-savework">Save draft &amp; return to Workspace</button>',
    '<div style="max-width:980px">\n      ' +
      `${lookupCard()}` +
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
  const now = new Date(recordDay(today) + "T12:00:00"),
    cutoff = iso(
      new Date(now.getFullYear() - 1, now.getMonth(), Math.min(now.getDate(), new Date(now.getFullYear() - 1, now.getMonth() + 1, 0).getDate()), 12),
    );
  docsFor(caseId).forEach((x) => {
    if (x.draft || x.void || x.superseded || x.type !== "citation") return;
    const date = (x.revision && (x.revision.actionDate || x.revision.originalIssued)) || x.mailed || recordDay(x.issuedAt);
    if (!validISO(date) || date < cutoff || date > recordDay(today)) return;
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
  revealIssuedCase,
  focusIssuedCase,
  accelaTable,
  baseLookupPlan,
  readAccelaFile,
  accelaFromShare,
  baseLookupAccept,
  pickAccelaFile,
  screenImport,
  screenLibrary,
  priorCitations,
};
