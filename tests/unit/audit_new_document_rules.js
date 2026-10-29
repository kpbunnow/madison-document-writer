/* Scoped new-document authoring against the retained module: printed wording, the details form, lifecycle checks and
   readiness checks over synthetic documents of every type and authoring version, with every peer read and call in
   order, mutation of the document, and refusal on the first interrupted read or call. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");

async function compile(contents) {
  const build = await esbuild.build({
    stdin: {
      contents:
        contents +
        '\nexport {WriterState} from "./state.js"; export {INSPECTORS} from "./data/inspectors.js"; export {NEW_TYPES} from "./document_types.js";',
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
  new Function("today", "module", "exports", build.outputFiles[0].text)(new Date("2026-10-27T12:00:00Z"), box, box.exports);
  return box.exports;
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

let seed = 20261108;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

const POOLS = {
  scope: ["building", "unit", "", "other"],
  unit: ["2B", "Apt 4", "unit 5", "", "( )", "◯"],
  variant: ["junk", "sidewalk", "tree", "secure", "custom", ""],
  findings: ["Rotting porch\nBroken rail", "", "◯", Array(100).fill("w").join(" "), Array(101).fill("w").join(" "), Array(200).fill("w").join(" ")],
  work: ["Remove debris.", "Repair rail", ""],
  summaryBasis: ["Imminent hazard", ""],
  orderDue: ["2026-11-20", "", "bad"],
  authority: ["27.05(3)(b)4", "", "( )"],
  securingConditions: ["Board windows", ""],
  boarding: [true, false],
  boardingRef: ["Approval 7", ""],
  removeTree: [true, false],
  mode: ["release", "restrict", ""],
  effective: ["2026-10-20", "", "bad"],
  releases: ["nor1", "nor2", ""],
  releaseInspection: ["2026-10-21", ""],
  releaseFacts: ["Corrections verified", ""],
  placardRemoved: [true, false],
  removalDate: ["2026-10-22", ""],
  removalFacts: ["Pending removal", ""],
  releaseFormRef: ["Form A", ""],
  releaseVisitId: ["visit1", "external", ""],
  releaseInspectionRef: ["Ref", ""],
  releaseInspectorId: ["i1", ""],
  releaseInspectionTime: ["09:30", ""],
  posting: ["posted", "pending"],
  postedDate: ["2026-10-19", ""],
  prePostingRef: ["Order proc", ""],
  releaseConditions: ["Repair roof", ""],
  access: ["By appointment", ""],
  reason: ["Weather delay", ""],
  noticeRef: ["N-1", ""],
  stage: ["supervisory", "administrative", ""],
  prosecutionClause: [true, false],
  reviewDate: ["2026-12-01", "", "bad"],
  expiryMode: ["fixed", "review", ""],
  expiryDate: ["2027-01-01", ""],
  conditions: ["Stay vacant", ""],
  transferClause: ["Disclose sale", ""],
  deadlineMode: ["dated", "conditional", ""],
  signerName: ["A Signer", ""],
  signerTitle: ["Inspector", ""],
  reviewer: ["Reviewer", ""],
  reviewRef: ["Ref", ""],
  codeSource: ["https://example.test", ""],
  codeRevision: ["Rev 3", ""],
  delegation: ["Delegation 1", ""],
  reviewed: [true, false],
  reviewDateLegal: ["2026-10-01", "2026-12-31", ""],
  noSafety: [true, false],
  safetyBasis: ["Basis", ""],
  intentions: ["Repair", ""],
  supervisor: ["Sup", ""],
  requestRef: ["Req", ""],
  vacancyFacts: ["Vacant", ""],
  expiryPolicyRef: ["Pol", ""],
  shortNoticeRef: ["Short", ""],
  customReviewRef: ["Custom", ""],
  forestryRef: ["Forest", ""],
  remedyReviewed: [true, false],
  servicePlan: ["Mail", ""],
  administrativeType: ["noOccupancy", "citation", ""],
};

function scenario(types) {
  const count = 1 + random(3);
  const items = Array.from({ length: count }, (_, n) => ({
    id: "it" + n,
    srcItemId: pick(["it" + n, "x"]),
    no: String(n + 1),
    text: "Violation text number " + n + " ".repeat(chance(3) ? 70 : 1),
    title: pick(["", "Title " + n]),
    done: chance(5),
    withdrawn: chance(8),
    due: pick(["", "2026-11-20", "2026-12-01"]),
  }));
  const s = {};
  for (const key of Object.keys(POOLS)) if (!chance(3)) s[key] = pick(POOLS[key]);
  s.affected = items.filter(() => chance(2)).map((i) => i.no);
  if (chance(3)) s.originalDues = Object.fromEntries(items.map((i) => [i.no, pick(["2026-11-01", ""])]));
  if (chance(3)) s.extendedDues = Object.fromEntries(items.map((i) => [i.no, pick(["2026-12-15", ""])]));
  const type = pick([...types.map((t) => t.id), ...types.map((t) => t.id), "notice", "citation"]);
  const d = {
    id: "doc",
    caseId: "case",
    type,
    draft: !chance(6),
    authoringVersion: pick([11, 12, 13, 14, 15, 16, 16]),
    items,
    special: chance(12) ? undefined : s,
    correction: chance(8) ? { targetId: "src" } : undefined,
    importRule: chance(6) ? { label: "Official Notice", status: "Citation", doc: "notice" } : undefined,
    initialAction: chance(8),
    administrativeAction: chance(8),
    fromDocId: pick(["src", "src", "gone", ""]),
    fromReinspId: pick(["visit1", "visit1", "gone", ""]),
    inspDate: pick(["2026-10-20", "2026-10-19"]),
    inspTime: pick(["09:05", ""]),
    expectedHead: pick([[], [], ["a"], undefined]),
  };
  const docs = [
    {
      id: "src",
      caseId: "case",
      type: pick(["notice", "notice", "compliance", "extension"]),
      draft: false,
      items: items.map((i) => ({ id: pick([i.srcItemId, "z"]), no: i.no })),
      superseded: chance(8) ? { at: "x" } : undefined,
      fromReinspId: pick(["", "visit1"]),
    },
    ...(chance(2)
      ? [
          {
            id: "nor1",
            caseId: "case",
            type: "noOccupancy",
            draft: false,
            special: { mode: "restrict", effective: "2026-10-01", scope: "building" },
            items: [],
          },
        ]
      : []),
    ...(chance(4)
      ? [{ id: "nor2", caseId: "case", type: "noOccupancy", draft: false, special: { mode: "release", releases: "nor1" }, items: [] }]
      : []),
    ...(chance(5) ? [{ id: "ref", caseId: "case", type: "referral", draft: false, items: [] }] : []),
    ...(chance(5)
      ? [{ id: "issued", caseId: "case", type: pick(["citation", "noOccupancy", "extension"]), draft: false, fromReinspId: "visit1", items: [] }]
      : []),
  ];
  const reins = [
    {
      id: "visit1",
      caseId: "case",
      draft: chance(4),
      sourceDocId: pick(["src", "src", "other"]),
      date: pick(["2026-10-20", "2026-10-21"]),
      time: pick(["09:05", ""]),
      inspectorId: "i1",
      results: Object.fromEntries(items.map((i) => [i.id, { oc: pick(["", "corrected", "open", "withdrawn", "partial"]), cite: chance(2) }])),
      importRule: chance(5)
        ? pick([
            { doc: "extension", status: "Extension", label: "Extension", choose: ["extension"] },
            { doc: "compliance", status: "Compliance", label: "Compliance Letter", allCorrected: true },
            { doc: "citation", status: "Citation", label: "Citation", cite: true },
          ])
        : undefined,
    },
  ];
  return {
    d,
    docs,
    reins,
    events: pick([[], [{ id: "a", type: "notice.issued" }]]),
    locked: chance(8),
    docBody: pick(["Clean text", "Has ◯ blank", 'x class="blank" y']),
    current: pick(["src", "other", ""]),
    faults: pick([[], [], ["Worksheet fault"]]),
    fail: chance(3) ? 1 + random(120) : 0,
  };
}

function run(api, sc, call) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  Object.assign(state, {
    CASES: [{ id: "case", address: "100 TEST ST", number: "BLD2026-00001", inspectorId: api.INSPECTORS[0].id }],
    DOCS: [x.d, ...x.docs],
    REINSP: x.reins,
    EVENTS: { case: x.events },
    WORK: { entry: {} },
    state: { screen: "write", docId: "doc", acc: null },
  });
  const returns = {
    isLocked: () => x.locked,
    inspAt: () => ({ date: "2026-10-20", time: "09:05" }),
    fmtDate: (v) => (v ? "D:" + v : ""),
    docBody: () => x.docBody,
    validISO: (v) => /^\d{4}-\d\d-\d\d$/.test(v || ""),
    sourceDocFor: () => x.docs.find((o) => o.id === x.current) || null,
    worksheetFaults: () => x.faults,
  };
  const services = recorder(calls, returns, { today: new Date("2026-10-27T12:00:00Z") }, x.fail);
  const owner = api.initNewDocuments(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = call(owner, x);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, d: x.d, calls });
}

const BATTERY = {
  specialBody: (o, x) => o.specialBody(x.d),
  details: (o, x) => o.details(x.d),
  specialLifecycle: (o, x) => o.specialLifecycle(x.d),
  specialChecks: (o, x) => o.specialChecks(x.d),
};

const FRAGMENTS = [
  "immediately abate",
  "abate the nuisance no later than",
  "grants written permission",
  "No Occupancy placard was removed",
  "was posted",
  "remain vacant, with posting pending",
  "Additional time is granted for the uncorrected items",
  "next scheduled review inspection",
  "Approved conditions:",
  "Item 1 —",
  "Affected item references",
  "Document family",
  "Nuisance preset",
  "Restriction being released",
  "Repair deadline model",
  "Authority, wording and signer review",
  "The case changed after this draft began",
  "The factual source is no longer effective",
  "Retain every source item identity",
  "Fill every placeholder",
  "Enter the",
];

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {initNewDocuments} from "./new_documents.js";'),
    compile(fs.readFileSync("tests/fixtures/new_documents_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  const stats = { interrupted: 0, bodies: 0, forms: 0, faults: 0, checks: 0 };
  for (const [name, call] of Object.entries(BATTERY)) {
    for (let n = 0; n < 4000; n++) {
      const sc = scenario(current.NEW_TYPES);
      const [before, after] = [run(legacy, sc, call), run(current, sc, call)];
      assert.equal(after, before, `${name} scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
      const parsed = JSON.parse(after);
      if (parsed.error) stats.interrupted++;
      else if (name === "specialBody" && parsed.value) stats.bodies++;
      else if (name === "details" && parsed.value) stats.forms++;
      else if (name === "specialLifecycle" && parsed.value?.length) stats.faults++;
      else if (name === "specialChecks" && parsed.value?.length) stats.checks++;
      const text = JSON.stringify(parsed.value) || "";
      for (const fragment of FRAGMENTS) if (text.includes(fragment)) seen.add(fragment);
    }
  }
  assert.deepEqual(
    FRAGMENTS.filter((f) => !seen.has(f)),
    [],
    "scenarios reach every message family",
  );
  assert.ok(stats.interrupted > 200 && stats.bodies > 1000 && stats.forms > 1000 && stats.faults > 500 && stats.checks > 1000, JSON.stringify(stats));
  console.log("PASS new-document authoring matches the retained module over 16000 scenarios " + JSON.stringify(stats));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
