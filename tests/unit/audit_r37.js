/* R37: the SQL case lookup returns Record Category; "Snow Removal" advances directly to the 10.28 snow citation draft.
   Runs against the real import, snow, pricing and document-creation owners (tests/fixtures/import_workflow.cjs);
   the helper transport is the only network boundary and every other peer is bounded. */
const assert = require("assert/strict");
const createImportWorkflow = require("../fixtures/import_workflow.cjs");
const test = async () => {
  const h = await createImportWorkflow(),
    { WriterState, importer, snow, INSPECTORS, recordDay, today } = h,
    { sqlReport, accelaPlan, lookupCanOpen, findDatabaseCase, confirmDatabaseCase } = importer,
    { eventsFor } = h.queries;
  global.fetch = async () => {
    throw new Error("offline");
  };
  h.bound.helperJSON = async () => ({ ok: true, files: [] });
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
  // Find case opens the import window; confirming the one inspection advances to the snow citation draft with the
  // 10.28 item.
  reset();
  global.fetch = async () => ({ ok: true, json: async () => response([row]) });
  await findDatabaseCase();
  assert.equal(WriterState.CASES.length, 0, "nothing is imported before the inspector confirms");
  await confirmDatabaseCase();
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
test().catch((e) => {
  console.error(e);
  process.exit(1);
});
