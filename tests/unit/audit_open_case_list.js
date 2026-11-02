/* Open cases by inspector on Import inspection: search filter, escaped markup, screen states and the owner that talks
   to the helper. No helper or database is contacted; helperJSON is a substitute. */
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");

async function load() {
  const built = await esbuild.build({
    stdin: {
      contents:
        'export * from "./app/modules/open_case_list.js"; export {WriterState} from "./app/modules/state.js"; export {editorState} from "./app/modules/editor_state.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  return box.exports;
}

const row = (number, extra = {}) => ({
  caseNumber: number,
  address: "101 TEST ST",
  parcel: "070822219105",
  owner: "SYNTHETIC OWNER",
  category: "Building Code",
  description: "Roof and gutters",
  status: "Open",
  dateOpened: "2026-09-30",
  latest: { type: "Initial Inspection", status: "Violations Found", date: "2026-10-01", scheduled: "" },
  ...extra,
});

(async () => {
  const m = await load();
  const { WriterState, editorState, openList } = m;
  WriterState.state = { screen: "import", acc: null };
  WriterState.WORK = { entry: {} };
  WriterState.LOOKUP_BUSY = false;
  WriterState.LOOKUP_ERROR = "";

  // Search: every term must appear in the case number, address, owner, parcel, description, status or latest inspection.
  const cases = [
    row("CB2026-241-00001"),
    row("CB2026-241-00002", {
      address: "22 OAK AVE",
      owner: "OTHER OWNER",
      description: "Porch rail",
      latest: { type: "", status: "", date: "", scheduled: "2026-11-10" },
    }),
  ];
  assert.equal(m.filterOpenCases(cases, "").length, 2);
  assert.deepEqual(
    m.filterOpenCases(cases, "oak").map((c) => c.caseNumber),
    ["CB2026-241-00002"],
  );
  assert.deepEqual(
    m.filterOpenCases(cases, "  ROOF   gutters ").map((c) => c.caseNumber),
    ["CB2026-241-00001"],
  );
  assert.deepEqual(
    m.filterOpenCases(cases, "violations found").map((c) => c.caseNumber),
    ["CB2026-241-00001"],
  );
  assert.deepEqual(m.filterOpenCases(cases, "roof porch"), []);
  assert.deepEqual(m.filterOpenCases(cases, "070822219105").length, 2);

  // Rows escape every value, show the latest inspection and offer Import unless something is running.
  const nasty = row("CB2026-241-00003", { address: '<img src=x onerror="alert(1)">', description: "<script>x</script>" });
  const markup = m.openCaseRowsHTML({ cases: [nasty, cases[1]], query: "" }, false);
  assert.ok(!markup.includes("<img") && !markup.includes("<script"), "values are escaped");
  assert.match(markup, /data-open-case-pick="CB2026-241-00003"/);
  assert.match(markup, /Latest inspection: Initial Inspection · Violations Found · 10\/01\/2026/);
  assert.match(markup, /Latest inspection: No inspection result yet/);
  assert.ok(!/disabled/.test(markup));
  assert.match(m.openCaseRowsHTML({ cases: [nasty], query: "" }, true), /disabled/);
  assert.match(m.openCaseRowsHTML({ cases: [nasty], query: "zzz" }, false), /No open case matches this search/);
  assert.match(m.openCaseRowsHTML({ cases: [], query: "" }, false), /has no open cases/);

  // Counts name the inspector and the load time.
  const loaded = { inspectors: [{ id: "JSMITH", name: "Jordan Smith", openCases: 2 }], cases, casesFor: "JSMITH", loadedAt: "2:14 PM", query: "" };
  assert.equal(m.openCaseCountText(loaded), "2 open cases for Jordan Smith. Loaded 2:14 PM.");
  assert.equal(m.openCaseCountText({ ...loaded, query: "oak" }), "1 of 2 open cases for Jordan Smith. Loaded 2:14 PM.");

  // Card states.
  const card = (state) => m.openCaseCardHTML(state);
  assert.match(card({ inspectors: null, loading: true }), /Loading inspectors/);
  assert.match(card({ inspectors: null, error: "No permission." }), /No permission\..*open-cases-retry/s);
  assert.match(card({ inspectors: [], loading: false, error: "" }), /No inspector has open cases/);
  const picker = card({ ...loaded, selected: "JSMITH" });
  assert.match(picker, /<option value="JSMITH" selected>Jordan Smith \(2\)<\/option>/);
  assert.match(picker, /id="open-cases-search"/);
  assert.match(picker, /id="open-cases-refresh"/);
  assert.ok(!/disabled/.test(picker.replace(/<button[^>]*type="submit"[^>]*>/, "")), "nothing is disabled while idle");
  editorState.acc = { cases: [{}] };
  WriterState.state.acc = { cases: [{}] };
  assert.match(card(loaded), /An import is waiting for review below/);
  assert.match(card(loaded), /data-open-case-pick="CB2026-241-00001"[^>]*disabled/);
  WriterState.state.acc = null;
  WriterState.LOOKUP_BUSY = true;
  assert.match(card(loaded), /data-open-case-pick="CB2026-241-00001"[^>]*disabled/);
  WriterState.LOOKUP_BUSY = false;

  // The owner: load once, show cases, ignore stale answers, report errors, and pick through the existing lookup.
  const calls = [];
  let renders = 0,
    found = 0;
  const gate = {};
  const services = {
    helperJSON: async (url, body) => {
      calls.push([url, body]);
      if (url === "/inspector-cases/list") return { inspectors: [{ id: "JSMITH", name: "Jordan Smith", openCases: 2 }] };
      if (body.inspector === "BAD") throw new Error("Your Windows account cannot read the case database.");
      if (body.inspector === "SLOW") await new Promise((resolve) => (gate.release = resolve));
      return { cases: body.inspector === "SLOW" ? [row("CB-SLOW-1")] : cases };
    },
    render: () => renders++,
    findDatabaseCase: async () => found++,
  };
  global.document = { getElementById: () => null };
  const owner = m.createOpenCaseList(services);
  owner.ensure();
  owner.ensure();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(calls.filter((c) => c[0] === "/inspector-cases/list").length, 1, "the list loads once");
  assert.equal(openList.inspectors.length, 1);
  await owner.showCases("JSMITH");
  assert.deepEqual(calls.at(-1), ["/inspector-cases/cases", { inspector: "JSMITH" }]);
  assert.equal(openList.cases.length, 2);
  assert.equal(openList.casesFor, "JSMITH");
  assert.ok(openList.loadedAt);
  await owner.showCases("BAD");
  assert.equal(openList.casesError, "Your Windows account cannot read the case database.");
  assert.equal(openList.cases.length, 2, "an error keeps the earlier list");
  owner.search("oak");
  assert.equal(openList.query, "oak");
  await owner.pick("CB2026-241-00002");
  assert.equal(WriterState.WORK.entry["lookup-number"], "CB2026-241-00002");
  assert.equal(found, 1, "picking runs the existing lookup");
  WriterState.state.acc = { cases: [{}] };
  await owner.pick("CB2026-241-00001");
  assert.equal(found, 1, "a pending import blocks picking");
  assert.equal(WriterState.WORK.entry["lookup-number"], "CB2026-241-00002");
  WriterState.state.acc = null;
  // A newer request supersedes a slower earlier one.
  const slow = owner.showCases("SLOW");
  await new Promise((resolve) => setTimeout(resolve, 5));
  openList.casesLoading = false;
  await owner.showCases("JSMITH");
  gate.release();
  await slow;
  assert.equal(openList.casesFor, "JSMITH", "the stale answer is ignored");
  assert.ok(renders > 0);
  console.log("PASS open case list");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
