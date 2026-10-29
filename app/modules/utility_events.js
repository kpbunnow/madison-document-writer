import { editorState as editor } from "./editor_state.js";
import { importsState as imports } from "./imports_state.js";
/* Utility event ownership. Construction is inert; core registers at the original startup positions. */
import { registerEventOnce } from "./event_registration.js";
import { reinsp, doc } from "./writer_queries.js";
export function createUtilityEvents(services) {
  function registerHelpClicks(target = document) {
    return registerEventOnce(target, "utility.registerHelpClicks", "click", (e) => {
      if (e.target.closest?.("[data-a11y-help],[data-a11y-history],[data-utility-close]")) services.navigation.invalidateUtilities();
    });
  }

  function registerHelpKeys(target = document) {
    return registerEventOnce(target, "utility.registerHelpKeys", "keydown", (e) => {
      if (
        !e.defaultPrevented &&
        (e.key === "Escape" || (e.key === "?" && !e.target.isContentEditable && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))
      )
        services.navigation.invalidateUtilities();
    });
  }

  function registerHelpClose(target = document) {
    return registerEventOnce(
      target,
      "utility.registerHelpClose",
      "close",
      (e) => {
        if (e.target.id === "utility-dialog") services.navigation.invalidateUtilities();
      },
      true,
    );
  }

  function registerCheckLinks(target = document) {
    return registerEventOnce(target, "utility.registerCheckLinks", "click", (e) => {
      const b = e.target.closest("[data-check-index]");
      if (!b) return;
      const list = b.dataset.checkWorksheet ? services.worksheetChecks(reinsp(editor.state.reinspId)) : services.checks(doc(editor.state.docId));
      const c = list[+b.dataset.checkIndex],
        target = c?.targets?.[+b.dataset.checkTarget];
      if (target) {
        e.preventDefault();
        services.focusCheckTarget(target, c.t);
      }
    });
  }

  function registerInputChecks(target = document) {
    return registerEventOnce(target, "utility.registerInputChecks", "input", () => queueMicrotask(services.highlightOpenChecks));
  }

  function registerChangeChecks(target = document) {
    return registerEventOnce(target, "utility.registerChangeChecks", "change", () => queueMicrotask(services.highlightOpenChecks));
  }

  function registerDialogKeys(target = document) {
    return registerEventOnce(target, "utility.registerDialogKeys", "keydown", (e) => {
      const box = document.querySelector('[role="dialog"]');
      if (e.key === "Tab" && box) {
        const nodes = Array.from(
          box.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]'),
        ).filter((el) => !el.hidden && el.style.display !== "none");
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (!first) {
          e.preventDefault();
          box.focus();
        } else if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        services.saveDrafts().then((ok) => services.toast(ok ? "Saved on this device" : "Could not save — keep this tab open"));
      }
    });
  }

  function registerDismissKey(target = document) {
    return registerEventOnce(target, "utility.registerDismissKey", "keydown", (e) => {
      if (
        e.key === "Escape" &&
        (editor.state.picker || editor.state.modal) &&
        !editor.AMENDMENT_BUSY &&
        !imports.LOOKUP_BUSY &&
        !editor.RESOLUTION_BUSY
      ) {
        editor.state.picker = false;
        editor.state.modal = null;
        services.render();
      }
    });
  }
  return {
    registerHelpClicks,
    registerHelpKeys,
    registerHelpClose,
    registerCheckLinks,
    registerInputChecks,
    registerChangeChecks,
    registerDialogKeys,
    registerDismissKey,
  };
}
