const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Independent live case-record operations and guarded load/merge/rollback coordination. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, visit) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, visit));
  visit(n);
  Object.values(n).forEach((c) => walk(c, visit));
}
const used = new Set();
walk(parse("case_loading"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual([...used].sort(), ["toast", "recordIntegrity", "render", "saveDrafts", "refreshArtifactLocations"].sort());
const declarations = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = declarations.find((n) => n.id.name === "caseLoading");
assert.equal(entry.init.callee.name, "createCaseLoading");
assert.deepEqual(new Set(serviceComposition(entry.init.arguments[0]).properties.map((p) => p.key.name)), used);
assert.ok(declarations.indexOf(entry) > declarations.findIndex((n) => n.id.name === "caseSaveWorkflow"));
assert.ok(declarations.indexOf(entry) < declarations.findIndex((n) => n.id.name === "documentRenderer"));
for (const p of serviceComposition(entry.init.arguments[0]).properties) {
  if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
  else {
    assert.equal(p.value.type, "ArrowFunctionExpression");
    assert.equal(p.value.body.callee.name, p.key.name);
  }
}
const copy = (v) => JSON.parse(JSON.stringify(v)),
  tick = () => new Promise(setImmediate);
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export * from './case_records.js'; export {createCaseLoading} from './case_loading.js'; export {WriterState} from './state.js'; export {INSPECTORS} from './data/inspectors.js';",
      resolveDir: dir,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const api = box.exports,
    { WriterState: state, INSPECTORS } = api;
  assert.deepEqual(state, {});
  api.createCaseLoading(new Proxy({}, { get: (_, k) => assert.fail("premature dependency " + String(k)) }));
  assert.deepEqual(state, {});
  const initialInspectors = INSPECTORS.length,
    actor = INSPECTORS.find((i) => i.name).id;
  function kase(id = "case") {
    return { id, number: "BLD2026-00001", address: "1 SYNTHETIC ST", owner: "Original", inspectorId: actor, date: "2026-10-20" };
  }
  function snapshot(id = "document", cid = "case") {
    return {
      id,
      caseId: cid,
      type: "notice",
      authoringVersion: 9,
      mailed: "2026-10-20",
      inspectorId: actor,
      items: [{ id: "item", no: "1", sections: ["27.05(2)(c)"], text: "Retained wording" }],
      frozen: { case: kase(cid), inspector: { id: actor, name: "Frozen inspector" }, body: "Frozen body" },
    };
  }
  function issued(id = "event", cid = "case", docId = "document") {
    return { id, at: "2026-10-20T12:00:00.000Z", by: actor, type: "notice.issued", payload: { docId, snapshot: snapshot(docId, cid) } };
  }
  function file(cid = "case") {
    return { format: "madison-case-file", schema: 4, case: kase(cid), inspectors: [], events: [issued("event", cid)] };
  }
  function reset() {
    INSPECTORS.length = initialInspectors;
    Object.assign(state, {
      CASES: [kase()],
      EVENTS: { case: [] },
      DOCS: [{ id: "draft", caseId: "case", draft: true, items: [] }],
      REINSP: [{ id: "worksheet", caseId: "case", draft: true }],
      SAVE_CHECKPOINTS: {},
      seq: 1,
      DIRTY: true,
      state: { screen: "write" },
      CASEDIR: null,
      NEEDGRANT: false,
    });
  }
  reset();
  const draft = state.DOCS[0],
    worksheet = state.REINSP[0],
    first = issued();
  state.EVENTS.case = [
    first,
    {
      id: "visit-event",
      at: "2026-10-21T12:00:00Z",
      type: "reinspection.recorded",
      payload: { reinspection: { id: "visit", caseId: "case", sourceDocId: "document", date: "2026-10-21", results: { item: { oc: "none" } } } },
    },
  ];
  const eventBytes = JSON.stringify(state.EVENTS.case);
  api.project();
  assert.equal(state.DOCS[0], draft);
  assert.equal(state.REINSP[0], worksheet);
  assert.equal(state.DOCS[1].id, "document");
  assert.equal(state.DOCS[1].frozen.body, "Frozen body");
  assert.equal(state.REINSP[1].id, "visit");
  assert.equal(JSON.stringify(state.EVENTS.case), eventBytes);
  assert.equal(api.replay("case").documents[0].authoringVersion, 9);
  const exported = api.caseFile("case");
  assert.equal(exported.schema, 5);
  assert.equal(exported.format, "madison-case-file");
  assert.equal(exported.exportedBy, INSPECTORS.find((i) => i.id === actor).name);
  assert.equal(exported.inspectors.length, 1);
  assert.notEqual(exported.case, state.CASES[0]);
  assert.notEqual(exported.events, state.EVENTS.case);
  exported.events[0].payload.snapshot.items[0].text = "Export mutation";
  assert.equal(first.payload.snapshot.items[0].text, "Retained wording");
  const saved = file("remote");
  saved.case.savedAt = "external metadata";
  api.rememberSaved(state.CASES[0], saved);
  assert.equal(state.SAVE_CHECKPOINTS.case.case.id, "case");
  assert.equal(state.SAVE_CHECKPOINTS.case.case.savedAt, undefined);
  assert.deepEqual(state.SAVE_CHECKPOINTS.case.events, ["event"]);
  assert.ok(state.CASES[0].savedAt);
  assert.notEqual(state.SAVE_CHECKPOINTS.case.case, saved.case);
  reset();
  assert.equal(api.caseNumberAllowed(state.CASES[0]), true);
  const legacy = { id: "legacy", number: "old case number" };
  assert.equal(api.caseNumberAllowed(legacy), false);
  legacy.savedAt = "retained";
  assert.equal(api.caseNumberAllowed(legacy), true);
  assert.equal(api.caseNumberAllowed({ id: "blank", number: "" }), false);
  api.bumpSeq({ id: "d400", nested: ["x900", { value: "prefix42", other: "r800" }] });
  assert.equal(state.seq, 900);
  reset();
  const remote = file("remote");
  remote.events.push({
    id: "remote-visit",
    at: "2026-10-21T12:00:00Z",
    type: "reinspection.recorded",
    payload: { caseId: "remote", reinspection: { id: "visit", caseId: "remote", sourceDocId: "document", results: {} } },
  });
  assert.equal(api.mergeCaseEvents(state.CASES[0], remote), 2);
  assert.equal(remote.events[0].payload.snapshot.caseId, "case");
  assert.equal(remote.events[1].payload.reinspection.caseId, "case");
  assert.equal(remote.events[1].payload.caseId, "case");
  assert.equal(api.mergeCaseEvents(state.CASES[0], remote), 0);
  const retained = copy(state.EVENTS.case),
    conflicting = copy(remote);
  conflicting.events[0].payload.snapshot.items[0].text = "Conflicting bytes";
  assert.throws(() => api.mergeCaseEvents(state.CASES[0], conflicting), /Conflicting content/);
  assert.deepEqual(state.EVENTS.case, retained);
  const invalidCorrection = {
    id: "bad-correction",
    at: "2026-10-22T12:00:00Z",
    type: "correction.issued",
    payload: {
      replaces: "missing",
      baseEventId: "missing",
      reason: "Correction review",
      snapshot: { ...snapshot("revision"), revision: { rootId: "missing" } },
    },
  };
  assert.throws(() => api.mergeCaseEvents(state.CASES[0], { case: kase(), events: [invalidCorrection] }), /Conflicting corrections/);
  assert.deepEqual(state.EVENTS.case, retained);

  let calls = [],
    proof = true,
    verificationValid = true,
    verifyHold = null;
  const loading = api.createCaseLoading({
    toast: (text) => calls.push(["toast", text]),
    get recordIntegrity() {
      return {
        hasProof: () => proof,
        verify: async (f) => {
          calls.push(["verify", copy(f)]);
          if (verifyHold) await verifyHold;
          proof = true;
          return { valid: verificationValid };
        },
      };
    },
    render: () => calls.push(["render"]),
    saveDrafts: () => {
      calls.push(["save"]);
      return true;
    },
    refreshArtifactLocations: () => calls.push(["artifacts"]),
  });
  function resetLoader() {
    reset();
    calls = [];
    proof = true;
    verificationValid = true;
    verifyHold = null;
  }
  resetLoader();
  const beforeBad = JSON.stringify({ cases: state.CASES, events: state.EVENTS, docs: state.DOCS });
  assert.equal(loading.loadCaseFile("not-json"), null);
  assert.equal(loading.loadCaseFile("{}"), null);
  assert.equal(loading.loadCaseFile(JSON.stringify({ ...file(), schema: 99 })), null);
  assert.equal(JSON.stringify({ cases: state.CASES, events: state.EVENTS, docs: state.DOCS }), beforeBad);
  assert.equal(
    calls.some((c) => c[0] === "save"),
    false,
  );
  resetLoader();
  const incoming = file("remote");
  incoming.case.owner = "Shared owner";
  state.CASES = [];
  const loaded = loading.loadCaseFile(JSON.stringify(incoming));
  assert.equal(loaded.id, "remote");
  assert.equal(state.CASES.length, 1);
  assert.equal(state.DOCS.find((d) => d.id === "document").frozen.body, "Frozen body");
  assert.equal(state.state.screen, "cases");
  assert.equal(state.DIRTY, false);
  assert.ok(state.SAVE_CHECKPOINTS.remote);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["render", "save", "artifacts", "toast"],
  );
  const repeat = loading.loadCaseFile(JSON.stringify(incoming));
  assert.equal(repeat, loaded);
  assert.equal(state.EVENTS.remote.length, 1);
  assert.ok(calls.at(-1)[1].includes("nothing new"));
  resetLoader();
  state.SAVE_CHECKPOINTS.case = { case: kase(), events: [] };
  const local = state.CASES[0];
  local.owner = "Local owner";
  const disjoint = file("remote");
  disjoint.case.address = "Shared address";
  assert.equal(loading.loadCaseFile(JSON.stringify(disjoint)).id, "case");
  assert.equal(state.CASES[0].owner, "Local owner");
  assert.equal(state.CASES[0].address, "Shared address");
  assert.equal(state.EVENTS.case[0].payload.snapshot.caseId, "case");
  resetLoader();
  state.SAVE_CHECKPOINTS.case = { case: kase(), events: [] };
  state.CASES[0].owner = "Local owner";
  const conflict = file("remote");
  conflict.case.owner = "Shared owner";
  const caseBefore = copy(state.CASES);
  assert.equal(loading.loadCaseFile(JSON.stringify(conflict)), null);
  assert.deepEqual(state.CASES, caseBefore);
  assert.deepEqual(state.EVENTS, { case: [] });
  assert.equal(
    calls.some((c) => c[0] === "save"),
    false,
  );
  assert.ok(calls.at(-1)[1].includes("Both copies changed"));
  resetLoader();
  const heldFile = file("remote");
  heldFile.case.owner = "Held owner";
  assert.equal(loading.loadCaseFile(JSON.stringify(heldFile), false).id, "case");
  assert.equal(state.CASES[0].owner, "Original", "a held retry does not replace local case metadata");
  assert.equal(state.SAVE_CHECKPOINTS.case, undefined);
  assert.equal(state.EVENTS.case.length, 1);
  resetLoader();
  const brokenDraft = state.DOCS[0];
  delete brokenDraft.items;
  const rollbackFile = file("k400");
  rollbackFile.inspectors = [{ id: "temporary-inspector", name: "SYNTHETIC TEMPORARY INSPECTOR" }];
  const beforeRollback = { cases: copy(state.CASES), events: copy(state.EVENTS), inspectors: INSPECTORS.length, visits: copy(state.REINSP) };
  assert.equal(loading.loadCaseFile(JSON.stringify(rollbackFile)), null);
  assert.deepEqual(state.CASES, beforeRollback.cases);
  assert.deepEqual(state.EVENTS, beforeRollback.events);
  assert.equal(INSPECTORS.length, beforeRollback.inspectors);
  assert.deepEqual(state.REINSP, beforeRollback.visits);
  assert.equal(state.DOCS[0], brokenDraft);
  assert.equal(state.seq, 400, "retain the original sequence high-water behavior after rollback");
  assert.equal(
    calls.some((c) => c[0] === "save"),
    false,
  );
  assert.ok(calls.at(-1)[1].includes("did not replay"));
  resetLoader();
  const modern = { ...file(), schema: 5 };
  proof = false;
  let releaseVerify;
  verifyHold = new Promise((r) => {
    releaseVerify = r;
  });
  assert.equal(loading.loadCaseFile(JSON.stringify(modern)), null);
  assert.equal(state.EVENTS.case.length, 0);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["verify"],
  );
  releaseVerify();
  await tick();
  assert.equal(state.EVENTS.case.length, 1);
  assert.ok(state.SAVE_CHECKPOINTS.case);
  resetLoader();
  assert.equal(await loading.mergeSharedFile("case", "record.json"), 0);
  state.CASEDIR = {
    getFileHandle: async () => {
      const e = new Error("missing");
      e.name = "NotFoundError";
      throw e;
    },
  };
  assert.equal(await loading.mergeSharedFile("case", "record.json"), 0);
  state.CASEDIR = {
    getFileHandle: async () => {
      throw new Error("permission denied");
    },
  };
  await assert.rejects(loading.mergeSharedFile("case", "record.json"), /could not be read/);
  function folderWith(value) {
    state.CASEDIR = {
      getFileHandle: async () => ({ getFile: async () => ({ text: async () => (typeof value === "string" ? value : JSON.stringify(value)) }) }),
    };
  }
  folderWith("invalid-json");
  await assert.rejects(loading.mergeSharedFile("case", "record.json"), /unreadable/);
  folderWith({ ...file(), case: { id: "case", number: "DIFFERENT" } });
  await assert.rejects(loading.mergeSharedFile("case", "record.json"), /another case/);
  folderWith(modern);
  verificationValid = false;
  await assert.rejects(loading.mergeSharedFile("case", "record.json"), /changed outside/);
  assert.equal(state.EVENTS.case.length, 0);
  verificationValid = true;
  folderWith(modern);
  assert.equal(await loading.mergeSharedFile("case", "record.json"), 1);
  assert.equal(
    state.DOCS.some((d) => d.id === "document"),
    true,
  );
  assert.equal(await loading.mergeSharedFile("case", "record.json"), 0);
  assert.equal(state.EVENTS.case.length, 1);
  state.NEEDGRANT = true;
  assert.equal(await loading.mergeSharedFile("case", "record.json"), 0);
  INSPECTORS.length = initialInspectors;
  console.log(
    JSON.stringify({
      passed: true,
      loadingDependencies: 5,
      independentLiveRecords: true,
      identityAndConflictGuards: true,
      proofAndRollbackOrder: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
