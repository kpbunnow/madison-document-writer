/* Exit review against the retained function: blocking and unresolved items, their order and wording, and every read
   of the supplied context in order, over synthetic case, queue and outbox states. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder } = require("../fixtures/equivalence_harness.cjs");

const { random, pick, chance } = prng(20261204);

function scenario() {
  const cases = Array.from({ length: random(4) }, (_, n) => ({
    id: "c" + n,
    number: pick(["BLD2026-0000" + n, "", undefined]),
    state: { pendingRecord: chance(8), pendingDoc: chance(8), pendingSync: chance(4), draft: chance(5), visit: chance(8) },
    proof: { valid: pick([true, true, false]), pendingTransaction: chance(10) },
    unsaved: chance(3),
    docs: pick([[], [], [{ filedAt: "t" }], [{}], [{ filedAt: "t", draft: false }]]),
    transfer: pick(["shared", "local outbox", "none"]),
  }));
  return {
    busy: pick([{}, {}, { publication: true }, { filing: true }, { publication: true, filing: true }]),
    save: pick([{ ok: true }, { ok: true, saving: true }, { ok: false }]),
    timer: chance(6) ? 5 : 0,
    cases,
    noCases: chance(10),
    pending: Array.from({ length: pick([0, 0, 1, 3]) }, (_, n) => ({ cid: pick(["c0", "c1"]), name: "n" + n })),
    helper: pick([null, {}, { outbox: 0 }, { outbox: 1 }, { outbox: 4 }, { outbox: -1 }, { outbox: 2.5 }]),
    casedir: pick([null, { helper: true }]),
    needgrant: chance(5),
    conflict: pick([null, { cid: "c0" }]),
    fail: chance(3) ? 1 + random(40) : 0,
  };
}

function run(exitReview, sc) {
  const x = structuredClone(sc),
    calls = [];
  const states = Object.fromEntries(x.cases.map((c) => [c.id, c]));
  const data = {
    LOCAL_SAVE: x.save,
    draftTimer: x.timer,
    CASES: x.noCases ? undefined : x.cases.map((c) => ({ id: c.id, number: c.number })),
    PENDING: x.pending,
    HELPER: x.helper,
    CASEDIR: x.casedir,
    NEEDGRANT: x.needgrant,
    PREFLIGHT_CONFLICT: x.conflict,
  };
  const returns = {
    caseState: (k) => states[k.id].state,
    "recordIntegrity.status": (k) => states[k.id].proof,
    caseUnsaved: (k) => states[k.id].unsaved,
    caseFileName: (k) => "file-" + k.id,
    docsFor: (cid) => states[cid].docs,
    deliveredByCitation: () => false,
    pdfTransferState: (d) => states[x.cases[0]?.id]?.transfer ?? "none",
  };
  const R = recorder(calls, returns, data, x.fail);
  let value, error;
  try {
    value = exitReview(R, x.busy);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {exitReview} from "./exit_review.js";'),
    compile(fs.readFileSync("tests/fixtures/exit_review_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  let interrupted = 0;
  for (let n = 0; n < 12000; n++) {
    const sc = scenario();
    const [before, after] = [run(legacy.exitReview, sc), run(current.exitReview, sc)];
    assert.equal(after, before, `exit review scenario ${n} differs from the retained function:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error) interrupted++;
    for (const item of [...(parsed.value?.blocking || []), ...(parsed.value?.unresolved || [])])
      seen.add(item.text.replace(/^[^:]*: /, "").replace(/\d+/g, "N"));
  }
  for (const text of [
    "A document is being issued.",
    "A PDF is being filed or an email is being prepared.",
    "Your work could not be saved on this device.",
    "Device saving has not finished.",
    "save confirmation needed.",
    "shared changes need review.",
    "issued PDF not yet filed.",
    "changes have not reached the shared folder.",
    "N shared saves queued on this device.",
    "The local PDF outbox has not been checked.",
    "N PDFs waiting in the local outbox.",
  ])
    assert.ok(
      [...seen].some((t) => t.includes(text.replace("N shared saves", "N shared save").slice(0, 20))),
      "scenarios reach: " + text,
    );
  assert.ok(interrupted > 300, "coverage: " + interrupted + " interrupted");
  console.log("PASS exit review matches the retained function over 12000 scenarios (" + interrupted + " interrupted)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
