const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Small case activity owner preserves reminder scope, live dates and read-only event ordering. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  directory = path.join(root, "app/modules");
const parse = (n) => acorn.parse(fs.readFileSync(path.join(directory, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, visit) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, visit));
  visit(n);
  Object.values(n).forEach((c) => walk(c, visit));
}
const required = new Set();
walk(parse("case_activity"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    required.add(n.property.name);
  }
});
assert.deepEqual([...required].sort(), ["A11Y", "caseState", "fmtDate", "navigation", "sourceDocFor", "today"].sort(), "bounded activity interface");
const decl = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = decl.find((n) => n.id.name === "caseActivity");
assert.equal(entry.init.callee.name, "createCaseActivity");
assert.ok(decl.indexOf(entry) > decl.findIndex((n) => n.id.name === "accelaImport"));
assert.ok(decl.indexOf(entry) < decl.findIndex((n) => n.id.name === "documentRenderer"));
assert.equal(entry.init.arguments.length, 1);
const props = serviceComposition(entry.init.arguments[0]).properties;
assert.deepEqual(new Set(props.map((p) => p.key.name)), required);
for (const p of props) {
  assert.equal(p.type, "Property");
  if (p.kind === "get") {
    assert.equal(p.value.body.body.length, 1);
    assert.equal(p.value.body.body[0].argument.name, p.key.name);
  } else {
    assert.equal(p.value.type, "ArrowFunctionExpression");
    assert.equal(p.value.body.type, "CallExpression");
    assert.equal(p.value.body.callee.name, p.key.name);
  }
}
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents: "export {createCaseActivity,timelineCategory} from './case_activity.js'; export {WriterState} from './state.js';",
      resolveDir: directory,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { createCaseActivity, timelineCategory, WriterState: state } = box.exports;
  assert.deepEqual(state, {});
  createCaseActivity(
    new Proxy(
      {},
      {
        get(_, k) {
          throw Error("premature " + String(k));
        },
      },
    ),
  );
  assert.deepEqual(state, {}, "independent construction does not start Writer, read services or require a DOM");
  let today = new Date("2026-10-25T12:00:00Z"),
    calls = [];
  const docs = {
    a: {
      items: [
        { due: "2026-10-25" },
        { due: "2026-10-27" },
        { due: "2026-10-27" },
        { due: "2026-10-28" },
        { due: "2026-10-26", done: true },
        { due: "2026-10-26", withdrawn: true },
        { due: "2026-10-26", dueExempt: "snow-10.28" },
      ],
    },
    b: { items: [{ due: "2026-10-26" }] },
  };
  const api = createCaseActivity({
    get today() {
      return today;
    },
    caseState: (k) => ({ closed: !!k.closed }),
    sourceDocFor: (id) => docs[id],
    fmtDate: (x) => x,
    navigation: { utilityContext: () => calls.push("context") },
    A11Y: { utility: (title, html) => calls.push({ title, html }) },
  });
  Object.assign(state, {
    CASES: [
      { id: "a", number: "<CASE A>", address: "A & B", emails: [{ addr: "one@example.invalid" }] },
      { id: "b", number: "B", closed: true },
      { id: "missing", number: "M" },
    ],
    WORKFLOW_PREFS: { reminders: { enabled: true, days: 2, plans: { a: "2026-10-26", missing: "2026-10-26" }, dismissed: [] } },
    EVENTS: {},
    TIMELINE_CASE: "a",
    TIMELINE_FILTER: "all",
  });
  const before = JSON.stringify(state.CASES),
    rows = api.remindersDue();
  assert.deepEqual(
    rows.map((r) => [r.cid, r.kind, r.date]),
    [
      ["a", "Compliance due", "2026-10-25"],
      ["a", "Compliance due", "2026-10-27"],
      ["a", "Reinspection planned", "2026-10-26"],
    ],
  );
  assert.equal(new Set(rows.map((r) => r.id)).size, 3);
  assert.equal(JSON.stringify(state.CASES), before);
  assert.ok(api.remindersPanel().includes("&lt;CASE A&gt;"));
  assert.ok(!api.remindersPanel().includes(">B<"));
  state.WORKFLOW_PREFS.reminders.dismissed = [rows[0].id];
  assert.equal(api.remindersDue().length, 2);
  today = new Date("2026-10-26T12:00:00Z");
  assert.deepEqual(
    api.remindersDue().map((r) => r.date),
    ["2026-10-27", "2026-10-28", "2026-10-26"],
    "read date and window at call time",
  );
  calls = [];
  api.showReminderDraft("stale-id");
  assert.deepEqual(calls, ["context"]);
  api.showReminderDraft(api.remindersDue()[0].id);
  assert.equal(calls.at(-2), "context");
  assert.equal(calls.at(-1).title, "Review reminder email draft");
  assert.ok(calls.at(-1).html.includes("one@example.invalid"));
  assert.ok(calls.at(-1).html.includes("&lt;CASE A&gt;"));
  state.WORKFLOW_PREFS.reminders.enabled = false;
  assert.deepEqual(api.remindersDue(), []);
  assert.equal(api.remindersPanel(), "");
  state.CASES = [{ id: "a", number: "replacement" }];
  state.EVENTS = {
    a: [
      { id: "b", at: "2026-10-25T13:00:00Z", type: "document.issued", by: "<Inspector>", payload: {} },
      { id: "c", at: "2026-10-24T13:00:00Z", type: "item.withdrawn", payload: { reason: "<reason>" } },
      { id: "a", at: "2026-10-25T13:00:00Z", type: "correction.issued", payload: {} },
    ],
  };
  const stored = JSON.stringify(state.EVENTS.a);
  assert.deepEqual(
    api.timelineRows().map((e) => e.id),
    ["c", "a", "b"],
  );
  assert.equal(JSON.stringify(state.EVENTS.a), stored, "sorting must not mutate full event-log exports");
  state.TIMELINE_FILTER = "corrected";
  assert.deepEqual(
    api.timelineRows().map((e) => e.id),
    ["a"],
  );
  assert.equal(api.timelineRows()[0], state.EVENTS.a[2]);
  assert.equal(timelineCategory("document.issued"), "issued");
  assert.equal(timelineCategory("correction.issued"), "corrected");
  assert.equal(timelineCategory("item.withdrawn"), "withdrawn");
  assert.equal(timelineCategory("pdf.filed"), "filed");
  assert.equal(timelineCategory("visit.recorded"), "recorded");
  assert.equal(timelineCategory("note.added"), "other");
  calls = [];
  api.showTimeline("a", "all");
  assert.equal(calls[0], "context");
  assert.equal(state.TIMELINE_FILTER, "all");
  assert.equal(calls[1].title, "Case timeline — replacement");
  assert.ok(calls[1].html.includes("&lt;Inspector&gt;"));
  assert.ok(calls[1].html.includes("&lt;reason&gt;"));
  assert.equal(JSON.stringify(state.EVENTS.a), stored);
  state.EVENTS = { a: [{ id: "fresh", at: "2026-10-26T10:00:00Z", type: "note.added", payload: {} }] };
  assert.deepEqual(
    api.timelineRows().map((e) => e.id),
    ["fresh"],
    "observe replaced event maps",
  );
  console.log(JSON.stringify({ passed: true, independentActivity: true, boundedDependencies: 6, liveRemindersAndReadOnlyTimeline: true }));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
