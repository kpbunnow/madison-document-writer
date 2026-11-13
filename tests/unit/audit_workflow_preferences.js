/* Retired view preferences are ignored; active reminder validation and persistence stay intact. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const api = await compile(
    'export {loadWorkflowPreferences,WORKFLOW_PREFS_KEY} from "./workflow_preferences.js"; export {createLanguageCatalog} from "./language_catalog.js"; export {createWorkflowEvents} from "./workflow_events.js";',
  );
  assert.deepEqual(api.WriterState, {}, "preferences do not initialize Writer");
  assert.equal(api.WORKFLOW_PREFS_KEY, "madison-workspace-preferences-v1", "retain the device storage identity");
  const defaults = { reminders: { enabled: false, days: 7, plans: {}, dismissed: [] } };
  const read = (raw) => api.loadWorkflowPreferences(() => raw);
  for (const raw of [undefined, "", "null", "42", '"text"', "[]", "{", '{"filter":"closed","query":"hidden","inspector":"OTHER"}'])
    assert.deepEqual(read(raw), defaults);
  assert.deepEqual(
    api.loadWorkflowPreferences(() => {
      throw Error("storage denied");
    }),
    defaults,
  );
  const raw = JSON.stringify({
    filter: "closed",
    query: "hidden",
    inspector: "OTHER",
    reminders: {
      enabled: true,
      days: 45,
      plans: { valid: "2026-11-13", invalid: "2026-02-30" },
      dismissed: [3, "old", ...Array.from({ length: 201 }, (_, n) => "item" + n)],
    },
  });
  const prefs = read(raw);
  assert.deepEqual(prefs, {
    reminders: {
      enabled: true,
      days: 30,
      plans: { valid: "2026-11-13" },
      dismissed: Array.from({ length: 200 }, (_, n) => "item" + (n + 1)),
    },
  });
  for (const [days, expected] of [
    [-4, 1],
    [0, 7],
    ["12", 12],
    ["bad", 7],
    [null, 7],
    [1, 1],
    [30, 30],
  ])
    assert.equal(read(JSON.stringify({ reminders: { enabled: "true", days } })).reminders.days, expected);
  assert.equal(read('{"reminders":{"enabled":"true"}}').reminders.enabled, false);
  const next = read(raw);
  next.reminders.plans.valid = "2027-01-01";
  assert.equal(prefs.reminders.plans.valid, "2026-11-13", "reads return independent preference state");
  const previousStorage = global.localStorage,
    writes = [],
    errors = [];
  try {
    global.localStorage = { setItem: (key, value) => writes.push([key, JSON.parse(value)]) };
    api.WriterState.WORKFLOW_PREFS = prefs;
    api.WriterState.state = { caseQ: "retired", caseFilter: "closed", caseInspector: "OTHER" };
    const owner = api.createLanguageCatalog({
      WORKFLOW_PREFS_KEY: api.WORKFLOW_PREFS_KEY,
      toast: (message, options) => errors.push([message, options]),
    });
    owner.saveWorkflowPrefs();
    assert.deepEqual(writes, [[api.WORKFLOW_PREFS_KEY, prefs]], "saving reminders never copies retired editor fields");
    api.WriterState.WORKFLOW_PREFS = next;
    owner.saveWorkflowPrefs();
    assert.deepEqual(writes[1][1], next, "save reads the current preference object");
    global.localStorage = {
      setItem: () => {
        throw Error("quota");
      },
    };
    owner.saveWorkflowPrefs();
    assert.deepEqual(errors, [["Could not save workspace preferences", { severity: "error" }]]);
  } finally {
    global.localStorage = previousStorage;
  }
  const changes = [],
    routes = {};
  api.WriterState.TIMELINE_CASE = "current-case";
  const events = api.createWorkflowEvents({
    showTimeline: (...args) => changes.push(args),
    saveWorkflowPrefs: () => assert.fail("retired route wrote preferences"),
  });
  events.registerTimelineFilter({
    addEventListener: (type, listener) => {
      routes[type] = listener;
    },
  });
  for (const id of ["case-search", "case-filter", "case-inspector"]) routes.change({ target: { id, value: "retired" } });
  assert.deepEqual(changes, []);
  routes.change({ target: { id: "timeline-filter", value: "withdrawn" } });
  assert.deepEqual(changes, [["current-case", "withdrawn"]], "the active timeline route remains current");
  assert.equal(events.registerSearchPreferences, undefined, "no listener remains for the retired search preference");
  for (const file of ["app_core", "writer_handoff", "accela_import", "language_catalog"])
    assert.doesNotMatch(
      fs.readFileSync("app/modules/" + file + ".js", "utf8"),
      /\bcase(?:Q|Filter|Inspector)\b/,
      file + " cannot revive retired view state",
    );
  console.log(
    "PASS optional workflow preferences: retired views ignored, reminders retained, bounded validation, fresh reads and save-failure reporting",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
