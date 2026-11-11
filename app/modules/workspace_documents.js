/* Read-only document access for a case. Receipts/location checks and actual PDF reads retain their existing owners. */
import { html, raw } from "./screen_html.js";
import { DOC_TYPES } from "./document_types.js";
import { recordDay } from "../assets/shared.js";
import { fmtDate } from "./presentation_format.js";
import { deliveredByCitation } from "./document_rules.js";
import { pdfTransferState } from "./pdf_artifacts.js";

// Issuance/revision timestamps describe history order; mailing dates can be deliberately backdated.
const historyTime = (d) => (d.draft ? d.created : d.revision?.at || d.issuedAt || d.mailed || d.created) || "";
const documentDate = (d) => fmtDate(recordDay(historyTime(d)));

export function orderedCaseDocuments(documents) {
  return documents
    .slice()
    .sort((a, b) => String(historyTime(b)).localeCompare(String(historyTime(a))) || (b.revision?.number || 0) - (a.revision?.number || 0));
}

const title = (d) => DOC_TYPES.find((type) => type.id === d.type)?.label || d.type;
const state = (d) =>
  d.pendingAmendment
    ? "Save confirmation needed"
    : d.draft
      ? "Draft"
      : d.void
        ? "Withdrawn"
        : d.superseded
          ? "Replaced"
          : d.revision
            ? "Revision " + d.revision.number
            : "Issued";

function pdfAccess(d, documents) {
  const packet = deliveredByCitation(d);
  const source = packet ? documents.find((item) => item.id === d.issuanceGroup.citationId) : d;
  if (!source || source.draft || source.pendingAmendment || d.pendingAmendment) return "";
  if (!source.filedArtifact) return '<p class="case-document-note">PDF not filed or not confirmed.</p>';
  const location = pdfTransferState(source);
  const confirmed = ["shared", "local outbox"].includes(location);
  const problem = ["invalid artifact identity", "artifact conflict", "missing or unavailable"].includes(location);
  const label = `${confirmed ? "View issued" : "Check"} ${packet ? "packet PDF" : "PDF"}`;
  return html`${raw(problem ? "" : html`<button class="lnk" data-case-pdf="${source.id}" aria-label="${label}: ${title(d)}, ${documentDate(d)} (opens in a new tab)">${label}</button>`)}${raw(
    confirmed ? "" : html`<p class="case-document-note">PDF not confirmed · ${location}. Open the record to review filing.</p>`,
  )} `;
}

function documentEntry(d, documents) {
  return html`<div class="case-document"><div><strong>${title(d)}</strong><span class="case-document-state">${state(d)}</span></div>
    <p class="case-document-date">${d.draft ? "Created" : "Issued"} ${documentDate(d)}</p>
    <div class="case-document-actions">${raw(pdfAccess(d, documents))}<button class="lnk" data-open="${d.id}" aria-label="${d.draft ? "Continue draft" : "Open record"}: ${title(d)}, ${documentDate(d)} (${state(d)})">${d.draft ? "Continue draft" : "Open record"}</button></div></div>`;
}

export function workspaceDocumentsSummary(k, documents) {
  const ordered = orderedCaseDocuments(documents);
  const current = ordered.find((d) => !d.draft && !d.void && !d.superseded);
  const drafts = ordered.filter((d) => d.draft).length;
  return html`${raw(current ? documentEntry(current, documents) : '<p class="case-document-note">No current issued document.</p>')}
    <button class="lnk case-all-documents" id="case-documents-${k.id}" data-case-documents="${k.id}" aria-haspopup="dialog" aria-label="All documents (${String(documents.length)}) for ${k.address}, ${k.number}">All documents (${String(documents.length)})</button>
    ${raw(drafts ? html`<span class="case-document-note">${String(drafts)} ${drafts === 1 ? "draft" : "drafts"}</span>` : "")}`;
}

export function workspaceDocumentsPanel(k, documents) {
  if (!k?.id)
    return '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true"><h2>Case not available</h2><button data-close="modal">Close</button></div></div>';
  const ordered = orderedCaseDocuments(documents),
    drafts = ordered.filter((d) => d.draft),
    issued = ordered.filter((d) => !d.draft);
  const list = (items) => items.map((d) => html`<li>${raw(documentEntry(d, documents))}</li>`).join("");
  return html`<div class="modal case-documents-panel"><div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="case-documents-title">
    <div class="modal-h"><div><h2 id="case-documents-title">Case documents</h2><p>${k.address} · ${k.number}</p></div><button class="btn" data-close="modal">Close</button></div>
    <div class="modal-b">${raw(drafts.length ? html`<section><h3>In progress</h3><ul class="case-document-list">${raw(list(drafts))}</ul></section>` : "")}
    <section><h3>Issued documents</h3><p class="hint">Newest first. Replaced and withdrawn documents remain in the history.</p>${raw(issued.length ? html`<ul class="case-document-list">${raw(list(issued))}</ul>` : "<p>No documents have been issued for this case.</p>")}</section></div></div></div>`;
}
