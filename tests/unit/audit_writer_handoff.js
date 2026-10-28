const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Readiness and Reports handoff load independently and preserve restoration/request boundaries. */
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
const required = new Set();
walk(parse("writer_handoff"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    required.add(n.property.name);
  }
});
assert.deepEqual([...required].sort(), ["HANDOFF_CHANNEL", "WRITER_READY_WAIT", "helperJSON", "loadCaseFile", "preflightCase", "render"]);
const declarations = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = declarations.find((n) => n.id.name === "writerHandoff");
assert.equal(entry.init.callee.name, "createWriterHandoff");
assert.ok(declarations.indexOf(entry) > declarations.findIndex((n) => n.id.name === "pdfArtifacts"));
assert.ok(declarations.indexOf(entry) < declarations.findIndex((n) => n.id.name === "documentRenderer"));
assert.equal(entry.init.arguments.length, 1);
const properties = serviceComposition(entry.init.arguments[0]).properties;
assert.deepEqual(new Set(properties.map((p) => p.key.name)), required);
for (const p of properties) {
  assert.equal(p.type, "Property");
  if (p.kind === "get") {
    assert.equal(p.value.body.body.length, 1);
    assert.equal(p.value.body.body[0].argument.name, p.key.name);
  } else {
    assert.equal(p.value.type, "ArrowFunctionExpression");
    assert.equal(p.value.body.type, "CallExpression");
    assert.equal(p.value.body.callee.name, p.key.name);
  }
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { resolve, promise };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
(async () => {
  const built = await esbuild.build({
    stdin: { contents: "export {createWriterHandoff} from './writer_handoff.js'; export {WriterState} from './state.js';", resolveDir: directory },
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
  const { createWriterHandoff, WriterState: state } = box.exports;
  assert.deepEqual(state, {});
  createWriterHandoff(new Proxy({}, { get: (_, k) => assert.fail("premature dependency: " + String(k)) }));
  assert.deepEqual(state, {}, "loading/construction does not initialize Writer, require browser globals or open a channel");
  const saved = { window: global.window, BroadcastChannel: global.BroadcastChannel, location: global.location };
  let readiness = deferred(),
    calls = [],
    helper = async () => assert.fail("unexpected helper read"),
    load = () => true;
  const api = createWriterHandoff({
    get WRITER_READY_WAIT() {
      return readiness.promise;
    },
    get HANDOFF_CHANNEL() {
      return "madison-writer-handoff-v1";
    },
    render: () => calls.push("render"),
    preflightCase: async (id, reason, continuation) => {
      calls.push(["preflight", id, reason]);
      continuation();
    },
    helperJSON: (...args) => helper(...args),
    loadCaseFile: (value) => {
      calls.push(["load", JSON.parse(value)]);
      return load(value);
    },
  });
  const reset = () => {
    readiness = deferred();
    calls = [];
    Object.assign(state, {
      WRITER_ACCESS: true,
      WRITER_READY: false,
      WORKSPACE_RESTORED: false,
      STARTUP_STATUS: "starting",
      releaseWriterReady: (value) => {
        calls.push(["release", value]);
        readiness.resolve(value);
      },
      HANDOFF_SEQ: 0,
      REPORT_RETURN: false,
      CASES: [],
      state: { screen: "editor", caseFilter: "attention", caseQ: "retained" },
    });
  };
  const file = (number) => ({ format: "madison-case-file", case: { id: "shared", number }, events: [] });
  try {
    global.window = { focus: () => calls.push("focus") };
    reset();
    const pendingReady = api.writerOpenReportedCase({ number: "QA-LOCAL" });
    await tick();
    assert.deepEqual(calls, [], "handoff must wait for restoration before case lookup or helper/file operations");
    const retained = { id: "local", number: "qa-local", owner: "Private edit" };
    state.CASES = [retained];
    state.WORKSPACE_RESTORED = true;
    api.markWriterReady();
    assert.match(await pendingReady, /Local work was kept/);
    assert.equal(state.CASES[0], retained, "a restored local case is reconciled rather than replaced");
    assert.deepEqual(calls.slice(0, 3), [["release", true], "render", ["preflight", "local", "report handoff"]]);
    assert.equal(state.STARTUP_STATUS, "ready");
    assert.equal(state.REPORT_RETURN, true);
    assert.equal(state.state.screen, "cases");
    assert.equal(state.state.caseFilter, "all");
    reset();
    const failedReady = api.writerOpenReportedCase({ number: "QA-LOCAL" });
    api.markWriterFailed(Error("Retained workspace unreadable"));
    await assert.rejects(failedReady, /restoration must finish/);
    assert.equal(state.STARTUP_STATUS, "failed");
    assert.equal(state.STARTUP_ERROR, "Retained workspace unreadable");
    assert.equal(state.WORKSPACE_RESTORED, false);
    assert.deepEqual(calls, [["release", false], "render"]);
    state.WRITER_ACCESS = false;
    await assert.rejects(api.writerOpenReportedCase({ number: "QA-LOCAL" }), /Another Writer tab/);
    state.WRITER_ACCESS = state.WRITER_READY = true;
    await assert.rejects(api.writerOpenReportedCase({ number: "  " }), /Invalid case number/);

    reset();
    state.WRITER_READY = true;
    const old = deferred(),
      fresh = deferred();
    helper = (url) => (url.endsWith("QA-OLD") ? old.promise : fresh.promise);
    const first = api.writerOpenReportedCase({ number: "QA-OLD" });
    const second = api.writerOpenReportedCase({ number: "QA-NEW", eventCount: 2 });
    fresh.resolve({ file: file("QA-NEW") });
    assert.match(await second, /Current shared case opened/);
    old.resolve({ file: file("QA-OLD") });
    await assert.rejects(first, /newer case request/);
    assert.deepEqual(
      calls.filter((c) => Array.isArray(c) && c[0] === "load").map((c) => c[1].case.number),
      ["QA-NEW"],
    );
    assert.equal(state.state.caseQ, "QA-NEW");
    assert.match(state.PREFLIGHT_NOTICE, /changed since this report was indexed/);
    for (const candidate of [file("QA-OTHER"), { ...file("QA-NEW"), events: "bad" }]) {
      calls = [];
      helper = async () => ({ file: candidate });
      await assert.rejects(api.writerOpenReportedCase({ number: "QA-NEW" }), /invalid or belongs to a different case/);
      assert.deepEqual(calls, [], "wrong-case or malformed results never reach the file adapter");
    }
    helper = async () => ({ file: file("QA-NEW") });
    load = () => false;
    await assert.rejects(api.writerOpenReportedCase({ number: "QA-NEW" }), /could not be loaded/);
    load = () => true;
    for (const [name, message] of [
      ["NotFoundError", /No shared case exists/],
      ["StorageError", /Shared storage disconnected/],
    ]) {
      helper = async () => {
        throw Object.assign(Error("Shared storage disconnected"), { name });
      };
      await assert.rejects(api.writerOpenReportedCase({ number: "QA-NEW" }), message);
    }

    const channels = [];
    global.BroadcastChannel = class {
      constructor(name) {
        this.name = name;
        this.messages = [];
        channels.push(this);
      }
      postMessage(message) {
        this.messages.push(message);
      }
    };
    window.BroadcastChannel = global.BroadcastChannel;
    global.location = { search: "" };
    reset();
    state.WRITER_READY = true;
    api.initWriterHandoff();
    const channel = channels[0];
    assert.equal(channel.name, "madison-writer-handoff-v1");
    await channel.onmessage({ data: { kind: "return-ack", request: "ack" } });
    assert.equal(state.RETURN_ACK, "ack");
    await channel.onmessage({ data: { kind: "unknown", request: "ignored" } });
    assert.deepEqual(channel.messages, []);
    helper = async () => ({ file: file("QA-CHANNEL") });
    await channel.onmessage({ data: { kind: "open", request: "request-1", number: "QA-CHANNEL" } });
    assert.equal(channel.messages[0].kind, "accepted");
    assert.equal(channel.messages[1].kind, "result");
    assert.equal(channel.messages[1].ok, true);
    helper = async () => {
      throw Error("Unavailable");
    };
    await channel.onmessage({ data: { kind: "open", request: "request-2", number: "QA-ERROR" } });
    assert.deepEqual(channel.messages.at(-1), { kind: "result", request: "request-2", ok: false, error: "Unavailable" });
    const delayed = deferred();
    helper = () => delayed.promise;
    const delayedReply = channel.onmessage({ data: { kind: "open", request: "request-3", number: "QA-DELAYED" } });
    state.WRITER_CHANNEL = null;
    delayed.resolve({ file: file("QA-DELAYED") });
    await delayedReply;
    assert.equal(channel.messages.at(-1).kind, "accepted", "a replaced channel must not receive the delayed result");
    const count = channel.messages.length;
    await channel.onmessage({ data: { kind: "open", request: "request-4", number: "QA-IGNORED" } });
    assert.equal(channel.messages.length, count, "an inactive channel accepts no new work");
    state.WRITER_CHANNEL = channel;
    state.WRITER_ACCESS = false;
    await channel.onmessage({ data: { kind: "open", request: "request-5", number: "QA-IGNORED" } });
    assert.equal(channel.messages.length, count, "a non-owning tab accepts no channel work");
    delete window.BroadcastChannel;
    global.location.search = "?case=QA-URL";
    state.WRITER_ACCESS = true;
    helper = async () => {
      throw Object.assign(Error("missing"), { name: "NotFoundError" });
    };
    api.initWriterHandoff();
    await tick();
    assert.match(state.PREFLIGHT_NOTICE, /Report handoff could not open the case: No shared case exists for QA-URL/);
    console.log(JSON.stringify({ passed: true, boundedDependencies: 6, restorationAndLatestRequestGuards: true, channelAndUrlHandoff: true }));
  } finally {
    Object.assign(global, saved);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
