import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { recordDay } from "../assets/shared.js";
import { caseDetails, clone } from "./record_values.js";
import { doc, docCase, docInsp, docsFor, kase, recordHead } from "./writer_queries.js";

/* Issued fields a correction draft never inherits. */
const ISSUED_FIELDS = [
  "frozen",
  "void",
  "superseded",
  "annotations",
  "reconciliation",
  "accelaAt",
  "accelaRef",
  "filedAt",
  "filedRef",
  "issuedAt",
  "issuedBy",
  "eventId",
  "revision",
  "replaces",
  "emailedTo",
];

const emailKey = (e, addr) => addr.toLowerCase() + "|" + (e.kind || "Other");

/* Recipients from the case, the document and the issued copy, one row per address and kind; issued rows win. */
function recipientRows(src) {
  const savedEmails = (Array.isArray(kase(src.caseId).emails) ? kase(src.caseId).emails : []).concat(
    Array.isArray(docCase(src).emails) ? docCase(src).emails : [],
  );
  const issuedEmails = Array.isArray(src.emailedTo) ? src.emailedTo : [];
  const allEmails = savedEmails.concat(issuedEmails.map((e) => ({ addr: e.addr, kind: e.kind || "Other", on: true })));
  const emailMap = new Map();
  allEmails.forEach((e) => {
    const addr = String(e.addr || "").trim();
    if (addr) {
      const key = emailKey(e, addr);
      if (!emailMap.has(key)) emailMap.set(key, Object.assign({}, e, { addr }));
    }
  });
  issuedEmails.forEach((e) => {
    const addr = String(e.addr || "").trim();
    if (addr) emailMap.set(emailKey(e, addr), { addr, kind: e.kind || "Other", on: true });
  });
  return Array.from(emailMap.values());
}

function correctionRecord(services, src) {
  return {
    targetId: src.id,
    baseEventId: src.eventId,
    expectedHead: recordHead(src.caseId),
    reason: "",
    case: clone(docCase(src)),
    caseBaseline: caseDetails(kase(src.caseId)),
    body: services.docBody(src),
    blocks: clone(services.docBlocks(src)),
    updateCase: true,
    externalReference: "",
    reviewed: false,
    outcomes: {},
    actionDate: (src.revision && (src.revision.actionDate || src.revision.originalIssued)) || src.mailed || recordDay(src.issuedAt),
  };
}

function correctionDraft(services, src) {
  const d = clone(src);
  ISSUED_FIELDS.forEach((k) => delete d[k]);
  const emailRows = recipientRows(src);
  d.id = services.uid("d");
  d.draft = true;
  d.status = "Draft";
  d.created = recordDay(services.today);
  d.mailed = recordDay(services.today);
  d.inspectorId = kase(src.caseId).inspectorId || docInsp(src).id;
  d.correction = correctionRecord(services, src);
  d.correction.case.emails = emailRows;
  d.emailSelection = emailRows.filter((e) => e.on !== false).map((e) => e.addr + "|" + (e.kind || "Other"));
  return d;
}

// Opening and issuing corrections delegate preparation, confirmation and original PDF authority.
export function createCorrectionWorkflow(services) {
  function startCorrection(docId) {
    const existing = docsFor((doc(docId) || {}).caseId).find((x) => x.draft && x.correction && x.correction.targetId === docId);
    if (existing) {
      editor.state.docId = existing.id;
      editor.state.screen = "write";
      services.render();
      return existing;
    }
    const src = doc(docId),
      fault = services.correctionEligibility(src);
    if (fault) {
      services.toast(fault);
      return null;
    }
    const d = correctionDraft(services, src);
    workspace.DOCS.unshift(d);
    editor.state.docId = d.id;
    editor.state.screen = "write";
    workspace.DIRTY = true;
    services.saveDrafts();
    services.render();
    services.toast("Correction draft opened. The issued record is unchanged until you review and save.");
    return d;
  }

  async function issueCorrection(d) {
    if (d && services.recordIntegrity.blocked(d.caseId)) {
      services.toast("This record was changed outside the program. Open read-only and refer it for review.");
      return false;
    }
    if (!d || !d.correction) return false;
    if (!d.pendingAmendment) services.commitCitationEdits(d);
    if (!d.pendingAmendment && d.type === "citation" && !(await services.citationPricing.loadShared(d, true))) {
      editor.state.amendmentError = "Shared citation history could not be checked. Reconnect before correcting the citation.";
      await services.saveDrafts();
      services.render();
      return false;
    }
    if (!d.pendingAmendment && (services.blockers(d).length || !d.correction.reviewed)) {
      services.toast("Review the changes and resolve the checks before issuing the correction.");
      return false;
    }
    const attempt = d.pendingAmendment || services.makeCorrectionAttempt(d);
    if (!(await services.commitAmendment(d.caseId, attempt, d))) {
      editor.state.modal = null;
      services.render();
      return false;
    }
    editor.state.modal = null;
    editor.state.amendmentError = "";
    editor.state.docId = d.id;
    editor.state.screen = "write";
    services.render();
    services.scrollTo(0, 0);
    const issued = doc(d.id),
      sendEmail = !!issued.emailedTo && issued.emailedTo.length > 0;
    try {
      const job = services.printJob(issued);
      if (!(await services.filePdf(issued, job))) services.toast("Correction saved. Use File issued PDF to produce its copy.");
      else if (sendEmail) await services.emailDocument(issued, clone(issued.emailedTo), true, job);
    } catch (e) {
      services.toast("Correction saved; PDF filing needs a retry.");
    }
    services.render();
    return true;
  }
  return { startCorrection, issueCorrection };
}
