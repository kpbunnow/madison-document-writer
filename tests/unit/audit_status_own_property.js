/* Import rules and the report's case grouping read only their own entries: a status or case number spelled like an
   inherited object property ("constructor", "__proto__") is ordinary text, never a document rule or an existing case.
   Covers every supported inspection type and both import paths (uploaded report and SQL lookup). Synthetic data. */
globalThis.MADISON_TEST_DATA = true;
require("../fixtures/bundle_test.cjs")(`
  saveDrafts = async () => true; scheduleDraftSave = () => {};
  const types = ["Initial Inspection", "Reinspection", "CA Reinspection"];
  const inherited = ["constructor", "__proto__", "Constructor", "__PROTO__", " constructor "];

  // 1. The rule table refuses inherited names for every supported inspection type.
  for (const type of types)
    for (const status of inherited) {
      const rule = statusRule(type, status);
      assert.equal(rule.error, type + ' status "' + status.trim() + '" has no document rule', type + "/" + status);
      assert.equal(rule.doc, undefined, type + "/" + status);
      assert.equal(rule.choose, undefined, type + "/" + status);
      assert.equal(accStatusEligible(status, type), false, type + "/" + status);
    }
  // Supported statuses are unchanged.
  assert.equal(statusRule("Initial Inspection", "Official Notice").doc, "notice");
  assert.equal(statusRule("CA Reinspection", "Non-Compliance").doc, "referralUpdate");

  const head = ["Case Number", "Inspector Name", "Site Address", "Parcel Number", "Owner Name", "Owner Address",
    "Inspection Type", "Inspection Date", "Inspection Status", "Inspection Time"];
  const row = (number, type, status, date = "2026-09-10") =>
    [number, INSPECTORS[0].name, "100 TEST ST", "070822219101", "TEST OWNER", "100 TEST ST, MADISON, WI 53703", type, date, status, "09:00 AM"];
  const fresh = (acc) => {
    WriterState.CASES = []; WriterState.DOCS = []; WriterState.REINSP = []; WriterState.EVENTS = {};
    WriterState.state = { ...WriterState.state, screen: "import", acc };
  };

  // 2. Uploaded report: the row is listed but not selectable, nothing is auto-selected and the plan is blocked.
  for (const type of types)
    for (const status of ["constructor", "__proto__"]) {
      const acc = accelaTable([head, row("CB2026-262-00001", type, status)]);
      assert.deepEqual(acc.errors, [], type + "/" + status);
      const listed = acc.cases[0].rows[0];
      assert.equal(listed.selectable, false, type + "/" + status + " not selectable");
      assert.equal(listed.why, type + ' status "' + status + '" has no document rule');
      assert.equal(acc.cases[0].sel, null, type + "/" + status + " not auto-selected");
      acc.sel = acc.cases[0].sel;
      fresh(acc);
      const plan = accelaPlan(acc);
      assert.equal(plan.row, null, type + "/" + status);
      assert.ok(plan.blockers.some((b) => /^No eligible inspection result is available: .*has no document rule/.test(b)), plan.blockers.join(" | "));
      assert.equal(selectImportInspection(listed.i), false, type + "/" + status + " cannot be selected");
    }
  // Alongside a valid result, the valid one is still the selection.
  const mixed = accelaTable([head, row("CB2026-262-00001", "Initial Inspection", "Official Notice"), row("CB2026-262-00001", "Reinspection", "constructor", "2026-09-20")]);
  assert.equal(mixed.cases[0].rows.length, 2);
  assert.equal(mixed.cases[0].rows[mixed.cases[0].sel].status, "Official Notice");

  // 3. SQL lookup: the same rows reach the same rules.
  const number = "CB2026-262-00002";
  const sqlRow = (type, status) => ({
    CaseNumber: number, SiteAddress: "102 TEST ST, MADISON WI 53703", ParcelNumber: "070913125237", OwnerName: "TEST OWNER",
    OwnerAddress: "102 TEST ST\\nMADISON WI 53703", CaseDescription: "Complaint", HistoricDistrict: "No", IndividualLandmark: "No",
    InspectionDate: "2026-09-18T00:00:00", InspectionType: type, InspectionStatus: status, InspectionTime: "09:05:00",
    InspectorName: INSPECTORS[0].name,
  });
  const sql = (rows) => sqlReport({ ok: true, rows, caseNumber: number, source: { kind: "sql", retrievedAt: "2026-09-26T12:00:00Z" } }, number);
  for (const type of types)
    for (const status of ["constructor", "__proto__"]) {
      const acc = sql([sqlRow(type, status)]);
      assert.equal(acc.cases[0].rows[0].selectable, false, "SQL " + type + "/" + status);
      assert.equal(acc.sel, null, "SQL " + type + "/" + status + " not auto-selected");
      fresh(acc);
      const plan = accelaPlan(acc);
      assert.equal(plan.row, null, "SQL " + type + "/" + status);
      assert.ok(plan.blockers.some((b) => /has no document rule/.test(b)), plan.blockers.join(" | "));
    }
  assert.equal(sql([sqlRow("Initial Inspection", "Official Notice")]).sel, 0, "a valid SQL result is still selected");

  // 4. Case numbers are grouped by their own text: an inherited name starts its own case instead of failing the import.
  for (const name of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
    const acc = accelaTable([head, row(name, "Initial Inspection", "Official Notice"), row(name, "Reinspection", "Citation", "2026-09-20")]);
    assert.deepEqual(acc.errors, [], name);
    assert.equal(acc.cases.length, 1, name + " is one case");
    assert.equal(acc.cases[0].number, name);
    assert.equal(acc.cases[0].rows.length, 2, name + " keeps both rows");
    assert.equal(acc.cases[0].raw.address, "100 TEST ST", name);
  }
  const two = accelaTable([head, row("CB2026-262-00003", "Initial Inspection", "Official Notice"), row("constructor", "Initial Inspection", "Official Notice")]);
  assert.deepEqual(two.cases.map((c) => c.number), ["CB2026-262-00003", "constructor"], "report order is kept");
  console.log("PASS inherited-property statuses and case numbers are ordinary text on both import paths");
`);
