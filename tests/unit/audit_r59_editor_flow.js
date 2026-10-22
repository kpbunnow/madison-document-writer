/* R59 editor flow: 15-second warnings and errors, Violation Items, the Review dialog, Issue and the return to Workspace. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage());
const dom = new JSDOM('<!doctype html><div id="app"><main class="main"></main></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.getSelection = () => window.getSelection();
global.confirm = () => true;
global.fetch = async () => {
  throw new Error("offline");
};
// Scrolling is recorded: Violation Items and Review open dialogs and never move the page.
let scrolls = 0;
window.scrollTo = () => scrolls++;
window.Element.prototype.scrollIntoView = function () {
  scrolls++;
};
// Message timers (6 seconds and longer) run on a controlled clock; shorter timers stay real.
const realSetTimeout = setTimeout,
  realClearTimeout = clearTimeout,
  realNow = Date.now,
  fake = new Map();
let clock = 1_000_000,
  fakeId = 0;
global.setTimeout = (fn, ms, ...args) => {
  if (!(ms >= 6000)) return realSetTimeout(fn, ms, ...args);
  const id = "fake-" + ++fakeId;
  fake.set(id, { fn, at: clock + ms });
  return id;
};
global.clearTimeout = (id) => (fake.has(id) ? fake.delete(id) : realClearTimeout(id));
global.__advance = async (ms) => {
  clock += ms;
  for (const [id, t] of [...fake].sort((a, b) => a[1].at - b[1].at))
    if (t.at <= clock && fake.has(id)) {
      fake.delete(id);
      t.fn();
    }
  await Promise.resolve();
  await Promise.resolve();
};
global.__clock = { on: () => (Date.now = () => clock), off: () => (Date.now = realNow) };

const test = async () => {
  await new Promise((r) => setTimeout(r, 30));
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const shown = (text) => [...document.querySelectorAll("#toast [data-message]")].some((el) => el.textContent.includes(text));
  const history = () => JSON.parse(localStorage.getItem("madison-message-history-v1") || "[]");

  /* ---------- ITEM 3: warnings and errors clear after 15 seconds; each showing gets its own interval ---------- */
  __clock.on();
  for (const el of document.querySelectorAll("[data-message-dismiss]")) el.click();
  await tick();
  for (const severity of ["warning", "error"]) {
    const text = "Synthetic R59 " + severity;
    A11Y.notify(text, { severity });
    await tick();
    assert.ok(shown(text), severity + " shown");
    await __advance(14_999);
    assert.ok(shown(text), severity + " still shown at 14999 ms");
    await __advance(1);
    assert.ok(!shown(text), severity + " cleared at 15000 ms");
    assert.ok(
      history().some((m) => m.text === text && m.severity === severity),
      severity + " kept in Message history",
    );
  }
  // Success keeps its own duration.
  A11Y.notify("Saved synthetic R59 result", { severity: "success" });
  await tick();
  await __advance(6_999);
  assert.ok(shown("Saved synthetic R59 result"));
  await __advance(1);
  assert.ok(!shown("Saved synthetic R59 result"), "success unchanged at 7 seconds");
  // A message shown again while visible gets a fresh 15-second interval.
  A11Y.notify("Synthetic R59 repeated warning", { severity: "warning" });
  await tick();
  await __advance(10_000);
  A11Y.notify("Synthetic R59 repeated warning", { severity: "warning" });
  await tick();
  await __advance(10_000);
  assert.ok(shown("Synthetic R59 repeated warning"), "re-shown message restarted its interval");
  await __advance(4_999);
  assert.ok(shown("Synthetic R59 repeated warning"));
  await __advance(1);
  assert.ok(!shown("Synthetic R59 repeated warning"), "re-shown message clears 15 s after it was shown again");
  // A message that returns after clearing is shown again with its own interval.
  A11Y.notify("Synthetic R59 repeated warning", { severity: "warning" });
  await tick();
  assert.ok(shown("Synthetic R59 repeated warning"), "a recurring message shows again");
  await __advance(15_000);
  assert.ok(!shown("Synthetic R59 repeated warning"));
  // Hover and keyboard focus pause the interval.
  A11Y.notify("Synthetic R59 hovered error", { severity: "error" });
  await tick();
  let el = [...document.querySelectorAll("#toast [data-message]")].find((x) => x.textContent.includes("Synthetic R59 hovered error"));
  el.dispatchEvent(new window.MouseEvent("mouseenter"));
  await __advance(60_000);
  assert.ok(shown("Synthetic R59 hovered error"), "hover pauses the interval");
  el.dispatchEvent(new window.MouseEvent("mouseleave"));
  await __advance(14_999);
  assert.ok(shown("Synthetic R59 hovered error"));
  await __advance(1);
  assert.ok(!shown("Synthetic R59 hovered error"), "the interval resumes after hover");
  A11Y.notify("Synthetic R59 focused warning", { severity: "warning" });
  await tick();
  el = [...document.querySelectorAll("#toast [data-message]")].find((x) => x.textContent.includes("Synthetic R59 focused warning"));
  el.querySelector("button").focus();
  el.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true }));
  await __advance(60_000);
  assert.ok(shown("Synthetic R59 focused warning"), "keyboard focus pauses the interval");
  el.querySelector("button").blur();
  el.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true }));
  await __advance(15_000);
  assert.ok(!shown("Synthetic R59 focused warning"));
  // Progress messages stay until their operation replaces them.
  A11Y.notify("Filing synthetic R59 packet — this takes a few seconds", { severity: "progress" });
  await tick();
  await __advance(120_000);
  assert.ok(shown("Filing synthetic R59 packet"), "progress persists");
  A11Y.notify("Filed synthetic R59 packet", { severity: "success" });
  await tick();
  assert.ok(!shown("Filing synthetic R59 packet"), "the operation's result replaces its progress message");
  await __advance(7_000);

  /* ---------- the document editor ---------- */
  saveDrafts = async () => true;
  idbSet = async () => true;
  writeSummary = async () => true;
  refreshCatalog = async () => true;
  emailDocument = async () => true;
  let pdfs = 0,
    filing = true;
  filePdf = async () => {
    pdfs++;
    return filing;
  };
  let posts = 0,
    mode = "ok",
    server = null;
  helperJSON = async (url, body) => {
    if (url !== "/cases/save") throw new Error("offline");
    posts++;
    await new Promise((r) => setTimeout(r, 5));
    if (mode === "reject") {
      const e = new Error("Synthetic conflicting case action");
      e.name = "StorageError";
      e.definitive = true;
      throw e;
    }
    if (!server || !server.events.some((e) => e.id === body.idempotencyEvent)) server = clone(body.file);
    if (mode === "lost") {
      mode = "ok";
      throw new Error("Failed to fetch");
    }
    return { ok: true, file: clone(server), name: caseFileName(server.case), revision: "r59-" + posts };
  };
  WriterState.CATALOG_VERIFIED = true;
  WriterState.PENDING = [];
  WriterState.RECORD_ATTEMPTS = {};
  WriterState.CASEDIR = { helper: true };
  WriterState.HELPER = { caseStore: true };
  WriterState.NEEDGRANT = false;
  const k = kase("k1"),
    original = clone(k);
  const fresh = () => {
    WriterState.CASES = WriterState.CASES.map((x) => (x.id === k.id ? Object.assign(x, clone(original)) : x));
    const c = kase("k1");
    c.parcel = "070822219105";
    c.date = recordDay(today);
    c.time = "09:00";
    WriterState.DOCS = [];
    WriterState.REINSP = [];
    WriterState.EVENTS = {};
    WriterState.SAVE_CHECKPOINTS = {};
    COMMITTED.clear();
    WriterState.state.modal = null;
    WriterState.state.picker = false;
    WriterState.state.amendmentError = "";
    server = null;
    mode = "ok";
    filing = true;
    newDoc(c.id, "notice");
    const d = doc(WriterState.state.docId);
    d.items = [{ id: uid("x"), no: "1", title: "Wall repair", text: "Repair ( ) on the wall.", sections: ["27.05(2)(c)"], due: "", cite: false }];
    WriterState.state.screen = "write";
    render();
    return d;
  };
  let d = fresh();

  /* ---------- ITEM 4: Violation Items opens the picker without scrolling and reflects the record ---------- */
  const nav = document.querySelector(".editor-sections");
  assert.deepEqual(
    [...nav.querySelectorAll("button")].map((b) => b.textContent),
    ["Recipients", "Violation Items", "Review · " + editorReadiness(d).required.length],
  );
  assert.equal(nav.querySelectorAll("[data-editor-section]").length, 0, "no task button scrolls to a section");
  assert.equal(document.querySelectorAll("#btn-add-top").length, 1, "one entry to the violation picker");
  assert.equal(document.querySelector("#editor-items-title").textContent, "Violation items");
  let opener = document.querySelector("#btn-add-top");
  opener.focus();
  scrolls = 0;
  opener.click();
  await tick();
  assert.equal(WriterState.state.picker, true, "Violation Items opens the violation picker");
  assert.equal(scrolls, 0, "opening the picker does not scroll");
  // The synthetic catalog has no approved entries; list standard language, which may still be selected.
  for (const status of ["usable", "all"]) {
    if (document.querySelector(".gitem[data-pick]:not([disabled]):not(.added)")) break;
    WriterState.state.pickerStatus = status;
    refreshOverlay();
  }
  const pick = document.querySelector(".gitem[data-pick]:not([disabled]):not(.added)");
  const pickKey = pick.dataset.pick;
  pick.click();
  for (let n = 0; n < 20 && d.items.length < 2; n++) await tick();
  assert.equal(d.items.length, 2, "a violation is added from the picker");
  // The duplicate rule is unchanged: picking the same entry again removes it rather than adding a second copy.
  document.querySelector('.gitem[data-pick="' + pickKey + '"]').click();
  for (let n = 0; n < 20 && d.items.length > 1; n++) await tick();
  assert.equal(d.items.length, 1, "re-picking a selected entry removes it");
  document.querySelector('.gitem[data-pick="' + pickKey + '"]').click();
  for (let n = 0; n < 20 && d.items.length < 2; n++) await tick();
  assert.equal(d.items.length, 2);
  document.querySelector('[data-close="picker"]').click();
  await tick();
  assert.equal(WriterState.state.picker, false);
  assert.equal(document.activeElement.id, "btn-add-top", "focus returns to Violation Items");
  scrolls = 0;
  document.querySelector("#btn-add-top").click();
  await tick();
  assert.equal(scrolls, 0);
  const again = document.querySelector('.gitem[data-pick="' + pickKey + '"]');
  assert.ok(again.classList.contains("added"), "reopened picker marks the added violation");
  assert.equal(again.getAttribute("aria-pressed"), "true");
  document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(WriterState.state.picker, false);
  assert.equal(document.activeElement.id, "btn-add-top");
  d.items.pop();
  renumber(d);
  render();
  // Where violations cannot be added the button is not offered and the section says why.
  const follow = { ...clone(d), id: "r59-follow", type: "extension", fromReinspId: "none", fromDocId: "none" };
  WriterState.DOCS.push(follow);
  WriterState.state.docId = follow.id;
  render();
  assert.equal(structEditable(follow), false);
  assert.equal(document.querySelector("#btn-add-top"), null, "no Violation Items picker for a carried-forward item list");
  if (!isLocked(follow)) assert.match(document.querySelector("#editor-items").textContent, /Violations are carried from the earlier document/);
  WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== follow.id);
  WriterState.state.docId = d.id;
  render();

  /* ---------- ITEM 5: one Review dialog ---------- */
  assert.equal(document.querySelectorAll("#editor-review,#checkbox-panel,#btn-checks,.passed-checks").length, 0, "no second review panel");
  assert.equal(document.querySelectorAll("[data-mobile-review],[data-open-checklist],#btn-review").length, 3);
  let ready = editorReadiness(d);
  assert.ok(ready.required.length > 0);
  const reviewButton = document.querySelector("#btn-review");
  reviewButton.focus();
  scrolls = 0;
  reviewButton.click();
  await tick();
  assert.equal(scrolls, 0, "Review does not scroll");
  let dialog = document.querySelector("#overlay [data-review-dialog]");
  assert.equal(dialog.getAttribute("role"), "dialog");
  assert.equal(dialog.getAttribute("aria-modal"), "true");
  assert.equal(dialog.querySelector("h2").textContent, "Review");
  assert.ok(dialog.contains(document.activeElement), "focus moves into the dialog");
  assert.equal(dialog.querySelector("[data-review-blocking] h3").textContent, "Must fix before issuing");
  assert.equal(dialog.querySelectorAll("[data-review-blocking] .check.fail").length, ready.required.length);
  assert.equal(dialog.querySelector(".passed-checks").open, false, "passed checks collapsed");
  assert.equal(dialog.querySelector("[data-review-clear]"), null);
  document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(WriterState.state.modal, null, "Escape closes Review");
  assert.equal(document.activeElement.id, "btn-review", "focus returns to Review");
  // A check link closes the dialog and focuses its field.
  document.querySelector("#btn-review").click();
  const textCheck = ready.list.findIndex((c) => !c.ok && !c.soft && c.targets?.some((t) => t.selector.includes('data-field="text"')));
  document.querySelector('#overlay [data-review-blocking] .check-link[data-check-index="' + textCheck + '"]').click();
  assert.equal(WriterState.state.modal, null, "the check link closes Review");
  assert.equal(document.activeElement.dataset.field, "text", "and focuses the field");
  // The summary link and the narrow-screen Review open the same dialog.
  for (const selector of [".editor-readiness [data-open-checklist]", ".editor-mobile-bar [data-mobile-review]"]) {
    document.querySelector(selector).click();
    assert.ok(document.querySelector("#overlay [data-review-dialog]"), selector);
    WriterState.state.modal = null;
    render();
  }
  // Advisories follow blocking concerns; with neither the dialog states that the document is ready.
  const mixed = {
    list: [
      { ok: false, soft: true, t: "Synthetic advisory", targets: [] },
      { ok: false, t: "Synthetic blocker", targets: [] },
      { ok: true, t: "Synthetic pass" },
    ],
  };
  mixed.required = [mixed.list[1]];
  mixed.advice = [mixed.list[0]];
  const holder = document.createElement("div");
  holder.innerHTML = reviewConcernsHTML(d, mixed);
  assert.deepEqual(
    [...holder.querySelectorAll("h3")].map((h) => h.textContent),
    ["Must fix before issuing", "Advisories"],
  );
  assert.ok(holder.querySelector("[data-review-advisories] .check.note").textContent.includes("Synthetic advisory"));
  holder.innerHTML = reviewConcernsHTML(d, { list: [mixed.list[2]], required: [], advice: [] });
  assert.equal(holder.querySelector("[data-review-clear]").textContent, "No concerns. This document is ready to issue.");
  assert.equal(holder.querySelectorAll("h3").length, 0);
  // Fill the draft; an advisory-only draft lists its advisories and no blocking section.
  d.items[0].text = "Repair the damaged wall.";
  d.items[0].due = addDays(recordDay(today), 3);
  render();
  ready = editorReadiness(d);
  assert.equal(ready.required.length, 0, JSON.stringify(ready.required.map((c) => c.t)));
  assert.ok(ready.advice.length > 0, "a due date three days out is an advisory");
  document.querySelector("#btn-review").click();
  dialog = document.querySelector("#overlay [data-review-dialog]");
  assert.equal(dialog.querySelector("[data-review-blocking]"), null);
  assert.equal(dialog.querySelector("[data-review-advisories] h3").textContent, "Advisories");
  assert.equal(dialog.querySelectorAll("[data-review-advisories] .check.note").length, ready.advice.length);
  WriterState.state.modal = null;
  d.items[0].due = addDays(recordDay(today), 21);
  render();
  ready = editorReadiness(d);
  document.querySelector("#btn-review").click();
  dialog = document.querySelector("#overlay [data-review-dialog]");
  if (!ready.advice.length) assert.ok(dialog.querySelector("[data-review-clear]"), "no-concerns state on a ready draft");
  assert.equal(dialog.querySelector("[data-review-blocking]"), null);
  WriterState.state.modal = null;
  render();

  /* ---------- ITEM 6: Issue ---------- */
  assert.equal(document.querySelector(".topbar .editor-primary").textContent, "Issue");
  assert.equal(document.querySelector("[data-editor-preview]"), null, "no draft Print preview");
  assert.ok(!document.getElementById("app").textContent.includes("Print preview"));
  // Issue enforces validation even when Review was never opened, and a cleared message never clears the blocker.
  d.items[0].due = "";
  render();
  assert.equal(document.querySelector("#btn-final").textContent, "Issue");
  document.querySelector("#btn-final").click();
  assert.equal(WriterState.state.modal, "final");
  let fin = document.querySelector("#fin-go");
  assert.equal(fin.disabled, true, "Issue confirmation is disabled while a blocking check fails");
  fin.disabled = false;
  fin.click();
  await tick();
  assert.ok(shown("Clear the outstanding checks before finalizing"));
  assert.equal(posts, 0);
  assert.equal(d.draft, true);
  await __advance(15_000);
  assert.ok(!shown("Clear the outstanding checks before finalizing"), "the warning clears after 15 seconds");
  assert.ok(blockers(d).length > 0, "the blocking check remains");
  render();
  assert.equal(document.querySelector("#fin-go").disabled, true, "issuance stays blocked after the message cleared");
  document.querySelector("#fin-go").disabled = false;
  document.querySelector("#fin-go").click();
  await tick();
  assert.equal(posts, 0, "a forced click is still refused");
  WriterState.state.modal = null;
  render();
  assert.ok(document.querySelector('[data-field="due"][aria-invalid="true"]'), "the blocker stays marked inline");
  document.querySelector("#btn-review").click();
  assert.ok(document.querySelector("#overlay [data-review-blocking] .check.fail"), "and listed in Review");
  WriterState.state.modal = null;
  __clock.off();

  // Failed issuance stays on the document with the entered data and the actionable message.
  d.items[0].due = addDays(recordDay(today), 21);
  render();
  mode = "reject";
  document.querySelector("#btn-final").click();
  document.querySelector("#fin-go").click();
  for (let n = 0; n < 50 && posts < 1; n++) await tick();
  for (let n = 0; n < 50 && WriterState.AMENDMENT_BUSY; n++) await tick();
  await tick();
  assert.equal(WriterState.state.screen, "write", "a refused save stays on the document");
  assert.equal(doc(d.id).draft, true);
  assert.equal(doc(d.id).items[0].text, "Repair the damaged wall.", "entered data kept");
  assert.ok(document.querySelector(".banner.alert").textContent.includes("Synthetic conflicting case action"));
  // A lost response keeps the exact request and asks to Confirm save.
  WriterState.state.amendmentError = "";
  mode = "lost";
  render();
  document.querySelector("#btn-final").click();
  document.querySelector("#fin-go").click();
  for (let n = 0; n < 50 && posts < 2; n++) await tick();
  for (let n = 0; n < 50 && WriterState.AMENDMENT_BUSY; n++) await tick();
  await tick();
  assert.equal(WriterState.state.screen, "write", "an unconfirmed save stays on the document");
  assert.ok(doc(d.id).pendingAmendment, "the exact request is retained");
  assert.equal(document.querySelector(".topbar .editor-primary").textContent, "Confirm save");
  assert.equal(pdfs, 0);
  // Confirm save completes the same event once and returns to Workspace.
  const pendingId = doc(d.id).pendingAmendment.id;
  WriterState.state.caseFilter = "attention";
  await publishDocument(doc(d.id));
  assert.equal(server.events.filter((e) => e.id === pendingId).length, 1);
  assert.equal(server.events.filter((e) => e.type === "notice.issued").length, 1);
  assert.equal(WriterState.state.screen, "cases", "confirmed issuance returns to Workspace");

  // Successful issuance returns to Workspace with the case visible, highlighted and focused.
  d = fresh();
  d.items[0].text = "Repair the damaged wall.";
  d.items[0].due = addDays(recordDay(today), 21);
  WriterState.state.caseFilter = "continue";
  WriterState.state.caseQ = String(k.number).toLowerCase();
  WriterState.state.caseInspector = "r59-other-inspector";
  render();
  const before = posts;
  pdfs = 0;
  document.querySelector("#btn-final").click();
  fin = document.querySelector("#fin-go");
  assert.equal(fin.disabled, false);
  // A double click issues once.
  fin.click();
  fin.click();
  assert.equal(fin.disabled, true, "Issue is disabled once submitted");
  for (let n = 0; n < 100 && WriterState.state.screen !== "cases"; n++) await tick();
  await tick();
  assert.equal(posts - before, 1, "one save request for a double click");
  assert.equal(server.events.filter((e) => e.type === "notice.issued").length, 1, "issued once");
  assert.equal(pdfs, 1, "filed once");
  assert.equal(WriterState.state.screen, "cases");
  assert.equal(WriterState.state.caseFilter, "all", "a view that would hide the issued case switches to All cases");
  assert.equal(WriterState.state.caseQ, String(k.number).toLowerCase(), "a search that shows the case is kept");
  assert.equal(WriterState.state.caseInspector, "", "an inspector filter that hides the case is cleared");
  const row = document.querySelector('tr[data-queue-case="k1"]');
  assert.ok(row.hasAttribute("data-issued-highlight"), "the issued case row is highlighted");
  assert.equal(row.getAttribute("aria-current"), "true");
  assert.equal(document.querySelectorAll("tr[data-issued-highlight]").length, 1);
  assert.equal(document.activeElement, row, "the issued case row has focus");
  assert.ok(shown("Official Notice issued for " + k.number + "."), "issuance confirmation");
  // The highlight ends with the next navigation away from Workspace.
  WriterState.state.screen = "tools";
  render();
  WriterState.state.screen = "cases";
  render();
  assert.equal(document.querySelectorAll("tr[data-issued-highlight]").length, 0);

  // Filing failure: the existing message, Workspace still shows the case with no success confirmation.
  d = fresh();
  d.items[0].text = "Repair the damaged wall.";
  d.items[0].due = addDays(recordDay(today), 21);
  WriterState.state.caseFilter = "all";
  WriterState.state.caseQ = "";
  render();
  for (const x of document.querySelectorAll("[data-message-dismiss]")) x.click();
  filing = false;
  document.querySelector("#btn-final").click();
  document.querySelector("#fin-go").click();
  for (let n = 0; n < 100 && WriterState.state.screen !== "cases"; n++) await tick();
  await tick();
  assert.equal(WriterState.state.screen, "cases");
  assert.ok(shown("Document issued. Use File issued PDF to produce its copy."));
  assert.ok(!shown("Official Notice issued for"), "no success confirmation when filing failed");
  assert.ok(document.querySelector('tr[data-queue-case="k1"][data-issued-highlight]'));
  assert.ok(document.querySelector('tr[data-queue-case="k1"]').textContent.includes("Needs resolution"), "the case needs resolution");

  // Concurrent issuance of one draft prepares one publication only.
  d = fresh();
  d.items[0].text = "Repair the damaged wall.";
  d.items[0].due = addDays(recordDay(today), 21);
  filing = true;
  const sent = posts;
  const results = await Promise.all([publishDocument(d), publishDocument(d)]);
  assert.deepEqual(results.sort(), [false, true]);
  assert.equal(posts - sent, 1);
  assert.equal(server.events.filter((e) => e.type === "notice.issued").length, 1);
  console.log(
    "PASS R59 editor flow: 15-second warnings and errors with history, pause and re-show; Violation Items picker; one Review " +
      "dialog with blocking, advisory and clear states; Issue label and validation; Workspace return; single issuance",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
