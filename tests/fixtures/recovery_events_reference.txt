import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { recoveryState as recovery } from "./recovery_state.js";
/* Recovery event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { doc, reinsp } from "./writer_queries.js";
function recoveryExportName(number) {
  return "Madison-recovery-" + number + ".json";
}

export function createRecoveryEvents(services) {
  function registerWorkingInput(target = document) {
    return registerEventOnce(
      target,
      "recovery.registerWorkingInput",
      "input",
      (e) => {
        const el = e.target;
        if (services.recovery.ENTRY_IDS.includes(el.id)) {
          editor.WORK.entry[el.id] = el.value;
          services.ui.scheduleDraftSave();
          return;
        }
        if (["record-action-text", "record-action-external", "record-action-inspector"].includes(el.id)) {
          const key = services.recovery.recordFormKey(),
            field = { "record-action-text": "text", "record-action-external": "external", "record-action-inspector": "actor" }[el.id];
          editor.WORK.recordForms[key] = { ...(editor.WORK.recordForms[key] || {}), [field]: el.value };
          services.ui.scheduleDraftSave();
          return;
        }
        if (el.id === "fin-mailed") {
          const d = doc(editor.state.docId);
          if (d && !services.publication.isLocked(d)) {
            services.publication.initialCitations.mailed(d, el.value);
            services.ui.scheduleDraftSave();
          }
          return;
        }
      },
      true,
    );
  }

  function registerWorkingChange(target = document) {
    return registerEventOnce(
      target,
      "recovery.registerWorkingChange",
      "change",
      (e) => {
        if (services.recovery.ENTRY_IDS.includes(e.target.id)) {
          editor.WORK.entry[e.target.id] = e.target.value;
          services.ui.scheduleDraftSave();
        }
      },
      true,
    );
  }

  function registerWorkingActions(target = document) {
    return registerEventOnce(
      target,
      "recovery.registerWorkingActions",
      "click",
      (e) => {
        const button = e.target.closest(
          "#btn-savework,#btn-workbackup,[data-workbackup],#btn-workrestore,#btn-re" +
            "trypublish,#btn-editvisit,#btn-previousdraft,#btn-exportprevious,#btn-re" +
            "tryfiling,#btn-continuecitation,[data-worknote]",
        );
        if (!button) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        services.ui.captureWork();
        if (button.id === "btn-savework") {
          services.recovery.saveAndContinue();
          return;
        }
        if (button.id === "btn-workbackup" || button.hasAttribute("data-workbackup")) {
          services.recovery.downloadWorkspace();
          return;
        }
        if (button.id === "btn-workrestore") {
          document.getElementById("utility-dialog")?.close();
          services.recovery.restoreWorkspaceFile();
          return;
        }
        if (button.dataset.worknote) {
          const key = button.dataset.worknote,
            cut = key.lastIndexOf(":"),
            d = doc(key.slice(0, cut));
          if (d && editor.WORK.recordForms[key]) {
            editor.state.docId = d.id;
            editor.state.screen = "write";
            editor.state.modal = key.slice(cut + 1);
            services.ui.render();
          }
          return;
        }
        if (button.id === "btn-retryfiling") {
          const d = doc(editor.state.docId);
          if (d && !d.draft) {
            button.disabled = true;
            // printJob refuses synchronously (for example an incomplete citation packet); show why and re-enable.
            let job;
            try {
              job = services.publication.printJob(d);
            } catch (error) {
              services.ui.toast(error.message);
              services.ui.render();
              return;
            }
            services.publication.filePdf(d, job).finally(() => services.ui.render());
          }
          return;
        }
        if (button.id === "btn-continuecitation") {
          const d = doc(editor.state.docId);
          if (services.publication.needsInitialCitation(d)) {
            const next = services.publication.citationFromNotice(d.id);
            if (next) {
              editor.state.docId = next.id;
              editor.state.screen = "write";
              services.ui.render();
            }
          }
          return;
        }
        if (button.id === "btn-retrypublish") {
          services.publication.publishDocument(doc(editor.state.docId));
          return;
        }
        if (button.id === "btn-editvisit") {
          services.recovery.returnToWorksheet(doc(editor.state.docId));
          return;
        }
        const r = reinsp(editor.state.reinspId);
        if (button.id === "btn-previousdraft") {
          services.recovery.restorePreviousDraft(r);
          return;
        }
        if (button.id === "btn-exportprevious") {
          if (r && r.previousDraft)
            services.publication.downloadFile(
              "Previous-document-draft-" + r.id + ".json",
              JSON.stringify({ format: "madison-draft-reference", draft: r.previousDraft, inspection: r.previousWorksheet }, null, 2),
            );
          return;
        }
      },
      true,
    );
  }

  function registerRecoveryActions(target = document) {
    return registerEventOnce(target, "recovery.registerRecoveryActions", "click", (e) => {
      const t = e.target.closest?.("[data-recovery-row],[data-recovery-restore],[data-recovery-export],[data-recovery-shared],#btn-recovery");
      if (!t) return;
      if (t.id === "btn-recovery") {
        document.getElementById("utility-dialog")?.close();
        services.recovery.listRecovery();
        return;
      }
      if (t.dataset.recoveryRow !== undefined) {
        services.recovery.selectRecovery(recovery.RECOVERY.list[+t.dataset.recoveryRow]).catch((err) => {
          recovery.RECOVERY.error = err.message;
          services.ui.render();
        });
        return;
      }
      if (t.hasAttribute("data-recovery-restore")) {
        services.recovery.restoreRecovery();
        return;
      }
      if (t.hasAttribute("data-recovery-export")) {
        services.publication.downloadFile(recoveryExportName(recovery.RECOVERY.selected.number), JSON.stringify(recovery.RECOVERY.selected, null, 2));
        return;
      }
      if (t.hasAttribute("data-recovery-shared")) {
        const k = recovery.RECOVERY.selected?.bundle?.cases?.[0];
        editor.state.modal = null;
        if (k)
          services.recovery
            .helperJSON("/cases/resolve?number=" + encodeURIComponent(k.number))
            .then((x) => services.recovery.loadCaseFile(JSON.stringify(x.file)))
            .catch((err) => services.ui.toast("Shared case unavailable: " + err.message));
      }
    });
  }

  function registerRecoveryImport(target = document) {
    return registerEventOnce(target, "recovery.registerRecoveryImport", "change", async (e) => {
      if (e.target.id !== "recovery-import") return;
      try {
        const b = JSON.parse(await e.target.files[0].text());
        const row = { workspace: b.workspace, case: b.case, number: b.number, name: "Imported file", imported: b };
        services.recovery.validateRecovery(b, row);
        recovery.RECOVERY.list.unshift(row);
        await services.recovery.selectRecovery(row);
      } catch (err) {
        recovery.RECOVERY.error = "Import rejected: " + err.message;
        services.ui.render();
      }
    });
  }

  function registerSharedConflictActions(target = document) {
    return registerEventOnce(target, "recovery.registerSharedConflictActions", "click", (e) => {
      const t = e.target.closest?.("[data-shared-export],[data-shared-current],[data-shared-local]");
      if (!t) return;
      if (t.hasAttribute("data-shared-export")) services.recovery.downloadWorkspace();
      else if (t.hasAttribute("data-shared-local")) services.recovery.keepChangedLocal();
      else services.recovery.openChangedShared();
    });
  }

  function registerVisibilitySave(target = document) {
    return registerEventOnce(target, "recovery.registerVisibilitySave", "visibilitychange", () => {
      if (document.visibilityState === "hidden" && services.recovery.IDB_OK) services.recovery.saveDrafts();
    });
  }

  const discardDocument = (t) => {
    const dd = doc(t.dataset.discard);
    if (dd && !confirm("Discard this draft? It has not been issued, so nothing on the shared record changes.")) return;
    services.recovery.discardDraft(t.dataset.discard).then((ok) => {
      if (ok !== false) services.ui.toast("Draft discarded");
    });
    return;
  };

  const saveVisit = () => {
    services.recovery.saveAndContinue();
    return;
  };

  const saveDocument = () => {
    services.recovery.saveAndContinue();
    return;
  };

  function registerUnloadWarning(target = window) {
    return registerEventOnce(target, "recovery.registerUnloadWarning", "beforeunload", (e) => {
      if (workspace.DIRTY) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }
  return {
    registerWorkingInput,
    registerWorkingChange,
    registerWorkingActions,
    registerRecoveryActions,
    registerRecoveryImport,
    registerSharedConflictActions,
    registerVisibilitySave,
    discardDocument,
    saveVisit,
    saveDocument,
    registerUnloadWarning,
  };
}
