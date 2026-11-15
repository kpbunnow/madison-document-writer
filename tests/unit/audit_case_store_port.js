/* Real producer/transport/consumer composition; malformed acknowledgments cannot settle pending work. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: `export {saveCaseStore,buildCaseStoreRequest,caseStoreAcknowledgment} from './case_store_port.js';
 export {createHelperRequests} from './helper_requests.js'; export {createRecordCommit} from './record_commit.js';
 export {WriterState} from './state.js';`,
      resolveDir: path.resolve("app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    define: { __TEST_BUILD__: "false" },
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { saveCaseStore, buildCaseStoreRequest, caseStoreAcknowledgment, createHelperRequests, createRecordCommit, WriterState: s } = box.exports;
  const kase = { id: "case", number: "QA-PORT", owner: "Owner" };
  const file = { format: "madison-case-file", schema: 5, case: kase, events: [], inspectors: [] };
  const checkpoint = { case: { ...kase, owner: "Baseline" } },
    base = { revision: "prior" };
  const request = buildCaseStoreRequest("saved.json", file, base, checkpoint, "exact-attempt");
  assert.equal(request.file, file);
  assert.equal(request.baseCase, checkpoint.case);
  assert.equal(request.baseRevision, "prior");
  assert.equal(request.idempotencyEvent, "exact-attempt");
  assert.deepEqual(buildCaseStoreRequest("new.json", file, undefined, undefined, undefined), {
    name: "new.json",
    file,
    baseRevision: "",
    baseCase: null,
  });
  const ack = { file, name: "saved.json", revision: "revision", integrity: { proof: "verified" } };
  assert.equal(caseStoreAcknowledgment(ack), ack);
  assert.equal(
    await saveCaseStore(
      async (url, body) => {
        assert.equal(url, "/cases/save");
        assert.deepEqual(body, request);
        return ack;
      },
      "saved.json",
      file,
      base,
      checkpoint,
      "exact-attempt",
    ),
    ack,
  );
  const receiver = { marker: "retained receiver" };
  assert.equal(
    await saveCaseStore(
      async function (url, body) {
        assert.equal(this, receiver);
        assert.equal(this.marker, "retained receiver");
        return ack;
      },
      "saved.json",
      file,
      base,
      checkpoint,
      "exact-attempt",
      receiver,
    ),
    ack,
  );
  for (const bad of [
    null,
    [],
    {},
    { ...ack, revision: 42 },
    { ...ack, name: 42 },
    { ...ack, file: null },
    { ...ack, file: { ...file, case: { number: 42 } } },
    { ...ack, file: { ...file, case: {} } },
    { ...ack, file: { case: kase, events: [{}] } },
    { ...ack, file: { case: kase, events: [], schema: "5" } },
  ])
    assert.throws(
      () => caseStoreAcknowledgment(bad),
      (e) => e.name === "Error" && !e.definitive && /acknowledgment/.test(e.message),
    );
  global.document = new JSDOM('<meta name="docwriter-token" content="synthetic">').window.document;
  let payload,
    status = 200,
    proofFault = false,
    release,
    held = false,
    traces = [],
    requests = [];
  const transport = createHelperRequests({
    recordIntegrity: {
      async verify(f, p) {
        traces.push("verify");
        assert.equal(p.proof, "verified");
        if (proofFault) throw Error("unverified proof");
        if (held) await new Promise((r) => (release = r));
      },
    },
  });
  global.fetch = async (url, options) => {
    traces.push("fetch");
    requests.push(JSON.parse(options.body));
    return { ok: status === 200, status, json: async () => payload };
  };
  const draft = { id: "draft", recordKey: "record", publicationEvents: [] };
  const attempt = {
    id: "exact-attempt",
    at: "2026-11-15T12:00:00Z",
    by: "officer",
    type: "document.annotated",
    payload: { docId: "draft", caseChanges: {} },
  };
  Object.assign(s, {
    AMENDMENT_BUSY: false,
    CASEDIR: { helper: true },
    CASES: [structuredClone(kase)],
    EVENTS: { case: [] },
    DOCS: [draft],
    REINSP: [],
    SAVE_CHECKPOINTS: { case: checkpoint },
    PENDING: [{ cid: "case" }],
    RECORD_ATTEMPTS: { record: draft },
    WORK: { recordForms: {} },
    state: {},
  });
  const committed = new Map();
  const api = createRecordCommit({
    COMMITTED: committed,
    helperJSON: transport.helperJSON,
    saveDrafts: async () => true,
    caseFile: () => ({ ...structuredClone(file), case: structuredClone(s.CASES[0]) }),
    mergeCaseEvents: (k, f) => {
      traces.push("merge");
      s.EVENTS.case = f.events;
    },
    project: () => traces.push("project"),
    rememberSaved: () => {},
    idbSet: async () => true,
    writeSummary: async () => true,
    render: () => {},
    toast: () => {},
  });
  // The verifier must finish before any acknowledgment or cache/state settlement.
  payload = { ok: true, ...ack, revision: undefined };
  held = true;
  const failed = api.commitAmendment("case", attempt, draft);
  for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
  assert.equal(committed.size, 0);
  assert.equal(s.DOCS[0], draft);
  assert.equal(draft.pendingAmendment, attempt);
  release();
  assert.equal(await failed, false);
  held = false;
  assert.equal(committed.size, 0);
  assert.equal(s.DOCS[0], draft);
  assert.equal(draft.pendingAmendment, attempt);
  assert.equal(s.RECORD_ATTEMPTS.record, draft);
  assert.ok(draft.publicationEvents);
  assert.equal(s.PENDING.length, 1);
  assert.deepEqual(traces, ["fetch", "verify"]);
  // Both proof refusals and HTTP 5xx remain uncertain; HTTP 4xx is definitive.
  proofFault = true;
  payload = { ok: true, ...ack };
  assert.equal(await api.commitAmendment("case", attempt, draft), false);
  assert.equal(draft.pendingAmendment, attempt);
  proofFault = false;
  status = 500;
  payload = { ok: false, error: "uncertain" };
  assert.equal(await api.commitAmendment("case", attempt, draft), false);
  assert.equal(draft.pendingAmendment, attempt);
  status = 409;
  payload = { ok: false, error: "conflict" };
  assert.equal(await api.commitAmendment("case", attempt, draft), false);
  assert.equal(draft.pendingAmendment, undefined);
  // Retry reads current work, retains the same event, and preserves edits made while awaiting verification.
  status = 200;
  held = true;
  release = null;
  traces = [];
  s.CASES[0].owner = "Before retry";
  payload = { ok: true, ...ack, file: { ...file, case: { ...kase, owner: "Server" }, events: [attempt] } };
  const retry = api.commitAmendment("case", attempt, draft);
  for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
  s.CASES[0].owner = "Typed during save";
  release();
  assert.equal(await retry, true);
  assert.equal(s.CASES[0].owner, "Typed during save");
  assert.equal(requests.at(-1).file.case.owner, "Before retry");
  assert.ok(requests.every((r) => r.idempotencyEvent === "exact-attempt"));
  assert.equal(requests.at(-1).baseCase.owner, "Baseline");
  assert.equal(committed.size, 1);
  assert.deepEqual(traces, ["fetch", "verify", "merge", "project"]);
  assert.equal(s.DOCS.length, 0);
  for (const malformed of [null, [], 42]) {
    payload = malformed;
    await assert.rejects(transport.helperJSON("/synthetic", {}), /incomplete response/);
  }
  console.log(
    "PASS case-store port: real checked request/verified transport/ack composition, malformed and uncertain retention, exact current retry, later edits",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
