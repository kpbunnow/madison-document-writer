import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { caseFileFault, mergeCaseDetails } from "./case_file_rules.js";
import { migrate } from "./case_migrations.js";
import { clone } from "./record_values.js";
import { bumpSeq, mergeCaseEvents, project, replay, rememberSaved } from "./case_records.js";
import { kase } from "./writer_queries.js";
import { INSPECTORS } from "./data/inspectors.js";

function loadedCaseMessage(inc, st, added) {
  return (
    "Loaded " +
    inc.number +
    " — " +
    st.documents.length +
    " document" +
    (st.documents.length === 1 ? "" : "s") +
    ", " +
    st.reinspections.length +
    " reinspection" +
    (st.reinspections.length === 1 ? "" : "s") +
    (added ? "" : " (nothing new)")
  );
}

// Verification/load/rollback orchestration; helper trust and UI actions stay supplied.
export function createCaseLoading(services) {
  function loadCaseFile(text, isSaved = true) {
    let f;
    try {
      f = JSON.parse(text);
    } catch (err) {
      services.toast("That file is not readable JSON");
      return null;
    }
    if (!f || f.format !== "madison-case-file" || !f["case"]) {
      services.toast("Not a Madison case file");
      return null;
    }
    if (f.schema >= 5 && !services.recordIntegrity.hasProof(f)) {
      void services.recordIntegrity.verify(f).then(() => {
        loadCaseFile(JSON.stringify(f), isSaved);
      });
      return null;
    }
    try {
      f = migrate(f);
    } catch (err) {
      services.toast(err.message);
      return null;
    }
    const fault = caseFileFault(f);
    if (fault) {
      services.toast("That case file was not loaded — " + fault);
      return null;
    }
    // nothing is touched until the whole file has been accepted and replayed
    const undo = {
      events: clone(workspace.EVENTS),
      cases: clone(workspace.CASES),
      inspectors: INSPECTORS.length,
      docs: workspace.DOCS.slice(),
      reinsp: workspace.REINSP.slice(),
    };
    let k = null,
      added = 0;
    try {
      bumpSeq(f);
      (f.inspectors || []).forEach((i) => {
        if (!INSPECTORS.some((x) => x.id === i.id || x.name === i.name)) INSPECTORS.push(i);
      });
      const inc = f["case"];
      k = workspace.CASES.find((c) => c.number === inc.number);
      if (!k) {
        k = clone(inc);
        workspace.CASES.push(k);
      } else if (isSaved) {
        const combined = mergeCaseDetails(k, inc, workspace.SAVE_CHECKPOINTS[k.id] && workspace.SAVE_CHECKPOINTS[k.id].case);
        Object.keys(k).forEach((key) => delete k[key]);
        Object.assign(k, combined);
      }
      added = mergeCaseEvents(k, f);
      project();
      if (workspace.DOCS.some((x) => !x || !Array.isArray(x.items))) throw new Error("a document did not replay");
    } catch (err) {
      workspace.EVENTS = undo.events;
      workspace.CASES = undo.cases;
      INSPECTORS.length = undo.inspectors;
      workspace.DOCS = undo.docs;
      workspace.REINSP = undo.reinsp;
      project();
      services.render();
      services.toast("That case file was not loaded — " + ((err && err.message) || "it could not be replayed"));
      return null;
    }
    const inc = f["case"];
    editor.state.screen = "cases";
    workspace.DIRTY = false;
    services.render();
    const st = replay(k.id);
    if (isSaved) rememberSaved(k, f);
    services.saveDrafts();
    services.refreshArtifactLocations();
    services.toast(loadedCaseMessage(inc, st, added));
    return k;
  }

  async function mergeSharedFile(cid, name) {
    if (!workspace.CASEDIR || workspace.NEEDGRANT) return 0;
    const k = kase(cid);
    if (!k.id) return 0;
    let text = null;
    try {
      const fh = await workspace.CASEDIR.getFileHandle(name); // absent is the normal first save
      text = await (await fh.getFile()).text();
    } catch (err) {
      if (err && (err.name === "NotFoundError" || err.message === "missing")) return 0;
      throw new Error("The existing case file could not be read; it has not been overwritten");
    }
    let f;
    try {
      f = migrate(JSON.parse(text));
    } catch (err) {
      throw new Error("The existing case file is unreadable; it has not been overwritten");
    }
    const fault = caseFileFault(f);
    if (fault) throw new Error("The existing case file is invalid: " + fault);
    if (String((f["case"] || {}).number || "") !== String(k.number || "")) throw new Error("The existing file belongs to another case");
    if (f.schema >= 5) {
      const status = await services.recordIntegrity.verify(f);
      if (!status.valid) throw new Error("This record was changed outside the program. Open read-only.");
    }
    const added = mergeCaseEvents(k, f);
    if (added) project();
    return added;
  }
  return { loadCaseFile, mergeSharedFile };
}
