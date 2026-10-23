/* R59: inspection candidates show four labelled facts, selection is a highlighted pressed state, any listed eligible
   candidate can be chosen, and validation always follows the current selection. R62: inspections already used on
   the case are hidden and cannot be selected. Synthetic data. */
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage());
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
  idbSet = async () => true;
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  const toasts = [];
  toast = (message) => toasts.push(message);
  let count = 0;
  const ok = (name, value, detail = "") => {
    assert.ok(value, name + (detail ? " " + detail : ""));
    count++;
    console.log("PASS " + name);
  };
  const paint = () => {
    document.getElementById("app").innerHTML = WriterState.state.screen === "import" && WriterState.state.acc ? accelaPanel() : "";
  };
  render = paint;
  renderKeep = paint;
  WriterState.CASES = [];
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  WriterState.CASEDIR = null;
  WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
  WriterState.state = { ...WriterState.state, screen: "import", acc: null, modal: null };
  const number = "CB2026-259-09001",
    initial = "2026-09-10",
    used = "2026-09-15",
    blank = "2026-09-17",
    unused = "2026-09-18";
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
  const reinspection = (date, time, extra = {}) => ({
    ...row,
    InspectionType: "Reinspection",
    InspectionStatus: "Extension Processing",
    InspectionDate: date,
    InspectionTime: time,
    ...extra,
  });
  const make = (rows) => sqlReport({ ok: true, rows, caseNumber: number, source: { kind: "sql", retrievedAt: new Date().toISOString() } }, number);
  const accept = () => {
    LOOKUP_READY.add(WriterState.state.acc);
    try {
      return acceptAccela();
    } finally {
      if (WriterState.state.acc) LOOKUP_READY.delete(WriterState.state.acc);
    }
  };
  // An issued notice and an issued extension written from an imported reinspection.
  WriterState.state.acc = make([row]);
  accept();
  const k = WriterState.CASES[0],
    n = WriterState.DOCS[0];
  n.items = [
    { id: "r59-item", no: "1", sections: ["27.05(2)(c)"], text: "Repair the wall.", title: "Wall", due: addDays(iso(today), 21), prov: "notice" },
  ];
  issueDocument(n);
  WriterState.state.screen = "import";
  WriterState.state.acc = make([reinspection(used, "14:30")]);
  accept();
  const r = reinsp(WriterState.state.reinspId);
  r.results["r59-item"] = { oc: "none", on: used, due: addDays(iso(today), 30), note: "", cite: false };
  docFromReinspection(r, "extension");
  const ext = doc(WriterState.state.docId);
  issueDocument(ext);
  r.draft = false;
  r.docId = ext.id;
  const issued = () =>
    JSON.stringify([WriterState.DOCS.map((d) => [d.id, d.draft]), WriterState.REINSP.map((x) => [x.id, x.draft]), WriterState.EVENTS]);
  const baseline = issued();

  // Four eligible results of this case: the issued initial, the used reinspection, one with blanks and an unused one.
  // R62 (owner, Development 3): the two already-used results are hidden; the other two are offered.
  WriterState.state.screen = "import";
  const acc = make([row, reinspection(used, "14:30"), reinspection(blank, "", { InspectorName: "" }), reinspection(unused, "10:00")]);
  WriterState.state.acc = acc;
  const index = (date) => acc.cases[0].rows.find((x) => x.date === date).i;
  ok("Several eligible candidates have no default selection", acc.sel === null);
  paint();
  const buttons = () => [...document.querySelectorAll("[data-accsel]")];
  ok(
    "Every unused eligible candidate is offered; used results are hidden",
    buttons().length === 2 &&
      !document.querySelector('[data-accsel="' + index(used) + '"]') &&
      !document.querySelector('[data-accsel="' + index(initial) + '"]') &&
      !document.getElementById("app").textContent.includes(fmtDate(used)),
  );
  const labels = ["Inspection type", "Date", "Inspector", "Status"];
  ok(
    "Each candidate shows the four labelled facts",
    buttons().every((b) => stableJSON([...b.querySelectorAll("[data-import-field]")].map((f) => f.dataset.importField)) === stableJSON(labels)) &&
      buttons().every((b) => labels.every((l) => b.textContent.includes(l + ": "))),
  );
  const facts = (b) =>
    Object.fromEntries([...b.querySelectorAll("[data-import-field]")].map((f) => [f.dataset.importField, f.querySelector("strong").textContent]));
  const unusedFacts = facts(document.querySelector('[data-accsel="' + index(unused) + '"]')),
    blankFacts = facts(document.querySelector('[data-accsel="' + index(blank) + '"]'));
  ok(
    "Facts carry the type, date with time, inspector and status",
    unusedFacts["Inspection type"] === "Reinspection" &&
      unusedFacts.Date === fmtDate(unused) + " at " + fmtTime("10:00") &&
      unusedFacts.Inspector === INSPECTORS[0].name &&
      unusedFacts.Status === "Extension Processing",
    JSON.stringify(unusedFacts),
  );
  ok(
    "Blank values keep the not-supplied wording",
    blankFacts.Inspector === "not supplied" && blankFacts.Date === fmtDate(blank) + " · time not supplied",
    JSON.stringify(blankFacts),
  );
  ok(
    "No candidate shows the words Select inspection or Selected",
    !document.getElementById("app").textContent.includes("Select inspection") && buttons().every((b) => !/\bSelected\b/.test(b.textContent)),
  );
  ok(
    "Candidates are keyboard-operable toggle buttons, none pressed yet",
    buttons().every(
      (b) =>
        b.tagName === "BUTTON" &&
        b.type === "button" &&
        !b.disabled &&
        b.getAttribute("aria-pressed") === "false" &&
        !b.classList.contains("is-selected"),
    ),
  );
  ok("A hidden used result cannot be selected", !selectImportInspection(index(used)) && acc.sel === null);
  // A stale selection of a result that is now used (the shared record arrived later) is cleared.
  acc.sel = index(used);
  ok("A selection that became hidden is cleared", !accelaPlan(acc).row && acc.sel === null);

  // Selecting the candidate with blanks shows why it cannot be imported.
  const serial = WriterState.ACC_SELECTION_SERIAL;
  document.querySelector('[data-accsel="' + index(blank) + '"]').click();
  let pressed = document.querySelector('[data-accsel="' + index(blank) + '"]');
  ok("A listed candidate can be selected", acc.sel === index(blank) && WriterState.ACC_SELECTION_SERIAL === serial + 1);
  ok(
    "Selection is shown by the highlight and pressed state only",
    pressed.classList.contains("is-selected") &&
      pressed.getAttribute("aria-pressed") === "true" &&
      buttons().filter((b) => b.getAttribute("aria-pressed") === "true").length === 1 &&
      !/\bSelected\b/.test(pressed.textContent),
  );
  const banner = document.getElementById("acc-blockers");
  ok(
    "The blank candidate shows its blocker, described by the selected candidate",
    banner && banner.textContent.length > 0 && pressed.getAttribute("aria-describedby") === "acc-blockers",
  );
  ok("Import is disabled for the blank candidate", document.getElementById("acc-go").disabled);
  helperJSON = async () => ({ files: [] });
  WriterState.CASEDIR = { helper: true };
  await confirmDatabaseCase();
  ok("Confirming the blank candidate is refused and changes nothing", issued() === baseline && WriterState.state.acc === acc);

  // Rapid change: blank then unused — validation follows the latest selection.
  document.querySelector('[data-accsel="' + index(unused) + '"]').click();
  ok(
    "Validation follows the newly selected candidate",
    acc.sel === index(unused) && !accelaPlan(acc).blockers.length,
    JSON.stringify(accelaPlan(acc).blockers),
  );
  ok(
    "Only the new candidate is highlighted",
    document.querySelector('[data-accsel="' + index(unused) + '"]').getAttribute("aria-pressed") === "true" &&
      document.querySelector('[data-accsel="' + index(blank) + '"]').getAttribute("aria-pressed") === "false" &&
      !document.querySelector('[data-accsel="' + index(blank) + '"]').classList.contains("is-selected"),
  );
  ok("A row that is not an eligible candidate of this case cannot be selected", !selectImportInspection(99) && acc.sel === index(unused));

  // An in-flight shared check for an earlier selection is ignored.
  let release;
  helperJSON = () => new Promise((resolve) => (release = () => resolve({ files: [] })));
  const pending = confirmDatabaseCase();
  ok("The shared check is in flight for the unused candidate", WriterState.LOOKUP_BUSY && typeof release === "function");
  selectImportInspection(index(blank));
  release();
  await pending;
  ok(
    "A result for the earlier selection never imports the new one",
    issued() === baseline && WriterState.state.acc === acc && acc.sel === index(blank),
  );
  ok(
    "The person is told the selection changed",
    toasts.some((t) => /selected inspection changed/.test(t)),
  );
  ok("The current (blank) selection still shows its blocker", accelaPlan(acc).blockers.length && document.getElementById("acc-go").disabled);
  release = null;
  helperJSON = () => new Promise((resolve) => (release = () => resolve({ files: [] })));
  const second = confirmDatabaseCase();
  selectImportInspection(index(unused));
  release();
  await second;
  ok("A check started for the blank candidate does not confirm the unused one", issued() === baseline && WriterState.state.acc === acc);

  // Confirming the current, unused selection imports exactly that inspection.
  helperJSON = async () => ({ files: [] });
  await confirmDatabaseCase();
  const opened = reinsp(WriterState.state.reinspId);
  ok(
    "Confirming the current selection imports that inspection",
    WriterState.state.acc === null && opened && opened.id !== r.id && opened.date === unused && opened.importInspection.date === unused,
  );
  console.log(count + " R59 import selection assertions passed.");
  process.exit(0);
};
eval(payload + "\n(" + tests.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
