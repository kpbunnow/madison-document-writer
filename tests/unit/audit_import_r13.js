/* R13: case routing, retained inspection identity and actionable validation. */
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
  idbSet = async () => true;
  saveDrafts = async () => true;
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
  WriterState.CASEDIR = null;
  WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
  const number = "CB2026-241-09001",
    initial = "2026-09-10",
    visit = "2026-09-15";
  const row = {
    CaseNumber: number,
    SiteAddress: "101 TEST ST, MADISON WI 53703",
    ParcelNumber: "070913125237",
    OwnerName: "TEST OWNER",
    OwnerAddress: "101 TEST ST\nMADISON WI 53703",
    CaseDescription: "Complaint",
    HistoricDistrict: "No",
    HistoricDistrictName: "",
    IndividualLandmark: "No",
    Landmark: "",
    InspectionDate: initial,
    InspectionType: "Initial Inspection",
    InspectionStatus: "Official Notice",
    InspectionTime: "09:05",
    InspectorName: INSPECTORS[0].name,
  };
  const make = (rows) => sqlReport({ ok: true, rows, caseNumber: number, source: { kind: "sql", retrievedAt: new Date().toISOString() } }, number);
  const accept = () => {
    LOOKUP_READY.add(WriterState.state.acc);
    try {
      return acceptAccela();
    } finally {
      if (WriterState.state.acc) LOOKUP_READY.delete(WriterState.state.acc);
    }
  };
  WriterState.state.acc = make([row]);
  ok(
    "A new case starts with an initial notice",
    accelaPlan(WriterState.state.acc).next === "notice" && !accelaPlan(WriterState.state.acc).blockers.length,
  );
  accept();
  const k = WriterState.CASES[0],
    n = WriterState.DOCS[0];
  ok("Imported initial identity saved on the draft", n.importInspection.date === initial);
  WriterState.state.acc = make([row]);
  ok(
    "Searching the same initial inspection refreshes its draft and never creates another",
    !!accelaPlan(WriterState.state.acc).refresh && (accept(), WriterState.DOCS.length === 1) && WriterState.DOCS[0].id === n.id,
  );
  n.items = [
    { id: "test-item", no: "1", sections: ["27.05(2)(c)"], text: "Repair the wall.", title: "Wall", due: addDays(iso(today), 21), prov: "notice" },
  ];
  issueDocument(n);
  const history = JSON.stringify(WriterState.EVENTS);
  WriterState.state.acc = make([{ ...row, OwnerName: "CHANGED", InspectionStatus: "Official Notice" }]);
  WriterState.state.acc.sel = WriterState.state.acc.cases[0].rows[0].i;
  ok(
    "Changed status/owner cannot bypass duplicate inspection detection",
    accelaPlan(WriterState.state.acc).used && accept() === null && k.owner === "TEST OWNER",
  );
  ok("Rejected repeat keeps issued evidence unchanged", JSON.stringify(WriterState.EVENTS) === history);
  let second = { ...row, InspectionType: "Reinspection", InspectionStatus: "Extension Processing", InspectionDate: visit, InspectionTime: "14:30" };
  WriterState.state.acc = make([second]);
  ok(
    "Unused reinspection uses the existing issued case",
    accelaPlan(WriterState.state.acc).next === "reinspect" && !accelaPlan(WriterState.state.acc).blockers.length,
  );
  accept();
  const r = reinsp(WriterState.state.reinspId);
  ok("Reinspection loads source document, date and time", r.sourceDocId === n.id && r.date === visit && r.time === "14:30");
  ok("Original case inspection stays unchanged", k.date === initial && k.time === "09:05");
  WriterState.state.acc = make([{ ...second, InspectionDate: "2026-09-16" }]);
  ok(
    "Unfinished visit cannot be replaced by a different import",
    accelaPlan(WriterState.state.acc).blockers.some((t) => /unfinished work/.test(t)) && accept() === null && r.date === visit,
  );
  r.results["test-item"] = { oc: "none", on: visit, due: addDays(iso(today), 30), note: "", cite: false };
  docFromReinspection(r, "extension");
  const ext = doc(WriterState.state.docId);
  ok(
    "Follow-up inherits the imported observation identity",
    ext.importInspection.time === "14:30" && ext.inspDate === visit && ext.inspTime === "14:30",
  );
  ok(
    "Bulk assignment exists only for a new notice",
    !!duePanel({ ...n, draft: true, status: "Draft" }, false) && !duePanel(r, true) && !duePanel(ext, false),
  );
  const priorDue = r.results["test-item"].due;
  ok(
    "Hidden bulk worksheet action is also guarded",
    !!assignDue(r, true, addDays(iso(today), 40), ["test-item"]) && r.results["test-item"].due === priorDue,
  );
  issueDocument(ext);
  r.draft = false;
  r.docId = ext.id;
  WriterState.state.acc = make([second]);
  ok("A completed reinspection cannot be imported a second time", accelaPlan(WriterState.state.acc).used && accept() === null);
  WriterState.state.acc = make([{ ...second, InspectionDate: "2026-09-16", InspectionTime: "10:45" }]);
  accept();
  const next = reinsp(WriterState.state.reinspId);
  ok("Next unused inspection works from latest issued follow-up", next.sourceDocId === ext.id && next.date === "2026-09-16" && next.time === "10:45");
  ok(
    "Missing historical time conservatively blocks same-day reuse",
    sameInspection({ type: "reinspection", date: visit, time: "" }, { type: "reinspection", date: visit, time: "14:30" }),
  );
  ok(
    "Known different times remain distinct inspections",
    !sameInspection({ type: "reinspection", date: visit, time: "11:00" }, { type: "reinspection", date: visit, time: "14:30" }),
  );
  WriterState.state.caseFilter = "closed";
  WriterState.state.caseInspector = "other";
  openImportWorkspace(k.id);
  ok(
    "Continue existing case opens its unfinished worksheet directly",
    WriterState.state.screen === "reinspect" && WriterState.state.reinspId === next.id,
  );
  // Focus and persistent highlights use precise destinations, including multiple items.
  const draft = {
    ...clone(n),
    id: "validation-draft",
    draft: true,
    status: "Draft",
    items: [
      { ...clone(n.items[0]), id: "a", no: "1", text: "Repair ( ).", due: "" },
      { ...clone(n.items[0]), id: "b", no: "2", text: "Repair wall.", due: "" },
    ],
  };
  WriterState.DOCS.unshift(draft);
  WriterState.state.docId = draft.id;
  WriterState.state.screen = "write";
  k.parcel = "";
  const list = checks(draft),
    blank = list.find((c) => !c.ok && /unfilled bubble/.test(c.t)),
    dates = list.find((c) => !c.ok && /no due date/.test(c.t)),
    parcel = list.find((c) => !c.ok && /parcel/.test(c.t));
  ok("Blank check targets only the incomplete item", blank.targets.length === 1 && blank.targets[0].selector === itemSelector("a", "text"));
  ok("Multiple missing due dates provide separate item links", dates.targets.length === 2);
  ok("Missing parcel targets an editable property field", parcel.targets[0].selector === '[data-case="parcel"]');
  document.getElementById("app").innerHTML = screenWrite();
  highlightOpenChecks();
  ok(
    "Incomplete fields highlighted even with checks collapsed",
    document.querySelector(itemSelector("a", "text")).classList.contains("check-open") &&
      document.querySelector('[data-case="parcel"]').classList.contains("check-open"),
  );
  focusCheckTarget(parcel.targets[0], parcel.t);
  ok(
    "Check navigation opens collapsed details and focuses field",
    document.activeElement.dataset.case === "parcel" && document.activeElement.closest("details").open,
  );
  // Exercise the actual rendered link used in the inspection result/check panel.
  render = () => {
    document.getElementById("app").innerHTML = screenWrite();
    highlightOpenChecks();
  };
  WriterState.state.modal = "final";
  document.getElementById("overlay").innerHTML = modalHTML();
  const parcelLink = document.querySelector(".modal .check-link");
  ok(
    "Document check links are rendered as buttons, not worksheet links",
    parcelLink?.type === "button" && !parcelLink.hasAttribute("data-check-worksheet"),
  );
  parcelLink.click();
  ok(
    "Selecting a rendered check link focuses its corresponding field",
    document.activeElement.dataset.field === "text" && document.activeElement.dataset.id === "a",
  );
  WriterState.state.modal = null;
  draft.items[0].text = "Repair the wall.";
  highlightOpenChecks();
  ok("Highlight clears as the flagged value is corrected", !document.querySelector(itemSelector("a", "text")).classList.contains("check-open"));
  WriterState.state.screen = "reinspect";
  WriterState.state.reinspId = next.id;
  next.results = {};
  const wc = worksheetChecks(next);
  ok(
    "Worksheet checks target exact unresulted item",
    wc.some((c) => c.targets[0].selector.includes('data-item="' + doc(next.sourceDocId).items[0].id + '"')),
  );
  const markup = screenReinspect();
  ok("Reinspection screen offers checks and no bulk controls", markup.includes("Inspection checks") && !markup.includes('id="bulk-due"'));
  console.log(count + " R13 regression assertions passed.");
  process.exit(0);
};
eval(payload + "\n(" + tests.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
