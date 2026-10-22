const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  src = bundleSource(html);
const dom = new JSDOM(html, { url: "http://127.0.0.1:8777", pretendToBeVisual: true });
global.window = dom.window;
global.document = window.document;
global.localStorage = window.localStorage;
window.scrollTo = () => {};
window.HTMLDialogElement.prototype.close = function () {
  this.remove();
};
global.getSelection = () => window.getSelection();
global.confirm = () => true;
const timers = [];
global.setTimeout = (fn, ms) => {
  timers.push({ fn, ms });
  return timers.length;
};
global.clearTimeout = () => {};
global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, caseStore: true, version: "2026.10.02.25" }) });
globalThis.MADISON_TEST_DATA = true;
const test = async () => {
  newDoc("k1", "notice");
  await Promise.resolve();
  const d = doc(WriterState.state.docId),
    before = documentHTML(d);
  A11Y.enhance();
  assert.equal(documentHTML(d), before);
  assert.ok(document.querySelector(".skip-link"));
  assert.equal(document.querySelector(".main").getAttribute("role"), "main");
  for (const el of document.querySelectorAll('.ed[data-case][contenteditable="true"]')) {
    assert.equal(el.getAttribute("role"), "textbox");
    assert.ok(el.getAttribute("aria-label"));
    assert.equal(el.tabIndex, 0);
  }
  document.querySelectorAll("[data-message-dismiss]").forEach((el) => el.click());
  toast("Synthetic failure", { severity: "error" });
  toast("Synthetic warning", { severity: "warning" });
  await Promise.resolve();
  assert.equal(document.querySelectorAll("#toast [role=alert]").length, 2);
  assert.equal(document.querySelectorAll(".writer-navigation .rail-item").length, 4);
  assert.equal(
    document.querySelectorAll(".writer-navigation [data-a11y-history],.writer-navigation [data-a11y-help],.writer-navigation [data-a11y-theme]")
      .length,
    0,
  );
  toast("Saved test result", { severity: "success", duration: 1000 });
  assert.ok(timers.some((t) => t.ms >= 6000));
  const error = document.querySelector("[role=alert] [data-message-dismiss]");
  error.click();
  await Promise.resolve();
  assert.equal(document.querySelectorAll("#toast [role=alert]").length, 1);
  assert.ok(JSON.parse(localStorage.getItem("madison-message-history-v1")).some((m) => m.text === "Synthetic failure"));
  const opener = document.querySelector("#btn-add-top");
  opener.focus();
  opener.click();
  assert.ok(document.querySelector('[aria-labelledby="dialog-title"]'));
  document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(WriterState.state.picker, false);
  assert.equal(document.activeElement.id, "btn-add-top");
  A11Y.setTheme("high");
  assert.equal(document.documentElement.dataset.theme, "high");
  WriterState.state.screen = "tools";
  render();
  A11Y.enhance();
  for (const selector of ["[data-a11y-history]", "[data-a11y-help]", "[data-a11y-theme]"]) assert.ok(document.querySelector(selector));
  document.querySelector("[data-a11y-history]").click();
  assert.ok(document.querySelector("#utility-dialog").textContent.includes("Synthetic failure"));
  document.querySelector("[data-utility-close]").click();
  console.log("PASS alerts, history, success duration, labels, landmarks, un" + "changed print source, modal Escape and focus return");
};
eval(src + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
