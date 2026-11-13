import { editorState as editor } from "./editor_state.js";
import { doc } from "./writer_queries.js";

// The next bubble is found only while the same document is still open in the editor.
function nextBlank(document, field, documentId) {
  if (!field.isConnected || editor.state.screen !== "write" || editor.state.docId !== documentId) return null;
  return [...document.querySelectorAll(".blank-edit")].find((b) => field.contains(b) || field.compareDocumentPosition(b) & 4) || field;
}

// A fill-in bubble becomes an inline text box in place; Enter or leaving the box writes the detail into the item.
function inlineFillBlank(services, el) {
  const field = el.closest('[data-field="text"]'),
    d = doc(editor.state.docId);
  if (!field || !d || services.isLocked(d)) return;
  const itemId = field.dataset.id,
    documentId = d.id,
    input = services.document.createElement("input");
  Object.assign(input, { type: "text", className: "blank-input", size: 14, placeholder: "Type the detail" });
  input.setAttribute("aria-label", "Missing corrective-action detail; Enter saves, Escape cancels");
  let settled = false;
  // While the box is open it is the item's only control: the sentence is not edited directly around it. The
  // field's editing attributes are removed (not set false) so the shared accessibility pass leaves it alone.
  const FIELD_CONTROL = ["contenteditable", "tabindex", "role", "aria-multiline", "aria-label"],
    fieldControl = FIELD_CONTROL.map((name) => [name, field.getAttribute(name)]);
  const editable = () => {
    const current = doc(documentId),
      item = current?.items.find((it) => it.id === itemId);
    return (
      editor.state.screen === "write" &&
      editor.state.docId === documentId &&
      !!current &&
      !services.isLocked(current) &&
      !!item &&
      !item.withdrawn &&
      !(item.done && !current.correction) &&
      field.isConnected &&
      field.contains(input)
    );
  };
  // Returns true when the typed detail replaced the bubble; otherwise the bubble is restored unchanged.
  function settle(commit) {
    if (settled || !input.isConnected) return false;
    settled = true;
    for (const [name, value] of fieldControl) if (value !== null) field.setAttribute(name, value);
    const value = input.value.trim();
    if (commit && value && editable()) {
      input.replaceWith(services.document.createTextNode(value));
      field.dispatchEvent(new services.Event("input", { bubbles: true }));
      return true;
    }
    if (commit && value) services.A11Y.notify("This item is no longer editable; the detail was not added.", { severity: "error" });
    input.replaceWith(el);
    return false;
  }
  // The box's own keystrokes must not reach the item's text handlers until the detail is written.
  input.addEventListener("input", (event) => {
    event.stopPropagation();
    input.size = Math.max(14, input.value.length + 2);
  });
  input.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      if (settle(true)) nextBlank(services.document, field, documentId)?.focus();
      else if (el.isConnected) el.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      settle(false);
      if (el.isConnected) el.focus();
    }
  });
  input.addEventListener("blur", () => settle(true));
  el.replaceWith(input);
  FIELD_CONTROL.forEach((name) => field.removeAttribute(name));
  input.focus();
}

export function createDocumentFeedback(services) {
  function toast(m, options) {
    editor.undoFn = null;
    services.A11Y.notify(m, options);
  }

  function toastHold(m) {
    editor.undoFn = null;
    services.A11Y.notify(m, { severity: "progress" });
  }

  function toastUndo(m, fn) {
    editor.undoFn = fn;
    services.A11Y.notify(m, {
      severity: "success",
      undo: () => {
        editor.undoFn = null;
        fn();
      },
    });
  }

  const fillBlank = (el) => inlineFillBlank(services, el);
  return { toast, toastHold, toastUndo, fillBlank };
}
