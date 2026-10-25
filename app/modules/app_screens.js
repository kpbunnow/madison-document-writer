/* Writer screen dispatcher (render), the shared picker, modal and overlay HTML, and the case list. */

import { sourceDocFor, caseNumberAllowed, storageReport, reindexReport, shell } from "./workspace_shell.js";
import { caseFileName } from "./case_file_rules.js";
import { draftDocFor, draftReinspFor, docsFor, effectiveFiled, doneItems, unchecked, insp, doc, kase, docCase, reinsp } from "./writer_queries.js";
import {
  snow,
  blockers,
  initialCitations,
  CASEDIR_EXPECT,
  isLocked,
  navigation,
  newDocuments,
  A11Y,
  IDB_OK,
  app_workspacequeueContext,
  app_languagediscoveryContext,
  paginate,
  reviewModalHTML,
  screenWrite,
  editorEnhance,
  enhanceDialog,
} from "./app_core.js";
import { isHistoryDoc, activeRestrictions } from "./document_rules.js";
import { addDays, daysBetween, iso } from "./calendar.js";
import { STATUS_OF, DOC_TYPES } from "./document_types.js";
import { emailList, ccList, isLLC, EMAIL_KINDS } from "./mailing_rules.js";
import { checkAttr, esc } from "./presentation_format.js";
import { unissuedVisitFor, recoveryStatusHTML, recoveryModal, restoreWorkControls } from "./draft_recovery.js";

import { WriterState } from "./state.js";
import { independentArtifact, pdfTransferState, workspaceTasks, remindersPanel } from "./case_timeline.js";
import { workspaceQueue, queueMatches } from "./workspace_queue.js";

import { caseSearchText, saveWorkflowPrefs, sharedChangeModal } from "./language_catalog.js";
import { importResumePanel, workingNotesPanel, recordActionModal, correctionDiffHTML } from "./issuance_and_corrections.js";
import { languageScreen, languagePicker, rememberLanguageFocus, restoreLanguageFocus } from "./language_discovery.js";

import { checks, validISO, fmtDate } from "./court_and_deposits.js";
import { recipientPreview, caseUnsaved, updateSaveStatus, scheduleDraftSave } from "./case_files.js";
import { checkRowHTML, walkIdentity, ensureWalkContext, screenReinspect, highlightOpenChecks } from "./reinspection.js";
import { helperStop } from "./helper_stopped.js";
import { screenImport } from "./accela_import.js";

import { recordDay, mailingMaxDay } from "../assets/shared.js";
import { INSPECTORS } from "./data/inspectors.js";

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
  if (WriterState.STARTUP_STATUS === "locked") return;
  if (!WriterState.WRITER_READY && (IDB_OK || WriterState.STARTUP_STATUS === "failed")) {
    const failed = WriterState.STARTUP_STATUS === "failed";
    document.getElementById("app").innerHTML =
      '<main id="main-content" tabindex="-1" style="max-width:640px;margin:12vh auto;padding:28px"><h1>' +
      (failed ? "Saved workspace could not be restored" : "Restoring saved workspace") +
      '</h1><p role="' +
      (failed ? "alert" : "status") +
      '" aria-live="' +
      (failed ? "assertive" : "polite") +
      '">' +
      (failed
        ? "Editing is paused to protect saved work. Reload to retry. If this continues, ask IT to check this browser’s local storage."
        : "Please wait while your saved cases and unfinished work are restored.") +
      "</p>" +
      (failed ? '<button id="startup-retry">Reload and retry</button>' : "") +
      "</main>";
    document.getElementById("overlay").innerHTML = "";
    document.getElementById("startup-retry")?.addEventListener("click", () => location.reload());
    if (failed) document.getElementById("main-content")?.focus({ preventScroll: true });
    return;
  }
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

export { uiIcon, caseState, revealIssuedCase, focusIssuedCase, screenCases, screenLibrary, priorCitations, overlayHTML, render, renderKeep };
