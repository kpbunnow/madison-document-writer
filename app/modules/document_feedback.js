import { WriterState } from "./state.js";
import { doc } from "./writer_queries.js";

export function createDocumentFeedback(services) {
  function toast(m, options) {
    WriterState.undoFn = null;
    services.A11Y.notify(m, options);
  }

  function toastHold(m) {
    WriterState.undoFn = null;
    services.A11Y.notify(m, { severity: "progress" });
  }

  function toastUndo(m, fn) {
    WriterState.undoFn = fn;
    services.A11Y.notify(m, {
      severity: "success",
      undo: () => {
        WriterState.undoFn = null;
        fn();
      },
    });
  }

  function fillBlank(el) {
    const field = el.closest('[data-field="text"]'),
      d = doc(WriterState.state.docId);
    if (!field || !d || services.isLocked(d)) return;
    const itemId = field.dataset.id,
      documentId = d.id;
    services.A11Y.utility(
      "Add corrective-action detail",
      '<form id="corrective-detail-form"><label class="f" for="corrective-detail"><span>Enter the missing corrective-action detail</span><textarea id="corrective-detail" rows="4" required></textarea></label><p class="hint" id="corrective-detail-error" role="alert"></p><button type="submit" class="btn btn-primary">Save</button></form>',
    );
    const dialog = services.document.getElementById("utility-dialog"),
      form = dialog.querySelector("form");
    dialog.querySelector("[data-utility-close]").textContent = "Cancel";
    dialog.querySelector("textarea").focus();
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = dialog.querySelector("textarea").value.trim();
      if (!value) {
        dialog.querySelector("#corrective-detail-error").textContent = "Enter text, or choose Cancel to leave this item unchanged.";
        return;
      }
      const current = doc(documentId),
        item = current?.items.find((it) => it.id === itemId);
      if (
        WriterState.state.screen !== "write" ||
        WriterState.state.docId !== documentId ||
        !current ||
        services.isLocked(current) ||
        !item ||
        item.withdrawn ||
        (item.done && !current.correction) ||
        !field.isConnected ||
        !field.contains(el)
      ) {
        dialog.querySelector("#corrective-detail-error").textContent = "This item is no longer editable. Cancel and reopen the current document.";
        return;
      }
      el.replaceWith(services.document.createTextNode(value));
      field.dispatchEvent(new services.Event("input", { bubbles: true }));
      // The browser delivers "close" asynchronously and the utility dialog's own handler then restores focus to
      // the replaced blank, which no longer exists. Return focus to the item text after that handler runs.
      dialog.addEventListener("close", () => field.isConnected && field.focus(), { once: true });
      dialog.close();
      field.focus();
    });
  }
  return { toast, toastHold, toastUndo, fillBlank };
}
