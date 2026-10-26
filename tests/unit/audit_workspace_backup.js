/* Independent whole-workspace backup coordination, with real record validation/projection. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules");
const parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, f));
  f(n);
  Object.values(n).forEach((c) => walk(c, f));
}
const used = new Set();
walk(parse("workspace_backup"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual(
  [...used].sort(),
  [
    "captureWork",
    "draftBundle",
    "downloadFile",
    "toast",
    "hasSetupWork",
    "idbSet",
    "recordIntegrity",
    "render",
    "saveDrafts",
    "refreshArtifactLocations",
    "today",
  ].sort(),
);
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = entries.find((n) => n.id.name === "workspaceBackup");
assert.equal(entry.init.callee.name, "createWorkspaceBackup");
assert.deepEqual(new Set(entry.init.arguments[0].properties.map((p) => p.key.name)), used);
assert.ok(entries.indexOf(entry) > entries.findIndex((n) => n.id.name === "caseLoading"));
assert.ok(entries.indexOf(entry) < entries.findIndex((n) => n.id.name === "documentRenderer"));
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
    stdin: { contents: "export {createWorkspaceBackup} from './workspace_backup.js'; export {WriterState} from './state.js';", resolveDir: dir },
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
  const { createWorkspaceBackup, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  createWorkspaceBackup(new Proxy({}, { get: (_, k) => assert.fail("premature service " + String(k)) }));
  assert.deepEqual(s, {});
  let calls, setup, failWrite, rejectIntegrity, holdWrite, releaseWrite, holdIntegrity, releaseIntegrity, downloaded, currentDay;
  const bundle = () => ({
    cases: s.CASES.slice(),
    events: copy(s.EVENTS),
    docs: s.DOCS.filter((d) => d.draft),
    reinsp: s.REINSP.filter((r) => r.draft),
    work: copy(s.WORK),
    recordAttempts: copy(s.RECORD_ATTEMPTS),
    checkpoints: copy(s.SAVE_CHECKPOINTS),
    integrityRecords: [],
    seq: s.seq,
  });
  const api = createWorkspaceBackup({
    captureWork() {
      calls.push("capture");
      s.WORK.entry.typed = "retained";
    },
    draftBundle() {
      calls.push("bundle");
      return bundle();
    },
    downloadFile(name, body) {
      calls.push("download");
      downloaded = { name, body };
    },
    toast(text) {
      calls.push(["toast", text]);
    },
    hasSetupWork() {
      return setup;
    },
    async idbSet(key, value) {
      calls.push(["write", key, copy(value)]);
      if (holdWrite && key === "drafts") await new Promise((r) => (releaseWrite = r));
      return !failWrite;
    },
    recordIntegrity: {
      async restore(records) {
        calls.push(["integrity", copy(records)]);
        if (holdIntegrity) await new Promise((r) => (releaseIntegrity = r));
        if (rejectIntegrity) throw Error("integrity restore failed");
      },
    },
    render() {
      calls.push("render");
    },
    async saveDrafts() {
      calls.push("save");
    },
    async refreshArtifactLocations() {
      calls.push("artifacts");
    },
    get today() {
      return currentDay;
    },
  });
  function reset() {
    calls = [];
    setup = false;
    failWrite = false;
    rejectIntegrity = false;
    holdWrite = false;
    holdIntegrity = false;
    downloaded = null;
    currentDay = "2026-10-20";
    Object.assign(s, {
      CASES: [],
      EVENTS: {},
      DOCS: [],
      REINSP: [],
      WORK: { entry: {}, recordForms: {} },
      RECORD_ATTEMPTS: {},
      SAVE_CHECKPOINTS: {},
      seq: 99,
      PENDING: [],
      state: { screen: "tools", modal: "settings" },
    });
  }
  function backup(version = 2) {
    return {
      format: "madison-workspace-backup",
      version,
      bundle: {
        cases: [{ id: "case", number: "BLD2026-00001", inspectorId: "i4" }],
        docs: [{ id: "draft", caseId: "case", draft: true, items: [{ id: "item", sections: ["27.05(2)(c)"] }] }],
        reinsp: [{ id: "visit", caseId: "case", draft: true, results: { item: { oc: "open" } } }],
        events: { case: [] },
        recordAttempts: { attempt: { cid: "case", pendingAmendment: { type: "document.annotated" } } },
        checkpoints: { case: { case: { id: "case" } } },
        integrityRecords: [{ retained: "proof" }],
        seq: 10,
        work: { entry: { text: "unfinished" }, recordForms: {}, acc: { id: "import" } },
      },
      pending: [
        { cid: "case", body: JSON.stringify({ format: "madison-case-file", schema: 5, case: { id: "case", number: "BLD2026-00001" }, events: [] }) },
      ],
    };
  }
  async function refuses(change, pattern) {
    reset();
    const value = backup();
    change(value);
    const before = copy(s);
    await assert.rejects(api.restoreWorkspaceBackup(value), pattern);
    assert.deepEqual(s, before);
    assert.equal(
      calls.some((c) => Array.isArray(c) && c[0] === "write"),
      false,
    );
  }
  reset();
  s.PENDING = [{ cid: "case", body: "held" }];
  api.downloadWorkspace();
  let exported = JSON.parse(downloaded.body);
  assert.equal(downloaded.name, "Madison-workspace-2026-10-20.json");
  assert.equal(exported.format, "madison-workspace-backup");
  assert.equal(exported.version, 2);
  assert.equal(exported.bundle.work.entry.typed, "retained");
  assert.deepEqual(exported.pending, s.PENDING);
  assert.deepEqual(calls.slice(0, 3), ["capture", "bundle", "download"]);
  s.WORK.entry.typed = "later";
  s.PENDING[0].body = "new";
  assert.equal(exported.bundle.work.entry.typed, "retained");
  assert.equal(exported.pending[0].body, "held");
  currentDay = "2026-10-21";
  api.downloadWorkspace();
  assert.equal(downloaded.name, "Madison-workspace-2026-10-21.json");
  await refuses((b) => (b.version = 3), /Choose a Madison/);
  await refuses(() => s.CASES.push({ id: "local" }), /empty workspace/);
  await refuses(() => (setup = true), /empty workspace/);
  await refuses(() => (s.WORK.recordForms.x = { text: "typed" }), /empty workspace/);
  await refuses((b) => b.bundle.cases.push(copy(b.bundle.cases[0])), /Duplicate cases/);
  await refuses((b) => (b.bundle.cases[0].id = 'bad"id'), /invalid working records/);
  await refuses((b) => (b.bundle.docs[0].draft = false), /Invalid document draft/);
  await refuses((b) => (b.bundle.docs[0].items[0].sections = null), /Invalid document draft/);
  await refuses((b) => (b.bundle.reinsp[0].results = null), /Invalid inspection worksheet/);
  await refuses((b) => b.bundle.docs.push(copy(b.bundle.docs[0])), /Duplicate working paper/);
  await refuses((b) => b.bundle.reinsp.push(copy(b.bundle.reinsp[0])), /Duplicate working paper/);
  await refuses((b) => (b.bundle.events.other = []), /unrelated case records/);
  await refuses((b) => (b.pending[0].body = "{"), /Invalid pending case file/);
  await refuses((b) => (b.pending[0].cid = "other"), /Invalid pending case record/);
  await refuses((b) => (b.bundle.recordAttempts.attempt.pendingAmendment.type = "notice.issued"), /Invalid pending record action/);
  reset();
  failWrite = true;
  let before = copy(s);
  await assert.rejects(api.restoreWorkspaceBackup(backup()), /Nothing has been changed/);
  assert.deepEqual(s, before);
  assert.equal(
    calls.some((c) => Array.isArray(c) && c[0] === "integrity"),
    false,
  );
  reset();
  holdWrite = true;
  holdIntegrity = true;
  const value = backup();
  before = copy(s);
  const pending = api.restoreWorkspaceBackup(value);
  await tick();
  assert.deepEqual(s, before);
  releaseWrite();
  await tick();
  assert.deepEqual(s, before);
  assert.equal(calls.at(-1)[0], "integrity");
  releaseIntegrity();
  assert.equal(await pending, true);
  assert.equal(s.seq, 99);
  assert.equal(s.CASES[0].id, "case");
  assert.equal(s.DOCS[0].id, "draft");
  assert.equal(s.REINSP[0].id, "visit");
  assert.deepEqual(s.RECORD_ATTEMPTS, value.bundle.recordAttempts);
  assert.deepEqual(s.SAVE_CHECKPOINTS, value.bundle.checkpoints);
  assert.deepEqual(s.WORK, value.bundle.work);
  assert.deepEqual(s.state.acc, value.bundle.work.acc);
  assert.equal(s.state.screen, "cases");
  assert.equal(s.state.modal, null);
  assert.deepEqual(s.PENDING, value.pending);
  assert.deepEqual(calls.filter((c) => typeof c === "string").slice(-3), ["render", "save", "artifacts"]);
  assert.match(calls.at(-1)[1], /nothing was issued/);
  reset();
  rejectIntegrity = true;
  before = copy(s);
  await assert.rejects(api.restoreWorkspaceBackup(backup()), /integrity restore failed/);
  assert.deepEqual(s, before);
  assert.equal(
    calls.some((c) => Array.isArray(c) && c[0] === "write" && c[1] === "drafts"),
    true,
  ); // Existing order: persisted drafts precede proof restore; no stronger transaction claim.
  reset();
  const legacy = backup(1);
  delete legacy.pending;
  delete legacy.bundle.work;
  delete legacy.bundle.integrityRecords;
  legacy.bundle.seq = 150;
  await api.restoreWorkspaceBackup(legacy);
  assert.equal(s.seq, 150);
  assert.deepEqual(s.WORK.entry, {});
  assert.deepEqual(s.WORK.recordForms, {});
  assert.deepEqual(s.PENDING, []);
  console.log(
    JSON.stringify({ passed: true, dependencies: used.size, lazyConstruction: true, validationAndPersistenceOrder: true, legacyBackup: true }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
