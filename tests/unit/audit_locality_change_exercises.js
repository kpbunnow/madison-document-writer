/* Phase 3 change exercises. Two realistic rule changes are made to an in-memory copy of a module and verified at the
   calculation level only: a plain lookup object stands in for every live read, the live workspace state is poisoned
   (any read or write throws), and no service object exists. Each exercise checks that the change has its intended
   effect and that every other result is unchanged against the unmodified module over generated scenarios.
   Before Phase 3 the same checks needed the whole owner, the shared workspace collections and a services object. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");

async function compile(file, contents, exportsLine) {
  const built = await esbuild.build({
    stdin: { contents: contents + "\n" + exportsLine + '\nexport {WriterState} from "./state.js";', resolveDir: path.resolve("app/modules") },
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
  new Function("today", "module", "exports", built.outputFiles[0].text)(new Date("2026-11-14T12:00:00Z"), box, box.exports);
  // Poison the live workspace: a calculation that reaches it fails the exercise.
  for (const key of ["CASES", "DOCS", "REINSP", "EVENTS", "CASEDIR", "PENDING"])
    Object.defineProperty(box.exports.WriterState, key, {
      configurable: true,
      get() {
        throw new Error("calculation read live state " + key);
      },
      set() {
        throw new Error("calculation wrote live state " + key);
      },
    });
  return box.exports;
}

function edited(source, find, replace) {
  assert.equal(source.split(find).length - 1, 1, "the exercise edit applies exactly once");
  return source.replace(find, replace);
}

let seed = 20261115;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (a) => a[random(a.length)];

/* Exercise A — correction preparation. Rule change: a correction's explanation must name the error in at least
   20 characters (was 10). Only correctionContentChecks changes; it is tested with a plain view. */
async function exerciseA() {
  const file = "app/modules/correction_preparation.js",
    source = fs.readFileSync(file, "utf8"),
    exportsLine = "export { correctionCheckList };";
  const changedSource = edited(
    source,
    "c.reason.trim().length >= 10 && c.reason.trim().length <= 1000",
    "c.reason.trim().length >= 20 && c.reason.trim().length <= 1000",
  );
  const [before, after] = await Promise.all([compile(file, source, exportsLine), compile(file, changedSource, exportsLine)]);
  const view = (x) => ({
    source: () => x.src,
    caseOf: () => ({ number: "BLD2026-00001", date: "2026-10-01" }),
    liveCase: () => ({ owner: "Original" }),
    inspectorOf: () => ({ id: "i4" }),
    documentOf: () => null,
    documentsOf: () => [],
    visitOf: () => null,
    visitsOf: () => [],
    head: () => ["e1"],
    inspectionOf: () => ({ date: "2026-10-01" }),
    today: () => new Date("2026-11-14T12:00:00Z"),
    caseFolder: () => ({ helper: true }),
    eligibility: () => "",
    changes: () => [{ path: "item.1.text" }],
    typeAllowed: () => true,
    visitPatch: () => null,
    visitChecks: () => [],
  });
  let changed = 0,
    scenarios = 0;
  for (let n = 0; n < 600; n++) {
    const reason = pick(["Fix", "Correct the wall text", "Corrected the recorded stair description", "x".repeat(15), "y".repeat(1001)]);
    const src = { id: "old", type: "notice", items: [{ id: "a", no: "1" }], special: {} };
    const d = {
      id: "draft",
      caseId: "case",
      type: "notice",
      items: [{ id: "a", no: "1", done: !!random(2), doneOn: pick(["2026-10-20", "bad"]) }],
      correction: {
        reason,
        actionDate: pick(["2026-10-20", "2026-12-01"]),
        externalReference: "",
        expectedHead: pick([["e1"], ["e2"]]),
        case: { number: "BLD2026-00001" },
        caseBaseline: {},
      },
    };
    const a = before.correctionCheckList(d, view({ src })),
      b = after.correctionCheckList(d, view({ src }));
    const reasonCheck = (list) => list.findIndex((c) => c.t.startsWith("Explain the error"));
    // Every other check is unchanged; the reason check changes only for 10–19 characters.
    assert.deepEqual(
      a.filter((_, i) => i !== reasonCheck(a)),
      b.filter((_, i) => i !== reasonCheck(b)),
    );
    const length = reason.trim().length;
    assert.equal(b[reasonCheck(b)].ok, length >= 20 && length <= 1000);
    if (a[reasonCheck(a)].ok !== b[reasonCheck(b)].ok) changed++;
    scenarios++;
  }
  assert.ok(changed > 0, "the change has its intended effect");
  return { scenarios, changed, liveStateReads: 0, servicesNeeded: 0 };
}

/* Exercise B — follow-up drafting. Rule change: when items are still outstanding, the compliance-letter refusal
   says what to do with them. Only followupCarryRefusal changes; followupDraftRefusal is tested with a plain view. */
async function exerciseB() {
  const file = "app/modules/reinspection.js",
    source = fs.readFileSync(file, "utf8"),
    exportsLine = "export { followupDraftRefusal };";
  const changedSource = edited(
    source,
    '{ t: "Items are still outstanding — a compliance letter closes every item" }',
    '{ t: "Items are still outstanding. A compliance letter closes every item; correct or withdraw the rest first." }',
  );
  const [before, after] = await Promise.all([compile(file, source, exportsLine), compile(file, changedSource, exportsLine)]);
  const view = (x) => ({
    eligibility: () => x.unavailable,
    worksheetFaults: () => x.faults,
    unchecked: () => x.unchecked,
    validISO: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || ""),
    today: () => "2026-11-14",
  });
  let changed = 0,
    scenarios = 0;
  for (let n = 0; n < 600; n++) {
    const x = {
      unavailable: pick(["", "", "Not available here"]),
      faults: pick([[], [], ["Record the results first"]]),
      unchecked: pick([[], [], [{ id: "a" }]]),
    };
    const r = { draft: !!random(2), recordedAt: pick(["", "2026-11-10"]), date: pick(["2026-11-10", "bad", "2026-12-01"]) };
    const type = pick(["extension", "citation", "referral", "compliance", "reinspectionNotice", "bogus"]),
      src = pick([null, { items: [], void: false }]),
      carry = pick([[], [{ id: "a" }]]);
    const a = before.followupDraftRefusal(r, type, src, carry, view(x)),
      b = after.followupDraftRefusal(r, type, src, carry, view(x));
    const compliance = a?.t === "Items are still outstanding — a compliance letter closes every item";
    if (compliance) {
      assert.equal(b.t, "Items are still outstanding. A compliance letter closes every item; correct or withdraw the rest first.");
      changed++;
    } else assert.deepEqual(a, b, "every other refusal (and permission) is unchanged");
    scenarios++;
  }
  assert.ok(changed > 0, "the change has its intended effect");
  return { scenarios, changed, liveStateReads: 0, servicesNeeded: 0 };
}

(async () => {
  const a = await exerciseA(),
    b = await exerciseB();
  console.log(JSON.stringify({ passed: true, correctionReasonLength: a, complianceRefusalText: b }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
