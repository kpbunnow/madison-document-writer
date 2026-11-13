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
  description: "Roof and gutters",
  ...extra,
});

(async () => {
  const m = await load();
  const { WriterState, editorState, openList } = m;
  WriterState.state = { screen: "import", acc: null };
  WriterState.WORK = { entry: {} };
  WriterState.LOOKUP_BUSY = false;
  WriterState.LOOKUP_ERROR = "";

  // Search: every term must appear in the case number, address or description.
  const cases = [
    row("CB2026-241-00001"),
    row("CB2026-241-00002", {
      address: "22 OAK AVE",
      description: "Porch rail",
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
  assert.deepEqual(m.filterOpenCases(cases, "roof porch"), []);

  // Each case is its own bubble (the inspection-result style): case number and address on one line that never wraps, the
  // description below, every value escaped, no table, no Import button and no underlined link.
  const nasty = row("CB2026-241-00003", { address: '<img src=x onerror="alert(1)">', description: "<script>x</script>" });
  const markup = m.openCaseRowsHTML({ cases: [nasty, cases[1]], query: "" });
  assert.ok(!markup.includes("<img") && !markup.includes("<script"), "values are escaped");
  assert.ok(!/<table|<th |<td |underline|>Import</.test(markup), "no table, underlined link or Import button");
  assert.match(
    markup,
    /<button type="button" class="import-inspection open-case" data-open-case-pick="CB2026-241-00003" aria-pressed="false"><span class="open-case-main"><span class="open-case-nowrap"><strong>CB2026-241-00003<\/strong> · &lt;img[^<]*<\/span><span>&lt;script&gt;x&lt;\/script&gt;<\/span><\/span><span class="open-case-due"><\/span><\/button>/,
    "number and address on a no-wrap line, the description below, an empty due column when there is no due date",
  );
  // The due date is its own column on the right, shown as month/day/year with a Due label; anything else leaves it blank.
  const dated = m.openCaseRowsHTML({
    cases: [
      row("CB2026-241-00004", { dueDate: "2026-11-20" }),
      row("CB2026-241-00005", { dueDate: "soon" }),
      row("CB2026-241-00006", { dueDate: "" }),
    ],
    query: "",
  });
  assert.match(
    dated,
    /data-open-case-pick="CB2026-241-00004"[\s\S]*?<span class="open-case-due"><span class="open-case-due-label">Due<\/span><strong>11\/20\/2026<\/strong><\/span>/,
    "a due date is shown as 11/20/2026 under a Due label",
  );
  assert.equal((dated.match(/open-case-due-label/g) || []).length, 1, "only the case with a valid due date has one");
  assert.equal((dated.match(/<span class="open-case-due"><\/span>/g) || []).length, 2, "the others stay blank");
  assert.ok(dated.indexOf("CB2026-241-00004") < dated.indexOf("CB2026-241-00005"), "the list keeps the order the helper sent");
  // MCR-002: a due date the helper could not confirm reads "Not confirmed", never a blank that means "no order".
  const unconfirmed = m.openCaseRowsHTML({
    cases: [row("CB2026-241-00008", { dueDate: "", dueState: "unknown" }), row("CB2026-241-00009", { dueDate: "", dueState: "none" })],
    query: "",
  });
  assert.match(
    unconfirmed,
    /data-open-case-pick="CB2026-241-00008"[\s\S]*?<span class="open-case-due"><span class="open-case-due-label">Due<\/span><span>Not confirmed<\/span><\/span>/,
  );
  assert.match(unconfirmed, /data-open-case-pick="CB2026-241-00009"[\s\S]*?<span class="open-case-due"><\/span>/, "no order stays blank");
  assert.equal((markup.match(/data-open-case-pick=/g) || []).length, 2, "one bubble per case");
  assert.ok(!markup.includes(" style="), "styling belongs to the reviewed screen stylesheet");
  assert.ok(!/Latest inspection|Violations Found/.test(markup), "the latest inspection is not shown");
  assert.ok(!/disabled/.test(markup), "a bubble can always be selected");
  // The bubble of the case being looked up or reviewed is shown selected; none otherwise.
  const pickedState = { cases: [nasty, cases[1]], query: "", picked: "CB2026-241-00003" };
  assert.ok(!/is-selected/.test(m.openCaseRowsHTML(pickedState)), "no selection while nothing is running or waiting");
  WriterState.LOOKUP_BUSY = true;
  assert.match(
    m.openCaseRowsHTML(pickedState),
    /import-inspection open-case is-selected" data-open-case-pick="CB2026-241-00003" aria-pressed="true"/,
  );
  assert.equal((m.openCaseRowsHTML(pickedState).match(/is-selected/g) || []).length, 1, "only that case is selected");
  WriterState.LOOKUP_BUSY = false;
  assert.match(m.openCaseRowsHTML({ cases: [nasty], query: "zzz" }), /No open case matches this search/);
  assert.match(m.openCaseRowsHTML({ cases: [], query: "" }), /has no open cases/);

  // Counts name the inspector and the load time.
  const loaded = { inspectors: [{ id: "JSMITH", name: "Jordan Smith", openCases: 2 }], cases, casesFor: "JSMITH", loadedAt: "2:14 PM", query: "" };
  assert.equal(m.openCaseCountText(loaded), "2 open cases for Jordan Smith. Loaded 2:14 PM.");
  assert.equal(m.openCaseCountText({ ...loaded, query: "oak" }), "1 of 2 open cases for Jordan Smith. Loaded 2:14 PM.");
  assert.equal(
    m.openCaseCountText({ ...loaded, dueUnavailable: true }),
    "2 open cases for Jordan Smith. Loaded 2:14 PM. Due dates are not available right now.",
  );

  // Card states.
  const card = (state) => m.openCaseCardHTML(state);
  assert.match(card({ inspectors: null, loading: true }), /Loading inspectors/);
  assert.match(card({ inspectors: null, error: "No permission." }), /No permission\..*open-cases-retry/s);
  assert.match(
    card({ inspectors: [], loading: false, error: "" }),
    /No inspector has open cases.*open-cases-retry/s,
    "an empty list can be tried again",
  );
  const picker = card({ ...loaded, selected: "JSMITH" });
  assert.match(picker, /<option value="JSMITH" selected>Jordan Smith \(2\)<\/option>/);
  assert.match(picker, /id="open-cases-search"/);
  assert.match(picker, /id="open-cases-refresh"/);
  assert.ok(!/disabled/.test(picker.replace(/<button[^>]*type="submit"[^>]*>/, "")), "nothing is disabled while idle");
  editorState.acc = { cases: [{}] };
  WriterState.state.acc = { cases: [{}] };
  assert.ok(
    !/An import is waiting|disabled="/.test(card(loaded).replace(/<button[^>]*type="submit"[^>]*>/, "")),
    "a waiting import does not lock the list",
  );
  WriterState.state.acc = null;
  editorState.acc = null;

  // The owner: load once, show cases, ignore stale answers, report errors, and pick through the existing lookup.
  const calls = [];
  let renders = 0,
    found = 0,
    cancelled = 0;
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
    cancelCaseLookup: () => cancelled++,
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
  assert.equal(cancelled, 1, "a lookup still running is stopped first");
  assert.equal(openList.picked, "CB2026-241-00002");
  // Every new selection clears the previous case's inspections and runs its own lookup, even while one is waiting.
  WriterState.state.acc = { cases: [{ number: "CB2026-241-00002" }] };
  WriterState.WORK.acc = WriterState.state.acc;
  WriterState.LOOKUP_ERROR = "An earlier problem.";
  await owner.pick("CB2026-241-00001");
  assert.equal(found, 2, "a second selection looks up the new case");
  assert.equal(cancelled, 2);
  assert.equal(WriterState.state.acc, null, "the previous case's inspections are cleared");
  assert.equal(WriterState.WORK.acc, null);
  assert.equal(WriterState.LOOKUP_ERROR, "", "an earlier error is cleared");
  assert.equal(WriterState.WORK.entry["lookup-number"], "CB2026-241-00001");
  assert.equal(openList.picked, "CB2026-241-00001", "only the new case is selected");
  await owner.pick("CB2026-241-00001");
  assert.equal(found, 3, "selecting the same case again looks it up again");
  // A newer request supersedes a slower earlier one.
  const slow = owner.showCases("SLOW");
  await new Promise((resolve) => setTimeout(resolve, 5));
  openList.casesLoading = false;
  await owner.showCases("JSMITH");
  gate.release();
  await slow;
  assert.equal(openList.casesFor, "JSMITH", "the stale answer is ignored");
  assert.ok(renders > 0);
  // Refresh: both lists can be reloaded; the inspector list asks the helper for a fresh one, and a failed reload can be retried.
  const askedList = calls.filter((c) => c[0] === "/inspector-cases/list").length;
  await owner.refreshInspectors();
  assert.deepEqual(calls.filter((c) => c[0] === "/inspector-cases/list").at(-1), ["/inspector-cases/list", { refresh: true }]);
  assert.equal(calls.filter((c) => c[0] === "/inspector-cases/list").length, askedList + 1);
  // People shown by user ID get their full names from a second step that never delays the list.
  const named = [];
  const idsFirst = m.createOpenCaseList({
    ...services,
    helperJSON: async (url, body) => {
      named.push(url);
      if (url === "/inspector-cases/list")
        return {
          inspectors: [
            { id: "JQP", name: "JQP", openCases: 2 },
            { id: "ASMITH", name: "Alex Smith", openCases: 1 },
          ],
        };
      if (url === "/inspector-cases/names") return { names: [{ id: "JQP", name: "Jamie Q Public" }] };
      throw new Error("unexpected " + url + JSON.stringify(body));
    },
  });
  openList.inspectors = null;
  await idsFirst.loadInspectors();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(named, ["/inspector-cases/list", "/inspector-cases/names"]);
  assert.deepEqual(
    openList.inspectors.map((p) => p.name),
    ["Alex Smith", "Jamie Q Public"],
    "full name replaces the user ID and the list stays sorted by name",
  );
  // A late full-name exclusion removes the picker entry and invalidates an in-flight case answer.
  let finishNames, finishExcludedCases;
  const excluding = m.createOpenCaseList({
    ...services,
    helperJSON: (url) => {
      if (url.endsWith("/list")) return Promise.resolve({ inspectors: [{ id: "HID", name: "HID", openCases: 1 }] });
      return new Promise((resolve) => {
        if (url.endsWith("/names")) finishNames = resolve;
        else finishExcludedCases = resolve;
      });
    },
  });
  await excluding.loadInspectors();
  const excludedCases = excluding.showCases("HID");
  finishNames({ names: [], excluded: ["hid"] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(openList.inspectors, []);
  assert.equal(openList.selected, "");
  assert.equal(openList.cases, null);
  assert.equal(openList.casesLoading, false);
  finishExcludedCases({ cases });
  await excludedCases;
  assert.equal(openList.cases, null, "an answer for a newly excluded person cannot repopulate the list");
  // A name answer belonging to a previous inspector list cannot rename or remove its replacement.
  await excluding.loadInspectors();
  const staleNames = finishNames;
  await idsFirst.refreshInspectors();
  await new Promise((resolve) => setTimeout(resolve, 0));
  staleNames({ names: [{ id: "JQP", name: "Wrong old name" }], excluded: ["ASMITH"] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(
    openList.inspectors.map((p) => p.name),
    ["Alex Smith", "Jamie Q Public"],
  );
  const noNames = [];
  const allNamed = m.createOpenCaseList({
    ...services,
    helperJSON: async (url) => {
      noNames.push(url);
      return { inspectors: [{ id: "ASMITH", name: "Alex Smith", openCases: 1 }] };
    },
  });
  openList.inspectors = null;
  await allNamed.loadInspectors();
  assert.deepEqual(noNames, ["/inspector-cases/list"], "nobody is shown by user ID, so no second step");
  const failing = m.createOpenCaseList({
    ...services,
    helperJSON: async (url) => {
      if (url === "/inspector-cases/names") throw new Error("timed out");
      return { inspectors: [{ id: "JQP", name: "JQP", openCases: 2 }] };
    },
  });
  openList.inspectors = null;
  await failing.loadInspectors();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(openList.inspectors[0].name, "JQP", "a failed name step leaves the user ID in place");
  assert.equal(openList.error, "", "and is not shown as an error");
  // The helper says when due dates could not be read; the list then says so instead of looking like nothing is due.
  const dueState = (dueDates) =>
    m.createOpenCaseList({
      ...services,
      helperJSON: async () => ({
        cases: [row("CB2026-241-00007", dueDates === false ? {} : { dueDate: "2026-11-20" })],
        ...(dueDates === undefined ? {} : { dueDates }),
      }),
    });
  await dueState(false).showCases("JSMITH");
  assert.equal(openList.dueUnavailable, true, "dueDates false is reported");
  assert.match(
    m.openCaseCountText({ ...openList, inspectors: [{ id: "JSMITH", name: "Jordan Smith" }], casesFor: "JSMITH" }),
    /Due dates are not available right now\./,
  );
  await dueState(true).showCases("JSMITH");
  assert.equal(openList.dueUnavailable, false, "readable due dates clear the note");
  assert.equal(openList.cases[0].dueDate, "2026-11-20");
  // Different list types must not cancel each other's completion or strand their loading flags.
  let finishInspectors, finishCases;
  const overlapping = m.createOpenCaseList({
    ...services,
    helperJSON: (url) =>
      new Promise((resolve) => {
        if (url.endsWith("/list")) finishInspectors = resolve;
        else finishCases = resolve;
      }),
  });
  const people = overlapping.refreshInspectors();
  const assigned = overlapping.showCases("JSMITH");
  finishCases({ cases });
  await assigned;
  finishInspectors({ inspectors: [{ id: "JSMITH", name: "Jordan Smith", openCases: 2 }] });
  await people;
  assert.equal(openList.loading, false);
  assert.equal(openList.casesLoading, false);
  assert.equal(openList.casesFor, "JSMITH");
  assert.equal(openList.inspectors.length, 1);
  openList.selected = "JSMITH";
  const before = calls.length;
  await owner.refresh();
  assert.deepEqual(calls.at(-1), ["/inspector-cases/cases", { inspector: "JSMITH" }]);
  assert.equal(calls.length, before + 1, "Refresh open cases reloads only the cases");
  const idle = card({ ...loaded, selected: "" });
  assert.match(idle, /id="open-cases-refresh"[^>]*disabled/, "no inspector chosen: nothing to refresh yet");
  assert.match(idle, /id="open-cases-refresh-inspectors"/);
  assert.ok(!/id="open-cases-refresh-inspectors"[^>]*disabled/.test(idle));
  assert.ok(!/id="open-cases-refresh"[^>]*disabled/.test(card({ ...loaded, selected: "JSMITH" })));
  openList.error = "The list took too long to load.";
  await owner.retry();
  assert.equal(
    calls.filter((c) => c[0] === "/inspector-cases/list").length,
    askedList + 2,
    "Try again after a failed list reload loads the list again",
  );
  assert.equal(openList.error, "");
  // An answer the list cannot use is an error, not an empty list; an empty list can be reloaded.
  openList.inspectors = null;
  openList.error = "";
  const broken = m.createOpenCaseList({ helperJSON: async () => ({ ok: true }), render: () => {}, findDatabaseCase: async () => {} });
  await broken.loadInspectors();
  assert.match(openList.error, /cannot use/);
  assert.equal(openList.inspectors, null);
  openList.error = "";
  openList.inspectors = [];
  await owner.retry();
  assert.equal(openList.inspectors.length, 1, "Try again on an empty list loads it again");
  // The inspector last shown is remembered (2026-11-13): the next list load opens on that inspector's cases without a
  // second step; an unknown or missing remembered inspector changes nothing, and neither does a failing store.
  const store = new Map();
  global.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  const asked = [];
  const remembering = m.createOpenCaseList({
    helperJSON: async (url, body) => {
      asked.push([url, body?.inspector]);
      return url.endsWith("/list")
        ? { inspectors: [{ id: "JSMITH", name: "Jane Smith", openCases: 1 }] }
        : { cases: [row("CB2026-241-00009")], dueDates: true };
    },
    render: () => {},
    findDatabaseCase: async () => {},
  });
  const fresh = () => Object.assign(openList, { inspectors: null, selected: "", cases: null, casesFor: null, error: "", casesError: "" });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  fresh();
  await remembering.loadInspectors();
  await settle();
  assert.equal(openList.cases, null, "nothing is loaded until an inspector has been chosen once");
  await remembering.showCases("JSMITH");
  assert.equal(store.get("madison-open-cases-inspector-v1"), "JSMITH");
  fresh();
  asked.length = 0;
  await remembering.loadInspectors();
  await settle();
  assert.deepEqual(
    asked.map((c) => c[0].split("/").pop()),
    ["list", "cases"],
  );
  assert.equal(openList.selected, "JSMITH");
  assert.equal(openList.cases.length, 1, "the remembered inspector's cases load on their own");
  store.set("madison-open-cases-inspector-v1", "GONE");
  fresh();
  await remembering.loadInspectors();
  await settle();
  assert.equal(openList.cases, null, "an inspector no longer listed is not selected");
  global.localStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  fresh();
  await remembering.loadInspectors();
  await remembering.showCases("JSMITH");
  assert.equal(openList.cases.length, 1, "a blocked store never stops the list");
  delete global.localStorage;
  console.log("PASS open case list");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
