/* Import decisions retain selection mutation, exact messages and service-call precedence. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  acorn = require("acorn"),
  fc = require("fast-check");
(async () => {
  const dir = path.resolve("app/modules");
  let source = fs.readFileSync(path.join(dir, "accela_import.js"), "utf8");
  const tree = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }),
    factory = tree.body.find((n) => n.declaration?.id.name === "createAccelaImport").declaration,
    ret = factory.body.body.at(-1);
  const reference = require("../fixtures/import_plan_reference.cjs").replace("function baseLookupPlan(", "function referenceLookupPlan(");
  source = source.slice(0, ret.start) + reference + "\n" + source.slice(ret.start).replace("baseLookupPlan,", "baseLookupPlan,referenceLookupPlan,");
  source += '\nexport {WriterState} from "./state.js";export {INSPECTORS} from "./data/inspectors.js";';
  const built = await esbuild.build({
    stdin: { contents: source, resolveDir: dir },
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
  new Function("today", "module", "exports", built.outputFiles[0].text)(new Date("2026-10-27T12:00:00Z"), box, box.exports);
  const { createAccelaImport, WriterState: s, INSPECTORS } = box.exports;
  let calls = [],
    flags = {},
    src = null;
  const services = {
    get snow() {
      calls.push("snow-adapter");
      return {
        isCase: (k) => {
          calls.push(["snow-case", k?.id]);
          return flags.snow;
        },
        matchesImport: (r) => {
          calls.push(["snow-row", r?.i]);
          return false;
        },
        is: (d) => {
          calls.push(["snow-doc", d?.id]);
          return flags.snow;
        },
      };
    },
    sourceDocFor: (id) => {
      calls.push(["source", id]);
      return src;
    },
    unissuedVisitFor: (id) => {
      calls.push(["unfinished", id]);
      return null;
    },
    caseState: (k) => {
      calls.push(["status", k.id]);
      return { closed: flags.closed };
    },
    fmtDate: (v) => {
      calls.push(["date", v]);
      return String(v || "");
    },
    fmtTime: (v) => {
      calls.push(["time", v]);
      return String(v || "");
    },
  };
  const api = createAccelaImport(services),
    number = "CB2026-100-00001";
  s.DOCS = [];
  s.REINSP = [];
  s.EVENTS = {};
  s.CASES = [];
  s.WORK = {};
  let checked = 0;
  function outcome(fn, acc) {
    try {
      return { value: fn(acc) };
    } catch (error) {
      return { error: { name: error.name, message: error.message } };
    }
  }
  function compare(acc) {
    const before = structuredClone(acc),
      after = structuredClone(acc);
    s.ACC_SELECTION_SERIAL = 0;
    calls = [];
    const expected = outcome(api.referenceLookupPlan, before),
      trace = JSON.stringify(calls),
      serial = s.ACC_SELECTION_SERIAL;
    s.ACC_SELECTION_SERIAL = 0;
    calls = [];
    assert.deepEqual(outcome(api.baseLookupPlan, after), expected, JSON.stringify(acc));
    assert.deepEqual(after, before, "selection/plan mutation");
    assert.equal(s.ACC_SELECTION_SERIAL, serial, "selection serial");
    assert.equal(JSON.stringify(calls), trace, "service lookup/call order");
    checked++;
  }
  compare(null);
  compare({ errors: ["Report error"], notes: [] });
  compare({ cases: [], notes: [] });
  const row = {
    CaseNumber: number,
    SiteAddress: "100 TEST ST, MADISON WI 53703",
    ParcelNumber: "070913125237",
    OwnerName: "SYNTHETIC OWNER",
    OwnerAddress: "100 TEST ST\nMADISON WI 53703",
    CaseDescription: "Complaint",
    HistoricDistrict: "No",
    IndividualLandmark: "No",
    InspectionDate: "2026-10-20",
    InspectionType: "Initial Inspection",
    InspectionStatus: "Official Notice",
    InspectionTime: "09:05",
    InspectorName: INSPECTORS[0].name,
  };
  const rowSpec = fc.record({
    type: fc.constantFrom("Initial Inspection", "Reinspection", "CA Reinspection", "Other"),
    status: fc.constantFrom("Official Notice", "Citation", "Extension Processing", "CA Referral", "Compliance", "Unknown", ""),
    date: fc.constantFrom("2026-10-20", "2026-10-25", "2027-01-01", ""),
    time: fc.constantFrom("09:05", "14:30", ""),
    inspector: fc.constantFrom(INSPECTORS[0].name, "Unknown inspector", ""),
  });
  fc.assert(
    fc.property(
      fc.array(rowSpec, { minLength: 1, maxLength: 4 }),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.integer({ min: 0, max: 4 }),
      (specs, existing, snow, closed, sel) => {
        flags = { snow, closed };
        const k = {
          id: "c",
          number,
          address: "100 TEST ST",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["100 TEST ST", "MADISON WI 53703"],
          date: "2026-10-20",
          time: "09:05",
          inspectorId: INSPECTORS[0].id,
        };
        s.CASES = existing ? [k] : [];
        src = existing ? { id: "issued", caseId: "c", type: "notice", draft: false, date: "2026-10-20", items: [], frozen: { case: k } } : null;
        s.DOCS = src ? [src] : [];
        const rows = specs.map((x) => ({
          ...row,
          InspectionType: x.type,
          InspectionStatus: x.status,
          InspectionDate: x.date,
          InspectionTime: x.time,
          InspectorName: x.inspector,
        }));
        const acc = api.sqlReport(
          { ok: true, rows: [row, ...rows], caseNumber: number, source: { kind: "sql", retrievedAt: "2026-10-27T12:00:00Z" } },
          number,
        );
        acc.sel = sel;
        compare(acc);
      },
    ),
    { seed: 20261027, numRuns: 3000 },
  );
  console.log("PASS import-plan equivalence", checked, "cases: full plans, selections and effect order");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
