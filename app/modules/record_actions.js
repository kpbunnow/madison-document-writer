import { isHistoryDoc, specialType } from "./document_rules.js";
import { doc, kase, recordHead, recordNow } from "./writer_queries.js";
import { WriterState } from "./state.js";

export function createRecordActions(services) {
  function runFinalize(d) {
    if (!d || !d.draft) return;
    return d.correction ? services.issueCorrection(d) : services.publishDocument(d);
  }
  async function voidDocument(docId, reason, externalReference = "", actor = "") {
    const d = doc(docId),
      fault = services.correctionEligibility(d);
    if (fault || d.void || String(reason || "").trim().length < 10) {
      services.toast(fault || "Provide a specific reason of at least 10 characters.");
      return false;
    }
    if ((d.type === "citation" || isHistoryDoc(d) || specialType(d.type)) && String(externalReference).trim().length < 10) {
      services.toast("Record the court or City Attorney withdrawal instructions / reference.");
      return false;
    }
    const attempt = {
      id: services.evid(),
      at: recordNow(d.caseId),
      by: actor || kase(d.caseId).inspectorId,
      type: "document.voided",
      payload: { docId, reason: reason.trim(), externalReference, expectedHead: recordHead(d.caseId) },
    };
    if (!(await commitRecordAttempt(d.caseId, attempt))) return false;
    WriterState.state.modal = null;
    services.render();
    services.toast("Document withdrawn. Its original and reason remain in the case history.");
    return true;
  }

  async function addRecordNote(docId, text, actor = "") {
    const d = doc(docId);
    if (!d || d.draft || String(text || "").trim().length < 10) {
      services.toast("Enter a specific record note (at least 10 characters).");
      return false;
    }
    const attempt = {
      id: services.evid(),
      at: recordNow(d.caseId),
      by: actor || kase(d.caseId).inspectorId,
      type: "document.annotated",
      payload: { docId, text: text.trim() },
    };
    if (!(await commitRecordAttempt(d.caseId, attempt))) return false;
    WriterState.state.modal = null;
    services.render();
    services.toast("Record note saved. The issued document is unchanged.");
    return true;
  }

  async function reconcileDocument(docId, reference, actor = "") {
    const d = doc(docId);
    if (!d || d.draft || String(reference || "").trim().length < 10) {
      services.toast("Record who was notified, when, and the filing reference (at least 10 characters).");
      return false;
    }
    const attempt = {
      id: services.evid(),
      at: recordNow(d.caseId),
      by: actor || kase(d.caseId).inspectorId,
      type: "document.reconciled",
      payload: { docId, reference: reference.trim() },
    };
    if (!(await commitRecordAttempt(d.caseId, attempt))) return false;
    WriterState.state.modal = null;
    services.render();
    services.toast("Follow-through recorded.");
    return true;
  }

  async function commitRecordAttempt(cid, attempt) {
    const key = cid + "_" + attempt.payload.docId + "_" + attempt.type.replace(/[^a-z]/gi, "");
    const holder = WriterState.RECORD_ATTEMPTS[key] || { id: null, cid, recordKey: key, pendingAmendment: attempt };
    WriterState.RECORD_ATTEMPTS[key] = holder;
    return services.commitAmendment(cid, holder.pendingAmendment, holder);
  }
  return { runFinalize, voidDocument, addRecordNote, reconcileDocument, commitRecordAttempt };
}
