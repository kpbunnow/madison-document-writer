/* Lifecycle checks against the retained module: ordered messages, every peer read and call in order, refusal on the
   first interrupted read, and untouched inputs, over synthetic case records of every document type. */
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

let seed = 20261101;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

const TYPES = ["notice", "notice", "extension", "citation", "citation", "referral", "referralUpdate", "compliance", "bestInterestExtension"];

function items(count, ordered) {
  return Array.from({ length: count }, (_, n) => ({
    id: "i" + n,
    no: ordered ? String(n + 1) : pick(["1", "2", "3"]),
    cite: !chance(3),
    withdrawn: chance(5),
  }));
}

function scenario() {
  const type = pick(TYPES),
    count = 1 + random(3);
  const own = items(count, true);
  const cits = {};
  for (const i of own)
    if (!chance(5))
      cits[i.id] = { num: pick(["C1", "C2", "C3", ""]), issued: pick(["2026-10-20", "2026-10-26", "2026-10-27", "2026-10-01", "bad", ""]) };
  const d = {
    id: "draft",
    caseId: "case",
    draft: !chance(10),
    type,
    items: own,
    cits,
    fromDocId: pick(["", "src", "src", "gone"]),
    fromReinspId: pick(["", "visit", "visit", "gone"]),
    inspDate: pick(["2026-10-20", "2026-10-20", "2026-10-19", ""]),
    inspTime: pick(["09:00", "09:00", "", "10:00"]),
    mailed: pick(["2026-10-21", "2026-10-21", "2026-10-19", "2027-12-31", "bad", ""]),
    expectedHead: pick([undefined, undefined, ["a"], ["a", "b"], []]),
    correction: chance(12) ? { targetId: "src" } : undefined,
    initialPreview: chance(15),
  };
  const src = {
    id: "src",
    caseId: "case",
    draft: false,
    type: pick(["notice", "notice", "extension", "compliance"]),
    items: items(count + (chance(5) ? 1 : 0), true).map((i) => ({ ...i, withdrawn: chance(6) })),
    superseded: chance(8) ? { at: "x" } : undefined,
    void: chance(8) ? { at: "x" } : undefined,
    cits: { i0: { num: pick(["C1", "C9"]) } },
    inspDate: "2026-10-20",
  };
  const docs = [src];
  if (chance(4)) docs.push({ ...src, id: "src2", type: "notice", items: items(1, true) });
  if (chance(5)) docs.push({ id: "ref", caseId: "case", draft: false, type: "referral", items: [] });
  if (chance(5)) docs.push({ id: "elsewhere", caseId: "other", draft: false, type: "notice", items: items(1, true) });
  return {
    d,
    docs,
    reins: chance(6)
      ? []
      : [
          {
            id: "visit",
            caseId: "case",
            sourceDocId: pick(["src", "src", "other"]),
            date: pick(["2026-10-20", "2026-10-21"]),
            time: pick(["09:00", ""]),
          },
        ],
    events: pick([
      [],
      [{ id: "e1", type: "notice.issued" }],
      [{ id: "a", type: "notice.issued" }],
      [
        { id: "a", type: "notice.issued" },
        { id: "b", type: "document.voided" },
      ],
    ]),
    snow: chance(8),
    current: pick(["src", "src", "other", ""]),
    faults: pick([[], [], ["Worksheet fault"], ["Worksheet fault", "Visit fault"]]),
    today: pick(["2026-10-26T12:00:00Z", "2026-10-20T12:00:00Z", "2026-11-30T12:00:00Z"]),
    fail: chance(3) ? 1 + random(40) : 0,
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

function run(api, sc) {
  const x = structuredClone(sc),
    calls = [];
  Object.assign(api.WriterState, {
    CASES: [{ id: "case", date: "2026-10-20", time: "09:00" }],
    DOCS: [...x.docs, x.d],
    REINSP: x.reins,
    EVENTS: { case: x.events },
  });
  const returns = {
    "snow.is": () => x.snow,
    "snow.lifecycle": () => [{ ok: false, t: "snow guard" }],
    "newDocuments.specialLifecycle": () => [{ ok: false, t: "special guard" }],
    sourceDocFor: () => x.docs.find((o) => o.id === x.current) || null,
    worksheetFaults: () => x.faults,
  };
  const services = recorder(calls, returns, { today: new Date(x.today) }, x.fail);
  const owner = api.createPublicationPreparation(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let result, error;
  try {
    result = owner.lifecycleChecks(x.d);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ result, error, d: x.d, docs: x.docs, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/publication_preparation.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/publication_preparation_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  let interrupted = 0,
    clean = 0;
  for (let n = 0; n < 8000; n++) {
    const sc = scenario();
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `lifecycle scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error) interrupted++;
    else if (!(parsed.result || []).length) clean++;
    for (const check of parsed.result || []) seen.add(check.t);
  }
  // The generator must keep reaching every message family, or the comparison would silently weaken.
  for (const text of [
    "snow guard",
    "special guard",
    "The case record changed after this draft began.",
    "A case can have only one original notice.",
    "The follow-up must use the current issued document.",
    "This case is completed; start a new case for new observations.",
    "This follow-up needs its recorded inspection.",
    "Worksheet fault",
    "The document and inspection have different source documents.",
    "Review the inspection: its date/time differs from this document.",
    "Every issued item must retain its number and order through the follow-up.",
    "A referred case permits only referral updates or compliance.",
    "Issue the initial referral before a referral update.",
    "Each new citation needs a unique citation number.",
    "Citation issue dates must be between the inspection and today.",
  ])
    assert.ok(
      [...seen].some((t) => t.includes(text)),
      "scenarios reach: " + text,
    );
  assert.ok([...seen].length > 15 && interrupted > 100 && clean > 50, `coverage: ${seen.size} messages, ${interrupted} interrupted, ${clean} clean`);
  console.log("PASS lifecycle checks match the retained module over 8000 scenarios (" + interrupted + " interrupted)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
