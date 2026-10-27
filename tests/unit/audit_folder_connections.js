/* Folder permission/link restoration without Writer startup or native file access. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  f(n);
  Object.values(n).forEach((x) => walk(x, f));
}
const fields = ["FS_OK", "window", "idbSet", "flushPending", "toast", "render", "helperFolder", "CASEDIR_EXPECT", "idbGet"],
  used = new Set();
walk(parse("folder_connections"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual([...used].sort(), fields.slice().sort());
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  e = entries.find((n) => n.id.name === "folderConnections");
assert.equal(e.init.callee.name, "createFolderConnections");
assert.deepEqual(new Set(e.init.arguments[0].properties.map((p) => p.key.name)), used);
assert.ok(entries.indexOf(e) > entries.findIndex((n) => n.id.name === "addressParser"));
assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "caseFolderWorkflow"));
for (const p of e.init.arguments[0].properties)
  if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
  else assert.equal(p.value.body.callee.name, p.key.name);
(async () => {
  const built = await esbuild.build({
    stdin: { contents: "export {createFolderConnections} from './folder_connections.js';export {WriterState} from './state.js';", resolveDir: dir },
    bundle: true,
    format: "cjs",
    write: false,
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createFolderConnections, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  createFolderConnections(new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  assert.deepEqual(s, {});
  let calls = [],
    capable = true,
    expected = "Expected cases",
    stored = null,
    chosen = null,
    helperHandle = {},
    query = "granted",
    request = "granted",
    failure = "",
    hold = "",
    release;
  const stage = async (name, ...args) => {
    calls.push([name, ...args]);
    if (failure === name) throw Error(name + " failed");
    if (hold === name) await new Promise((r) => (release = r));
  };
  const handle = (name) => ({
    name,
    async queryPermission(options) {
      await stage("query", options);
      return query;
    },
    async requestPermission(options) {
      await stage("request", options);
      return request;
    },
  });
  const reset = () => {
    calls = [];
    failure = "";
    hold = "";
    capable = true;
    query = request = "granted";
    expected = "Expected cases";
    stored = null;
    chosen = handle("New folder");
    Object.assign(s, { HELPER: null, CASEDIR: null, DIRNAME: "", NEEDGRANT: false });
  };
  const native = {
    async showDirectoryPicker(options) {
      await stage("picker", options);
      return chosen;
    },
  };
  const service = createFolderConnections({
    get FS_OK() {
      return capable;
    },
    get window() {
      return native;
    },
    idbSet: async (key, value) => {
      await stage("set", key, value);
      stored = value;
    },
    flushPending: () => stage("flush"),
    toast: (m) => calls.push(["toast", m]),
    render: () => calls.push(["render"]),
    helperFolder: () => {
      calls.push(["helper"]);
      return helperHandle;
    },
    get CASEDIR_EXPECT() {
      return expected;
    },
    idbGet: async (key) => {
      await stage("get", key);
      return stored;
    },
  });
  reset();
  capable = false;
  assert.equal(await service.linkCaseFolder(), false);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["toast"],
  );
  calls = [];
  await service.restoreCaseFolder();
  assert.deepEqual(calls, []);
  assert.equal(await service.grantCaseFolder(), false);
  reset();
  hold = "picker";
  const pending = service.linkCaseFolder();
  assert.equal(calls[0][0], "picker", "picker is invoked in click's synchronous path");
  assert.deepEqual(calls[0][1], { id: "madison-cases", mode: "readwrite" });
  assert.equal(s.CASEDIR, null);
  release();
  assert.equal(await pending, true);
  assert.equal(s.CASEDIR, chosen);
  assert.equal(s.DIRNAME, "New folder");
  assert.equal(s.NEEDGRANT, false);
  assert.equal(stored, chosen);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["picker", "set", "flush", "toast", "render"],
  );
  assert.match(calls[3][1], /Linked to New folder/);
  reset();
  s.DIRNAME = "Old folder";
  await service.linkCaseFolder();
  assert.match(calls.find((c) => c[0] === "toast")[1], /New folder instead of Old folder/);
  for (const checkpoint of ["picker", "set", "flush"]) {
    reset();
    failure = checkpoint;
    assert.equal(await service.linkCaseFolder(), false);
    assert.ok(!calls.some((c) => c[0] === "render"));
    if (checkpoint !== "picker") {
      assert.equal(s.CASEDIR, chosen);
      assert.equal(s.NEEDGRANT, false);
    }
  }
  reset();
  hold = "set";
  const beforeWrite = service.linkCaseFolder();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  assert.equal(s.CASEDIR, chosen);
  assert.ok(!calls.some((c) => c[0] === "flush"));
  release();
  await beforeWrite;
  reset();
  await service.restoreCaseFolder();
  assert.deepEqual(calls, [["get", "casedir"]]);
  assert.equal(s.CASEDIR, null);
  for (const permission of ["granted", "prompt", "denied"]) {
    reset();
    stored = handle("Retained folder");
    query = permission;
    await service.restoreCaseFolder();
    assert.equal(s.CASEDIR, stored);
    assert.equal(s.DIRNAME, "Retained folder");
    assert.equal(s.NEEDGRANT, permission !== "granted");
    assert.deepEqual(
      calls.map((c) => c[0]),
      ["get", "query", "render"],
    );
    assert.deepEqual(calls[1][1], { mode: "readwrite" });
  }
  reset();
  stored = handle("");
  failure = "query";
  await service.restoreCaseFolder();
  assert.equal(s.DIRNAME, "case folder");
  assert.equal(s.NEEDGRANT, true);
  assert.equal(calls.at(-1)[0], "render");
  reset();
  failure = "get";
  await assert.rejects(service.restoreCaseFolder(), /get failed/);
  for (const quiet of [true, false])
    for (const permission of ["granted", "denied"]) {
      reset();
      s.CASEDIR = handle("Reconnected");
      s.DIRNAME = "Reconnected";
      s.NEEDGRANT = true;
      request = permission;
      assert.equal(await service.grantCaseFolder(quiet), permission === "granted");
      assert.equal(s.NEEDGRANT, permission !== "granted");
      assert.deepEqual(
        calls.map((c) => c[0]),
        quiet ? ["request"] : permission === "granted" ? ["request", "toast", "flush", "render"] : ["request", "render"],
      );
      assert.deepEqual(calls[0][1], { mode: "readwrite" });
    }
  reset();
  s.CASEDIR = handle("Reconnected");
  s.NEEDGRANT = true;
  failure = "request";
  assert.equal(await service.grantCaseFolder(), false);
  assert.equal(s.NEEDGRANT, true);
  reset();
  s.CASEDIR = handle("Reconnected");
  failure = "flush";
  assert.equal(await service.grantCaseFolder(false), false);
  assert.equal(s.NEEDGRANT, false, "retain original partial state after flush failure");
  assert.ok(!calls.some((c) => c[0] === "render"));
  reset();
  capable = false;
  s.HELPER = { caseStore: true, caseDir: "Shared helper folder" };
  await service.restoreCaseFolder();
  assert.equal(s.CASEDIR, helperHandle);
  assert.equal(s.DIRNAME, expected);
  assert.equal(s.NEEDGRANT, false);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["helper", "render"],
  );
  calls = [];
  assert.equal(await service.linkCaseFolder(), true);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["helper", "render", "flush", "toast"],
  );
  assert.equal(calls.at(-1)[1], "Using Shared helper folder");
  calls = [];
  failure = "flush";
  await assert.rejects(service.linkCaseFolder(), /flush failed/);
  assert.ok(!calls.some((c) => c[0] === "picker"));
  reset();
  stored = handle("Replaced retained folder");
  await service.restoreCaseFolder();
  assert.equal(s.DIRNAME, "Replaced retained folder");
  console.log(
    JSON.stringify({
      passed: true,
      inputs: 9,
      inertConstruction: true,
      synchronousPicker: true,
      permissionAndHelperRouting: true,
      persistenceFlushOrder: true,
      originalFailureState: true,
      quietGrantSemantics: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
