/* R53 WP1: the imported Inspection Type and Inspection Status decide the document (division rules, 2026-10-19). */
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
  // 1. Rule matrix, synonyms and spacing variants; unlisted statuses and types have no rule.
  const expect = [
    ["Initial Inspection", "Official Notice", "notice", false],
    ["Initial Inspection", "Citation", "notice", true],
    ["Initial Inspection", "No Occupancy", "noOccupancy", false],
    ["Initial Inspection", "Abatement Summary", "summaryAbatement", false],
    ["Initial Inspection", "Abatement Non-Summary", "nonSummaryAbatement", false],
    ["initial inspection", "  abatement non - summary ", "nonSummaryAbatement", false],
    ["Reinspection", "CA Referral", "referral", false],
    ["Re-inspection", "City Attorney Referral", "referral", false],
    ["Reinspection", "Compliance", "compliance", false],
    ["Reinspection", "Citation", "citation", true],
    ["Reinspection", "No Occupancy", "noOccupancy", false],
    ["CA Reinspection", "Compliance", "compliance", false],
    ["CA Reinspection", "Non Compliance", "referralUpdate", false],
    ["CA Reinspection", "Non-Compliance", "referralUpdate", false],
  ];
  for (const [type, status, doc, cite] of expect) {
    const r = statusRule(type, status);
    assert.equal(r.error, undefined, type + "/" + status);
    assert.equal(r.doc, doc, type + "/" + status);
    assert.equal(!!r.cite, cite, type + "/" + status);
  }
  assert.deepEqual(statusRule("Reinspection", "Extension Processing").choose, ["extension", "bestInterestExtension", "vacancyExtension"]);
  for (const [type, status] of [
    ["Initial Inspection", "Completed"],
    ["Reinspection", "Completed"],
    ["Initial Inspection", "Compliance"],
    ["Reinspection", "Official Notice"],
    ["CA Reinspection", "Citation"],
    ["Initial Inspection", "Pending"],
  ])
    assert.match(statusRule(type, status).error, /has no document rule/, type + "/" + status);
  assert.match(statusRule("Complaint Inspection", "Official Notice").error, /Inspection type "Complaint Inspection" has no document rule/);
  assert.equal(statusRule("Initial Inspection", "Completed").kind, "initial");

  // Report grid helpers.
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
  const row = (num, type, status, category = "", date = day, time = "09:00 AM") => [
    num,
    inspector,
    "100 TEST ST",
    "070822219101",
    "TEST OWNER",
    "100 TEST ST, MADISON, WI 53703",
    type,
    date,
    status,
    time,
    "Property Maintenance",
    category,
  ];
  const reset = () => {
    WriterState.DOCS = [];
    WriterState.EVENTS = {};
    WriterState.REINSP = [];
    WriterState.PENDING = [];
    WriterState.CASES = [];
    WriterState.WORK.entry = {};
    WriterState.state.acc = null;
  };
  const plan = (rows) => {
    const acc = accelaTable([head, ...rows]);
    acc.sel = acc.cases[0]?.rows.find((r) => r.selectable)?.i ?? null;
    WriterState.state.acc = acc;
    return { acc, p: accelaPlan(acc) };
  };

  // 2. "Completed" is not importable. R62 (owner, Development 3): it is hidden, and the report explains why.
  reset();
  let { p } = plan([row("CB2026-100-00001", "Initial Inspection", "Completed")]);
  assert.ok(
    p.blockers.some((b) => /status is not an inspection result \(such as Pending, Completed or No Violation\)/.test(b)),
    JSON.stringify(p.blockers),
  );

  // 3. Initial statuses create the matching draft with the rule recorded.
  for (const [status, type, initialAction] of [
    ["Official Notice", "notice", false],
    ["Citation", "notice", false],
    ["No Occupancy", "noOccupancy", true],
    ["Abatement Summary", "summaryAbatement", true],
    ["Abatement Non-Summary", "nonSummaryAbatement", true],
  ]) {
    reset();
    ({ p } = plan([row("CB2026-100-00002", "Initial Inspection", status)]));
    assert.deepEqual(p.blockers, [], status);
    acceptAccela();
    const d = doc(WriterState.state.docId);
    assert.equal(d.type, type, status);
    assert.equal(!!d.initialAction, initialAction, status);
    assert.equal(d.importRule.status, status);
  }

  // 4. Initial Citation needs a cited item; Official Notice allows none.
  reset();
  plan([row("CB2026-100-00003", "Initial Inspection", "Citation")]);
  acceptAccela();
  let d = doc(WriterState.state.docId);
  const ci = LIBRARY.findIndex((x) => x.code === "ENF_PM_PROPMAINT"),
    gi = LIBRARY[ci].groups.findIndex((g) => g.code === "OTHER");
  toggleLibraryItem(d, ci, gi, LIBRARY[ci].groups[gi].items[0]);
  assert.ok(blockers(d).some((b) => /Accela status is Citation, but no item is marked for citation/.test(b.t)));
  d.items[0].cite = true;
  assert.ok(!blockers(d).some((b) => /Accela status/.test(b.t)));
  reset();
  plan([row("CB2026-100-00004", "Initial Inspection", "Official Notice")]);
  acceptAccela();
  d = doc(WriterState.state.docId);
  toggleLibraryItem(d, ci, gi, LIBRARY[ci].groups[gi].items[0]);
  d.items[0].cite = true;
  assert.ok(blockers(d).some((b) => /Accela status is Official Notice, so no item can be cited/.test(b.t)));

  // 5. An Initial Inspection cannot import into an existing case (snow included); a reinspection needs a case.
  // R62: on a case that already has its notice, an Initial Inspection counts as used and is hidden.
  const usedHidden = /already been used to generate a document/;
  reset();
  plan([row("CB2026-100-00005", "Initial Inspection", "Official Notice")]);
  acceptAccela();
  ({ p } = plan([row("CB2026-100-00005", "Initial Inspection", "Official Notice", "", day, "10:00 AM")]));
  assert.ok(p.candidates.length === 0 && p.blockers.some((b) => usedHidden.test(b)), JSON.stringify(p.blockers));
  reset();
  ({ p } = plan([row("CB2026-100-00006", "Reinspection", "Citation")]));
  assert.ok(
    p.blockers.some((b) => /No case exists for this inspection/.test(b)),
    JSON.stringify(p.blockers),
  );
  reset();
  ({ p } = plan([row("CB2026-100-00007", "Initial Inspection", "Citation", "Snow Removal")]));
  assert.deepEqual(p.blockers, []);
  assert.equal(p.next, "snow");
  acceptAccela();
  ({ p } = plan([row("CB2026-100-00007", "Initial Inspection", "Citation", "Snow Removal", day, "11:00 AM")]));
  assert.ok(
    p.blockers.some((b) => /An Initial Inspection result can only start a new case/.test(b)),
    "snow initial into existing case: " + JSON.stringify(p.blockers),
  );
  reset();
  ({ p } = plan([row("CB2026-100-00008", "Initial Inspection", "No Occupancy", "Snow Removal")]));
  assert.ok(
    p.blockers.some((b) => /Snow removal inspections are imported with status Citation/.test(b)),
    JSON.stringify(p.blockers),
  );

  // 6. Refresh from Accela: the same unissued initial inspection updates the stored status.
  reset();
  plan([row("CB2026-100-00009", "Initial Inspection", "Official Notice")]);
  acceptAccela();
  const first = doc(WriterState.state.docId);
  ({ p } = plan([row("CB2026-100-00009", "Initial Inspection", "No Occupancy")]));
  assert.ok(p.refresh, "refresh target found");
  assert.deepEqual(p.blockers, []);
  acceptAccela();
  assert.equal(doc(first.id).importRule.status, "No Occupancy");
  assert.equal(doc(first.id).type, "noOccupancy");

  console.log(
    "PASS R53 status-driven documents: rule matrix, Completed refused, initial documents, citation checks, case-existence and snow rules, refresh",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
