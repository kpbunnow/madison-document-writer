/* Citation authoring checks against the retained module: ordered checks and targets, every peer read and call in
   order (including repeated fault reads), refusal on the first interrupted read, and untouched inputs. */
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

let seed = 20261030;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

function citation(item) {
  return {
    ord: pick(["27.05(2)(c)", "29.40(4)(b)", "27.05(2)(s)", "SPS321.125", "27.05(2)(c), 29.40(4)(b)", ""]),
    num: pick(["B90000000001", "B90000000002", "bad num!", "", "A-1"]),
    tier: "1st",
    issued: pick(["2026-10-11", "2026-10-11", "2026-10-29", "2026-12-31", "2026-13-40", ""]),
    pricedOn: pick(["2026-10-11", "2026-10-11", "", "bad"]),
    courtDate: pick(["2026-11-04", "2026-10-01", "2026-12-31", "", "bad"]),
    courtTime: pick(["09:00", "09:00", "", "25:99"]),
    violDate: pick(["", "", "2026-10-11", "2026-09-01", "2026-12-01"]),
    violTime: pick(["", "", "10:00", "x"]),
    depositMode: pick(["schedule", "schedule", "base", "total", "", "weird"]),
    amount: pick(["197.00", "197.00", "245.00", "", "0", "12.345"]),
    base: pick(["100.00", "0", "", "50.5"]),
    cc: pick(["48.00", "15.00", "9.00", ""]),
    assessments: chance(5) ? [{ k: "x" }] : undefined,
    depositSource: pick(["", "Approved court authority", "short"]),
    desc: pick(["Description", "Fix ( ) later", "Noxious weeds present", ""]),
    comment: pick(["Comment", "Has ( ) blank", ""]),
    statute: pick(["", "State ( ) statute"]),
    deptId: pick(["B-12", "", "( )"]),
    scheduleEntryId: pick(["", "", "entry"]),
    mandatoryAppearance: chance(10),
    reconfirmDeposit: chance(10),
    depositEditInvalid: chance(12),
    overrideBasis: chance(10) ? { id: "override" } : null,
    tierOverride: pick(["", "2", "x"]),
    tierOverrideSource: pick(["", "Approved source here"]),
    item: item.id,
  };
}

function scenario() {
  const items = Array.from({ length: 1 + random(3) }, (_, n) => ({
    id: "item-" + n,
    no: String(n + 1),
    title: "Title " + n,
    cite: !chance(4),
    withdrawn: chance(6),
    done: chance(6),
    due: pick(["", "2026-11-20", "2026-11-22", "2026-12-01", "2026-12-08", "2026-11-25"]),
    sections: pick([["27.05(2)(c)"], ["27.05(2)(c)", "29.40(4)(b)"]]),
    libraryKey: pick(["", "k1", "k1", "k2"]),
  }));
  const cits = {},
    depositRequests = {};
  for (const item of items) {
    if (chance(5)) depositRequests[item.id] = { ...citation(item), reason: "Reason", measurementFields: pick([[], [], ["area"]]) };
    else if (!chance(6)) cits[item.id] = citation(item);
  }
  const correction = chance(4) ? { targetId: "source", actionDate: pick(["2026-10-11", "2026-10-12"]), reviewed: true } : null;
  return {
    d: {
      id: "doc",
      caseId: "case",
      type: pick(["citation", "citation", "citation", "notice", "extension", "other"]),
      draft: true,
      authoringVersion: pick([7, 8, 9, 16]),
      mailed: pick(["2026-10-11", "2026-10-11", "2026-10-30"]),
      revision: chance(3) ? { actionDate: "2026-10-11" } : undefined,
      items,
      cits: chance(8) ? undefined : cits,
      depositRequests,
      correction,
    },
    source: {
      id: "source",
      caseId: "case",
      cits: Object.fromEntries(items.map((item) => [item.id, { num: pick(["B90000000001", "B90000000009"]) }])),
    },
    choose: items.filter(() => chance(2)).map((item) => item.id),
    history: pick(["", "", "History fault"]),
    chargeFault: pick(["", "", "Charge fault"]),
    deposit: pick([false, false, true]),
    overrideFault: pick(["", "", "Override fault"]),
    unchangedDue: chance(2),
    total: pick(["197.00", "148.00", "245.00"]),
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
    CASES: [{ id: "case", date: "2026-10-11", time: "10:00" }],
    DOCS: [x.d, x.source],
    REINSP: [],
    EVENTS: {},
  });
  const returns = {
    "citationPricing.refresh": () => undefined,
    "citationPricing.historyFault": () => x.history,
    "citationPricing.chargeFault": () => x.chargeFault,
    "citationPricing.unchangedCorrection": (d, i, c) => (x.deposit ? { ...c } : null),
    "administration.overrideFault": () => x.overrideFault,
    unchangedCorrectionValue: () => x.unchangedDue,
    choosesCharge: (i) => x.choose.includes(i.id),
    feeLines: () => ({ total: x.total, rows: [] }),
  };
  const services = recorder(calls, returns, { today: new Date("2026-10-29T12:00:00Z") }, x.fail);
  const owner = api.createCitationWorkflow(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let result, error;
  try {
    result = owner.authoringChecks(x.d);
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ result, error, d: x.d, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/citation_workflow.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/citation_workflow_reference.txt", "utf8")),
  ]);
  const seen = new Set();
  let interrupted = 0,
    requests = 0,
    cited = 0;
  for (let n = 0; n < 6000; n++) {
    const sc = scenario();
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `authoring checks scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error) interrupted++;
    for (const check of parsed.result || []) seen.add(check.t.replace(/^Citation for item \d+: /, ""));
    if ((parsed.result || []).some((check) => check.t.startsWith("Citation for item"))) cited++;
    requests += Object.keys(sc.d.depositRequests).length ? 1 : 0;
  }
  // The generator must keep reaching every message family, or the comparison would silently weaken.
  for (const text of [
    "Use no more than three distinct due dates for outstanding items.",
    "Keep distinct due dates at least seven days apart.",
    "Distinct due dates are at least seven days apart.",
    "Each library item can appear only once on an original notice. Remove duplicate items.",
    "Citation needs deposit. Complete the required deposit step.",
    "Shared citation history has been checked.",
    "History fault",
    "only outstanding violations may be cited.",
    "choose the charged ordinance from its sections.",
    "enter one complete ordinance number, not a list of sections.",
    "Charge fault",
    "charge matches the current item.",
    "complete all placeholder details in the citation fields.",
    "deposit and its basis agree.",
    "enter a valid court time in Citation review.",
    "enter the inspection/violation time.",
    "the violation date must be on or before issuance.",
    "the issue date must be no later than today.",
    "the issue date must match the original action date used in reports.",
    "the issue date must match this document’s mailed date.",
    "the court date must follow issuance.",
    "use a citation number containing letters, numbers or hyphens.",
    "a correction retains the original citation number.",
    "choose the scheduled offense in Citation review.",
    "choose one complete ordinance and complete the approved deposit basis in Citation review.",
    "complete the required measurements in Citation review.",
    "complete the approved deposit basis in Citation review.",
  ])
    assert.ok(
      [...seen].some((t) => t.includes(text)),
      "scenarios reach: " + text,
    );
  assert.ok(interrupted > 200 && requests > 500 && cited > 0, "interruption, request and cited-item coverage");
  console.log("PASS authoring checks match the retained module over 6000 scenarios (" + interrupted + " interrupted)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
