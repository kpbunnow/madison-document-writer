/* Phase 3 document eligibility and follow-up drafting: the calculations over explicit lookups behave exactly as the
   retained original modules (tests/fixtures/*_phase3_reference.txt). Compared: results, thrown errors, the ordered
   service gets/calls/toasts, the draft produced and the live state left behind. */
const assert = require("node:assert/strict"),
  crypto = require("node:crypto"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");

const REFERENCES = {
  "app/modules/new_documents.js": ["tests/fixtures/new_documents_phase3_reference.txt", "NEW_DOCUMENTS_SHA256"],
  "app/modules/reinspection.js": ["tests/fixtures/reinspection_phase3_reference.txt", "REINSPECTION_SHA256"],
};
const EXPECTED = {
  NEW_DOCUMENTS_SHA256: "db274f8e44b0d1e00fee9d46b84bb8afa2b23a487d656ae87c255f09dc43bd15",
  REINSPECTION_SHA256: "24f032230e05112610dd05f20e472709fd73bb598804c747fa07ca2e258ab769",
};
const EXPORTS = {
  "app/modules/new_documents.js": "export { eligibility, lifecycleFaults };",
  "app/modules/reinspection.js": "export { reinspectionWorksheetChecks, followupDraftAllowed, buildFollowupDraft };",
};

async function compile(file, contents) {
  const built = await esbuild.build({
    stdin: {
      contents: contents + "\n" + EXPORTS[file] + '\nexport {WriterState} from "./state.js";export {validISO} from "./calendar.js";',
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
  new Function("today", "module", "exports", built.outputFiles[0].text)(new Date("2026-11-14T12:00:00Z"), box, box.exports);
  return box.exports;
}

let seed = 20261114;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (a) => a[random(a.length)];

const TYPES = [
  "notice",
  "extension",
  "citation",
  "referral",
  "referralUpdate",
  "compliance",
  "reinspectionNotice",
  "bestInterestExtension",
  "vacancyExtension",
  "noOccupancy",
  "summaryAbatement",
];
const RULES = [
  null,
  { status: "Extension", label: "an extension", doc: "extension" },
  { status: "Corrected", label: "a compliance letter", doc: "compliance", allCorrected: true },
  { status: "Citation", label: "a citation", doc: "citation", cite: true },
  { status: "Reinspection", label: "a reinspection notice", doc: "reinspectionNotice" },
  { status: "Choose", label: "a follow-up", choose: ["extension", "referral", "citation"] },
];

function world() {
  const count = 1 + random(3),
    items = Array.from({ length: count }, (_, n) => ({
      id: "s" + n,
      no: pick([String(n + 1), ""]),
      title: "Item " + n,
      sections: pick([["27.05(2)(c)"], ["27.05(2)(c)", "27.01"], []]),
      due: "2026-11-0" + (n + 1),
      withdrawn: !random(6),
    }));
  const source = {
    id: "src",
    caseId: "case",
    type: pick(["notice", "extension", "compliance"]),
    draft: false,
    void: !random(10),
    superseded: !random(10),
    mailed: "2026-10-01",
    inspDate: "2026-10-01",
    items,
  };
  const results = Object.fromEntries(
    items
      .filter(() => random(5))
      .map((i) => [
        i.id,
        {
          oc: pick(["corrected", "none", "extended", "withdrawn", "bogus"]),
          on: pick(["2026-10-20", "", "2026-09-01", "2026-12-01", "bad"]),
          manualDate: !random(3),
          due: pick(["", "2026-11-20", "2026-11-16", "2027-06-01", "2026-12-15"]),
          note: pick(["", "  Fixed sill  ", undefined]),
          cite: !!random(2),
        },
      ]),
  );
  const r = {
    id: "visit",
    caseId: "case",
    sourceDocId: pick(["src", "src", "missing"]),
    draft: !!random(2),
    recordedAt: pick(["", "2026-11-10T12:00:00Z"]),
    date: pick(["2026-11-10", "2026-11-20", "bad", "2026-09-15", ""]),
    time: pick(["09:30", "", "25:99"]),
    inspectorId: pick(["i4", "nobody", ""]),
    expectedHead: pick([undefined, ["h1"]]),
    replaces: pick(["", "older"]),
    importInspection: pick([undefined, { id: "acc-1", status: "Extension" }]),
    followupIntent: pick([undefined, "undecided", "extension", "referral", "citation"]),
    importRule: pick(RULES),
    results,
  };
  const docs = [source];
  if (!random(3)) docs.push({ id: "issued", caseId: "case", type: pick(TYPES), draft: false, fromReinspId: "visit", items: [] });
  if (!random(4)) docs.push({ id: "ref", caseId: "case", type: "referral", draft: false, items: [] });
  if (!random(5)) docs.push({ id: "scoped", caseId: "case", type: "noOccupancy", draft: false, fromReinspId: "visit", items: [] });
  const d = {
    id: "draft",
    caseId: "case",
    type: pick(TYPES),
    draft: true,
    expectedHead: pick([["h1"], ["h2"], []]),
    initialAction: !random(4),
    administrativeAction: !random(4),
    inspDate: pick([r.date, "2026-01-01"]),
    inspTime: pick([r.time, "07:00"]),
    items: items.map((i, n) => ({ srcItemId: pick([i.id, i.id, "other"]), no: pick([i.no, String(n + 9)]) })),
  };
  return {
    docs,
    r,
    d,
    type: pick(TYPES),
    current: pick(["src", "other", null]),
    faults: pick([[], ["Record the results first"], ["Item 1: Result dates are missing", "Another fault"]]),
    unavailable: pick([null, null, "Not available here"]),
    noEligibility: !random(8),
    dueContext: pick([
      [],
      [{ id: "s0", no: "1", due: "2026-11-20" }],
      [1, 2, 3, 4].map((n) => ({ id: "s" + n, no: String(n), due: "2026-12-0" + n })),
    ]),
    spacing: pick([
      [],
      [
        {
          items: [
            { id: "s0", no: "1" },
            { id: "s1", no: "2" },
          ],
        },
      ],
    ]),
    validTime: !!random(4),
    carry: random(3),
  };
}

function run(api, w, operation, failAt) {
  const x = structuredClone(w),
    calls = [];
  let effects = 0,
    serial = 0;
  Object.assign(api.WriterState, {
    DOCS: x.docs,
    REINSP: [x.r],
    CASES: [{ id: "case", number: "BLD2026-00001", inspectorId: "i4", date: "2026-10-01" }],
    EVENTS: { case: [{ id: "h1", type: "notice.issued", at: "2026-10-01T12:00:00Z" }] },
  });
  function service(at) {
    return new Proxy(
      {},
      {
        get(_, key) {
          const name = at + "." + String(key);
          calls.push("get:" + name);
          if (["ui", "inspection", "authoring", "newDocuments"].includes(key)) return service(name);
          if (key === "eligibility" && x.noEligibility) return undefined;
          return (...args) => {
            calls.push("call:" + name);
            if (++effects === failAt) throw Error("interrupted service");
            switch (key) {
              case "eligibility":
                return x.unavailable;
              case "worksheetFaults":
                return x.faults;
              case "validISO":
                return api.validISO(args[0]);
              case "parseTime":
                return x.validTime && args[0] ? args[0] : "";
              case "inspAt":
                return { date: args[0]?.inspDate || "" };
              case "dueContext":
                return x.dueContext;
              case "dueDateSpacingConflicts":
                return x.spacing;
              case "sourceDocFor":
                return x.current && x.docs.find((d) => d.id === x.current);
              case "uid":
                return args[0] + ++serial;
              case "itemHistory":
                return [{ on: "2026-01-01", oc: "initial", no: args[1] }];
              case "itemInspectionHistory":
                return [{ on: "2026-01-01", oc: "initial", no: args[1].no }];
              case "toast":
                calls.push("toast:" + args[0]);
            }
          };
        },
      },
    );
  }
  const services = service("services");
  let value, error;
  try {
    value = operation(api, services, x);
  } catch (e) {
    error = [e.name, e.message];
  }
  return {
    value: value === undefined ? "<undefined>" : JSON.parse(JSON.stringify(value)),
    error,
    calls,
    state: structuredClone({ docs: x.docs, r: x.r }),
  };
}

const OPERATIONS = {
  eligibility: (api, _services, x) => api.eligibility(x.r, x.type),
  lifecycleFaults: (api, services, x) =>
    api.lifecycleFaults(
      services,
      x.d,
      x.docs.find((d) => d.id === "src"),
      random(4) ? x.r : null,
    ),
  worksheetChecks: (api, services, x) => api.reinspectionWorksheetChecks(services, x.r),
  followupAllowed: (api, services, x) => {
    const src = x.docs.find((d) => d.id === x.r.sourceDocId);
    return api.followupDraftAllowed(services, x.r, x.type, src, src ? src.items.slice(0, x.carry) : []);
  },
  buildFollowupDraft: (api, services, x) => api.buildFollowupDraft(services, x.r, x.type, x.docs[0]),
};
const OWNERS = {
  eligibility: "app/modules/new_documents.js",
  lifecycleFaults: "app/modules/new_documents.js",
  worksheetChecks: "app/modules/reinspection.js",
  followupAllowed: "app/modules/reinspection.js",
  buildFollowupDraft: "app/modules/reinspection.js",
};

(async () => {
  const modules = {};
  for (const [file, [reference, key]] of Object.entries(REFERENCES)) {
    const retained = fs.readFileSync(reference, "utf8");
    assert.equal(crypto.createHash("sha256").update(retained).digest("hex"), EXPECTED[key], reference + " is unchanged");
    modules[file] = await Promise.all([compile(file, fs.readFileSync(file, "utf8")), compile(file, retained)]);
  }
  const counts = {};
  for (const [name, operation] of Object.entries(OPERATIONS)) {
    const [current, original] = modules[OWNERS[name]];
    const outcomes = new Set();
    for (let n = 0; n < 1500; n++) {
      const w = world(),
        rng = seed;
      const a = run(current, w, operation, 0);
      seed = rng; // the operation may draw from the generator: both runs see the same draws
      const b = run(original, w, operation, 0);
      assert.deepEqual(a, b, `${name} scenario ${n}`);
      // Distinct outcomes include the refusal shown, since permission itself is only true or false.
      outcomes.add(JSON.stringify(a.value).slice(0, 120) + (a.error ? a.error[1] : "") + a.calls.filter((c) => c.startsWith("toast:")).join("|"));
      // Interrupt each observed service effect in turn: partial effects and the thrown error must match.
      const effects = a.calls.filter((c) => c.startsWith("call:")).length;
      for (let failAt = 1; failAt <= Math.min(effects, 4); failAt++) {
        const again = seed;
        const c = run(current, w, operation, failAt);
        seed = again;
        assert.deepEqual(c, run(original, w, operation, failAt), `${name} scenario ${n} interrupted at ${failAt}`);
      }
    }
    counts[name] = outcomes.size;
    assert.ok(outcomes.size > 8, name + " reaches many distinct outcomes: " + outcomes.size);
  }
  console.log(JSON.stringify({ passed: true, scenariosPerOperation: 1500, distinctOutcomes: counts }));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
