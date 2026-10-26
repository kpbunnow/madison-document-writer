/* Automatic recovery snapshots and serialized latest-state writes, without Writer startup. */
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
  if (Array.isArray(n)) return n.forEach((c) => walk(c, f));
  f(n);
  Object.values(n).forEach((c) => walk(c, f));
}
const used = new Set();
walk(parse("automatic_recovery"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual(
  [...used].sort(),
  [
    "localStorage",
    "RECOVERY_WORKSPACE_KEY",
    "RECOVERY_CASE_KEYS",
    "RECOVERY_WORKSPACE",
    "rnd12",
    "draftBundle",
    "helperJSON",
    "renderRecoveryStatus",
    "setTimeout",
    "clearTimeout",
  ].sort(),
);
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = entries.find((n) => n.id.name === "automaticRecovery");
assert.equal(entry.init.callee.name, "createAutomaticRecovery");
assert.deepEqual(new Set(entry.init.arguments[0].properties.map((p) => p.key.name)), used);
assert.ok(entries.indexOf(entry) > entries.findIndex((n) => n.id.name === "workspaceBackup"));
assert.ok(entries.indexOf(entry) < entries.findIndex((n) => n.id.name === "documentRenderer"));
assert.ok(entries.indexOf(entry) < entries.findIndex((n) => n.id.name === "RECOVERY_WORKSPACE"));
for (const p of entry.init.arguments[0].properties) {
  if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
  else {
    assert.equal(p.value.type, "ArrowFunctionExpression");
    assert.equal(p.value.body.callee.name, p.key.name);
  }
}
const copy = (v) => JSON.parse(JSON.stringify(v)),
  tick = () => new Promise(setImmediate);
(async () => {
  const built = await esbuild.build({
    stdin: { contents: "export {createAutomaticRecovery} from './automatic_recovery.js'; export {WriterState} from './state.js';", resolveDir: dir },
    define: { __TEST_BUILD__: "false" },
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
  const { createAutomaticRecovery, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  createAutomaticRecovery(new Proxy({}, { get: (_, k) => assert.fail("premature service " + String(k)) }));
  assert.deepEqual(s, {});
  let store, storageFailure, randomCalls, workspace, timers, nextTimer, cleared, writes, failCase, blockCase, release, renderCalls, renderThrow;
  const services = {
    get localStorage() {
      if (storageFailure === "access") throw Error("blocked");
      return {
        getItem(k) {
          if (storageFailure === "read") throw Error("read failed");
          return store[k] ?? null;
        },
        setItem(k, v) {
          if (storageFailure === "write") throw Error("write failed");
          store[k] = v;
        },
      };
    },
    get RECOVERY_WORKSPACE_KEY() {
      return "workspace-key";
    },
    get RECOVERY_CASE_KEYS() {
      return "case-keys";
    },
    get RECOVERY_WORKSPACE() {
      return workspace;
    },
    rnd12() {
      randomCalls++;
      return randomCalls.toString(16).padStart(16, "0");
    },
    draftBundle() {
      return {
        docs: s.DOCS.filter((d) => d.draft),
        reinsp: s.REINSP.filter((r) => r.draft),
        integrityRecords: [
          { case: { number: "BLD2026-00001" }, proof: "first" },
          { case: { number: "BLD2026-00002" }, proof: "second" },
        ],
        seq: s.seq,
      };
    },
    async helperJSON(url, job) {
      assert.equal(url, "/draft-backups/write");
      writes.push(copy(job));
      if (job.case === blockCase) await new Promise((r) => (release = r));
      if (job.case === failCase) throw Error("helper failed");
      return { ok: true };
    },
    renderRecoveryStatus() {
      renderCalls++;
      if (renderThrow) {
        renderThrow = false;
        throw Error("render failed");
      }
    },
    setTimeout(fn, ms) {
      assert.equal(ms, 700);
      const id = ++nextTimer;
      timers.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      cleared.push(id);
      timers.delete(id);
    },
  };
  const api = createAutomaticRecovery(services);
  assert.equal("recoveryIncluded" in api, false);
  function reset() {
    store = {};
    storageFailure = "";
    randomCalls = 0;
    workspace = "a".repeat(32);
    timers = new Map();
    nextTimer = 0;
    cleared = [];
    writes = [];
    failCase = null;
    blockCase = null;
    release = null;
    renderCalls = 0;
    renderThrow = false;
    Object.assign(s, {
      CASES: [
        { id: "one", number: "BLD2026-00001" },
        { id: "two", number: "BLD2026-00002" },
      ],
      DOCS: [
        { id: "draft", caseId: "one", draft: true, items: [{ id: "item", sections: [] }] },
        { id: "issued", caseId: "two", draft: false },
      ],
      REINSP: [{ id: "visit", caseId: "one", draft: true, results: { item: { oc: "open" } } }],
      EVENTS: { one: [{ id: "event", payload: { retained: "history" } }], two: [] },
      RECORD_ATTEMPTS: { a: { cid: "one", pendingAmendment: { type: "document.annotated" } }, b: { cid: "two" } },
      SAVE_CHECKPOINTS: { one: { case: { id: "one" } } },
      WORK: {
        entry: {},
        recordForms: { "draft:action": { text: "typed" }, "issued:action": { text: "other" } },
        walk: { context: "one|visit", item: "item" },
      },
      PENDING: [
        { cid: "one", body: "retained" },
        { cid: "two", body: "other" },
      ],
      seq: 12,
      state: { acc: null },
      HELPER: true,
      RECOVERY_SIGNATURES: {},
      RECOVERY: { at: "", error: "" },
      RECOVERY_TIMER: null,
      RECOVERY_NEXT: null,
      RECOVERY_BUSY: false,
    });
  }
  function fire() {
    const id = s.RECOVERY_TIMER,
      fn = timers.get(id);
    assert.ok(fn);
    timers.delete(id);
    fn();
  }
  reset();
  const first = api.recoveryWorkspace();
  assert.match(first, /^[a-f0-9]{32}$/);
  assert.equal(api.recoveryWorkspace(), first);
  assert.equal(randomCalls, 2);
  store["workspace-key"] = "bad";
  assert.notEqual(api.recoveryWorkspace(), first);
  const key = api.recoveryCaseKey("one");
  assert.equal(api.recoveryCaseKey("one"), key);
  assert.notEqual(api.recoveryCaseKey("two"), key);
  const map = JSON.parse(store["case-keys"]);
  assert.equal(map.one, key);
  store["case-keys"] = "{";
  assert.equal(api.recoveryCaseKey("one"), null);
  for (const failure of ["access", "read", "write"]) {
    reset();
    storageFailure = failure;
    assert.equal(api.recoveryWorkspace(), null);
    assert.equal(api.recoveryCaseKey("one"), null);
  }
  reset();
  let snapshot = api.recoverySnapshot("one", "b".repeat(32));
  assert.equal(snapshot.format, "madison-draft-recovery");
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.workspace, workspace);
  assert.deepEqual(snapshot.included, [
    "1 document draft(s)",
    "1 worksheet(s)",
    "1 record form(s)",
    "1 pending correction/record action(s)",
    "1 held shared operation(s)",
  ]);
  assert.deepEqual(snapshot.bundle.cases, [s.CASES[0]]);
  assert.deepEqual(snapshot.bundle.integrityRecords, [{ case: { number: "BLD2026-00001" }, proof: "first" }]);
  assert.deepEqual(Object.keys(snapshot.bundle.events), ["one"]);
  assert.deepEqual(Object.keys(snapshot.bundle.recordAttempts), ["a"]);
  assert.deepEqual(Object.keys(snapshot.bundle.work.recordForms), ["draft:action"]);
  assert.equal(snapshot.bundle.work.acc, null);
  assert.deepEqual(snapshot.bundle.work.entry, {});
  assert.deepEqual(snapshot.pending, [s.PENDING[0]]);
  s.CASES[0].number = "later";
  s.DOCS[0].items[0].sections.push("later");
  s.EVENTS.one[0].payload.retained = "later";
  s.PENDING[0].body = "later";
  assert.equal(snapshot.bundle.cases[0].number, "BLD2026-00001");
  assert.deepEqual(snapshot.bundle.docs[0].items[0].sections, []);
  assert.equal(snapshot.bundle.events.one[0].payload.retained, "history");
  assert.equal(snapshot.pending[0].body, "retained"); // Existing attempt/form values are intentionally retained references, not a new all-fields deep-clone guarantee.
  reset();
  s.WORK.walk = { context: "two|else" };
  assert.equal(api.recoverySnapshot("one", "key").bundle.work.walk, null);
  let jobs = api.recoveryJobs();
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].backup.number, "BLD2026-00001");
  s.WORK.entry["lookup-number"] = " BLD2026-00003 ";
  jobs = api.recoveryJobs();
  assert.equal(jobs.length, 3);
  const importing = jobs.at(-1);
  assert.equal(importing.case, "0".repeat(32));
  assert.deepEqual(importing.backup.bundle.cases, []);
  assert.deepEqual(importing.backup.bundle.work, s.WORK);
  s.WORK.entry["lookup-number"] = "later";
  assert.equal(importing.backup.bundle.work.entry["lookup-number"], " BLD2026-00003 ");
  workspace = null;
  assert.throws(() => api.recoveryJobs(), /workspace identity/);
  workspace = "a".repeat(32);
  storageFailure = "write";
  store = {};
  assert.throws(() => api.recoveryJobs(), /Case backup identity/);
  reset();
  jobs = api.recoveryJobs();
  failCase = jobs[0].case;
  await api.backupUnfinished(jobs);
  assert.equal(writes.length, 2);
  assert.match(s.RECOVERY.error, /BLD2026-00001: helper failed/);
  assert.equal(s.RECOVERY_SIGNATURES[workspace + "|" + failCase], undefined);
  assert.ok(s.RECOVERY_SIGNATURES[workspace + "|" + jobs[1].case]);
  failCase = null;
  await api.backupUnfinished(jobs);
  assert.equal(writes.length, 3);
  assert.equal(s.RECOVERY.error, "");
  await api.backupUnfinished(jobs.map((j) => ({ ...j, backup: { ...j.backup, at: "new timestamp" } })));
  assert.equal(writes.length, 3);
  s.RECOVERY.error = "prior";
  await api.backupUnfinished([]);
  assert.equal(s.RECOVERY.error, "prior");
  reset();
  s.HELPER = false;
  api.scheduleRecoveryBackup();
  assert.equal(timers.size, 0);
  s.HELPER = true;
  api.scheduleRecoveryBackup();
  const timer = s.RECOVERY_TIMER;
  api.scheduleRecoveryBackup();
  assert.ok(cleared.includes(timer));
  assert.equal(timers.size, 1);
  // Hold the first helper write; later scheduled saves replace queued snapshots, never overlap writes.
  reset();
  s.CASES = s.CASES.slice(0, 1);
  blockCase = api.recoveryCaseKey("one");
  api.scheduleRecoveryBackup();
  fire();
  await tick();
  assert.equal(s.RECOVERY_BUSY, true);
  assert.equal(writes.length, 1);
  s.DOCS[0].items[0].text = "middle";
  api.scheduleRecoveryBackup();
  fire();
  assert.equal(writes.length, 1);
  s.DOCS[0].items[0].text = "latest";
  api.scheduleRecoveryBackup();
  fire();
  assert.equal(writes.length, 1);
  blockCase = null;
  release();
  await tick();
  await tick();
  assert.equal(writes.length, 2);
  assert.equal(writes[1].backup.bundle.docs[0].items[0].text, "latest");
  assert.equal(s.RECOVERY_BUSY, false);
  assert.equal(s.RECOVERY_NEXT, null);
  assert.equal(renderCalls, 2);
  reset();
  workspace = null;
  api.scheduleRecoveryBackup();
  fire();
  assert.match(s.RECOVERY.error, /workspace identity/);
  assert.equal(s.RECOVERY_BUSY, false);
  assert.equal(writes.length, 0);
  assert.equal(renderCalls, 1);
  reset();
  s.CASES = s.CASES.slice(0, 1);
  renderThrow = true;
  api.scheduleRecoveryBackup();
  fire();
  await tick();
  await tick();
  assert.equal(s.RECOVERY_BUSY, false);
  assert.equal(s.RECOVERY.error, "render failed");
  assert.equal(renderCalls, 2);
  console.log(
    JSON.stringify({
      passed: true,
      dependencies: used.size,
      inertConstruction: true,
      scopedSnapshots: true,
      retryAndDeduplication: true,
      serializedLatestState: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
