/* Exact HTML snapshots from the pre-extraction renderer, including queue/empty/filter/error states. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  acorn = require("acorn"),
  fc = require("fast-check");
(async () => {
  const dir = path.resolve("app/modules");
  let source = fs.readFileSync(path.join(dir, "workspace_screen.js"), "utf8");
  const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }),
    factory = ast.body.find((n) => n.declaration?.id.name === "createWorkspaceScreen").declaration,
    ret = factory.body.body.at(-1);
  const reference = require("../fixtures/workspace_screen_reference.cjs").replace("function screenCases(", "function referenceScreenCases(");
  source = source.slice(0, ret.start) + reference + "\n" + source.slice(ret.start).replace("screenCases }", "screenCases,referenceScreenCases }");
  source += '\nexport {WriterState} from "./state.js";export {esc} from "./presentation_format.js";';
  const compiled = await esbuild.build({
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
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { createWorkspaceScreen, WriterState: s, esc } = box.exports;
  let flags = {},
    calls = [];
  const context = () => ({
    recordIntegrity: { status: (k) => ({ valid: !flags.invalid, label: "Verified <&>", eventId: "event<&", lastGoodCommitTime: "2026-10-27" }) },
    esc,
    caseNumberAllowed: () => true,
    docsFor: (cid) => s.DOCS.filter((d) => d.caseId === cid),
    snow: { isCase: () => false },
    PREFLIGHT_CONFLICT: null,
    CASEDIR: null,
    NEEDGRANT: false,
    pdfTransferState: () => "verified",
    ARTIFACT_LOCATIONS: {},
  });
  const methods = {
    caseState: (k) => {
      const current = s.DOCS.find((d) => d.caseId === k.id);
      return {
        current,
        restrictions: [],
        label: "Open <&>",
        closed: flags.closed,
        draft: flags.draft ? current : null,
        visit: flags.visit ? { id: "r", sourceDocId: current.id, caseId: k.id, draft: true, results: {} } : null,
        due: "2026-11-01",
        late: flags.late,
        soon: flags.soon,
        days: flags.days,
      };
    },
    workspaceTasks: (rows) => [
      { key: "imports", count: flags.importing ? 1 : 0, items: [] },
      { key: flags.task, count: rows.length, items: rows.map(({ k }) => ({ cid: k.id, label: "Task <&>", action: 'data-open="d0"' })) },
    ],
    app_workspacequeueContext: context,
    caseSearchText: (k) => (k.number + " " + k.address).toLowerCase(),
    saveWorkflowPrefs: () => {},
    remindersPanel: () => "<p>Reminders</p>",
    recoveryStatusHTML: () => "<p>Recovery</p>",
    shell: (title, crumb, actions, body) => body,
  };
  const services = new Proxy(methods, {
    get(target, key) {
      calls.push(key);
      return target[key];
    },
  });
  const api = createWorkspaceScreen(services);
  function reset() {
    Object.assign(s, {
      state: {
        screen: "cases",
        caseFilter: flags.filter,
        caseQ: flags.query,
        caseInspector: "",
        metric: flags.metric,
        issuedCase: "c0",
        acc: flags.importing ? { cases: [{ number: "TEST-IMPORT", address: "Import <&>" }], caseIx: 0 } : null,
      },
      CASES: Array.from({ length: flags.count }, (_, i) => ({
        id: "c" + i,
        number: "CB2026-100-0000" + i,
        address: "100 TEST <&> ST",
        owner: "SYNTHETIC <&>",
        date: "2026-10-20",
        inspectorId: "i4",
      })),
      DOCS: Array.from({ length: flags.count }, (_, i) => ({
        id: "d" + i,
        caseId: "c" + i,
        type: "notice",
        mailed: "2026-10-27",
        items: [{ id: "i", no: 1 }],
        draft: flags.draft,
        void: flags.void,
        revision: flags.revision ? { number: 2 } : null,
      })),
      REINSP: [],
      EVENTS: {},
      WORK: { entry: {}, recordForms: {} },
      PENDING: flags.orphan ? [{ cid: "missing", name: "missing.json" }] : [],
      PREFLIGHT_NOTICE: flags.invalid ? "Needs review <&>" : "",
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
    const expected = run(api.referenceScreenCases),
      actual = run(api.screenCases);
    assert.deepEqual(actual, expected, JSON.stringify(flags));
    assert.equal(typeof actual.html, "string", "each snapshot must render, not merely match an error");
    checked++;
  }
  const defaults = {
    count: 1,
    invalid: false,
    closed: false,
    draft: false,
    visit: false,
    late: false,
    soon: false,
    days: 2,
    task: "open",
    filter: "all",
    query: "",
    metric: "",
    orphan: false,
    importing: false,
    void: false,
    revision: false,
  };
  for (const filter of ["all", "attention", "continue", "deadlines", "resolution", "soon", "overdue", "open", "closed", "drafts", "unknown"])
    for (const count of [0, 1, 3]) compare({ ...defaults, filter, count });
  fc.assert(
    fc.property(
      fc.record({
        count: fc.integer({ min: 0, max: 3 }),
        invalid: fc.boolean(),
        closed: fc.boolean(),
        draft: fc.boolean(),
        visit: fc.boolean(),
        late: fc.boolean(),
        soon: fc.boolean(),
        days: fc.integer({ min: 0, max: 8 }),
        task: fc.constantFrom("open", "drafts", "pending", "filing", "deposit", "outbox", "artifacts"),
        filter: fc.constantFrom("all", "attention", "continue", "deadlines", "resolution", "soon", "overdue", "closed"),
        query: fc.constantFrom("", "test", "missing"),
        metric: fc.constantFrom("", "drafts", "open", "old"),
        orphan: fc.boolean(),
        importing: fc.boolean(),
        void: fc.boolean(),
        revision: fc.boolean(),
      }),
      compare,
    ),
    { seed: 20261027, numRuns: 1000 },
  );
  console.log("PASS exact Workspace HTML snapshots", checked, "queue/filter/proof/draft/deadline/empty states");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
