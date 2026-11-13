/* Presentation-only row reuse. Current policy/proof/task facts are supplied on every render. */
import { html, raw } from "./screen_html.js";
import { caseNumberAllowed } from "./case_records.js";
import { doneItems, unchecked, insp } from "./writer_queries.js";
import { fmtDate } from "./presentation_format.js";
import { editorState as editor } from "./editor_state.js";
import { workspaceDocumentPresentation } from "./workspace_documents.js";

function workspaceCaseOptions(row, secondary, detailActions, draftHTML, context) {
  const { k, st, proof } = row;
  return html`<details class="queue-details case-options"><summary>Case options${secondary.length ? " · " + secondary.length + " other " + (secondary.length === 1 ? "task" : "tasks") : ""}</summary><div class="doclinks">
    <p>${k.owner}</p>${raw(detailActions)}${raw(draftHTML)}
    ${raw(!context.numberAllowed ? '<p class="save-error">Case number needs correction. Open the document and use its case details checks.</p>' : "")}
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

function renderWorkspaceRow(row, documents, context) {
  const { k, st } = row;
  const presentation = workspaceDocumentPresentation(k, documents);
  const secondary = row.facts.filter((t) => !["open", "drafts"].includes(t.key));
  const detailActions = secondary
    .map((t) => html`<div class="queue-detail-task"><span>${t.label}</span><button class="btn btn-sm" ${raw(t.action)}>Review</button></div>`)
    .join("");
  const badges = [row.resolution ? "Needs resolution" : "", row.continuing ? "Work in progress" : "", st.closed ? "Closed" : ""].filter(Boolean);
  return html`<tr data-queue-case="${k.id}"${raw(context.issued ? ' data-issued-highlight aria-current="true" class="check-focus" tabindex="-1"' : "")}>
    <td data-label="Property / case"><div class="addr">${k.address}</div><div class="case-number">${k.number}</div>
      ${raw(badges.length ? html`<div class="case-badges">${raw(badges.map((label) => html`<span class="pill">${label}</span>`).join(""))}</div>` : "")}
      ${raw(row.resolution || row.continuing || st.restrictions.length ? html`<p class="case-message">${row.reason}</p>` : "")}
      ${raw(st.visit ? html`<p class="case-message">${st.visit.draft ? "Reinspection draft" : "Recorded visit"} · ${String(context.corrected)} corrected, ${String(context.unchecked)} still to result</p>` : "")}
      ${raw(workspaceCaseOptions(row, secondary, detailActions, presentation.drafts, context))}</td>
    <td data-label="Issued documents">${raw(presentation.issued)}</td>
    <td data-label="Next due">${raw(workspaceDueHTML({ st }))}</td><td data-label="Inspector">${context.inspector.name}</td>
    <td data-label="Action"><div class="case-next"><button class="btn btn-primary queue-primary" ${raw(row.action)}>${row.label}</button></div></td></tr>`;
}

export function createWorkspaceRows() {
  const cache = new Map();
  function render(row, documents) {
    const context = {
      issued: editor.state.issuedCase === row.k.id,
      inspector: insp(row.k.inspectorId),
      numberAllowed: caseNumberAllowed(row.k),
      corrected: row.st.visit ? doneItems(row.st.visit).length : 0,
      unchecked: row.st.visit ? unchecked(row.st.visit).length : 0,
    };
    let key;
    try {
      key = JSON.stringify([row, documents, context]);
    } catch {
      // Unserializable transient fields must not make an otherwise renderable case disappear.
      cache.delete(row.k.id);
      return renderWorkspaceRow(row, documents, context);
    }
    if (cache.get(row.k.id)?.key === key) return cache.get(row.k.id).html;
    const html = renderWorkspaceRow(row, documents, context);
    cache.set(row.k.id, { key, html });
    return html;
  }
  function retain(cases) {
    const ids = new Set(cases.map((k) => k.id));
    for (const id of cache.keys()) if (!ids.has(id)) cache.delete(id);
  }
  return { render, retain };
}
