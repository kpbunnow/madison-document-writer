/* Phase 3 correction preparation: the pure comparison, visit-patch, eligibility and check calculations behave exactly
   as the retained original owner (tests/fixtures/correction_preparation_reference.txt), including the order of every
   property read on the draft and its source, service calls, thrown errors and the produced correction event. */
const assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");

const REFERENCE = "tests/fixtures/correction_preparation_reference.txt";
const REFERENCE_SHA256 = "de3cfa6a6d9dfa318a964fbf6ce6db67868b407c64f517ff930350265ac29099";
const NOW = Date.parse("2026-11-14T15:00:00Z");

async function compile(contents) {
  const built = await esbuild.build({
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
  // A fixed clock: makeCorrectionAttempt stamps the event no earlier than now.
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [NOW]));
    }
    static now() {
      return NOW;
    }
  }
  const box = { exports: {} };
  new Function("module", "exports", "Date", built.outputFiles[0].text)(box, box.exports, FixedDate);
  return box.exports;
}

let seed = 20261114;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (a) => a[random(a.length)],
  maybe = (value, other) => (random(3) ? value : other);

const TYPES = [
  "notice",
  "extension",
  "citation",
  "referral",
  "referralUpdate",
  "compliance",
  "bestInterestExtension",
  "vacancyExtension",
  "noOccupancy",
];

function scenario() {
  const type = pick(TYPES),
    count = 1 + random(3),
    items = [];
  for (let n = 0; n < count; n++)
    items.push({
      id: "item" + n,
      no: String(n + 1),
      srcItemId: "src" + n,
      text: "Repair " + n,
      title: "Item " + n,
      sections: ["27.05(2)(c)"],
      due: "2026-11-0" + (n + 1),
      note: maybe("", "Observed"),
      done: !!random(4) && false,
      withdrawn: false,
    });
  const source = {
    id: "old",
    caseId: "case",
    type,
    authoringVersion: pick([9, 12, 14, 15, 16]),
    mailed: "2026-10-20",
    issuedAt: "2026-10-20T14:00:00Z",
    inspDate: "2026-10-19",
    inspTime: "09:00",
    inspectorId: "i4",
    fromReinspId: maybe("visit", ""),
    items,
    cits: maybe({ item0: { base: "100", amount: "197", cc: "38" } }, undefined),
    special: maybe({ reason: "Retained reason", noSafety: true, scope: "unit", unit: "1", reviewDate: "2026-11-02", mode: "dated" }, undefined),
    revision: maybe(undefined, { number: 1, rootId: "root", actionDate: pick(["2026-10-18", ""]), originalIssued: "2026-10-17" }),
  };
  const d = structuredClone(source);
  d.id = "draft";
  d.draft = true;
  d.correction = {
    targetId: "old",
    actionDate: pick(["2026-10-20", "2026-11-20", "not-a-date", "2026-10-01"]),
    outcomes: maybe({}, { item0: pick(["corrected", "none", "extended"]) }),
    reason: pick(["Correct the recorded wall description", "short", "x".repeat(1200), undefined]),
    externalReference: pick(["City Attorney instruction 2026-11", "", undefined]),
    expectedHead: maybe(["e1"], ["e1", "e2"]),
    baseEventId: "e1",
    case: {
      id: "case",
      number: maybe("BLD2026-00001", "BLD2026-00009"),
      owner: maybe("Original", "Revised owner"),
      ownerAddr: maybe("1 Main", "2 Main"),
    },
    caseBaseline: { owner: "Original", ownerAddr: "1 Main", ownerAddressParsed: { street: "1 Main" } },
  };
  // Draft edits: content, items, visit date, special facts and citations.
  if (random(2)) d.items[0].text = "Changed text";
  if (random(3) === 0) d.items[0].id = "renumbered";
  if (random(3) === 0) d.items.reverse();
  if (random(3) === 0) Object.assign(d.items.at(-1), { done: true, doneOn: pick(["2026-10-25", "2026-11-30", "bad", "2026-09-01"]) });
  if (random(4) === 0) Object.assign(d.items[0], { withdrawn: true, withdrawalReason: pick(["", "Owner sold the parcel last year"]) });
  if (random(3) === 0) d.items[0].note = "New note";
  if (random(3) === 0) d.items[0].due = "2026-12-01";
  if (random(2)) d.inspDate = pick(["2026-10-21", "2026-10-10", "2026-12-01", ""]);
  if (random(3) === 0) d.inspTime = "10:30";
  if (random(3) === 0) d.mailed = "2026-10-22";
  if (random(3) === 0) d.type = pick(TYPES);
  if (random(3) === 0 && d.special) d.special.scope = "building";
  if (random(3) === 0) d.cits = { item0: { amount: "250", overrideBasis: "approved", extra: "x" } };
  const visit = {
    id: "visit",
    caseId: "case",
    eventId: "visit-event",
    date: "2026-10-19",
    sourceDocId: maybe("earlier", "missing"),
    results: Object.fromEntries(
      items.map((i) => [
        i.srcItemId,
        {
          oc: pick(["none", "corrected", "extended"]),
          on: pick(["2026-10-19", "2026-10-18", "", undefined]),
          manualDate: !!random(3),
          carried: !random(5),
          ...(random(2) ? { note: "kept" } : {}),
        },
      ]),
    ),
  };
  const others = [];
  if (random(4) === 0) others.push({ id: "later", caseId: "case", draft: false, type: "notice", items: [] });
  if (random(4) === 0) others.push({ id: "other-draft", caseId: "case", draft: true, type: "notice", items: [] });
  if (random(4) === 0) others.push({ id: "referral", caseId: "case", draft: false, type: "referral", items: [], issuedAt: "2026-10-01T00:00:00Z" });
  const visits = [visit];
  if (random(5) === 0) visits.push({ id: "uses", caseId: "case", sourceDocId: "old", results: {} });
  return {
    d,
    source,
    others,
    visits,
    earlier: { id: "earlier", caseId: "case", inspDate: pick(["2026-10-01", "2026-10-25"]), items: [] },
    caseRecord: { id: "case", number: "BLD2026-00001", owner: maybe("Original", "Changed elsewhere"), ownerAddr: "1 Main", date: "2026-10-01" },
    head: pick([["e1"], ["e1", "e2"], []]),
    folder: pick([{ helper: true }, { helper: false }, null]),
    address: pick([null, null, { message: "Standardize the owner address first" }]),
    history: !!random(2),
    historyOnly: !!random(2),
    allowType: pick(TYPES),
  };
}

function run(api, x) {
  const reads = [],
    calls = [];
  const observed = (v, label) =>
    v && typeof v === "object"
      ? new Proxy(v, {
          get(o, k) {
            if (typeof k !== "symbol") reads.push(label + "." + String(k));
            return o[k];
          },
        })
      : v;
  const input = structuredClone(x);
  const d = observed(input.d, "draft"),
    source = observed(input.source, "source");
  Object.assign(api.WriterState, {
    DOCS: [d, ...input.others, source, input.earlier],
    CASES: [input.caseRecord],
    REINSP: input.visits,
    EVENTS: { case: input.head.map((id, n) => ({ id, type: "notice.issued", at: "2026-10-2" + n + "T12:00:00Z" })) },
    CASEDIR: input.folder,
  });
  const owner = api.createCorrectionPreparation({
    validateAndStandardizeAddresses: (k, llc) => (calls.push(["address", k.id, llc]), input.address),
    freezeSources: (doc) => (calls.push(["freeze", doc.id]), { case: { id: "case" }, inspector: { id: "i4" } }),
    hasItemInspectionHistory: (doc) => (calls.push(["has-history", doc.id]), input.history),
    documentItemHistory: (doc, it) => (calls.push(["history", doc.id, it.id]), [{ on: "2026-10-20", oc: "initial" }]),
    evid: () => (calls.push(["evid"]), "event-1"),
    get today() {
      calls.push(["today"]);
      return new Date(NOW);
    },
  });
  const outcome = {};
  const attempt = (name, fn) => {
    reads.push("--" + name);
    try {
      outcome[name] = fn();
    } catch (error) {
      outcome[name] = { error: [error.name, error.message] };
    }
  };
  attempt("changes", () => owner.correctionChanges(d));
  attempt("eligibility", () => owner.correctionEligibility(source, d.id));
  attempt("eligibilityDraft", () => owner.correctionEligibility(d, "x"));
  attempt("typeAllowed", () => owner.correctionTypeAllowed(source, input.allowType, input.historyOnly));
  attempt("visitPatch", () => owner.correctionVisitPatch(d));
  attempt("checks", () => owner.correctionChecks(d));
  attempt("attempt", () => owner.makeCorrectionAttempt(d));
  return { outcome: JSON.parse(JSON.stringify(outcome)), reads, calls, after: { d: input.d, source: input.source } };
}

(async () => {
  const reference = fs.readFileSync(REFERENCE, "utf8");
  assert.equal(crypto.createHash("sha256").update(reference).digest("hex"), REFERENCE_SHA256, "retained original is unchanged");
  const [current, original] = await Promise.all([compile(fs.readFileSync("app/modules/correction_preparation.js", "utf8")), compile(reference)]);
  let checked = 0,
    failedChecks = 0,
    errors = 0,
    events = 0;
  for (let n = 0; n < 3000; n++) {
    const x = scenario();
    const a = run(current, x),
      b = run(original, x);
    assert.deepEqual(a, b, "scenario " + n);
    checked++;
    if (Array.isArray(a.outcome.checks) && a.outcome.checks.some((c) => !c.ok)) failedChecks++;
    if (Object.values(a.outcome).some((v) => v && v.error)) errors++;
    if (a.outcome.attempt && a.outcome.attempt.type === "correction.issued") events++;
  }
  // The generator reaches refusals, thrown errors and produced events, not only one path.
  assert.ok(failedChecks > 1000 && errors > 100 && events > 500, JSON.stringify({ failedChecks, errors, events }));
  // The calculations are module functions over explicit lookups: the factory body is a thin provider of them.
  const source = fs.readFileSync("app/modules/correction_preparation.js", "utf8");
  for (const name of [
    "correctionChangeList",
    "correctionCheckList",
    "correctionVisitPatchFor",
    "correctionVisitCheckList",
    "correctionEligibilityFault",
  ])
    assert.match(source, new RegExp("^function " + name + "\\(", "m"), name + " is a module-level calculation");
  console.log(
    JSON.stringify({ passed: true, scenarios: checked, refusingCheckLists: failedChecks, thrownOutcomes: errors, correctionEvents: events }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
