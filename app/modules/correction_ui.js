import { recordDay } from "../assets/shared.js";
import { isHistoryDoc, specialType } from "./document_rules.js";
import { cents } from "./citation_policy.js";
import { correctionSource, doc, kase, reinsp } from "./writer_queries.js";
import { DOC_TYPES, OUTCOMES } from "./document_types.js";
import { esc } from "./presentation_format.js";
import { INSPECTORS } from "./data/inspectors.js";
import { WriterState } from "./state.js";

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
    return (
      '<div class="change-table"><table><caption>Changes from the issued versio' +
      "n</caption><thead><tr><th>Field</th><th>Previously issued</th><th>Correc" +
      "tion draft</th></tr></thead><tbody>" +
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
      ) +
      "</tbody></table></div>"
    );
  }

  function correctionPanel(d) {
    if (!d.correction) return "";
    const c = d.correction,
      locked = !!d.pendingAmendment;
    return (
      '<section class="card correction-panel no-print"><div class="card-b"><div' +
      ' class="revision-eyebrow">Correction draft · revision ' +
      `${((correctionSource(d) || {}).revision || {}).number + 1 || 1}` +
      "</div><h2>Fix the record without losing its history</h2><p>The prior ver" +
      "sion remains on record while you work. Item numbers, inspection history " +
      "and unchanged deadlines carry forward. Changed conditions belong in a ne" +
      "w reinspection.</p>\n    " +
      "".concat(
        locked
          ? '<div class="banner warn">The save response was not confirmed. Retry the ' +
              "exact save to check the shared record before editing or discarding this " +
              'draft. <button class="btn" id="btn-retrycorrection">Retry save</button><' +
              "/div>"
          : "",
      ) +
      "\n    " +
      "".concat(WriterState.state.amendmentError ? `<div class="banner alert" role="alert">${esc(WriterState.state.amendmentError)}</div>` : "") +
      '\n    <label class="f"><span>What was wrong, and why is this correction n' +
      'eeded?</span><textarea id="correction-reason" rows="2" maxlength="1000" ' +
      `${locked ? "disabled" : ""}` +
      ">" +
      `${esc(c.reason)}` +
      '</textarea></label>\n    <p class="hint">Changed case details are saved f' +
      "or future documents and current reports. The original issued copy remain" +
      "s unchanged. Case number stays fixed.</p>\n    " +
      "".concat(
        d.type === "citation" || isHistoryDoc(d) || specialType(d.type)
          ? '<label class="f"><span>Court / City Attorney / division amendment instru' +
              'ctions or reference</span><textarea id="correction-external" rows="2" ' +
              `${locked ? "disabled" : ""}` +
              ">" +
              `${esc(c.externalReference)}` +
              '</textarea><span class="hint">Confirm the required process with the rece' +
              "iving office. Saving here does not amend an external court or attorney r" +
              "ecord.</span></label>"
          : "",
      ) +
      "\n    <details><summary>Property record details and original action date<" +
      '/summary><label class="f"><span>Original action date used in current rep' +
      'orts</span><input type="date" id="correction-action-date" value="' +
      `${esc(c.actionDate)}` +
      '" max="' +
      `${recordDay(services.today)}` +
      '" ' +
      `${locked ? "disabled" : ""}` +
      '><span class="hint">Keep this date unless the original issue date was re' +
      "corded incorrectly. This differs from the mailing date of this new corre" +
      "cted copy. A change is included in the review and audit trail.</span></l" +
      'abel><div class="grid g2"><label class="f"><span>Parcel</span><input dat' +
      'a-case="parcel" value="' +
      `${esc(c.case.parcel || "")}` +
      '" ' +
      `${locked ? "disabled" : ""}` +
      '></label><label class="f"><span>City / state / ZIP</span><input data-cas' +
      'e="siteCity" value="' +
      `${esc(c.case.siteCity || "")}` +
      '" ' +
      `${locked ? "disabled" : ""}` +
      "></label></div></details>\n    " +
      `${locked ? "" : correctionVisitEditor(d)}` +
      "\n    <details><summary>Compare with the issued version</summary>" +
      `${correctionDiffHTML(d)}` +
      '</details>\n    <div class="correction-actions"><button class="btn" data-' +
      'open="' +
      `${esc(c.targetId)}` +
      '">View previous version</button><button class="btn" id="btn-exportcorrec' +
      'tion">Download draft changes</button><button class="btn" data-discard="' +
      `${esc(d.id)}` +
      '" ' +
      `${locked ? "disabled" : ""}` +
      '>Discard correction</button><button class="btn" id="btn-reviewcorrection' +
      '" ' +
      `${locked ? "disabled" : ""}` +
      ">Review correction</button></div>\n  </div></section>"
    );
  }

  function recordActionModal() {
    const mode = WriterState.state.modal,
      d = doc(WriterState.state.docId);
    if (!d || !["void", "recordnote", "reconcile"].includes(mode)) return "";
    const kinds = { void: "document.voided", recordnote: "document.annotated", reconcile: "document.reconciled" };
    const held = Object.values(WriterState.RECORD_ATTEMPTS).find(
      (x) => x.cid === d.caseId && x.pendingAmendment.payload.docId === d.id && x.pendingAmendment.type === kinds[mode],
    );
    const heldPayload = held ? held.pendingAmendment.payload : null;
    const savedForm = WriterState.WORK.recordForms[d.id + ":" + mode] || {};
    const titles = { void: "Withdraw this document", recordnote: "Add a record note", reconcile: "Record follow-through" };
    const texts = {
      void:
        "Use a correction for an error that can be fixed. Withdrawal ends this do" +
        "cument without a replacement; the previous active document may become cu" +
        "rrent. Nothing is deleted. Review any affected recipients and external r" +
        "ecords.",
      recordnote:
        "Explain an error or clarification in an earlier record. This note does n" +
        "ot change the issued document, deadlines, inspection results or report c" +
        "ounts. Correct the latest document as well if it carries the same error.",
      reconcile:
        "Record completed notification and filing actions: recipients, date, deli" +
        "very method and Accela / court / attorney references as applicable. This" +
        " is your confirmation of work completed outside the program.",
    };
    return (
      '<div class="modal"><div class="modal-box" role="dialog" aria-modal="true' +
      '"><div class="modal-h"><h2>' +
      `${titles[mode]}` +
      '</h2></div><div class="modal-b"><p>' +
      "".concat(held ? "The previous save is awaiting confirmation. Retry its retained request before entering another change." : texts[mode]) +
      "</p>" +
      "".concat(WriterState.state.amendmentError ? `<div class="banner alert" role="alert">${esc(WriterState.state.amendmentError)}</div>` : "") +
      '<label class="f"><span>Inspector making this record change</span><select' +
      ' id="record-action-inspector" ' +
      `${held ? "disabled" : ""}` +
      ">" +
      "".concat(
        INSPECTORS.map(
          (i) =>
            '<option value="' +
            `${esc(i.id)}` +
            '" ' +
            `${i.id === (held ? held.pendingAmendment.by : kase(d.caseId).inspectorId) ? "selected" : ""}` +
            ">" +
            `${esc(i.name)}` +
            "</option>",
        ).join(""),
      ) +
      '</select></label><label class="f"><span>' +
      "".concat(mode === "void" ? "Reason for withdrawal" : mode === "reconcile" ? "Completed actions and references" : "Record note") +
      '</span><textarea id="record-action-text" rows="4" maxlength="4000" ' +
      `${held ? "disabled" : ""}` +
      ">" +
      "".concat(heldPayload ? esc(heldPayload.reason || heldPayload.text || heldPayload.reference) : esc(savedForm.text || "")) +
      "</textarea></label>" +
      "".concat(
        mode === "void" && (d.type === "citation" || isHistoryDoc(d) || specialType(d.type))
          ? '<label class="f"><span>Court / City Attorney instructions or reference</' +
              'span><textarea id="record-action-external" rows="2" ' +
              `${held ? "disabled" : ""}` +
              ">" +
              `${heldPayload ? esc(heldPayload.externalReference || "") : esc(savedForm.external || "")}` +
              "</textarea></label>"
          : "",
      ) +
      '</div><div class="modal-f"><button class="btn" data-close="modal">Cancel' +
      '</button><button class="btn" id="btn-savework">Save draft &amp; return to Workspace' +
      '</button><button class="btn btn-primary" id="record-action-go">' +
      `${held ? "Confirm previous save" : mode === "void" ? "Confirm withdrawal" : "Save to case record"}` +
      "</button></div></div></div>"
    );
  }

  function correctionVisitEditor(d) {
    const src = correctionSource(d),
      r = src && reinsp(src.fromReinspId);
    if (!r) return "";
    const allowed = DOC_TYPES.filter((t) => t.ready && services.correctionTypeAllowed(src, t.id));
    return (
      '<details class="correction-visit"><summary>Correct the recorded visit or' +
      ' follow-up type</summary><p class="hint">Use this only to correct a reco' +
      "rding error from the same visit. It amends that visit in the audit trail" +
      " without counting another inspection. New observations require a new rei" +
      "nspection.</p>\n    " +
      "".concat(
        allowed.length > 1
          ? '<label class="f"><span>Correct document type</span><select id="correctio' +
              'n-type">' +
              "".concat(allowed.map((t) => `<option value="${esc(t.id)}" ${t.id === d.type ? "selected" : ""}>${esc(t.label)}</option>`).join("")) +
              "</select></label>"
          : "",
      ) +
      "\n    " +
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
                  ? '<label class="f"><span>Compliance date</span><input type="date" data-fie' +
                      'ld="doneOn" data-id="' +
                      `${esc(it.id)}` +
                      '" value="' +
                      `${esc(it.doneOn)}` +
                      '" max="' +
                      `${recordDay(services.today)}` +
                      '"></label>'
                  : "",
              ) +
              "</div>"
            );
          })
          .join(""),
      ) +
      "</details>"
    );
  }
  return { correctionDiffHTML, correctionPanel, recordActionModal, ...(__TEST_BUILD__ ? { correctionValueText } : {}) };
}
