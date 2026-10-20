/* R37: the SQL case lookup returns Record Category; "Snow Removal" advances directly to the 10.28 snow citation draft. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const payload = Buffer.from(
  /var B="([A-Za-z0-9+/=]+)"/.exec(
    fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8"),
  )[1],
  "base64",
).toString();
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.fetch = async () => {
  throw new Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  render = () => {};
  idbSet = async () => true;
  saveDrafts = async () => true;
  helperJSON = async () => ({ ok: true, files: [] });
  const number = "CB2026-005-00048",
    day = recordDay(today);
  const row = {
    CaseNumber: number,
    SiteAddress: "2714 WILLARD AVE, MADISON WI 53704",
    ParcelNumber: "070913125237",
    OwnerName: "LAMBRIGHT, ELISABETH J",
    OwnerAddress: "2814 SOMMERS AVE\nMADISON WI 53704",
    CaseDescription: "Snow complaint",
    DetailedDescription: "",
    ZoningDistrict: "",
    HistoricDistrict: "No",
    HistoricDistrictName: null,
    IndividualLandmark: "No",
    Landmark: "",
    RecordCategory: "Snow Removal",
    InspectionDate: day + "T00:00:00",
    InspectionScheduledDate: day + "T00:00:00",
    InspectionType: "Initial Inspection",
    InspectionStatus: "Citation",
    InspectionTime: "11:46:00",
    InspectorName: INSPECTORS[0].name,
  };
  const source = { kind: "sql", server: "sqlelam", database: "CityData", retrievedAt: new Date().toISOString(), querySha256: "x".repeat(64) };
  const response = (rows) => ({ ok: true, rows, caseNumber: number, source });
  const reset = () => {
    WriterState.CASES = [];
    WriterState.DOCS = [];
    WriterState.REINSP = [];
    WriterState.EVENTS = {};
    WriterState.WORK = { entry: { "lookup-number": number }, acc: null, recordForms: {} };
    WriterState.state.acc = null;
    WriterState.state.screen = "import";
    WriterState.LOOKUP_BUSY = false;
    WriterState.LOOKUP_ERROR = "";
  };
  // The lookup row carries the category into the shared import table.
  reset();
  const acc = sqlReport(response([row]), number),
    r = acc.cases[0].rows[0];
  assert.equal(r.recordCategory, "Snow Removal");
  assert.ok(snow.matchesImport(r));
  assert.equal(r.time, "11:46");
  const plan = accelaPlan(acc);
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.next, "snow");
  assert.ok(lookupCanOpen(acc));
  // Find case advances in one step to the snow citation draft with the 10.28 item.
  reset();
  global.fetch = async () => ({ ok: true, json: async () => response([row]) });
  await findDatabaseCase();
  assert.equal(WriterState.CASES.length, 1);
  assert.equal(WriterState.CASES[0].caseType, "snow-10.28");
  assert.equal(WriterState.DOCS.length, 1);
  const d = WriterState.DOCS[0];
  assert.ok(d.draft && snow.is(d));
  assert.equal(eventsFor(WriterState.CASES[0].id).length, 0);
  assert.deepEqual(
    d.items.map((i) => i.sections[0]),
    ["10.28"],
  );
  assert.equal(d.items[0].title, "Failure to remove snow and or ice from public sidewalk");
  assert.equal(d.items[0].cite, true);
  assert.equal(d.items[0].due, null);
  // Without the category (or with another), a lookup is not a snow case.
  for (const value of [undefined, null, "Property Maintenance"]) {
    reset();
    const x = { ...row };
    if (value === undefined) delete x.RecordCategory;
    else x.RecordCategory = value;
    const a = sqlReport(response([x]), number);
    assert.ok(!snow.matchesImport(a.cases[0].rows[0]));
    assert.notEqual(accelaPlan(a).next, "snow");
  }
  console.log(
    "PASS R37 SQL lookup Record Category: Snow Removal advances directly to t" + "he 10.28 snow citation draft; other or missing categories do not",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
