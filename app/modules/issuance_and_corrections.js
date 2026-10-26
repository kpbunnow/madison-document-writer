import { project } from "./case_records.js";
import { inspAt } from "./inspection_facts.js";

import { deliveredByCitation, isEffective, isHistoryDoc, specialType } from "./document_rules.js";
import { cents, canonicalOrdinance } from "./citation_policy.js";
import { recordDay } from "../assets/shared.js";
import { applyDeposit, citationNumber, fmtDate, nextCourtDate, toast } from "./court_and_deposits.js";
import { appendEvent, evid, sourceDocFor } from "./workspace_shell.js";
import { clone } from "./record_values.js";

import {
  ensureWalkContext,
  commitAmendment,
  publishDocument,
  correctionChanges,
  correctionEligibility,
  correctionTypeAllowed,
  correctionVisitPatch,
  issueCorrection,
  ENTRY_IDS,
  depositStep,
  recordFormKey,
  uid,
  saveDrafts,
  unissuedVisitFor,
} from "./app_core.js";
import { priorCitations, render } from "./app_screens.js";
import { cleanVisit } from "./worksheet_workflow.js";

import { DOC_TYPES, OUTCOMES, courtTime } from "./document_types.js";

import {
  correctionSource,
  doc,
  docInsp,
  docsFor,
  draftDocFor,
  draftReinspFor,
  insp,
  kase,
  recordHead,
  recordNow,
  reinsp,
  reinspFor,
} from "./writer_queries.js";

import { emailList } from "./mailing_rules.js";
import { esc } from "./presentation_format.js";
import { INSPECTORS } from "./data/inspectors.js";

import { WriterState } from "./state.js";
/* app functions; direct dependencies use explicit shared state. */

function citationTier(caseId, no) {
  const n = priorCitations(caseId, no);
  return n === 0 ? "1st" : n === 1 ? "2nd" : "3rd+";
}

function itemHistory(caseId, no) {
  // every citation raised on this item, with the visit it came from
  const cits = [];
  docsFor(caseId).forEach((x) => {
    if (x.draft || x.void || x.superseded || x.type !== "citation") return;
    const ci = x.items.find((i) => String(i.no) === String(no) && i.cite && !i.withdrawn);
    if (!ci) return;
    const c = (x.cits || {})[ci.id] || {};
    if (c.num) cits.push({ num: c.num, from: String(x.fromReinspId || ""), issued: c.issued || x.mailed || "" });
  });
  const used = {};
  const out = [];
  reinspFor(caseId)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .forEach((r) => {
      const src = doc(r.sourceDocId);
      if (!src) return;
      const it = src.items.find((x) => String(x.no) === String(no));
      if (!it) return;
      const res = r.results[it.id];
      if (!res || !res.oc) return;
      const hit = cits.find((c) => c.from === String(r.id) && !used[c.num]);
      if (hit) used[hit.num] = 1;
      out.push({ visitId: r.id, on: res.on || r.date, oc: res.oc, note: String(res.note || "").trim(), cit: hit ? hit.num : "" });
    });
  // a citation issued with the original notice has no visit behind it, so it
  // is listed on its own line rather than dropped
  cits
    .filter((c) => !used[c.num])
    .forEach((c) => {
      out.unshift({ on: c.issued || "", oc: "cited", note: "", cit: c.num });
    });
  return out;
}

function runFinalize(d) {
  if (!d || !d.draft) return;
  return d.correction ? issueCorrection(d) : publishDocument(d);
}

function citationFromNotice(noticeId) {
  const src = doc(noticeId);
  if (!src) return null;
  const existing = docsFor(src.caseId).find((d) => d.type === "citation" && d.fromDocId === src.id && !d.fromReinspId);
  if (existing) return existing;
  const cited = src.items.filter((i) => i.cite && !i.done && !i.withdrawn);
  if (!cited.length) return null;
  const nd = {
    id: uid("d"),
    caseId: src.caseId,
    type: "citation",
    created: recordDay(today),
    status: "Draft",
    draft: true,
    mailed: recordDay(today),
    cc: "",
    cits: {},
    fromDocId: src.id,
    expectedHead: recordHead(src.caseId),
    inspectorId: docInsp(src).id,
    inspDate: inspAt(src).date,
    inspTime: inspAt(src).time || "",
    items: src.items.map((it) => ({
      ...it,
      id: uid("x"),
      srcItemId: it.id,
      done: !!it.done,
      doneOn: it.doneOn || "",
      cite: !!it.cite && !it.done && !it.withdrawn,
      hist: null,
    })),
  };
  WriterState.DOCS.unshift(nd);
  nd.items
    .filter((i) => i.cite)
    .forEach((i) => {
      const sections = (i.sections || []).map(canonicalOrdinance),
        ord = sections.length === 1 ? sections[0] : "";
      nd.cits[i.id] = {
        deptId: docInsp(src).badge || "",
        num: citationNumber(),
        courtTime: courtTime(),
        comment:
          "Inspection on " +
          fmtDate(inspAt(src).date) +
          " documented the following violation: " +
          String(i.title || "").replace(/\.$/, "") +
          ". This citation relates to the Official Notice dated " +
          fmtDate(src.mailed) +
          ".",
        ord,
        preparedSections: sections,
        autoFilledCharge: !!ord,
        desc: String(i.title || "").toUpperCase(),
        issued: nd.mailed,
        courtDate: nextCourtDate(nd.mailed),
        depositMode: "schedule",
      };
      applyDeposit(nd, i.id, ord);
    });
  WriterState.DIRTY = true;
  saveDrafts();
  depositStep.openNext(nd);
  return nd;
}

function recordReinspection(r, quiet) {
  if (!r || !r.draft) return null;
  const snap = cleanVisit(r);
  const ev = appendEvent(r.caseId, "reinspection.recorded", { reinspId: r.id, reinspection: snap, sourceDocId: r.sourceDocId }, null, r.inspectorId);
  WriterState.REINSP = WriterState.REINSP.filter((x) => x.id !== r.id);
  project();
  saveDrafts();
  if (!quiet) {
    toast("Reinspection of " + fmtDate(r.date) + " recorded");
    render();
  }
  return ev;
}

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

// Presentation only: citation base/amount are dollars, assessment components are integer cents.
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

// History presentation is separate from referral classification/eligibility.
export const hasItemInspectionHistory = (d) =>
  !!d && ((isHistoryDoc(d) && d.authoringVersion >= 14) || (d.type === "compliance" && d.authoringVersion >= 15));

async function voidDocument(docId, reason, externalReference = "", actor = "") {
  const d = doc(docId),
    fault = correctionEligibility(d);
  if (fault || d.void || String(reason || "").trim().length < 10) {
    toast(fault || "Provide a specific reason of at least 10 characters.");
    return false;
  }
  if ((d.type === "citation" || isHistoryDoc(d) || specialType(d.type)) && String(externalReference).trim().length < 10) {
    toast("Record the court or City Attorney withdrawal instructions / reference.");
    return false;
  }
  const attempt = {
    id: evid(),
    at: recordNow(d.caseId),
    by: actor || kase(d.caseId).inspectorId,
    type: "document.voided",
    payload: { docId, reason: reason.trim(), externalReference, expectedHead: recordHead(d.caseId) },
  };
  if (!(await commitRecordAttempt(d.caseId, attempt))) return false;
  WriterState.state.modal = null;
  render();
  toast("Document withdrawn. Its original and reason remain in the case history.");
  return true;
}

async function addRecordNote(docId, text, actor = "") {
  const d = doc(docId);
  if (!d || d.draft || String(text || "").trim().length < 10) {
    toast("Enter a specific record note (at least 10 characters).");
    return false;
  }
  const attempt = {
    id: evid(),
    at: recordNow(d.caseId),
    by: actor || kase(d.caseId).inspectorId,
    type: "document.annotated",
    payload: { docId, text: text.trim() },
  };
  if (!(await commitRecordAttempt(d.caseId, attempt))) return false;
  WriterState.state.modal = null;
  render();
  toast("Record note saved. The issued document is unchanged.");
  return true;
}

async function reconcileDocument(docId, reference, actor = "") {
  const d = doc(docId);
  if (!d || d.draft || String(reference || "").trim().length < 10) {
    toast("Record who was notified, when, and the filing reference (at least 10 characters).");
    return false;
  }
  const attempt = {
    id: evid(),
    at: recordNow(d.caseId),
    by: actor || kase(d.caseId).inspectorId,
    type: "document.reconciled",
    payload: { docId, reference: reference.trim() },
  };
  if (!(await commitRecordAttempt(d.caseId, attempt))) return false;
  WriterState.state.modal = null;
  render();
  toast("Follow-through recorded.");
  return true;
}

function correctionDiffHTML(d) {
  const changes = correctionChanges(d);
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
    `${recordDay(today)}` +
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

function recordHistoryHTML(d) {
  if (d.draft) return "";
  const chain = docsFor(d.caseId)
    .filter((x) => !x.draft && ((x.revision || {}).rootId || x.id) === ((d.revision || {}).rootId || d.id))
    .slice()
    .reverse();
  const notes = d.annotations || [],
    follow = !!d.void,
    pending = follow && !d.reconciliation;
  const finishing = !!WriterState.state.publicationBusy && doc(WriterState.state.publicationBusy)?.caseId === d.caseId;
  return (
    '<section class="card record-history no-print"><div class="card-b"><h2>Do' +
    "cument record</h2>\n    " +
    "".concat(
      pending
        ? '<div class="banner warn"><div><strong>Follow-through still needs recordi' +
            "ng.</strong> Notify affected recipients and update Accela and any court " +
            "/ attorney records as applicable. Opening an email draft does not confir" +
            'm delivery. <button class="btn" id="btn-reconcile">Record follow-through' +
            "</button></div></div>"
        : d.reconciliation
          ? "<p>Follow-through recorded by " +
            `${esc(insp(d.reconciliation.by).name || d.reconciliation.by)}` +
            " on " +
            `${esc(fmtDate(recordDay(d.reconciliation.at)))}` +
            ": " +
            `${esc(d.reconciliation.reference)}` +
            "</p>"
          : "",
    ) +
    "\n    " +
    "".concat(
      Object.values(WriterState.RECORD_ATTEMPTS)
        .filter((x) => x.cid === d.caseId && x.pendingAmendment.payload.docId === d.id)
        .map(
          (x) =>
            '<div class="banner warn">A record change is awaiting save confirmation. ' +
            'Its exact request is retained. <button class="btn" data-resumerecord="' +
            `${esc(x.recordKey)}` +
            '">Confirm save</button></div>',
        )
        .join(""),
    ) +
    "\n    <details><summary>Version history · " +
    `${chain.length}` +
    " " +
    `${chain.length === 1 ? "version" : "versions"}` +
    "" +
    `${notes.length ? " · " + notes.length + " record notes" : ""}` +
    '</summary><ol class="record-chain">' +
    "".concat(
      chain
        .map(
          (x) =>
            '<li><button class="lnk" data-open="' +
            `${esc(x.id)}` +
            '">' +
            `${x.revision ? "Revision " + x.revision.number : "Original"}` +
            " · " +
            `${esc(fmtDate(recordDay((x.revision && x.revision.at) || x.issuedAt)))}` +
            "</button> <span>" +
            `${x.superseded ? "Replaced" : x.void ? "Withdrawn" : "Current version"}` +
            "</span>" +
            `${x.revision ? `<p>${esc(x.revision.reason)}</p>` : ""}` +
            "</li>",
        )
        .join(""),
    ) +
    "</ol>\n    " +
    "".concat(
      notes.length
        ? "<h3>Record notes</h3>" +
            "".concat(
              notes
                .map(
                  (n) =>
                    "<p><strong>" +
                    `${esc(fmtDate(recordDay(n.at)))}` +
                    " · " +
                    `${esc(insp(n.by).name || n.by)}` +
                    "</strong><br>" +
                    `${esc(n.text)}` +
                    "</p>",
                )
                .join(""),
            ) +
            ""
        : '<p class="hint">Record notes explain earlier errors without changing the issued copy.</p>',
    ) +
    "\n    </details>" +
    "".concat(finishing ? '<p class="hint" id="record-save-progress" role="status">Finishing document save…</p>' : "") +
    '<div class="correction-actions"><button class="btn" id="btn-recordnote" ' +
    `${finishing ? 'disabled aria-describedby="record-save-progress"' : ""}` +
    '>Add record note</button> <button class="btn" id="btn-original">Print or' +
    "iginal issued copy</button></div></div></section>"
  );
}

function revisionPrintNote(d) {
  if (d.draft) return '<div class="revision-print"><strong>DRAFT · NOT ISSUED</strong></div>';
  const r = d.revision;
  if (!r) return "";
  return (
    '<div class="revision-print"><strong>CORRECTED DOCUMENT · Revision ' +
    `${esc(r.number)}` +
    "</strong><br>Replaces document " +
    `${esc(r.targetId)}` +
    ", originally issued " +
    `${esc(fmtDate(r.originalIssued))}` +
    ". This revision: " +
    `${esc(d.id)}` +
    ".<br>" +
    `${esc(r.reason)}` +
    "</div>"
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

/* R60: follow retained item IDs through source documents, never item numbers. A carried result is not
   another observation. Only the current worksheet and recorded visits may contribute to a new referral. */
function itemInspectionHistory(d, it) {
  const lineage = new Map(),
    seen = new Set();
  let source = d,
    item = it,
    initial = null,
    rootId = "";
  while (source && item && !seen.has(source.id)) {
    seen.add(source.id);
    lineage.set(source.id, item.id);
    const previous = doc(source.fromDocId || reinsp(source.fromReinspId)?.sourceDocId);
    if (!previous) {
      if (!source.fromDocId && !source.fromReinspId) {
        initial = { on: inspAt(source).date, oc: "initial", note: "", cit: "" };
        rootId = source.id;
      }
      break;
    }
    const prior = previous.items.find((x) => x.id === item.srcItemId);
    if (!prior) {
      if (!item.srcItemId) {
        initial = { on: inspAt(source).date, oc: "initial", note: "", cit: "" };
        rootId = source.id;
      }
      break;
    }
    source = previous;
    item = prior;
  }
  const rows = [initial || { on: "", oc: "initial", note: "", cit: "" }];
  for (const visit of reinspFor(d.caseId)) {
    if (visit.draft && visit.id !== d.fromReinspId) continue;
    const id = lineage.get(visit.sourceDocId),
      result = id && visit.results?.[id];
    if (!result?.oc || result.carried || result.oc === "withdrawn") continue;
    rows.push({
      visitId: visit.id,
      on: result.manualDate ? result.on : result.on || visit.date,
      oc: result.oc,
      note: String(result.note || "").trim(),
      cit: "",
    });
  }
  // Citation metadata may annotate an observed visit, but issue dates never create inspection observations.
  // A citation issued with (or in place of) the original notice annotates the first observation; its
  // number would otherwise be lost from the referral, as earlier history formats retain it.
  if (initial && rootId) {
    const rootItem = lineage.get(rootId);
    for (const citation of docsFor(d.caseId)) {
      if (citation.draft || citation.void || citation.superseded || citation.type !== "citation" || citation.fromReinspId) continue;
      const cited =
        citation.id === rootId
          ? citation.items.find((x) => x.id === rootItem && x.cite && !x.withdrawn)
          : citation.fromDocId === rootId && citation.items.find((x) => x.srcItemId === rootItem && x.cite && !x.withdrawn);
      if (cited && citation.cits?.[cited.id]?.num) initial.cit = citation.cits[cited.id].num;
    }
  }
  for (const row of rows) {
    if (!row.visitId) continue;
    for (const citation of docsFor(d.caseId)) {
      if (citation.draft || citation.void || citation.superseded || citation.type !== "citation" || citation.fromReinspId !== row.visitId) continue;
      const observedId = lineage.get(citation.fromDocId);
      const cited = citation.items.find((x) => x.srcItemId === observedId && x.cite && !x.withdrawn);
      if (cited && citation.cits?.[cited.id]?.num) row.cit = citation.cits[cited.id].num;
    }
  }
  return rows.sort((a, b) => String(a.on || "").localeCompare(String(b.on || "")) || String(a.visitId || "").localeCompare(String(b.visitId || "")));
}

function documentItemHistory(d, it) {
  if (!d.correction || (!isHistoryDoc(d) && !hasItemInspectionHistory(d))) return it.hist || [];
  const patch = correctionVisitPatch(d),
    r = patch && reinsp(patch.id);
  if (!r) return it.hist || [];
  const res = patch.results[it.srcItemId] || r.results[it.srcItemId];
  return (d.authoringVersion >= 14 ? it.hist || [] : itemHistory(d.caseId, it.no)).map((x) =>
    x.visitId === r.id && res ? { ...x, on: res.on || patch.date, oc: res.oc, note: res.note || "" } : x,
  );
}

function correctionVisitEditor(d) {
  const src = correctionSource(d),
    r = src && reinsp(src.fromReinspId);
  if (!r) return "";
  const allowed = DOC_TYPES.filter((t) => t.ready && correctionTypeAllowed(src, t.id));
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
                    `${recordDay(today)}` +
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

async function commitRecordAttempt(cid, attempt) {
  const key = cid + "_" + attempt.payload.docId + "_" + attempt.type.replace(/[^a-z]/gi, "");
  const holder = WriterState.RECORD_ATTEMPTS[key] || { id: null, cid, recordKey: key, pendingAmendment: attempt };
  WriterState.RECORD_ATTEMPTS[key] = holder;
  return commitAmendment(cid, holder.pendingAmendment, holder);
}

function hasSetupWork() {
  return !!WriterState.state.acc || !!String(WriterState.WORK.entry?.["lookup-number"] || "").trim();
}

function importResumePanel() {
  const acc = WriterState.state.acc || WriterState.WORK.acc;
  if (acc) {
    const c = acc.cases && acc.cases[acc.caseIx || 0],
      number = c && c.number,
      address = c && c.address;
    const detail = [number, address].filter(Boolean).join(" · ");
    const issue = acc.shareError ? "The shared record needs attention before you can confirm." : "";
    return (
      '<section class="attention-import" aria-label="Import awaiting review"><d' +
      'iv class="attention-import-copy"><span class="attention-eyebrow">Import ' +
      "awaiting review</span><strong>" +
      `${esc(detail || acc.fileName || "Inspection result")}` +
      "</strong><span>" +
      `${esc(issue || "Review the inspection result and confirm what to do next.")}` +
      '</span></div><button class="btn btn-primary" data-nav="import">Review im' +
      "port</button></section>"
    );
  }
  const number = String(WriterState.WORK.entry?.["lookup-number"] || "").trim();
  return number
    ? '<section class="attention-import" aria-label="Import in progress"><div c' +
        'lass="attention-import-copy"><span class="attention-eyebrow">Import in p' +
        "rogress</span><strong>Case " +
        `${esc(number)}` +
        "</strong><span>Your case search is saved on this device.</span></div><bu" +
        'tton class="btn btn-primary" data-nav="import">Continue search</button><' +
        "/section>"
    : "";
}

function workingNotesPanel() {
  const forms = Object.entries(WriterState.WORK.recordForms || {}).filter(
    ([key, v]) => doc(key.slice(0, key.lastIndexOf(":"))) && String(v.text || v.external || "").trim(),
  );
  if (!forms.length) return "";
  const names = { void: "withdrawal review", recordnote: "record note", reconcile: "follow-through" };
  return (
    '<div class="banner info"><div><strong>Record work in progress</strong><div class="doclinks">' +
    forms
      .map(([key]) => {
        const cut = key.lastIndexOf(":"),
          d = doc(key.slice(0, cut));
        return (
          '<button class="btn" data-worknote="' +
          esc(key) +
          '">Continue ' +
          esc(names[key.slice(cut + 1)] || "record work") +
          " · " +
          esc(kase(d.caseId).number) +
          "</button>"
        );
      })
      .join("") +
    "</div></div></div>"
  );
}

function filingPanel(d) {
  if (!d || d.draft || d.void || d.superseded || d.filedAt) return "";
  if (deliveredByCitation(d))
    return (
      '<div class="banner info no-print"><div><strong>Delivered within the cita' +
      "tion.</strong> This Official Notice record holds the case deadlines. It " +
      "was not mailed separately; the citation letter carried its order languag" +
      "e.</div></div>"
    );
  return (
    '<div class="banner warn no-print"><div><strong>PDF filing needed.</stron' +
    'g> The case record is issued. <button class="btn" id="btn-retryfiling">F' +
    "ile issued PDF</button> Keep any manually saved copy with the case recor" +
    "d.</div></div>"
  );
}

function needsInitialCitation(d) {
  return (
    !!d &&
    isEffective(d) &&
    d.type === "notice" &&
    sourceDocFor(d.caseId)?.id === d.id &&
    d.items.some((i) => i.cite && !i.withdrawn) &&
    !draftDocFor(d.caseId) &&
    !draftReinspFor(d.caseId) &&
    !unissuedVisitFor(d.caseId) &&
    !docsFor(d.caseId).some((x) => x.type === "citation" && x.fromDocId === d.id && !x.fromReinspId)
  );
}

function citationRecoveryPanel(d) {
  return needsInitialCitation(d)
    ? '<div class="banner info no-print"><div><strong>This notice has items sel' +
        'ected for citation.</strong> <button class="btn" id="btn-continuecitatio' +
        'n">Create citation draft</button></div></div>'
    : "";
}

function captureWork() {
  if (WriterState.state.screen === "reinspect" && WriterState.state.riWalk && ensureWalkContext())
    WriterState.WORK.walk = {
      context: WriterState.state.riWalkContext,
      item: WriterState.state.riWalkItem,
      undo: clone(WriterState.state.riWalkUndo),
      skipped: clone(WriterState.state.riWalkSkipped),
      mode: WriterState.state.riWalkMode,
      stage: WriterState.state.riWalkStage,
    };
  // Input/change listeners own every edit, including an explicit clear. A finishing save must not capture a transient empty control over typed work.
  if (WriterState.state.screen === "import")
    ENTRY_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && WriterState.WORK.entry[id] === undefined) WriterState.WORK.entry[id] = el.value;
    });
  WriterState.WORK.acc = WriterState.state.acc ? clone(WriterState.state.acc) : null;
  if (WriterState.state.modal === "final") {
    const d = doc(WriterState.state.docId),
      boxes = [...document.querySelectorAll("[data-finsend]")];
    if (d && d.draft && !d.pendingAmendment && boxes.length) {
      const list = emailList(kase(d.caseId)).filter((e) => String(e.addr || "").trim());
      d.emailSelection = boxes
        .filter((b) => b.checked)
        .map((b) => list[+b.dataset.finsend])
        .filter(Boolean)
        .map((e) => e.addr + "|" + (e.kind || "Other"));
    }
  }
  if (["void", "recordnote", "reconcile"].includes(WriterState.state.modal)) {
    const text = document.getElementById("record-action-text");
    /* R35: the input listener records every user edit (including clearing a field). A re-rendered dialog can briefly
       show empty fields, and saves call captureWork, so the DOM fills only fields never recorded; it never overwrites typed text. */
    if (text) {
      const key = recordFormKey(),
        prev = WriterState.WORK.recordForms[key] || {},
        dom = {
          text: text.value,
          external: (document.getElementById("record-action-external") || {}).value || "",
          actor: (document.getElementById("record-action-inspector") || {}).value || "",
        };
      WriterState.WORK.recordForms[key] = Object.fromEntries(Object.keys(dom).map((f) => [f, prev[f] !== undefined ? prev[f] : dom[f]]));
    }
  }
}

export {
  citationTier,
  itemHistory,
  runFinalize,
  citationFromNotice,
  recordReinspection,
  voidDocument,
  addRecordNote,
  reconcileDocument,
  correctionDiffHTML,
  correctionPanel,
  recordHistoryHTML,
  revisionPrintNote,
  recordActionModal,
  documentItemHistory,
  itemInspectionHistory,
  commitRecordAttempt,
  hasSetupWork,
  importResumePanel,
  workingNotesPanel,
  filingPanel,
  needsInitialCitation,
  citationRecoveryPanel,
  captureWork,
};
