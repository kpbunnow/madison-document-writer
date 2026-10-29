/* Safety click actions against the retained module: attribute priority, every action's peer calls in order with the
   state they see, failure toasts, and refusal on the first interrupted read or call. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder, listenerTarget } = require("../fixtures/equivalence_harness.cjs");

process.on("unhandledRejection", () => {});
const { random, pick, chance } = prng(20261201);

const ATTRS = [
  "data-safety-local",
  "data-sync-safety",
  "data-setup-health",
  "data-health-probe",
  "data-diagnostics-copy",
  "data-lock-inspect",
  "data-conflict-apply",
  "data-safety-backup",
  "data-safety-catalog",
  "data-safety-outbox",
  "data-safety-pending",
  "data-safety-case",
];
const ACTIONS = [
  "integrity",
  "conflict",
  "pending",
  "document",
  "pdf",
  "outbox",
  "storage",
  "save",
  "other",
  "",
  "constructor",
  "toString",
  "__proto__",
];

function scenario() {
  const attrs = ATTRS.filter(() => chance(7));
  if (!attrs.length && !chance(6)) attrs.push(pick(ATTRS));
  return {
    none: chance(12),
    attrs,
    dataset: { syncSafety: pick(["", "case-1"]), safetyCase: pick(["c1", "c2"]), safetyAction: pick(ACTIONS) },
    casedir: pick([null, { helper: true }]),
    needgrant: chance(4),
    copy: pick(["clipboard", "exec", "clipboard"]),
    state: {
      current: pick([null, { id: "dcur" }]),
      visit: chance(2),
      pendingDoc: pick([null, { id: "pd" }]),
      pendingRecord: { recordKey: pick(["rk", "none"]) },
    },
    holder: chance(2),
    docs: [
      { id: "draft", caseId: "c1", draft: chance(2), void: true },
      {
        id: "pdfdoc",
        caseId: "c1",
        draft: false,
        void: chance(5),
        superseded: chance(5),
        filedAt: pick(["", "t"]),
        type: "notice",
        authoringVersion: pick([9, 12]),
        issuanceGroup: chance(5) ? { citationId: "x" } : undefined,
      },
    ],
    transfer: pick(["shared", "local outbox", "none"]),
    throwAt: chance(8)
      ? pick(["saveDrafts", "showSafety", "showHealth", "inspectLock", "preflightCase", "showOutbox", "saveCaseFile", "flushPending"])
      : "",
    fail: chance(3) ? 1 + random(14) : 0,
  };
}

async function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  Object.assign(state, {
    CASES: [
      { id: "c1", number: "BLD2026-00001" },
      { id: "c2", number: "BLD2026-00002" },
    ],
    DOCS: x.docs,
    CASEDIR: x.casedir,
    NEEDGRANT: x.needgrant,
    RECORD_ATTEMPTS: x.holder ? { rk: { cid: "c1", pendingAmendment: { id: "pa" } } } : {},
    SAFETY_LOCK: {},
    state: { screen: "cases", docId: "", modal: null },
  });
  const element = (id) => ({ id, value: "diag", select: () => calls.push("select"), close: () => calls.push("close") });
  globalThis.document = { getElementById: (id) => (calls.push("getElementById " + id), element(id)), execCommand: (c) => calls.push("exec " + c) };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: x.copy === "clipboard" ? { clipboard: { writeText: async (v) => calls.push("write " + v) } } : {},
  });
  const fault = (name) => (x.throwAt === name ? Promise.reject(new Error(name + " failed")) : Promise.resolve());
  const returns = {
    saveDrafts: () => fault("saveDrafts"),
    showSafety: () => fault("showSafety"),
    showHealth: () => fault("showHealth"),
    inspectLock: () => fault("inspectLock"),
    applyConflict: async () => undefined,
    backupUnfinished: async () => undefined,
    recoveryJobs: () => ["job"],
    refreshCatalog: async () => undefined,
    showOutbox: () => fault("showOutbox"),
    flushPending: () => fault("flushPending"),
    render: () => undefined,
    toast: () => undefined,
    caseState: () => x.state,
    "recordIntegrity.status": () => ({ label: "Mismatch <b>", eventId: "e1", expected: "a", actual: "b" }),
    "A11Y.utility": () => undefined,
    preflightCase: async (cid, kind, cb) => {
      await fault("preflightCase");
      cb();
    },
    startReinspection: () => undefined,
    pdfTransferState: () => x.transfer,
    saveCaseFile: () => fault("saveCaseFile"),
    commitAmendment: () => undefined,
  };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createSafetyEvents(services);
  assert.deepEqual(calls, [], "construction remains inert");
  const target = listenerTarget();
  owner.registerSafetyActions(target);
  const el = x.none ? null : { hasAttribute: (a) => x.attrs.includes(a), dataset: x.dataset };
  let error;
  try {
    await target.listeners.click({ target: { closest: () => el } });
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ error, ui: state.state, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {createSafetyEvents} from "./safety_events.js";'),
    compile(fs.readFileSync("tests/fixtures/safety_events_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  let interrupted = 0,
    toasted = 0;
  for (let n = 0; n < 10000; n++) {
    const sc = scenario();
    const [before, after] = [await run(legacy, sc), await run(current, sc)];
    assert.equal(after, before, `safety scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error || parsed.calls.some((c) => c.includes("interrupted:"))) interrupted++;
    if (parsed.calls.some((c) => c.startsWith("toast("))) toasted++;
    for (const c of parsed.calls) seen.add(c.split("(")[0].replace(/^get /, ""));
    seen.add("action:" + sc.dataset.safetyAction + (sc.attrs.length ? "" : ":bare"));
  }
  for (const name of [
    "saveDrafts",
    "showSafety",
    "showHealth",
    "inspectLock",
    "applyConflict",
    "backupUnfinished",
    "refreshCatalog",
    "showOutbox",
    "flushPending",
    "preflightCase",
    "startReinspection",
    "saveCaseFile",
    "A11Y.utility",
    "pdfTransferState",
    "commitAmendment",
    "write diag",
    "exec copy",
  ])
    assert.ok(seen.has(name), "scenarios reach " + name);
  assert.ok(interrupted > 100 && toasted > 200, `coverage: ${interrupted} interrupted, ${toasted} toasted`);
  console.log("PASS safety actions match the retained module over 10000 scenarios (" + interrupted + " interrupted, " + toasted + " toasted)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
