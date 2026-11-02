/* Import acceptance against the retained module: the case, document and worksheet it creates or updates, every peer
   read and call in order with the state they see, thrown errors, and refusal on the first interrupted read or call. */
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

let seed = 20261107;
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
const TYPES = ["Initial Inspection", "Initial Inspection", "Reinspection", "Reinspection", "CA Reinspection"];
const STATUSES = ["Official Notice", "Citation", "No Occupancy", "Extension Processing", "CA Referral", "Compliance", "Non Compliance", "Unknown"];

function scenario(inspector) {
  const messy = chance(6),
    historic = pick(["No", "No", "Yes"]),
    address = "100 TEST ST",
    parcel = pick(["070913125237", "070913125237", "bad"]);
  const rows = Array.from({ length: 1 + random(3) }, () => [
    "CB2026-100-00001",
    messy ? pick([inspector, "Nobody", ""]) : inspector,
    messy ? pick([address, "9 OTHER ST"]) : address,
    messy ? pick(["No", "Yes"]) : historic,
    "",
    messy ? pick(["070913125237", "bad"]) : parcel,
    "Complaint",
    "OWNER",
    "100 TEST ST\nMADISON WI",
    pick(TYPES),
    pick([46300, 46310, 46320]),
    pick(STATUSES),
    pick(["09:05", "14:30", ""]),
  ]);
  const existing = chance(2);
  const draft = existing ? pick(["", "", "notice", "refresh"]) : "",
    worksheet = existing ? pick(["", "", "open", "refresh"]) : "";
  // An existing case with no issued document, draft or event is the stranded case, which importing its Initial
  // Inspection now restarts (a deliberate change from the retained module, tested separately); only a case with
  // unfinished work still has no issued document here.
  const noSrc = chance(4) && !!(draft || worksheet);
  return {
    grid: [HEAD, ...rows],
    existing,
    draft,
    worksheet,
    noSrc,
    snow: chance(6),
    snowImport: chance(6),
    closed: chance(8),
    sel: pick([null, 0, 1, 2]),
    source: pick([undefined, { kind: "sql", retrievedAt: "2026-10-27T12:00:00Z" }]),
    manualDate: pick(["", "2026-10-20"]),
    manualTime: pick(["", "09:30"]),
    fileName: pick(["", "r.xlsx"]),
    noDoc: chance(10),
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
  const src =
    x.existing && !x.noSrc ? { id: "issued", caseId: "c", type: "notice", draft: false, date: "2026-10-20", items: [], frozen: { case: k } } : null;
  Object.assign(state, {
    CASES: x.existing ? [k] : [],
    DOCS: src ? [src] : [],
    REINSP: [],
    EVENTS: {},
    WORK: { entry: { "lookup-number": number }, acc: null },
    LOOKUP_BUSY: false,
    ACC_SELECTION_SERIAL: 0,
    DIRTY: false,
  });
  let counter = 0;
  const returns = {
    "snow.isCase": () => x.snow,
    "snow.is": () => x.snow,
    "snow.matchesImport": () => x.snowImport,
    "snow.imported": () => undefined,
    "snow.prepare": () => undefined,
    "citationPricing.refresh": () => undefined,
    sourceDocFor: () => src,
    unissuedVisitFor: () => null,
    caseState: () => ({ closed: x.closed }),
    fmtDate: (v) => "D:" + v,
    fmtTime: (v) => "T:" + v,
    uid: (prefix) => prefix + ++counter,
    newDoc: (cid, type) => {
      if (x.noDoc) return;
      state.DOCS.push({ id: "nd" + ++counter, caseId: cid, type, draft: true, items: [] });
      state.state.docId = state.DOCS.at(-1).id;
    },
    startReinspection: (cid, row) => {
      if (!state.REINSP.some((r) => r.caseId === cid && r.draft))
        state.REINSP.push({ id: "w" + ++counter, caseId: cid, draft: true, date: row.date });
    },
    saveDrafts: async () => true,
    render: () => undefined,
    toast: () => undefined,
  };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createAccelaImport(services);
  assert.deepEqual(calls, [], "construction remains inert");
  const table = owner.accelaTable(x.grid);
  const acc = {
    fileName: x.fileName,
    cases: table.cases,
    caseIx: 0,
    sel: x.sel,
    manualDate: x.manualDate,
    manualTime: x.manualTime,
    notes: table.notes,
    errors: table.errors,
    source: x.source,
  };
  state.state = { screen: "import", docId: "", acc };
  const chosen = acc.cases[0] && acc.cases[0].rows[x.sel === null ? (acc.cases[0].sel ?? 0) : x.sel];
  const identity = chosen && { type: chosen.typeKey, date: chosen.date, time: chosen.time };
  if (x.draft)
    state.DOCS.push({
      id: "dd",
      caseId: "c",
      type: "notice",
      draft: true,
      items: [],
      ...(x.draft === "refresh" ? { importInspection: identity } : {}),
    });
  if (x.worksheet)
    state.REINSP.push({
      id: "ws",
      caseId: "c",
      draft: true,
      date: "2026-10-20",
      ...(x.worksheet === "refresh" ? { importInspection: identity } : {}),
    });
  let value, error;
  try {
    value = owner.baseLookupAccept();
  } catch (e) {
    error = [e.name, e.message];
  }
  const clean = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, "<now>");
  return clean(
    JSON.stringify({
      value,
      error,
      cases: state.CASES,
      docs: state.DOCS,
      reinsp: state.REINSP,
      ui: state.state,
      work: state.WORK,
      dirty: state.DIRTY,
      calls,
    }),
  );
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {createAccelaImport} from "./accela_import.js";'),
    compile(fs.readFileSync("tests/fixtures/accela_import_reference.txt", "utf8")),
  ]);
  const inspector = current.INSPECTORS.find((i) => i.name).name;
  let interrupted = 0,
    accepted = 0;
  const seen = new Set();
  for (let n = 0; n < 8000; n++) {
    const sc = scenario(inspector);
    const [before, after] = [run(legacy, sc, inspector), run(current, sc, inspector)];
    assert.equal(after, before, `acceptance scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error) interrupted++;
    else if (parsed.value) accepted++;
    for (const call of parsed.calls) seen.add(call.split("(")[0].replace(/^get /, ""));
    for (const call of parsed.calls) if (call.startsWith("toast(")) seen.add(call.slice(7, 90));
  }
  for (const name of [
    "toast",
    "snow.imported",
    "snow.prepare",
    "citationPricing.refresh",
    "newDoc",
    "startReinspection",
    "saveDrafts",
    "render",
    "uid",
  ])
    assert.ok(seen.has(name), "scenarios reach " + name);
  const toasts = [...seen].join("|");

  for (const fragment of ["opened from the Accela report", "This case has unfinished work", "Choose the inspection result you are documenting"])
    assert.ok(toasts.includes(fragment), "scenarios reach toast: " + fragment);
  assert.ok(interrupted > 100 && accepted > 400, `coverage: ${interrupted} interrupted, ${accepted} accepted`);
  console.log("PASS import acceptance matches the retained module over 8000 scenarios (" + interrupted + " interrupted, " + accepted + " accepted)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
