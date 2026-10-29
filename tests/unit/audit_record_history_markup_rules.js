/* Document record panel against the retained module: exact markup for every revision chain, withdrawal and
   follow-through state, pending attempts, record notes and save-in-progress state, with escaping and every peer
   read in order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder } = require("../fixtures/equivalence_harness.cjs");

const { random, pick, chance } = prng(20261301);

function scenario(inspectors) {
  const rootId = "root";
  const chainLength = random(4);
  const chain = Array.from({ length: chainLength }, (_, n) => ({
    id: "v" + n,
    caseId: "case",
    draft: chance(10),
    revision:
      n === 0
        ? chance(2)
          ? undefined
          : { rootId, number: 0, at: "2026-10-0" + (n + 1) + "T10:00:00Z" }
        : { rootId, number: n, at: "2026-10-1" + n + "T10:00:00Z", reason: pick(["Fix <typo>", "Late & wrong", ""]) },
    issuedAt: "2026-10-0" + (n + 1) + "T09:00:00Z",
    superseded: chance(3) ? { at: "x" } : undefined,
    void: chance(10) ? { at: "x" } : undefined,
  }));
  const current = {
    id: pick(["v0", "doc", "v1"]),
    caseId: "case",
    draft: chance(8),
    revision: chance(2) ? { rootId, number: 1, at: "2026-10-10T10:00:00Z" } : undefined,
    issuedAt: "2026-10-01T09:00:00Z",
    void: chance(3) ? { at: "w" } : undefined,
    reconciliation: chance(3) ? { by: pick([inspectors[0], "ghost"]), at: "2026-10-12T10:00:00Z", reference: pick(["Ref <1>", ""]) } : undefined,
    annotations: pick([
      undefined,
      [],
      [{ at: "2026-10-11T10:00:00Z", by: pick([inspectors[0], "ghost"]), text: "Note & <b>" }],
      [
        { at: "2026-10-11T10:00:00Z", by: inspectors[0], text: "a" },
        { at: "2026-10-12T10:00:00Z", by: "ghost", text: "b" },
      ],
    ]),
  };
  return {
    current,
    chain,
    attempts: pick([
      {},
      {},
      { k: { cid: "case", recordKey: "rk <1>", pendingAmendment: { payload: { docId: current.id } } } },
      { k: { cid: "other", recordKey: "z", pendingAmendment: { payload: { docId: current.id } } } },
    ]),
    busy: pick([null, null, "busydoc"]),
    busyCase: pick(["case", "other"]),
    fail: chance(3) ? 1 + random(10) : 0,
  };
}

function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  Object.assign(state, {
    CASES: [{ id: "case", number: "BLD2026-00001" }],
    DOCS: [x.current, ...x.chain, ...(x.busy ? [{ id: x.busy, caseId: x.busyCase }] : [])],
    RECORD_ATTEMPTS: x.attempts,
    state: { publicationBusy: x.busy, modal: null },
  });
  const returns = { fmtDate: (v) => "D:" + v };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createRecordHistory(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = owner.recordHistoryHTML(x.current);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {createRecordHistory} from "./record_history.js";'),
    compile(fs.readFileSync("tests/fixtures/record_history_reference.txt", "utf8")),
  ]);
  const inspectors = current.INSPECTORS.map((i) => i.id);
  const seen = new Set();
  for (let n = 0; n < 6000; n++) {
    const sc = scenario(inspectors);
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `record history scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const html = JSON.parse(after).value || "";
    for (const f of [
      "Follow-through still needs recordi",
      "Follow-through recorded by",
      "awaiting save confirmation",
      "Version history · 1 version",
      "versions",
      "record notes",
      "Revision ",
      "Original",
      "Replaced",
      "Withdrawn",
      "Current version",
      "Record notes</h3>",
      "Record notes explain",
      "Finishing document save",
      "disabled aria-describedby",
      "Fix &lt;typo&gt;",
      "Note &amp; &lt;b&gt;",
      "rk &lt;1&gt;",
    ])
      if (html.includes(f)) seen.add(f);
    if (!html) seen.add("empty");
  }
  for (const f of [
    "Follow-through still needs recordi",
    "Follow-through recorded by",
    "awaiting save confirmation",
    "versions",
    "record notes",
    "Revision ",
    "Original",
    "Replaced",
    "Withdrawn",
    "Current version",
    "Record notes</h3>",
    "Record notes explain",
    "Finishing document save",
    "Fix &lt;typo&gt;",
    "Note &amp; &lt;b&gt;",
    "rk &lt;1&gt;",
    "empty",
  ])
    assert.ok(seen.has(f), "scenarios reach: " + f);
  console.log("PASS document record panel matches the retained module over 6000 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
