/* Shared writes, held-save retry and case-save orchestration preserve distinct authority and ordering. */
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
  shared_case_storage: {
    name: "sharedCaseStorage",
    ctor: "createSharedCaseStorage",
    fields: ["CASEDIR_EXPECT", "helperJSON", "recordIntegrity", "COMMITTED", "mergeCaseEvents", "project"],
  },
  pending_case_saves: {
    name: "pendingCaseSaves",
    ctor: "createPendingCaseSaves",
    fields: [
      "idbSet",
      "toast",
      "idbGet",
      "IDB_OK",
      "render",
      "loadCaseFile",
      "mergeSharedFile",
      "caseFile",
      "writeToFolder",
      "rememberSaved",
      "writeSummary",
      "saveDrafts",
    ],
  },
  case_save_workflow: {
    name: "caseSaveWorkflow",
    ctor: "createCaseSaveWorkflow",
    fields: [
      "caseNumberAllowed",
      "caseFile",
      "downloadWorkspace",
      "rememberSaved",
      "downloadFile",
      "toast",
      "render",
      "grantCaseFolder",
      "mergeSharedFile",
      "queuePending",
      "writeToFolder",
      "idbSet",
      "writeSummary",
      "saveDrafts",
    ],
  },
};
let prior = declarations.findIndex((n) => n.id.name === "draftPersistence");
for (const [file, spec] of Object.entries(interfaces)) {
  const used = new Set();
  walk(parse(file), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") {
      assert.equal(n.computed, false);
      used.add(n.property.name);
    }
  });
  assert.deepEqual([...used].sort(), spec.fields.slice().sort());
  const entry = declarations.find((n) => n.id.name === spec.name);
  assert.equal(entry.init.callee.name, spec.ctor);
  assert.deepEqual(new Set(entry.init.arguments[0].properties.map((p) => p.key.name)), used);
  assert.ok(declarations.indexOf(entry) > prior);
  assert.ok(declarations.indexOf(entry) < declarations.findIndex((n) => n.id.name === "documentRenderer"));
  prior = declarations.indexOf(entry);
  for (const p of entry.init.arguments[0].properties) {
    if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
    else {
      assert.equal(p.value.type, "ArrowFunctionExpression");
      assert.equal(p.value.body.callee.name, p.key.name);
    }
  }
}
const clone = (v) => JSON.parse(JSON.stringify(v)),
  tick = () => new Promise(setImmediate);
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createSharedCaseStorage} from './shared_case_storage.js'; export {createPendingCaseSaves} from './pending_case_saves.js'; export {createCaseSaveWorkflow} from './case_save_workflow.js'; export {WriterState} from './state.js'; export {summaryName,caseFileName} from './case_file_rules.js';",
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
  const { createSharedCaseStorage, createPendingCaseSaves, createCaseSaveWorkflow, WriterState: state, summaryName, caseFileName } = box.exports;
  assert.deepEqual(state, {});
  const unavailable = new Proxy({}, { get: (_, k) => assert.fail("premature service read " + String(k)) });
  for (const factory of [createSharedCaseStorage, createPendingCaseSaves, createCaseSaveWorkflow]) factory(unavailable);
  assert.deepEqual(state, {});
  function base() {
    return { id: "case", number: "BLD2026-00001", address: "1 SYNTHETIC ST", owner: "Submitted" };
  }
  function resetState() {
    Object.assign(state, {
      CASES: [base()],
      EVENTS: { case: [] },
      SAVE_CHECKPOINTS: { case: { case: { owner: "Checkpoint" } } },
      CASEDIR: { helper: true },
      NEEDGRANT: false,
      DIRNAME: "Shared cases",
      LASTWRITE: null,
      LASTINDEX: null,
      PENDING: [],
      DIRTY: true,
      state: {},
    });
  }
  let calls = [],
    committed = new Map(),
    valid = true,
    verifyFault = false,
    helperFault = false,
    onHelper = () => {},
    helperResult = null;
  const storage = createSharedCaseStorage({
    get CASEDIR_EXPECT() {
      return "Case JSON Files";
    },
    get COMMITTED() {
      return committed;
    },
    get recordIntegrity() {
      return {
        status: () => ({ valid }),
        verify: async (file, proof) => {
          calls.push(["verify", file, proof]);
          if (verifyFault) throw new Error("verification refused");
        },
      };
    },
    helperJSON: async (url, body) => {
      calls.push(["helper", url, body]);
      await onHelper(url, body);
      if (helperFault) throw new Error("helper unavailable");
      return helperResult;
    },
    mergeCaseEvents: (k, file) => calls.push(["merge", k, file]),
    project: () => calls.push(["project"]),
  });
  function resetStorage() {
    resetState();
    calls = [];
    committed = new Map();
    valid = true;
    verifyFault = false;
    helperFault = false;
    onHelper = () => {};
    helperResult = null;
  }
  resetStorage();
  const folder = storage.helperFolder();
  assert.equal(calls.length, 0);
  assert.equal(folder.name, "Case JSON Files");
  assert.equal(await folder.queryPermission(), "granted");
  assert.equal(await folder.requestPermission(), "granted");
  helperResult = { file: { schema: 5, case: base(), events: [] }, revision: "read", name: "retained.json", integrity: { proof: "retained" } };
  const file = await (await folder.getFileHandle("file & name.json")).getFile();
  assert.ok(calls[0][1].endsWith("file%20%26%20name.json"));
  assert.deepEqual(JSON.parse(await file.text()), helperResult.file);
  assert.equal(file.size, (await file.text()).length);
  assert.ok(Number.isFinite(file.lastModified));
  assert.equal(calls[1][0], "verify");
  assert.equal(committed.get(summaryName(base())), helperResult);
  calls = [];
  helperResult = { files: [{ name: "one.json", size: 123, mod: 456 }] };
  for await (const [name, handle] of folder.entries()) {
    assert.equal(name, "one.json");
    assert.deepEqual(await handle.getFile(), { size: 123, lastModified: 456 });
  }
  assert.equal(calls[0][1], "/cases/list");
  resetStorage();
  const submitted = { format: "madison-case-file", schema: 5, case: base(), events: [] },
    key = summaryName(base());
  committed = new Map([[key, { name: "existing.json", revision: "base-revision" }]]);
  helperResult = {
    name: "confirmed.json",
    revision: "new",
    file: { ...clone(submitted), case: { ...base(), owner: "Normalized", address: "NORMALIZED ADDRESS" } },
    integrity: { proof: "save" },
  };
  onHelper = () => {
    state.CASES[0].owner = "Later local edit";
  };
  let result = await storage.writeToFolder("candidate.json", JSON.stringify(submitted));
  assert.equal(result.ok, true);
  const request = calls.find((c) => c[0] === "helper")[2];
  assert.equal(request.baseRevision, "base-revision");
  assert.deepEqual(request.baseCase, { owner: "Checkpoint" });
  assert.equal(request.name, "candidate.json");
  assert.equal(state.CASES[0].owner, "Later local edit");
  assert.equal(state.CASES[0].address, "NORMALIZED ADDRESS");
  assert.equal(committed.get(key), helperResult);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["helper", "verify", "merge", "project"],
  );
  assert.equal(result.file, helperResult.file);
  assert.equal(state.LASTWRITE.name, "confirmed.json");
  resetStorage();
  valid = false;
  result = await storage.writeToFolder("candidate.json", JSON.stringify(submitted));
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
  for (const failure of ["verify", "helper"]) {
    resetStorage();
    helperResult = { name: "confirmed.json", file: submitted };
    verifyFault = failure === "verify";
    helperFault = failure === "helper";
    result = await storage.writeToFolder("candidate.json", JSON.stringify(submitted));
    assert.equal(result.ok, false);
    assert.equal(committed.size, 0);
    assert.equal(
      calls.some((c) => c[0] === "merge"),
      false,
    );
    assert.equal(state.LASTWRITE.ok, false);
  }
  resetStorage();
  assert.equal((await storage.writeIndexFile("unknown.json", "{}")).ok, false);
  assert.equal(calls.length, 0);
  committed.set("known.json", { name: "retained.json", revision: "read-revision" });
  helperResult = { ok: true };
  assert.equal((await storage.writeIndexFile("known.json", '{"summaryVersion":6}')).ok, true);
  assert.deepEqual(calls[0].slice(1), ["/cases/summary", { name: "retained.json", revision: "read-revision", summary: { summaryVersion: 6 } }]);
  resetStorage();
  state.CASEDIR = null;
  assert.equal((await storage.writeToFolder("case.json", JSON.stringify(submitted))).ok, false);
  assert.ok(state.LASTWRITE.why.includes("Schema 5 requires"));
  const legacy = { ...submitted, schema: 4 };
  assert.equal((await storage.writeToFolder("case.json", JSON.stringify(legacy))).why, "no folder linked");
  resetStorage();
  let closeRelease;
  const writes = [];
  state.CASEDIR = {
    getFileHandle: async (name, options) => {
      writes.push(["handle", name, options]);
      return {
        createWritable: async () => ({
          write: async (body) => writes.push(["write", body]),
          close: async () => {
            writes.push(["close"]);
            await new Promise((r) => {
              closeRelease = r;
            });
          },
        }),
      };
    },
  };
  const native = storage.writeToFolder("legacy.json", JSON.stringify(legacy));
  await tick();
  assert.equal(state.LASTWRITE, null, "success waits for the native close");
  assert.equal(writes[2][0], "close");
  closeRelease();
  assert.equal((await native).ok, true);
  assert.equal(state.LASTWRITE.ok, true);
  state.NEEDGRANT = true;
  assert.equal((await storage.writeToFolder("legacy.json", JSON.stringify(legacy))).needGrant, true);
  for (const name of ["NotAllowedError", "SecurityError"]) {
    resetStorage();
    state.CASEDIR = {
      getFileHandle: async () => {
        const error = new Error("denied");
        error.name = name;
        throw error;
      },
    };
    result = await storage.writeToFolder("legacy.json", JSON.stringify(legacy));
    assert.deepEqual(result, { ok: false, why: "permission", needGrant: true });
    assert.equal(state.NEEDGRANT, true);
  }
  resetStorage();
  const indexCalls = [];
  state.CASEDIR = {
    getDirectoryHandle: async (name, options) => {
      indexCalls.push(["directory", name, options]);
      return {
        getFileHandle: async (name) => {
          indexCalls.push(["file", name]);
          return {
            createWritable: async () => ({ write: async (body) => indexCalls.push(["write", body]), close: async () => indexCalls.push(["close"]) }),
          };
        },
      };
    },
  };
  assert.equal((await storage.writeIndexFile("index.json", '{"schema":4}')).ok, true);
  assert.deepEqual(
    indexCalls.map((c) => c[0]),
    ["directory", "file", "write", "close"],
  );
  state.NEEDGRANT = true;
  assert.equal((await storage.writeIndexFile("index.json", "{}")).why, "permission");

  let queueCalls = [],
    storeOK = true,
    restoreValue = null,
    readFails = false,
    failedMerge = "",
    failedWrite = "",
    buildFails = false,
    newlyQueued = null;
  const held = createPendingCaseSaves({
    idbSet: async (key, value) => {
      queueCalls.push(["idb", key, clone(value)]);
      return storeOK;
    },
    toast: (t) => queueCalls.push(["toast", t]),
    idbGet: async (key, required) => {
      queueCalls.push(["read", key, required]);
      if (readFails) throw new Error("pending read failed");
      return restoreValue;
    },
    get IDB_OK() {
      return true;
    },
    render: () => queueCalls.push(["render"]),
    loadCaseFile: (body, saved) => {
      queueCalls.push(["load", body, saved]);
      const k = { ...base(), id: "loaded" };
      state.CASES.push(k);
      return k;
    },
    mergeSharedFile: async (cid, name) => {
      queueCalls.push(["merge", cid, name]);
      if (name === failedMerge) throw new Error("conflict");
    },
    caseFile: (cid) => {
      queueCalls.push(["assemble", cid]);
      if (buildFails) throw new Error("assembly failed");
      return { schema: 5, case: { ...base(), id: cid, owner: "Current work" }, events: [{ id: "current" }] };
    },
    writeToFolder: async (name, body) => {
      queueCalls.push(["write", name, JSON.parse(body)]);
      if (newlyQueued) {
        state.PENDING.push(newlyQueued);
        newlyQueued = null;
      }
      return name === failedWrite
        ? { ok: false, why: "unavailable" }
        : { ok: true, file: { schema: 5, case: base(), events: [{ id: "confirmed" }] } };
    },
    rememberSaved: (k, file) => queueCalls.push(["remember", k, file]),
    writeSummary: async (cid, file) => queueCalls.push(["summary", cid, file]),
    saveDrafts: async () => {
      queueCalls.push(["drafts"]);
      return true;
    },
  });
  function resetHeld() {
    resetState();
    queueCalls = [];
    storeOK = true;
    restoreValue = null;
    readFails = false;
    failedMerge = "";
    failedWrite = "";
    buildFails = false;
    newlyQueued = null;
  }
  resetHeld();
  await held.queuePending("one.json", "old", "case");
  await held.queuePending("other.json", "other", "case");
  await held.queuePending("one.json", "new", "case");
  assert.deepEqual(
    state.PENDING.map((p) => [p.name, p.body]),
    [
      ["other.json", "other"],
      ["one.json", "new"],
    ],
  );
  storeOK = false;
  assert.equal(await held.queuePending("retained.json", "kept", "case"), false);
  assert.ok(state.PENDING.some((p) => p.body === "kept"));
  assert.equal(queueCalls.at(-1)[0], "toast");
  resetHeld();
  restoreValue = [{ name: "restored.json", body: "retained" }];
  await held.restorePending();
  assert.equal(state.PENDING, restoreValue);
  assert.deepEqual(
    queueCalls.map((c) => c[0]),
    ["read", "render"],
  );
  assert.deepEqual(queueCalls[0], ["read", "pending", true]);
  readFails = true;
  await assert.rejects(held.restorePending(), /pending read failed/);
  const stale = () => ({ name: "one.json", cid: "case", body: JSON.stringify({ schema: 5, case: base(), events: [{ id: "old" }] }) });
  resetHeld();
  state.PENDING = [stale()];
  state.CASEDIR = null;
  assert.equal(await held.flushPending(), 0);
  assert.deepEqual(queueCalls, []);
  resetHeld();
  state.CASES.push({ ...base(), id: "other" });
  state.PENDING = [stale(), { ...stale(), name: "failed.json", cid: "other" }];
  failedMerge = "failed.json";
  newlyQueued = { name: "one.json", cid: "case", body: "newer held work" };
  assert.equal(await held.flushPending(), 1);
  const written = queueCalls.find((c) => c[0] === "write");
  assert.equal(written[2].case.owner, "Current work");
  assert.deepEqual(written[2].events, [{ id: "current" }]);
  assert.deepEqual(
    state.PENDING.map((p) => p.body),
    [stale().body, "newer held work"],
  );
  assert.equal(queueCalls.filter((c) => c[0] === "write").length, 1);
  assert.deepEqual(queueCalls.find((c) => c[0] === "summary")[2].events, [{ id: "confirmed" }]);
  assert.ok(queueCalls.findIndex((c) => c[0] === "idb") < queueCalls.findIndex((c) => c[0] === "drafts"));
  resetHeld();
  state.PENDING = [stale()];
  failedWrite = "one.json";
  assert.equal(await held.flushPending(), 0);
  assert.equal(state.PENDING.length, 1);
  assert.equal(
    queueCalls.some((c) => c[0] === "summary"),
    false,
  );
  resetHeld();
  state.PENDING = [{ ...stale(), cid: "" }];
  buildFails = true;
  assert.equal(await held.flushPending(), 1);
  assert.deepEqual(queueCalls.find((c) => c[0] === "load").slice(1), [stale().body, false]);
  assert.equal(queueCalls.find((c) => c[0] === "write")[2].events[0].id, "old", "retain the original serialization fallback behavior");

  let saveCalls = [],
    allowed = true,
    schema = 5,
    buildCount = 0,
    serializationFailure = 0,
    mergeFails = false,
    writeResponses = [],
    granted = true;
  const saving = createCaseSaveWorkflow({
    caseNumberAllowed: () => allowed,
    caseFile: (cid) => {
      buildCount++;
      saveCalls.push(["assemble", cid]);
      if (buildCount === serializationFailure) {
        const cyclic = {};
        cyclic.self = cyclic;
        return cyclic;
      }
      return { schema, case: clone(state.CASES.find((k) => k.id === cid)), events: [] };
    },
    downloadWorkspace: () => saveCalls.push(["backup"]),
    rememberSaved: (k, file) => saveCalls.push(["remember", k, file]),
    downloadFile: (name, body) => saveCalls.push(["download", name, JSON.parse(body)]),
    toast: (t) => saveCalls.push(["toast", t]),
    render: () => saveCalls.push(["render"]),
    grantCaseFolder: async (quiet) => {
      saveCalls.push(["grant", quiet]);
      state.NEEDGRANT = !granted;
      return granted;
    },
    mergeSharedFile: async (cid, name) => {
      saveCalls.push(["merge", cid, name]);
      if (mergeFails) throw new Error("shared record conflict");
      return 2;
    },
    queuePending: async (name, body, cid) => {
      saveCalls.push(["queue", name, body, cid]);
      return true;
    },
    writeToFolder: async (name, body) => {
      saveCalls.push(["write", name, JSON.parse(body)]);
      return writeResponses.shift() || { ok: true };
    },
    idbSet: async (key, value) => {
      saveCalls.push(["idb", key, clone(value)]);
      return true;
    },
    writeSummary: async (cid, file) => saveCalls.push(["summary", cid, file]),
    saveDrafts: async () => {
      saveCalls.push(["drafts"]);
      return true;
    },
  });
  function resetSaving() {
    resetState();
    saveCalls = [];
    allowed = true;
    schema = 5;
    buildCount = 0;
    serializationFailure = 0;
    mergeFails = false;
    writeResponses = [];
    granted = true;
  }
  resetSaving();
  allowed = false;
  assert.equal(await saving.saveCaseFile("case"), false);
  assert.equal(
    saveCalls.some((c) => c[0] === "assemble"),
    false,
  );
  for (const attempt of [1, 2]) {
    resetSaving();
    serializationFailure = attempt;
    assert.equal(await saving.saveCaseFile("case"), false);
    assert.equal(
      saveCalls.some((c) => c[0] === "write"),
      false,
    );
    assert.equal(
      saveCalls.some((c) => c[0] === "queue"),
      false,
    );
    assert.ok(saveCalls.some((c) => c[0] === "toast" && c[1].includes("could not be exported")));
  }
  resetSaving();
  state.CASEDIR = null;
  assert.equal(await saving.saveCaseFile("case"), false);
  assert.ok(saveCalls.some((c) => c[0] === "backup"));
  assert.equal(
    saveCalls.some((c) => c[0] === "download"),
    false,
  );
  schema = 4;
  saveCalls = [];
  assert.equal(await saving.saveCaseFile("case"), true);
  assert.ok(saveCalls.some((c) => c[0] === "download"));
  assert.equal(state.DIRTY, false);
  resetSaving();
  mergeFails = true;
  assert.equal(await saving.saveCaseFile("case"), false);
  assert.equal(
    saveCalls.some((c) => c[0] === "write"),
    false,
  );
  assert.ok(saveCalls.some((c) => c[0] === "queue"));
  assert.ok(saveCalls.some((c) => c[0] === "toast" && c[1] === "shared record conflict"));
  resetSaving();
  const expectedName = caseFileName(base());
  state.PENDING = [{ name: expectedName }, { name: "other.json" }];
  writeResponses = [
    { ok: false, needGrant: true },
    { ok: true, file: { schema: 5, case: base(), events: [{ id: "saved" }] } },
  ];
  assert.equal(await saving.saveCaseFile("case"), true);
  assert.equal(saveCalls.filter((c) => c[0] === "write").length, 2);
  assert.equal(saveCalls.find((c) => c[0] === "grant")[1], true);
  assert.deepEqual(state.PENDING, [{ name: "other.json" }]);
  assert.equal(state.DIRTY, false);
  assert.deepEqual(saveCalls.find((c) => c[0] === "summary")[2].events, [{ id: "saved" }]);
  const done = saveCalls.slice(saveCalls.findIndex((c) => c[0] === "idb")).map((c) => c[0]);
  assert.deepEqual(done, ["idb", "remember", "summary", "drafts", "toast", "render"]);
  resetSaving();
  state.NEEDGRANT = true;
  granted = false;
  writeResponses = [
    { ok: false, needGrant: true },
    { ok: false, needGrant: true },
  ];
  assert.equal(await saving.saveCaseFile("case"), false);
  assert.equal(saveCalls.filter((c) => c[0] === "grant").length, 2);
  assert.ok(saveCalls.some((c) => c[0] === "queue"));
  assert.equal(
    saveCalls.some((c) => c[0] === "summary"),
    false,
  );
  console.log(
    JSON.stringify({
      passed: true,
      writeDependencies: 6,
      pendingDependencies: 12,
      saveDependencies: 14,
      inertConstruction: true,
      verifiedWriteAndPermissionOrder: true,
      currentRetryAndRetainedFailures: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
