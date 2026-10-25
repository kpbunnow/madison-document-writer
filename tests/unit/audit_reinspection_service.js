/* Reinspection loads independently and retains live worksheet references, outcome/undo and focus/save order. */
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
walk(parse("reinspection"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    required.add(n.property.name);
  }
});
const declarations = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = declarations.find((d) => d.id.name === "reinspection");
assert.equal(entry.init.callee.name, "createReinspection");
assert.ok(declarations.indexOf(entry) > declarations.findIndex((d) => d.id.name === "addressParser"));
assert.ok(declarations.indexOf(entry) < declarations.findIndex((d) => d.id.name === "languageCatalog"));
assert.equal(entry.init.arguments.length, 1);
const props = entry.init.arguments[0].properties;
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
  const built = await esbuild.build({
    stdin: { contents: "export {createReinspection} from './reinspection.js'; export {WriterState} from './state.js';", resolveDir: directory },
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
  const { createReinspection, WriterState: state } = box.exports;
  assert.deepEqual(state, {});
  createReinspection(
    new Proxy(
      {},
      {
        get(_, k) {
          throw Error("premature service " + String(k));
        },
      },
    ),
  );
  assert.deepEqual(state, {}, "construction does not initialize Writer, read services/state or require a DOM");
  let calls = [];
  const api = createReinspection({
    scheduleDraftSave: () => calls.push("save"),
    render: () => calls.push("render"),
    renderKeep: () => calls.push("renderKeep"),
    toast: (m) => calls.push(m),
  });
  const source = {
      id: "src",
      caseId: "c",
      items: [{ id: "one", no: "1" }, { id: "two", no: "2" }, { id: "withdrawn", withdrawn: true }, { id: "carried" }],
    },
    r = {
      id: "r",
      caseId: "c",
      sourceDocId: "src",
      draft: true,
      date: "2026-10-25",
      results: { one: { oc: "none", note: "kept", due: "2026-11-03", cite: true }, carried: { carried: true } },
    };
  Object.assign(state, {
    DOCS: [source],
    REINSP: [r],
    state: {
      screen: "reinspect",
      reinspId: "r",
      riWalk: true,
      riWalkContext: api.walkIdentity(r),
      riWalkItem: "one",
      riWalkUndo: null,
      riWalkSkipped: [],
      riWalkMode: "quick",
      riWalkStage: "outcome",
    },
  });
  const originalDocument = global.document;
  global.document = { querySelector: (selector) => (selector === '[data-riwalk="off"]' ? { focus: () => calls.push("focus") } : null) };
  try {
    assert.equal(api.recordReinspectionOutcome("one", "corrected"), true);
    assert.equal(r.results.one.note, "kept");
    assert.equal(r.results.one.due, "");
    assert.equal(r.results.one.cite, false);
    assert.equal(state.state.riWalkItem, "two");
    assert.deepEqual(calls, ["save", "render", "focus"]);
    r.results.one.note = "later note";
    r.results.one.due = "2026-11-10";
    calls = [];
    assert.equal(api.undoWalkOutcome(), true);
    assert.equal(r.results.one.oc, "none");
    assert.equal(r.results.one.note, "later note");
    assert.equal(r.results.one.due, "2026-11-10");
    assert.match(calls[0], /later note, date and due details were kept/);
    assert.deepEqual(calls.slice(1), ["save", "render", "focus"]);
    calls = [];
    for (const [id, outcome] of [
      ["withdrawn", "none"],
      ["carried", "corrected"],
      ["missing", "none"],
      ["one", "unsupported"],
    ])
      assert.equal(api.recordReinspectionOutcome(id, outcome), false);
    assert.deepEqual(calls, []);
    const old = JSON.stringify(r.results),
      replacement = { ...r, results: JSON.parse(JSON.stringify(r.results)) };
    state.REINSP = [replacement];
    state.DOCS = [{ ...source, items: source.items.map((x) => ({ ...x })) }];
    state.state.riWalk = false;
    calls = [];
    assert.equal(api.recordReinspectionOutcome("one", "progress"), true);
    assert.equal(replacement.results.one.oc, "progress");
    assert.equal(JSON.stringify(r.results), old);
    assert.deepEqual(calls, ["save", "renderKeep"], "use live replacement arrays without a full repaint");
    state.state.riWalk = true;
    state.state.riWalkContext = "obsolete";
    assert.equal(api.ensureWalkContext(), false);
    assert.equal(state.state.riWalk, false);
    assert.equal(state.state.riWalkContext, null);
    assert.deepEqual(state.state.riWalkSkipped, []);
  } finally {
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
  }
  console.log(JSON.stringify({ passed: true, independentReinspection: true, liveReferences: true, outcomeUndoAndFocusOrder: true }));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
