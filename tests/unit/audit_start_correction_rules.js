/* Opening a correction against the retained module: the existing-draft shortcut, eligibility refusals, which issued
   fields are dropped, how recipients are merged from the case, the document and the issued copy, the stored
   correction record, and the order of peer reads and calls. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder } = require("../fixtures/equivalence_harness.cjs");

globalThis.__TEST_BUILD__ = true;
const { random, pick, chance } = prng(20261808);

const mail = () =>
  pick([
    { addr: "a@x.org", kind: "Owner" },
    { addr: " A@X.org ", kind: "Owner" },
    { addr: "b@y.org" },
    { addr: "", kind: "Agent" },
    { addr: "c@z.org", kind: "Agent", on: false },
    { addr: "a@x.org", on: false },
  ]);
const list = () => pick([undefined, null, "none", Array.from({ length: random(4) }, mail)]);

function scenario() {
  const src = {
    id: "src",
    caseId: "case",
    type: pick(["notice", "citation"]),
    items: [{ id: "i1" }],
    eventId: pick(["ev1", undefined]),
    issuedAt: pick(["2026-10-01T15:00:00Z", "2026-09-30T04:00:00Z"]),
    mailed: pick(["2026-10-02", undefined]),
    revision: pick([undefined, {}, { actionDate: "2026-10-03" }, { originalIssued: "2026-09-01" }]),
    emailedTo: list(),
    frozen: { x: 1 },
    void: chance(3) ? true : undefined,
    superseded: chance(3) ? true : undefined,
    annotations: [1],
    filedAt: "x",
    filedRef: "f1",
    accelaAt: "a1",
    accelaRef: "a2",
    issuedBy: "ins1",
    reconciliation: { r: 1 },
    replaces: "old",
    inspectorId: pick(["ins1", "ins2"]),
  };
  return {
    src,
    kase: { id: "case", number: "BLD2026-00001", inspectorId: pick(["", "ins2", undefined]), emails: list(), parcel: "p<1>" },
    events: Array.from({ length: random(4) }, (_, n) => ({ id: "e" + n, type: pick(["notice.issued", "document.voided", "case.noted"]) })),
    existing: chance(5) ? { id: "dx", caseId: "case", draft: true, correction: { targetId: pick(["src", "other"]) } } : null,
    docId: pick(["src", "src", "src", "missing"]),
    fault: pick(["", "", "", "Already corrected <x>"]),
    fail: chance(6) ? 1 + random(14) : 0,
  };
}

function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  Object.assign(state, {
    CASES: [x.kase],
    EVENTS: { case: x.events },
    DOCS: [x.src, ...(x.existing ? [x.existing] : [])],
    DIRTY: false,
    state: { docId: null, screen: "list" },
  });
  const returns = {
    correctionEligibility: () => x.fault,
    uid: (p) => p + "-new",
    docBody: () => ({ body: "text <b>" }),
    docBlocks: () => [{ id: "b1" }],
    saveDrafts: () => true,
  };
  const services = recorder(calls, returns, { today: new Date("2026-10-27T12:00:00Z") }, x.fail);
  const owner = api.createCorrectionWorkflow(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = owner.startCorrection(x.docId);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, calls, docs: state.DOCS, dirty: state.DIRTY, editor: state.state });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {createCorrectionWorkflow} from "./correction_workflow.js";'),
    compile(fs.readFileSync("tests/fixtures/correction_workflow_reference.txt", "utf8")),
  ]);
  const wanted = [
    "Correction draft opened",
    "Already corrected",
    "a@x.org|Owner",
    "b@y.org|Other",
    '"on":true',
    "interrupted",
    "originalIssued",
    '"actionDate":"2026-10-03"',
    "ins2",
    '"expectedHead":["e',
  ];
  const seen = new Set();
  for (let n = 0; n < 6000; n++) {
    const sc = scenario();
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `start correction scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    for (const f of wanted) if (after.includes(f)) seen.add(f);
    const parsed = JSON.parse(after);
    if (parsed.value && parsed.docs.length > 1 && sc.existing && parsed.value.id === sc.existing.id) seen.add("existing");
    if (parsed.error) seen.add("error");
  }
  for (const f of [...wanted, "existing", "error"]) assert.ok(seen.has(f), "scenarios reach: " + f);
  console.log("PASS start correction matches the retained module over 6000 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
