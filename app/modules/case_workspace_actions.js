import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { caseDetails, stableJSON } from "./record_values.js";
import { caseFileName } from "./case_file_rules.js";
import { doc, docsFor, eventsFor, reinsp } from "./writer_queries.js";

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

  function removeCase(cid) {
    if (Object.values(editor.RECORD_ATTEMPTS).some((x) => x.cid === cid) || docsFor(cid).some((x) => x.pendingAmendment)) {
      services.toast("Confirm pending record saves before removing this case from this workspace.");
      return false;
    }
    workspace.CASES = workspace.CASES.filter((c) => c.id !== cid);
    workspace.DOCS = workspace.DOCS.filter((d) => d.caseId !== cid);
    workspace.REINSP = workspace.REINSP.filter((r) => r.caseId !== cid);
    if (reinsp(editor.state.reinspId)?.caseId === cid) {
      services.clearWalk();
      editor.WORK.walk = null;
    }
    delete workspace.EVENTS[cid];
    if (editor.state.docId && !doc(editor.state.docId)) editor.state.docId = null;
    services.saveDrafts();
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
