/* Correction event ownership. Construction is inert; core registers at the original startup positions. */
import { WriterState } from "./state.js";
import { kase, correctionSource, doc } from "./writer_queries.js";
import { nowISO } from "./calendar.js";
import { clone } from "./record_values.js";
import { DOCBODY } from "./document_types.js";
import { isHistoryDoc } from "./document_rules.js";
import { recordDay } from "../assets/shared.js";
export function createCorrectionEvents(services) {
  const resumeRecord = (t) => {
    const holder = WriterState.RECORD_ATTEMPTS[t.dataset.resumerecord];
    if (holder) services.commitAmendment(holder.cid, holder.pendingAmendment, holder);
    return;
  };

  const startCorrection = (d) => {
    const id = d.id;
    services.preflightCase(d.caseId, "correction", () => services.startCorrection(id));
    return;
  };

  const exportCorrection = (d) => {
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
  };

  const retryCorrection = (d) => {
    services.issueCorrection(d);
    return;
  };

  const refuseBusyNote = () => {
    services.toast("Finishing document save…");
    return;
  };

  const openRecordAction = (t) => {
    WriterState.state.amendmentError = "";
    WriterState.state.modal = t.id === "btn-void" ? "void" : t.id === "btn-recordnote" ? "recordnote" : "reconcile";
    services.render();
    return;
  };

  const commitRecordAction = (t, d) => {
    const value = (document.getElementById("record-action-text") || {}).value || "",
      external = (document.getElementById("record-action-external") || {}).value || "";
    const mode = WriterState.state.modal,
      actor = (document.getElementById("record-action-inspector") || {}).value || "";
    t.disabled = true;
    const action =
      mode === "void"
        ? services.voidDocument(d.id, value, external, actor)
        : mode === "reconcile"
          ? services.reconcileDocument(d.id, value, actor)
          : services.addRecordNote(d.id, value, actor);
    Promise.resolve(action).finally(() => {
      const field = document.getElementById("record-action-text");
      if (field) field.value = value;
      const button = document.getElementById("record-action-go");
      if (button) button.disabled = false;
      const ref = document.getElementById("record-action-external");
      if (ref) ref.value = external;
    });
    return;
  };

  const withdrawItem = (d, t) => {
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
    WriterState.DIRTY = true;
    services.saveDrafts();
    services.render();
    return;
  };

  const editActionDate = (el) => {
    const d = doc(WriterState.state.docId);
    if (d && d.correction && !d.pendingAmendment) {
      d.correction.actionDate = el.value;
      d.correction.reviewed = false;
      WriterState.DIRTY = true;
      services.scheduleDraftSave();
    }
    return;
  };

  const editCorrectionReason = (el) => {
    const d = doc(WriterState.state.docId);
    if (d && d.correction && !d.pendingAmendment) {
      d.correction[el.id === "correction-reason" ? "reason" : "externalReference"] = el.value;
      d.correction.reviewed = false;
      WriterState.DIRTY = true;
      services.scheduleDraftSave();
    }
    return;
  };

  const changeCorrection = (e) => {
    const d = doc(WriterState.state.docId);
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
    WriterState.DIRTY = true;
    services.saveDrafts();
    services.render();
    return;
  };
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
