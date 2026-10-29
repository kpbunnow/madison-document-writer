/* Original PDF filing against the retained module: guards, the request, every outcome of the helper reply, the
   filed-event decision, the busy counter, and refusal on the first interrupted read or call. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");

async function compile(contents) {
  const build = await esbuild.build({
    stdin: { contents: contents + '\nexport {WriterState} from "./state.js";', resolveDir: path.resolve("app/modules") },
    bundle: true,
    write: false,
    format: "cjs",
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
  new Function("module", "exports", build.outputFiles[0].text)(box, box.exports);
  return box.exports;
}

let seed = 20261104;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

function scenario() {
  const snapshot = {
    id: "doc",
    caseId: pick(["case", "case", undefined]),
    frozen: chance(2) ? { case: { number: pick(["FROZEN-1", undefined]) } } : undefined,
  };
  return {
    d: chance(15)
      ? null
      : { id: "doc", caseId: "case", draft: chance(5), void: chance(8) ? { at: "x" } : undefined, superseded: chance(8) ? { at: "x" } : undefined },
    helper: pick([null, { chrome: false }, { chrome: true }, { chrome: true, outbox: 2 }]),
    job: pick([undefined, undefined, { docId: "doc", name: "a.pdf", html: "<p>a</p>" }, { docId: "other", name: "b.pdf", html: "<p>b</p>" }]),
    made: pick([null, { docId: "doc", name: "m.pdf", html: "<p>m</p>" }, { docId: "doc", name: "m.pdf", html: "" }]),
    events: pick([
      [{ id: "e1", type: "notice.issued", payload: { snapshot } }],
      [],
      [
        { id: "e1", type: "notice.issued", payload: { snapshot } },
        { id: "e2", type: "document.filed", payload: { docId: "doc", sha256: "abc" } },
      ],
      [
        { id: "e1", type: "notice.issued", payload: { snapshot } },
        { id: "e2", type: "document.filed", payload: { docId: "doc", sha256: "zzz" } },
      ],
    ]),
    busy: pick([undefined, 0, 2]),
    reply: pick(["ok", "ok", "ok", "local", "refused", "refusedNoReason", "nullReply", "badJson", "network"]),
    sha: pick(["abc", "def", undefined]),
    path: pick(["share/path.pdf", undefined]),
    hash: pick(["hash", "hash", "throw"]),
    save: pick(["ok", "ok", "throw"]),
    refresh: pick(["ok", "ok", "throw"]),
    fail: chance(3) ? 1 + random(60) : 0,
  };
}

function recorder(calls, returns, data, fail) {
  let count = 0;
  const tick = (label) => {
    if (++count === fail) throw new Error("interrupted:" + label);
  };
  const show = (value) => JSON.stringify(value, (_, v) => (v === undefined ? "<undefined>" : v));
  const make = (trail) =>
    new Proxy(function () {}, {
      get(_, key) {
        const next = trail.concat(String(key)),
          name = next.join(".");
        calls.push("get " + name);
        tick("get " + name);
        return name in data ? data[name] : make(next);
      },
      apply(_, __, args) {
        const name = trail.join(".");
        calls.push(name + "(" + show(args) + ")");
        tick(name);
        const result = returns[name];
        return typeof result === "function" ? result(...args) : result;
      },
    });
  return make([]);
}

async function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  Object.assign(state, {
    CASES: [{ id: "case", number: "BLD2026-00001" }],
    DOCS: x.d ? [x.d] : [],
    REINSP: [],
    EVENTS: { case: x.events },
    HELPER: x.helper,
    FILING_ACTIVE: x.busy,
  });
  const reply = () => {
    if (x.reply === "network") throw new Error("offline");
    return {
      ok: true,
      json: async () => {
        if (x.reply === "badJson") throw new Error("bad json");
        if (x.reply === "nullReply") return null;
        if (x.reply === "refused") return { ok: false, error: "disk full" };
        if (x.reply === "refusedNoReason") return { ok: false };
        return { ok: true, name: "filed.pdf", path: x.path, sha256: x.sha, local: x.reply === "local" };
      },
    };
  };
  const returns = {
    printJob: () => x.made,
    "recordIntegrity.sourceHash": async () => {
      if (x.hash === "throw") throw new Error("hash fault");
      return "hash";
    },
    toastHold: () => undefined,
    toast: () => undefined,
    authFetch: async () => reply(),
    appendEvent: (cid, type, payload) => {
      x.events.push({ id: "new" + x.events.length, type, payload });
    },
    saveCaseFile: async () => {
      if (x.save === "throw") throw new Error("save fault");
    },
    refreshArtifactLocations: async () => {
      if (x.refresh === "throw") throw new Error("refresh fault");
    },
  };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createDocumentDelivery(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = await owner.filePdf(x.d, x.job);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, x, helper: state.HELPER, busy: state.FILING_ACTIVE, docs: state.DOCS.length, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/document_delivery.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/document_delivery_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  let interrupted = 0,
    filed = 0,
    appended = 0;
  for (let n = 0; n < 6000; n++) {
    const sc = scenario();
    const before = await run(legacy, sc),
      after = await run(current, sc);
    assert.equal(after, before, `filing scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error) interrupted++;
    else if (parsed.value) filed++;
    if (parsed.calls.some((c) => c.startsWith("appendEvent"))) appended++;
    for (const c of parsed.calls) seen.add(c.split("(")[0].replace(/^get /, ""));
    if (parsed.error) seen.add(parsed.error[1].slice(0, 60));
  }
  for (const name of [
    "printJob",
    "recordIntegrity.sourceHash",
    "toastHold",
    "toast",
    "authFetch",
    "appendEvent",
    "saveCaseFile",
    "refreshArtifactLocations",
    "Save the issued document before filing its PDF.",
  ])
    assert.ok(seen.has(name), "scenarios reach " + name);
  assert.ok(interrupted > 100 && filed > 150 && appended > 100, `coverage: ${interrupted} interrupted, ${filed} filed, ${appended} appended`);
  console.log("PASS PDF filing matches the retained module over 6000 scenarios (" + interrupted + " interrupted, " + filed + " filed)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
