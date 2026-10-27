import { doc, reinsp } from "./writer_queries.js";
import { checkAttr } from "./presentation_format.js";
import { WriterState } from "./state.js";
import { rememberLanguageFocus, restoreLanguageFocus } from "./language_discovery.js";
import { helperStop } from "./helper_stopped.js";

export function createAppScreens(services) {
  function render() {
    if (helperStop.stopped) return; // Exit Document Writer replaced the page with its stopped state.
    if (WriterState.STARTUP_STATUS === "locked") return;
    if (!WriterState.WRITER_READY && (services.IDB_OK || WriterState.STARTUP_STATUS === "failed")) {
      const failed = WriterState.STARTUP_STATUS === "failed";
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
      return;
    }
    if (WriterState.state.screen !== "cases") WriterState.state.issuedCase = ""; // R59: the issued-case highlight ends on navigation.
    const appRoot = services.document.getElementById("app"),
      sameImport = WriterState.state.screen === "import" && appRoot?.dataset?.renderScreen === "import";
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
    const languageFocus = rememberLanguageFocus(services.app_languagediscoveryContext());
    // A late save/filing repaint must not close actions the inspector just opened.
    const previous = services.document.querySelector(".document-workspace"),
      actions = services.document.querySelector(".editor-more"),
      active = services.document.activeElement;
    const importFocus =
      WriterState.state.screen === "import" && active?.id === "lookup-number" ? { start: active.selectionStart, end: active.selectionEnd } : null;
    const keepActions = WriterState.state.screen === "write" && previous?.dataset.editorDoc === WriterState.state.docId && actions?.open;
    const actionFocus = keepActions && actions.contains(active) ? (active.tagName === "SUMMARY" ? "summary" : active.id) : "";
    const sameDocument = WriterState.state.screen === "write" && previous?.dataset.editorDoc === WriterState.state.docId;
    const editingDoc = sameDocument ? doc(WriterState.state.docId) : null;
    const editingItem = active?.dataset?.field === "text" && editingDoc?.items.find((item) => item.id === active.dataset.id);
    // Reuse a live text field across passive refreshes so input still reaches its handler.
    // New model text, locks, dialogs and navigation always use the newly rendered field.
    const keepEditing =
      editingItem &&
      !WriterState.state.modal &&
      !WriterState.state.picker &&
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
    const openDetails = sameDocument ? [...previous.querySelectorAll("details[id][open]")].map((el) => el.id) : [];
    const openPricing = sameDocument
      ? [...previous.querySelectorAll("[data-charge] [data-review-details][open]")].map((el) => [
          el.closest("[data-charge]").dataset.charge,
          el.dataset.reviewDetails,
        ])
      : [];
    // A background repaint of the same snow citation must keep focus in the snow fact being entered.
    const snowFocus = sameDocument && previous.contains(active) && active.dataset?.snow ? '[data-snow="' + checkAttr(active.dataset.snow) + '"]' : "";
    // A late save or filing repaint of the same document must not take focus from an identified form field
    // being typed in, such as the correction reason: its input already reached the model, so the new field
    // shows the same value. Dialogs, locks, navigation and changed model values use the newly rendered field.
    const fieldFocus =
      sameDocument &&
      !snowFocus &&
      previous.contains(active) &&
      active.id &&
      active.matches("input,textarea,select") &&
      !WriterState.state.modal &&
      !WriterState.state.picker &&
      !services.isLocked(editingDoc)
        ? {
            id: active.id,
            value: active.value,
            start: typeof active.selectionStart === "number" ? active.selectionStart : null,
            end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
          }
        : null;
    const worksheet = services.document.querySelector("[data-worksheet-context]"),
      inspectionChecks = services.document.querySelector(".ri-checks");
    const keepInspectionChecks =
      WriterState.state.screen === "reinspect" &&
      worksheet?.dataset.worksheetContext === services.walkIdentity(reinsp(WriterState.state.reinspId)) &&
      inspectionChecks?.open;
    const inspectionCheckFocus =
      keepInspectionChecks && inspectionChecks.contains(active)
        ? active.tagName === "SUMMARY"
          ? "summary"
          : active.matches(".check-link")
            ? '.check-link[data-check-index="' + active.dataset.checkIndex + '"][data-check-target="' + active.dataset.checkTarget + '"]'
            : ""
        : "";
    services.A11Y.rememberFocus();
    services.ensureWalkContext();
    services.document.getElementById("app").innerHTML =
      WriterState.state.screen === "cases"
        ? services.screenCases()
        : WriterState.state.screen === "import"
          ? services.screenImport()
          : WriterState.state.screen === "library"
            ? services.screenLibrary()
            : WriterState.state.screen === "tools"
              ? services.navigation.screen()
              : WriterState.state.screen === "write"
                ? services.screenWrite()
                : WriterState.state.screen === "caseactions"
                  ? services.newDocuments.caseActionScreen()
                  : WriterState.state.screen === "actions"
                    ? services.newDocuments.actionScreen()
                    : WriterState.state.screen === "reinspect"
                      ? services.screenReinspect()
                      : services.screenCases();
    if (keepEditing) {
      const replacement = [...appRoot.querySelectorAll('[data-field="text"]')].find((field) => field.dataset.id === active.dataset.id);
      if (replacement) {
        for (const attribute of [...active.attributes]) active.removeAttribute(attribute.name);
        for (const attribute of replacement.attributes) active.setAttribute(attribute.name, attribute.value);
        replacement.replaceWith(active);
      }
    }
    if (appRoot?.dataset) appRoot.dataset.renderScreen = WriterState.state.screen;
    services.document.getElementById("overlay").innerHTML = services.overlayHTML();
    if (WriterState.state.screen === "write") {
      services.paginate();
      services.editorEnhance();
    }
    services.restoreWorkControls();
    services.updateSaveStatus();
    services.enhanceDialog();
    services.highlightOpenChecks();
    services.A11Y.enhance();
    if (keepInspectionChecks) {
      const current = services.document.querySelector(".ri-checks");
      if (current) {
        current.open = true;
        if (inspectionCheckFocus) current.querySelector(inspectionCheckFocus)?.focus({ preventScroll: true });
      }
    }
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
    if (importFocus) {
      const input = services.document.getElementById("lookup-number");
      if (input) {
        input.focus({ preventScroll: true });
        if (Number.isInteger(importFocus.start) && Number.isInteger(importFocus.end)) input.setSelectionRange(importFocus.start, importFocus.end);
      }
    }
    if (keepActions) {
      const current = services.document.querySelector(".editor-more");
      if (current) {
        current.open = true;
        if (actionFocus && !WriterState.state.modal && !WriterState.state.picker) {
          const target = actionFocus === "summary" ? current.querySelector("summary") : services.document.getElementById(actionFocus);
          if (target && current.contains(target)) target.focus({ preventScroll: true });
        }
      }
    }
    // Keep identified disclosures through late history reads for this document only.
    // New validation may still open a previously closed disclosure.
    for (const id of openDetails) {
      const current = services.document.getElementById(id);
      if (current?.tagName === "DETAILS") current.open = true;
    }
    for (const [charge, key] of openPricing) {
      const current = services.document.querySelector('[data-charge="' + checkAttr(charge) + '"] [data-review-details="' + checkAttr(key) + '"]');
      if (current) current.open = true;
    }
    if (snowFocus && !WriterState.state.modal && !WriterState.state.picker)
      services.document.querySelector(".document-workspace " + snowFocus)?.focus({ preventScroll: true });
    if (fieldFocus && !WriterState.state.modal && !WriterState.state.picker) {
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
    const q = services.document.getElementById("pk-q");
    if (q) {
      q.focus();
      q.setSelectionRange(q.value.length, q.value.length);
    }
    restoreLanguageFocus(services.app_languagediscoveryContext(), languageFocus);
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
  }

  function renderKeep() {
    const y = services.window.scrollY;
    if (WriterState.DIRTY) services.scheduleDraftSave();
    render();
    services.window.scrollTo(0, y);
  }
  return { render, renderKeep };
}
