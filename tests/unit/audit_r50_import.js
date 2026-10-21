/* Regression for City acceptance: result statuses must use the defined eligibility table. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage());
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
Object.assign(global, {
  window: dom.window,
  document: dom.window.document,
  DOMParser: dom.window.DOMParser,
  confirm: () => true,
  getSelection: () => dom.window.getSelection(),
});
dom.window.scrollTo = () => {};
const check = async function () {
  await new Promise((r) => setTimeout(r, 30));
  idbSet = async () => true;
  saveDrafts = async () => true;
  render = () => {};
  scheduleDraftSave = () => {};
  const number = "CB2026-280-00050";
  const row = {
    CaseNumber: number,
    SiteAddress: "4500 SYNTHETIC LANE, MADISON WI 53703",
    ParcelNumber: "070913125237",
    OwnerName: "SYNTHETIC OWNER",
    OwnerAddress: "4500 SYNTHETIC LANE\nMADISON WI 53703",
    CaseDescription: "Import eligibility acceptance",
    HistoricDistrict: "No",
    IndividualLandmark: "No",
    InspectionDate: "2026-09-18",
    InspectionType: "Initial Inspection",
    InspectionTime: "",
    InspectorName: "Robert Ales",
    RecordCategory: "",
  };
  const report = (status, extra = {}) =>
    sqlReport({ ok: true, caseNumber: number, source: { kind: "sql" }, rows: [{ ...row, InspectionStatus: status, ...extra }] }, number);
  const reset = () => {
    WriterState.CASES = [];
    WriterState.DOCS = [];
    WriterState.REINSP = [];
    WriterState.EVENTS = {};
    WriterState.SAVE_CHECKPOINTS = {};
    COMMITTED.clear();
    WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
    WriterState.state = { ...WriterState.state, screen: "import", modal: null, acc: null };
    WriterState.CASEDIR = { helper: true };
    helperJSON = async () => ({ files: [] });
  };
  // R53: an Initial Inspection with status Completed or Compliance has no document rule and is refused (SQL and Excel).
  for (const status of ["Completed", "Compliance"]) {
    reset();
    WriterState.state.acc = report(status);
    assert.ok(
      accelaPlan(WriterState.state.acc).blockers.some((b) => /has no document rule/.test(b)),
      status + " SQL refused",
    );
    reset();
    const refusedBytes = fs.readFileSync(
      path.join(require("path").resolve(__dirname, "../.."), "tests/fixtures/reference/r50-import-fixtures", status.toLowerCase() + ".xlsx"),
    );
    await readAccelaFile({
      name: "result.xlsx",
      size: refusedBytes.length,
      arrayBuffer: async () => refusedBytes.buffer.slice(refusedBytes.byteOffset, refusedBytes.byteOffset + refusedBytes.byteLength),
    });
    assert.ok(accelaPlan(WriterState.state.acc).blockers.length > 0, status + " Excel refused");
  }
  for (const status of ["Official Notice", "Citation", " OFFICIAL  NOTICE "]) {
    reset();
    WriterState.state.acc = report(status);
    assert.equal(accelaPlan(WriterState.state.acc).blockers.length, 0, status + " SQL eligibility");
    assert.equal(accelaPlan(WriterState.state.acc).row.time, "");
    await confirmDatabaseCase();
    assert.equal(WriterState.DOCS.length, 1, status + " SQL imports");
    assert.equal(WriterState.DOCS[0].type, "notice");
    reset();
    const bytes = fs.readFileSync(
      path.join(
        require("path").resolve(__dirname, "../.."),
        "tests/fixtures/reference/r50-import-fixtures",
        status.trim().replace(/\s+/g, "-").toLowerCase() + ".xlsx",
      ),
    );
    await readAccelaFile({
      name: "result.xlsx",
      size: bytes.length,
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });
    assert.equal(accelaPlan(WriterState.state.acc).blockers.length, 0, status + " Excel eligibility");
    await confirmDatabaseCase();
    assert.equal(WriterState.DOCS.length, 1, status + " Excel imports");
    reset();
    WriterState.state.acc = report(status, { RecordCategory: "Snow Removal" });
    if (status === "Citation") {
      await confirmDatabaseCase();
      assert.ok(snow.is(WriterState.DOCS[0]), status + " snow routes");
    } else
      assert.ok(
        accelaPlan(WriterState.state.acc).blockers.some((b) => /Snow removal inspections are imported with status Citation/.test(b)),
        status + " snow refused",
      );
  }
  for (const status of ["Pending", "Cancelled", "Unknown", ""]) {
    reset();
    WriterState.state.acc = report(status);
    assert.equal(WriterState.state.acc.sel, null);
    assert.ok(accelaPlan(WriterState.state.acc).blockers.length);
    assert.ok(!accelaPanel().includes("data-accsel="));
    await confirmDatabaseCase();
    assert.equal(WriterState.DOCS.length, 0);
  }
  for (const [status, extra] of [
    ["Scheduled", {}],
    ["Official Notice", { InspectionType: "Assist" }],
  ]) {
    reset();
    assert.throws(() => report(status, extra), /Scheduled|Assist/);
  }
  // Multiple valid results require a choice and show the actual result, not a false exclusion.
  reset();
  // R53: three valid Initial Inspection results (Compliance has no initial rule).
  const rows = ["Official Notice", "Citation", "No Occupancy"].map((status, index) => ({
    ...row,
    InspectionStatus: status,
    InspectionDate: "2026-09-" + (18 + index),
  }));
  WriterState.state.acc = sqlReport({ ok: true, caseNumber: number, source: { kind: "sql" }, rows }, number);
  assert.equal(WriterState.state.acc.sel, null);
  assert.equal((accelaPanel().match(/data-accsel=/g) || []).length, 3);
  WriterState.state.acc.sel = 0;
  await confirmDatabaseCase();
  const k = WriterState.CASES[0],
    d = WriterState.DOCS[0];
  d.items = [{ id: "qa-item", no: "1", title: "Repair", text: "Repair wall.", sections: ["27.05(2)(c)"], due: addDays(recordDay(today), 21) }];
  assert.ok(issueDocument(d));
  WriterState.state.screen = "import";
  WriterState.state.acc = report("Official Notice");
  assert.ok(accelaPlan(WriterState.state.acc).used);
  await confirmDatabaseCase();
  assert.equal(WriterState.REINSP.length, 0);
  WriterState.state.acc = report("Citation", { InspectionType: "Reinspection", InspectionDate: "2026-09-22" });
  assert.equal(accelaPlan(WriterState.state.acc).blockers.length, 0);
  await confirmDatabaseCase();
  assert.equal(WriterState.REINSP.length, 1);
  assert.equal(WriterState.REINSP[0].time, "");
  assert.equal(WriterState.REINSP[0].caseId, k.id);
  console.log(
    "PASS SQL and actual Excel result status parity, snow routing, explicit m" +
      "ultiple choice, refusal of incomplete/unknown/Assist rows, reused-result" +
      " protection and later inspection import",
  );
  process.exit(0);
};
eval(payload + "\n(" + check.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
