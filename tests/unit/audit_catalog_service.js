const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Independent review/preflight composition retains stale reads and durable workspace patch ordering. */
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
walk(parse("language_catalog"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    required.add(n.property.name);
  }
});
const decl = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  construction = decl.find((d) => d.id.name === "languageCatalog");
assert.equal(construction.init.callee.name, "createLanguageCatalog");
assert.ok(decl.indexOf(construction) > decl.findIndex((d) => d.id.name === "addressParser"));
assert.ok(decl.indexOf(construction) < decl.findIndex((d) => d.id.name === "accelaImport"));
assert.equal(construction.init.arguments.length, 1);
const props = serviceComposition(construction.init.arguments[0]).properties;
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
    stdin: {
      contents: "export {createLanguageCatalog} from './language_catalog.js'; export {WriterState} from './state.js';",
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
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createLanguageCatalog, WriterState: state } = box.exports;
  const cold = new Proxy(
    {},
    {
      get(_, k) {
        throw Error("premature " + String(k));
      },
    },
  );
  assert.deepEqual(state, {});
  createLanguageCatalog(cold);
  assert.deepEqual(state, {}, "construction neither starts Writer nor needs a DOM");
  let reads = [],
    calls = [],
    writeOK = true,
    cache = [];
  const services = {
    helperJSON: () => new Promise((resolve) => reads.push(resolve)),
    render: () => calls.push("render"),
    captureWork: () => calls.push("capture"),
    draftBundle: () => ({ kept: ["local"] }),
    idbSet: async (key, value) => {
      calls.push("write:" + key);
      assert.deepEqual(value.kept, ["local"]);
      return writeOK;
    },
    scheduleRecoveryBackup: () => calls.push("backup"),
    get recordIntegrity() {
      return { status: () => ({ valid: false }) };
    },
  };
  const api = createLanguageCatalog(services);
  Object.assign(state, {
    CATALOG_EVENTS: [],
    CATALOG_VERIFIED: false,
    CATALOG_AT: "previous",
    state: { screen: "library", picker: false },
    LOCAL_SAVE_CHAIN: Promise.resolve(),
    WORK_PATCH: null,
    LOCAL_CHANGED: 0,
    DIRTY: true,
  });
  const priorStorage = global.localStorage;
  global.localStorage = { setItem: (...args) => cache.push(args) };
  try {
    const first = api.refreshCatalog(),
      second = api.refreshCatalog();
    reads[1]({ events: [{ id: "new", key: "k", status: "approved", version: 2 }] });
    assert.equal(await second, true);
    reads[0]({ events: [{ id: "old", key: "k", status: "approved", version: 1 }] });
    assert.equal(await first, false);
    assert.equal(api.catalogReview("k").version, 2);
    assert.equal(cache.length, 1);
    reads = [];
    const pending = api.refreshCatalog();
    const acknowledged = [{ id: "ack", key: "k", status: "approved", version: 3 }];
    state.CATALOG_EVENTS = acknowledged;
    reads[0]({ events: [] });
    assert.equal(await pending, false);
    assert.equal(state.CATALOG_EVENTS, acknowledged);
    reads = [];
    const malformed = api.refreshCatalog();
    reads[0]({ events: null });
    assert.equal(await malformed, false);
    assert.equal(state.CATALOG_EVENTS, acknowledged);
    assert.match(state.CATALOG_ERROR, /Invalid review history/);
  } finally {
    if (priorStorage === undefined) delete global.localStorage;
    else global.localStorage = priorStorage;
  }
  calls = [];
  const original = { kept: ["local"] };
  services.draftBundle = () => original;
  assert.equal(
    await api.persistWorkspacePatch(
      (bundle) => {
        calls.push("prepare");
        bundle.changed = true;
        return bundle;
      },
      (staged) => {
        assert.equal(staged.changed, true);
        calls.push("commit");
      },
    ),
    true,
  );
  assert.deepEqual(calls, ["capture", "prepare", "write:drafts", "commit", "backup"]);
  assert.deepEqual(original, { kept: ["local"] });
  assert.equal(state.WORK_PATCH, null);
  assert.equal(state.LOCAL_CHANGED, 1);
  assert.equal(state.DIRTY, false);
  calls = [];
  writeOK = false;
  state.DIRTY = true;
  await assert.rejects(
    api.persistWorkspacePatch(
      (b) => b,
      () => calls.push("commit"),
    ),
    /Local work was kept/,
  );
  assert.deepEqual(calls, ["capture", "write:drafts"]);
  assert.equal(state.WORK_PATCH, null);
  assert.equal(state.LOCAL_CHANGED, 1);
  assert.equal(state.DIRTY, true);
  let release;
  state.LOCAL_SAVE_CHAIN = new Promise((r) => {
    release = r;
  });
  writeOK = true;
  calls = [];
  const blocked = api.persistWorkspacePatch(
    (b) => b,
    () => calls.push("commit"),
  );
  assert.ok(state.WORK_PATCH);
  await assert.rejects(
    api.persistWorkspacePatch(
      (b) => b,
      () => {},
    ),
    /Another workspace change/,
  );
  assert.deepEqual(calls, []);
  release();
  await blocked;
  assert.equal(state.WORK_PATCH, null);
  Object.assign(state, { DOCS: [], REINSP: [], PENDING: [], RECORD_ATTEMPTS: {} });
  const local = { id: "c", number: "CB2026-100-00001" };
  assert.equal(api.compareSharedCase(local, [], { case: local }, null).kind, "invalid", "browser comparison does not bypass integrity refusal");
  state.CASES = [local];
  state.CASEDIR = null;
  let continued = 0;
  assert.equal(await api.preflightCase(local.id, "draft", () => ++continued), true);
  assert.equal(continued, 1);
  assert.match(state.PREFLIGHT_NOTICE, /final publication will recheck/);
  console.log(JSON.stringify({ passed: true, independentCatalogService: true, staleReviewsRetained: true, durablePatchOrder: true }));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
