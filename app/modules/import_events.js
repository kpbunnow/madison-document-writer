import { editorState as editor } from "./editor_state.js";
import { importsState as imports } from "./imports_state.js";
/* Import event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
export function createImportEvents(services) {
  function registerLookupSubmit(target = document) {
    return registerEventOnce(target, "import.registerLookupSubmit", "submit", (e) => {
      if (e.target.id === "lookup-form") {
        e.preventDefault();
        services.findDatabaseCase();
      }
    });
  }

  function registerLookupClicks(target = document) {
    return registerEventOnce(
      target,
      "import.registerLookupClicks",
      "click",
      (e) => {
        const button = e.target.closest("button");
        if (!button) return;
        if (button.dataset.importWorkspace) {
          services.openImportWorkspace(button.dataset.importWorkspace);
          return;
        }
        if (button.id === "lookup-cancel") {
          services.cancelCaseLookup();
          imports.LOOKUP_ERROR = "Lookup canceled. Your existing work has been kept.";
          services.render();
          return;
        }
        if (button.id === "lookup-recheck") {
          services.confirmDatabaseCase();
          return;
        }
        if (button.matches("[data-nav],#acc-pick,#acc-cancel,#btn-savework")) services.cancelCaseLookup();
        if (button.id === "acc-go") {
          e.preventDefault();
          e.stopImmediatePropagation();
          services.confirmDatabaseCase();
        }
      },
      true,
    );
  }

  function registerLookupDrop(target = document) {
    return registerEventOnce(
      target,
      "import.registerLookupDrop",
      "drop",
      (e) => {
        if (e.target.closest?.("#acc-drop")) services.cancelCaseLookup();
      },
      true,
    );
  }

  const pickWorkbook = () => {
    services.pickAccelaFile();
    return;
  };

  const cancelImport = () => {
    editor.state.acc = null;
    editor.WORK.acc = null;
    delete editor.WORK.entry["lookup-number"];
    imports.LOOKUP_ERROR = "";
    services.render();
    services.saveDrafts();
    return;
  };

  const acceptImport = () => {
    const plan = services.accelaPlan(editor.state.acc),
      existing = plan.existing;
    if (existing) services.preflightCase(existing.id, "import update", () => services.acceptAccela());
    else services.acceptAccela();
    return;
  };

  const selectCase = (t) => {
    const ix = +t.dataset.acccase;
    if (editor.state.acc.cases[ix] && !imports.LOOKUP_BUSY) {
      services.cancelCaseLookup();
      const acc = editor.state.acc,
        serial = imports.LOOKUP_SERIAL;
      editor.state.acc.caseIx = ix;
      editor.state.acc.sel = editor.state.acc.cases[ix].sel;
      imports.ACC_SELECTION_SERIAL++;
      editor.state.acc.manualDate = "";
      editor.state.acc.manualTime = "";
      services.accelaFromShare().then(() => {
        if (serial !== imports.LOOKUP_SERIAL || editor.state.screen !== "import" || editor.state.acc !== acc) return;
        const active = document.activeElement,
          id = active?.id,
          sel = active?.dataset.accsel,
          cix = active?.dataset.acccase;
        services.scheduleDraftSave();
        services.renderKeep();
        const focus = id
          ? document.getElementById(id)
          : sel !== undefined
            ? document.querySelector('[data-accsel="' + Number(sel) + '"]')
            : cix !== undefined
              ? document.querySelector('[data-acccase="' + Number(cix) + '"]')
              : null;
        focus?.focus({ preventScroll: true });
      });
    }
    return;
  };

  const selectInspection = (t) => {
    const selected = +t.dataset.accsel;
    if (!services.selectImportInspection(selected)) return;
    services.scheduleDraftSave();
    services.renderKeep();
    document.querySelector('[data-accsel="' + selected + '"]')?.focus({ preventScroll: true });
    return;
  };

  function registerDragOver(target = document) {
    return registerEventOnce(target, "import.registerDragOver", "dragover", (e) => {
      const z = e.target.closest && e.target.closest("#acc-drop");
      if (!z) return;
      e.preventDefault();
      z.classList.add("over");
    });
  }

  function registerDragLeave(target = document) {
    return registerEventOnce(target, "import.registerDragLeave", "dragleave", (e) => {
      const z = e.target.closest && e.target.closest("#acc-drop");
      if (z) z.classList.remove("over");
    });
  }

  function registerFileDrop(target = document) {
    return registerEventOnce(target, "import.registerFileDrop", "drop", (e) => {
      const z = e.target.closest && e.target.closest("#acc-drop");
      if (!z) return;
      e.preventDefault();
      z.classList.remove("over");
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) services.readAccelaFile(f);
    });
  }

  const changeInspectionDateTime = (e) => {
    editor.state.acc[e.target.id === "acc-date" ? "manualDate" : "manualTime"] = e.target.value;
    services.scheduleDraftSave();
    services.renderKeep();
    return;
  };
  return {
    registerLookupSubmit,
    registerLookupClicks,
    registerLookupDrop,
    pickWorkbook,
    cancelImport,
    acceptImport,
    selectCase,
    selectInspection,
    registerDragOver,
    registerDragLeave,
    registerFileDrop,
    changeInspectionDateTime,
  };
}
