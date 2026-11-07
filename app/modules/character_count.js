/* Screen-only feedback. Weak ownership keeps replaced form fields collectible; no record or validation is changed. */
const fields = new WeakMap();
let sequence = 0;

function updateCount(field, state) {
  const used = field.value.length,
    limit = field.maxLength;
  const text = used.toLocaleString("en-US") + " / " + limit.toLocaleString("en-US") + " characters" + (used > limit ? " — exceeds the limit" : "");
  if (state.counter.textContent !== text) state.counter.textContent = text;
}

export function enhanceCharacterCounts(document) {
  for (const field of document.querySelectorAll("textarea[maxlength]")) {
    if (field.maxLength < 0) continue;
    let state = fields.get(field);
    if (!state) {
      state = { id: "character-count-" + ++sequence, counter: null };
      fields.set(field, state);
      field.addEventListener("input", () => updateCount(field, state));
    }
    const anchor = field.closest("label") || field;
    if (!state.counter?.isConnected || state.counter.previousElementSibling !== anchor) {
      state.counter?.remove();
      state.counter = document.createElement("span");
      state.counter.id = state.id;
      state.counter.className = "hint no-print";
      state.counter.dataset.characterCount = "";
      anchor.after(state.counter);
    }
    // Preserve existing validation descriptions. A queryable live count avoids announcing every keystroke.
    const descriptions = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
    descriptions.add(state.id);
    field.setAttribute("aria-describedby", [...descriptions].join(" "));
    updateCount(field, state);
  }
}
