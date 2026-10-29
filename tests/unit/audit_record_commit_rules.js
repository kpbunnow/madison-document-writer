/* Amendment commit against the retained module: result, ordered peer reads and calls, every state, candidate and
   draft effect, definitive and indefinite failures, and refusal on the first interrupted read or call. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");

async function compile(contents) {
  const build = await esbuild.build({
    stdin: {
      contents: contents + '\nexport {WriterState} from "./state.js"; export {INSPECTORS} from "./data/inspectors.js";',
      resolveDir: path.resolve("app/modules"),
    },
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

let seed = 20261102;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

function scenario(actors) {
  const person = () => pick([actors[0], actors[1], "nobody"]);
  const event = (id) => ({ id, by: person(), type: "notice.issued" });
  const type = pick(["notice.issued", "document.annotated", "document.reconciled", "document.voided"]);
  const changes = {};
  if (chance(3)) changes.owner = { after: pick([null, "New owner"]) };
  if (chance(6)) changes.note = { after: undefined };
  if (chance(4)) changes.phone = { after: pick([null, { n: 1 }]) };
  const candidateEvents = [];
  if (chance(4)) candidateEvents.push(event("att"));
  if (chance(4)) candidateEvents.push(event("e1"));
  return {
    cid: "case",
    draft: chance(5)
      ? null
      : {
          id: "doc",
          recordKey: pick(["", "rk"]),
          pendingAmendment: undefined,
          publicationEvents: pick([undefined, [], [event("e1")], [event("e1"), event("e2")]]),
        },
    attempt: { id: "att", by: person(), type, payload: { docId: "doc", fromReinspId: pick(["visit", "other", ""]), caseChanges: changes } },
    busy: chance(10),
    helper: !chance(8),
    saveDrafts: pick([true, true, true, false]),
    kase: { id: "case", number: pick(["BLD2026-00001", "BLD2026-00001", "bad"]), owner: "Owner", phone: "555", note: "n" },
    candidate: {
      case: { id: "case", number: "BLD2026-00001", owner: "Owner", phone: "555" },
      events: candidateEvents,
      inspectors: pick([[], [{ id: actors[0] }]]),
    },
    base: pick([undefined, { name: "base.json", revision: "r1" }, { name: "base.json" }]),
    checkpoint: pick([undefined, { case: { id: "case", owner: "Older" } }]),
    outcome: pick(["ok", "ok", "ok", "definitive", "indefinite", "network", "other"]),
    savedCase: { owner: pick(["Owner", "Saved owner"]), phone: pick(["555", "556"]), note: pick(["n", undefined]), extra: pick([undefined, "x"]) },
    savedEvents: pick([["att"], ["att", "e1"], ["att", "e1", "e2"], ["other"]]),
    localEvents: pick([["att"], ["att", "e1"], []]),
    pending: pick([[], [{ cid: "case" }, { cid: "else" }], [{ cid: "else" }]]),
    reins: [
      { id: "visit", draft: true },
      { id: "other", draft: true },
      { id: "kept", draft: false },
    ],
    docs: [{ id: "doc" }, { id: "keep" }],
    docId: pick(["doc", "doc", "x"]),
    modal: pick(["recordnote", "reconcile", "void", "other", null]),
    forms: ["doc:recordnote", "doc:reconcile", "doc:void", "keep:void"],
    fail: chance(3) ? 1 + random(70) : 0,
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
  const attemptEvent = x.candidate.events.slice();
  Object.assign(state, {
    CASES: [x.kase],
    DOCS: x.docs,
    REINSP: x.reins,
    EVENTS: { case: x.localEvents.map((id) => ({ id })) },
    CASEDIR: x.helper ? { helper: true } : null,
    AMENDMENT_BUSY: x.busy,
    SAVE_CHECKPOINTS: x.checkpoint ? { case: x.checkpoint } : {},
    PENDING: x.pending,
    RECORD_ATTEMPTS: { rk: 1, other: 2 },
    WORK: { recordForms: Object.fromEntries(x.forms.map((k) => [k, 1])) },
    state: { screen: "write", docId: x.docId, modal: x.modal, amendmentError: "" },
    LASTWRITE: null,
  });
  const result = {
    name: "saved.json",
    revision: "r2",
    file: {
      case: { id: "case", ...x.savedCase },
      events: x.savedEvents.map((id) => ({ id })),
    },
  };
  const toast = [];
  const returns = {
    saveDrafts: async () => x.saveDrafts,
    caseFile: () => x.candidate,
    "COMMITTED.get": () => x.base,
    "COMMITTED.set": () => undefined,
    helperJSON: async () => {
      if (x.outcome === "definitive" || x.outcome === "indefinite") {
        const error = new Error("The record could not be saved");
        error.name = "StorageError";
        if (x.outcome === "indefinite") error.definitive = false;
        throw error;
      }
      if (x.outcome === "network") throw new Error("Failed to fetch");
      if (x.outcome === "other") throw new Error("Server said no");
      return result;
    },
    mergeCaseEvents: () => undefined,
    project: () => undefined,
    rememberSaved: () => undefined,
    idbSet: async () => undefined,
    writeSummary: async () => undefined,
    toast: (m) => toast.push(m),
    render: () => undefined,
  };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createRecordCommit(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = await owner.commitAmendment(x.cid, x.attempt, x.draft);
  } catch (e) {
    error = [e.name, e.message];
  }
  const last = state.LASTWRITE && { ...state.LASTWRITE, at: typeof state.LASTWRITE.at };
  return JSON.stringify({ value, error, x, state: { ...state, LASTWRITE: last }, toast, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/record_commit.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/record_commit_reference.txt", "utf8")),
  ]);
  const actors = current.INSPECTORS.filter((i) => i.name)
    .slice(0, 2)
    .map((i) => i.id);
  const seen = new Set();
  let interrupted = 0,
    saved = 0,
    definitive = 0,
    network = 0;
  for (let n = 0; n < 6000; n++) {
    const sc = scenario(actors);
    const before = await run(legacy, sc),
      after = await run(current, sc);
    assert.equal(after, before, `commit scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error) interrupted++;
    else if (parsed.value) saved++;
    if (sc.outcome === "definitive" && sc.draft && !parsed.error && !sc.busy && sc.helper && sc.saveDrafts) definitive++;
    if (parsed.toast.some((m) => m.startsWith("The shared save could not"))) network++;
    for (const c of parsed.calls) seen.add(c.split("(")[0].replace(/^get /, ""));
  }
  for (const name of [
    "toast",
    "saveDrafts",
    "caseFile",
    "COMMITTED.get",
    "COMMITTED.set",
    "helperJSON",
    "mergeCaseEvents",
    "project",
    "rememberSaved",
    "idbSet",
    "writeSummary",
    "render",
  ])
    assert.ok(seen.has(name), "scenarios reach " + name);
  assert.ok(
    interrupted > 60 && saved > 1000 && definitive > 50 && network > 50,
    `coverage: ${interrupted} interrupted, ${saved} saved, ${definitive} definitive, ${network} network`,
  );
  console.log("PASS amendment commit matches the retained module over 6000 scenarios (" + interrupted + " interrupted, " + saved + " saved)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
