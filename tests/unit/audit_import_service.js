const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Import can be composed without Writer startup; stale/failed shared reads never authorize acceptance. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  directory = path.join(root, "app/modules");
const parse = (name) => acorn.parse(fs.readFileSync(path.join(directory, name + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  visit(node);
  Object.values(node).forEach((child) => walk(child, visit));
}
const required = new Set();
walk(parse("accela_import"), (node) => {
  if (node.type === "MemberExpression" && node.object.name === "services") {
    assert.equal(node.computed, false, "no dynamic registry lookup");
    required.add(node.property.name);
  }
});
assert.equal(required.size, 21, "import keeps only its UI/peer adapters");
for (const name of ["parseTime", "parseDate", "validISO", "inspAt", "sameInspection", "inspectionIdentity", "inspectionUsed"])
  assert.equal(required.has(name), false, "shared facts must not be wired back through core");
const declarations = parse("app_core").body.flatMap((node) => (node.declaration || node).declarations || []),
  construction = declarations.find((d) => d.id.name === "accelaImport");
assert.equal(construction.init.callee.name, "createAccelaImport");
assert.ok(declarations.findIndex((d) => d.id.name === "addressParser") < declarations.indexOf(construction));
assert.ok(declarations.indexOf(construction) < declarations.findIndex((d) => d.id.name === "documentRenderer"));
assert.equal(construction.init.arguments.length, 1);
const properties = serviceComposition(construction.init.arguments[0]).properties;
assert.deepEqual(new Set(properties.map((p) => p.key.name)), required, "exact named import dependencies");
for (const p of properties) {
  assert.equal(p.type, "Property", "no shared service spread");
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
    stdin: { contents: "export {createAccelaImport} from './accela_import.js'; export {WriterState} from './state.js';", resolveDir: directory },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (args) => ({ path: path.join(root, "build/generated/modules/data", path.basename(args.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createAccelaImport, WriterState: state } = box.exports;
  assert.deepEqual(state, {}, "importing definitions does not initialize Writer");
  const unavailable = new Proxy(
    {},
    {
      get(_, key) {
        throw new Error("premature dependency: " + String(key));
      },
    },
  );
  const cold = createAccelaImport(unavailable);
  assert.deepEqual(state, {}, "construction reads neither services nor live state and requires no DOM");
  assert.deepEqual(cold.baseLookupPlan(null).blockers, ["No report loaded"]);
  assert.ok(cold.statusRule("Initial Inspection", "Citation").cite);
  assert.ok(cold.statusRule("Initial Inspection", "constructor").error);
  assert.equal(cold.hiddenImportRow("Initial Inspection", "Completed"), "notDone");
  assert.notEqual(cold.LOOKUP_READY, createAccelaImport(unavailable).LOOKUP_READY, "authorization is instance-owned");

  const number = "CB2026-100-00001",
    name = "SYNTHETIC - " + number + ".json";
  let committed = new Map(),
    replies = [],
    calls = [],
    loaded = true,
    loads = 0;
  const services = {
    helperJSON: async (url) => {
      calls.push(url);
      return await replies.shift();
    },
    loadCaseFile: () => {
      ++loads;
      state.state.screen = "changed";
      state.state.docId = "changed";
      state.DIRTY = false;
      return loaded;
    },
    get COMMITTED() {
      return committed;
    },
    toast: (message) => calls.push(message),
  };
  const api = createAccelaImport(services);
  Object.assign(state, { CASES: [], state: { screen: "import", docId: "kept" }, DIRTY: true, LOOKUP_SERIAL: 0, LOOKUP_BUSY: true });
  const acc = { cases: [{ number }], shareError: "old error" },
    file = { case: { number, address: "SYNTHETIC" } },
    result = { file };
  replies = [{ files: [{ name }] }, result];
  assert.equal(await api.checkLookupShared(acc), true);
  assert.equal(loads, 1);
  assert.deepEqual(state.state, { screen: "import", docId: "kept" });
  assert.equal(state.DIRTY, true);
  assert.equal(committed.size, 1);
  assert.equal([...committed.values()][0], result);
  assert.equal(acc.shareError, "");

  let resolve;
  const oldCommitted = committed;
  replies = [
    { files: [{ name }] },
    new Promise((r) => {
      resolve = r;
    }),
  ];
  const pending = api.checkLookupShared(acc);
  await new Promise((r) => setImmediate(r));
  committed = new Map();
  resolve(result);
  await pending;
  assert.equal(committed.size, 1, "the live COMMITTED getter is read after the shared result");
  assert.equal(oldCommitted.size, 1);

  committed = new Map();
  loaded = false;
  replies = [{ files: [{ name }] }, result];
  await assert.rejects(api.checkLookupShared(acc), /could not be merged/);
  assert.equal(committed.size, 0, "a refused merge creates no committed evidence");
  assert.deepEqual(state.state, { screen: "import", docId: "kept" });
  assert.equal(state.DIRTY, true);

  calls = [];
  replies = [{ files: [{ name }, { name }] }];
  await assert.rejects(api.checkLookupShared(acc), /More than one shared file/);
  assert.deepEqual(calls, ["/cases/list"]);
  let active = true;
  replies = [
    new Promise((r) => {
      resolve = r;
    }),
  ];
  const stale = api.checkLookupShared(acc, () => active);
  active = false;
  resolve({ files: [{ name }] });
  const beforeLoads = loads;
  assert.equal(await stale, false);
  assert.equal(loads, beforeLoads, "a stale result cannot merge");

  let aborted = 0;
  state.LOOKUP_CONTROLLER = {
    abort() {
      ++aborted;
    },
  };
  api.cancelCaseLookup();
  assert.equal(aborted, 1);
  assert.equal(state.LOOKUP_SERIAL, 1);
  assert.equal(state.LOOKUP_CONTROLLER, null);
  assert.equal(state.LOOKUP_BUSY, false);
  state.state.acc = { source: { kind: "sql" } };
  assert.equal(api.acceptAccela(), null, "SQL acceptance still requires shared-record confirmation");
  assert.match(calls.at(-1), /Check the shared record/);
  console.log(JSON.stringify({ passed: true, independentImportService: true, staleAndFailedReadGuards: true }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
