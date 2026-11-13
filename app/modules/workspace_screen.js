import { html, raw } from "./screen_html.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { caseFileName } from "./case_file_rules.js";
import { groupCaseDocuments } from "./writer_queries.js";
import { workspaceQueue } from "./workspace_queue.js";
import { importResumePanel, workingNotesPanel } from "./working_papers.js";
import { uiIcon } from "./ui_icons.js";

import { createWorkspaceRows } from "./workspace_rows.js";

// Offered once the list is long enough to need it; it marks and scrolls, and never hides a case.
const JUMP_FROM = 6;
const workspaceJumpHTML = () =>
  workspace.CASES.length >= JUMP_FROM
    ? '<div class="case-jump"><label class="f" for="workspace-jump"><span>Find a case in this list</span><input type="search" id="workspace-jump" autocomplete="off" spellcheck="false" placeholder="Address or case number"></label><p class="hint" id="workspace-jump-status" role="status"></p></div>'
    : "";

function workspaceCaseTableHTML(table) {
  return html`${raw(workspaceJumpHTML())}<div class="case-table-wrap workspace-cases"><table class="list case-table"><caption class="sr-only">Workspace cases, issued documents and actions</caption>
    <thead><tr><th scope="col">Property / case</th><th scope="col">Issued documents</th><th scope="col">Next due</th><th scope="col">Inspector</th><th scope="col">Action</th></tr></thead>
    <tbody>${raw(table)}</tbody></table></div>`;
}

function workspaceContentHTML({ orphan, table, services }) {
  // Open cases by inspector leads Workspace (owner request 2026-11-13), followed by Start case work.
  return html`${raw(services.openCasesCard())}<section class="card workspace-start" aria-labelledby="workspace-start-title"><div class="card-h"><h2 id="workspace-start-title">Start case work</h2></div><div class="card-b">
    <form id="lookup-form" class="lookup-row" aria-busy="false"><label class="f"><span>Case number</span><input id="lookup-number" type="text" maxlength="80" autocomplete="off" spellcheck="false" placeholder="CB2026-000-00000" value="${editor.WORK?.entry?.["lookup-number"] || ""}"></label><button class="btn btn-primary" type="submit">Find Case Inspections</button></form>
    <div><button class="btn" data-nav="import">${raw(uiIcon("import"))} Import inspection</button>
    <p class="hint">Choose an open case by inspector, or enter a case number, to start new work from an unused inspection.</p></div></div></section>
    ${raw(importResumePanel())}${raw(workspace.PREFLIGHT_NOTICE ? html`<div class="banner info" role="status">${workspace.PREFLIGHT_NOTICE}</div>` : "")}
    ${raw(orphan.length ? html`<div class="banner warn">${String(orphan.length)} queued case ${orphan.length === 1 ? "file" : "files"} outside the loaded cases. <button class="btn btn-sm" data-sync-safety>Review queued saves</button></div>` : "")}
    <div class="card">${raw(
      workspace.CASES.length
        ? workspaceCaseTableHTML(table)
        : html`<div class="empty-state"><div class="empty-icon">${raw(uiIcon("cases"))}</div><h2>No cases in this workspace</h2>
      <p>Import an inspection or open a saved case to begin.</p><button class="btn" data-openfile>Open saved case</button></div>`,
    )}</div>
    <div class="queue-support"><button class="btn btn-sm" data-sync-safety>Saved work &amp; connection</button>
      <div id="recovery-status" class="hint" aria-live="polite">${raw(services.recoveryStatusHTML())}</div>
      ${raw(workspace.CASES.length ? '<button class="lnk" id="btn-clear">Remove cases from this workspace</button>' : "")}</div>
    ${raw(services.remindersPanel())}${raw(workingNotesPanel())}`;
}

export function createWorkspaceScreen(services) {
  const presentation = createWorkspaceRows();
  function revealIssuedCase(cid) {
    if (!workspace.CASES.some((k) => k.id === cid)) return false;
    const s = editor.state;
    s.metric = "";
    s.modal = null;
    s.picker = false;
    s.screen = "cases";
    s.issuedCase = cid;
    return true;
  }

  function focusIssuedCase(cid) {
    const row = [...services.document.querySelectorAll("tr[data-issued-highlight]")].find((el) => el.dataset.queueCase === cid);
    if (!row) return;
    row.scrollIntoView?.({ block: "center" });
    row.focus({ preventScroll: true });
  }

  function screenCases() {
    const documentsFor = groupCaseDocuments(workspace.DOCS),
      rows = workspace.CASES.map((k) => ({ k, st: services.caseState(k, documentsFor(k.id)) })),
      tasks = services.workspaceTasks(rows, documentsFor);
    // Retained view/search preferences from earlier releases cannot hide a loaded case.
    editor.state.metric = "";
    const queue = workspaceQueue(rows, tasks, services.app_workspacequeueContext());
    presentation.retain(workspace.CASES);
    const table = queue.map((row) => presentation.render(row, documentsFor(row.k.id))).join("");
    const orphan = workspace.PENDING.filter((p) => !workspace.CASES.some((k) => k.id === p.cid || caseFileName(k) === p.name));
    return services.shell("Your workspace", "Building Inspection", "", workspaceContentHTML({ orphan, table, services }));
  }
  return { revealIssuedCase, focusIssuedCase, screenCases };
}
