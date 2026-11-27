import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
/* Correction event ownership. Construction is inert; core registers at the original startup positions. */
import { kase, correctionSource, doc } from "./writer_queries.js";
import { nowISO } from "./calendar.js";
import { clone } from "./record_values.js";
import { DOCBODY } from "./document_types.js";
import { isHistoryDoc } from "./document_rules.js";
import { recordDay } from "../assets/shared.js";
function restoreRecordActionControls(origin, value, external) {
  if (editor.state.screen !== origin.screen || editor.state.docId !== origin.docId || editor.state.modal !== origin.modal) return;
  const field = document.getElementById("record-action-text");
  if (field) field.value = value;
  const button = document.getElementById("record-action-go");
  if (button) button.disabled = false;
  const ref = document.getElementById("record-action-external");
  if (ref) ref.value = external;
}

// Download a correction draft, its issued source and its listed changes for review.
function correctionExportDraft(services, d) {
  if (d && d.correction)
    services.downloadFile(
      kase(d.caseId).number + " - correction draft - " + d.id + ".json",
      JSON.stringify(
        {
          format: "madison-correction-draft-review",
          exported: nowISO(),
          caseNumber: kase(d.caseId).number,
          source: correctionSource(d),
          draft: clone(d),
          changes: services.correctionChanges(d),
        },
        null,
        2,
      ),
    );
  return;
}

// Withdraw an item entered in error (with its reason), or restore one withdrawn in this correction only.
function correctionWithdrawItem(services, d, t) {
  if (!d.correction || services.isLocked(d)) return;
  const it = d.items.find((x) => x.id === t.dataset.withdraw);
  if (!it) return;
  if (it.withdrawn) {
    const base = correctionSource(d).items.find((x) => x.id === it.id);
    if (base.withdrawn) {
      services.toast("This item was withdrawn in a prior revision. A newly observed violation needs a new case or notice.");
      return;
    }
    delete it.withdrawn;
    delete it.withdrawalReason;
  } else {
    const reason = prompt("Why was item " + it.no + " entered in error? This is not a finding of compliance.");
    if (reason === null) return;
    if (reason.trim().length < 10) {
      services.toast("Provide a specific withdrawal reason of at least 10 characters.");
      return;
    }
    it.withdrawn = true;
    it.withdrawalReason = reason.trim();
  }
  d.correction.reviewed = false;
  workspace.DIRTY = true;
  services.saveDrafts();
  services.render();
  return;
}

// A changed correction document type or recorded visit outcome; either clears the review confirmation.
function correctionChangeTypeOrOutcome(services, e) {
  const d = doc(editor.state.docId);
  if (!d || !d.correction || d.pendingAmendment) return;
  if (e.target.id === "correction-type") {
    const src = correctionSource(d);
    if (!services.correctionTypeAllowed(src, e.target.value)) return;
    d.type = e.target.value;
    d.correction.body = d.type === src.type ? services.docBody(src) : DOCBODY[d.type] || DOCBODY.notice;
    d.items.forEach((it) => {
      if (isHistoryDoc(d))
        it.hist = d.authoringVersion >= 14 ? it.hist || services.itemInspectionHistory(d, it) : services.itemHistory(d.caseId, it.no);
    });
  } else {
    const it = d.items.find((x) => x.id === e.target.dataset.correctionOutcome);
    if (it) {
      d.correction.outcomes = d.correction.outcomes || {};
      d.correction.outcomes[it.id] = e.target.value;
      it.done = e.target.value === "corrected";
      it.doneOn = it.done ? it.doneOn || d.inspDate || recordDay(today) : "";
    }
  }
  d.correction.reviewed = false;
  workspace.DIRTY = true;
  services.saveDrafts();
  services.render();
  return;
}

export function createCorrectionEvents(services) {
  const resumeRecord = (t) => {
    const holder = editor.RECORD_ATTEMPTS[t.dataset.resumerecord];
    if (holder) services.commitAmendment(holder.cid, holder.pendingAmendment, holder);
    return;
  };

  const startCorrection = (d) => {
    const id = d.id;
    services.preflightCase(d.caseId, "correction", () => services.startCorrection(id));
    return;
  };

  const exportCorrection = (d) => correctionExportDraft(services, d);

  const retryCorrection = (d) => {
    services.issueCorrection(d);
    return;
  };

  const refuseBusyNote = () => {
    services.toast("Finishing document save…");
    return;
  };

  const openRecordAction = (t) => {
    editor.state.amendmentError = "";
    editor.state.modal = t.id === "btn-void" ? "void" : t.id === "btn-recordnote" ? "recordnote" : "reconcile";
    services.render();
    return;
  };

  const commitRecordAction = (t, d) => {
    const value = (document.getElementById("record-action-text") || {}).value || "",
      external = (document.getElementById("record-action-external") || {}).value || "";
    const origin = { screen: editor.state.screen, docId: editor.state.docId, modal: editor.state.modal };
    const mode = editor.state.modal,
      actor = (document.getElementById("record-action-inspector") || {}).value || "";
    t.disabled = true;
    const action =
      mode === "void"
        ? services.voidDocument(d.id, value, external, actor)
        : mode === "reconcile"
          ? services.reconcileDocument(d.id, value, actor)
          : services.addRecordNote(d.id, value, actor);
    Promise.resolve(action).finally(() => restoreRecordActionControls(origin, value, external));
    return;
  };

  const withdrawItem = (d, t) => correctionWithdrawItem(services, d, t);

  const editActionDate = (el) => {
    const d = doc(editor.state.docId);
    if (d && d.correction && !d.pendingAmendment) {
      d.correction.actionDate = el.value;
      d.correction.reviewed = false;
      workspace.DIRTY = true;
      services.scheduleDraftSave();
    }
    return;
  };

  const editCorrectionReason = (el) => {
    const d = doc(editor.state.docId);
    if (d && d.correction && !d.pendingAmendment) {
      d.correction[el.id === "correction-reason" ? "reason" : "externalReference"] = el.value;
      d.correction.reviewed = false;
      workspace.DIRTY = true;
      services.scheduleDraftSave();
    }
    return;
  };

  const changeCorrection = (e) => correctionChangeTypeOrOutcome(services, e);

  return {
    resumeRecord,
    startCorrection,
    exportCorrection,
    retryCorrection,
    refuseBusyNote,
    openRecordAction,
    commitRecordAction,
    withdrawItem,
    editActionDate,
    editCorrectionReason,
    changeCorrection,
  };
}
