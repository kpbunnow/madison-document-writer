/* Open cases by inspector, in the shared-case search dialog: the picker lists the division's inspectors plus an
   Unassigned choice; choosing one asks the helper for that inspector's open cases and lists them with plain notes
   when the list may be incomplete; selecting a case prompts to import a new inspection result, which opens Import
   inspection with the case number ready to look up. An import already awaiting review is continued for the same
   case and must be finished first for a different one. Case text is escaped. Nothing is written or issued here.
   The shared-search dialog and the workflow event owner are built independently with explicit test services. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom"),
  { compile, listenerTarget } = require("../fixtures/equivalence_harness.cjs");

process.on("unhandledRejection", (error) => {
  console.error(error);
  process.exit(1);
});
globalThis.__TEST_BUILD__ = true;
const dom = new JSDOM("<body></body>", { pretendToBeVisual: true });
const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

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
const answer = (cases, extra = {}) => ({ ok: true, cases, total: cases.length, partial: false, incomplete: 0, ...extra });

(async () => {
  const api = await compile(
    'export {createWorkflowEvents} from "./workflow_events.js"; export {createLanguageCatalog} from "./language_catalog.js";',
  );
  const document = dom.window.document;
  Object.assign(globalThis, { document, FormData: dom.window.FormData });
  document.body.innerHTML = '<dialog id="utility-dialog"></dialog>';
  const dialog = document.getElementById("utility-dialog");
  dialog.close = () => dialog.removeAttribute("open");
  api.WriterState.state = { screen: "cases", acc: null };
  api.WriterState.WORK = { entry: {}, acc: null };

  const asked = [];
  const messages = [];
  const navigated = [];
  let reply = answer(rows),
    renders = 0,
    navigateResult = true;
  const services = {
    helperJSON: async (url) => {
      asked.push(url);
      if (reply instanceof Error) throw reply;
      return reply;
    },
    toast: (message) => messages.push(message),
    render: () => renders++,
    navigation: {
      navigate: async (route) => {
        navigated.push(route);
        if (navigateResult) api.WriterState.state.screen = route;
        return navigateResult;
      },
    },
    writerOpenReportedCase: async () => {},
    globalSearch: async () => {},
  };

  // The picker is part of the shared search dialog, beside the single-record search.
  const catalog = api.createLanguageCatalog({
    navigation: { utilityContext: () => ({}) },
    A11Y: { utility: (title, html) => (dialog.innerHTML = "<h2>" + title + "</h2>" + html) },
  });
  await catalog.globalSearch();
  assert.equal(text(dialog.querySelector("h2")), "Search shared case records");
  assert.ok(dialog.querySelector("#global-search-form"), "the single-record search is still there");
  const select = dialog.querySelector("#inspector-cases-form select[name=inspector]");
  assert.equal(select.required, true);
  const options = [...select.options].map((o) => [o.value, text(o)]);
  assert.deepEqual(options[0], ["", "Choose an inspector"]);
  assert.deepEqual(
    options.slice(1, -1),
    api.INSPECTORS.map((i) => [i.id, i.name]),
  );
  assert.deepEqual(options.at(-1), ["unassigned", "Unassigned or former inspector"]);
  assert.equal(text(dialog.querySelector("#inspector-cases-form button[type=submit]")), "Show open cases");
  assert.equal(dialog.querySelector("#inspector-case-results").textContent, "", "nothing is requested until an inspector is chosen");
  assert.deepEqual(asked, []);

  const owner = api.createWorkflowEvents(services);
  const target = listenerTarget();
  owner.registerToolForms(target);
  owner.registerToolActions(target);
  const choose = async (who) => {
    const form = dialog.querySelector("#inspector-cases-form");
    form.querySelector("select").value = who;
    await target.listeners.submit({ target: form, preventDefault() {} });
  };
  const click = async (selector) => {
    const element = dialog.querySelector(selector);
    assert.ok(element, selector);
    await target.listeners.click({ target: { closest: () => element } });
    await settle();
  };
  const results = () => dialog.querySelector("#inspector-case-results");
  const prompt = () => dialog.querySelector("#inspector-case-prompt");

  // Choosing an inspector lists that inspector's open cases.
  await choose("i1");
  assert.deepEqual(asked, ["/cases/by-inspector?inspector=i1"]);
  assert.match(text(results()), /^2 open cases for ROBERT ALES\./);
  const items = [...results().querySelectorAll("li")];
  assert.equal(items.length, 2);
  assert.match(text(items[0]), /CB2026-000-00001 · 1 MAIN ST · A OWNER · Notice · Next due .*2026/);
  assert.match(text(items[1]), /No open deadline/);
  assert.equal(results().querySelector("img"), null, "case text is escaped");
  assert.match(text(items[1]), /<img src=x onerror="alert\(1\)">/);
  assert.equal(results().querySelector("[role=status]"), null, "no incompleteness note when nothing was left out");

  // The list says so when cases could not be included, or were limited.
  reply = answer(rows.slice(0, 1), { incomplete: 3 });
  await choose("i1");
  assert.match(text(results()), /1 open case for ROBERT ALES\./);
  assert.match(text(results()), /3 case files were not included .* may be incomplete/);
  reply = answer(rows, { total: 900, partial: true, incomplete: 1 });
  await choose("i1");
  assert.match(text(results()), /1 case file was not included because its summary/);
  assert.match(text(results()), /Showing the first 2 of 900 open cases\./);

  // Unassigned, and an empty list.
  reply = answer([]);
  await choose("unassigned");
  assert.equal(asked.at(-1), "/cases/by-inspector?inspector=unassigned");
  assert.equal(text(results()), "0 open cases for Unassigned or former inspector.");

  // A helper refusal is shown as its sentence, and the button is usable again.
  reply = new Error("The shared case folder could not be read");
  await choose("i1");
  assert.deepEqual(messages, ["The shared case folder could not be read"]);
  assert.equal(dialog.querySelector("#inspector-cases-form button[type=submit]").disabled, false);

  // Selecting a case prompts first; Back to list dismisses it without leaving.
  reply = answer(rows);
  await choose("i1");
  await click('[data-inspector-case="CB2026-000-00001"]');
  assert.match(text(prompt()), /Import a new inspection result to continue CB2026-000-00001\./);
  assert.equal(text(prompt().querySelector("[data-inspector-import]")), "Import inspection");
  assert.equal(text(prompt().querySelector("[data-global-open]")), "Open case without importing");
  assert.equal(prompt().querySelector("[data-global-open]").dataset.globalOpen, "CB2026-000-00001");
  assert.deepEqual(navigated, [], "selecting a case alone does not leave Workspace");
  await click("[data-inspector-cancel]");
  assert.equal(prompt().textContent, "");
  assert.ok(results().querySelector("li"), "the list stays");

  // Import inspection opens with the case number ready to look up; nothing is looked up automatically.
  const requestsBefore = asked.length;
  await click('[data-inspector-case="CB2026-000-00001"]');
  await click("[data-inspector-import]");
  assert.deepEqual(navigated, ["import"]);
  assert.equal(api.WriterState.state.screen, "import");
  assert.equal(dialog.hasAttribute("open"), false, "the dialog closes");
  assert.equal(api.WriterState.WORK.entry["lookup-number"], "CB2026-000-00001");
  assert.equal(renders, 1, "Import inspection repaints to show the number");
  assert.equal(asked.length, requestsBefore, "no lookup request is made until the inspector asks for it");
  assert.equal(api.WriterState.state.acc, null, "no import is created");

  // Navigation that did not complete (for example unsaved work) leaves the number unset.
  api.WriterState.state = { screen: "cases", acc: null };
  api.WriterState.WORK = { entry: {}, acc: null };
  navigated.length = 0;
  renders = 0;
  navigateResult = false;
  await click('[data-inspector-case="CB2026-000-00001"]');
  await click("[data-inspector-import]");
  assert.deepEqual(navigated, ["import"]);
  assert.equal(api.WriterState.WORK.entry["lookup-number"], undefined);
  assert.equal(renders, 0);
  navigateResult = true;

  // An import already awaiting review for this case is continued, not replaced.
  api.WriterState.state = { screen: "cases", acc: { cases: [{ number: "cb2026-000-00001" }], caseIx: 0, fileName: "x" } };
  navigated.length = 0;
  await click('[data-inspector-case="CB2026-000-00001"]');
  assert.match(text(prompt()), /already imported/);
  await click("[data-inspector-import]");
  assert.deepEqual(navigated, ["import"]);
  assert.equal(api.WriterState.WORK.entry["lookup-number"], undefined, "the saved import is kept; the search box is not touched");
  assert.equal(api.WriterState.state.acc.cases[0].number, "cb2026-000-00001");

  // An import for a different case must be finished first: no import button, no navigation.
  api.WriterState.state = { screen: "cases", acc: { cases: [{ number: "CB2026-000-09999" }], caseIx: 0, fileName: "x" } };
  navigated.length = 0;
  await click('[data-inspector-case="CB2026-000-00001"]');
  assert.match(text(prompt()), /Finish the current import first\.\s*An import for CB2026-000-09999 is waiting for review/);
  assert.equal(prompt().querySelector("[data-inspector-import]"), null);
  assert.ok(prompt().querySelector("[data-global-open]"), "the case can still be opened as before");
  assert.deepEqual(navigated, []);
  assert.equal(api.WriterState.WORK.entry["lookup-number"], undefined);
  // Even a forged import request is refused while a different import is waiting.
  const forged = document.createElement("button");
  forged.setAttribute("data-inspector-import", "CB2026-000-00001");
  await target.listeners.click({ target: { closest: () => forged } });
  await settle();
  assert.deepEqual(navigated, [], "a different waiting import is never replaced");
  assert.deepEqual(messages, ["The shared case folder could not be read"], "no unexpected errors");
  console.log("Inspector open-cases checks passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
