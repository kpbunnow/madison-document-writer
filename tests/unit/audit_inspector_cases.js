/* Open cases by inspector, in the shared-case search dialog: the picker lists the division's inspectors plus an
   Unassigned choice; choosing one asks the helper for that inspector's open cases and lists them with plain notes
   when the list may be incomplete; selecting a case prompts to import a new inspection result, which opens Import
   inspection with the case number ready to look up. An import already awaiting review is continued for the same
   case and must be finished first for a different one. Case text is escaped. Nothing is written or issued here. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");

const payload = bundleSource(builtPage());
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
const w = dom.window;
Object.assign(global, {
  FormData: w.FormData,
  window: w,
  document: w.document,
  getSelection: () => w.getSelection(),
  confirm: () => true,
  prompt: () => "",
});
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};
// jsdom has no dialog.close(); browsers do.
w.HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
const requests = [];
let answer = null;
const asked = () => requests.filter((r) => r.startsWith("/cases/by-inspector"));
global.fetch = async (url) => {
  requests.push(String(url));
  if (!String(url).startsWith("/cases/by-inspector") || !answer) throw Error("offline");
  return { ok: answer.status < 400, status: answer.status, json: async () => answer.body };
};

const writer = async () => {
  await new Promise((r) => setTimeout(r, 30));
  saveDrafts = async () => true;
  idbSet = async () => true;
  scheduleDraftSave = () => {};
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const settle = () => new Promise((r) => setTimeout(r, 60));
  const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
  WriterState.WRITER_READY = true;
  WriterState.WORKSPACE_RESTORED = true;
  WriterState.HELPER = null;
  WriterState.CASEDIR = null;
  WriterState.PENDING = [];
  WriterState.EVENTS = {};
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.RECORD_ATTEMPTS = {};
  WriterState.state.screen = "cases";
  render();

  const open = async () => {
    document.getElementById("utility-dialog")?.remove();
    await globalSearch();
    return document.getElementById("utility-dialog");
  };
  const choose = async (dialog, who) => {
    const form = dialog.querySelector("#inspector-cases-form");
    form.querySelector("select").value = who;
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await tick();
    await tick();
  };
  const rows = [
    { number: "CB2026-000-00001", address: "1 MAIN ST", owner: "A OWNER", status: "Notice", inspector: "ROBERT ALES", nextDue: "2026-11-05" },
    {
      number: "CB2026-000-00002",
      address: '2 <img src=x onerror="alert(1)"> ST',
      owner: "B OWNER",
      status: "Cited",
      inspector: "ROBERT ALES",
      nextDue: "",
    },
  ];

  // The picker sits beside the existing search and lists every division inspector, then the Unassigned choice.
  let dialog = await open();
  assert.equal(text(dialog.querySelector("h2")), "Search shared case records");
  assert.ok(dialog.querySelector("#global-search-form"), "the single-record search is still there");
  const select = dialog.querySelector("#inspector-cases-form select[name=inspector]");
  assert.equal(select.required, true);
  const options = [...select.options].map((o) => [o.value, text(o)]);
  assert.deepEqual(options[0], ["", "Choose an inspector"]);
  assert.deepEqual(
    options.slice(1, -1),
    INSPECTORS.map((i) => [i.id, i.name]),
  );
  assert.deepEqual(options.at(-1), ["unassigned", "Unassigned or former inspector"]);
  assert.equal(text(dialog.querySelector("#inspector-cases-form button[type=submit]")), "Show open cases");
  assert.equal(dialog.querySelector("#inspector-case-results").textContent, "", "nothing is requested until an inspector is chosen");
  assert.equal(asked().length, 0);

  // Choosing an inspector lists that inspector's open cases.
  answer = { status: 200, body: { ok: true, cases: rows, total: 2, partial: false, incomplete: 0 } };
  await choose(dialog, "i1");
  assert.deepEqual(asked(), ["/cases/by-inspector?inspector=i1"]);
  const results = dialog.querySelector("#inspector-case-results");
  assert.match(text(results), /^2 open cases for ROBERT ALES\./);
  const items = [...results.querySelectorAll("li")];
  assert.equal(items.length, 2);
  assert.match(text(items[0]), /CB2026-000-00001 · 1 MAIN ST · A OWNER · Notice · Next due .*2026/);
  assert.match(text(items[1]), /No open deadline/);
  assert.equal(results.querySelector("img"), null, "case text is escaped");
  assert.match(text(items[1]), /<img src=x onerror="alert\(1\)">/);
  assert.equal(results.querySelector("[role=status]"), null, "no incompleteness note when nothing was left out");

  // The list says so when cases could not be included, or were limited.
  answer = { status: 200, body: { ok: true, cases: rows.slice(0, 1), total: 1, partial: false, incomplete: 3 } };
  await choose(dialog, "i1");
  assert.match(text(dialog.querySelector("#inspector-case-results")), /1 open case for ROBERT ALES\./);
  assert.match(text(dialog.querySelector("#inspector-case-results")), /3 case files were not included .* may be incomplete/);
  answer = { status: 200, body: { ok: true, cases: rows, total: 900, partial: true, incomplete: 1 } };
  await choose(dialog, "i1");
  assert.match(text(dialog.querySelector("#inspector-case-results")), /1 case file was not included because its summary/);
  assert.match(text(dialog.querySelector("#inspector-case-results")), /Showing the first 2 of 900 open cases\./);

  // Unassigned, and an empty list.
  answer = { status: 200, body: { ok: true, cases: [], total: 0, partial: false, incomplete: 0 } };
  await choose(dialog, "unassigned");
  assert.equal(asked().at(-1), "/cases/by-inspector?inspector=unassigned");
  assert.equal(text(dialog.querySelector("#inspector-case-results")), "0 open cases for Unassigned or former inspector.");

  // A helper refusal shows its sentence and leaves the earlier list out.
  answer = { status: 503, body: { ok: false, error: "The shared case folder could not be read" } };
  await choose(dialog, "i1");
  assert.match(text(dialog.querySelector("[data-utility-messages]")), /The shared case folder could not be read/);

  // Selecting a case prompts first; Back to list dismisses it without leaving.
  answer = { status: 200, body: { ok: true, cases: rows, total: 2, partial: false, incomplete: 0 } };
  await choose(dialog, "i1");
  dialog.querySelector('[data-inspector-case="CB2026-000-00001"]').click();
  await tick();
  const prompt = dialog.querySelector("#inspector-case-prompt");
  assert.match(text(prompt), /Import a new inspection result to continue CB2026-000-00001\./);
  assert.equal(text(prompt.querySelector("[data-inspector-import]")), "Import inspection");
  assert.equal(text(prompt.querySelector("[data-global-open]")), "Open case without importing");
  assert.equal(prompt.querySelector("[data-global-open]").dataset.globalOpen, "CB2026-000-00001");
  assert.equal(WriterState.state.screen, "cases", "selecting a case alone does not leave Workspace");
  prompt.querySelector("[data-inspector-cancel]").click();
  await tick();
  assert.equal(prompt.textContent, "");
  assert.ok(document.getElementById("utility-dialog"), "the list stays open");

  // Import inspection opens with the case number ready to look up; nothing is looked up automatically.
  const lookups = () => requests.filter((r) => !r.startsWith("/cases/by-inspector")).length;
  const lookupsBefore = lookups();
  dialog.querySelector('[data-inspector-case="CB2026-000-00001"]').click();
  await tick();
  dialog.querySelector("[data-inspector-import]").click();
  await settle();
  assert.equal(WriterState.state.screen, "import");
  assert.equal(document.getElementById("utility-dialog"), null, "the dialog closes");
  assert.equal(WriterState.WORK.entry["lookup-number"], "CB2026-000-00001");
  assert.equal(document.getElementById("lookup-number").value, "CB2026-000-00001");
  assert.equal(lookups(), lookupsBefore, "no City lookup is made until the inspector asks for it");
  assert.equal(WriterState.state.acc, null, "no import is created");

  // An import already awaiting review for this case is continued, not replaced.
  WriterState.state.screen = "cases";
  render();
  delete WriterState.WORK.entry["lookup-number"];
  WriterState.state.acc = { cases: [{ number: "cb2026-000-00001" }], caseIx: 0, fileName: "x" };
  dialog = await open();
  await choose(dialog, "i1");
  dialog.querySelector('[data-inspector-case="CB2026-000-00001"]').click();
  await tick();
  assert.match(text(dialog.querySelector("#inspector-case-prompt")), /already imported/);
  dialog.querySelector("[data-inspector-import]").click();
  await settle();
  assert.equal(WriterState.state.screen, "import");
  assert.equal(WriterState.WORK.entry["lookup-number"], undefined, "the saved import is kept; the search box is not touched");
  assert.equal(WriterState.state.acc.cases[0].number, "cb2026-000-00001");

  // An import for a different case must be finished first: no import button, no navigation.
  WriterState.state.screen = "cases";
  render();
  WriterState.state.acc = { cases: [{ number: "CB2026-000-09999" }], caseIx: 0, fileName: "x" };
  dialog = await open();
  await choose(dialog, "i1");
  dialog.querySelector('[data-inspector-case="CB2026-000-00001"]').click();
  await tick();
  const blocked = dialog.querySelector("#inspector-case-prompt");
  assert.match(text(blocked), /Finish the current import first\.\s*An import for CB2026-000-09999 is waiting for review/);
  assert.equal(blocked.querySelector("[data-inspector-import]"), null);
  assert.ok(blocked.querySelector("[data-global-open]"), "the case can still be opened as before");
  assert.equal(WriterState.state.screen, "cases");
  assert.equal(WriterState.WORK.entry["lookup-number"], undefined);
  WriterState.state.acc = null;
  console.log("Inspector open-cases checks passed");
};
eval(payload + "\n(" + writer.toString() + ")().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});");
