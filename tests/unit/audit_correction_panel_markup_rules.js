/* Correction panel against the retained module: exact markup for locked and unlocked drafts, every document family,
   the recorded-visit editor, the change table, errors and escaping, with every peer read and call in order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder } = require("../fixtures/equivalence_harness.cjs");

globalThis.__TEST_BUILD__ = true;
const { random, pick, chance } = prng(20261303);

function scenario() {
  const items = Array.from({ length: 1 + random(3) }, (_, n) => ({
    id: "it" + n,
    srcItemId: "s" + n,
    no: String(n + 1),
    withdrawn: chance(6),
    done: chance(3),
    doneOn: pick(["2026-10-12", ""]),
  }));
  const type = pick(["notice", "citation", "referral", "extension", "summaryAbatement", "noOccupancy", "compliance"]);
  return {
    d: {
      id: pick(["doc <1>", "doc"]),
      caseId: "case",
      type,
      items,
      pendingAmendment: chance(4) ? { id: "p" } : undefined,
      correction: {
        targetId: pick(["src", "src", "gone"]),
        reason: pick(["Wrong <date>", "", "Typo & more"]),
        externalReference: pick(["Court ref <1>", ""]),
        actionDate: pick(["2026-10-10", ""]),
        case: pick([{}, { parcel: "0709-<1>", siteCity: "Madison, WI 53703" }]),
        outcomes: pick([undefined, { it0: "corrected" }]),
      },
    },
    nocorrection: chance(10),
    source: { id: "src", caseId: "case", type, revision: pick([undefined, {}, { number: 2 }]), fromReinspId: pick(["visit", "", "gone"]) },
    results: Object.fromEntries(
      items.map((it) => [it.srcItemId, pick([undefined, { oc: "open" }, { oc: "corrected" }, { oc: "open", carried: true }])]),
    ),
    changes: pick([
      [],
      [
        { label: "Owner <name>", path: "case.owner", before: "A", after: "B" },
        { label: "Deposit", path: "citation.x.base", before: 5000, after: 6000 },
      ],
    ]),
    allowed: pick([[], ["notice"], ["notice", "citation"]]),
    error: pick(["", "", "Save failed <now>"]),
    fail: chance(3) ? 1 + random(8) : 0,
  };
}

function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  if (x.nocorrection) delete x.d.correction;
  Object.assign(state, {
    CASES: [{ id: "case", number: "BLD2026-00001" }],
    DOCS: [x.d, x.source],
    REINSP: [{ id: "visit", caseId: "case", results: x.results }],
    state: { amendmentError: x.error },
  });
  const returns = { correctionChanges: () => x.changes, correctionTypeAllowed: (src, id) => x.allowed.includes(id) };
  const services = recorder(calls, returns, { today: new Date("2026-10-27T12:00:00Z") }, x.fail);
  const owner = api.createCorrectionUI(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = owner.correctionPanel(x.d);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {createCorrectionUI} from "./correction_ui.js";'),
    compile(fs.readFileSync("tests/fixtures/correction_panel_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  for (let n = 0; n < 6000; n++) {
    const sc = scenario();
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `correction panel scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const html = JSON.parse(after).value || "";
    for (const f of [
      "revision 1",
      "revision 3",
      "The save response was not confirmed",
      "banner alert",
      "correction-external",
      "disabled",
      "correction-visit",
      "correction-type",
      "data-correction-outcome",
      "doneOn",
      "Owner &lt;name&gt;",
      "Wrong &lt;date&gt;",
      "Compare with the issued version",
      "$50.00",
    ])
      if (html.includes(f)) seen.add(f);
    if (!html) seen.add("empty");
  }
  for (const f of [
    "revision 1",
    "revision 3",
    "The save response was not confirmed",
    "banner alert",
    "correction-external",
    "correction-visit",
    "correction-type",
    "data-correction-outcome",
    "Owner &lt;name&gt;",
    "Wrong &lt;date&gt;",
    "Compare with the issued version",
    "empty",
  ])
    assert.ok(seen.has(f), "scenarios reach: " + f);
  console.log("PASS correction panel matches the retained module over 6000 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
