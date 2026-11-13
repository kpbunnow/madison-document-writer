const { withHistoricalBindings } = require("../fixtures/historical_module_scope.cjs");
/* Owner-approved workspace layout contracts across the retained 1,033 generated state variants.
 * The immutable pre-redesign renderer remains provenance; domain/action parity has separate audits. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  fc = require("fast-check");
(async () => {
  const dir = path.resolve("app/modules");
  let source = fs.readFileSync(path.join(dir, "workspace_screen.js"), "utf8");
  source += '\nexport {WriterState} from "./state.js";export {esc} from "./presentation_format.js";';
  const compiled = await esbuild.build({
    stdin: { contents: withHistoricalBindings(source, ["WriterState", "esc"]), resolveDir: dir },
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

    openCasesCard: () => '<section id="open-cases">Open cases</section>',
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
    const actual = run(api.screenCases);
    assert.equal(typeof actual.html, "string", JSON.stringify({ flags, error: actual.error }));
    const { JSDOM } = require("jsdom");
    const document = new JSDOM(actual.html).window.document;
    const rows = [...document.querySelectorAll("[data-queue-case]")];
    assert.equal(rows.length, flags.count, "legacy preferences cannot hide loaded cases");
    assert.equal(document.querySelector("#case-search,#case-filter,#case-inspector,[data-queue-view],.queue-view-note"), null);
    assert.equal(document.querySelector('[data-nav="import"]').textContent.trim(), "Import inspection");
    // Owner direction 2026-11-13: Open cases by inspector leads Workspace, followed by Start case work.
    const lead = document.querySelector("#open-cases"),
      start = document.querySelector(".workspace-start");
    assert.ok(lead && start && lead.compareDocumentPosition(start) & 4, "Open cases by inspector precedes Start case work");
    assert.equal(document.querySelectorAll("#open-cases").length, 1);
    assert.equal(s.state.metric, "");
    assert.equal(s.state.caseQ, flags.query, "render does not rewrite retained preferences");
    assert.equal(s.state.caseFilter, flags.filter);
    assert.equal(s.state.issuedCase, "c0");
    for (const row of rows) {
      assert.equal(row.querySelectorAll(".queue-primary").length, 1);
      assert.equal(row.querySelectorAll("td").length, 5);
      assert.equal(row.querySelector(".addr").textContent, "100 TEST <&> ST");
      assert.equal(row.querySelector(".case-number").textContent, s.CASES.find((k) => k.id === row.dataset.queueCase).number);
      assert.ok(row.querySelector("details [data-rmcase]"));
      assert.ok(row.querySelector("details [data-timeline]"));
      assert.equal(row.querySelector("[data-case-documents],[data-case-pdf]"), null);
      assert.ok(row.querySelector('[data-open="d' + row.dataset.queueCase.slice(1) + '"]'));
      assert.equal(row.querySelector(".case-options summary").textContent.startsWith("Case options"), true);
      if (flags.invalid) assert.ok(row.textContent.includes("Record verification: Verified <&>"));
      if (flags.closed) assert.ok(row.textContent.includes("Closed"));
      if (flags.visit) {
        assert.ok(row.querySelector("details [data-discardri]"));
        assert.ok(row.textContent.includes("Reinspection draft"));
        assert.ok(row.textContent.includes("0 corrected, 1 still to result"));
      }
      if (flags.draft && !flags.visit) assert.ok(row.querySelector("details [data-discard]"));
      if (!flags.closed && flags.late) assert.ok(row.textContent.includes("Past due"));
      assert.equal(row.querySelectorAll("script").length, 0);
    }
    assert.equal(actual.html.includes("outside the loaded cases"), flags.orphan);
    assert.ok(actual.html.includes("Recovery") && actual.html.includes("Reminders"));
    assert.equal(!!document.querySelector("#btn-clear"), flags.count > 0);
    assert.equal(actual.html.includes("No cases in this workspace"), flags.count === 0);
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
  console.log("PASS Workspace redesigned HTML contracts", checked, "queue/filter/proof/draft/deadline/empty states");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
