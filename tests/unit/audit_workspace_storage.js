const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Device database access and draft persistence remain independently loadable and ordered. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, visit) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, visit));
  visit(n);
  Object.values(n).forEach((c) => walk(c, visit));
}
const declarations = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
const interfaces = {
  workspace_database: ["IDB_OK", "indexedDB"],
  draft_persistence: [
    "recordIntegrity",
    "captureWork",
    "updateSaveStatus",
    "scheduleRecoveryBackup",
    "IDB_OK",
    "idbGet",
    "idbSet",
    "project",
    "render",
    "toast",
  ],
};
for (const [file, fields] of Object.entries(interfaces)) {
  const used = new Set();
  walk(parse(file), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") {
      assert.equal(n.computed, false);
      used.add(n.property.name);
    }
  });
  assert.deepEqual([...used].sort(), fields.slice().sort());
  const name = file === "workspace_database" ? "workspaceDatabase" : "draftPersistence",
    entry = declarations.find((n) => n.id.name === name);
  assert.equal(entry.init.callee.name, file === "workspace_database" ? "createWorkspaceDatabase" : "createDraftPersistence");
  assert.deepEqual(new Set(serviceComposition(entry.init.arguments[0]).properties.map((p) => p.key.name)), used);
  assert.ok(declarations.indexOf(entry) > declarations.findIndex((n) => n.id.name === "correctionWorkflow"));
  assert.ok(declarations.indexOf(entry) < declarations.findIndex((n) => n.id.name === "documentRenderer"));
  for (const p of serviceComposition(entry.init.arguments[0]).properties) {
    if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
    else {
      assert.equal(p.value.type, "ArrowFunctionExpression");
      assert.equal(p.value.body.callee.name, p.key.name);
    }
  }
}
assert.ok(declarations.findIndex((n) => n.id.name === "workspaceDatabase") < declarations.findIndex((n) => n.id.name === "draftPersistence"));
const clone = (v) => JSON.parse(JSON.stringify(v)),
  tick = () => new Promise(setImmediate);
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createWorkspaceDatabase} from './workspace_database.js'; export {createDraftPersistence} from './draft_persistence.js'; export {WriterState} from './state.js';",
      resolveDir: dir,
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
  const { createWorkspaceDatabase, createDraftPersistence, WriterState: state } = box.exports;
  assert.deepEqual(state, {});
  const unavailable = new Proxy({}, { get: (_, k) => assert.fail("premature dependency " + String(k)) });
  createWorkspaceDatabase(unavailable);
  createDraftPersistence(unavailable);
  assert.deepEqual(state, {});
  let capable = false,
    dbCalls = [],
    openRequests = [],
    readRequest,
    transaction,
    exists = false,
    closeThrows = false;
  const database = {
    objectStoreNames: { contains: (n) => n === "kv" && exists },
    createObjectStore: (n) => {
      dbCalls.push(["create", n]);
      exists = true;
    },
    close: () => {
      dbCalls.push(["close"]);
      if (closeThrows) throw new Error("already closed");
    },
    transaction: (name, mode) => {
      dbCalls.push(["transaction", name, mode]);
      transaction = {
        objectStore: (store) => {
          assert.equal(store, "kv");
          return {
            get: (key) => {
              dbCalls.push(["get", key]);
              readRequest = {};
              return readRequest;
            },
            put: (value, key) => dbCalls.push(["put", key, value]),
          };
        },
      };
      return transaction;
    },
  };
  const api = createWorkspaceDatabase({
    get IDB_OK() {
      return capable;
    },
    get indexedDB() {
      return {
        open: (name, version) => {
          dbCalls.push(["open", name, version]);
          const request = { result: database };
          openRequests.push(request);
          return request;
        },
      };
    },
  });
  await assert.rejects(api.idb(), /no indexeddb/);
  assert.equal(state.IDBCONN, null);
  assert.deepEqual(dbCalls, []);
  capable = true;
  const first = api.idb();
  assert.equal(api.idb(), first);
  assert.equal(openRequests.length, 1);
  openRequests[0].onupgradeneeded();
  openRequests[0].onupgradeneeded();
  assert.deepEqual(dbCalls.slice(0, 2), [
    ["open", "madison-doc-writer", 1],
    ["create", "kv"],
  ]);
  openRequests[0].onsuccess();
  assert.equal(await first, database);
  let read = api.idbGet("drafts", true);
  await tick();
  readRequest.result = { kept: true };
  readRequest.onsuccess();
  assert.deepEqual(await read, { kept: true });
  assert.ok(dbCalls.some((c) => c[0] === "transaction" && c[2] === "readonly"));
  let write = api.idbSet("drafts", { draft: "one" }),
    settled = false;
  write.then(() => {
    settled = true;
  });
  await tick();
  assert.equal(settled, false, "put is not transaction completion");
  assert.deepEqual(dbCalls.at(-1), ["put", "drafts", { draft: "one" }]);
  transaction.oncomplete();
  assert.equal(await write, true);
  for (const event of ["onerror", "onabort"]) {
    write = api.idbSet("drafts", {});
    await tick();
    transaction.error = new Error(event);
    transaction[event]();
    assert.equal(await write, false);
    assert.equal(state.IDBCONN, null);
    const reopened = api.idb();
    openRequests.at(-1).onsuccess();
    await reopened;
  }
  read = api.idbGet("optional");
  await tick();
  readRequest.error = new Error("read failed");
  readRequest.onerror();
  assert.equal(await read, undefined);
  assert.equal(state.IDBCONN, null);
  let reopened = api.idb();
  openRequests.at(-1).onsuccess();
  await reopened;
  read = api.idbGet("required", true);
  await tick();
  readRequest.error = new Error("required read failed");
  readRequest.onerror();
  await assert.rejects(read, /required read failed/);
  assert.equal(state.IDBCONN, null);
  reopened = api.idb();
  openRequests.at(-1).error = new Error("open failed");
  openRequests.at(-1).onerror();
  await assert.rejects(reopened, /open failed/);
  assert.equal(state.IDBCONN, null);
  reopened = api.idb();
  openRequests.at(-1).onsuccess();
  await reopened;
  database.onclose();
  assert.equal(state.IDBCONN, null);
  reopened = api.idb();
  openRequests.at(-1).onsuccess();
  await reopened;
  closeThrows = true;
  database.onversionchange();
  assert.equal(state.IDBCONN, null);
  assert.equal(dbCalls.at(-1)[0], "close");

  let calls = [],
    stored = [],
    pendingWrites = [],
    holdWrites = false,
    backup = null,
    readFails = false,
    integrityHold = null,
    idbOK = true;
  const persistence = createDraftPersistence({
    get recordIntegrity() {
      return {
        snapshot: () => ({ proof: "current" }),
        restore: async (records) => {
          calls.push(["integrity", records]);
          if (integrityHold) await integrityHold;
        },
      };
    },
    captureWork: () => calls.push(["capture"]),
    updateSaveStatus: () => calls.push(["status"]),
    scheduleRecoveryBackup: () => calls.push(["backup"]),
    get IDB_OK() {
      return idbOK;
    },
    idbGet: async (key, required) => {
      calls.push(["read", key, required]);
      if (readFails) throw new Error("draft read failed");
      return backup;
    },
    idbSet: async (key, value) => {
      calls.push(["write", key]);
      stored.push(value);
      if (holdWrites) return new Promise((resolve) => pendingWrites.push(resolve));
      return true;
    },
    project: () => calls.push(["project"]),
    render: () => calls.push(["render"]),
    toast: (text) => calls.push(["toast", text]),
  });
  function reset() {
    calls = [];
    stored = [];
    pendingWrites = [];
    holdWrites = false;
    backup = null;
    readFails = false;
    integrityHold = null;
    idbOK = true;
    Object.assign(state, {
      WRITER_ACCESS: true,
      WORKSPACE_RESTORED: true,
      WRITER_READY: false,
      WORK_PATCH: null,
      LOCAL_CHANGED: 0,
      LOCAL_SAVE: { ok: true, at: "previous", saving: false },
      LOCAL_SAVE_CHAIN: Promise.resolve(),
      DIRTY: true,
      draftTimer: null,
      CASES: [{ id: "case", number: "BLD2026-00001" }],
      DOCS: [
        { id: "draft", caseId: "case", draft: true, text: "first" },
        { id: "issued", caseId: "case", draft: false },
      ],
      REINSP: [
        { id: "visit", caseId: "case", draft: true },
        { id: "recorded", caseId: "case", draft: false },
      ],
      EVENTS: { case: [{ id: "event", at: "2026-10-20T12:00:00Z" }] },
      WORK: { entry: { value: "first" }, recordForms: {} },
      RECORD_ATTEMPTS: { held: { id: "attempt" } },
      SAVE_CHECKPOINTS: { case: { case: { owner: "Before" } } },
      seq: 4,
      state: {},
    });
  }
  reset();
  const bundle = persistence.draftBundle();
  assert.deepEqual(
    bundle.docs.map((d) => d.id),
    ["draft"],
  );
  assert.deepEqual(
    bundle.reinsp.map((r) => r.id),
    ["visit"],
  );
  assert.equal(bundle.cases[0], state.CASES[0]);
  assert.equal(bundle.docs[0], state.DOCS[0], "bundle retains the original shallow shape; save isolates it");
  assert.notEqual(bundle.work, state.WORK);
  assert.notEqual(bundle.events.case, state.EVENTS.case);
  assert.deepEqual(bundle.integrityRecords, { proof: "current" });
  state.WRITER_ACCESS = false;
  assert.equal(await persistence.saveDrafts(), false);
  assert.deepEqual(calls, []);
  state.WRITER_ACCESS = true;
  state.WORKSPACE_RESTORED = false;
  assert.equal(await persistence.saveDrafts(), false);
  assert.deepEqual(calls, []);
  reset();
  let releasePatch;
  state.WORK_PATCH = new Promise((r) => {
    releasePatch = r;
  });
  const patched = persistence.saveDrafts();
  await tick();
  assert.deepEqual(calls, []);
  state.WORK.entry.value = "after patch";
  releasePatch();
  assert.equal(await patched, true);
  assert.equal(stored[0].work.entry.value, "after patch");
  assert.ok(calls.findIndex((c) => c[0] === "capture") < calls.findIndex((c) => c[0] === "write"));
  reset();
  holdWrites = true;
  const old = persistence.saveDrafts();
  await tick();
  state.DOCS[0].text = "second";
  const latest = persistence.saveDrafts();
  await tick();
  assert.equal(stored.length, 1, "the second write stays queued");
  assert.equal(stored[0].docs[0].text, "first", "the captured draft is isolated from later edits");
  pendingWrites[0](true);
  assert.equal(await old, true);
  await tick();
  assert.equal(stored.length, 2);
  assert.equal(stored[1].docs[0].text, "second");
  assert.equal(state.LOCAL_SAVE.saving, true);
  assert.equal(state.DIRTY, true);
  assert.equal(
    calls.some((c) => c[0] === "backup"),
    false,
    "a stale success must not schedule the latest backup",
  );
  pendingWrites[1](false);
  assert.equal(await latest, false);
  assert.equal(state.LOCAL_SAVE.ok, false);
  assert.equal(state.LOCAL_SAVE.at, "previous");
  assert.equal(state.DIRTY, true);
  holdWrites = false;
  assert.equal(await persistence.saveDrafts(), true);
  assert.equal(state.LOCAL_SAVE.ok, true);
  assert.equal(state.DIRTY, false);
  assert.equal(calls.filter((c) => c[0] === "backup").length, 1);
  reset();
  state.WORKSPACE_RESTORED = false;
  backup = {
    cases: [{ id: "restored", number: "BLD2026-00002" }],
    docs: [{ id: "restored-doc", caseId: "restored", draft: true, items: [] }],
    reinsp: [{ id: "restored-visit", caseId: "restored", draft: true }],
    events: {
      case: [
        { id: "event", at: "2026-10-20T12:00:00Z" },
        { id: "earlier", at: "2026-10-19T12:00:00Z" },
      ],
    },
    work: { entry: { value: "retained" }, acc: { selection: "retained" } },
    recordAttempts: { old: { id: "pending" } },
    checkpoints: { restored: { case: { owner: "Saved" } } },
    seq: 50,
    integrityRecords: { restored: "proof" },
  };
  let releaseIntegrity;
  integrityHold = new Promise((r) => {
    releaseIntegrity = r;
  });
  const restoring = persistence.restoreDrafts();
  await tick();
  assert.deepEqual(calls[0], ["read", "drafts", true]);
  assert.equal(state.WORK.entry.value, "retained");
  assert.equal(state.state.acc.selection, "retained");
  assert.equal(state.RECORD_ATTEMPTS.old.id, "pending");
  assert.equal(state.SAVE_CHECKPOINTS.restored.case.owner, "Saved");
  assert.equal(state.seq, 50);
  assert.deepEqual(
    state.EVENTS.case.map((e) => e.id),
    ["earlier", "event"],
  );
  assert.equal(
    state.DOCS.some((d) => d.id === "restored-doc"),
    false,
    "retained integrity restores before exposing drafts",
  );
  assert.equal(await persistence.saveDrafts(), false, "restoration does not grant readiness to save");
  releaseIntegrity();
  await restoring;
  assert.ok(state.DOCS.some((d) => d.id === "restored-doc"));
  assert.ok(state.REINSP.some((r) => r.id === "restored-visit"));
  assert.equal(state.WORKSPACE_RESTORED, false, "the startup coordinator owns readiness");
  assert.deepEqual(
    calls.filter((c) => ["integrity", "project", "render", "toast"].includes(c[0])).map((c) => c[0]),
    ["integrity", "project", "render", "toast"],
  );
  reset();
  state.WORKSPACE_RESTORED = false;
  readFails = true;
  await assert.rejects(persistence.restoreDrafts(), /draft read failed/);
  assert.equal(state.WORKSPACE_RESTORED, false);
  assert.equal(
    calls.some((c) => c[0] === "project"),
    false,
  );
  assert.equal(state.DOCS.length, 2);
  console.log(
    JSON.stringify({
      passed: true,
      databaseDependencies: 2,
      draftDependencies: 10,
      inertConstruction: true,
      connectionAndTransactionFailures: true,
      orderedSnapshotsAndRestoreBarrier: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
