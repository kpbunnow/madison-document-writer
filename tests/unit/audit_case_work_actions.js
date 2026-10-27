/* Workspace removals and reinspection entry load without startup or storage. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  f(n);
  Object.values(n).forEach((x) => walk(x, f));
}
const defs = {
  caseWorkspaceActions: ["case_workspace_actions", "createCaseWorkspaceActions", ["toast", "clearWalk", "saveDrafts", "render"]],
  reinspectionEntry: [
    "reinspection_entry",
    "createReinspectionEntry",
    [
      "snow",
      "recordIntegrity",
      "clearWalk",
      "restoreWalkFor",
      "newDocuments",
      "uid",
      "saveDrafts",
      "render",
      "sourceDocFor",
      "unissuedVisitFor",
      "today",
      "toast",
    ],
  ],
};
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
let prev = entries.findIndex((n) => n.id.name === "draftSaveControls");
for (const [name, [file, ctor, fields]] of Object.entries(defs)) {
  const used = new Set();
  walk(parse(file), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") {
      assert.equal(n.computed, false);
      used.add(n.property.name);
    }
  });
  assert.deepEqual([...used].sort(), fields.slice().sort());
  const e = entries.find((n) => n.id.name === name);
  assert.equal(e.init.callee.name, ctor);
  assert.deepEqual(new Set(e.init.arguments[0].properties.map((p) => p.key.name)), used);
  assert.ok(entries.indexOf(e) > prev);
  assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "recipientWorkflow"));
  prev = entries.indexOf(e);
}
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createCaseWorkspaceActions} from './case_workspace_actions.js';export {createReinspectionEntry} from './reinspection_entry.js';export {WriterState} from './state.js';",
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
  const { createCaseWorkspaceActions, createReinspectionEntry, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  for (const ctor of [createCaseWorkspaceActions, createReinspectionEntry])
    ctor(new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  assert.deepEqual(s, {});
  let calls = [],
    release,
    saveMode = "normal";
  const actions = createCaseWorkspaceActions({
      toast: (m) => calls.push(["toast", m]),
      clearWalk: () => calls.push(["clearWalk"]),
      saveDrafts: () => {
        calls.push(["save"]);
        if (saveMode === "wait") return new Promise((r) => (release = r));
        if (saveMode === "fail") throw Error("save refusal");
      },
      render: () => calls.push(["render"]),
    }),
    copy = (v) => JSON.parse(JSON.stringify(v));
  const reset = () => {
    calls = [];
    saveMode = "normal";
    Object.assign(s, {
      CASES: [{ id: "c", number: "BI-123", address: "123 Main", savedAt: "2026-10-01" }],
      DOCS: [],
      REINSP: [],
      EVENTS: { c: [] },
      RECORD_ATTEMPTS: {},
      PENDING: [],
      SAVE_CHECKPOINTS: {},
      WORK: { walk: { retained: true } },
      state: { docId: null, reinspId: null },
      DIRTY: false,
    });
  };
  reset();
  let k = s.CASES[0];
  s.RECORD_ATTEMPTS = { pending: { cid: "c" } };
  assert.equal(actions.caseUnsaved(k), "record change awaiting save confirmation");
  s.RECORD_ATTEMPTS = {};
  s.PENDING = [{ cid: "c" }];
  assert.equal(actions.caseUnsaved(k), "case file waiting to reach the share");
  s.PENDING = [];
  s.DOCS = [{ id: "draft", caseId: "c", draft: true }];
  assert.equal(actions.caseUnsaved(k), "unfinished drafts");
  s.DOCS = [];
  assert.equal(actions.caseUnsaved(k), "case details saved only on this device");
  s.EVENTS.c = [{ id: "e", at: "2026-09-01", type: "notice.issued" }];
  delete k.savedAt;
  assert.equal(actions.caseUnsaved(k), "issued documents never written to the share");
  k.savedAt = "2026-10-01";
  s.SAVE_CHECKPOINTS.c = { case: copy(k), events: ["e"] };
  assert.equal(actions.caseUnsaved(k), "");
  k.address = "changed";
  assert.equal(actions.caseUnsaved(k), "changes made since the last save");
  k.address = "123 Main";
  s.EVENTS.c.push({ id: "later", at: "2026-10-02" });
  assert.equal(actions.caseUnsaved(k), "changes made since the last save");
  delete s.SAVE_CHECKPOINTS.c;
  assert.equal(actions.caseUnsaved(k), "changes made since the last save");
  reset();
  s.DOCS = [{ id: "d", draft: true, caseId: "c", pendingAmendment: { id: "pending" } }];
  const before = copy(s);
  assert.equal(await actions.discardDraft("d"), false);
  assert.deepEqual(s, before);
  assert.match(calls[0][1], /pending save/);
  reset();
  s.DOCS = [
    { id: "d", draft: true, caseId: "c" },
    { id: "issued", draft: false, caseId: "c" },
  ];
  s.REINSP = [{ id: "r", draft: true, docId: "d" }];
  saveMode = "wait";
  const discard = actions.discardDraft("d");
  assert.deepEqual(
    calls.map((x) => x[0]),
    ["save"],
  );
  assert.deepEqual(
    s.DOCS.map((d) => d.id),
    ["issued"],
  );
  assert.equal(s.REINSP[0].docId, null);
  release();
  await discard;
  assert.deepEqual(
    calls.map((x) => x[0]),
    ["save", "render"],
  );
  reset();
  s.REINSP = [{ id: "r", draft: true }];
  s.state.reinspId = "r";
  await actions.discardDraft("r");
  assert.equal(s.WORK.walk, null);
  assert.deepEqual(
    calls.map((x) => x[0]),
    ["clearWalk", "save", "render"],
  );
  reset();
  s.DOCS = [{ id: "d", draft: true }];
  saveMode = "fail";
  await assert.rejects(actions.discardDraft("d"), /save refusal/);
  assert.ok(!calls.some((x) => x[0] === "render"));
  reset();
  s.RECORD_ATTEMPTS = { a: { cid: "c" } };
  assert.equal(actions.removeCase("c"), false);
  assert.equal(s.CASES.length, 1);
  s.RECORD_ATTEMPTS = {};
  s.DOCS = [{ id: "d", caseId: "c", pendingAmendment: {} }];
  assert.equal(actions.removeCase("c"), false);
  reset();
  s.CASES.push({ id: "other", number: "BI-OTHER" });
  s.DOCS = [
    { id: "d", caseId: "c" },
    { id: "other-doc", caseId: "other" },
  ];
  s.state.docId = "d";
  s.EVENTS.other = [{ id: "kept" }];
  actions.removeCase("c");
  assert.deepEqual(
    s.CASES.map((k) => k.id),
    ["other"],
  );
  assert.deepEqual(
    s.DOCS.map((d) => d.id),
    ["other-doc"],
  );
  assert.equal(s.state.docId, null);
  assert.equal(s.EVENTS.c, undefined);
  assert.equal(s.EVENTS.other[0].id, "kept");
  assert.deepEqual(
    calls.map((x) => x[0]),
    ["save"],
  );
  reset();
  k = s.CASES[0];
  s.SAVE_CHECKPOINTS.c = { case: copy(k), events: [] };
  s.CASES.push({ id: "risky", number: "BI-RISKY" });
  actions.clearCases("safe");
  assert.deepEqual(
    s.CASES.map((k) => k.id),
    ["risky"],
  );
  assert.equal(s.state.screen, "cases");
  assert.match(calls.at(-1)[1], /1 case removed.*Shared case records are not deleted/);
  let day = "2026-10-27",
    snowMode = false,
    blocked = false,
    source = null,
    unissued = null;
  const entry = createReinspectionEntry({
    get snow() {
      return { isCase: () => snowMode };
    },
    get recordIntegrity() {
      return { blocked: () => blocked };
    },
    clearWalk: () => calls.push(["clearWalk"]),
    restoreWalkFor: (r) => calls.push(["walk", r]),
    get newDocuments() {
      return { continuingItems: (d) => d.items };
    },
    uid: (p) => p + "-new",
    saveDrafts: () => calls.push(["save"]),
    render: () => calls.push(["render"]),
    sourceDocFor: () => source,
    unissuedVisitFor: () => unissued,
    get today() {
      return day;
    },
    toast: (m) => calls.push(["toast", m]),
  });
  reset();
  snowMode = true;
  entry.startReinspection("c");
  assert.deepEqual(
    calls.map((x) => x[0]),
    ["toast"],
  );
  snowMode = false;
  blocked = true;
  calls = [];
  entry.startReinspection("c");
  assert.match(calls[0][1], /Read-only/);
  blocked = false;
  reset();
  s.DOCS = [{ id: "correction", caseId: "c", draft: true, correction: {} }];
  entry.startReinspection("c");
  assert.equal(s.state.docId, "correction");
  assert.equal(s.state.screen, "write");
  assert.deepEqual(
    calls.map((x) => x[0]),
    ["clearWalk", "render", "toast"],
  );
  s.DOCS[0].correction = null;
  calls = [];
  entry.startReinspection("c");
  assert.match(calls.at(-1)[1], /unfinished document/);
  reset();
  const open = {
    id: "open",
    caseId: "c",
    draft: true,
    date: "2026-10-20",
    results: {
      same: { on: "2026-10-20" },
      blank: { on: "" },
      manual: { on: "2026-10-20", manualDate: true },
      carried: { on: "2026-10-20", carried: true },
      other: { on: "2026-10-19" },
    },
  };
  s.REINSP = [open];
  entry.startReinspection("c", { date: "2026-10-26", time: "09:00", inspectorId: "i", typeKey: "reinspection" });
  assert.equal(open.results.same.on, "2026-10-26");
  assert.equal(open.results.blank.on, "2026-10-26");
  assert.equal(open.results.manual.on, "2026-10-20");
  assert.equal(open.results.carried.on, "2026-10-20");
  assert.equal(open.results.other.on, "2026-10-19");
  assert.equal(open.importInspection.type, "reinspection");
  assert.deepEqual(
    calls.map((x) => x[0]),
    ["clearWalk", "walk", "render"],
  );
  reset();
  source = null;
  entry.startReinspection("c");
  assert.match(calls.at(-1)[1], /issue the notice/);
  source = { id: "src", type: "compliance", items: [{ id: "i" }] };
  calls = [];
  entry.startReinspection("c");
  assert.match(calls.at(-1)[1], /completed/);
  reset();
  source = {
    id: "src",
    type: "notice",
    items: [{ id: "live" }, { id: "done", done: true, doneOn: "2026-10-01" }, { id: "withdrawn", withdrawn: true }],
  };
  const savedSource = copy(source);
  s.EVENTS.c = [{ id: "event", type: "notice.issued" }];
  entry.startReinspection("c");
  const r = s.REINSP[0];
  assert.equal(r.id, "r-new");
  assert.equal(r.date, day);
  assert.deepEqual(r.expectedHead, ["event"]);
  assert.equal(r.sourceDocId, "src");
  assert.equal(r.results.done.carried, true);
  assert.equal(r.results.withdrawn.oc, "withdrawn");
  assert.equal(Object.hasOwn(r.results, "live"), false);
  assert.equal(s.WORK.walk, null);
  assert.equal(s.DIRTY, true);
  assert.deepEqual(source, savedSource);
  assert.deepEqual(
    calls.map((x) => x[0]),
    ["clearWalk", "save", "render"],
  );
  reset();
  day = "2026-10-28";
  entry.startReinspection("c");
  assert.equal(s.REINSP[0].date, day);
  console.log(
    JSON.stringify({
      passed: true,
      actionInputs: 4,
      entryInputs: 12,
      inertConstruction: true,
      pendingAndUnsavedGuards: true,
      discardSaveOrder: true,
      workspaceOnlyRemoval: true,
      reinspectionRoutingAndCarriedDates: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
