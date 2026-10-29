/* Issuance flow against the retained module: return value, thrown error, ordered peer reads and calls (with the
   state they leave behind), editor/draft effects, and refusal on the first interrupted read or call. */
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

let seed = 20261031;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

function scenario() {
  const wanted = chance(3),
    type = pick(["notice", "notice", "citation", "extension"]),
    pending = chance(5);
  const snapshotOf = (id, t) => ({ id, type: t, issuedBy: "x", ...(chance(6) ? { deliveredByCitation: true } : {}) });
  return {
    d: {
      id: "doc",
      caseId: "case",
      draft: !chance(8),
      type,
      correction: chance(10) ? { id: "c" } : undefined,
      emailedTo: pick([undefined, [], ["a@example.test"], ["a@example.test", "b@example.test"]]),
      pendingAmendment: pending ? { id: "pend", payload: { snapshot: snapshotOf("doc", type), caseChanges: {} } } : undefined,
      publicationEvents: pick([undefined, [], [{ id: "e1", payload: { snapshot: snapshotOf("prior", "notice") } }], [{ id: "e2", payload: {} }]]),
    },
    attemptSnapshot: pick([snapshotOf("doc", type), snapshotOf("cit", "citation"), null]),
    blocked: chance(8),
    busy: chance(10),
    helper: !chance(8),
    catalog: !chance(6),
    wanted,
    prepFault: chance(10),
    loaded: !chance(8),
    signature: chance(6),
    blockers: chance(8) ? 1 : 0,
    job: pick(["ok", "ok", "ok", "empty", "none", "throw"]),
    jobCalls: pick(["ok", "ok", "throw"]),
    commit: !chance(8),
    issued: pick(["doc", "doc", "both", "none"]),
    filed: pick([true, true, false, "throw"]),
    emailThrows: chance(8),
    needsCitation: chance(4),
    revealed: !chance(4),
    screen: pick(["write", "write", "write", "home"]),
    modalAfter: chance(8),
    docIdAfter: pick(["doc", "doc", "cit", "other"]),
    again: chance(10),
    fail: chance(3) ? 1 + random(60) : 0,
  };
}

function recorder(calls, returns, data, fail, hook) {
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
        calls.push(name + "(" + show(args) + ")" + hook.snapshot());
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
    DOCS: [x.d],
    CASEDIR: x.helper ? { helper: true } : null,
    AMENDMENT_BUSY: x.busy,
    WORK: { recordForms: { "doc:final": { keep: 1 } } },
    state: { screen: x.screen, docId: "doc", modal: "final", amendmentError: "", publicationBusy: null },
  });
  const issuedDocs = () => {
    const base = { id: "doc", caseId: "case", type: x.d.type, emailedTo: x.d.emailedTo, issuedBy: "x" };
    if (x.issued === "none") return [];
    if (x.issued === "doc") return [base];
    return [base, { id: "cit", caseId: "case", type: "citation" }];
  };
  const fileState = () => ({
    screen: state.state.screen,
    docId: state.state.docId,
    modal: state.state.modal,
    busy: state.state.publicationBusy,
    error: state.state.amendmentError,
  });
  const hook = { snapshot: () => " @" + JSON.stringify(fileState()) };
  const returns = {
    "recordIntegrity.blocked": () => x.blocked,
    refreshCatalog: async () => x.catalog,
    "initialCitations.enabled": () => x.wanted,
    "initialCitations.prepare": () => {
      if (x.prepFault) throw new Error("prepare fault");
    },
    "citationPricing.refresh": () => undefined,
    "citationPricing.signature": () =>
      x.signature && calls.filter((c) => c.startsWith("citationPricing.signature")).length > 1 ? "changed" : "same",
    "citationPricing.loadShared": async () => x.loaded,
    blockers: () => (x.blockers ? [{ t: "block" }] : []),
    makePublication: () => ({ id: "att", payload: { snapshot: x.attemptSnapshot } }),
    printJob: (snapshot) => {
      if (x.job === "throw") throw new Error("render fault");
      if (x.job === "none") return null;
      return { html: x.job === "empty" ? "  " : "<p>" + (snapshot && snapshot.id) + "</p>" };
    },
    commitAmendment: async () => {
      if (x.commit) state.DOCS = issuedDocs();
      return x.commit;
    },
    filePdf: async () => {
      if (x.filed === "throw") throw new Error("file fault");
      return x.filed;
    },
    emailDocument: async () => {
      if (x.emailThrows) throw new Error("email fault");
    },
    needsInitialCitation: () => x.needsCitation,
    revealIssuedCase: () => x.revealed,
    saveDrafts: async () => true,
    toast: () => undefined,
    render: () => {
      if (x.modalAfter) state.state.modal = "again";
      if (x.docIdAfter !== "doc") state.state.docId = x.docIdAfter;
    },
    focusIssuedCase: () => undefined,
  };
  const services = recorder(calls, returns, {}, x.fail, hook);
  const owner = api.createPublicationWorkflow(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let result, error;
  try {
    const first = owner.publishDocument(x.d);
    const second = x.again ? owner.publishDocument(x.d) : undefined;
    result = [await first, await second];
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ result, error, d: x.d, ...fileState(), work: state.WORK, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/publication_workflow.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/publication_workflow_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  let interrupted = 0,
    issued = 0,
    returned = 0;
  for (let n = 0; n < 5000; n++) {
    const sc = scenario();
    const before = await run(legacy, sc),
      after = await run(current, sc);
    assert.equal(after, before, `issuance scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error) interrupted++;
    if ((parsed.result || [])[0] === true) issued++;
    if (parsed.calls.some((c) => c.startsWith("focusIssuedCase"))) returned++;
    seen.add(parsed.error ? "error" : parsed.error === undefined && parsed.d.pendingAmendment ? "pending" : "plain");
    for (const c of parsed.calls) seen.add(c.split("(")[0].replace(/^get /, ""));
  }
  // The generator must keep reaching every peer, or the comparison would silently weaken.
  for (const name of [
    "recordIntegrity.blocked",
    "toast",
    "commitCitationEdits",
    "saveDrafts",
    "refreshCatalog",
    "initialCitations.prepare",
    "citationPricing.loadShared",
    "blockers",
    "makePublication",
    "printJob",
    "commitAmendment",
    "filePdf",
    "emailDocument",
    "needsInitialCitation",
    "revealIssuedCase",
    "focusIssuedCase",
  ])
    assert.ok(seen.has(name), "scenarios reach " + name);
  assert.ok(interrupted > 100 && issued > 1000 && returned > 200, `coverage: interrupted ${interrupted}, issued ${issued}, returned ${returned}`);
  console.log("PASS issuance flow matches the retained module over 5000 scenarios (" + interrupted + " interrupted, " + issued + " issued)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
