/* Added async phases must not let a cancelled request resume after its helper has settled. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const acorn = require("acorn");
function functions(file) {
  const source = fs.readFileSync(file, "utf8"),
    found = new Map();
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "FunctionDeclaration") found.set(node.id.name, source.slice(node.start, node.end));
    Object.values(node).forEach((value) => (Array.isArray(value) ? value.forEach(visit) : visit(value)));
  }
  visit(acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" }));
  return found;
}
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
async function ticks(n = 12) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}
async function reportsRace(offset, parcels, cancel = true, stage = parcels ? "parcels" : "areas") {
  const f = functions("app/modules/reports_services.js");
  const state = { S: {} },
    area = deferred(),
    parcel = deferred(),
    index = deferred(),
    cache = deferred();
  let expectedState,
    generation = 1,
    indexCalls = 0,
    staleBuilds = 0,
    staleAreas = 0;
  const services = { render() {}, plural: (n) => String(n) };
  const getJSON = (url, opts) => {
    if (url === "/reporting/index")
      return ++indexCalls === 1 ? (stage === "index" ? index.promise : Promise.resolve({ ok: true, summaries: [] })) : new Promise(() => {});
    if (url === "/reporting/parcels") return opts.method === "POST" ? parcel.promise : stage === "cache" ? cache.promise : Promise.resolve({});
    if (url === "/reporting/areas") {
      if (generation === 2) staleAreas++;
      return area.promise;
    }
    throw Error(url);
  };
  const built = new Function(
    "ReportsState",
    "getJSON",
    "AbortController",
    "services",
    "prepareReportParcelCache",
    "buildModel",
    "mergeParcelLookup",
    "reportLoadError",
    "let loadSequence=0,loadController=null;\n" +
      ["lookUpReportParcels", "loadReportAreas", "loadAll"].map((n) => f.get(n)).join("\n") +
      ";return loadAll;",
  );
  const load = built(
    state,
    getJSON,
    AbortController,
    services,
    () => (parcels ? ["parcel"] : []),
    () => {
      if (generation === 2) staleBuilds++;
      return {};
    },
    () => {},
    String,
  );
  const run = load();
  await ticks();
  ({ index, cache, parcels: parcel, areas: area })[stage].resolve({ ok: true, summaries: [] });
  let chain = Promise.resolve();
  for (let i = 0; i < offset; i++) chain = chain.then(() => {});
  chain.then(() => {
    if (cancel) {
      generation = 2;
      void load();
      expectedState = JSON.stringify(state.S);
    }
  });
  await ticks(20);
  for (const gate of [index, cache, parcel, area]) gate.resolve({ ok: true, summaries: [] });
  await run;
  await ticks();
  if (cancel) assert.equal(JSON.stringify(state.S), expectedState, "settled old load must leave every newer state field intact");
  return { staleBuilds, staleAreas, phase: state.S.phase };
}
async function confirmRace(cancel = true) {
  const f = functions("app/modules/accela_import.js"),
    gate = deferred();
  const acc = { sel: 0 },
    imports = { LOOKUP_SERIAL: 0, ACC_SELECTION_SERIAL: 0 },
    editor = { state: { acc, screen: "import" } };
  let acceptedStale = false,
    accepted = 0;
  const services = { render() {}, saveDrafts: async () => true, toast() {} };
  const fn = new Function(
    "imports",
    "editor",
    "workspace",
    "liveSource",
    "accelaImportCheckShared",
    "accelaImportFromShare",
    "accelaImportSignature",
    "accelaImportAccept",
    ["confirmSharedRecord", "finishImportConfirm", "accelaImportConfirm"].map((n) => f.get(n)).join("\n") + ";return accelaImportConfirm;",
  )(
    imports,
    editor,
    { CASEDIR: { helper: true } },
    () => false,
    () => gate.promise,
    () => {
      throw Error("wrong branch");
    },
    () => "unchanged",
    () => {
      accepted++;
      acceptedStale = editor.state.screen !== "import";
    },
  );
  const run = fn(services, new WeakSet());
  gate.promise.then(() => {
    if (cancel) editor.state.screen = "cases";
  });
  gate.resolve(true);
  await run;
  return { accepted, acceptedStale };
}
async function findRace(cancel = true) {
  const f = functions("app/modules/accela_import.js"),
    gate = deferred();
  let current = true,
    staleReads = 0,
    opened = 0;
  const services = { saveDrafts: async () => true };
  const fn = new Function(
    "imports",
    "beginLookup",
    "requestCase",
    "sqlReport",
    "accelaImportCheckShared",
    "accelaImportOpenResult",
    "lookupFailureMessage",
    "endLookup",
    ["fetchCaseReport", "checkRetrievedShare", "accelaImportFind"].map((n) => f.get(n)).join("\n") + ";return accelaImportFind;",
  )(
    {},
    () => ({ number: "SYNTHETIC", serial: 1, active: () => current }),
    () => gate.promise,
    () => ({}),
    () => {
      if (!current) staleReads++;
      return Promise.resolve(true);
    },
    () => {
      opened++;
    },
    String,
    async () => {},
  );
  const run = fn(services);
  await ticks();
  gate.promise.then(() => {
    if (cancel) current = false;
  });
  gate.resolve({ response: { ok: true }, result: { ok: true } });
  await run;
  return { staleReads, opened };
}
const deadline = setTimeout(() => {
  console.error("Async guard regression did not settle");
  process.exitCode = 1;
}, 10000);
(async () => {
  const failures = [];
  for (const stage of ["index", "cache", "parcels", "areas"])
    for (let offset = 0; offset < 8; offset++) {
      const parcels = stage === "parcels";
      const result = await reportsRace(offset, parcels, true, stage);
      if (result.staleBuilds || result.staleAreas || result.phase !== "loading") failures.push({ offset, parcels, ...result });
    }
  for (const parcels of [false, true]) assert.deepEqual(await reportsRace(0, parcels, false), { staleBuilds: 0, staleAreas: 0, phase: "ready" });
  assert.deepEqual(await confirmRace(false), { accepted: 1, acceptedStale: false });
  assert.deepEqual(await findRace(false), { staleReads: 0, opened: 1 });
  assert.deepEqual(await findRace(), { staleReads: 0, opened: 0 });
  const confirmation = await confirmRace();
  assert.deepEqual(
    { confirmation, reports: failures },
    { confirmation: { accepted: 0, acceptedStale: false }, reports: [] },
    "cancelled continuations must not import or publish stale report data",
  );
  assert.deepEqual(failures, [], "an older Reports request changed state after a new load began");
  console.log("PASS Phase 3 helper-settlement cancellation: Reports interleavings and import confirmation");
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(deadline));
