/* View contexts retain scoped identities and read replaced workspace data only when called. */
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  directory = path.join(root, "app/modules");
const source = fs.readFileSync(path.join(directory, "app_view_contexts.js"), "utf8");
const parse = (s) => acorn.parse(s, { ecmaVersion: 2022, sourceType: "module" });
const scopes = {
  createSavedWorkContext: [
    "caseUnsaved",
    "caseState",
    "recoveryStatusHTML",
    "pdfTransferState",
    "A11Y",
    "CASEDIR_EXPECT",
    "COMMITTED",
    "recordIntegrity",
    "storageMode",
  ],
  createWorkspaceQueueContext: ["caseNumberAllowed", "pdfTransferState", "recordIntegrity", "snow"],
  createLanguageDiscoveryContext: [
    "allItems",
    "shell",
    "catalogKey",
    "catalogItem",
    "catalogReviewPanel",
    "catalogStatus",
    "catalogVisible",
    "effectiveCatalog",
  ],
};
const core = parse(fs.readFileSync(path.join(directory, "app_core.js"), "utf8"));
const calls = new Map();
for (const statement of core.body) {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
  for (const d of declaration?.declarations || []) if (scopes[d.init?.callee?.name]) calls.set(d.init.callee.name, d.init);
}
assert.deepEqual([...calls.keys()], Object.keys(scopes), "context composition order remains explicit");
for (const [factory, names] of Object.entries(scopes)) {
  const call = calls.get(factory);
  assert.equal(call.arguments.length, 1);
  assert.deepEqual(
    call.arguments[0].properties.map((p) => p.key.name),
    names,
  );
  for (const property of call.arguments[0].properties) {
    assert.equal(property.type, "Property");
    assert.equal(property.kind, "get", "retain actual callback/service identities through lazy getters");
    assert.equal(property.value.body.body.length, 1);
    assert.equal(property.value.body.body[0].argument.name, property.key.name);
  }
}
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents:
        "export * from './app_view_contexts.js'; export { WriterState } from './state.js'; export { localSaveText, savedCaseState } from './saved_work.js'; export { workspaceQueue } from './workspace_queue.js';",
      resolveDir: directory,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(build) {
          build.onResolve({ filter: /\/data\// }, (args) => ({ path: path.join(root, "build/generated/modules/data", path.basename(args.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const api = box.exports,
    state = api.WriterState;
  assert.deepEqual(state, {}, "view imports must not boot Writer, storage or browser services");
  const unavailable = new Proxy(
    {},
    {
      get(_, key) {
        throw new Error("eager context read: " + String(key));
      },
    },
  );
  for (const name of Object.keys(scopes)) api[name](unavailable);
  assert.deepEqual(state, {}, "context construction is inert");
  const refs = Object.fromEntries(
    [...new Set(Object.values(scopes).flat())].map((name) => [
      name,
      () => {
        throw new Error("context invoked service " + name);
      },
    ]),
  );
  Object.assign(refs, {
    A11Y: {},
    CASEDIR_EXPECT: "Case JSON Files",
    COMMITTED: new Set(),
    recordIntegrity: { status: () => ({ valid: false }) },
    snow: { is: () => false },
  });
  const builders = Object.fromEntries(
    Object.entries(scopes).map(([name, allowed]) => [
      name,
      api[name](
        new Proxy(
          {},
          {
            get(_, key) {
              assert.ok(allowed.includes(key), name + " reads " + String(key));
              return refs[key];
            },
          },
        ),
      ),
    ]),
  );
  const firstCase = { id: "case", number: "QA-VIEW" },
    firstState = { screen: "cases" };
  Object.assign(state, {
    CASES: [firstCase],
    DOCS: [],
    REINSP: [],
    EVENTS: {},
    CASEDIR: null,
    NEEDGRANT: true,
    LOCAL_SAVE: { ok: true, saving: false, at: "saved" },
    PENDING: [],
    CATALOG_AT: "first",
    CATALOG_ERROR: "",
    CATALOG_FROM_CACHE: false,
    ARTIFACT_LOCATIONS: {},
    state: firstState,
  });
  const saved = builders.createSavedWorkContext(),
    queue = builders.createWorkspaceQueueContext(),
    language = builders.createLanguageDiscoveryContext();
  assert.deepEqual(Object.keys(saved), [
    "A11Y",
    "CASEDIR",
    "CASEDIR_EXPECT",
    "CASES",
    "CATALOG_AT",
    "COMMITTED",
    "DIRNAME",
    "HELPER",
    "LOCAL_SAVE",
    "NEEDGRANT",
    "PENDING",
    "PREFLIGHT_CONFLICT",
    "caseFileName",
    "caseState",
    "caseUnsaved",
    "deliveredByCitation",
    "docsFor",
    "draftTimer",
    "esc",
    "kase",
    "pdfTransferState",
    "recordIntegrity",
    "recoveryStatusHTML",
    "storageMode",
    "summaryName",
  ]);
  assert.deepEqual(Object.keys(queue), [
    "ARTIFACT_LOCATIONS",
    "CASEDIR",
    "NEEDGRANT",
    "PREFLIGHT_CONFLICT",
    "caseNumberAllowed",
    "docsFor",
    "esc",
    "pdfTransferState",
    "recordIntegrity",
    "snow",
  ]);
  assert.deepEqual(Object.keys(language), [
    "CATALOG_AT",
    "CATALOG_ERROR",
    "CATALOG_FROM_CACHE",
    "LIBRARY",
    "allItems",
    "catalogItem",
    "catalogKey",
    "catalogReviewPanel",
    "catalogStatus",
    "catalogVisible",
    "checkAttr",
    "doc",
    "effectiveCatalog",
    "esc",
    "itemLibraryKey",
    "markBlanks",
    "shell",
    "state",
  ]);
  assert.equal(saved.caseState, refs.caseState);
  assert.equal(saved.storageMode, refs.storageMode);
  assert.equal(saved.A11Y, refs.A11Y);
  assert.equal(saved.COMMITTED, refs.COMMITTED);
  assert.equal(queue.pdfTransferState, saved.pdfTransferState);
  assert.equal(queue.recordIntegrity, saved.recordIntegrity);
  assert.equal(language.shell, refs.shell);
  assert.equal(language.state, firstState);
  assert.equal(api.localSaveText(saved), "Saved on this device");
  const oldCases = saved.CASES,
    oldSave = saved.LOCAL_SAVE;
  state.CASES = [{ id: "restored", number: "QA-RESTORED" }];
  state.LOCAL_SAVE = { ok: false, saving: false };
  state.PENDING = [{ cid: "restored" }];
  state.CASEDIR = { helper: true };
  state.NEEDGRANT = false;
  state.state = { screen: "library", q: "updated" };
  state.CATALOG_AT = "restored";
  state.CATALOG_ERROR = "offline";
  state.CATALOG_FROM_CACHE = true;
  state.ARTIFACT_LOCATIONS = { retained: "outbox" };
  const next = builders.createSavedWorkContext(),
    nextQueue = builders.createWorkspaceQueueContext(),
    nextLanguage = builders.createLanguageDiscoveryContext();
  assert.equal(saved.CASES, oldCases);
  assert.equal(saved.LOCAL_SAVE, oldSave, "existing contexts retain their original reference values");
  assert.equal(next.CASES, state.CASES);
  assert.equal(next.LOCAL_SAVE, state.LOCAL_SAVE);
  assert.equal(next.PENDING, state.PENDING);
  assert.equal(nextQueue.ARTIFACT_LOCATIONS, state.ARTIFACT_LOCATIONS);
  assert.equal(nextQueue.CASEDIR, state.CASEDIR);
  assert.equal(nextLanguage.state, state.state);
  assert.equal(nextLanguage.CATALOG_AT, "restored");
  assert.equal(nextLanguage.CATALOG_FROM_CACHE, true);
  assert.equal(nextLanguage.CATALOG_ERROR, "offline");
  assert.equal(nextLanguage.LIBRARY, language.LIBRARY);
  assert.equal(api.localSaveText(next), "Not saved — keep this tab open");
  assert.equal(saved.kase("restored"), state.CASES[0], "retained query callbacks still read current workspace arrays");
  refs.caseState = () => ({ draft: null });
  const reviewed = builders.createSavedWorkContext();
  assert.equal(reviewed.caseState, refs.caseState, "service getters resolve at context call time");
  assert.equal(api.savedCaseState(reviewed, state.CASES[0]).action, "integrity");
  const blocked = api.workspaceQueue([{ k: state.CASES[0], st: { draft: null } }], [], builders.createWorkspaceQueueContext())[0];
  assert.equal(blocked.priority, 0);
  assert.equal(blocked.label, "Review record problem");
  refs.recordIntegrity = { status: () => ({ valid: true }) };
  state.PREFLIGHT_CONFLICT = { cid: "restored" };
  const conflict = api.workspaceQueue([{ k: state.CASES[0], st: { draft: null } }], [], builders.createWorkspaceQueueContext())[0];
  assert.equal(conflict.label, "Review shared changes");
  assert.equal(builders.createSavedWorkContext().recordIntegrity, refs.recordIntegrity);
  console.log(
    JSON.stringify({
      passed: true,
      scopedViews: 3,
      lazyComposition: true,
      callbackIdentity: true,
      restoredState: true,
      retainedPresentationGuards: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
