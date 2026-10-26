/* Individual-case selection/restore with real validation/projection and controlled storage/helper boundaries. */
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
walk(parse("case_recovery"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual(
  [...used].sort(),
  [
    "render",
    "helperJSON",
    "compareSharedCase",
    "walkIdentity",
    "IDB_OK",
    "idb",
    "idbGet",
    "idbSet",
    "draftBundle",
    "toast",
    "hasSetupWork",
    "caseUnsaved",
    "recoverySnapshot",
    "recoveryCaseKey",
    "RECOVERY_WORKSPACE",
    "confirm",
    "clearWalk",
    "refreshArtifactLocations",
  ].sort(),
);
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = entries.find((n) => n.id.name === "caseRecovery");
assert.equal(entry.init.callee.name, "createCaseRecovery");
assert.deepEqual(new Set(entry.init.arguments[0].properties.map((p) => p.key.name)), used);
assert.ok(entries.indexOf(entry) > entries.findIndex((n) => n.id.name === "automaticRecovery"));
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
    stdin: {
      contents: "export {createCaseRecovery,recoverySharedConflict} from './case_recovery.js'; export {WriterState} from './state.js';",
      resolveDir: dir,
    },
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
  const { createCaseRecovery, recoverySharedConflict, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  createCaseRecovery(new Proxy({}, { get: (_, k) => assert.fail("premature service " + String(k)) }));
  assert.deepEqual(s, {});
  let b,
    row,
    calls,
    disk,
    helperFailure,
    sharedKind,
    holdRead,
    holdShared,
    releaseRead,
    releaseShared,
    setup,
    accept,
    native,
    tx,
    failDraft,
    failRollback,
    backupFailure;
  const bundle = () => ({
    cases: copy(s.CASES),
    docs: copy(s.DOCS.filter((d) => d.draft)),
    reinsp: copy(s.REINSP.filter((r) => r.draft)),
    events: copy(s.EVENTS),
    recordAttempts: copy(s.RECORD_ATTEMPTS),
    checkpoints: copy(s.SAVE_CHECKPOINTS),
    work: copy(s.WORK),
    seq: s.seq,
  });
  const api = createCaseRecovery({
    render() {
      calls.push("render");
    },
    async helperJSON(url, body) {
      calls.push(["helper", url, body && copy(body)]);
      if (helperFailure) throw helperFailure;
      if (url === "/draft-backups/list") return { backups: [row] };
      if (url === "/draft-backups/read") {
        if (holdRead) await new Promise((r) => (releaseRead = r));
        return { backup: b };
      }
      if (url.startsWith("/cases/resolve?")) {
        if (holdShared) await new Promise((r) => (releaseShared = r));
        return { file: { format: "madison-case-file", schema: 5, case: b.bundle.cases[0], events: b.bundle.events.one || [] } };
      }
      if (url === "/draft-backups/write") {
        if (backupFailure) throw Error("backup failed");
        return { ok: true };
      }
      assert.fail(url);
    },
    compareSharedCase(...args) {
      calls.push(["compare", ...copy(args)]);
      return { kind: sharedKind, detail: "shared status" };
    },
    walkIdentity(r) {
      return r.caseId + "|" + r.id;
    },
    get IDB_OK() {
      return native;
    },
    async idb() {
      return {
        transaction(store, mode) {
          assert.equal(store, "kv");
          assert.equal(mode, "readwrite");
          tx = {
            objectStore(name) {
              assert.equal(name, "kv");
              return {
                put(value, key) {
                  calls.push(["put", key, copy(value)]);
                },
              };
            },
          };
          return tx;
        },
      };
    },
    async idbGet(key) {
      return copy(disk[key]);
    },
    async idbSet(key, value) {
      calls.push(["set", key, copy(value)]);
      if (failRollback && key === "pending" && value[0]?.cid === "old") return false;
      if (failDraft && key === "drafts" && !value.old) return false;
      disk[key] = copy(value);
      return true;
    },
    draftBundle: bundle,
    toast(text) {
      calls.push(["toast", text]);
    },
    hasSetupWork() {
      return setup;
    },
    caseUnsaved() {
      return "local work";
    },
    recoverySnapshot() {
      return copy(b);
    },
    recoveryCaseKey() {
      return row.case;
    },
    get RECOVERY_WORKSPACE() {
      return row.workspace;
    },
    confirm(text) {
      calls.push(["confirm", text]);
      return accept;
    },
    clearWalk() {
      calls.push("clearWalk");
    },
    async refreshArtifactLocations() {
      calls.push("artifacts");
    },
  });
  assert.equal("recoverySharedState" in api, false);
  assert.equal("persistRecoveryState" in api, false);
  function reset() {
    calls = [];
    disk = { pending: [{ cid: "old" }], drafts: { old: true } };
    helperFailure = null;
    sharedKind = "equal";
    holdRead = false;
    holdShared = false;
    setup = false;
    accept = true;
    native = false;
    tx = null;
    failDraft = false;
    failRollback = false;
    backupFailure = false;
    b = {
      format: "madison-draft-recovery",
      version: 1,
      workspace: "a".repeat(32),
      case: "b".repeat(32),
      number: "BLD2026-00001",
      at: "2026-10-20",
      included: ["draft"],
      pending: [],
      bundle: {
        cases: [{ id: "one", number: "BLD2026-00001" }],
        docs: [{ id: "draft", caseId: "one", draft: true, items: [{ id: "item", sections: [] }] }],
        reinsp: [{ id: "visit", caseId: "one", draft: true, sourceDocId: "source", results: { item: { oc: "open" } } }],
        events: {
          one: [
            {
              id: "event",
              type: "notice.issued",
              at: "2026-10-20T12:00:00Z",
              payload: {
                snapshot: {
                  id: "source",
                  caseId: "one",
                  type: "notice",
                  authoringVersion: 9,
                  items: [{ id: "item", sections: [] }],
                  frozen: { body: "retained" },
                },
              },
            },
          ],
        },
        recordAttempts: { attempt: { cid: "one" } },
        checkpoints: { one: { case: { id: "one" } } },
        work: { entry: {}, recordForms: { "draft:note": { text: "retained" } }, walk: { context: "one|visit", item: "item" } },
        seq: 12,
      },
    };
    row = { workspace: b.workspace, case: b.case, number: b.number, name: "backup.json" };
    Object.assign(s, {
      CASES: [],
      DOCS: [],
      REINSP: [],
      EVENTS: {},
      RECORD_ATTEMPTS: {},
      SAVE_CHECKPOINTS: {},
      PENDING: [],
      WORK: { entry: {}, recordForms: {} },
      seq: 50,
      state: { modal: "recovery", screen: "tools", acc: null },
      RECOVERY: { list: [row], selected: b, shared: null, error: "" },
      RECOVERY_SELECT_SEQ: 0,
    });
  }
  reset();
  assert.equal(api.validateRecovery(b, row), true);
  for (const kind of ["invalid", "history-conflict", "conflict", "shared-history"]) assert.equal(recoverySharedConflict({ kind }), true);
  for (const kind of ["equal", "missing", "unavailable"]) assert.equal(recoverySharedConflict({ kind }), false);
  for (const [change, pattern] of [
    [(x) => (x.version = 2), /unsupported/],
    [(x) => (x.workspace = "other"), /unsupported/],
    [(x) => (x.bundle.docs[0].caseId = "other"), /unrelated/],
    [(x) => (x.bundle.events.other = []), /unrelated/],
    [(x) => (x.bundle.reinsp[0].results.unknown = { oc: "open" }), /inconsistent/],
    [(x) => (x.bundle.work.recordForms["missing:note"] = {}), /inconsistent/],
    [(x) => (x.bundle.work.walk.item = "missing"), /inconsistent/],
    [(x) => (x.pending = [{ cid: "one", body: "{" }]), /unrelated/],
    [(x) => (x.bundle.events.one[0].payload.snapshot.items = null), /history/],
  ]) {
    reset();
    change(b);
    assert.throws(() => api.validateRecovery(b, row), pattern);
    assert.equal(calls.length, 0);
  }
  reset();
  await api.listRecovery();
  assert.equal(s.RECOVERY.loading, false);
  assert.deepEqual(s.RECOVERY.list, [row]);
  helperFailure = Error("offline");
  await api.listRecovery();
  assert.equal(s.RECOVERY.error, "offline");
  assert.deepEqual(s.RECOVERY.list, []);
  reset();
  holdRead = true;
  let selection = api.selectRecovery(row);
  await tick();
  s.RECOVERY_SELECT_SEQ++;
  releaseRead();
  await selection;
  assert.equal(s.RECOVERY.selected, null);
  assert.equal(
    calls.some((c) => Array.isArray(c) && c[0] === "compare"),
    false,
  );
  reset();
  holdShared = true;
  selection = api.selectRecovery({ ...row, imported: b });
  await tick();
  s.state.modal = null;
  releaseShared();
  await selection;
  assert.equal(s.RECOVERY.selected, null);
  reset();
  await api.selectRecovery({ ...row, imported: b });
  assert.equal(s.RECOVERY.selected, b);
  const comparison = calls.find((c) => Array.isArray(c) && c[0] === "compare");
  assert.equal(comparison.at(-1), true);
  assert.ok(calls.some((c) => Array.isArray(c) && c[1] === "/cases/resolve?number=BLD2026-00001"));
  for (const [error, kind] of [
    [Object.assign(Error("missing"), { name: "NotFoundError" }), "missing"],
    [Object.assign(Error("refused"), { definitive: true }), "invalid"],
    [Error("offline"), "unavailable"],
  ]) {
    reset();
    helperFailure = error;
    await api.selectRecovery({ ...row, imported: b });
    assert.equal(s.RECOVERY.shared.kind, kind);
  }
  reset();
  sharedKind = "history-conflict";
  await api.restoreRecovery();
  assert.equal(s.CASES.length, 0);
  assert.match(calls.at(-1)[1], /Review the changed shared record/);
  assert.equal(
    calls.some((c) => Array.isArray(c) && c[0] === "set"),
    false,
  );
  reset();
  holdShared = true;
  let restoring = api.restoreRecovery();
  await tick();
  s.RECOVERY_SELECT_SEQ++;
  releaseShared();
  await restoring;
  assert.equal(s.CASES.length, 0);
  assert.equal(
    calls.some((c) => Array.isArray(c) && c[0] === "set"),
    false,
  );
  reset();
  s.CASES = [{ id: "different", number: b.number }];
  await api.restoreRecovery();
  assert.match(calls.at(-1)[1], /identity conflicts/);
  reset();
  s.CASES = copy(b.bundle.cases);
  s.EVENTS = { one: [{ id: "later", type: "document.annotated", at: "2026-10-21T00:00:00Z", payload: {} }] };
  await api.restoreRecovery();
  assert.match(calls.at(-1)[1], /different issued history/);
  reset();
  s.CASES = copy(b.bundle.cases);
  s.EVENTS = copy(b.bundle.events);
  accept = false;
  await api.restoreRecovery();
  const savedCopy = calls.find((c) => Array.isArray(c) && c[1] === "/draft-backups/write");
  assert.equal(savedCopy[2].backup.preReplacement, true);
  assert.ok(calls.findIndex((c) => Array.isArray(c) && c[0] === "confirm") > calls.indexOf(savedCopy));
  assert.equal(
    calls.some((c) => Array.isArray(c) && c[0] === "set"),
    false,
  );
  reset();
  s.CASES = copy(b.bundle.cases);
  s.EVENTS = copy(b.bundle.events);
  backupFailure = true;
  await api.restoreRecovery();
  assert.match(calls.at(-1)[1], /backup failed/);
  assert.equal(
    calls.some((c) => Array.isArray(c) && c[0] === "confirm"),
    false,
  );
  reset();
  failDraft = true;
  await api.restoreRecovery();
  assert.equal(s.CASES.length, 0);
  assert.deepEqual(disk.pending, [{ cid: "old" }]);
  assert.deepEqual(disk.drafts, { old: true });
  assert.match(calls.at(-1)[1], /previous work was retained/);
  reset();
  failDraft = true;
  failRollback = true;
  await api.restoreRecovery();
  assert.equal(s.CASES.length, 0);
  assert.match(calls.at(-1)[1], /rollback failed/);
  for (const outcome of ["onerror", "onabort", "oncomplete"]) {
    reset();
    native = true;
    restoring = api.restoreRecovery();
    await tick();
    assert.ok(tx);
    assert.equal(s.CASES.length, 0);
    assert.deepEqual(
      calls.filter((c) => Array.isArray(c) && c[0] === "put").map((c) => c[1]),
      ["pending", "drafts"],
    );
    tx[outcome]();
    await restoring;
    if (outcome !== "oncomplete") {
      assert.equal(s.CASES.length, 0);
      assert.match(calls.at(-1)[1], /previous work was retained/);
    } else {
      assert.equal(s.CASES[0].id, "one");
      assert.equal(s.DOCS.find((d) => d.id === "source").frozen.body, "retained");
      assert.equal(s.seq, 50);
      assert.equal(s.state.screen, "cases");
      assert.deepEqual(s.RECORD_ATTEMPTS, b.bundle.recordAttempts);
      assert.deepEqual(s.SAVE_CHECKPOINTS, b.bundle.checkpoints);
      assert.deepEqual(s.WORK.recordForms, b.bundle.work.recordForms);
      assert.deepEqual(calls.filter((c) => typeof c === "string").slice(-3), ["clearWalk", "render", "artifacts"]);
      assert.match(calls.at(-1)[1], /No document was issued/);
    }
  }
  reset();
  s.CASES = [{ id: "two", number: "BLD2026-00002" }];
  s.DOCS = [{ id: "other", caseId: "two", draft: true, items: [] }];
  s.WORK.recordForms = { "other:note": { text: "keep" } };
  s.PENDING = [{ cid: "two", body: "held" }];
  await api.restoreRecovery();
  assert.equal(s.CASES.length, 2);
  assert.ok(s.DOCS.some((d) => d.id === "other"));
  assert.equal(s.WORK.recordForms["other:note"].text, "keep");
  assert.equal(s.PENDING[0].cid, "two");
  reset();
  b.bundle = { cases: [], docs: [], reinsp: [], events: {}, work: { entry: { typed: "import" }, acc: { id: "import" }, recordForms: {} } };
  setup = true;
  await api.restoreRecovery();
  assert.match(calls.at(-1)[1], /empty import form/);
  setup = false;
  await api.restoreRecovery();
  assert.equal(s.state.screen, "import");
  assert.equal(s.WORK.entry.typed, "import");
  assert.equal(s.state.acc.id, "import");
  console.log(
    JSON.stringify({
      passed: true,
      dependencies: used.size,
      inertConstruction: true,
      selectionGuards: true,
      validationAndConflictRefusals: true,
      backupBeforeConfirmation: true,
      transactionAcknowledgement: true,
      rollbackRetention: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
