/* R15: action-first Workspace queue, due-soon signals and clear recovery actions. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  payload = bundleSource(html);
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
const w = dom.window;
global.window = w;
global.document = w.document;
global.getSelection = () => w.getSelection();
global.confirm = () => true;
w.scrollTo = () => {};
const tests = async function () {
  await new Promise((r) => setTimeout(r, 25));
  render = () => {};
  saveDrafts = async () => true;
  idbSet = async () => true;
  let count = 0;
  const ok = (name, value) => {
    assert.ok(value, name);
    count++;
    console.log("PASS " + name);
  };
  WriterState.CASES = [];
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  WriterState.PENDING = [];
  WriterState.RECORD_ATTEMPTS = {};
  WriterState.CASEDIR = null;
  WriterState.NEEDGRANT = false;
  WriterState.HELPER = null;
  WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
  WriterState.state = {
    ...WriterState.state,
    screen: "cases",
    caseQ: "",
    caseFilter: "attention",
    caseInspector: "",
    acc: null,
    docId: null,
    reinspId: null,
    modal: null,
  };
  const makeCase = (id, due, type = "notice") => {
    const k = {
      id,
      number: "CASE-" + id.toUpperCase(),
      address: id.toUpperCase() + " TEST ST",
      owner: "TEST OWNER",
      parcel: "070913125237",
      inspectorId: INSPECTORS[0].id,
      date: iso(today),
      time: "09:00",
    };
    WriterState.CASES.push(k);
    const d = {
      id: "doc-" + id,
      caseId: id,
      type,
      created: iso(today),
      mailed: iso(today),
      status: "Final",
      draft: false,
      filedAt: "filed",
      items: [{ id: "item-" + id, no: "1", done: type === "compliance", withdrawn: false, due, text: "Fix it." }],
      cits: {},
    };
    d.filedArtifact = { filename: id + ".pdf", sha256: "a".repeat(64) };
    WriterState.ARTIFACT_LOCATIONS[d.id] = ["shared"];
    WriterState.DOCS.push(d);
    return { k, d };
  };
  const late = makeCase("late", addDays(iso(today), -1));
  const todayCase = makeCase("today", iso(today));
  const soon = makeCase("soon", addDays(iso(today), 7));
  const future = makeCase("future", addDays(iso(today), 8));
  const sync = makeCase("sync", addDays(iso(today), 30));
  WriterState.PENDING.push({ cid: sync.k.id, name: "CASE-SYNC.json", body: "{}" });
  const filing = makeCase("filing", addDays(iso(today), 30));
  delete filing.d.filedAt;
  const draft = makeCase("draft", addDays(iso(today), 30));
  WriterState.DOCS.unshift({
    id: "draft-doc",
    caseId: draft.k.id,
    type: "notice",
    created: iso(today),
    mailed: iso(today),
    status: "Draft",
    draft: true,
    items: [],
    cits: {},
  });
  const closed = makeCase("closed", addDays(iso(today), 1), "compliance");
  closed.d.items[0].done = true;
  const record = makeCase("record", addDays(iso(today), 30));
  WriterState.RECORD_ATTEMPTS = { retry: { cid: record.k.id, recordKey: "retry" } };
  const bounds = [
    { name: "late", st: caseState(late.k) },
    { name: "today", st: caseState(todayCase.k) },
    { name: "soon", st: caseState(soon.k) },
    { name: "future", st: caseState(future.k) },
  ];
  ok("Past due cases stay flagged", bounds[0].st.late && bounds[0].st.attention);
  ok("Due today and within seven days enter the due-soon queue", bounds[1].st.soon && bounds[2].st.soon);
  ok("Due dates beyond seven days stay out of the attention queue", !bounds[3].st.soon && !bounds[3].st.attention);
  ok(
    "Pending case sync and missing PDF filing are attention items",
    caseState(sync.k).pendingSync && caseState(sync.k).attention && caseState(filing.k).filingDoc === filing.d && caseState(filing.k).attention,
  );
  ok(
    "Unfinished document and retained save confirmation are attention items",
    caseState(draft.k).draft && caseState(draft.k).attention && caseState(record.k).pendingRecord?.recordKey === "retry",
  );
  ok("Closed cases do not enter due-soon attention", caseState(closed.k).closed && !caseState(closed.k).attention);
  let markup = screenCases();
  ok(
    "Workspace starts in the Needs attention view",
    WriterState.state.caseFilter === "attention" && markup.includes("Needs attention") && markup.includes("Due within 7 days"),
  );
  ok(
    "Needs attention displays overdue, today, due-soon, unsynced, filing and unfinished cases",
    ["CASE-LATE", "CASE-TODAY", "CASE-SOON", "CASE-SYNC", "CASE-FILING", "CASE-DRAFT", "CASE-RECORD"].every((x) => markup.includes(x)) &&
      !markup.includes("CASE-FUTURE") &&
      !markup.includes("CASE-CLOSED"),
  );
  ok(
    "Each waiting record shows its specific next action",
    markup.includes('data-case-sync="sync"') &&
      markup.includes("Finish PDF filing") &&
      markup.includes("Confirm saved action") &&
      markup.includes('data-reinsp="soon"'),
  );
  ok("All cases remains a one-step alternate view", markup.includes("All cases (9)"));
  WriterState.state.caseFilter = "all";
  markup = screenCases();
  ok("All cases brings future-due and closed records back into the list", markup.includes("CASE-FUTURE") && markup.includes("CASE-CLOSED"));
  WriterState.state.caseFilter = "attention";
  WriterState.state.acc = {
    fileName: "Inspection result",
    caseIx: 0,
    cases: [{ number: "CB2026-111-00001", address: "99 REVIEW ST" }],
    source: { kind: "sql" },
  };
  WriterState.WORK.acc = clone(WriterState.state.acc);
  markup = screenCases();
  ok(
    "An import awaiting review is surfaced by case number and has a review action",
    markup.includes("Import awaiting review") && markup.includes("CB2026-111-00001") && markup.includes("Review import"),
  );
  document.getElementById("app").innerHTML = markup;
  let syncCalls = 0;
  WriterState.CASEDIR = {};
  flushPending = async () => {
    syncCalls++;
    return 1;
  };
  document.querySelector('[data-case-sync="sync"]').click();
  await Promise.resolve();
  ok("Selecting the case sync action starts the pending file sync", syncCalls === 1);
  document.querySelector('[data-open="doc-filing"]').click();
  await new Promise((r) => setTimeout(r, 0));
  ok("Selecting the PDF filing action opens its document", WriterState.state.screen === "write" && WriterState.state.docId === "doc-filing");
  console.log(count + " Workspace queue assertions passed.");
  process.exit(0);
};
eval(payload + "\n(" + tests.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
