import { editorState as editor } from "./editor_state.js";
import { recordDay } from "../assets/shared.js";
import { badIds, caseFileFault, ID_OK } from "./case_file_rules.js";
import { project } from "./case_records.js";
import { clone } from "./record_values.js";
import { SCHEMA } from "./document_types.js";
import { nowISO } from "./calendar.js";
import { BUILD } from "./data/build_identity.js";
import { WriterState } from "./state.js";

// Whole-workspace backup coordination; the file picker and integrity/storage authority stay supplied.
export function createWorkspaceBackup(services) {
  function downloadWorkspace() {
    services.captureWork();
    const bundle = clone(services.draftBundle());
    services.downloadFile(
      "Madison-workspace-" + recordDay(services.today) + ".json",
      JSON.stringify(
        { format: "madison-workspace-backup", version: 2, build: BUILD, exported: nowISO(), bundle, pending: clone(WriterState.PENDING) },
        null,
        2,
      ),
    );
    services.toast("Workspace backup downloaded, including unfinished work. Keep it in an approved location.");
  }

  async function restoreWorkspaceBackup(value) {
    if (!value || value.format !== "madison-workspace-backup" || ![1, 2].includes(value.version) || !value.bundle)
      throw new Error("Choose a Madison workspace backup.");
    const b = value.bundle;
    if (WriterState.CASES.length || services.hasSetupWork() || Object.values(editor.WORK.recordForms || {}).some((x) => x.text || x.external))
      throw new Error("Restore in an empty workspace or browser profile. Existing work has been kept; download its backup first.");
    if (!Array.isArray(b.cases) || !Array.isArray(b.docs) || !Array.isArray(b.reinsp) || !b.events || badIds(b))
      throw new Error("The backup has invalid working records.");
    const numbers = new Set(),
      ids = new Set();
    b.cases.forEach((k) => {
      if (numbers.has(k.number) || ids.has(k.id)) throw new Error("Duplicate cases in the backup.");
      numbers.add(k.number);
      ids.add(k.id);
      if (WriterState.CASES.some((c) => c.id === k.id || c.number === k.number))
        throw new Error(
          "Case " +
            k.number +
            (" is already on this workspace. Its current work has been kept. Restore t" +
              "his backup in an empty browser profile, or remove that case from this workspace only after" +
              " saving its work."),
        );
      const fault = caseFileFault({ format: "madison-case-file", schema: SCHEMA, case: k, inspectors: [], events: b.events[k.id] || [] });
      if (fault) throw new Error(fault);
    });
    b.docs.forEach((d) => {
      if (!d.draft || !ids.has(d.caseId) || !ID_OK.test(d.id) || !Array.isArray(d.items) || d.items.some((i) => !i.id || !Array.isArray(i.sections)))
        throw new Error("Invalid document draft.");
    });
    b.reinsp.forEach((r) => {
      if (!r.draft || !ids.has(r.caseId) || !ID_OK.test(r.id) || !r.results || typeof r.results !== "object")
        throw new Error("Invalid inspection worksheet.");
    });
    if (Object.keys(b.events).some((cid) => !ids.has(cid)) || (value.pending && !Array.isArray(value.pending)))
      throw new Error("The backup contains unrelated case records.");
    const draftIds = b.docs.map((d) => d.id),
      visitIds = b.reinsp.map((r) => r.id);
    if (new Set(draftIds).size !== draftIds.length || new Set(visitIds).size !== visitIds.length)
      throw new Error("Duplicate working paper identities.");
    for (const p of value.pending || []) {
      let file;
      try {
        file = JSON.parse(p.body);
      } catch (e) {
        throw new Error("Invalid pending case file.");
      }
      if (!ids.has(p.cid) || file.case?.id !== p.cid || caseFileFault(file)) throw new Error("Invalid pending case record.");
    }
    for (const holder of Object.values(b.recordAttempts || {})) {
      if (
        !ids.has(holder.cid) ||
        !holder.pendingAmendment ||
        !["document.voided", "document.annotated", "document.reconciled", "document.served"].includes(holder.pendingAmendment.type)
      )
        throw new Error("Invalid pending record action.");
    }
    const merged = {
      ...services.draftBundle(),
      cases: WriterState.CASES.concat(b.cases),
      docs: WriterState.DOCS.filter((d) => d.draft).concat(b.docs),
      reinsp: WriterState.REINSP.filter((r) => r.draft).concat(b.reinsp),
      events: { ...WriterState.EVENTS, ...b.events },
      recordAttempts: { ...editor.RECORD_ATTEMPTS, ...(b.recordAttempts || {}) },
      checkpoints: { ...WriterState.SAVE_CHECKPOINTS, ...(b.checkpoints || {}) },
      integrityRecords: b.integrityRecords || [],
      seq: Math.max(WriterState.seq, b.seq || 0),
      work: clone(b.work || editor.WORK),
    };
    if (!(await services.idbSet("drafts", merged))) throw new Error("This device cannot save the restored workspace. Nothing has been changed.");
    await services.recordIntegrity.restore(merged.integrityRecords);
    WriterState.CASES = merged.cases;
    WriterState.EVENTS = merged.events;
    WriterState.DOCS = merged.docs;
    WriterState.REINSP = merged.reinsp;
    editor.RECORD_ATTEMPTS = merged.recordAttempts;
    WriterState.SAVE_CHECKPOINTS = merged.checkpoints;
    editor.WORK = merged.work;
    editor.WORK.entry = editor.WORK.entry || {};
    editor.WORK.recordForms = editor.WORK.recordForms || {};
    editor.state.acc = editor.WORK.acc || null;
    WriterState.seq = merged.seq;
    // Recoverable case snapshots remain in bundle.events even if queue storage fails.
    WriterState.PENDING = WriterState.PENDING.concat((value.pending || []).filter((p) => ids.has(p.cid)));
    await services.idbSet("pending", WriterState.PENDING);
    project();
    editor.state.screen = "cases";
    editor.state.modal = null;
    services.render();
    await services.saveDrafts();
    await services.refreshArtifactLocations();
    services.toast("Workspace restored. Unfinished work is ready to continue; nothing was issued by restoring it.");
    return true;
  }
  return { downloadWorkspace, restoreWorkspaceBackup };
}
