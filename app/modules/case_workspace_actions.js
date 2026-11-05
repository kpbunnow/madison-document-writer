import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { caseDetails, stableJSON } from "./record_values.js";
import { caseFileName } from "./case_file_rules.js";
import { doc, docsFor, eventsFor, reinsp } from "./writer_queries.js";

// a case that exists only as the draft just discarded (nothing issued, no events, no saved checkpoint, no other
// draft) starts over, so its copies and email recipients do not leak into the next notice written for it
function forgetRecipientsOfUnstartedCase(caseId) {
  const k = caseId && workspace.CASES.find((c) => c.id === caseId);
  if (!k || docsFor(caseId).length || eventsFor(caseId).length || workspace.SAVE_CHECKPOINTS[caseId]) return;
  if (workspace.DOCS.some((x) => x.caseId === caseId) || workspace.REINSP.some((x) => x.caseId === caseId)) return;
  delete k.ccList;
  delete k.emails;
  delete k.copyOwner;
}

const formDoc = (key) => key.slice(0, key.lastIndexOf(":"));

// A record note, withdrawal review or follow-through form with text belongs to its document's case.
function unfinishedRecordForm(caseId) {
  return Object.entries(editor.WORK.recordForms || {}).some(([key, form]) => doc(formDoc(key))?.caseId === caseId && (form.text || form.external));
}

// Read before anything is removed: the case's documents (for their record forms) and whether the selected worksheet
// or the retained walkthrough (context case|visit|document) belongs to it.
function caseOwnership(cid) {
  return {
    docIds: new Set(docsFor(cid).map((d) => d.id)),
    ownsWalk: reinsp(editor.state.reinspId)?.caseId === cid || String(editor.WORK.walk?.context || "").split("|")[0] === cid,
  };
}

function forgetWalk(services) {
  services.clearWalk();
  editor.WORK.walk = null;
  editor.state.reinspId = null;
}

// Removing a case discards its documents' record forms (the removal has been confirmed); other cases' forms stay.
function dropRecordForms(docIds) {
  const forms = editor.WORK.recordForms || {};
  Object.keys(forms).forEach((key) => {
    if (docIds.has(formDoc(key))) delete forms[key];
  });
}

export function createCaseWorkspaceActions(services) {
  async function discardDraft(id) {
    const d = doc(id);
    if (d && d.pendingAmendment) {
      services.toast("Retry the pending save before discarding this correction.");
      return false;
    }
    workspace.DOCS = workspace.DOCS.filter((d) => !(d.draft && d.id === id));
    workspace.REINSP = workspace.REINSP.filter((r) => !(r.draft && r.id === id));
    if (editor.state.reinspId === id) {
      services.clearWalk();
      editor.WORK.walk = null;
    }
    // a worksheet still pointing at the discarded follow-up reads as finished
    // and will not write another one
    workspace.REINSP.forEach((r) => {
      if (r.draft && r.docId === id) r.docId = null;
    });
    forgetRecipientsOfUnstartedCase(d?.caseId);
    await services.saveDrafts();
    services.render();
  }

  function caseUnsaved(k) {
    if (Object.values(editor.RECORD_ATTEMPTS).some((x) => x.cid === k.id)) return "record change awaiting save confirmation";
    if (workspace.PENDING.some((p) => p.cid === k.id || (!!caseFileName(k) && p.name === caseFileName(k))))
      return "case file waiting to reach the share";
    const evs = eventsFor(k.id);
    const drafts = workspace.DOCS.some((d) => d.draft && d.caseId === k.id) || workspace.REINSP.some((r) => r.draft && r.caseId === k.id);
    if (drafts) return "unfinished drafts";
    if (unfinishedRecordForm(k.id)) return "unfinished record notes";
    if (!evs.length && !workspace.SAVE_CHECKPOINTS[k.id]) return "case details saved only on this device";
    if (!k.savedAt) return "issued documents never written to the share";
    const checkpoint = workspace.SAVE_CHECKPOINTS[k.id];
    if (checkpoint) {
      const known = new Set(checkpoint.events || []);
      return evs.some((e) => !known.has(e.id)) || stableJSON(caseDetails(k)) !== stableJSON(caseDetails(checkpoint.case))
        ? "changes made since the last save"
        : "";
    }
    const newest =
      evs
        .map((e) => e.at)
        .sort()
        .slice(-1)[0] || "";
    return newest > k.savedAt ? "changes made since the last save" : "";
  }

  function removeCase(cid, { persist = true } = {}) {
    if (Object.values(editor.RECORD_ATTEMPTS).some((x) => x.cid === cid) || docsFor(cid).some((x) => x.pendingAmendment)) {
      services.toast("Confirm pending record saves before removing this case from this workspace.");
      return false;
    }
    const { docIds, ownsWalk } = caseOwnership(cid);
    workspace.CASES = workspace.CASES.filter((c) => c.id !== cid);
    workspace.DOCS = workspace.DOCS.filter((d) => d.caseId !== cid);
    workspace.REINSP = workspace.REINSP.filter((r) => r.caseId !== cid);
    if (ownsWalk) forgetWalk(services);
    dropRecordForms(docIds);
    delete workspace.EVENTS[cid];
    if (editor.state.docId && !doc(editor.state.docId)) editor.state.docId = null;
    if (persist) services.saveDrafts();
  }

  function clearCases(which) {
    const gone = [];
    workspace.CASES.slice().forEach((k) => {
      const risky = caseUnsaved(k);
      if (which === "safe" && risky) return;
      if (removeCase(k.id) !== false) gone.push(k.number);
    });
    editor.state.modal = null;
    editor.state.screen = "cases";
    services.render();
    services.toast(
      gone.length
        ? gone.length + " case" + (gone.length === 1 ? "" : "s") + " removed from this workspace. Shared case records are not deleted."
        : "Nothing to remove",
    );
  }
  return { discardDraft, caseUnsaved, removeCase, clearCases };
}
