import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
/* Contact event ownership. Construction is inert; core registers at the original startup positions. */
import { doc, kase, docCase } from "./writer_queries.js";
import { emailList, isLLC, ccList, setCopyKind } from "./mailing_rules.js";
import { esc } from "./presentation_format.js";
/* Apply one edited field to the case: a copy or Violator field, an email recipient or the registered agent.
   Returns true when a copy's type changed. */
function applyRecipientEdit(k, el) {
  if (el.dataset.cc) {
    const p = el.dataset.cc.split("|");
    k.ccList = ccList(k);
    if (k.ccList[+p[0]] && p[1] === "kind") {
      setCopyKind(k, +p[0], el.value);
      return true;
    }
    if (k.ccList[+p[0]]) k.ccList[+p[0]][p[1]] = el.value;
  } else if (el.dataset.em) {
    const p = el.dataset.em.split("|");
    k.emails = emailList(k);
    if (k.emails[+p[0]]) k.emails[+p[0]][p[1]] = el.value;
  } else {
    k.agent = k.agent || {};
    k.agent[el.dataset.agent] = el.value;
  }
  return false;
}

/* Re-check the addresses after an edit once a problem has been shown, and keep the preview line current. */
function refreshRecipientProblem(services, el, k, dd) {
  const hadProblem = !!editor.state.ccProblem;
  editor.state.ccProblem = hadProblem ? services.validateAndStandardizeAddresses(k, dd.type === "citation" && isLLC(k), false) : null;
  const message = document.getElementById("cc-address-error");
  if (message) {
    if (editor.state.ccProblem)
      message.querySelector("div").innerHTML = "<strong>Check this address:</strong> " + esc(editor.state.ccProblem.message);
    else message.remove();
  }
  document.querySelectorAll('[aria-describedby="cc-address-error"]').forEach((field) => {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  });
  if (editor.state.ccProblem) {
    const field = document.querySelector(editor.state.ccProblem.selector);
    field?.setAttribute("aria-invalid", "true");
    field?.setAttribute("aria-describedby", "cc-address-error");
  }
  const key = el.dataset.cc ? "copy|" + el.dataset.cc.split("|")[0] : "agent|0";
  const preview = document.querySelector('[data-recipient-preview="' + key + '"]');
  if (preview) preview.textContent = services.recipientPreview(el.dataset.cc ? ccList(k)[+el.dataset.cc.split("|")[0]] : k.agent);
}

function changeCopyOwnerFor(services, e) {
  const dd = doc(editor.state.docId);
  if (!dd) return;
  // Copying the owner is the default and is stored only when turned off, so ticking the box again leaves no change.
  const k = docCase(dd);
  if (e.target.checked) delete k.copyOwner;
  else k.copyOwner = false;
  workspace.DIRTY = true;
  services.scheduleDraftSave();
  services.render();
}

export function createContactEvents(services) {
  const openRecipients = () => {
    editor.state.ccProblem = null;
    editor.state.modal = "cc";
    services.render();
    return;
  };

  const addCopy = () => {
    editor.state.ccProblem = null;
    services.addCC(doc(editor.state.docId).caseId);
    return;
  };

  const addRecipient = () => {
    editor.state.ccProblem = null;
    services.addEmail(doc(editor.state.docId).caseId);
    return;
  };

  const removeCopy = (t) => {
    editor.state.ccProblem = null;
    services.removeCC(doc(editor.state.docId).caseId, +t.dataset.rmcc);
    return;
  };

  const removeRecipient = (t) => {
    editor.state.ccProblem = null;
    services.removeEmail(doc(editor.state.docId).caseId, +t.dataset.rmem);
    return;
  };

  const emailDocument = () => {
    const dd = doc(editor.state.docId);
    if (dd) services.emailDocument(dd);
    return;
  };

  const sendDocument = (t) => {
    const dd = doc(editor.state.sendDoc) || doc(editor.state.docId);
    const k = dd ? kase(dd.caseId) : null;
    const list = k ? emailList(k).filter((e) => String(e.addr || "").trim()) : [];
    const picked =
      t.id === "btn-sendnone"
        ? []
        : list.filter((_, ix) => {
            const box = document.querySelector('[data-sendto="' + ix + '"]');
            return box && box.checked;
          });
    const job = editor.state.sendJob,
      reuse = editor.state.sendReuse;
    editor.state.modal = null;
    editor.state.sendDoc = null;
    editor.state.sendJob = null;
    editor.state.sendReuse = undefined;
    services.render();
    if (dd) services.emailDocument(dd, picked.length ? picked : [{ addr: "", kind: "" }], reuse, job);
    return;
  };

  const closeModal = () => {
    if (editor.state.modal === "cc") {
      const d = doc(editor.state.docId),
        k = d && docCase(d),
        problem = k && services.validateAndStandardizeAddresses(k, d.type === "citation" && isLLC(k));
      if (problem) {
        editor.state.ccProblem = problem;
        services.refreshOverlay();
        const field = document.querySelector(problem.selector);
        if (field) field.focus();
        return;
      }
      editor.state.ccProblem = null;
      workspace.DIRTY = true;
      services.scheduleDraftSave();
    }
    editor.state.modal = null;
    services.render();
    return;
  };

  const editRecipient = (el) => {
    const dd = doc(editor.state.docId);
    if (!dd) return;
    const k = docCase(dd);
    const kindChanged = applyRecipientEdit(k, el);
    if (el.dataset.cc || el.dataset.agent) refreshRecipientProblem(services, el, k, dd);
    workspace.DIRTY = true;
    services.scheduleDraftSave();
    // A type change can add or remove the owner-copy choice and the Violator on the document.
    if (kindChanged) services.refreshOverlay();
    return;
  };

  const changeCopyOwner = (e) => changeCopyOwnerFor(services, e);

  const changeEmail = (e) => {
    const dd = doc(editor.state.docId);
    if (dd) {
      const k = docCase(dd),
        p = e.target.dataset.em.split("|");
      k.emails = emailList(k);
      if (k.emails[+p[0]]) k.emails[+p[0]][p[1]] = e.target.value;
      workspace.DIRTY = true;
      services.render();
    }
    return;
  };
  return {
    openRecipients,
    addCopy,
    addRecipient,
    removeCopy,
    removeRecipient,
    emailDocument,
    sendDocument,
    closeModal,
    editRecipient,
    changeEmail,
    changeCopyOwner,
  };
}
