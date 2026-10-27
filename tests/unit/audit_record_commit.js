const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Shared publication/correction confirmation retains exact durable attempts and adapter ordering. */
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
const fields = [
  "toast",
  "saveDrafts",
  "caseFile",
  "COMMITTED",
  "helperJSON",
  "mergeCaseEvents",
  "project",
  "rememberSaved",
  "idbSet",
  "writeSummary",
  "render",
];
const used = new Set();
walk(parse("record_commit"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual([...used].sort(), fields.slice().sort());
const declarations = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = declarations.find((n) => n.id.name === "recordCommit");
assert.equal(entry.init.callee.name, "createRecordCommit");
assert.deepEqual(new Set(serviceComposition(entry.init.arguments[0]).properties.map((p) => p.key.name)), used);
assert.ok(declarations.indexOf(entry) > declarations.findIndex((n) => n.id.name === "workspaceTaskPresentation"));
assert.ok(declarations.indexOf(entry) < declarations.findIndex((n) => n.id.name === "documentRenderer"));
for (const p of serviceComposition(entry.init.arguments[0]).properties) {
  if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
  else {
    assert.equal(p.value.type, "ArrowFunctionExpression");
    assert.equal(p.value.body.callee.name, p.key.name);
  }
}
const copy = (v) => JSON.parse(JSON.stringify(v));
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents:
        "export {createRecordCommit} from './record_commit.js'; export {WriterState} from './state.js'; export {INSPECTORS} from './data/inspectors.js'; export {summaryName} from './case_file_rules.js';",
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
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { createRecordCommit, WriterState: state, INSPECTORS, summaryName } = box.exports;
  assert.deepEqual(state, {});
  createRecordCommit(new Proxy({}, { get: (_, k) => assert.fail("premature service read " + String(k)) }));
  assert.deepEqual(state, {});
  let calls = [],
    requests = [],
    durable = true,
    mode = "ok",
    map = new Map(),
    server = null,
    onRequest = () => {};
  const inspector = INSPECTORS.find((i) => i.name);
  assert.ok(inspector);
  function reset() {
    calls = [];
    requests = [];
    durable = true;
    mode = "ok";
    map = new Map();
    server = null;
    onRequest = () => {};
    Object.assign(state, {
      AMENDMENT_BUSY: false,
      CASEDIR: { helper: true },
      CASES: [{ id: "case", number: "BLD2026-00001", address: "1 SYNTHETIC ST", owner: "Original" }],
      EVENTS: { case: [] },
      DOCS: [],
      REINSP: [],
      SAVE_CHECKPOINTS: {},
      PENDING: [],
      RECORD_ATTEMPTS: {},
      WORK: { recordForms: {} },
      state: {},
    });
  }
  const api = createRecordCommit({
    get COMMITTED() {
      return map;
    },
    toast: (t) => calls.push(["toast", t]),
    render: () => calls.push(["render"]),
    saveDrafts: async () => {
      calls.push(["save", copy(state.DOCS)]);
      return durable;
    },
    caseFile: (cid) => ({ case: copy(state.CASES.find((k) => k.id === cid)), events: copy(state.EVENTS[cid]), inspectors: [] }),
    helperJSON: async (url, body) => {
      calls.push(["request"]);
      requests.push(copy({ url, body }));
      await onRequest(body);
      if (mode === "reject" || mode === "uncertain-storage") {
        const e = new Error("Validation refused");
        e.name = "StorageError";
        e.definitive = mode === "reject";
        throw e;
      }
      server = copy(body.file);
      if (mode === "lost") throw new Error("Network request failed after write");
      return { name: "retained.json", revision: "confirmed", file: copy(server) };
    },
    mergeCaseEvents: (k, file) => {
      calls.push(["merge"]);
      state.EVENTS[k.id] = file.events;
    },
    project: () => calls.push(["project"]),
    rememberSaved: () => calls.push(["remember"]),
    idbSet: async (key, v) => {
      calls.push(["idb", key, copy(v)]);
      return true;
    },
    writeSummary: async () => calls.push(["summary"]),
  });
  function attempt(id = "event") {
    return {
      id,
      at: "2026-10-26T12:00:00Z",
      by: inspector.id,
      type: "correction.issued",
      payload: { docId: "draft", snapshot: { id: "draft" }, caseChanges: { owner: { before: "Original", after: "Corrected" } } },
    };
  }
  function draft() {
    const d = { id: "draft", caseId: "case", draft: true };
    state.DOCS = [d];
    return d;
  }
  reset();
  const d = draft(),
    a = attempt(),
    visit = { id: "visit-event", by: inspector.id, type: "reinspection.recorded", payload: {} };
  d.publicationEvents = [visit];
  a.payload.fromReinspId = "visit";
  state.REINSP = [
    { id: "visit", draft: true },
    { id: "other", draft: true },
  ];
  mode = "lost";
  assert.equal(await api.commitAmendment("case", a, d), false);
  assert.equal(d.pendingAmendment, a);
  assert.deepEqual(state.EVENTS.case, []);
  assert.ok(state.DOCS.includes(d));
  assert.equal(server.events.length, 2);
  assert.ok(
    calls.findIndex((x) => x[0] === "save") < calls.findIndex((x) => x[0] === "request"),
    "pending event must be durable before helper request",
  );
  assert.deepEqual(calls.find((x) => x[0] === "save")[1][0].pendingAmendment, a);
  assert.equal(state.AMENDMENT_BUSY, false);
  assert.ok(state.state.amendmentError.includes("exact request is retained"));
  mode = "ok";
  state.PENDING = [{ cid: "case" }, { cid: "other" }];
  assert.equal(await api.commitAmendment("case", d.pendingAmendment, d), true);
  assert.equal(requests[0].body.idempotencyEvent, requests[1].body.idempotencyEvent);
  assert.deepEqual(requests[0].body.file.events, requests[1].body.file.events);
  assert.equal(server.events.filter((e) => e.id === a.id).length, 1);
  assert.equal(state.CASES[0].owner, "Corrected");
  assert.equal(state.DOCS.length, 0);
  assert.deepEqual(
    state.REINSP.map((r) => r.id),
    ["other"],
  );
  assert.deepEqual(state.PENDING, [{ cid: "other" }]);
  assert.equal(state.LASTWRITE.ok, true);
  const steps = calls.slice(calls.findIndex((x) => x[0] === "merge")).map((x) => x[0]);
  assert.deepEqual(steps, ["merge", "project", "remember", "idb", "summary", "save", "render"]);
  reset();
  const failed = draft();
  durable = false;
  assert.equal(await api.commitAmendment("case", attempt(), failed), false);
  assert.equal(requests.length, 0);
  assert.ok(failed.pendingAmendment);
  assert.equal(state.AMENDMENT_BUSY, false);
  reset();
  for (const value of ["reject", "uncertain-storage"]) {
    mode = value;
    const rejected = draft();
    rejected.recordKey = "record";
    state.RECORD_ATTEMPTS.record = {};
    rejected.publicationEvents = [visit];
    assert.equal(await api.commitAmendment("case", attempt(), rejected), false);
    if (value === "reject") {
      assert.equal(rejected.pendingAmendment, undefined);
      assert.equal(rejected.publicationEvents, undefined);
      assert.equal(state.RECORD_ATTEMPTS.record, undefined);
    } else {
      assert.ok(rejected.pendingAmendment);
      assert.deepEqual(rejected.publicationEvents, [visit]);
      assert.ok(state.RECORD_ATTEMPTS.record);
    }
    assert.equal(state.AMENDMENT_BUSY, false);
  }
  reset();
  state.CASEDIR = null;
  assert.equal(await api.commitAmendment("case", attempt(), draft()), false);
  assert.equal(requests.length, 0);
  reset();
  state.AMENDMENT_BUSY = true;
  assert.equal(await api.commitAmendment("case", attempt(), draft()), false);
  assert.equal(calls.length, 0);
  reset();
  let release;
  onRequest = () =>
    new Promise((r) => {
      release = r;
    });
  const pending = api.commitAmendment("case", attempt(), draft());
  await new Promise((r) => setImmediate(r));
  assert.equal(state.AMENDMENT_BUSY, true);
  assert.equal(await api.commitAmendment("case", attempt("second"), state.DOCS[0]), false);
  assert.equal(requests.length, 1);
  release();
  assert.equal(await pending, true);
  assert.equal(state.AMENDMENT_BUSY, false);
  reset();
  const liveKey = summaryName(state.CASES[0]);
  map = new Map([[liveKey, { name: "existing.json", revision: "base" }]]);
  state.SAVE_CHECKPOINTS.case = { case: { owner: "checkpoint" } };
  onRequest = () => {
    state.CASES[0].owner = "Later local edit";
  };
  state.PENDING = [{ cid: "case" }];
  assert.equal(await api.commitAmendment("case", attempt(), draft()), true);
  assert.equal(requests[0].body.name, "existing.json");
  assert.equal(requests[0].body.baseRevision, "base");
  assert.deepEqual(requests[0].body.baseCase, { owner: "checkpoint" });
  assert.equal(map.get(liveKey).revision, "confirmed");
  assert.equal(state.CASES[0].owner, "Later local edit");
  assert.equal(state.PENDING.length, 1, "newer local work must remain pending");
  reset();
  const note = attempt();
  note.type = "document.annotated";
  state.state = { docId: "draft", modal: "recordnote" };
  state.WORK.recordForms = { "draft:recordnote": { text: "saved" }, "other:recordnote": { text: "keep" } };
  assert.equal(await api.commitAmendment("case", note), true);
  assert.equal(state.WORK.recordForms["draft:recordnote"], undefined);
  assert.ok(state.WORK.recordForms["other:recordnote"]);
  assert.equal(state.state.modal, null);
  console.log(
    JSON.stringify({ passed: true, boundedDependencies: 11, durableExactRetry: true, definitiveRejection: true, liveAdaptersAndLaterEdits: true }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
