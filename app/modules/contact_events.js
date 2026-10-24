/* Contact event ownership. Construction is inert; core registers at the original startup positions. */
import { WriterState } from "./state.js";
import { doc, kase, docCase } from "./writer_queries.js";
import { emailList, isLLC, ccList } from "./mailing_rules.js";
import { esc } from "./presentation_format.js";
export function createContactEvents(services) {
  const openRecipients = () => {
    WriterState.state.ccProblem = null;
    WriterState.state.modal = "cc";
    services.render();
    return;
  };

  const addCopy = () => {
    WriterState.state.ccProblem = null;
    services.addCC(doc(WriterState.state.docId).caseId);
    return;
  };

  const addRecipient = () => {
    WriterState.state.ccProblem = null;
    services.addEmail(doc(WriterState.state.docId).caseId);
    return;
  };

  const removeCopy = (t) => {
    WriterState.state.ccProblem = null;
    services.removeCC(doc(WriterState.state.docId).caseId, +t.dataset.rmcc);
    return;
  };

  const removeRecipient = (t) => {
    WriterState.state.ccProblem = null;
    services.removeEmail(doc(WriterState.state.docId).caseId, +t.dataset.rmem);
    return;
  };

  const emailDocument = () => {
    const dd = doc(WriterState.state.docId);
    if (dd) services.emailDocument(dd);
    return;
  };

  const sendDocument = (t) => {
    const dd = doc(WriterState.state.sendDoc) || doc(WriterState.state.docId);
    const k = dd ? kase(dd.caseId) : null;
    const list = k ? emailList(k).filter((e) => String(e.addr || "").trim()) : [];
    const picked =
      t.id === "btn-sendnone"
        ? []
        : list.filter((_, ix) => {
            const box = document.querySelector('[data-sendto="' + ix + '"]');
            return box && box.checked;
          });
    const job = WriterState.state.sendJob,
      reuse = WriterState.state.sendReuse;
    WriterState.state.modal = null;
    WriterState.state.sendDoc = null;
    WriterState.state.sendJob = null;
    WriterState.state.sendReuse = undefined;
    services.render();
    if (dd) services.emailDocument(dd, picked.length ? picked : [{ addr: "", kind: "" }], reuse, job);
    return;
  };

  const closeModal = () => {
    if (WriterState.state.modal === "cc") {
      const d = doc(WriterState.state.docId),
        k = d && docCase(d),
        problem = k && services.validateAndStandardizeAddresses(k, d.type === "citation" && isLLC(k));
      if (problem) {
        WriterState.state.ccProblem = problem;
        services.refreshOverlay();
        const field = document.querySelector(problem.selector);
        if (field) field.focus();
        return;
      }
      WriterState.state.ccProblem = null;
      WriterState.DIRTY = true;
      services.scheduleDraftSave();
    }
    WriterState.state.modal = null;
    services.render();
    return;
  };

  const editRecipient = (el) => {
    const dd = doc(WriterState.state.docId);
    if (!dd) return;
    const k = docCase(dd);
    if (el.dataset.cc) {
      const p = el.dataset.cc.split("|");
      k.ccList = ccList(k);
      if (k.ccList[+p[0]]) k.ccList[+p[0]][p[1]] = el.value;
    } else if (el.dataset.em) {
      const p = el.dataset.em.split("|");
      k.emails = emailList(k);
      if (k.emails[+p[0]]) k.emails[+p[0]][p[1]] = el.value;
    } else {
      k.agent = k.agent || {};
      k.agent[el.dataset.agent] = el.value;
    }
    if (el.dataset.cc || el.dataset.agent) {
      const hadProblem = !!WriterState.state.ccProblem;
      WriterState.state.ccProblem = hadProblem ? services.validateAndStandardizeAddresses(k, dd.type === "citation" && isLLC(k), false) : null;
      const message = document.getElementById("cc-address-error");
      if (message) {
        if (WriterState.state.ccProblem)
          message.querySelector("div").innerHTML = "<strong>Check this address:</strong> " + esc(WriterState.state.ccProblem.message);
        else message.remove();
      }
      document.querySelectorAll('[aria-describedby="cc-address-error"]').forEach((field) => {
        field.removeAttribute("aria-invalid");
        field.removeAttribute("aria-describedby");
      });
      if (WriterState.state.ccProblem) {
        const field = document.querySelector(WriterState.state.ccProblem.selector);
        field?.setAttribute("aria-invalid", "true");
        field?.setAttribute("aria-describedby", "cc-address-error");
      }
      const key = el.dataset.cc ? "copy|" + el.dataset.cc.split("|")[0] : "agent|0";
      const preview = document.querySelector('[data-recipient-preview="' + key + '"]');
      if (preview) preview.textContent = services.recipientPreview(el.dataset.cc ? ccList(k)[+el.dataset.cc.split("|")[0]] : k.agent);
    }
    WriterState.DIRTY = true;
    services.scheduleDraftSave();
    return;
  };

  const changeEmail = (e) => {
    const dd = doc(WriterState.state.docId);
    if (dd) {
      const k = docCase(dd),
        p = e.target.dataset.em.split("|");
      k.emails = emailList(k);
      if (k.emails[+p[0]]) k.emails[+p[0]][p[1]] = e.target.value;
      WriterState.DIRTY = true;
      services.render();
    }
    return;
  };
  return { openRecipients, addCopy, addRecipient, removeCopy, removeRecipient, emailDocument, sendDocument, closeModal, editRecipient, changeEmail };
}
