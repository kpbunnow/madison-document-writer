import { html, raw } from "./screen_html.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { caseNumberAllowed } from "./case_records.js";
import { caseFileName } from "./case_file_rules.js";
import { docsFor, doneItems, unchecked, insp } from "./writer_queries.js";
import { DOC_TYPES } from "./document_types.js";
import { esc, fmtDate } from "./presentation_format.js";
import { workspaceQueue, queueMatches } from "./workspace_queue.js";
import { importResumePanel, workingNotesPanel } from "./working_papers.js";
import { INSPECTORS } from "./data/inspectors.js";
import { uiIcon } from "./ui_icons.js";

function workspaceRowHeadingHTML({ k, issued, secondary, detailActions }) {
  // The attribute branch is static markup; detailActions comes from the task renderer below.
  return (
    html`<tr data-queue-case="${k.id}"${raw(issued ? ' data-issued-highlight aria-current="true" class="check-focus" tabindex="-1"' : "")}><td>` +
    html`<div class="addr">${k.address}</div><div class="mono">${k.number}</div>
      <details class="queue-details"><summary>Case details &amp; history` +
    html`${secondary.length ? " · " + secondary.length + " task" + (secondary.length === 1 ? "" : "s") : ""}</summary>` +
    html`<div class="doclinks"><p>${k.owner}</p>${raw(detailActions)}
      `
  );
}

function workspaceRecordProblemHTML({ proof }) {
  return proof.valid === false
    ? html`<p>${proof.eventId || ""} · ${proof.lastGoodCommitTime || "Last good commit unavailable"}</p>` +
        html`<button class="btn btn-sm" data-sync-safety>Review record problem</button>`
    : "";
}

function workspaceDocumentLinksHTML({ documents }) {
  return documents
    .map(
      (d) =>
        html`<button data-open="${d.id}" class="${d.void ? "voidlink" : d.draft ? "" : "fin"}">` +
        html`${d.void ? "VOID · " : d.superseded ? "REPLACED · " : d.revision ? "REV " + d.revision.number + " · " : ""}` +
        html`${(DOC_TYPES.find((t) => t.id === d.type) || {}).label || d.type} <span>` +
        html`${fmtDate(d.mailed || d.created)}${d.draft ? " · Draft" : ""}</span></button>`,
    )
    .join("");
}

function workspaceDueHTML({ st }) {
  return st.due && !st.closed
    ? html`<span class="${st.late ? "pill late" : st.soon ? "case-date-soon" : "mono"}">${fmtDate(st.due)}</span>` +
        (st.late
          ? html`<div class="muted">Past due</div>`
          : st.soon
            ? html`<div class="muted">${st.days === 0 ? "Due today" : st.days === 1 ? "Due tomorrow" : "Due in " + st.days + " days"}</div>`
            : "")
    : html`<span class="muted">—</span>`;
}

function renderWorkspaceRow(row) {
  const { k, st, proof } = row,
    documents = docsFor(k.id);
  const secondary = row.facts.filter((t) => !["open", "drafts"].includes(t.key));
  // Attribute fragments are produced by the workspace task owner, which escapes their values.
  const detailActions = secondary
    .map((t) => html`<div class="queue-detail-task"><span>${t.label}</span><button class="btn btn-sm" ${raw(t.action)}>Review</button></div>`)
    .join("");
  const issued = editor.state.issuedCase === k.id;
  return (
    workspaceRowHeadingHTML({ k, issued, secondary, detailActions }) +
    (!caseNumberAllowed(k) ? html`<p class="save-error">Case number needs correction. Open the document and use its case details checks.</p>` : "") +
    html`
      <p>Record verification: ${proof.label}</p>` +
    workspaceRecordProblemHTML({ proof }) +
    "\n      " +
    workspaceDocumentLinksHTML({ documents }) +
    html`
      <button data-exportcase="${k.id}">Download case record</button><button data-timeline="${k.id}">Case timeline</button>
      ` +
    (st.visit?.draft
      ? html`<button data-discardri="${st.visit.id}">Discard reinspection draft</button>`
      : st.draft
        ? html`<button data-discard="${st.draft.id}">Discard document draft</button>`
        : "") +
    html`
      <button data-rmcase="${k.id}">Remove from this workspace</button></div></details></td>
      <td><span class="pill ${row.resolution ? "late" : st.closed ? "closed" : row.continuing ? "draft" : "open"}">` +
    html`${row.resolution && !row.continuing ? "Needs resolution" : st.label}</span><p class="queue-reason">${row.reason}</p>` +
    (row.continuing && row.resolution ? html`<span class="queue-secondary">Also needs resolution · see case details</span>` : "") +
    (st.visit ? html`<span class="muted">${doneItems(st.visit).length} corrected, ${unchecked(st.visit).length} still to result</span>` : "") +
    "</td>\n      <td>" +
    workspaceDueHTML({ st }) +
    html`</td>
      <td>${insp(k.inspectorId).name}</td><td><div class="case-next">` +
    html`<button class="btn btn-sm btn-primary queue-primary" ${raw(row.action)}>${row.label}</button></div></td></tr>`
  );
}

function workspaceQuickViewsHTML({ quickViews, count }) {
  return "".concat(
    workspace.CASES.length
      ? '<div class="queue-summary" role="group" aria-label="Filter workspace cas' +
          'es">' +
          "".concat(
            quickViews
              .map(
                ([key, label]) =>
                  '<button class="btn queue-summary-button" data-queue-view="' +
                  `${key}` +
                  '" aria-pressed="' +
                  `${editor.state.caseFilter === key}` +
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
  );
}

function workspaceCaseTableHTML({ moreViews, count, filtered, activeLabel, query, table, importCount }) {
  return (
    '<div class="case-tools"><label><span class="sr-only">Search this workspa' +
    'ce</span><input type="search" id="case-search" value="' +
    `${esc(editor.state.caseQ)}` +
    '" placeholder="Search this workspace…"></label>\n      <label class="case' +
    '-view"><span class="sr-only">More views</span><select id="case-filter" aria-label="More views"' +
    ">" +
    `<option value="" ${moreViews.some(([key]) => key === editor.state.caseFilter) ? "" : "selected"}>More views…</option>` +
    "".concat(
      moreViews
        .map(([key, label]) => `<option value="${key}" ${editor.state.caseFilter === key ? "selected" : ""}>${label} (${count(key)})</option>`)
        .join(""),
    ) +
    '</select></label>\n      <select id="case-inspector" aria-label="Filter b' +
    'y inspector"><option value="">All inspectors</option>' +
    "".concat(
      INSPECTORS.filter((i) => workspace.CASES.some((k) => k.inspectorId === i.id))
        .map(
          (i) =>
            '<option value="' +
            `${esc(i.id)}` +
            '" ' +
            `${editor.state.caseInspector === i.id ? "selected" : ""}` +
            ">" +
            `${esc(i.name)}` +
            "</option>",
        )
        .join(""),
    ) +
    '</select></div>\n      <p class="queue-filter-note">' +
    `${filtered.length}` +
    " of " +
    `${count(editor.state.caseFilter)}` +
    " cases in " +
    `${activeLabel}` +
    "" +
    `${query ? " · workspace search applied" : ""}` +
    "" +
    `${editor.state.caseInspector ? " · inspector filter applied" : ""}` +
    ". Counts include all loaded cases; a case can belong to more than one vi" +
    "ew." +
    "".concat(query || editor.state.caseInspector ? ' <button class="lnk" data-queue-reset>Clear search and inspector</button>' : "") +
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
          `${query || editor.state.caseInspector ? "No cases match these filters." : "No cases in this view."}` +
          ' <button class="lnk" data-queue-reset>Clear search and inspector</button' +
          '> <button class="lnk" id="case-showall">View all cases</button>' +
          // The shared search opens with this workspace query prefilled; it is not submitted automatically.
          "".concat(
            query
              ? ' <button class="btn btn-sm" data-shared-offer>Search shared case records for “' +
                  esc(String(editor.state.caseQ || "").trim()) +
                  "”</button>"
              : "",
          ) +
          "</div></td></tr>",
    ) +
    '</tbody></table></div><div class="case-count">' +
    `${workspace.CASES.length}` +
    " cases on this device. Use Search shared case records for records outsid" +
    "e this workspace." +
    `${importCount ? " An import is waiting for review above." : ""}` +
    "</div>"
  );
}

function workspaceContentHTML({ activeLabel, quickViews, count, orphan, moreViews, filtered, query, table, importCount, services }) {
  return (
    '<section class="card workspace-start" aria-labelledby="workspace-start-title"><div class="card-h"><h2 id="workspace-start-title">Start or find case work</h2></div><div class="card-b grid g2">' +
    '<div><button class="btn btn-primary" data-nav="import">' +
    uiIcon("import") +
    ' Import inspection</button><p class="hint">Start new work from an unused Accela inspection.</p></div>' +
    '<div><button class="btn" data-global-search>' +
    uiIcon("search") +
    ' Search shared case records</button><p class="hint">Find an existing case by number, address, owner, citation or parcel.</p></div></div></section>' +
    `${importResumePanel()}` +
    "" +
    "".concat(workspace.PREFLIGHT_NOTICE ? `<div class="banner info" role="status">${esc(workspace.PREFLIGHT_NOTICE)}</div>` : "") +
    '\n     <div class="workspace-lead"><div><h2>' +
    `${workspace.CASES.length ? activeLabel : "Start with a case"}` +
    "</h2><p>" +
    "".concat(
      workspace.CASES.length
        ? "One next action per case. Open case details for other tasks and history."
        : "Import an Accela report or open a saved case to begin.",
    ) +
    "</p></div></div>\n     " +
    workspaceQuickViewsHTML({ quickViews, count }) +
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
      !workspace.CASES.length
        ? '<div class="empty-state"><div class="empty-icon">' +
            `${uiIcon("cases")}` +
            "</div><h2>A clear desk. A clear next step.</h2><p>Bring in the case deta" +
            "ils, choose the violations, then review and issue. Your unfinished work " +
            'is saved on this device. Use the actions above to start or find case work.</p><button class="btn" data-openfil' +
            "e>Open saved case</button></div>"
        : workspaceCaseTableHTML({ moreViews, count, filtered, activeLabel, query, table, importCount }),
    ) +
    '</div>\n     <div class="queue-support"><button class="btn btn-sm" data-s' +
    'ync-safety>Saved work &amp; connection</button><div id="recovery-status"' +
    ' class="hint" aria-live="polite">' +
    `${services.recoveryStatusHTML()}` +
    "</div>" +
    `${workspace.CASES.length ? '<button class="lnk" id="btn-clear">Remove cases from this workspace</button>' : ""}` +
    "</div>\n     " +
    `${services.remindersPanel()}` +
    "" +
    `${workingNotesPanel()}` +
    ""
  );
}

export function createWorkspaceScreen(services) {
  function revealIssuedCase(cid) {
    const s = editor.state,
      rows = workspace.CASES.map((k) => ({ k, st: services.caseState(k) })),
      row = workspaceQueue(rows, services.workspaceTasks(rows), services.app_workspacequeueContext()).find((r) => r.k.id === cid);
    if (!row) return false;
    const before = [s.caseFilter, s.caseQ, s.caseInspector].join("|"),
      query = String(s.caseQ || "")
        .toLowerCase()
        .trim();
    if (!queueMatches(row, s.caseFilter)) s.caseFilter = "all";
    if (query && !services.caseSearchText(row.k).includes(query)) s.caseQ = "";
    if (s.caseInspector && row.k.inspectorId !== s.caseInspector) s.caseInspector = "";
    s.metric = "";
    s.modal = null;
    s.picker = false;
    s.screen = "cases";
    s.issuedCase = cid;
    if ([s.caseFilter, s.caseQ, s.caseInspector].join("|") !== before) services.saveWorkflowPrefs();
    return true;
  }

  function focusIssuedCase(cid) {
    const row = [...services.document.querySelectorAll("tr[data-issued-highlight]")].find((el) => el.dataset.queueCase === cid);
    if (!row) return;
    row.scrollIntoView?.({ block: "center" });
    row.focus({ preventScroll: true });
  }

  function screenCases() {
    const rows = workspace.CASES.map((k) => ({ k, st: services.caseState(k) })),
      tasks = services.workspaceTasks(rows);
    // Retire legacy metric selection into the workspace views.
    if (editor.state.metric) {
      editor.state.caseFilter =
        { drafts: "continue", overdue: "overdue", soon: "soon", open: "open", imports: "all" }[editor.state.metric] || "resolution";
      editor.state.metric = "";
    }
    const queue = workspaceQueue(rows, tasks, services.app_workspacequeueContext()),
      query = String(editor.state.caseQ || "")
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
    if (editor.state.caseFilter === "drafts") editor.state.caseFilter = "continue";
    if (!views.some(([key]) => key === editor.state.caseFilter)) editor.state.caseFilter = "attention";
    const count = (filter) => queue.filter((row) => queueMatches(row, filter)).length;
    const filtered = queue.filter(
      (row) =>
        queueMatches(row, editor.state.caseFilter) &&
        (!query || services.caseSearchText(row.k).includes(query)) &&
        (!editor.state.caseInspector || row.k.inspectorId === editor.state.caseInspector),
    );
    const table = filtered.map((row) => renderWorkspaceRow(row)).join("");
    const importCount = tasks.find((t) => t.key === "imports").count;
    // Pending operations without a loaded case must remain reachable.
    const orphan = workspace.PENDING.filter((p) => !workspace.CASES.some((k) => k.id === p.cid || caseFileName(k) === p.name));
    const activeLabel = views.find(([key]) => key === editor.state.caseFilter)[1];
    return services.shell(
      "Your workspace",
      "Building Inspection",
      "",
      workspaceContentHTML({ activeLabel, quickViews, count, orphan, moreViews, filtered, query, table, importCount, services }),
    );
  }
  return { revealIssuedCase, focusIssuedCase, screenCases };
}
