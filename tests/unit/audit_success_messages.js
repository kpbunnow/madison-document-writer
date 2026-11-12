/* Routine confirmations consolidate without hiding alerts, progress, Undo or message history. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const { createAccessibility } = await compile('export {createAccessibility} from "./accessibility.js";');
  const dom = new JSDOM('<div id="app"><main class="main"></main></div><div id="toast"></div>', {
      url: "http://localhost/",
      pretendToBeVisual: true,
    }),
    w = dom.window;
  global.window = w;
  global.document = w.document;
  global.localStorage = w.localStorage;
  w.MutationObserver = undefined;
  const nativeSet = global.setTimeout,
    nativeClear = global.clearTimeout,
    timers = new Map();
  let sequence = 0;
  global.setTimeout = (fn) => {
    timers.set(++sequence, fn);
    return sequence;
  };
  global.clearTimeout = (id) => timers.delete(id);
  try {
    const a = createAccessibility(),
      tick = async () => {
        await Promise.resolve();
        await Promise.resolve();
      };
    a.notify("Saved first");
    a.notify("Filed second");
    a.notify("Loaded third");
    await tick();
    assert.equal(document.querySelectorAll("[data-message]").length, 1);
    assert.equal(timers.size, 1, "replaced confirmations release their timers");
    assert.ok(document.querySelector("#toast").textContent.includes("Loaded third"));
    assert.equal(JSON.parse(localStorage.getItem("madison-message-history-v1")).length, 3);
    const hovered = document.querySelector("[data-message]"),
      heldId = hovered.dataset.message;
    const matches = hovered.matches.bind(hovered);
    hovered.matches = (selector) => selector === ":hover" || matches(selector);
    a.notify("Saved while hovering");
    await tick();
    assert.ok(document.querySelector('[data-message="' + heldId + '"]'), "hovered confirmation is not removed");
    a.notify("Saved keyed condition", { severity: "success", key: "held-condition" });
    a.notify("Saved inline confirmation", { severity: "success", inline: true });
    a.notify("Saved after held messages");
    await tick();
    assert.ok(document.querySelector("#toast").textContent.includes("Saved keyed condition"));
    assert.ok(!document.querySelector("#toast").textContent.includes("Saved inline confirmation"));
    a.notify("Could not save");
    a.notify("Check this warning", { severity: "warning" });
    await tick();
    assert.equal(document.querySelectorAll("[role=alert]").length, 2);
    let undone = 0;
    a.notify("Applied date", { severity: "success", undo: () => undone++ });
    a.notify("Saved fourth");
    await tick();
    assert.equal(document.querySelectorAll("[data-message-undo]").length, 1);
    document.querySelector("[data-message-undo]").click();
    assert.equal(undone, 1);
    await tick();
    const history = document.querySelector("[data-a11y-history]");
    history.focus();
    a.notify("Saved fifth");
    await tick();
    assert.equal(document.activeElement.dataset.a11yHistory, "", "history focus survives repaint");
    document.querySelector('[data-message="' + document.activeElement.closest("[data-message]").dataset.message + '"] [data-a11y-history]').click();
    await tick();
    assert.ok(document.querySelector("#utility-dialog").textContent.includes("Saved first"));
    a.notify("Saved inside dialog");
    await tick();
    assert.ok(document.querySelector("[data-utility-messages]").textContent.includes("Saved inside dialog"));
    assert.ok(document.querySelector("#toast").textContent.includes("Saved fifth"), "dialog confirmations do not erase another scope");
    console.log("PASS compact routine success status: complete history, alerts, Undo, focus, scope and timer cleanup retained");
  } finally {
    global.setTimeout = nativeSet;
    global.clearTimeout = nativeClear;
    dom.window.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
