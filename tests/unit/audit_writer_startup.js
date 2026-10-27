const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Startup lock, restore barriers and exact failure order without application/browser startup. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  source = fs.readFileSync(path.join(dir, "writer_startup.js"), "utf8"),
  core = fs.readFileSync(path.join(dir, "app_core.js"), "utf8");
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  f(n);
  Object.values(n).forEach((x) => walk(x, f));
}
const fields = [
    "navigator",
    "document",
    "location",
    "restoreCaseFolder",
    "initWriterHandoff",
    "markWriterReady",
    "markWriterFailed",
    "refreshArtifactLocations",
    "refreshCatalog",
    "recordIntegrity",
    "restoreDrafts",
    "restorePending",
    "flushPending",
    "checkHelper",
    "scheduleRecoveryBackup",
  ],
  used = new Set();
walk(acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual([...used].sort(), fields.slice().sort());
const ast = acorn.parse(core, { ecmaVersion: 2022, sourceType: "module" }),
  entries = ast.body.flatMap((n) => (n.declaration || n).declarations || []),
  e = entries.find((n) => n.id.name === "writerStartup");
assert.equal(e.init.callee.name, "createWriterStartup");
assert.deepEqual(new Set(serviceComposition(e.init.arguments[0]).properties.map((p) => p.key.name)), used);
assert.ok(core.indexOf('document.documentElement.lang = "en"') < e.start);
assert.ok(e.end < core.indexOf('if (typeof bootStorage === "function") bootStorage();'));
assert.ok(!fs.existsSync(path.join(dir, "case_files.js")));
for (const p of serviceComposition(e.init.arguments[0]).properties)
  if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
  else assert.equal(p.value.body.callee.name, p.key.name);
(async () => {
  const built = await esbuild.build({
    stdin: { contents: "export {createWriterStartup} from './writer_startup.js';export {WriterState} from './state.js';", resolveDir: dir },
    bundle: true,
    format: "cjs",
    write: false,
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createWriterStartup, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  createWriterStartup(new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  assert.deepEqual(s, {});
  const order = [
    "initWriterHandoff",
    "checkHelper",
    "refreshCatalog",
    "restoreCaseFolder",
    "restorePending",
    "restoreDrafts",
    "integrity",
    "refreshArtifactLocations",
    "flushPending",
    "markWriterReady",
    "scheduleRecoveryBackup",
  ];
  let calls = [],
    failure = "",
    pause = "",
    release,
    helper = true,
    nav = {},
    dom,
    lockFinished = false;
  const reset = () => {
    calls = [];
    failure = "";
    pause = "";
    helper = true;
    nav = {};
    lockFinished = false;
    dom = new JSDOM('<div id="app"></div>');
    for (const key of Object.keys(s)) delete s[key];
    Object.assign(s, { HELPER: true, WORKSPACE_RESTORED: false, WRITER_ACCESS: false, releaseWriterReady: (v) => calls.push(["settle", v]) });
  };
  const run = (name) => {
    calls.push([name, s.WORKSPACE_RESTORED]);
    if (name === "checkHelper") s.HELPER = helper;
    if (name === failure) throw Error("failure:" + name);
    if (name === pause) return new Promise((r) => (release = r));
  };
  const services = {
    get navigator() {
      return nav;
    },
    get document() {
      return dom.window.document;
    },
    get location() {
      return { reload: () => calls.push(["reload"]) };
    },
    get recordIntegrity() {
      return { refresh: () => run("integrity") };
    },
    markWriterFailed: (err) => calls.push(["failed", err.message]),
  };
  for (const name of fields.filter((x) => !["navigator", "document", "location", "recordIntegrity", "markWriterFailed"].includes(x)))
    services[name] = () => run(name);
  const startup = createWriterStartup(services);
  reset();
  await startup.bootStorage();
  assert.deepEqual(
    calls.map((c) => c[0]),
    order,
  );
  assert.equal(s.WRITER_ACCESS, true);
  assert.equal(s.WORKSPACE_RESTORED, true);
  assert.equal(calls.find((c) => c[0] === "restoreDrafts")[1], false);
  assert.equal(calls.find((c) => c[0] === "integrity")[1], true);
  reset();
  helper = false;
  await startup.bootStorage();
  assert.deepEqual(
    calls.map((c) => c[0]),
    order.filter((n) => !["refreshCatalog", "scheduleRecoveryBackup"].includes(n)),
  );
  for (const checkpoint of ["restoreCaseFolder", "restorePending", "restoreDrafts", "integrity", "flushPending"]) {
    reset();
    pause = checkpoint;
    let done = false;
    const pending = startup.bootStorage().then(() => (done = true));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.equal(done, false);
    assert.equal(calls.at(-1)[0], checkpoint);
    assert.equal(s.WORKSPACE_RESTORED, ["integrity", "flushPending"].includes(checkpoint));
    assert.ok(!calls.some((c) => c[0] === "markWriterReady"));
    release();
    await pending;
    assert.equal(calls.at(-1)[0], "scheduleRecoveryBackup");
  }
  for (const checkpoint of order) {
    reset();
    failure = checkpoint;
    await startup.bootStorage();
    assert.deepEqual(
      calls.map((c) => c[0]),
      order.slice(0, order.indexOf(checkpoint) + 1).concat("failed"),
    );
    assert.equal(calls.at(-1)[1], "failure:" + checkpoint);
    assert.equal(s.WORKSPACE_RESTORED, order.indexOf(checkpoint) >= order.indexOf("integrity"));
  }
  // The independent acquisition promise resolves before the browser-held lock callback's lifetime ends.
  reset();
  nav = {
    locks: {
      request(name, options, callback) {
        assert.equal(name, "madison-writer-workspace");
        assert.deepEqual(options, { ifAvailable: true });
        calls.push(["lock", s.WRITER_ACCESS]);
        return Promise.resolve(callback({ name })).then(() => (lockFinished = true));
      },
    },
  };
  await startup.bootStorage();
  assert.equal(calls[0][1], false);
  assert.equal(typeof s.releaseWorkspaceLock, "function");
  assert.equal(lockFinished, false);
  assert.equal(s.WRITER_ACCESS, true);
  s.releaseWorkspaceLock();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(lockFinished, true);
  for (const reject of [false, true]) {
    reset();
    nav = { locks: { request: (_, __, callback) => (reject ? Promise.reject(Error("lock refusal")) : Promise.resolve(callback(null))) } };
    await startup.bootStorage();
    assert.deepEqual(calls, [["settle", false]]);
    assert.equal(s.STARTUP_STATUS, "locked");
    assert.equal(s.WRITER_ACCESS, false);
    assert.equal(s.WORKSPACE_RESTORED, false);
    assert.match(dom.window.document.getElementById("app").textContent, /already open/);
    assert.equal(dom.window.document.querySelector("a").getAttribute("href"), "madison-reports.html");
    dom.window.document.querySelector("[data-reload-tab]").click();
    assert.deepEqual(calls.at(-1), ["reload"]);
  }
  reset();
  nav = {
    get locks() {
      throw Error("capability lookup failed");
    },
  };
  await startup.bootStorage();
  assert.deepEqual(calls, [["failed", "capability lookup failed"]]);
  console.log(
    JSON.stringify({
      passed: true,
      inputs: 15,
      inertConstruction: true,
      originalInvocationCheckpoint: true,
      lockLifetimeAndRefusal: true,
      restoreBarriers: true,
      allStageFailures: true,
      helperBranches: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
