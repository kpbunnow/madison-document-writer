/* Feature registration preserves startup checkpoints, exclusivity and synchronous user actions. */
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const { moduleGraph } = require("../../tools/module_graph.cjs");
const root = path.resolve(__dirname, "../..");
const directory = path.join(root, "app/modules");
const source = fs.readFileSync(path.join(directory, "app_core.js"), "utf8");
const tree = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" });
const expected = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/feature_event_order.json"), "utf8")).registrations;
const constructors = new Map();
for (const statement of tree.body) {
  for (const d of statement.type === "VariableDeclaration" ? statement.declarations : []) {
    if (d.init?.type === "CallExpression" && /^create\w+Events$/.test(d.init.callee.name || "")) {
      constructors.set(d.id.name, d.init.callee.name);
      // Scoped interfaces must stay lazy: capturing a later declaration here would change startup.
      assert.equal(d.init.arguments.length, 1);
      for (const property of d.init.arguments[0].properties) {
        assert.equal(property.type, "Property");
        if (property.kind === "get") {
          assert.equal(property.value.body.body.length, 1);
          assert.equal(property.value.body.body[0].argument.name, property.key.name);
        } else {
          assert.equal(property.value.type, "ArrowFunctionExpression");
          assert.equal(property.value.body.type, "CallExpression");
          assert.equal(property.value.body.callee.name, property.key.name);
        }
      }
    }
  }
}
const registrations = [];
let checkpoint = "services initialized";
for (const statement of tree.body) {
  const e = statement.expression;
  if (e?.type === "CallExpression" && e.callee.type === "MemberExpression") {
    assert.notEqual(e.callee.property.name, "addEventListener", "core must explicitly register features, not contain listener bodies");
    if (constructors.has(e.callee.object.name)) {
      assert.equal(e.arguments.length, 0);
      registrations.push({ owner: e.callee.object.name.replace(/Events$/, ""), name: e.callee.property.name, checkpoint });
    }
  }
  if (e?.type === "AssignmentExpression" && e.left.type === "MemberExpression" && e.left.object.name === "WriterState")
    checkpoint = "WriterState." + e.left.property.name;
  else if (statement.type === "IfStatement" && source.slice(statement.start, statement.end).includes("bootStorage()")) checkpoint = "bootStorage";
  else if (e?.type === "CallExpression" && e.callee.name === "render") checkpoint = "render";
}
assert.equal(expected.length, 60);
assert.deepEqual(
  registrations,
  expected.map(({ owner, name, checkpoint }) => ({ owner, name, checkpoint })),
);
const graph = moduleGraph(directory);
const allowed = new Set([
  "event_registration.js",
  "state.js",
  "workspace_state.js",
  "catalog_state.js",
  "startup_state.js",
  "imports_state.js",
  "recovery_state.js",
  "document_types.js",
  "document_rules.js",
  "writer_queries.js",
  "presentation_format.js",
  "calendar.js",
  "mailing_rules.js",
  "record_values.js",
]);
for (const name of Object.keys(graph.imports).filter((n) => n.endsWith("_events.js"))) {
  assert.ok(!graph.cycles.some((c) => c.includes(name)), name + " must not join a UI/startup cycle");
  for (const dependency of graph.imports[name])
    assert.ok(
      dependency === "../assets/shared.js" || dependency.startsWith("./data/") || allowed.has(dependency.slice(2)),
      name + " imports " + dependency,
    );
}
class Target {
  constructor() {
    this.calls = [];
  }
  addEventListener(type, listener, options) {
    this.calls.push({ type, listener, capture: options === true });
  }
}
(async () => {
  const entry =
    [...constructors.entries()]
      .map(
        ([variable, name]) =>
          `export { ${name} } from './${variable.replace(/Events$/, "").replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())}_events.js';`,
      )
      .join("\n") + "\nexport { WriterState } from './state.js'; export { registerEventOnce } from './event_registration.js';";
  const compiled = await esbuild.build({
    stdin: { contents: entry, resolveDir: directory },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(build) {
          build.onResolve({ filter: /\/data\// }, (args) => ({ path: path.join(root, "build/generated/modules/data", path.basename(args.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const api = box.exports;
  assert.deepEqual(api.WriterState, {}, "loading event owners must not boot or restore the application");
  const unavailable = new Proxy(
    {},
    {
      get(_, key) {
        throw new Error("premature service access: " + String(key));
      },
    },
  );
  const make = (services) => Object.fromEntries([...constructors].map(([variable, name]) => [variable.replace(/Events$/, ""), api[name](services)]));
  const owners = make(unavailable),
    documentTarget = new Target(),
    windowTarget = new Target(),
    actual = [];
  for (const row of expected) {
    const target = row.target === "window" ? windowTarget : documentTarget;
    const before = target.calls.length;
    assert.equal(owners[row.owner][row.name](target), true);
    assert.equal(target.calls.length, before + 1);
    actual.push({ type: target.calls.at(-1).type, capture: target.calls.at(-1).capture });
  }
  assert.deepEqual(
    actual,
    expected.map(({ type, capture }) => ({ type, capture })),
  );
  for (const collection of [owners, make(unavailable)])
    for (const row of expected) assert.equal(collection[row.owner][row.name](row.target === "window" ? windowTarget : documentTarget), false);
  assert.equal(documentTarget.calls.length + windowTarget.calls.length, 60, "repeated factory/registration must not duplicate handlers");
  const retry = new Target();
  retry.addEventListener = () => {
    throw new Error("synthetic registration failure");
  };
  assert.throws(() => api.registerEventOnce(retry, "retry", "click", () => {}), /synthetic registration failure/);
  retry.addEventListener = Target.prototype.addEventListener;
  assert.equal(
    api.registerEventOnce(retry, "retry", "click", () => {}),
    true,
  );

  const calls = [];
  const target = new Target();
  const workspace = api.createWorkspaceEvents({
    captureWork: () => calls.push("capture"),
    render: () => calls.push("render"),
    saveWorkflowPrefs: () => calls.push("preferences"),
    navigation: {
      navigate: () => {
        calls.push("navigate");
        return Promise.resolve();
      },
    },
    linkCaseFolder: () => calls.push("permission"),
  });
  workspace.registerWorkspaceClicks(target);
  const click = target.calls[0].listener;
  const button = (id, dataset) => ({
    id,
    dataset,
    hasAttribute: () => false,
    closest() {
      return this;
    },
  });
  api.WriterState.state = {};
  await click({ target: button("case-showall", { nav: "library", open: "other" }) });
  assert.deepEqual(calls, ["capture", "render", "preferences"], "first matching action remains exclusive");
  calls.length = 0;
  const navigation = click({ target: button("", { nav: "library", open: "other" }) });
  assert.deepEqual(calls, ["capture", "navigate"], "navigation starts synchronously");
  await navigation;
  calls.length = 0;
  const permission = click({ target: button("btn-linkdir", {}) });
  assert.deepEqual(calls, ["capture", "permission"], "permission requests remain on the original user-action stack");
  await permission;

  const dom = new JSDOM('<button id="acc-go">Import</button><input id="lookup-number">', { url: "http://127.0.0.1/" });
  const previousDocument = global.document;
  global.document = dom.window.document;
  try {
    calls.length = 0;
    const importer = api.createImportEvents({ confirmDatabaseCase: () => calls.push("confirm") });
    importer.registerLookupClicks(document);
    workspace.registerWorkspaceClicks(document);
    const event = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
    document.getElementById("acc-go").dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.deepEqual(calls, ["confirm"], "capture confirmation stops later bubble handlers");
    calls.length = 0;
    api.WriterState.WORK = { entry: {} };
    api.WriterState.DOCS = [];
    api.createRecoveryEvents({ ENTRY_IDS: ["lookup-number"], scheduleDraftSave: () => calls.push("save") }).registerWorkingInput(document);
    api.createEditorEvents({}).registerDocumentInput(document);
    const input = document.getElementById("lookup-number");
    input.value = "QA-123";
    input.focus();
    input.setSelectionRange(2, 2);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    assert.equal(api.WriterState.WORK.entry["lookup-number"], "QA-123");
    assert.deepEqual(calls, ["save"]);
    assert.equal(document.activeElement, input);
    assert.equal(input.selectionStart, 2);
  } finally {
    global.document = previousDocument;
    dom.window.close();
  }
  const keys = new Target();
  let ready = false;
  const utility = api.createUtilityEvents({
    get navigation() {
      assert.ok(ready);
      return { invalidateUtilities: () => calls.push("invalidate") };
    },
  });
  utility.registerHelpKeys(keys);
  ready = true;
  calls.length = 0;
  keys.calls[0].listener({ defaultPrevented: true, key: "Escape" });
  assert.deepEqual(calls, []);
  keys.calls[0].listener({ defaultPrevented: false, key: "Escape" });
  assert.deepEqual(calls, ["invalidate"]);
  console.log(
    JSON.stringify({
      passed: true,
      registrations: expected.length,
      featureOwners: constructors.size,
      duplicateRegistrationsRefused: true,
      captureAndSynchronousActionsPreserved: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
