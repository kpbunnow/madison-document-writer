/* Import review panel against the retained module: exact markup, every peer read and call in order, untouched
   state, and refusal on the first interrupted read, over seeded reports, cases, drafts and lookup states. */
const { retainedAccelaImport } = require("../fixtures/retained_accela_import.cjs");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");

async function compile(contents) {
  const build = await esbuild.build({
    stdin: {
      contents: contents + '\nexport {WriterState} from "./state.js"; export {INSPECTORS} from "./data/inspectors.js";',
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

let seed = 20261106;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

const HEAD = [
  "Case Number",
  "Inspector Name",
  "Site Address",
  "Historic District",
  "Landmark",
  "Parcel Number",
  "Case Description",
  "Owner Name",
  "Owner Address",
  "Inspection Type",
  "Inspection Date",
  "Inspection Status",
  "Inspection Time",
];
const TYPES = ["Initial Inspection", "Initial Inspection", "Reinspection", "Reinspection", "CA Reinspection", "Other"];
const STATUSES = [
  "Official Notice",
  "Citation",
  "No Occupancy",
  "Extension Processing",
  "CA Referral",
  "Compliance",
  "Non Compliance",
  "Unknown",
  "Scheduled",
  "Abatement Summary",
];

function scenario(inspector) {
  const numbers = ["CB2026-100-00001", "CB2026-100-00002"].slice(0, 1 + random(2));
  const rows = [];
  for (const number of numbers)
    for (let n = 0, count = 1 + random(4); n < count; n++)
      rows.push([
        number,
        pick([inspector, "Nobody", ""]),
        pick(["100 TEST ST", "100 TEST ST", "9 OTHER ST"]),
        pick(["No", "Yes"]),
        "",
        pick(["070913125237", "bad"]),
        "Complaint",
        "OWNER",
        "100 TEST ST\nMADISON WI",
        pick(TYPES),
        pick([46300, 46310, 46320, ""]),
        pick(STATUSES),
        pick(["09:05", "14:30", ""]),
      ]);
  const existing = chance(2);
  return {
    grid: [HEAD, ...rows],
    existing,
    snow: chance(8),
    closed: chance(10),
    draft: existing && chance(3) ? pick(["notice", "citation"]) : "",
    visit: chance(8),
    sel: pick([null, 0, 1, 2, 9]),
    caseIx: pick([0, 0, 1]),
    manualDate: pick(["", "2026-10-20"]),
    manualTime: pick(["", "09:30"]),
    shareError: chance(6) ? "Shared record could not be read" : "",
    source: pick([undefined, { kind: "sql", retrievedAt: "2026-10-27T12:00:00Z" }, { kind: "file" }]),
    errors: chance(8) ? pick([["Report error"], ["a <b>", "b"]]) : [],
    fileName: pick(["", "report <1>.xlsx"]),
    busy: chance(5),
    clear: chance(10),
    fail: chance(3) ? 1 + random(90) : 0,
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

function run(api, sc, inspector) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  const number = "CB2026-100-00001";
  const k = {
    id: "c",
    number,
    address: "100 TEST ST",
    owner: "OWNER",
    ownerAddr: ["100 TEST ST", "MADISON WI"],
    date: "2026-10-20",
    time: "09:05",
    inspectorId: api.INSPECTORS[0].id,
  };
  const src = x.existing ? { id: "issued", caseId: "c", type: "notice", draft: false, date: "2026-10-20", items: [], frozen: { case: k } } : null;
  const docs = src ? [src] : [];
  if (x.draft) docs.push({ id: "d", caseId: "c", type: x.draft, draft: true, items: [] });
  Object.assign(state, {
    CASES: x.existing ? [k] : [],
    DOCS: docs,
    REINSP: [],
    EVENTS: {},
    WORK: { entry: {} },
    LOOKUP_BUSY: x.busy,
    ACC_SELECTION_SERIAL: 0,
  });
  const returns = {
    "snow.isCase": () => x.snow,
    "snow.is": () => x.snow,
    "snow.matchesImport": () => false,
    sourceDocFor: () => src,
    unissuedVisitFor: () => (x.visit ? { id: "v" } : null),
    caseState: () => ({ closed: x.closed }),
    fmtDate: (v) => "D:" + v,
    fmtTime: (v) => "T:" + v,
  };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createAccelaImport(services);
  assert.deepEqual(calls, [], "construction remains inert");
  const table = owner.accelaTable(x.grid.map((r) => r.map((v) => (v === inspector ? inspector : v))));
  state.state = {
    acc: {
      fileName: x.fileName,
      cases: table.cases,
      caseIx: x.caseIx,
      sel: x.sel,
      manualDate: x.manualDate,
      manualTime: x.manualTime,
      notes: table.notes,
      errors: x.errors.concat(x.clear ? table.errors : []),
      shareError: x.shareError,
      source: x.source,
    },
  };
  const before = JSON.stringify(state.state.acc);
  let html, error;
  try {
    html = owner.accelaPanel();
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({
    html,
    error,
    acc: state.state.acc,
    mutated: JSON.stringify(state.state.acc) !== before,
    serial: state.ACC_SELECTION_SERIAL,
    calls,
  });
}

(async () => {
  const [current, legacy] = await Promise.all([compile('export {createAccelaImport} from "./accela_import.js";'), compile(retainedAccelaImport())]);
  const inspector = current.INSPECTORS.find((i) => i.name).name;
  const seen = new Set();
  let interrupted = 0,
    described = 0,
    panels = 0,
    chooser = 0;
  for (let n = 0; n < 6000; n++) {
    const sc = scenario(inspector);
    const [before, shown] = [run(legacy, sc, inspector), run(current, sc, inspector)];
    // One deliberate difference from the retained module: the Start button points at the blocker banner (when it is
    // shown) so the reason travels with the disabled control. Everything else must still be identical.
    const after = shown.replace(/(id=\\"acc-go\\"[^>]*?) aria-describedby=\\"acc-blockers\\"/, "$1");
    assert.equal(after, before, `import panel scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const panelHtml = JSON.parse(shown).html || "";
    if (panelHtml.includes('id="acc-go"')) {
      const goButton = /<button[^>]*id="acc-go"[^>]*>/.exec(panelHtml)[0];
      assert.equal(
        goButton.includes('aria-describedby="acc-blockers"'),
        panelHtml.includes('id="acc-blockers"'),
        `button names its reason exactly when a reason is shown (scenario ${n})`,
      );
      if (panelHtml.includes('id="acc-blockers"')) described++;
    }
    const parsed = JSON.parse(after);
    if (parsed.error) interrupted++;
    else if (parsed.html) panels++;
    if ((parsed.html || "").includes("import-choices")) chooser++;
    for (const fragment of [
      "Clear import",
      "cchip",
      "import-selected",
      "import-unavailable-list",
      "import-continuity",
      "Existing case",
      "New case",
      "acc-date",
      "banner warn",
      'id="acc-blockers"',
      "lookup-recheck",
      "import-changes",
      "Retrieved",
      "This is a saved snapshot",
      "Start snow citation",
      "Start Official Notice",
      "Import inspection",
      "disabled",
      "btn-primary",
    ])
      if ((parsed.html || "").includes(fragment)) seen.add(fragment);
  }
  assert.ok(interrupted > 100 && panels > 2500 && chooser > 200, `coverage: ${interrupted} interrupted, ${panels} panels, ${chooser} choosers`);
  for (const fragment of [
    "Clear import",
    "cchip",
    "import-unavailable-list",
    "import-continuity",
    "acc-date",
    'id="acc-blockers"',
    "lookup-recheck",
    "import-changes",
    "Retrieved",
    "Start snow citation",
    "Start Official Notice",
    "Import inspection",
  ])
    assert.ok(seen.has(fragment), "scenarios reach: " + fragment);
  console.log(
    "PASS import panel matches the retained module over 6000 scenarios (" +
      interrupted +
      " interrupted, " +
      panels +
      " panels, " +
      described +
      " with a named reason)",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
