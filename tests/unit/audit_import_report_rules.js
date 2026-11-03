/* Accela report reading against the retained module: constants, type/status rules, value readers, report-table
   parsing, compared over seeded values and report grids. Spreadsheet ZIP/XML reading was retired in R69. */
const { retainedAccelaImport } = require("../fixtures/retained_accela_import.cjs");
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");

async function compile(contents) {
  const build = await esbuild.build({
    stdin: {
      contents: contents + '\nexport {WriterState} from "./state.js"; export {INSPECTORS} from "./data/inspectors.js";',
      resolveDir: path.resolve("app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", build.outputFiles[0].text)(box, box.exports);
  return box.exports;
}

let seed = 20261105;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

const TYPES = [
  "Initial Inspection",
  "Reinspection",
  "CA Reinspection",
  "CA Re-inspection",
  "Re-inspection",
  "Assist",
  "Other",
  "",
  " reinspection ",
  "INITIAL  INSPECTION",
];
const STATUSES = [
  "Official Notice",
  "Citation",
  "No Occupancy",
  "Abatement Summary",
  "Abatement Non-Summary",
  "Abatement non summary",
  "CA Referral",
  "City Attorney Referral",
  "Compliance",
  "Extension Processing",
  "No Fee Extension Processing",
  "No Fee No Occupancy",
  "Non Compliance",
  "Non-Compliance",
  "Scheduled",
  "Pending",
  "Completed",
  "Inspection",
  "No Violation",
  "Reinspection",
  "No Fee Reinspection",
  "No Entry",
  "constructor",
  "__proto__",
  "toString",
  "",
  "Citation–x",
  "non – compliance",
];
const NAMES = ["Robert Ales", "robert  ales", "Nobody Here", "", "constructor"];
const stat = () => pick([...STATUSES, ...STATUSES.map((s) => " " + s.toUpperCase() + " ")]);

function cellValue() {
  return pick([
    undefined,
    null,
    "",
    "  x  ",
    "a\r\nb",
    0,
    0.5,
    0.999999,
    46203.4513888889,
    46203,
    -1,
    NaN,
    Infinity,
    "2026-09-10",
    "2026-09-10T10:50",
    "9/10/2026",
    "bad",
    "10:50AM",
    "8:05 AM",
    "13:45",
    true,
    "081034111097",
    "0810-341-1109-7",
    "12345",
    { toString: () => "obj" },
  ]);
}

function grid() {
  const keys = [
    "Case Number",
    "Inspector Name",
    "Site Address",
    "Zoning District",
    "Historic District",
    "Landmark",
    "Parcel Number",
    "Case Description",
    "Detailed Description",
    "Owner Name",
    "Owner Address",
    "Inspection Type",
    "Inspection Date",
    "Inspection Status",
    "Inspection Time",
    "Case Type",
    "Record Category",
  ];
  let head = keys.filter(() => !chance(14));
  if (chance(4)) head = ["x", "y"];
  if (chance(4)) head = head.filter((h) => h !== pick(keys));
  head = head.map((h) => (chance(6) ? " " + h.toUpperCase() + " " : h));
  if (chance(8)) head.push("Surprise Column");
  if (chance(5)) head.splice(random(head.length), 0, pick(["Case Type Name", "CaseType", "casetypename"]));
  head.sort(() => (chance(4) ? 1 : -1) * (random(3) - 1));
  const index = (name) => head.findIndex((h) => String(h).trim().toLowerCase() === name.toLowerCase());
  const rows = Array.from({ length: random(8) }, () => {
    const row = head.map(() => cellValue());
    const set = (name, v) => {
      const i = index(name);
      if (i >= 0) row[i] = v;
    };
    set("Case Number", pick(["CB2026-1", "CB2026-1", "CB2026-2", "constructor", "", undefined]));
    set("Inspector Name", pick(NAMES));
    set("Inspection Type", pick(TYPES));
    set("Inspection Status", stat());
    set("Inspection Date", pick([46203.45, 46210.5, 46210.99999, 46225, "2026-09-10", "", undefined, "bad"]));
    set("Inspection Time", pick(["10:50AM", 0.4, "", undefined, "25:99", 0.999999]));
    set("Owner Name", pick(["Carr", "Carr", "Other"]));
    set("Site Address", pick(["1 Main", "1 Main", "2 Main"]));
    return row;
  });
  const lead = Array.from({ length: random(3) }, () => [cellValue()]);
  const all = [...lead, head, ...rows];
  if (chance(10)) all.splice(random(all.length + 1), 0, pick([null, undefined]));
  return all;
}

const show = (value) =>
  JSON.stringify(value, (_, v) => (v === undefined ? "<undefined>" : typeof v === "number" && !Number.isFinite(v) ? "<" + v + ">" : v));

async function attempt(fn) {
  try {
    return { value: await fn() };
  } catch (e) {
    return { error: [e.name, e.message] };
  }
}

async function battery(api) {
  const out = [];
  const owner = api.createAccelaImport(new Proxy({}, { get: (_, k) => assert.fail("pure surface used a peer: " + String(k)) }));
  // The spreadsheet file import was removed (owner-approved, R69); the retained original still carries it.
  const REMOVED = new Set([
    "ACC_MAX",
    "ACC_EXPANDED_MAX",
    "accXml",
    "accAll",
    "accKids",
    "accText",
    "accColIx",
    "accInflate",
    "readXlsx",
    "readAccelaFile",
    "pickAccelaFile",
  ]);
  out.push(Object.keys(owner).filter((k) => !REMOVED.has(k)));
  for (const key of ["ACC_COLS", "ACC_REQUIRED", "ACC_CASEFIELDS", "SQL_COLUMNS"]) out.push(owner[key]);
  out.push(Object.keys(owner.ACC_COLS).map(owner.ACC_LABEL));
  seed = 7777;
  for (let n = 0; n < 4000; n++) {
    const type = pick(TYPES),
      status = stat();
    out.push([
      owner.inspectionKind(type),
      owner.statusRule(type, status),
      owner.hiddenImportRow(type, status),
      owner.accStatusEligible(status, type),
    ]);
  }
  for (let n = 0; n < 3000; n++) {
    const v = cellValue(),
      w = cellValue();
    out.push([
      owner.accStr(v),
      owner.accNorm(v),
      owner.accTime(v),
      owner.accSerial(v),
      owner.accWhen(v, w),
      owner.accParcel(v),
      owner.accHM(pick([0, 59, 60, 725, 1439])),
      owner.accInspector(pick(NAMES)),
    ]);
  }
  const sqlRow = (number) => ({
    CaseNumber: pick([number, number, number.toLowerCase(), "CB2026-9", undefined]),
    InspectionType: pick(["Initial Inspection", "Reinspection", ...TYPES]),
    InspectionStatus: pick(["Official Notice", "Citation", "Compliance", stat()]),
    InspectionDate: pick(["2026-09-10T00:00:00", "2026-09-10T10:00:00", "2026-09-11", "", undefined]),
    InspectionTime: pick(["10:50AM", "", undefined]),
    InspectorName: pick(NAMES),
    SiteAddress: "1 Main",
    OwnerName: "Carr",
    OwnerAddress: "1 Main",
    Landmark: pick(["", "Name"]),
    IndividualLandmark: pick(["Yes", "No", ""]),
    HistoricDistrict: pick(["Yes", "No", ""]),
    HistoricDistrictName: pick(["", "District"]),
  });
  for (let n = 0; n < 1500; n++) {
    const number = pick(["CB2026-1", "CB2026-2"]);
    const good = {
      rows: Array.from({ length: 1 + random(3) }, () => ({
        ...sqlRow(number),
        ...(chance(4) ? {} : { IndividualLandmark: "No", HistoricDistrict: "No", CaseNumber: number }),
      })),
      caseNumber: number,
      source: { kind: "sql", at: "t" },
    };
    const result = chance(3) ? pick([null, {}, { rows: [] }, { ...good, caseNumber: "x" }, { ...good, source: { kind: "file" } }]) : good;
    out.push(await attempt(() => owner.sqlReport(result, number)));
  }
  for (let n = 0; n < 1500; n++) {
    const rule = pick([{ doc: "notice" }, { doc: "citation", cite: true }, { choose: ["extension"], label: "x" }, { doc: "referral" }]);
    const target = pick([
      {},
      { results: {} },
      { results: {}, type: "notice" },
      { initialAction: true, type: "citation" },
      { initialAction: false },
      { selectionCache: { citation: { a: 1 } } },
      { items: [{ cite: true }], cits: { x: 1 } },
    ]);
    const copy = structuredClone(target);
    const result = await attempt(() => owner.applyImportRule(copy, rule));
    out.push([result, copy]);
  }
  for (let n = 0; n < 200; n++) {
    Object.assign(api.WriterState, {
      LOOKUP_BUSY: chance(2),
      LOOKUP_ERROR: pick(["", "bad <b>", undefined]),
      LOOKUP_SERIAL: random(5),
      LOOKUP_CONTROLLER: chance(2) ? { abort: () => out.push("aborted") } : null,
      WORK: { entry: pick([{}, { "lookup-number": 'CB<"1' }]) },
      state: { acc: pick([null, {}]) },
    });
    out.push(owner.lookupCard());
    owner.cancelCaseLookup();
    out.push([api.WriterState.LOOKUP_BUSY, api.WriterState.LOOKUP_SERIAL, api.WriterState.LOOKUP_CONTROLLER]);
  }
  for (let n = 0; n < 2500; n++) out.push(owner.accelaTable(grid()));
  return out.map(show);
}

async function compareGridLoaders() {
  const { createReportGridLoader } = require("../fixtures/report_grid_loader.cjs");
  const retained =
    'async function loadGrid(b, name) {\n      WriterState.state.screen = "import";\n      cancelCaseLookup();\n      const t = accelaTable(b.grid);\n      WriterState.state.acc = {\n        fileName: name || "",\n        errors: t.errors,\n        notes: t.notes,\n        cases: t.cases,\n        caseIx: 0,\n        sel: t.cases.length ? t.cases[0].sel : null,\n        manualDate: "",\n        manualTime: "",\n      };\n      await accelaFromShare();\n      return WriterState.state.acc;\n    }';
  async function run(create, failure, empty, replace) {
    const writer = { state: { screen: "cases", acc: "before" } },
      calls = [];
    const cancel = () => {
      calls.push(["cancel", writer.state.screen]);
      if (failure === "cancel") throw new Error("cancel");
    };
    const table = (grid) => {
      calls.push(["table", grid]);
      if (failure === "table") throw new Error("table");
      return { cases: empty ? [] : [{ sel: "selected" }], errors: [], notes: ["note"] };
    };
    const share = async () => {
      calls.push(["share", structuredClone(writer.state.acc)]);
      await Promise.resolve();
      if (replace) writer.state = { screen: "other", acc: "replacement" };
      if (failure === "share") throw new Error("share");
    };
    const load = create(writer, cancel, table, share);
    const outcome = await attempt(() => load({ grid: [["case"]] }, "fixture"));
    return JSON.stringify({ outcome, state: writer.state, calls });
  }
  const before = (writer, cancel, table, share) =>
    new Function("WriterState", "cancelCaseLookup", "accelaTable", "accelaFromShare", retained + ";return loadGrid;")(writer, cancel, table, share);
  const after = (writer, cancel, table, share) =>
    createReportGridLoader({ getState: () => writer.state, cancelLookup: cancel, readTable: table, readShare: share });
  for (const failure of ["", "cancel", "table", "share"])
    for (const empty of [false, true])
      for (const replace of [false, true]) {
        assert.equal(
          await run(after, failure, empty, replace),
          await run(before, failure, empty, replace),
          "shared grid loader preserves original order, partial effects, errors and live state",
        );
      }
}

(async () => {
  await compareGridLoaders();
  const [current, legacy] = await Promise.all([compile('export {createAccelaImport} from "./accela_import.js";'), compile(retainedAccelaImport())]);
  const [before, after] = [await battery(legacy), await battery(current)];
  assert.equal(after.length, before.length);
  for (let n = 0; n < before.length; n++) assert.equal(after[n], before[n], `report reading result ${n} differs from the retained module`);
  // The generator must keep reaching every outcome family, or the comparison would silently weaken.
  const text = before.join("\n");
  for (const fragment of [
    "No Accela report table was found",
    "is missing the column",
    "is not part of the Accela report",
    "has no document rule",
    "Scheduled rows",
    "Assist rows",
    "rows without an inspection date",
    '"conflicts":[{',
    "not 12 digits",
    "Unexpected case response",
    "Several completed inspections",
    "Find Case Inspections",
    "aborted",
  ])
    assert.ok(text.includes(fragment), "scenarios reach: " + fragment);
  console.log("PASS report reading matches the retained module over " + before.length + " comparisons");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
