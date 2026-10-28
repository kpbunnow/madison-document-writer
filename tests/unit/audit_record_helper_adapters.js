const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Actual authenticated JSON adapter, summary projection adapter and direct record operations. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  f(n);
  Object.values(n).forEach((x) => walk(x, f));
}
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
for (const [name, file, ctor] of [
  ["helperRequests", "helper_requests", "createHelperRequests"],
  ["caseSummaryAdapter", "case_summary_adapter", "createCaseSummaryAdapter"],
]) {
  const used = new Set();
  walk(parse(file), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") used.add(n.property.name);
  });
  assert.deepEqual([...used], ["recordIntegrity"]);
  const e = entries.find((n) => n.id.name === name);
  assert.equal(e.init.callee.name, ctor);
  assert.equal(serviceComposition(e.init.arguments[0]).properties.length, 1);
  assert.equal(serviceComposition(e.init.arguments[0]).properties[0].kind, "get");
  assert.equal(serviceComposition(e.init.arguments[0]).properties[0].value.body.body[0].argument.name, "recordIntegrity");
  assert.ok(entries.indexOf(e) > entries.findIndex((n) => n.id.name === "addressParser"));
  assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "folderConnections"));
}
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createHelperRequests} from './helper_requests.js';export {createCaseSummaryAdapter} from './case_summary_adapter.js';export {sourceDocFor} from './writer_queries.js';export {evid,appendEvent} from './record_event_log.js';export {WriterState} from './state.js';export {summarizeRecord} from './case_projection.js';export {INSPECTORS} from './data/inspectors.js';export {LIBRARY} from './data/library.js';export {BUILD} from './data/build_identity.js';",
      resolveDir: dir,
    },
    bundle: true,
    format: "cjs",
    write: false,
    define: { __TEST_BUILD__: "false" },
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const NativeDate = Date,
    instant = NativeDate.parse("2026-10-27T12:00:00Z");
  let nativeClock = 0,
    randomCalls = 0;
  class Clock extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [instant]));
    }
    static now() {
      nativeClock++;
      return instant;
    }
  }
  const math = Object.create(Math);
  math.random = () => {
    randomCalls++;
    return 0.5;
  };
  const box = { exports: {} };
  new Function("module", "exports", "Date", "Math", built.outputFiles[0].text)(box, box.exports, Clock, math);
  const {
    createHelperRequests,
    createCaseSummaryAdapter,
    WriterState: s,
    sourceDocFor,
    evid,
    appendEvent,
    summarizeRecord,
    INSPECTORS,
    LIBRARY,
    BUILD,
  } = box.exports;
  assert.deepEqual(s, {});
  assert.equal(nativeClock, 0);
  assert.equal(randomCalls, 0);
  for (const ctor of [createHelperRequests, createCaseSummaryAdapter])
    ctor(new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  global.document = new JSDOM('<meta name="docwriter-token" content="synthetic-token">').window.document;
  let calls = [],
    status = 200,
    data = { ok: true },
    jsonError = false,
    verifyError = false,
    hold = false,
    release,
    integrity = { valid: true, label: "synthetic status" },
    verifier = {
      verify: async (file, proof) => {
        calls.push(["verify", file, proof]);
        if (verifyError) throw Error("verification refusal");
        if (hold) await new Promise((r) => (release = r));
      },
      status: (k) => {
        calls.push(["status", k]);
        return integrity;
      },
    };
  global.fetch = async (url, options) => {
    calls.push(["fetch", url, options]);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        calls.push(["json"]);
        if (jsonError) throw Error("malformed JSON");
        return data;
      },
    };
  };
  const requests = createHelperRequests({
    get recordIntegrity() {
      return verifier;
    },
  });
  assert.equal(await requests.helperJSON("/synthetic"), data);
  assert.equal(calls[0][2].cache, "no-store");
  assert.equal(calls[0][2].headers.get("X-DocWriter-Token"), "synthetic-token");
  calls = [];
  const body = { value: "retained" };
  await requests.helperJSON("/synthetic", body);
  assert.equal(calls[0][2].method, "POST");
  assert.equal(calls[0][2].body, JSON.stringify(body));
  assert.equal(calls[0][2].headers.get("Content-Type"), "application/json");
  calls = [];
  await requests.helperJSON("/synthetic", null);
  assert.equal(calls[0][2].body, "null");
  for (const [code, payload, name, definitive] of [
    [404, { ok: false, missing: true, error: "missing" }, "NotFoundError", true],
    [500, { ok: false, error: "server" }, "StorageError", false],
    [200, { ok: false }, "StorageError", false],
  ]) {
    status = code;
    data = payload;
    await assert.rejects(requests.helperJSON("/synthetic"), (err) => err.name === name && err.definitive === definitive);
  }
  status = 200;
  jsonError = true;
  await assert.rejects(requests.helperJSON("/synthetic"), /malformed JSON/);
  jsonError = false;
  data = { ok: true, file: { case: { id: "c" } }, integrity: { proof: "kept" } };
  calls = [];
  hold = true;
  let done = false;
  const pending = requests.helperJSON("/synthetic").then((x) => {
    done = true;
    return x;
  });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(done, false);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["fetch", "json", "verify"],
  );
  assert.equal(calls[2][1], data.file);
  assert.equal(calls[2][2], data.integrity);
  release();
  assert.equal(await pending, data);
  hold = false;
  verifyError = true;
  await assert.rejects(requests.helperJSON("/synthetic"), /verification refusal/);
  verifyError = false;
  verifier = { verify: async () => calls.push(["replacement verify"]), status: () => integrity };
  await requests.helperJSON("/synthetic");
  assert.equal(calls.at(-1)[0], "replacement verify");
  s.CASES = [{ id: "c", number: "BI-123", inspectorId: "officer" }];
  s.EVENTS = { c: [] };
  s.DOCS = [];
  s.DIRTY = false;
  const payload = { retained: true };
  const id = evid();
  assert.match(id, /^ev_[a-z0-9]+_[a-z0-9]+$/);
  assert.equal(nativeClock, 1);
  assert.equal(randomCalls, 2);
  const before = JSON.stringify(s);
  assert.throws(() => appendEvent("c", "not-a-type", {}), /unknown event type/);
  assert.equal(JSON.stringify(s), before);
  s.EVENTS.c = [{ id: "prior", at: "2026-10-28T12:00:00.000Z" }];
  const ev = appendEvent("c", "notice.issued", payload);
  assert.equal(ev.at, "2026-10-28T12:00:00.001Z");
  assert.equal(ev.by, "officer");
  assert.equal(ev.payload, payload);
  assert.equal(s.EVENTS.c.at(-1), ev);
  assert.equal(s.DIRTY, true);
  const explicit = appendEvent("c", "notice.issued", null, "2020-01-01T00:00:00Z", "named");
  assert.equal(explicit.at, "2020-01-01T00:00:00Z");
  assert.equal(explicit.by, "named");
  assert.deepEqual(explicit.payload, {});
  const doc = (id, extra = {}) => ({ id, caseId: "c", type: "notice", items: [{ id: "i" }], ...extra });
  s.DOCS = [
    doc("draft", { draft: true }),
    doc("void", { void: {} }),
    doc("superseded", { superseded: {} }),
    doc("supplement", { type: "summaryAbatement" }),
    doc("normal"),
  ];
  assert.equal(sourceDocFor("c").id, "normal");
  s.DOCS = [doc("supplement", { type: "summaryAbatement" })];
  assert.equal(sourceDocFor("c").id, "supplement");
  s.DOCS = [doc("empty", { items: [] })];
  assert.equal(sourceDocFor("c"), null);
  s.EVENTS = { c: [] };
  const file = { format: "madison-case-file", schema: 4, case: { id: "c", number: "BI-123", address: "123 Main St" }, events: [], inspectors: [] },
    original = JSON.stringify(file),
    adapter = createCaseSummaryAdapter({
      get recordIntegrity() {
        return verifier;
      },
    });
  let summary = adapter.summarize(file);
  assert.equal(summary.written, "2026-10-27T12:00:00.000Z");
  assert.equal(summary.integrity, integrity);
  assert.deepEqual(
    summary,
    summarizeRecord(file, { inspectors: INSPECTORS, library: LIBRARY, cases: s.CASES, integrity, build: BUILD, written: summary.written }),
  );
  assert.equal(JSON.stringify(file), original);
  integrity = { valid: false, label: "changed" };
  s.CASES = [{ id: "other" }];
  summary = adapter.summarize(file);
  assert.equal(summary.integrity, integrity);
  verifier = {
    status: () => {
      throw Error("status refusal");
    },
    verify: async () => {},
  };
  assert.throws(() => adapter.summarize(file), /status refusal/);
  console.log(
    JSON.stringify({
      passed: true,
      helperInputs: 1,
      summaryInputs: 1,
      inertConstruction: true,
      authenticatedShapesAndErrors: true,
      verificationBeforeReturn: true,
      eventClockAndOrdering: true,
      liveSourceQuery: true,
      projectionParity: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
