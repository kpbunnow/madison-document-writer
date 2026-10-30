import { editorState as editor } from "./editor_state.js";
import { recordDay } from "../assets/shared.js";
import { isHistoryDoc, specialType } from "./document_rules.js";
import { cents } from "./citation_policy.js";
import { correctionSource, doc, kase, reinsp } from "./writer_queries.js";
import { DOC_TYPES, OUTCOMES } from "./document_types.js";
import { esc } from "./presentation_format.js";
import { INSPECTORS } from "./data/inspectors.js";
import { html, raw } from "./screen_html.js";

/* Record-action dialog (withdraw, note, follow-through). Builders take what they render from. */
const RECORD_ACTION_KINDS = { void: "document.voided", recordnote: "document.annotated", reconcile: "document.reconciled" };
const RECORD_ACTION_TITLES = { void: "Withdraw this document", recordnote: "Add a record note", reconcile: "Record follow-through" };
const RECORD_ACTION_TEXTS = {
  void: "Use a correction for an error that can be fixed. Withdrawal ends this document without a replacement; the previous active document may become current. Nothing is deleted. Review any affected recipients and external records.",
  recordnote:
    "Explain an error or clarification in an earlier record. This note does not change the issued document, deadlines, inspection results or report counts. Correct the latest document as well if it carries the same error.",
  reconcile:
    "Record completed notification and filing actions: recipients, date, delivery method and Accela / court / attorney references as applicable. This is your confirmation of work completed outside the program.",
};

function heldRecordAttempt(d, mode) {
  return Object.values(editor.RECORD_ATTEMPTS).find(
    (x) => x.cid === d.caseId && x.pendingAmendment.payload.docId === d.id && x.pendingAmendment.type === RECORD_ACTION_KINDS[mode],
  );
}

function recordActionInspectors(d, held) {
  return INSPECTORS.map(
    (i) =>
      '<option value="' +
      `${esc(i.id)}` +
      '" ' +
      `${i.id === (held ? held.pendingAmendment.by : kase(d.caseId).inspectorId) ? "selected" : ""}` +
      ">" +
      `${esc(i.name)}` +
      "</option>",
  ).join("");
}

function recordActionExternal(d, mode, held, heldPayload, savedForm) {
  return mode === "void" && (d.type === "citation" || isHistoryDoc(d) || specialType(d.type))
    ? html`<label class="f"><span>Court / City Attorney instructions or reference</span><textarea id="record-action-external" rows="2" ${raw(held ? "disabled" : "")}>${raw(heldPayload ? esc(heldPayload.externalReference || "") : esc(savedForm.external || ""))}</textarea></label>`
    : "";
}

function recordActionShell(d, mode, held) {
  const heldPayload = held ? held.pendingAmendment.payload : null;
  const savedForm = editor.WORK.recordForms[d.id + ":" + mode] || {};
  return html`<div class="modal"><div class="modal-box" role="dialog" aria-modal="true"><div class="modal-h"><h2>${raw(RECORD_ACTION_TITLES[mode])}</h2></div><div class="modal-b"><p>${raw(
    "".concat(
      held ? "The previous save is awaiting confirmation. Retry its retained request before entering another change." : RECORD_ACTION_TEXTS[mode],
    ),
  )}</p>${raw("".concat(editor.state.amendmentError ? `<div class="banner alert" role="alert">${esc(editor.state.amendmentError)}</div>` : ""))}<label class="f"><span>Inspector making this record change</span><select id="record-action-inspector" ${raw(held ? "disabled" : "")}>${raw("".concat(recordActionInspectors(d, held)))}</select></label><label class="f"><span>${raw("".concat(mode === "void" ? "Reason for withdrawal" : mode === "reconcile" ? "Completed actions and references" : "Record note"))}</span><textarea id="record-action-text" rows="4" maxlength="4000" ${raw(held ? "disabled" : "")}>${raw("".concat(heldPayload ? esc(heldPayload.reason || heldPayload.text || heldPayload.reference) : esc(savedForm.text || "")))}</textarea></label>${raw("".concat(recordActionExternal(d, mode, held, heldPayload, savedForm)))}</div><div class="modal-f"><button class="btn" data-close="modal">Cancel</button><button class="btn" id="btn-savework">Save draft &amp; return to Workspace</button><button class="btn btn-primary" id="record-action-go">${raw(held ? "Confirm previous save" : mode === "void" ? "Confirm withdrawal" : "Save to case record")}</button></div></div></div>`;
}

/* Correction panel sections. Each takes the draft and whether its save is awaiting confirmation. */
function correctionNotices(locked) {
  return locked
    ? '<div class="banner warn">The save response was not confirmed. Retry the exact save to check the shared record before editing or discarding this draft. <button class="btn" id="btn-retrycorrection">Retry save</button></div>'
    : "";
}

function externalReferenceField(d, c, locked) {
  return d.type === "citation" || isHistoryDoc(d) || specialType(d.type)
    ? html`<label class="f"><span>Court / City Attorney / division amendment instructions or reference</span><textarea id="correction-external" rows="2" ${raw(locked ? "disabled" : "")}>${c.externalReference}</textarea><span class="hint">Confirm the required process with the receiving office. Saving here does not amend an external court or attorney record.</span></label>`
    : "";
}

function propertyDetails(services, c, locked) {
  return html`<details><summary>Property record details and original action date</summary><label class="f"><span>Original action date used in current reports</span><input type="date" id="correction-action-date" value="${c.actionDate}" max="${raw(recordDay(services.today))}" ${raw(locked ? "disabled" : "")}><span class="hint">Keep this date unless the original issue date was recorded incorrectly. This differs from the mailing date of this new corrected copy. A change is included in the review and audit trail.</span></label><div class="grid g2"><label class="f"><span>Parcel</span><input data-case="parcel" value="${c.case.parcel || ""}" ${raw(locked ? "disabled" : "")}></label><label class="f"><span>City / state / ZIP</span><input data-case="siteCity" value="${c.case.siteCity || ""}" ${raw(locked ? "disabled" : "")}></label></div></details>`;
}

function correctionActions(d, c, locked) {
  return html`<div class="correction-actions"><button class="btn" data-open="${c.targetId}">View previous version</button><button class="btn" id="btn-exportcorrection">Download draft changes</button><button class="btn" data-discard="${d.id}" ${raw(locked ? "disabled" : "")}>Discard correction</button><button class="btn" id="btn-reviewcorrection" ${raw(locked ? "disabled" : "")}>Review correction</button></div>`;
}

/* Restoring a withdrawn document is a correction, so it needs a real change; say so before the checklist does. */
const RESTORE_HINT = '<p class="hint">This restores a withdrawn document. A restore must change something in the document, not just its status.</p>';

function correctionPanelHTML(services, d, parts) {
  const c = d.correction,
    locked = !!d.pendingAmendment;
  return html`<section class="card correction-panel no-print"><div class="card-b"><div class="revision-eyebrow">Correction draft · revision ${raw(((correctionSource(d) || {}).revision || {}).number + 1 || 1)}</div><h2>Fix the record without losing its history</h2><p>The prior version remains on record while you work. Item numbers, inspection history and unchanged deadlines carry forward. Changed conditions belong in a new reinspection.</p>${raw(correctionSource(d)?.void ? RESTORE_HINT : "")}\n    ${raw("".concat(correctionNotices(locked)))}\n    ${raw("".concat(editor.state.amendmentError ? `<div class="banner alert" role="alert">${esc(editor.state.amendmentError)}</div>` : ""))}\n    <label class="f"><span>What was wrong, and why is this correction needed?</span><textarea id="correction-reason" rows="2" maxlength="1000" ${raw(locked ? "disabled" : "")}>${c.reason}</textarea></label>\n    <p class="hint">Changed case details are saved for future documents and current reports. The original issued copy remains unchanged. Case number stays fixed.</p>\n    ${raw("".concat(externalReferenceField(d, c, locked)))}\n    ${raw(propertyDetails(services, c, locked))}\n    ${raw(locked ? "" : parts.visitEditor(d))}\n    <details><summary>Compare with the issued version</summary>${raw(parts.diff(d))}</details>\n    ${raw(correctionActions(d, c, locked))}\n  </div></section>`;
}

export function createCorrectionUI(services) {
  function changeText(v) {
    return v == null
      ? "—"
      : typeof v === "boolean"
        ? v
          ? "Yes"
          : "No"
        : Array.isArray(v)
          ? v.map(changeText).join("; ")
          : typeof v === "object"
            ? Object.entries(v)
                .map(([k, x]) => k + ": " + changeText(x))
                .join("; ")
            : String(v) || "—";
  }

  function correctionValueText(path, value) {
    const match = /^citation\..+\.(base|amount|cc|assessments|overrideBasis)$/.exec(path);
    if (!match) return changeText(value);
    const currency = (v, integerCents = false) => {
      const n = integerCents ? (Number.isSafeInteger(v) && v >= 0 ? v : null) : cents(v);
      return n === null ? "—" : "$" + (n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    if (!["assessments", "overrideBasis"].includes(match[1])) return currency(value);
    if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
    const labels =
      match[1] === "overrideBasis"
        ? { baseCents: "Base", courtCents: "Court costs", totalCents: "Total" }
        : {
            base: "Base",
            penalty: "Penalty assessment",
            jail: "Jail assessment",
            crimeLab: "Crime lab",
            court: "Court costs",
            total: "Total",
          };
    return (
      Object.entries(value)
        .map(([key, v]) => (labels[key] || key) + ": " + (Object.hasOwn(labels, key) ? currency(v, true) : changeText(v)))
        .join("; ") || "—"
    );
  }

  function correctionDiffHTML(d) {
    const changes = services.correctionChanges(d);
    return html`<div class="change-table"><table><caption>Changes from the issued version</caption><thead><tr><th>Field</th><th>Previously issued</th><th>Correction draft</th></tr></thead><tbody>${raw(
      "".concat(
        changes
          .map(
            (c) =>
              "<tr><th>" +
              `${esc(c.label)}` +
              "</th><td>" +
              `${esc(correctionValueText(c.path, c.before))}` +
              "</td><td>" +
              `${esc(correctionValueText(c.path, c.after))}` +
              "</td></tr>",
          )
          .join("") || '<tr><td colspan="3">No changes yet.</td></tr>',
      ),
    )}</tbody></table></div>`;
  }

  function correctionPanel(d) {
    if (!d.correction) return "";
    return correctionPanelHTML(services, d, { visitEditor: correctionVisitEditor, diff: correctionDiffHTML });
  }

  function recordActionModal() {
    const mode = editor.state.modal,
      d = doc(editor.state.docId);
    if (!d || !["void", "recordnote", "reconcile"].includes(mode)) return "";
    const held = heldRecordAttempt(d, mode);
    return recordActionShell(d, mode, held);
  }

  function correctionVisitEditor(d) {
    const src = correctionSource(d),
      r = src && reinsp(src.fromReinspId);
    if (!r) return "";
    const allowed = DOC_TYPES.filter((t) => t.ready && services.correctionTypeAllowed(src, t.id));
    return html`<details class="correction-visit"><summary>Correct the recorded visit or follow-up type</summary><p class="hint">Use this only to correct a recording error from the same visit. It amends that visit in the audit trail without counting another inspection. New observations require a new reinspection.</p>\n    ${raw(
      "".concat(
        allowed.length > 1
          ? html`<label class="f"><span>Correct document type</span><select id="correction-type">${raw("".concat(allowed.map((t) => `<option value="${esc(t.id)}" ${t.id === d.type ? "selected" : ""}>${esc(t.label)}</option>`).join("")))}</select></label>`
          : "",
      ),
    )}\n    ${raw(
      "".concat(
        d.items
          .map((it) => {
            const res = r.results[it.srcItemId];
            if (!res || res.carried || it.withdrawn) return "";
            return (
              '<div class="grid g2"><label class="f"><span>Item ' +
              `${esc(it.no)}` +
              ' · recorded outcome</span><select data-correction-outcome="' +
              `${esc(it.id)}` +
              '">' +
              "".concat(
                OUTCOMES.map(
                  (o) =>
                    '<option value="' +
                    `${esc(o.id)}` +
                    '" ' +
                    `${((d.correction.outcomes || {})[it.id] || res.oc) === o.id ? "selected" : ""}` +
                    ">" +
                    `${esc(o.label)}` +
                    "</option>",
                ).join(""),
              ) +
              "</select></label>" +
              "".concat(
                it.done
                  ? html`<label class="f"><span>Compliance date</span><input type="date" data-field="doneOn" data-id="${it.id}" value="${it.doneOn}" max="${raw(recordDay(services.today))}"></label>`
                  : "",
              ) +
              "</div>"
            );
          })
          .join(""),
      ),
    )}</details>`;
  }
  return { correctionDiffHTML, correctionPanel, recordActionModal, ...(__TEST_BUILD__ ? { correctionValueText } : {}) };
}
