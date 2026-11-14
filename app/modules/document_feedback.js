import { editorState as editor } from "./editor_state.js";
import { doc } from "./writer_queries.js";

// A bubble can be typed into only while its item is still editable in the open draft.
function blankEditable(services, field, documentId, itemId) {
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
    field.isConnected
  );
}

// Use the browser editing transaction so Undo restores the original bubble. A fallback keeps synthetic DOMs and
// browsers without insertText working; input is delivered exactly once when the native transaction succeeds.
function insertBlankText(services, field, el, text, selection) {
  if (typeof services.document.execCommand !== "function") return false;
  const range = services.document.createRange();
  range.selectNode(el);
  selection.removeAllRanges();
  selection.addRange(range);
  let notified = false;
  const input = () => (notified = true);
  field.addEventListener("input", input);
  // Chromium otherwise turns neighboring ordinary spaces into NBSP around the noneditable bubble.
  const whitespace = field.style.getPropertyValue("white-space"),
    priority = field.style.getPropertyPriority("white-space"),
    hadStyle = field.hasAttribute("style");
  field.style.setProperty("white-space", "pre-wrap", "important");
  try {
    services.document.execCommand("insertText", false, text);
  } catch {
    // The ordinary text-node path remains available if the browser refuses the optional editing command.
  } finally {
    field.removeEventListener("input", input);
    if (whitespace) field.style.setProperty("white-space", whitespace, priority);
    else field.style.removeProperty("white-space");
    if (!hadStyle && !field.style.cssText) field.removeAttribute("style");
  }
  if (field.contains(el)) return false;
  if (!notified) field.dispatchEvent(new services.Event("input", { bubbles: true }));
  return true;
}

/* Owner direction after R82: selecting a fill-in bubble only focuses it, showing its double ring. The first character
   typed replaces the bubble in the sentence and the caret stays after it, so the rest of the detail is typed straight
   into the item's text; no box or dialog opens. Returns true when the text replaced the bubble. */
function inlineFillBlank(services, el, text) {
  const field = el?.closest('[data-field="text"]'),
    d = doc(editor.state.docId);
  if (!field || !d) return false;
  if (text === undefined) {
    el.focus();
    return false;
  }
  if (!text || !blankEditable(services, field, d.id, field.dataset.id)) {
    if (text) services.A11Y.notify("This item is no longer editable; the detail was not added.", { severity: "error" });
    return false;
  }
  field.focus();
  const selection = services.document.getSelection();
  if (insertBlankText(services, field, el, text, selection)) return true;
  const typed = services.document.createTextNode(text);
  el.replaceWith(typed);
  const range = services.document.createRange();
  range.setStart(typed, typed.length);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  field.dispatchEvent(new services.Event("input", { bubbles: true }));
  return true;
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

  const fillBlank = (el, text) => inlineFillBlank(services, el, text);
  return { toast, toastHold, toastUndo, fillBlank };
}
