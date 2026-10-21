/* Source-selection parity, interruption and draft-continuity regressions. Synthetic inputs only. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
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
global.DOMParser = w.DOMParser;
global.getSelection = () => w.getSelection();
global.confirm = () => true;
w.scrollTo = () => {};
const test = async function () {
  await new Promise((r) => setTimeout(r, 30));
  idbSet = async () => true;
  saveDrafts = async () => true;
  render = () => {};
  scheduleDraftSave = () => {};
  WriterState.CASEDIR = { helper: true };
  helperJSON = async () => ({ files: [] });
  let checks = 0;
  const ok = (name, value) => {
    assert.ok(value, name);
    checks++;
    console.log("PASS " + name);
  };
  const number = "CB2026-280-00045",
    source = { kind: "sql", database: "Synthetic", server: "fixture", retrievedAt: "2026-10-16T12:00:00Z", querySha256: "a".repeat(64) };
  const row = {
    CaseNumber: number,
    SiteAddress: "4500 SYNTHETIC LANE, MADISON WI 53703",
    ParcelNumber: "070913125237",
    OwnerName: "SYNTHETIC OWNER",
    OwnerAddress: "4500 SYNTHETIC LANE\nMADISON WI 53703",
    CaseDescription: "Synthetic import acceptance fixture",
    HistoricDistrict: "No",
    IndividualLandmark: "No",
    InspectionDate: "2026-09-18",
    InspectionType: "Initial Inspection",
    InspectionStatus: "Official Notice",
    InspectionTime: "",
    InspectorName: "Robert Ales",
    CaseType: "Code Violation",
    RecordCategory: "",
  };
  const report = (rows) => sqlReport({ ok: true, caseNumber: number, source, rows }, number);
  const reset = () => {
    cancelCaseLookup();
    WriterState.CASES = [];
    WriterState.DOCS = [];
    WriterState.REINSP = [];
    WriterState.EVENTS = {};
    WriterState.SAVE_CHECKPOINTS = {};
    COMMITTED.clear();
    WriterState.state = { ...WriterState.state, screen: "import", acc: null, modal: null };
    WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
    helperJSON = async () => ({ files: [] });
  };
  const load = async (name) => {
    const b = fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "tests/fixtures/reference/r45-import-fixtures", name + ".xlsx"));
    await readAccelaFile({
      name: name + ".xlsx",
      size: b.length,
      arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    });
    return WriterState.state.acc;
  };
  reset();
  const excel = await load("ordinary"),
    sql = report([row]);
  ok(
    "SQL and actual Excel bytes preserve equivalent identity and inspection facts",
    stableJSON(baseLookupPlan(excel).f) === stableJSON(baseLookupPlan(sql).f) && baseLookupPlan(excel).time === "" && baseLookupPlan(sql).time === "",
  );
  await confirmDatabaseCase();
  ok(
    "Excel opens one ordinary notice without inventing a time",
    WriterState.CASES.length === 1 && WriterState.DOCS.length === 1 && WriterState.DOCS[0].type === "notice" && WriterState.CASES[0].time === "",
  );
  const k = WriterState.CASES[0],
    d = WriterState.DOCS[0];
  d.items = [
    { id: "r45-item", no: "1", title: "Synthetic repair", text: "Repair wall.", sections: ["27.05(2)(c)"], due: addDays(recordDay(today), 21) },
  ];
  const retained = JSON.stringify(d);
  WriterState.state.screen = "import";
  WriterState.state.acc = report([
    row,
    { ...row, InspectionType: "Reinspection", InspectionStatus: "Extension Processing", InspectionDate: "2026-09-22" },
  ]);
  WriterState.state.acc.sel = 1;
  ok(
    "Existing unfinished work blocks import",
    accelaPlan(WriterState.state.acc).blockers.some((x) => /unfinished work/.test(x)),
  );
  preflightCase = async (_cid, _action, continuation) => continuation();
  openImportWorkspace(k.id);
  ok(
    "Continue existing case opens retained draft without applying import",
    WriterState.state.screen === "write" && WriterState.state.docId === d.id && JSON.stringify(d) === retained && k.owner === "SYNTHETIC OWNER",
  );
  reset();
  const multi = await load("multiple");
  ok("Excel multiple completed choices have no arbitrary default", multi.sel === null);
  WriterState.state.acc = multi;
  const panel = accelaPanel();
  ok("Choice panel excludes Scheduled Assist Pending rows", (panel.match(/data-accsel=/g) || []).length === 2 && !panel.includes(">Pending<"));
  for (const name of ["scheduled-only", "assist-only", "pending-only"]) {
    reset();
    const a = await load(name);
    ok(
      name + " gives a specific stop reason",
      name === "pending-only"
        ? accelaPlan(a).blockers.some((x) => /Pending/.test(x))
        : a.errors.some((x) => new RegExp(name.split("-")[0], "i").test(x)),
    );
  }
  for (const [field, value, label] of [
    ["InspectionStatus", "Scheduled", "Scheduled"],
    ["InspectionType", "Assist", "Assist"],
  ]) {
    let message = "";
    try {
      report([{ ...row, [field]: value }]);
    } catch (e) {
      message = e.message;
    }
    ok("SQL all-filtered " + label + " is not a multiple-case error", message.includes(label) && !message.includes("More than one"));
  }
  reset();
  WriterState.state.acc = report([{ ...row, RecordCategory: "Snow Removal", InspectionStatus: "Citation" }]);
  await confirmDatabaseCase();
  ok(
    "SQL snow route creates citation draft with blank observation time",
    WriterState.DOCS.length === 1 && snow.is(WriterState.DOCS[0]) && WriterState.DOCS[0].inspTime === "",
  );
  reset();
  await load("snow");
  await confirmDatabaseCase();
  ok("Excel snow route matches SQL", WriterState.DOCS.length === 1 && snow.is(WriterState.DOCS[0]) && WriterState.DOCS[0].inspTime === "");
  reset();
  WriterState.state.acc = report([row]);
  await confirmDatabaseCase();
  const created = WriterState.CASES[0],
    draft = WriterState.DOCS[0];
  draft.items = [{ id: "r45-pub", no: "1", title: "Wall", text: "Repair wall.", sections: ["27.05(2)(c)"], due: addDays(recordDay(today), 21) }];
  issueDocument(draft);
  const frozen = JSON.stringify(WriterState.DOCS);
  WriterState.state.screen = "import";
  WriterState.state.acc = report([row]);
  ok("Reused inspection stays blocked", accelaPlan(WriterState.state.acc).used);
  await confirmDatabaseCase();
  ok("Reused import preserves frozen documents", JSON.stringify(WriterState.DOCS) === frozen);
  WriterState.state.acc = report([
    { ...row, InspectionType: "Reinspection", InspectionStatus: "Extension Processing", InspectionDate: "2026-09-22" },
  ]);
  const before = lookupPlanSignature(WriterState.state.acc);
  WriterState.DOCS.unshift({ ...clone(WriterState.DOCS[0]), id: "r45-new-latest", inspDate: "2026-09-23" });
  ok(
    "Review signature binds actual latest document selection",
    lookupPlanSignature(WriterState.state.acc) !== before && accelaPlan(WriterState.state.acc).blockers.some((x) => /latest issued/.test(x)),
  );
  WriterState.DOCS.shift();
  const shared = caseFile(created.id);
  shared.schema = 4; // Legacy fixture; production schema-5 proof is covered by the real-helper browser gate.
  rememberSaved(created, clone(shared));
  shared.case.owner = "UPDATED SHARED OWNER";
  helperJSON = async (route) => (route === "/cases/list" ? { files: [{ name: caseFileName(created) }] } : { file: shared });
  await confirmDatabaseCase();
  ok(
    "Changed shared details require renewed review before starting worksheet",
    WriterState.state.screen === "import" && WriterState.REINSP.length === 0 && kase(created.id).owner === "UPDATED SHARED OWNER",
  );
  await confirmDatabaseCase();
  ok(
    "Reviewed shared import uses latest source and preserves blank time",
    WriterState.state.screen === "reinspect" &&
      WriterState.REINSP[0].sourceDocId === sourceDocFor(created.id).id &&
      WriterState.REINSP[0].time === "",
  );
  reset();
  let finish;
  const pending = readAccelaFile({ name: "late.xlsx", size: 100, arrayBuffer: () => new Promise((r) => (finish = r)) });
  cancelCaseLookup();
  WriterState.state.screen = "cases";
  finish(new ArrayBuffer(0));
  await pending;
  ok(
    "Delayed Excel bytes cannot reopen Import after navigation",
    WriterState.state.screen === "cases" && WriterState.state.acc === null && !WriterState.LOOKUP_BUSY,
  );
  reset();
  WriterState.state.acc = report([row]);
  const acc = WriterState.state.acc;
  let release;
  helperJSON = async () => new Promise((r) => (release = r));
  const confirm = confirmDatabaseCase();
  await new Promise((r) => setTimeout(r, 0));
  cancelCaseLookup();
  WriterState.state.screen = "cases";
  release({ files: [] });
  await confirm;
  ok(
    "Delayed shared preflight cannot accept after navigation",
    WriterState.CASES.length === 0 && WriterState.state.acc === acc && WriterState.state.screen === "cases",
  );
  reset();
  let readText;
  const fileName = "4500 SYNTHETIC LANE - " + number + ".json";
  WriterState.CASEDIR = {
    async *entries() {
      yield [fileName, { kind: "file", getFile: async () => ({ size: 1, lastModified: 1 }) }];
    },
    getFileHandle: async () => ({ getFile: async () => ({ text: () => new Promise((r) => (readText = r)) }) }),
  };
  const directoryRead = load("ordinary");
  for (let n = 0; n < 30 && !readText; n++) await new Promise((r) => setTimeout(r, 0));
  assert.equal(typeof readText, "function");
  cancelCaseLookup();
  WriterState.state.screen = "cases";
  readText(JSON.stringify(shared));
  await directoryRead;
  ok(
    "Delayed directory record cannot merge or reopen Import after navigation",
    WriterState.CASES.length === 0 && WriterState.state.screen === "cases",
  );
  reset();
  let completeRead;
  const abandonedRead = readAccelaFile({ name: "abandoned.xlsx", size: 100, arrayBuffer: () => new Promise((r) => (completeRead = r)) });
  WriterState.state.screen = "cases";
  completeRead(new ArrayBuffer(0));
  await abandonedRead;
  ok(
    "Navigation without an explicit cancellation clears busy and ignores the Excel result",
    !WriterState.LOOKUP_BUSY && WriterState.state.screen === "cases" && WriterState.state.acc === null,
  );
  reset();
  const input = document.createElement("input");
  input.id = "lookup-number";
  document.getElementById("app").append(input);
  WriterState.WORK.entry["lookup-number"] = number;
  input.value = "";
  captureWork();
  ok("A late capture cannot replace typed lookup work with a transient empty control", WriterState.WORK.entry["lookup-number"] === number);
  input.value = "";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  captureWork();
  ok("Deliberately clearing the case number remains an explicit saved edit", WriterState.WORK.entry["lookup-number"] === "");
  delete WriterState.WORK.entry["lookup-number"];
  input.value = number;
  captureWork();
  ok("First capture still recovers a previously unrecorded search", WriterState.WORK.entry["lookup-number"] === number);
  input.remove();
  console.log(checks + " R45 assertions passed.");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
