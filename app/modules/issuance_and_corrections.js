import { project } from "./case_records.js";
import { inspAt } from "./inspection_facts.js";

import { deliveredByCitation, isEffective } from "./document_rules.js";
import { canonicalOrdinance } from "./citation_policy.js";
import { recordDay } from "../assets/shared.js";
import { applyDeposit, citationNumber, fmtDate, nextCourtDate, toast } from "./court_and_deposits.js";
import { appendEvent, sourceDocFor } from "./workspace_shell.js";
import { clone } from "./record_values.js";

import {
  ensureWalkContext,
  publishDocument,
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

import { courtTime } from "./document_types.js";

import { doc, docInsp, docsFor, draftDocFor, draftReinspFor, kase, recordHead } from "./writer_queries.js";

import { emailList } from "./mailing_rules.js";
import { esc } from "./presentation_format.js";

import { WriterState } from "./state.js";
/* app functions; direct dependencies use explicit shared state. */

function citationTier(caseId, no) {
  const n = priorCitations(caseId, no);
  return n === 0 ? "1st" : n === 1 ? "2nd" : "3rd+";
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

// Presentation only: citation base/amount are dollars, assessment components are integer cents.

// History presentation is separate from referral classification/eligibility.

/* R60: follow retained item IDs through source documents, never item numbers. A carried result is not
   another observation. Only the current worksheet and recorded visits may contribute to a new referral. */

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
  runFinalize,
  citationFromNotice,
  recordReinspection,
  hasSetupWork,
  importResumePanel,
  workingNotesPanel,
  filingPanel,
  needsInitialCitation,
  citationRecoveryPanel,
  captureWork,
};
