import { html, raw } from "./screen_html.js";
import { enhanceCharacterCounts } from "./character_count.js";
import { enhanceSearchResults } from "./search_highlighting.js";
function messageMarkup(m, callbacks, safe) {
  return (
    '<div class="toast message-' +
    `${m.severity}` +
    '" role="' +
    `${["error", "warning"].includes(m.severity) ? "alert" : "status"}` +
    '" aria-atomic="true" data-message="' +
    `${m.id}` +
    '"><span>' +
    `${safe(m.text)}` +
    "</span>" +
    (m.routine ? '<button class="btn" data-a11y-history aria-label="Details: open message history">Details</button>' : "") +
    `${callbacks.has(m.id) ? `<button class="btn" data-message-undo="${m.id}">Undo</button>` : ""}` +
    '<button class="message-dismiss" data-message-dismiss="' +
    `${m.id}` +
    '" aria-label="Dismiss message: ' +
    `${safe(m.text)}` +
    '">×</button></div>'
  );
}

const messageFocusAction = (active) =>
  active?.hasAttribute?.("data-a11y-history") ? "history" : active?.hasAttribute?.("data-message-undo") ? "undo" : "dismiss";
const routineMessage = (severity, options) => severity === "success" && !options.undo && !options.key && !options.inline;
function messageSeverity(text, options) {
  return (
    options.severity ||
    (/failed|could not|cannot|unavailable|invalid|not saved|error|not readable|fixed after/i.test(text)
      ? "error"
      : /^(Saved|Filed|Loaded|Added|Removed|Opened|Reconnected|Workspace restored|[0-9]+ .* (written|moved|restored))/i.test(text)
        ? "success"
        : "warning")
  );
}
function consolidateRoutine(messages, scope, dismiss) {
  for (const previous of messages.filter((m) => m.routine && m.scope === scope)) {
    const el = document.querySelector('[data-message="' + previous.id + '"]');
    if (!el?.contains(document.activeElement) && !el?.matches(":hover")) dismiss(previous.id);
  }
}
const ALERT_MS = 15000;
const lifetime = (severity, duration) => (severity === "success" ? Math.max(6000, Number(duration) || 7000) : ALERT_MS);

const safe = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* Shared screen accessibility; printable document source is not changed. */
function enhanceDocumentControls() {
  enhanceSearchResults(document.body);
  document.querySelectorAll("strong[aria-readonly]").forEach((el) => {
    el.setAttribute("role", "textbox");
    el.setAttribute("aria-label", "Case number");
  });
  const names = {
    number: "Case number",
    address: "Property address",
    ownerBlock: "Owner and mailing address",
    text: "Corrective action",
    sections: "Violation sections",
    title: "Violation title",
    group: "Violation group",
    ord: "Ordinance",
    deptId: "Department ID",
    comment: "Citation comment",
  };
  document.querySelectorAll("[contenteditable]").forEach((el) => {
    const key = el.dataset.case || el.dataset.field || el.dataset.cit?.split("|")[1];
    el.setAttribute("role", "textbox");
    el.setAttribute("aria-label", names[key] || el.dataset.ph || key || "Document text");
    el.setAttribute("aria-multiline", String(["ownerBlock", "text", "sections", "comment"].includes(key)));
    el.tabIndex = 0;
  });
  document.querySelectorAll("#app input,#app select,#overlay input,#overlay select").forEach((el, index) => {
    if (
      el.type === "hidden" ||
      el.hasAttribute("aria-label") ||
      el.hasAttribute("aria-labelledby") ||
      el.closest("label") ||
      (el.id && document.querySelector(`label[for="${el.id}"]`))
    )
      return;
    el.setAttribute(
      "aria-label",
      String(
        el.dataset.ph || el.placeholder || el.title || el.dataset.case || el.dataset.doc || el.dataset.field || el.id || "Option " + (index + 1),
      ).replace(/[-_]/g, " "),
    );
  });
  document.querySelectorAll("#app table,#overlay table").forEach((table, index) => {
    if (!table.querySelector("caption") && typeof table.prepend === "function") {
      const caption = document.createElement("caption");
      caption.className = "sr-only";
      caption.textContent = table.closest(".card,.panel,.modal-box")?.querySelector("h2,h3")?.textContent || "Case information " + (index + 1);
      table.prepend(caption);
    }
    table.querySelectorAll("thead th").forEach((el) => (el.scope = "col"));
    table.querySelectorAll("tbody tr").forEach((row) => {
      const el = row.firstElementChild;
      if (el?.tagName === "TH") el.scope = "row";
    });
  });
}

const bannerKey = (b) => (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 400);

const topBanners = () => [...document.querySelectorAll("#app .banner")].filter((b) => !b.closest(".card, .sheet, .desk, dialog, .modal, #overlay"));
function enhanceScreenGroups() {
  // ARIA names on generic divs need a semantic role. Keep this screen-only DOM enhancement outside stored/print markup.
  document.querySelectorAll(".applied-filters[aria-label], .initial-citation-previews[aria-label]").forEach((el) => el.setAttribute("role", "group"));
}

// Queue, repeat or replace one message (R59 timing and grouping rules); st is the owner's message state.
function a11yQueueMessage(st, text, options = {}) {
  const severity = messageSeverity(text, options);
  const key = options.key || "",
    value = String(text);
  if (key && st.dismissedKeys.has(key)) return;
  const duplicate =
    !options.undo &&
    ["error", "warning", "progress"].includes(severity) &&
    st.messages.find((m) => (key ? m.key === key : m.text === value && m.severity === severity));
  if (duplicate) {
    duplicate.scope = document.querySelector("#utility-title")?.textContent || "";
    if (duplicate.severity !== "progress") {
      // Shown again: a fresh 15-second interval, still paused while the message is hovered or focused.
      const paused = !duplicate.started;
      clearTimeout(duplicate.timer);
      duplicate.started = 0;
      duplicate.remaining = lifetime(duplicate.severity);
      if (!paused) st.resume(duplicate);
    }
    st.requestPaint();
    return;
  }
  st.messages.filter((m) => m.severity === "progress").forEach((m) => st.dismiss(m.id));
  const scope = document.querySelector("#utility-title")?.textContent || "";
  const routine = routineMessage(severity, options);
  if (routine) consolidateRoutine(st.messages, scope, st.dismiss);
  const m = {
    routine,
    id: st.nextId(),
    key,
    inline: !!options.inline,
    scope: document.querySelector("#utility-title")?.textContent || "",
    text: value,
    severity,
    remaining: lifetime(severity, options.duration),
    started: 0,
    at: new Date().toISOString(),
  };
  st.messages.push(m);
  if (options.undo) st.callbacks.set(m.id, options.undo);
  // Messages remain visible and announced in this tab if optional history storage fails.
  st.remember({ text: m.text, severity, at: m.at });
  st.requestPaint();
  st.resume(m);
}

function a11yUtilityDialog(st, title, body) {
  const old = document.getElementById("utility-dialog");
  if (!old || !old.contains(document.activeElement)) st.utilityInvoker = document.activeElement;
  old?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "utility-dialog";
  dialog.className = "utility-dialog";
  dialog.setAttribute("aria-labelledby", "utility-title");
  dialog.innerHTML = html`<h2 id="utility-title">${raw(safe(title))}</h2>${raw(body)}<div class="utility-actions"><button class="btn" data-utility-close>Close</button></div>`;
  document.body.append(dialog);
  st.requestPaint();
  const previous = st.utilityInvoker;
  dialog.addEventListener("cancel", (e) => {
    if (dialog.querySelector("form button[disabled]")) e.preventDefault();
  });
  dialog.addEventListener("close", () => {
    dialog.remove();
    st.requestPaint();
    st.utilityInvoker = null;
    let target = previous;
    if (target && !target.isConnected) {
      target = target.id ? document.getElementById(target.id) : null;
      if (!target && previous?.dataset)
        target = [...document.querySelectorAll("button,a,input,select,[tabindex]")].find(
          (el) => Object.keys(previous.dataset).length && Object.entries(previous.dataset).every(([key, value]) => el.dataset[key] === value),
        );
    }
    (target || document.getElementById("main-content"))?.focus?.();
  });
  if (dialog.showModal) dialog.showModal();
  else {
    dialog.setAttribute("open", "");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.querySelector("button")?.focus();
  }
}

function a11yShortcutSheet(utility) {
  utility(
    "Keyboard shortcuts",
    '<table><caption>Writer and Reports keyboard shortcuts</caption><thead><tr><th scope="col">Key</th><th scope="col">Action</th></tr></thead><tbody><tr><th scope="row">?</th><td>Open this sheet outside a text field</td></tr><tr><th scope="row">Tab / Shift+Tab</th><td>Move between controls inside the active dialog</td></tr><tr><th scope="row">Escape</th><td>Close a dialog when no save is running</td></tr><tr><th scope="row">Ctrl+S / Command+S</th><td>Save Writer work on this device</td></tr><tr><th scope="row">1 / 2 / 3 / 4</th><td>One item at a time: Corrected / Progress made / No change / No access</td></tr><tr><th scope="row">U</th><td>Undo the last outcome in One item at a time</td></tr><tr><th scope="row">Enter / Space</th><td>Activate the focused button or blank bubble</td></tr></tbody></table>',
  );
}
function a11yHistorySheet(utility, history) {
  utility(
    "Message history",
    html`<p>The latest 200 messages in this browser profile. Dismissed alerts remain here.</p><ol>${raw(
      "".concat(
        history
          .slice()
          .reverse()
          .map(
            (m) =>
              "<li><strong>" +
              `${safe(m.severity)}` +
              '</strong> · <time datetime="' +
              `${safe(m.at)}` +
              '">' +
              `${safe(new Date(m.at).toLocaleString())}` +
              "</time><p>" +
              `${safe(m.text)}` +
              "</p></li>",
          )
          .join("") || "<li>No messages yet.</li>",
      ),
    )}</ol>`,
  );
}

/* R53: top-of-page warnings clear 15 seconds after they appear unless the user dismissed them first. Hovering
   or focusing a warning restarts its timer. Each cleared warning is kept in Message history. A warning that
   disappears and later recurs (its condition cleared and came back) shows again. Ongoing conditions remain
   visible in their own indicator (save status, read-only case, held issuance). */
function createA11yBannerSweep(remember) {
  const BANNER_MS = 15000,
    bannerSeen = new Map(),
    bannerCleared = new Set();
  const engaged = (b) => {
    try {
      return b.matches(":hover") || b.contains(document.activeElement);
    } catch {
      return b.contains(document.activeElement);
    }
  };
  function bannerSweep(now = Date.now()) {
    const present = new Set();
    for (const b of topBanners()) {
      const key = bannerKey(b);
      if (!key) continue;
      present.add(key);
      if (!bannerSeen.has(key) || engaged(b)) bannerSeen.set(key, now);
      if (!bannerCleared.has(key) && now - bannerSeen.get(key) >= BANNER_MS) {
        bannerCleared.add(key);
        // Optional history storage; the warning was already shown and announced.
        remember({ text: key, severity: "warning", at: new Date(now).toISOString() });
      }
      if (bannerCleared.has(key)) {
        b.hidden = true;
        b.setAttribute("data-auto-cleared", "");
      }
    }
    for (const key of [...bannerSeen.keys()])
      if (!present.has(key)) {
        bannerSeen.delete(key);
        bannerCleared.delete(key);
      }
  }
  return bannerSweep;
}

// Document-level message, history, shortcut and theme controls, registered in their original order.
function registerA11yDocumentEvents(api) {
  document.addEventListener("click", (e) => {
    const t = e.target.closest?.("[data-message-dismiss],[data-message-undo],[data-a11y-history],[data-a11y-help],[data-utility-close]");
    if (!t) return;
    if (t.dataset.messageDismiss) {
      const m = api.messages.find((m) => m.id === t.dataset.messageDismiss);
      if (m?.key) api.dismissedKeys.add(m.key);
      api.dismiss(t.dataset.messageDismiss);
    } else if (t.dataset.messageUndo) {
      const fn = api.callbacks.get(t.dataset.messageUndo);
      api.dismiss(t.dataset.messageUndo);
      fn?.();
    } else if (t.hasAttribute("data-a11y-history")) api.showHistory();
    else if (t.hasAttribute("data-a11y-help")) api.shortcuts();
    else {
      const dialog = document.getElementById("utility-dialog");
      if (!dialog?.querySelector("form button[disabled]")) dialog?.close();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.hasAttribute?.("data-a11y-theme")) api.setTheme(e.target.value);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.isContentEditable && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
      e.preventDefault();
      api.shortcuts();
    }
    if (e.key === "Enter" && e.target.matches?.('[contenteditable="true"][aria-multiline="false"]')) {
      e.preventDefault();
      e.target.blur();
    }
  });
}

// Re-enhance after DOM changes and sweep top-of-page warnings (real browsers also sweep every second).
function observeA11yMutations(enhance, bannerSweep) {
  if (window.MutationObserver && document.body) {
    let queued = false;
    new window.MutationObserver(() => {
      if (queued) return;
      queued = true;
      Promise.resolve().then(() => {
        queued = false;
        enhance(false);
        enhanceCharacterCounts(document);
        enhanceScreenGroups();
        bannerSweep();
      });
    }).observe(document.body, { childList: true, subtree: true });
    // A real browser sweeps every second; the simulated test DOM drives bannerSweep directly, and a
    // never-ending timer there would keep the test process alive.
    if (!/jsdom/i.test(window.navigator?.userAgent || "")) window.setInterval(() => bannerSweep(), 1000);
  }
}

function restoreMessageFocus(focusedMessage, focusedAction) {
  if (focusedMessage)
    document
      .querySelector(
        '[data-message="' +
          focusedMessage.dataset.message +
          '"] ' +
          (focusedAction === "history" ? "[data-a11y-history]" : "[data-message-" + focusedAction + "]"),
      )
      ?.focus({ preventScroll: true });
}

// Pause each shown message's timer while it is hovered or focused; resume when left.
function a11yBindMessageTimers(messages, pause, resume) {
  for (const el of document.querySelectorAll("[data-message]")) {
    const m = messages.find((m) => m.id === el.dataset.message);
    if (!m) continue;
    el.addEventListener("mouseenter", () => pause(m));
    el.addEventListener("mouseleave", () => {
      if (!el.contains(document.activeElement)) resume(m);
    });
    el.addEventListener("focusin", () => pause(m));
    el.addEventListener("focusout", (e) => {
      if (!el.contains(e.relatedTarget) && !el.matches(":hover")) resume(m);
    });
    if (el.matches(":hover") || el.contains(document.activeElement)) pause(m);
  }
}

export function createAccessibility() {
  const messages = [],
    callbacks = new Map(),
    historyKey = "madison-message-history-v1";
  let history = [],
    theme = "system",
    sequence = 0,
    invoker = null,
    hadDialog = false,
    paintQueued = false;
  const dismissedKeys = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(historyKey) || "[]");
    if (Array.isArray(stored)) history = stored.filter((m) => m && typeof m.text === "string").slice(-200);
    theme = localStorage.getItem("madison-theme-v1") || "system";
  } catch {
    /* Optional local message history and theme may be unavailable; defaults remain usable. */
  }
  // Message state handed to the module-level message and dialog helpers (explicit fields, not a registry).
  function remember(entry) {
    history.push(entry);
    history = history.slice(-200);
    try {
      localStorage.setItem(historyKey, JSON.stringify(history));
    } catch {
      /* Optional local message history; the message itself was already shown and announced. */
    }
  }
  const messageState = {
    messages,
    callbacks,
    dismissedKeys,
    utilityInvoker: null,
    nextId: () => String(++sequence),
    remember,
    requestPaint: () => requestPaint(),
    resume: (m) => resume(m),
    dismiss: (id) => dismiss(id),
  };
  function setTheme(value) {
    theme = ["system", "light", "dark", "high"].includes(value) ? value : "system";
    if (document.documentElement) document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("madison-theme-v1", theme);
    } catch {
      /* The selected theme applies to this tab even if storing the preference is unavailable. */
    }
  }
  function pause(m) {
    if (!m) return;
    clearTimeout(m.timer);
    if (m.started) m.remaining = Math.max(0, m.remaining - (Date.now() - m.started));
    m.started = 0;
  }
  /* R59: success messages keep their own duration; warnings and errors clear 15 seconds after each time they
     are shown or shown again; progress messages stay until their operation replaces them. Hover and keyboard
     focus pause every timer. Message history keeps every message, and clearing a message never clears the
     condition it reports (blocking checks stay in Review and inline, and issuance stays blocked). */
  function resume(m) {
    if (!m || m.severity === "progress" || m.started) return;
    if (m.remaining <= 0) {
      dismiss(m.id);
      return;
    }
    m.started = Date.now();
    m.timer = setTimeout(() => dismiss(m.id), m.remaining);
  }
  function requestPaint() {
    if (paintQueued) return;
    paintQueued = true;
    Promise.resolve().then(() => {
      paintQueued = false;
      paint();
    });
  }
  function dismiss(id) {
    const index = messages.findIndex((m) => m.id === id);
    if (index < 0) return;
    clearTimeout(messages[index].timer);
    messages.splice(index, 1);
    callbacks.delete(id);
    requestPaint();
  }
  function paint() {
    const active = document.activeElement,
      focusedMessage = active?.closest?.("[data-message]"),
      focusedAction = messageFocusAction(active);
    let host = document.getElementById("toast");
    if (!host && document.body) {
      host = document.createElement("div");
      host.id = "toast";
      document.body.append(host);
    }
    if (!host) return;
    host.classList?.add("message-stack");
    const main = document.querySelector("#app .main");
    if (main && main.firstElementChild !== host) main.prepend(host);
    const dialog = document.getElementById("utility-dialog"),
      title = dialog?.querySelector("#utility-title")?.textContent;
    let local = dialog?.querySelector("[data-utility-messages]");
    if (dialog && !local) {
      local = document.createElement("div");
      local.dataset.utilityMessages = "";
      local.className = "message-stack";
      dialog.querySelector("#utility-title")?.after(local);
    }
    const markup = (m) => messageMarkup(m, callbacks, safe);
    const visible = messages.filter((m) => !m.inline);
    host.innerHTML = visible
      .filter((m) => !title || m.scope !== title)
      .map(markup)
      .join("");
    if (local)
      local.innerHTML = visible
        .filter((m) => m.scope === title)
        .map(markup)
        .join("");
    // Adding or repeating another message repaints the stack. Keep keyboard focus in the same message,
    // otherwise its paused timer would lose its focusout event and remain paused indefinitely.
    restoreMessageFocus(focusedMessage, focusedAction);
    a11yBindMessageTimers(messages, pause, resume);
  }

  function resolve(key) {
    dismissedKeys.delete(key);
    messages.filter((m) => m.key === key).forEach((m) => dismiss(m.id));
  }
  function notify(text, options = {}) {
    a11yQueueMessage(messageState, text, options);
  }

  const utility = (title, body) => a11yUtilityDialog(messageState, title, body);
  const shortcuts = () => a11yShortcutSheet(utility);
  const showHistory = () => a11yHistorySheet(utility, history);
  function rememberFocus() {
    if (document.querySelector('#overlay [role="dialog"]')) return;
    const el = document.activeElement;
    if (el && el !== document.body) invoker = { element: el, id: el.id, dataset: { ...el.dataset } };
  }
  function returnFocus() {
    if (!invoker) return;
    let el = invoker.element;
    if (!el.isConnected) {
      el = invoker.id ? document.getElementById(invoker.id) : null;
      if (!el && Object.keys(invoker.dataset).length)
        el = [...document.querySelectorAll("button,a,input,select,[tabindex]")].find((n) =>
          Object.entries(invoker.dataset).every(([k, v]) => n.dataset[k] === v),
        );
    }
    (el || document.getElementById("main-content"))?.focus?.({ preventScroll: true });
    invoker = null;
  }
  function enhance(repaint = true) {
    if (!document.body || typeof document.body.prepend !== "function") return;
    if (!document.querySelector(".skip-link")) {
      const link = document.createElement("a");
      link.href = "#main-content";
      link.className = "skip-link";
      link.textContent = "Skip to main content";
      document.body.prepend(link);
    }
    document.querySelectorAll(".main").forEach((el) => {
      el.id = "main-content";
      el.setAttribute("role", "main");
      el.tabIndex = -1;
    });
    document.querySelectorAll(".rail nav").forEach((nav) => {
      if (nav.classList.contains("writer-navigation")) return;
      nav.setAttribute("aria-label", "Program navigation");
      if (!nav.querySelector("[data-a11y-history]"))
        nav.insertAdjacentHTML(
          "beforeend",
          html`<button class="rail-item" data-a11y-history>Message history</button><button class="rail-item" data-a11y-help>Keyboard shortcuts (?)</button><label class="rail-theme">Theme <select data-a11y-theme aria-label="Colour theme">${raw(
            "".concat(
              [
                ["system", "Use device setting"],
                ["light", "Light"],
                ["dark", "Dark"],
                ["high", "High contrast"],
              ]
                .map(([value, label]) => `<option value="${value}" ${theme === value ? "selected" : ""}>${label}</option>`)
                .join(""),
            ),
          )}</select></label>`,
        );
    });
    enhanceDocumentControls();

    const dialog = document.querySelector('#overlay [role="dialog"]');
    if (!dialog && hadDialog) returnFocus();
    hadDialog = !!dialog;
    setTheme(theme);
    if (repaint) paint();
  }
  registerA11yDocumentEvents({ messages, callbacks, dismissedKeys, dismiss, showHistory, shortcuts, setTheme });
  const bannerSweep = createA11yBannerSweep(remember);
  observeA11yMutations(enhance, bannerSweep);
  setTheme(theme);
  return { notify, dismiss, resolve, enhance, rememberFocus, utility, shortcuts, showHistory, setTheme, bannerSweep };
}
