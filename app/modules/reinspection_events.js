import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
/* Reinspection event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { reinsp } from "./writer_queries.js";
export function createReinspectionEvents(services) {
  function registerWalkKeys(target = document) {
    return registerEventOnce(target, "reinspection.registerWalkKeys", "keydown", (e) => {
      if (
        editor.state.screen !== "reinspect" ||
        !editor.state.riWalk ||
        !services.ensureWalkContext() ||
        e.defaultPrevented ||
        e.repeat ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      const target = e.target,
        tag = target && target.tagName;
      if (target && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(tag || ""))) return;
      const key = String(e.key || "").toLowerCase();
      if (
        target &&
        /^(BUTTON|A)$/.test(tag || "") &&
        !target.closest("[data-ri-walk-current]") &&
        !(key === "u" && target.closest("[data-riwalk-undo]"))
      )
        return;
      if (key === "u" && editor.state.riWalkUndo) {
        e.preventDefault();
        services.undoWalkOutcome();
        return;
      }
      const outcome = { 1: "corrected", 2: "progress", 3: "none", 4: "noaccess" }[key];
      if (!outcome || !editor.state.riWalkItem) return;
      e.preventDefault();
      services.recordReinspectionOutcome(editor.state.riWalkItem, outcome);
    });
  }

  const discardVisit = (t) => {
    if (!confirm("Discard this reinspection? Nothing has been recorded on the case yet.")) return;
    if (services.discardWorksheet(t.dataset.discardri)) services.toast("Reinspection discarded");
    return;
  };

  const recordVisit = () => {
    const r = reinsp(editor.state.reinspId);
    if (r) {
      services.recordReinspection(r);
      services.clearWalk();
      editor.WORK.walk = null;
      editor.state.screen = "cases";
      editor.state.reinspId = null;
      services.saveCaseFile(r.caseId);
      services.render();
    }
    return;
  };

  const startVisit = (t) => {
    const cid = t.dataset.reinsp;
    services.preflightCase(cid, "reinspection", () => services.startReinspection(cid));
    return;
  };

  const toggleWalk = (t) => {
    const r = reinsp(editor.state.reinspId);
    if (!r || !r.draft || r.docId) return;
    // The two review modes are a pressed-button pair; choosing the current mode changes nothing.
    if ((t.dataset.riwalk === "on") === !!editor.state.riWalk) return;
    if (t.dataset.riwalk === "on") {
      services.clearWalk();
      editor.state.riWalk = true;
      editor.state.riWalkContext = services.walkIdentity(r);
      editor.state.riFilter = "";
      const next = services.nextWalkItem(r);
      editor.state.riWalkItem = (next && next.id) || null;
      editor.state.riWalkUndo = null;
      editor.state.riWalkStage = "outcome";
      services.scheduleDraftSave();
      services.render();
      services.focusWalkItem();
    } else {
      services.clearWalk();
      editor.WORK.walk = null;
      services.scheduleDraftSave();
      services.render();
    }
    return;
  };

  const nextItem = () => {
    const r = reinsp(editor.state.reinspId);
    if (r) services.advanceWalk(r);
    return;
  };

  const skipDetails = () => {
    const r = reinsp(editor.state.reinspId);
    if (r) services.skipWalkDetails(r);
    return;
  };

  const returnDetails = () => {
    const r = reinsp(editor.state.reinspId);
    if (r) services.returnWalkDetails(r);
    return;
  };

  const previousItem = () => {
    const r = reinsp(editor.state.reinspId);
    if (r) services.previousWalk(r);
    return;
  };

  const undoOutcome = () => {
    services.undoWalkOutcome();
    return;
  };

  const filterItems = (t) => {
    if (editor.state.riWalk) return;
    editor.state.riFilter = editor.state.riFilter === t.dataset.rifilter ? "" : t.dataset.rifilter;
    services.renderKeep();
    return;
  };

  const recordOutcome = (t) => {
    services.recordReinspectionOutcome(t.dataset.item, t.dataset.setoc);
    return;
  };

  const makeDocument = (t) => {
    const r = reinsp(editor.state.reinspId);
    if (r) services.docFromReinspection(r, t.dataset.makedoc);
    return;
  };

  const editItemNote = (el) => {
    const r = reinsp(editor.state.reinspId);
    if (r && r.draft && !r.docId && r.results[el.dataset.rinote]) {
      r.results[el.dataset.rinote].note = el.value;
      workspace.DIRTY = true;
      services.scheduleDraftSave();
    }
    return;
  };

  const changeWalkMode = (e) => {
    editor.state.riWalkMode = e.target.value === "details" ? "details" : "quick";
    services.scheduleDraftSave();
    services.render();
    document.getElementById("ri-walk-mode")?.focus();
    return;
  };

  const changeFollowup = (e) => {
    const r = reinsp(editor.state.reinspId);
    if (r && r.draft && !r.docId) {
      r.followupIntent = e.target.value;
      services.scheduleDraftSave();
      services.renderKeep();
    }
    return;
  };

  const changeOutcomeDetails = (ds, rr, e) => {
    const id = ds.ridate || ds.ridue || ds.ricite,
      res = rr.results[id];
    if (res) {
      if (ds.ridate) {
        res.on = e.target.value;
        res.manualDate = true;
      } else if (ds.ridue) res.due = e.target.value;
      else res.cite = e.target.checked;
      workspace.DIRTY = true;
      services.renderKeep();
    }
    return;
  };

  const changeVisitDate = (e) => {
    const r = reinsp(editor.state.reinspId);
    if (r && r.draft && !r.docId) {
      services.changeVisitDate(r, e.target.value);
      workspace.DIRTY = true;
      services.renderKeep();
    }
    return;
  };

  const changeVisitTime = (e) => {
    const r = reinsp(editor.state.reinspId);
    if (r && r.draft && !r.docId) {
      r.time = e.target.value;
      workspace.DIRTY = true;
      services.saveDrafts();
    }
    return;
  };

  const changeInspector = (e) => {
    const r = reinsp(editor.state.reinspId);
    if (r && r.draft && !r.docId) {
      r.inspectorId = e.target.value;
      workspace.DIRTY = true;
      services.scheduleDraftSave();
    }
    return;
  };
  return {
    registerWalkKeys,
    discardVisit,
    recordVisit,
    startVisit,
    toggleWalk,
    nextItem,
    skipDetails,
    returnDetails,
    previousItem,
    undoOutcome,
    filterItems,
    recordOutcome,
    makeDocument,
    editItemNote,
    changeWalkMode,
    changeFollowup,
    changeOutcomeDetails,
    changeVisitDate,
    changeVisitTime,
    changeInspector,
  };
}
