/* R62 (owner, Development 3): import rule table with the No Fee statuses, rows that never appear among candidates,
   and other type/status pairs listed greyed with their reason. Synthetic data. */
globalThis.MADISON_TEST_DATA = true;
require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  // 1. The rule table, including the new No Fee statuses.
  const table = [
    ["Initial Inspection", "Official Notice", "notice"],
    ["Initial Inspection", "Citation", "notice"],
    ["Initial Inspection", "No Occupancy", "noOccupancy"],
    ["Initial Inspection", "Abatement Summary", "summaryAbatement"],
    ["Initial Inspection", "Abatement Non-Summary", "nonSummaryAbatement"],
    ["Initial Inspection", "Abatement Non Summary", "nonSummaryAbatement"],
    ["Reinspection", "CA Referral", "referral"],
    ["Reinspection", "City Attorney Referral", "referral"],
    ["Reinspection", "Compliance", "compliance"],
    ["Reinspection", "Citation", "citation"],
    ["Reinspection", "No Occupancy", "noOccupancy"],
    ["Reinspection", "No Fee No Occupancy", "noOccupancy"],
    ["Reinspection", " no fee  no occupancy ", "noOccupancy"],
    ["CA Reinspection", "Compliance", "compliance"],
    ["CA Reinspection", "Non Compliance", "referralUpdate"],
    ["CA Reinspection", "Non-Compliance", "referralUpdate"],
  ];
  for (const [type, status, kind] of table) {
    const r = statusRule(type, status);
    assert.equal(r.error, undefined, type + "/" + status);
    assert.equal(r.doc, kind, type + "/" + status);
  }
  for (const status of ["Extension Processing", "No Fee Extension Processing", " no fee  extension processing "])
    assert.deepEqual(statusRule("Reinspection", status).choose, ["extension", "bestInterestExtension", "vacancyExtension"], status);

  // 2. Hidden rows never appear, for every inspection type; the report explains what it returned.
  const head = ["Case Number", "Inspector Name", "Site Address", "Parcel Number", "Owner Name", "Owner Address",
    "Inspection Type", "Inspection Date", "Inspection Status", "Inspection Time"];
  const row = (type, status, date = "2026-09-10") =>
    ["CB2026-262-00001", INSPECTORS[0].name, "100 TEST ST", "070822219101", "TEST OWNER", "100 TEST ST, MADISON, WI 53703", type, date, status, "09:00 AM"];
  const hiddenStatuses = ["Scheduled", "Pending", "Completed", "Inspection", "No Violation", "Reinspection", "No Fee Reinspection", " no  fee reinspection "];
  for (const type of ["Initial Inspection", "Reinspection", "CA Reinspection", "Complaint Inspection"])
    for (const status of hiddenStatuses) {
      const t = accelaTable([head, row(type, status)]);
      assert.equal(t.cases.length, 0, type + "/" + status + " hidden");
      assert.match(t.errors[0], /^No eligible completed inspection: the report returned only /, type + "/" + status);
    }
  assert.match(accelaTable([head, row("Reinspection", "Scheduled")]).errors[0], /Scheduled rows/);
  assert.match(accelaTable([head, row("Reinspection", "No Violation")]).errors[0], /status is not an inspection result/);
  assert.match(accelaTable([head, row("Assist", "Official Notice")]).errors[0], /Assist rows/);
  assert.match(accelaTable([head, row("Initial Inspection", "No Entry")]).errors[0], /Initial Inspection rows with status No Entry/);
  assert.match(accelaTable([head, row("Initial Inspection", "Official Notice", "")]).errors[0], /rows without an inspection date/);
  const mixed = accelaTable([head, row("Reinspection", "Scheduled"), row("Assist", "Citation"), row("Initial Inspection", "No Entry")]);
  assert.match(mixed.errors[0], /Scheduled rows .*, Initial Inspection rows with status No Entry and Assist rows\\./, mixed.errors[0]);

  // 3. Other pairs are listed but not selectable, greyed with their reason; hidden rows are absent.
  WriterState.CASES = []; WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {};
  const acc = accelaTable([
    head,
    row("Initial Inspection", "Official Notice", "2026-09-10"),
    row("Reinspection", "No Entry", "2026-09-11"),
    row("Initial Inspection", "Compliance", "2026-09-12"),
    row("Initial Inspection", "No Entry", "2026-09-13"),
    row("Reinspection", "Pending", "2026-09-14"),
    row("Reinspection", "Official Notice", ""),
  ]);
  assert.equal(acc.cases[0].rows.length, 3, "three listed rows; the Initial No Entry, Pending and undated rows are hidden");
  acc.sel = acc.cases[0].sel;
  WriterState.state = { ...WriterState.state, screen: "import", acc };
  const p = accelaPlan(acc);
  assert.equal(acc.sel, acc.cases[0].rows.find((x) => x.status === "Official Notice").i, "the one eligible row is selected");
  assert.deepEqual(p.blockers.filter((b) => /Reinspection|Compliance/.test(b)), []);
  const box = document.createElement("div");
  box.innerHTML = accelaPanel();
  const greyed = [...box.querySelectorAll(".import-unavailable")];
  assert.equal(greyed.length, 2, "two greyed rows");
  assert.ok(greyed.every((g) => g.getAttribute("aria-disabled") === "true" && !g.matches("button") && !g.querySelector("button")));
  assert.match(greyed.map((g) => g.textContent).join("|"), /Reinspection status "No Entry" has no document rule/);
  assert.match(greyed.map((g) => g.textContent).join("|"), /Initial Inspection status "Compliance" has no document rule/);
  assert.match(box.querySelector(".import-unavailable-list h3").textContent, /Not available for import/);
  const shownStatuses = [...box.querySelectorAll('[data-import-field="Status"] strong')].map((x) => x.textContent);
  assert.deepEqual(shownStatuses.sort(), ["Compliance", "No Entry", "Official Notice"], "hidden rows are not shown");
  const listed = acc.cases[0].rows.find((x) => x.status === "No Entry").i;
  assert.equal(selectImportInspection(listed), false, "a greyed row cannot be selected");

  // 4. A No Fee Extension Processing reinspection offers the extension chooser.
  assert.equal(accStatusEligible("No Fee Extension Processing", "Reinspection"), true);
  assert.equal(accStatusEligible("No Fee No Occupancy", "Reinspection"), true);
  assert.equal(accStatusEligible("No Fee No Occupancy", "Initial Inspection"), false, "No Fee No Occupancy is a Reinspection status");

  // 5. On an existing case, hiding the used initial inspection leaves one result, which becomes the selection.
  WriterState.CASES = []; WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {};
  WriterState.CASEDIR = null;
  const first = accelaTable([head, row("Initial Inspection", "Official Notice", "2026-09-10")]);
  first.sel = first.cases[0].sel;
  WriterState.state = { ...WriterState.state, screen: "import", acc: first };
  acceptAccela();
  const notice = WriterState.DOCS[0];
  notice.items = [{ id: "r62-item", no: "1", sections: ["27.05(2)(c)"], text: "Repair the wall.", title: "Wall", due: addDays(iso(today), 21), prov: "notice" }];
  issueDocument(notice);
  const later = accelaTable([head, row("Initial Inspection", "Official Notice", "2026-09-10"), row("Reinspection", "Citation", "2026-09-20")]);
  later.sel = later.cases[0].sel;
  assert.equal(later.sel, null, "two eligible rows in the report: no default");
  WriterState.state = { ...WriterState.state, screen: "import", acc: later };
  const plan = accelaPlan(later);
  assert.equal(plan.candidates.length, 1, "the used initial inspection is hidden");
  assert.equal(plan.row?.date, "2026-09-20", "the one remaining result is selected");
  console.log("PASS R62 import rules: No Fee statuses, hidden rows and messages, greyed unavailable pairs, single remaining result");
`);
