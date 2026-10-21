/* R36: discard Scheduled/Assist inspections, Inspection Time is authoritative, no Accela-document warning,
   and Record Category "Snow Removal" builds the 10.28 snow citation draft immediately. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage());
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
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  WriterState.REINSP = [];
  WriterState.PENDING = [];
  WriterState.CASES = [];
  WriterState.WORK.entry = {};
  const day = recordDay(today),
    inspector = INSPECTORS.find((i) => i.id === "i4").name;
  const head = [
    "Case Number",
    "Inspector Name",
    "Site Address",
    "Parcel Number",
    "Owner Name",
    "Owner Address",
    "Inspection Type",
    "Inspection Date",
    "Inspection Status",
    "Inspection Time",
    "Case Type",
    "Record Category",
  ];
  const row = (num, type, status, time, category, date = day) => [
    num,
    inspector,
    "2714 WILLARD AVE",
    "070822219101",
    "LAMBRIGHT, ELISABETH J",
    "2814 SOMMERS AVE, MADISON, WI 53704",
    type,
    date + " 13:00:00",
    status,
    time,
    "Property Maintenance",
    category,
  ];
  // 1. Scheduled and Assist inspections are discarded; a case with only those rows does not appear.
  const acc = accelaTable([
    head,
    row("CB2026-005-00048", "Initial Inspection", "Citation", "11:46 AM", "Snow Removal"),
    row("CB2026-005-00048", "Reinspection", "Scheduled", "09:00 AM", "Snow Removal"),
    row("CB2026-005-00048", "Assist", "Completed", "10:00 AM", "Snow Removal"),
    row("CB2026-005-00099", "Assist", "Completed", "10:00 AM", ""),
    row("CB2026-005-00099", "Initial Inspection", "Scheduled", "10:00 AM", ""),
  ]);
  assert.deepEqual(acc.errors, []);
  assert.deepEqual(
    acc.cases.map((c) => c.number),
    ["CB2026-005-00048"],
  );
  const c = acc.cases[0];
  assert.equal(c.rows.length, 1);
  assert.equal(c.rows[0].status, "Citation");
  assert.ok(!acc.notes.some((n) => /Record Category/.test(n)), "Record Category is a known column");
  // 2. Inspection Time is authoritative: the 13:00 in the date column is ignored, with no warning.
  assert.equal(c.rows[0].time, "11:46");
  assert.deepEqual(c.rows[0].warn, []);
  // 3. No Accela-document warning (the status table still marks document statuses).
  const docAcc = accelaTable([head, row("CB2026-005-00077", "Initial Inspection", "Official Notice", "11:46 AM", "")]);
  assert.ok(!docAcc.cases[0].rows[0].warn.some((w) => /already records a document/.test(w)));
  // 4. Record Category "Snow Removal" makes the import a snow case and builds the 10.28 citation draft immediately.
  assert.equal(c.rows[0].recordCategory, "Snow Removal");
  assert.ok(snow.matchesImport(c.rows[0]));
  acc.sel = c.rows[0].i;
  WriterState.state.acc = acc;
  const plan = accelaPlan(acc);
  assert.deepEqual(plan.blockers, []);
  assert.equal(plan.next, "snow");
  acceptAccela();
  const k = WriterState.CASES.find((x) => x.number === "CB2026-005-00048");
  assert.ok(k);
  assert.equal(k.caseType, "snow-10.28");
  const d = doc(WriterState.state.docId);
  assert.equal(d.caseId, k.id);
  assert.ok(snow.is(d));
  assert.equal(d.items.length, 1);
  assert.deepEqual(d.items[0].sections, ["10.28"]);
  assert.equal(d.items[0].title, "Failure to remove snow and or ice from public sidewalk");
  assert.equal(d.items[0].cite, true);
  assert.equal(d.items[0].due, null);
  assert.equal(d.inspTime || k.time, "11:46");
  // Other categories, blank categories and older reports without the column are not snow cases and get no column note.
  const other = accelaTable([head, row("CB2026-005-00111", "Initial Inspection", "Official Notice", "08:30 AM", "Property Maintenance")]);
  assert.ok(!snow.matchesImport(other.cases[0].rows[0]));
  assert.ok(snow.matchesImport({ recordCategory: "  snow removal " }));
  assert.ok(!snow.matchesImport({ recordCategory: "Snow" }));
  const old = accelaTable([head.slice(0, -1), row("CB2026-005-00112", "Initial Inspection", "Official Notice", "08:30 AM", "").slice(0, -1)]);
  assert.deepEqual(old.errors, []);
  assert.ok(!old.notes.some((n) => /Record Category/.test(n)));
  assert.equal(old.cases[0].rows[0].recordCategory, "");
  console.log(
    "PASS R36 import: Scheduled/Assist discarded, Inspection Time authoritati" +
      "ve, no Accela-document warning, Snow Removal builds the 10.28 citation d" +
      "raft",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
