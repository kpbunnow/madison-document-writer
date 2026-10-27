import { editorState as editor } from "./editor_state.js";
import { startupState as startup } from "./startup_state.js";
import { doc, reinsp } from "./writer_queries.js";
import { checkAttr } from "./presentation_format.js";
import { WriterState } from "./state.js";
import { rememberLanguageFocus, restoreLanguageFocus } from "./language_discovery.js";
import { helperStop } from "./helper_stopped.js";

/** @typedef {() => void} RestoreRepaint */
/** @typedef {{swap: RestoreRepaint, restore: RestoreRepaint}} LiveFieldKeeper */
/** @typedef {{previous: HTMLElement|null, actions: HTMLDetailsElement|null, active: HTMLElement|null}} RepaintContext */

function renderStartup(services) {
  if (!startup.WRITER_READY && (services.IDB_OK || startup.STARTUP_STATUS === "failed")) {
    const failed = startup.STARTUP_STATUS === "failed";
    services.document.getElementById("app").innerHTML =
      '<main id="main-content" tabindex="-1" style="max-width:640px;margin:12vh auto;padding:28px"><h1>' +
      (failed ? "Saved workspace could not be restored" : "Restoring saved workspace") +
      '</h1><p role="' +
      (failed ? "alert" : "status") +
      '" aria-live="' +
      (failed ? "assertive" : "polite") +
      '">' +
      (failed
        ? "Editing is paused to protect saved work. Reload to retry. If this continues, ask IT to check this browser’s local storage."
        : "Please wait while your saved cases and unfinished work are restored.") +
      "</p>" +
      (failed ? '<button id="startup-retry">Reload and retry</button>' : "") +
      "</main>";
    services.document.getElementById("overlay").innerHTML = "";
    services.document.getElementById("startup-retry")?.addEventListener("click", () => services.location.reload());
    if (failed) services.document.getElementById("main-content")?.focus({ preventScroll: true });
    return true;
  }
  return false;
}

/** Capture now; restore after enhancement. @returns {RestoreRepaint} */
function keepImportDisclosures(services, sameImport) {
  const importDisclosures = sameImport
    ? [...services.document.querySelectorAll(".import-alternative,.import-workflow")].map((el) => ({
        selector: el.classList.contains("import-alternative") ? ".import-alternative" : ".import-workflow",
        open: el.open,
        focus: el.contains(services.document.activeElement)
          ? services.document.activeElement.tagName === "SUMMARY"
            ? "summary"
            : services.document.activeElement.id
              ? services.document.activeElement.id
              : ""
          : "",
      }))
    : [];
  return () => {
    for (const kept of importDisclosures) {
      const current = services.document.querySelector(kept.selector);
      if (current) {
        current.open = kept.open;
        if (kept.focus) {
          const target = kept.focus === "summary" ? current.querySelector("summary") : services.document.getElementById(kept.focus);
          if (current.contains(target)) target?.focus({ preventScroll: true });
        }
      }
    }
  };
}

/** Capture now; restore after enhancement. @returns {RestoreRepaint} */
function keepImportCaret(services, active) {
  const importFocus =
    editor.state.screen === "import" && active?.id === "lookup-number" ? { start: active.selectionStart, end: active.selectionEnd } : null;
  return () => {
    if (importFocus) {
      const input = services.document.getElementById("lookup-number");
      if (input) {
        input.focus({ preventScroll: true });
        if (Number.isInteger(importFocus.start) && Number.isInteger(importFocus.end)) input.setSelectionRange(importFocus.start, importFocus.end);
      }
    }
  };
}

/** Capture now; restore after enhancement. @returns {RestoreRepaint} */
function keepDocumentActions(services, previous, actions, active) {
  const keepActions = editor.state.screen === "write" && previous?.dataset.editorDoc === editor.state.docId && actions?.open;
  const actionFocus = keepActions && actions.contains(active) ? (active.tagName === "SUMMARY" ? "summary" : active.id) : "";
  return () => {
    if (keepActions) {
      const current = services.document.querySelector(".editor-more");
      if (current) {
        current.open = true;
        if (actionFocus && !editor.state.modal && !editor.state.picker) {
          const target = actionFocus === "summary" ? current.querySelector("summary") : services.document.getElementById(actionFocus);
          if (target && current.contains(target)) target.focus({ preventScroll: true });
        }
      }
    }
  };
}

/** Capture now; restore after enhancement. @returns {RestoreRepaint} */
function keepOpenDetails(services, sameDocument, previous) {
  const openDetails = sameDocument ? [...previous.querySelectorAll("details[id][open]")].map((el) => el.id) : [];
  return () => {
    // Keep identified disclosures through late history reads for this document only.
    // New validation may still open a previously closed disclosure.
    for (const id of openDetails) {
      const current = services.document.getElementById(id);
      if (current?.tagName === "DETAILS") current.open = true;
    }
  };
}

/** Capture now; restore after enhancement. @returns {RestoreRepaint} */
function keepOpenPricing(services, sameDocument, previous) {
  const openPricing = sameDocument
    ? [...previous.querySelectorAll("[data-charge] [data-review-details][open]")].map((el) => [
        el.closest("[data-charge]").dataset.charge,
        el.dataset.reviewDetails,
      ])
    : [];
  return () => {
    for (const [charge, key] of openPricing) {
      const current = services.document.querySelector('[data-charge="' + checkAttr(charge) + '"] [data-review-details="' + checkAttr(key) + '"]');
      if (current) current.open = true;
    }
  };
}

function keepSnowFocus(services, sameDocument, previous, active) {
  // A background repaint of the same snow citation must keep focus in the snow fact being entered.
  const snowFocus = sameDocument && previous.contains(active) && active.dataset?.snow ? '[data-snow="' + checkAttr(active.dataset.snow) + '"]' : "";
  return {
    selector: snowFocus,
    restore() {
      if (snowFocus && !editor.state.modal && !editor.state.picker)
        services.document.querySelector(".document-workspace " + snowFocus)?.focus({ preventScroll: true });
    },
  };
}

/** Capture now; restore after enhancement. @returns {RestoreRepaint} */
function keepFieldFocus(services, sameDocument, previous, active, editingDoc, snowFocus) {
  // A late save or filing repaint of the same document must not take focus from an identified form field
  // being typed in, such as the correction reason: its input already reached the model, so the new field
  // shows the same value. Dialogs, locks, navigation and changed model values use the newly rendered field.
  const fieldFocus =
    sameDocument &&
    !snowFocus &&
    previous.contains(active) &&
    active.id &&
    active.matches("input,textarea,select") &&
    !editor.state.modal &&
    !editor.state.picker &&
    !services.isLocked(editingDoc)
      ? {
          id: active.id,
          value: active.value,
          start: typeof active.selectionStart === "number" ? active.selectionStart : null,
          end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
        }
      : null;
  return () => {
    if (fieldFocus && !editor.state.modal && !editor.state.picker) {
      const field = services.document.getElementById(fieldFocus.id);
      if (field && field.closest(".document-workspace") && field.value === fieldFocus.value && services.document.activeElement !== field) {
        field.focus({ preventScroll: true });
        if (fieldFocus.start !== null && typeof field.setSelectionRange === "function")
          try {
            field.setSelectionRange(fieldFocus.start, fieldFocus.end);
          } catch (error) {
            // Date and select controls have no text selection; focus alone is restored.
          }
      }
    }
  };
}

/** Capture now; restore after enhancement. @returns {RestoreRepaint} */
function keepInspectionChecks(services, active) {
  const worksheet = services.document.querySelector("[data-worksheet-context]"),
    inspectionChecks = services.document.querySelector(".ri-checks");
  const keepInspectionChecks =
    editor.state.screen === "reinspect" &&
    worksheet?.dataset.worksheetContext === services.walkIdentity(reinsp(editor.state.reinspId)) &&
    inspectionChecks?.open;
  const inspectionCheckFocus =
    keepInspectionChecks && inspectionChecks.contains(active)
      ? active.tagName === "SUMMARY"
        ? "summary"
        : active.matches(".check-link")
          ? '.check-link[data-check-index="' + active.dataset.checkIndex + '"][data-check-target="' + active.dataset.checkTarget + '"]'
          : ""
      : "";
  return () => {
    if (keepInspectionChecks) {
      const current = services.document.querySelector(".ri-checks");
      if (current) {
        current.open = true;
        if (inspectionCheckFocus) current.querySelector(inspectionCheckFocus)?.focus({ preventScroll: true });
      }
    }
  };
}

/** Swap before enhancement; restore focus last. @returns {LiveFieldKeeper} */
function keepLiveField(services, editingDoc, previous, active, appRoot) {
  const editingItem = active?.dataset?.field === "text" && editingDoc?.items.find((item) => item.id === active.dataset.id);
  // Reuse a live text field across passive refreshes so input still reaches its handler.
  // New model text, locks, dialogs and navigation always use the newly rendered field.
  const keepEditing =
    editingItem &&
    !editor.state.modal &&
    !editor.state.picker &&
    active.isContentEditable &&
    previous.contains(active) &&
    !services.isLocked(editingDoc) &&
    String(active.innerText ?? active.textContent ?? "") === String(editingItem.text ?? "");
  const selection = keepEditing && services.window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const caret =
    range && active.contains(range.startContainer) && active.contains(range.endContainer)
      ? { start: range.startContainer, startOffset: range.startOffset, end: range.endContainer, endOffset: range.endOffset }
      : null;
  return {
    swap() {
      if (keepEditing) {
        const replacement = [...appRoot.querySelectorAll('[data-field="text"]')].find((field) => field.dataset.id === active.dataset.id);
        if (replacement) {
          for (const attribute of [...active.attributes]) active.removeAttribute(attribute.name);
          for (const attribute of replacement.attributes) active.setAttribute(attribute.name, attribute.value);
          replacement.replaceWith(active);
        }
      }
    },
    restore() {
      if (keepEditing && active.isConnected) {
        active.focus({ preventScroll: true });
        if (caret) {
          try {
            const restored = services.document.createRange();
            restored.setStart(caret.start, caret.startOffset);
            restored.setEnd(caret.end, caret.endOffset);
            selection.removeAllRanges();
            selection.addRange(restored);
          } catch (error) {
            // A browser may normalize a selection; the editing node and its text remain intact.
          }
        }
      }
    },
  };
}

function screenHTML(services) {
  switch (editor.state.screen) {
    case "cases":
      return services.screenCases();
    case "import":
      return services.screenImport();
    case "library":
      return services.screenLibrary();
    case "tools":
      return services.navigation.screen();
    case "write":
      return services.screenWrite();
    case "caseactions":
      return services.newDocuments.caseActionScreen();
    case "actions":
      return services.newDocuments.actionScreen();
    case "reinspect":
      return services.screenReinspect();
    default:
      return services.screenCases();
  }
}

/** @returns {RepaintContext} */
function repaintContext(services) {
  return {
    previous: services.document.querySelector(".document-workspace"),
    actions: services.document.querySelector(".editor-more"),
    active: services.document.activeElement,
  };
}

export function createAppScreens(services) {
  function render() {
    if (helperStop.stopped) return; // Exit Document Writer owns the stopped page.
    if (startup.STARTUP_STATUS === "locked") return;
    if (renderStartup(services)) return;
    if (editor.state.screen !== "cases") editor.state.issuedCase = "";
    const appRoot = services.document.getElementById("app"),
      sameImport = editor.state.screen === "import" && appRoot?.dataset?.renderScreen === "import";
    const importDisclosures = keepImportDisclosures(services, sameImport);
    const languageFocus = rememberLanguageFocus(services.app_languagediscoveryContext());
    const { previous, actions, active } = repaintContext(services);
    const importCaret = keepImportCaret(services, active);
    const documentActions = keepDocumentActions(services, previous, actions, active);
    const sameDocument = editor.state.screen === "write" && previous?.dataset.editorDoc === editor.state.docId;
    const editingDoc = sameDocument ? doc(editor.state.docId) : null;
    const liveField = keepLiveField(services, editingDoc, previous, active, appRoot);
    const openDetails = keepOpenDetails(services, sameDocument, previous);
    const openPricing = keepOpenPricing(services, sameDocument, previous);
    const snowFocus = keepSnowFocus(services, sameDocument, previous, active);
    const fieldFocus = keepFieldFocus(services, sameDocument, previous, active, editingDoc, snowFocus.selector);
    const inspectionChecks = keepInspectionChecks(services, active);
    services.A11Y.rememberFocus();
    services.ensureWalkContext();
    // Both walk context and a renderer may redirect. Read the route at each phase.
    services.document.getElementById("app").innerHTML = screenHTML(services);
    liveField.swap();
    if (appRoot?.dataset) appRoot.dataset.renderScreen = editor.state.screen;
    services.document.getElementById("overlay").innerHTML = services.overlayHTML();
    if (editor.state.screen === "write") {
      services.paginate();
      services.editorEnhance();
    }
    services.restoreWorkControls();
    services.updateSaveStatus();
    services.enhanceDialog();
    services.highlightOpenChecks();
    services.A11Y.enhance();
    inspectionChecks();
    importDisclosures();
    importCaret();
    documentActions();
    openDetails();
    openPricing();
    snowFocus.restore();
    fieldFocus();
    const q = services.document.getElementById("pk-q");
    if (q) {
      q.focus();
      q.setSelectionRange(q.value.length, q.value.length);
    }
    restoreLanguageFocus(services.app_languagediscoveryContext(), languageFocus);
    liveField.restore();
  }

  function renderKeep() {
    const y = services.window.scrollY;
    if (WriterState.DIRTY) services.scheduleDraftSave();
    render();
    services.window.scrollTo(0, y);
  }
  return { render, renderKeep };
}
