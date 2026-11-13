/* Workspace inspector lists update only their own card; choosing a server case enters the existing import review. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const api = await compile('export * from "./open_case_list.js";');
  const s = api.WriterState,
    list = api.openList;
  Object.assign(s, { state: { screen: "cases", acc: null }, WORK: { entry: {}, acc: null } });
  Object.assign(list, {
    inspectors: [{ id: "I", name: "Inspector", openCases: 1 }],
    loading: false,
    error: "",
    selected: "I",
    cases: [],
    casesFor: "I",
    casesLoading: false,
    casesError: "",
    query: "",
    loadedAt: "",
  });
  const dom = new JSDOM(
    '<input id="retained-lookup" value="typed work"><table><tbody><tr id="case-row"><td>Retained case</td></tr></tbody></table>' +
      api.openCaseCardHTML(),
  );
  global.document = dom.window.document;
  global.localStorage = { getItem: () => "I", setItem() {} };
  const field = document.getElementById("retained-lookup"),
    row = document.getElementById("case-row");
  field.focus();
  field.setSelectionRange(2, 6);
  let resolve,
    renders = 0,
    lookups = 0,
    cancelled = 0;
  const owner = api.createOpenCaseList({
    helperJSON: () =>
      new Promise((r) => {
        resolve = r;
      }),
    render: () => renders++,
    cancelCaseLookup: () => cancelled++,
    findDatabaseCase: async () => {
      lookups++;
      assert.equal(s.state.screen, "import");
      assert.equal(s.WORK.entry["lookup-number"], "CB2026-100-00001");
    },
  });
  const loading = owner.showCases("I");
  assert.equal(document.getElementById("retained-lookup"), field);
  assert.equal(document.getElementById("case-row"), row);
  resolve({ cases: [{ caseNumber: "CB2026-100-00001", address: "1 TEST ST", description: "Repair" }] });
  await loading;
  assert.equal(renders, 0, "server answers do not recalculate or replace loaded Workspace rows");
  assert.equal(document.activeElement, field);
  assert.deepEqual([field.selectionStart, field.selectionEnd], [2, 6]);
  assert.equal(field.value, "typed work");
  assert.equal(document.querySelectorAll(".open-case").length, 1);
  const search = document.getElementById("open-cases-search");
  search.value = "Repair";
  search.focus();
  search.setSelectionRange(1, 4);
  list.query = "Repair";
  const reload = owner.refreshInspectors();
  resolve({ inspectors: [{ id: "I", name: "Inspector", openCases: 1 }] });
  await reload;
  assert.equal(document.getElementById("retained-lookup"), field);
  assert.equal(document.getElementById("case-row"), row);
  await owner.pick("CB2026-100-00001");
  assert.equal(lookups, 1);
  assert.equal(cancelled, 1);
  assert.equal(s.state.acc, null);
  assert.equal(s.WORK.acc, null);
  assert.equal(renders, 1, "case selection switches to the existing import screen");
  dom.window.close();
  console.log("PASS Workspace open cases: isolated card updates preserve case rows, typed text and focus; one-click existing import route");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
