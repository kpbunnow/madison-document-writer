/* Read-only, newest-first document links. The existing editor route retains preflight and all record/PDF actions. */
import { html, raw } from "./screen_html.js";
import { DOC_TYPES } from "./document_types.js";
import { recordDay } from "../assets/shared.js";
import { fmtDate } from "./presentation_format.js";

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

function documentEntry(d) {
  const label = title(d),
    date = documentDate(d);
  const status = d.draft || d.pendingAmendment || d.void || d.superseded || d.revision ? state(d) : "";
  return html`<li class="case-document"><div><button class="lnk case-document-link" data-open="${d.id}" aria-label="${label}, ${d.draft ? "draft created" : "issued"} ${date}${status ? ", " + status : ""}"><strong>${label}</strong></button><span class="case-document-date">${date}</span>${raw(status ? html`<span class="case-document-state">${status}</span>` : "")}</div></li>`;
}

export function workspaceDocumentsSummary(k, documents) {
  const issued = orderedCaseDocuments(documents).filter((d) => !d.draft);
  return issued.length
    ? html`<ul class="case-document-list" aria-label="Issued documents for ${k.address}, ${k.number}">${raw(issued.map(documentEntry).join(""))}</ul>`
    : '<p class="case-document-note">No issued documents.</p>';
}

export function workspaceDraftDocuments(documents) {
  const drafts = orderedCaseDocuments(documents).filter((d) => d.draft);
  return drafts.length
    ? html`<div class="case-drafts"><h3>In progress</h3><ul class="case-document-list">${raw(drafts.map(documentEntry).join(""))}</ul></div>`
    : "";
}
