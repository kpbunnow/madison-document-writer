/* Direct case lookup against the retained module: validation, the request, stale-result guards, the shared-record
   check, acceptance or review, failure messages, busy and controller cleanup, every peer call in order, and refusal
   on the first interrupted read or call. */
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

globalThis.__TEST_BUILD__ = true;
globalThis.document = { querySelector: () => ({ content: "token" }) };

let seed = 20261108;
const random = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 4294967296) * n);
  },
  pick = (values) => values[random(values.length)],
  chance = (n) => random(n) === 0;

const NUMBER = "CB2026-100-00001";

function sqlRow(type, status, date) {
  return {
    CaseNumber: NUMBER,
    InspectionType: type,
    InspectionStatus: status,
    InspectionDate: date,
    InspectionTime: "09:05",
    InspectorName: "<inspector>",
    SiteAddress: "100 TEST ST",
    OwnerName: "OWNER",
    OwnerAddress: "100 TEST ST\nMADISON WI",
    ParcelNumber: "070913125237",
    CaseDescription: "Complaint",
    HistoricDistrict: "No",
    IndividualLandmark: "No",
  };
}

function scenario() {
  const rows = Array.from({ length: pick([1, 1, 1, 2]) }, () =>
    sqlRow(
      pick(["Initial Inspection", "Initial Inspection", "Reinspection"]),
      pick(["Official Notice", "Official Notice", "Citation", "Unknown"]),
      pick(["2026-10-01T00:00:00", "2026-10-02T00:00:00"]),
    ),
  );
  return {
    entry: pick([NUMBER, NUMBER, NUMBER.toLowerCase(), " " + NUMBER + " ", "bad number!", "", undefined]),
    busy: chance(8),
    saveDrafts: pick([true, true, true, false]),
    saveAfter: pick([true, true, true, false]),
    stale: pick(["", "", "", "", "serial-save", "screen-save", "serial-fetch", "serial-json", "serial-list", "serial-open", "screen-after"]),
    response: pick(["ok", "ok", "ok", "ok", "notok", "failed", "abort", "boom", "emptyfail"]),
    result: pick(["good", "good", "good", "good", "mismatch", "norows"]),
    rows,
    listing: pick(["none", "none", "none", "other", "duplicate", "match", "notarray"]),
    openedNumber: pick([NUMBER, "CB2026-999-00009"]),
    localDuplicate: chance(10),
    loaded: pick([true, true, false]),
    snow: chance(8),
    existing: chance(10),
    helper: chance(2),
    fail: chance(3) ? 1 + random(120) : 0,
  };
}

async function run(api, sc, inspector) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  Object.assign(state, {
    CASES: [
      ...(x.localDuplicate
        ? [
            { id: "d1", number: NUMBER },
            { id: "d2", number: NUMBER },
          ]
        : []),
      ...(x.existing
        ? [
            {
              id: "e",
              number: NUMBER,
              address: "100 TEST ST",
              owner: "OWNER",
              ownerAddr: ["100 TEST ST", "MADISON WI"],
              date: "2026-10-01",
              time: "09:05",
              inspectorId: api.INSPECTORS[0].id,
            },
          ]
        : []),
    ],
    DOCS: [],
    REINSP: [],
    EVENTS: {},
    WORK: { entry: { "lookup-number": x.entry } },
    LOOKUP_BUSY: x.busy,
    LOOKUP_ERROR: "",
    LOOKUP_SERIAL: 0,
    LOOKUP_CONTROLLER: null,
    ACC_SELECTION_SERIAL: 0,
    CASEDIR: x.helper ? { helper: true } : null,
    state: { screen: "import", docId: "", acc: null },
  });
  const trigger = (name) => {
    if (x.stale === "serial-" + name) state.LOOKUP_SERIAL += 1;
    if (x.stale === "screen-" + name) state.state.screen = "cases";
  };
  let saves = 0,
    counter = 0;
  const fetches = [];
  globalThis.fetch = async (url, options) => {
    fetches.push([url, options.method, options.body, options.headers.get("X-DocWriter-Token")]);
    trigger("fetch");
    if (x.response === "abort") throw Object.assign(new Error("aborted"), { name: "AbortError" });
    if (x.response === "boom") throw new Error("offline");
    const body = {
      ok: true,
      rows: x.result === "norows" ? [] : x.rows.map((row) => ({ ...row, InspectorName: inspector })),
      caseNumber: x.result === "mismatch" ? "CB2026-1-1" : NUMBER,
      source: { kind: "sql", retrievedAt: "2026-10-27T12:00:00Z" },
    };
    return {
      ok: x.response !== "notok" && x.response !== "failed" && x.response !== "emptyfail",
      status: 200,
      json: async () => {
        trigger("json");
        if (x.response === "failed") return { ok: false, error: "Lookup said no" };
        if (x.response === "emptyfail") return { ok: false };
        return body;
      },
    };
  };
  const returns = {
    captureWork: () => undefined,
    render: () => undefined,
    toast: () => undefined,
    scheduleDraftSave: () => undefined,
    saveDrafts: async () => {
      saves++;
      trigger("save");
      if (saves === 1) return x.saveDrafts;
      trigger("open");
      return x.saveAfter;
    },
    helperJSON: async (url) => {
      trigger("list");
      if (url === "/cases/list") {
        if (x.listing === "notarray") return { files: "x" };
        if (x.listing === "none") return { files: [] };
        if (x.listing === "other") return { files: [{ name: "a - CB2026-1-1.json" }, { name: 3 }] };
        if (x.listing === "duplicate") return { files: [{ name: "a - " + NUMBER + ".json" }, { name: "b - " + NUMBER + ".json" }] };
        return { files: [{ name: "a - " + NUMBER + ".json" }] };
      }
      return { file: { case: { number: x.openedNumber } }, name: "a" };
    },
    loadCaseFile: () => x.loaded,
    "COMMITTED.set": () => undefined,
    "snow.isCase": () => x.snow,
    "snow.is": () => x.snow,
    "snow.matchesImport": () => x.snow,
    "snow.imported": () => undefined,
    "snow.prepare": () => undefined,
    "citationPricing.refresh": () => undefined,
    sourceDocFor: () => null,
    unissuedVisitFor: () => null,
    caseState: () => ({ closed: false }),
    fmtDate: (v) => "D:" + v,
    fmtTime: (v) => "T:" + v,
    uid: (prefix) => prefix + ++counter,
    newDoc: (cid, type) => {
      state.DOCS.push({ id: "nd" + ++counter, caseId: cid, type, draft: true, items: [] });
      state.state.docId = state.DOCS.at(-1).id;
    },
    startReinspection: () => undefined,
  };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createAccelaImport(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let error;
  try {
    await owner.findDatabaseCase();
    trigger("after");
  } catch (e) {
    error = [e.name, e.message];
  }
  const clean = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, "<now>");
  const ui = { ...state.state };
  return clean(
    JSON.stringify({
      error,
      fetches,
      lookup: [state.LOOKUP_BUSY, state.LOOKUP_ERROR, state.LOOKUP_SERIAL, state.LOOKUP_CONTROLLER],
      entry: state.WORK.entry,
      acc: ui.acc && { shareError: ui.acc.shareError, fileName: ui.acc.fileName },
      screen: ui.screen,
      workAcc: !!state.WORK.acc,
      cases: state.CASES.length,
      docs: state.DOCS,
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
    opened = 0,
    reviewed = 0,
    timedOut = 0;
  const seen = new Set();
  for (let n = 0; n < 6000; n++) {
    const sc = scenario();
    const before = await run(legacy, sc, inspector),
      after = await run(current, sc, inspector);
    assert.equal(after, before, `lookup scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error) interrupted++;
    if (parsed.docs.length) opened++;
    if (parsed.calls.some((c) => c.startsWith('toast(["Case retrieved'))) reviewed++;
    if (parsed.lookup[1].includes("timed out")) timedOut++;
    seen.add(parsed.lookup[1].slice(0, 40));
    for (const call of parsed.calls) seen.add(call.split("(")[0].replace(/^get /, ""));
  }
  for (const name of ["captureWork", "saveDrafts", "helperJSON", "loadCaseFile", "COMMITTED.set", "scheduleDraftSave", "toast", "render", "newDoc"])
    assert.ok(seen.has(name), "scenarios reach " + name);
  for (const text of [
    "Enter a complete case number",
    "The lookup timed out",
    "Lookup said no",
    "Your search could not be saved",
    "No case was found for",
    "Unexpected case response",
    "offline",
  ])
    assert.ok(
      [...seen].some((t) => t.includes(text)),
      "scenarios reach: " + text,
    );
  assert.ok(
    interrupted > 50 && opened > 30 && reviewed > 100 && timedOut > 50,
    `coverage: ${interrupted} interrupted, ${opened} opened, ${reviewed} reviewed, ${timedOut} timed out`,
  );
  console.log(
    "PASS direct lookup matches the retained module over 6000 scenarios (" +
      interrupted +
      " interrupted, " +
      opened +
      " opened, " +
      reviewed +
      " reviewed)",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
