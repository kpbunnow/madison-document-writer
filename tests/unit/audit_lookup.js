/* R5 SQL results -> existing lifecycle; network is synthetic, state logic is real. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8");
const payload = Buffer.from(/var B="([A-Za-z0-9+\/=]+)"/.exec(html)[1], "base64").toString("utf8");
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
const test = async function () {
  await new Promise((r) => setTimeout(r, 25));
  render = () => {};
  idbSet = async () => true;
  saveDrafts = async () => true;
  let checks = 0;
  const ok = (name, test) => {
    assert.ok(test, name);
    checks++;
    console.log("PASS " + name);
  };
  const number = "CB2026-241-00001";
  const row = {
    CaseNumber: number,
    SiteAddress: "101 TEST ST, MADISON WI 53703",
    ParcelNumber: "070913125237",
    OwnerName: "TEST OWNER",
    OwnerAddress: "101 TEST ST\nMADISON WI 53703",
    CaseDescription: "Complaint",
    DetailedDescription: "Not imported",
    ZoningDistrict: "Not imported",
    HistoricDistrict: "Yes",
    HistoricDistrictName: "Third Lake Ridge",
    IndividualLandmark: "No",
    Landmark: "",
    InspectionDate: "2026-09-18T00:00:00",
    InspectionScheduledDate: "2026-10-10T00:00:00",
    InspectionType: "Initial Inspection",
    InspectionStatus: "Official Notice",
    InspectionTime: "09:05:00",
    InspectorName: INSPECTORS[0].name,
  };
  const source = { kind: "sql", server: "sqlelam", database: "CityData", retrievedAt: "2026-09-26T12:00:00Z", querySha256: "x".repeat(64) };
  const response = (rows = [row]) => ({ ok: true, rows, caseNumber: number, source });
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
  reset();
  let acc = sqlReport(response(), number),
    p = accelaPlan(acc);
  ok("Exact field mapping and historic district name", p.f.historicDistrict === "Third Lake Ridge" && p.f.owner === "TEST OWNER");
  ok("Completed date and time retained; scheduled date never substituted", p.date === "2026-09-18" && p.time === "09:05");
  ok("Ignored detailed description not retained", !JSON.stringify(acc).includes("Not imported"));
  ok("Clean initial case qualifies for one-step notice", lookupCanOpen(acc));
  acc = sqlReport(
    response([row, { ...row, InspectionDate: "2026-09-19T00:00:00", InspectionType: "Reinspection", InspectionStatus: "Extension Processing" }]),
    number,
  );
  ok("Multiple completed inspections require an explicit choice", acc.sel === null && !lookupCanOpen(acc));
  acc = sqlReport(response([{ ...row, InspectionDate: null, InspectionStatus: "Pending" }]), number);
  ok("Scheduled-only inspection cannot create document", !acc.cases[0].rows[0].selectable && accelaPlan(acc).blockers.length > 0);
  for (const rows of [
    [],
    [{ ...row, CaseNumber: "WRONG" }],
    [{ ...row, IndividualLandmark: "Yes", Landmark: "" }],
    [{ ...row, HistoricDistrictName: "" }],
  ]) {
    let failed = false;
    try {
      sqlReport(response(rows), number);
    } catch (e) {
      failed = true;
    }
    ok("Invalid or incomplete source rejected", failed);
  }
  reset();
  helperJSON = async () => ({ ok: true, files: [] });
  global.fetch = async () => ({ ok: true, json: async () => response() });
  await findDatabaseCase();
  ok(
    "Find case creates exactly one draft and no issued event",
    WriterState.CASES.length === 1 && WriterState.DOCS.length === 1 && WriterState.DOCS[0].draft && eventsFor(WriterState.CASES[0].id).length === 0,
  );
  ok("Accepted lookup retains database and query provenance", WriterState.CASES[0].accela.source.database === "CityData");
  const k = WriterState.CASES[0],
    d = WriterState.DOCS[0];
  d.items.push({ id: uid("x"), no: "1", sections: ["27.05(2)(c)"], title: "Test", text: "Repair", due: "2026-10-10", prov: "notice" });
  issueDocument(d);
  const history = JSON.stringify(WriterState.EVENTS),
    frozen = JSON.stringify(doc(d.id).frozen);
  WriterState.state.screen = "import";
  WriterState.WORK.entry["lookup-number"] = number;
  global.fetch = async () => ({ ok: true, json: async () => response([{ ...row, OwnerName: "NEW OWNER" }]) });
  await findDatabaseCase();
  ok(
    "Existing case requires review and retains original owner until accepted",
    !!WriterState.state.acc && WriterState.CASES[0].owner === "TEST OWNER" && accelaPlan(WriterState.state.acc).diff.some((x) => x.l === "Owner"),
  );
  const review = WriterState.state.acc;
  ok("Unreviewed direct call cannot bypass shared check", acceptAccela() === null && WriterState.CASES[0].owner === "TEST OWNER");
  await confirmDatabaseCase();
  ok(
    "Reusing the issued initial inspection is blocked without changing case or history",
    WriterState.CASES[0].owner === "TEST OWNER" &&
      accelaPlan(WriterState.state.acc).used &&
      JSON.stringify(WriterState.EVENTS) === history &&
      JSON.stringify(doc(d.id).frozen) === frozen,
  );
  reset();
  helperJSON = async () => {
    throw new Error("Share offline");
  };
  global.fetch = async () => ({ ok: true, json: async () => response() });
  await findDatabaseCase();
  ok(
    "Unavailable share blocks auto creation and retains retrieved review",
    WriterState.CASES.length === 0 && !!WriterState.state.acc.shareError && accelaPlan(WriterState.state.acc).blockers.includes("Share offline"),
  );
  captureWork();
  const saved = clone(WriterState.WORK);
  WriterState.state.acc = null;
  WriterState.WORK = saved;
  WriterState.state.acc = WriterState.WORK.acc;
  ok("Save/resume retains source and share blocker", WriterState.state.acc.source.database === "CityData" && !!WriterState.state.acc.shareError);
  helperJSON = async () => ({ ok: true, files: [] });
  await confirmDatabaseCase();
  ok("Retry after share recovery accepts once", WriterState.CASES.length === 1 && WriterState.DOCS.length === 1);
  reset();
  helperJSON = async () => ({ ok: true, files: [{ name: "A - " + number + ".json" }, { name: "B - " + number + ".json" }] });
  await findDatabaseCase();
  ok("Duplicate shared case files block creation", WriterState.CASES.length === 0 && /More than one/.test(WriterState.state.acc.shareError));
  reset();
  const retained = sqlReport(response(), number);
  WriterState.state.acc = retained;
  global.fetch = async () => ({ ok: false, json: async () => ({ ok: false, error: "Database unavailable" }) });
  await findDatabaseCase();
  ok("Database failure preserves previous review", WriterState.state.acc === retained && WriterState.LOOKUP_ERROR === "Database unavailable");
  reset();
  let finish;
  global.fetch = () => new Promise((r) => (finish = r));
  const pending = findDatabaseCase();
  await new Promise((r) => setTimeout(r, 5));
  cancelCaseLookup();
  WriterState.state.screen = "cases";
  finish({ ok: true, json: async () => response() });
  await pending;
  ok(
    "Canceled late response cannot change screen or create case",
    WriterState.state.screen === "cases" && WriterState.CASES.length === 0 && WriterState.state.acc === null,
  );
  reset();
  helperJSON = async () => ({ ok: true, files: [{ name: "A - " + number + ".json" }] });
  let read = 0;
  helperJSON = async (url) =>
    url === "/cases/list" ? { ok: true, files: [{ name: "A - " + number + ".json" }] } : { ok: true, file: { case: { number: "OTHER" } } };
  global.fetch = async () => ({ ok: true, json: async () => response() });
  await findDatabaseCase();
  ok("Filename/content mismatch blocks creation", WriterState.CASES.length === 0 && /disagree/.test(WriterState.state.acc.shareError));
  console.log(checks + " R5 lookup assertions passed.");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
