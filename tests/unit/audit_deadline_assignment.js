/* Deadline planning and assignment preserve selection, draft and all-or-nothing boundaries. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
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
walk(parse("deadline_assignment"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    required.add(n.property.name);
  }
});
assert.deepEqual([...required].sort(), ["A11Y", "MINDUE", "fmtDate", "isLocked", "navigation", "snow", "structEditable"]);
const declarations = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = declarations.find((n) => n.id.name === "deadlineAssignment");
assert.equal(entry.init.callee.name, "createDeadlineAssignment");
assert.ok(declarations.indexOf(entry) > declarations.findIndex((n) => n.id.name === "writerHandoff"));
assert.ok(declarations.indexOf(entry) < declarations.findIndex((n) => n.id.name === "documentRenderer"));
assert.equal(entry.init.arguments.length, 1);
const properties = entry.init.arguments[0].properties;
assert.deepEqual(new Set(properties.map((p) => p.key.name)), required);
for (const p of properties) {
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
  const built = await esbuild.build({
    stdin: { contents: "export * from './deadline_assignment.js'; export {WriterState} from './state.js';", resolveDir: directory },
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
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createDeadlineAssignment, dueDateSpacingConflicts, dueContext, dueSelectedText, activeDueTarget, WriterState: state } = box.exports;
  assert.deepEqual(state, {});
  createDeadlineAssignment(new Proxy({}, { get: (_, k) => assert.fail("premature dependency: " + String(k)) }));
  assert.deepEqual(state, {}, "independent construction reads no services, workspace or DOM");
  let minimum = "2026-11-01",
    calls = [];
  const api = createDeadlineAssignment({
    MINDUE: () => minimum,
    structEditable: (d) => !!d.draft && d.type === "notice" && !d.correction && !d.locked,
    isLocked: (d) => !d.draft || !!d.locked,
    fmtDate: (v) => "formatted " + v,
    navigation: { utilityContext: () => calls.push("context") },
    A11Y: { utility: (title, html) => calls.push({ title, html }) },
    snow: { is: (d) => !!d.snowCase },
  });
  const item = (id, due = "", flags = {}) => ({ id, no: id, title: "<" + id + ">", due, ...flags });
  const a = {
    id: "a",
    caseId: "case",
    type: "notice",
    draft: true,
    items: [item("one", "2026-11-08"), item("two", "2026-11-15"), item("three", "2026-11-22"), item("extra"), item("done", "", { done: true })],
  };
  const b = { id: "b", caseId: "case", type: "notice", draft: true, items: [item("other")] };
  Object.assign(state, { DOCS: [a, b], CASES: [{ id: "case", number: "<CASE>" }], REINSP: [], state: { screen: "editor", docId: "a" } });
  const before = JSON.stringify(state.DOCS);
  const planned = api.planBulkDue(
    [
      { docId: "a", itemId: "one" },
      { docId: "b", itemId: "other" },
    ],
    "2026-11-29",
  );
  assert.equal(planned.get("a").items[0].due, "2026-11-29");
  assert.equal(planned.get("b").items[0].due, "2026-11-29");
  assert.notEqual(planned.get("a"), a);
  assert.equal(JSON.stringify(state.DOCS), before, "planning never commits a partial batch");
  for (const [changes, date, fault] of [
    [[], "2026-11-29", /Select at least/],
    [[{ docId: "a", itemId: "one" }], "2026-02-30", /future/],
    [[{ docId: "a", itemId: "one" }], "2026-11-16", /seven/],
    [[{ docId: "a", itemId: "extra" }], "2026-11-29", /three/],
    [[{ docId: "a", itemId: "done" }], "2026-11-29", /not outstanding/],
  ])
    assert.throws(() => api.planBulkDue(changes, date), fault);
  b.pendingAmendment = true;
  assert.throws(
    () =>
      api.planBulkDue(
        [
          { docId: "a", itemId: "one" },
          { docId: "b", itemId: "other" },
        ],
        "2026-11-29",
      ),
    /editable notice drafts/,
  );
  delete b.pendingAmendment;
  b.draft = false;
  assert.throws(() => api.planBulkDue([{ docId: "b", itemId: "other" }], "2026-11-29"), /editable notice drafts/);
  b.draft = true;
  assert.equal(JSON.stringify(state.DOCS), before);
  for (const [date, ids, fault] of [
    ["2026-11-29", [], /Select at least/],
    ["2026-11-29", ["stale"], /selection changed/],
    ["2026-11-16", ["one"], /seven/],
    ["2026-11-29", ["extra"], /three/],
  ]) {
    assert.match(api.assignDue(a, false, date, ids), fault);
    assert.equal(JSON.stringify(state.DOCS), before, "refused assignment is atomic");
  }
  minimum = "2026-12-01";
  assert.match(api.assignDue(a, false, "2026-11-29", ["one"]), /future/);
  minimum = "2026-11-01";
  assert.equal(api.assignDue(a, false, "2026-11-08", ["extra"]), "");
  assert.equal(a.items[3].due, "2026-11-08");
  assert.match(api.assignDue({ ...a, correction: {} }, false, "2026-11-08", ["one"]), /new Official Notice/);
  const close = [item("x", "2026-11-08"), item("y", "2026-11-14"), item("z", "bad")],
    snapshot = JSON.stringify(close);
  assert.deepEqual(dueDateSpacingConflicts(close)[0].dates, ["2026-11-08", "2026-11-14"]);
  assert.equal(dueDateSpacingConflicts(close)[0].items[0], close[0]);
  assert.equal(JSON.stringify(close), snapshot);
  assert.deepEqual(dueDateSpacingConflicts([close[0], item("seven", "2026-11-15")]), []);
  const source = {
    id: "source",
    items: [item("open"), item("carried"), item("corrected"), item("unset"), item("withdrawn", "", { withdrawn: true })],
  };
  state.DOCS = [source];
  const visit = {
    id: "v",
    sourceDocId: "source",
    draft: true,
    results: { open: { oc: "notdone" }, carried: { oc: "notdone", carried: true }, corrected: { oc: "corrected" }, withdrawn: { oc: "notdone" } },
  };
  assert.deepEqual(
    dueContext(visit, true).map((i) => i.id),
    ["open"],
  );
  assert.equal(dueSelectedText(dueContext(visit, true), new Set(["open", "stale"])), "1 of 1 item selected");
  for (const intent of [undefined, "", "undecided", "extension", "bestInterestExtension", "citation"]) {
    visit.followupIntent = intent;
    assert.equal(api.assignDue(visit, true, "2026-11-08", ["open"]), "");
  }
  assert.match(api.assignDue(visit, true, "2026-11-15", ["carried"]), /selection changed/);
  visit.followupIntent = "referral";
  assert.match(api.assignDue(visit, true, "2026-11-15", ["open"]), /open reinspection/);
  visit.followupIntent = "extension";
  visit.docId = "issued";
  assert.equal(api.duePanel(visit, true), "");
  assert.match(api.assignDue(visit, true, "2026-11-15", ["open"]), /open reinspection/);
  delete visit.docId;
  state.REINSP = [visit];
  state.state = { screen: "reinspect", reinspId: "v" };
  assert.equal(activeDueTarget().target, visit);
  state.REINSP = [{ ...visit, id: "v", replaced: true }];
  assert.equal(activeDueTarget().target.replaced, true);
  state.DOCS = [{ ...source, items: [item("new")] }];
  assert.deepEqual(dueContext(visit, true), [], "context must observe replacement source arrays");
  state.DOCS = [a, b, source];
  api.showBulkDue();
  assert.equal(calls[0], "context");
  assert.ok(calls[1].html.includes("&lt;CASE&gt;"));
  assert.ok(calls[1].html.includes("&lt;one&gt;"));
  assert.ok(!api.duePanel({ ...a, snowCase: true }, false));
  const dom = new JSDOM('<div data-due-count></div><span data-due-label="one"></span>');
  global.document = dom.window.document;
  try {
    api.updateDueIndicators(a);
    assert.equal(document.querySelector("[data-due-count]").textContent, "3 of 3 dates used");
    assert.equal(document.querySelector('[data-due-label="one"]').textContent, "formatted 2026-11-08");
  } finally {
    delete global.document;
    dom.window.close();
  }
  console.log(JSON.stringify({ passed: true, boundedDependencies: 7, atomicDeadlinePlanningAndAssignment: true, liveSelectionContext: true }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
