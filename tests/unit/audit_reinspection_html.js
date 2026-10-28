const { withHistoricalState } = require("../fixtures/historical_module_scope.cjs");
/* Exact worksheet snapshots protect outcomes, walkthrough stages, filters and retained/closed work. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  acorn = require("acorn"),
  fc = require("fast-check");
(async () => {
  const dir = path.resolve("app/modules");
  let source = fs.readFileSync(path.join(dir, "reinspection.js"), "utf8");
  const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }),
    factory = ast.body.find((n) => n.declaration?.id.name === "createReinspection").declaration,
    ret = factory.body.body.at(-1);
  const reference = require("../fixtures/reinspection_screen_reference.cjs").replace(
    "function screenReinspect(",
    "function referenceScreenReinspect(",
  );
  source =
    source.slice(0, ret.start) +
    "const referenceScreenReinspect = ((services) => (" +
    reference +
    "))(historicalServices);\n" +
    source.slice(ret.start).replace("screenReinspect,", "screenReinspect,referenceScreenReinspect,");
  source = source.replace("export function createReinspection(services)", "export function createReinspection(services, historicalServices)");
  source +=
    '\nexport {WriterState} from "./state.js";export {validISO,parseTime} from "./calendar.js";export {INSPECTORS} from "./data/inspectors.js";';
  const compiled = await esbuild.build({
    stdin: { contents: withHistoricalState(source), resolveDir: dir },
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
  new Function("today", "module", "exports", compiled.outputFiles[0].text)(new Date("2026-10-27T12:00:00Z"), box, box.exports);
  const { createReinspection, WriterState: s, validISO, parseTime, INSPECTORS } = box.exports;
  let flags = {},
    calls = [];
  const methods = {
    screenCases: () => "<h1>Cases</h1>",
    fmtDate: (v) => String(v || ""),
    validISO,
    parseTime,
    MINDUE: () => "2026-10-28",
    inspAt: () => ({ date: "2026-10-20", time: "09:00" }),
    dueContext: (r) => s.DOCS[0].items.map((i) => ({ ...i, due: r.results[i.id]?.due || i.due })),
    dueDateSpacingConflicts: () => [],
    worksheetFaults: () => (flags.extra ? ["Additional <&> check"] : []),
    duePanel: () => "<p>Due panel</p>",
    newDocuments: { chooser: () => "<p>Permitted documents</p>" },
    shell: (title, crumb, actions, body) => body,
  };
  const historicalServices = new Proxy(methods, {
    get(target, key) {
      calls.push(key);
      return target[key];
    },
  });
  const api = createReinspection({ ui: historicalServices, inspection: historicalServices, authoring: historicalServices }, historicalServices);
  function reset() {
    const kase = { id: "c", address: "100 TEST <&> ST", number: "CB2026-100-00001", date: "2026-10-20" };
    const items = flags.items.map((spec, i) => ({
      id: "i" + i,
      no: String(i + 1),
      title: "Wall <&>",
      text: "Repair <&> ◯",
      sections: ["27.05(2)(c)"],
      due: "2026-10-01",
      done: spec.carried && spec.oc === "corrected",
      withdrawn: spec.carried && spec.oc === "withdrawn",
    }));
    const src = {
      id: "src",
      caseId: "c",
      type: flags.referred ? "referral" : "notice",
      draft: false,
      items,
      mailed: "2026-10-20",
      frozen: { case: kase },
    };
    const r = {
      id: "r",
      caseId: "c",
      sourceDocId: flags.missingSource ? "missing" : "src",
      draft: !flags.readOnly,
      date: "2026-10-26",
      time: "10:00",
      inspectorId: INSPECTORS[0].id,
      followupIntent: flags.intent,
      importRule: flags.imported ? { cite: true, status: "Citation", label: "Citation" } : null,
      previousDraft: flags.previous ? { id: "previous" } : null,
      docId: flags.closed ? "followup" : null,
      results: Object.fromEntries(
        flags.items.map((spec, i) => [
          "i" + i,
          { oc: spec.oc, on: spec.date, due: spec.due, note: "Observation <&>", cite: spec.cite, carried: spec.carried },
        ]),
      ),
    };
    Object.assign(s, {
      CASES: [kase],
      DOCS: [src, ...(flags.closed ? [{ id: "followup", caseId: "c", type: "extension", draft: flags.draft, items, mailed: "2026-10-27" }] : [])],
      REINSP: [r],
      EVENTS: {},
      WORK: { walk: null },
      state: {
        screen: "reinspect",
        reinspId: flags.missing ? "missing" : "r",
        riFilter: flags.filter,
        riWalk: flags.walk,
        riWalkItem: flags.items.length ? "i0" : null,
        riWalkMode: flags.mode,
        riWalkStage: flags.stage,
        riWalkSkipped: flags.skipped ? ["i0"] : [],
        riWalkUndo: flags.undo ? { itemId: "i0" } : null,
      },
    });
  }
  let checked = 0;
  function run(fn) {
    reset();
    calls = [];
    try {
      return { html: fn(), state: JSON.stringify(s), calls: calls.slice() };
    } catch (error) {
      return { error: { name: error.name, message: error.message }, state: JSON.stringify(s), calls: calls.slice() };
    }
  }
  function compare(options) {
    flags = options;
    const expected = run(api.referenceScreenReinspect),
      actual = run(api.screenReinspect);
    assert.deepEqual(actual, expected, JSON.stringify(flags));
    assert.equal(typeof actual.html, "string", "each worksheet snapshot renders successfully");
    checked++;
  }
  const baseItem = { oc: "none", date: "2026-10-26", due: "2026-11-15", cite: false, carried: false },
    defaults = {
      items: [baseItem],
      closed: false,
      readOnly: false,
      referred: false,
      imported: false,
      previous: false,
      draft: false,
      missing: false,
      filter: "",
      walk: false,
      mode: "quick",
      stage: "outcome",
      skipped: false,
      undo: false,
      extra: false,
      intent: "extension",
    };
  for (const filter of ["", "open", "corrected", "todo"])
    for (const oc of ["", "none", "corrected", "progress", "noaccess", "withdrawn"]) compare({ ...defaults, filter, items: [{ ...baseItem, oc }] });
  compare({ ...defaults, missing: true });
  compare({ ...defaults, missingSource: true });
  const item = fc.record({
    oc: fc.constantFrom("", "none", "corrected", "progress", "noaccess", "withdrawn"),
    date: fc.constantFrom("", "2026-10-26", "bad"),
    due: fc.constantFrom("", "2026-10-27", "2026-10-29", "2026-11-15", "2027-12-01"),
    cite: fc.boolean(),
    carried: fc.boolean(),
  });
  fc.assert(
    fc.property(
      fc.record({
        items: fc.array(item, { maxLength: 4 }),
        closed: fc.boolean(),
        readOnly: fc.boolean(),
        referred: fc.boolean(),
        imported: fc.boolean(),
        previous: fc.boolean(),
        draft: fc.boolean(),
        missing: fc.boolean(),
        filter: fc.constantFrom("", "open", "corrected", "todo"),
        walk: fc.boolean(),
        mode: fc.constantFrom("quick", "details"),
        stage: fc.constantFrom("outcome", "details"),
        skipped: fc.boolean(),
        undo: fc.boolean(),
        extra: fc.boolean(),
        intent: fc.constantFrom("undecided", "extension", "bestInterestExtension", "vacancyExtension", "citation", "referral", "compliance"),
      }),
      compare,
    ),
    { seed: 20261027, numRuns: 1000 },
  );
  console.log("PASS exact reinspection HTML snapshots", checked, "outcome/walk/filter/retained/closed states");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
