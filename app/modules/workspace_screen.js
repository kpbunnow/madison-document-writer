import { html, raw } from "./screen_html.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { caseNumberAllowed } from "./case_records.js";
import { caseFileName } from "./case_file_rules.js";
import { docsFor, groupCaseDocuments, doneItems, unchecked, insp } from "./writer_queries.js";
import { fmtDate } from "./presentation_format.js";
import { workspaceQueue } from "./workspace_queue.js";
import { importResumePanel, workingNotesPanel } from "./working_papers.js";
import { uiIcon } from "./ui_icons.js";

import { workspaceDocumentPresentation } from "./workspace_documents.js";

function workspaceCaseOptions(row, secondary, detailActions, draftHTML) {
  const { k, st, proof } = row;
  return html`<details class="queue-details case-options"><summary>Case options${secondary.length ? " · " + secondary.length + " other " + (secondary.length === 1 ? "task" : "tasks") : ""}</summary><div class="doclinks">
    <p>${k.owner}</p>${raw(detailActions)}${raw(draftHTML)}
    ${raw(!caseNumberAllowed(k) ? '<p class="save-error">Case number needs correction. Open the document and use its case details checks.</p>' : "")}
    <p>Record verification: ${proof.label}</p>${raw(proof.valid === false ? html`<p>${proof.eventId || ""} · ${proof.lastGoodCommitTime || "Last good commit unavailable"}</p><button class="btn btn-sm" data-sync-safety>Review record problem</button>` : "")}
    <button data-exportcase="${k.id}">Download case record</button><button data-timeline="${k.id}">Case timeline</button>
    ${raw(st.visit?.draft ? html`<button data-reinsp="${k.id}">Continue reinspection</button><button data-discardri="${st.visit.id}">Discard reinspection draft</button>` : st.draft ? html`<button data-discard="${st.draft.id}">Discard document draft</button>` : "")}
    <button data-rmcase="${k.id}">Remove from this workspace</button></div></details>`;
}

function workspaceDueHTML({ st }) {
  return st.due && !st.closed
    ? html`<span class="${st.late ? "pill late" : st.soon ? "case-date-soon" : "case-due-date"}">${fmtDate(st.due)}</span>${raw(st.late ? '<div class="muted">Past due</div>' : st.soon ? html`<div class="muted">${st.days === 0 ? "Due today" : st.days === 1 ? "Due tomorrow" : "Due in " + st.days + " days"}</div>` : "")}`
    : '<span class="muted">—</span>';
}

function renderWorkspaceRow(row, documents = docsFor(row.k.id)) {
  const { k, st } = row;
  const presentation = workspaceDocumentPresentation(k, documents);
  const secondary = row.facts.filter((t) => !["open", "drafts"].includes(t.key));
  const detailActions = secondary
    .map((t) => html`<div class="queue-detail-task"><span>${t.label}</span><button class="btn btn-sm" ${raw(t.action)}>Review</button></div>`)
    .join("");
  const badges = [row.resolution ? "Needs resolution" : "", row.continuing ? "Work in progress" : "", st.closed ? "Closed" : ""].filter(Boolean);
  return html`<tr data-queue-case="${k.id}"${raw(editor.state.issuedCase === k.id ? ' data-issued-highlight aria-current="true" class="check-focus" tabindex="-1"' : "")}>
    <td data-label="Property / case"><div class="addr">${k.address}</div><div class="case-number">${k.number}</div>
      ${raw(badges.length ? html`<div class="case-badges">${raw(badges.map((label) => html`<span class="pill">${label}</span>`).join(""))}</div>` : "")}
      ${raw(row.resolution || row.continuing || st.restrictions.length ? html`<p class="case-message">${row.reason}</p>` : "")}
      ${raw(st.visit ? html`<p class="case-message">${st.visit.draft ? "Reinspection draft" : "Recorded visit"} · ${String(doneItems(st.visit).length)} corrected, ${String(unchecked(st.visit).length)} still to result</p>` : "")}
      ${raw(workspaceCaseOptions(row, secondary, detailActions, presentation.drafts))}</td>
    <td data-label="Issued documents">${raw(presentation.issued)}</td>
    <td data-label="Next due">${raw(workspaceDueHTML({ st }))}</td><td data-label="Inspector">${insp(k.inspectorId).name}</td>
    <td data-label="Action"><div class="case-next"><button class="btn btn-primary queue-primary" ${raw(row.action)}>${row.label}</button></div></td></tr>`;
}

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
  return html`<section class="card workspace-start" aria-labelledby="workspace-start-title"><div class="card-h"><h2 id="workspace-start-title">Start case work</h2></div><div class="card-b">
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
    const table = queue.map((row) => renderWorkspaceRow(row, documentsFor(row.k.id))).join("");
    const orphan = workspace.PENDING.filter((p) => !workspace.CASES.some((k) => k.id === p.cid || caseFileName(k) === p.name));
    return services.shell("Your workspace", "Building Inspection", "", workspaceContentHTML({ orphan, table, services }));
  }
  return { revealIssuedCase, focusIssuedCase, screenCases };
}
