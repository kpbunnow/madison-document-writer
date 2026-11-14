/* Real shared-case comparison and workspace patch staging (the language catalog owner), with the real record
   integrity, working-papers and draft-persistence owners. Browser storage (idbSet) and every other peer are bounded:
   a test supplies them through `bound`, or a use fails naming the service. Each call evaluates fresh modules, so
   module state, WriterState and the DOM are new; no Writer startup runs and no test hook is used. */
const { compileOwner } = require("./mutation_outcome.cjs");
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom"),
  createBoundedServices = require("./bounded_services.cjs");

module.exports = async function createSharedCaseWorkflow() {
  const built = await esbuild.build({
    stdin: {
      contents: `
    export {WriterState} from './state.js';
    export {createLanguageCatalog} from './language_catalog.js';
    export {initRecordIntegrity} from './record_integrity.js';
    export {createWorkingPapers} from './working_papers.js';
    export {createDraftPersistence} from './draft_persistence.js';
    export {project} from './case_records.js';
    export {kase} from './writer_queries.js';
    export {clone} from './record_values.js';
    export {IDB_OK} from './app_base.js';`,
      resolveDir: path.resolve(__dirname, "../../app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    define: { __TEST_BUILD__: "true" },
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({
            path: path.resolve(__dirname, "../../build/generated/modules/data", path.basename(a.path)),
          }));
        },
      },
    ],
  });
  const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
    url: "http://127.0.0.1:8777",
    pretendToBeVisual: true,
  });
  global.window = dom.window;
  global.document = dom.window.document;
  let text = built.outputFiles[0].text;
  // A deliberate regression for tests/unit/audit_owner_migration_mutations.js: one exact source edit, applied once.
  if (process.env.DW_WORKFLOW_MUTATION) {
    const { find, replace } = JSON.parse(process.env.DW_WORKFLOW_MUTATION);
    assert.equal(text.split(find).length - 1, 1, "the mutation applies exactly once: " + find);
    text = text.replace(find, () => replace);
  }
  const box = { exports: {} };
  compileOwner(text)(new Date(), box, box.exports);
  const a = box.exports,
    s = a.WriterState;
  assert.deepEqual(s, {}, "loading the owners must not run Writer startup");
  // The initial values app_core.js assigns to the fields these owners read; a test changes them as before.
  Object.assign(s, {
    CASES: [],
    DOCS: [],
    REINSP: [],
    state: { acc: null, screen: "cases", docId: null, reinspId: null, modal: null },
    DIRTY: false,
    EVENTS: {},
    SAVE_CHECKPOINTS: {},
    CASEDIR: null,
    PENDING: [],
    LOCAL_SAVE: { ok: true, at: "", saving: false },
    LOCAL_CHANGED: 0,
    RECORD_ATTEMPTS: {},
    WORK: { entry: {}, acc: null, recordForms: {} },
    LOCAL_SAVE_CHAIN: Promise.resolve(),
    WORK_PATCH: null,
  });
  const { bound, calls, peer, group } = createBoundedServices({
    render: () => {},
    toast: () => {},
    scheduleRecoveryBackup: () => {},
  });
  // Core-owned constants these scenarios never read; reading one fails naming it.
  const unboundedValue = (name) => {
    throw new Error("owner workflow: unbounded service " + name);
  };
  const recordIntegrity = a.initRecordIntegrity({ kase: a.kase });
  const workingPapers = a.createWorkingPapers({
    ensureWalkContext: peer("ensureWalkContext"),
    ENTRY_IDS: ["lookup-number"],
    document,
    recordFormKey: peer("recordFormKey"),
  });
  const drafts = a.createDraftPersistence({
    recordIntegrity,
    captureWork: workingPapers.captureWork,
    updateSaveStatus: peer("updateSaveStatus"),
    scheduleRecoveryBackup: peer("scheduleRecoveryBackup"),
    IDB_OK: a.IDB_OK,
    idbGet: peer("idbGet"),
    idbSet: peer("idbSet"),
    project: a.project,
    render: peer("render"),
    toast: peer("toast"),
  });
  const catalog = a.createLanguageCatalog({
    allItems: peer("allItems"),
    toast: peer("toast"),
    helperJSON: peer("helperJSON"),
    idbSet: peer("idbSet"),
    loadCaseFile: peer("loadCaseFile"),
    project: a.project,
    rememberSaved: peer("rememberSaved"),
    caseUnsaved: peer("caseUnsaved"),
    draftBundle: drafts.draftBundle,
    saveCaseFile: peer("saveCaseFile"),
    saveDrafts: peer("saveDrafts"),
    clearWalk: peer("clearWalk"),
    captureWork: workingPapers.captureWork,
    catalogKey: peer("catalogKey"),
    recoveryCaseKey: peer("recoveryCaseKey"),
    recoverySnapshot: peer("recoverySnapshot"),
    scheduleRecoveryBackup: peer("scheduleRecoveryBackup"),
    render: peer("render"),
    A11Y: group("A11Y"),
    get RECOVERY_WORKSPACE() {
      return unboundedValue("RECOVERY_WORKSPACE");
    },
    get WORKFLOW_PREFS_KEY() {
      return unboundedValue("WORKFLOW_PREFS_KEY");
    },
    navigation: group("navigation"),
    recordIntegrity,
    app_savedworkContext: peer("app_savedworkContext"),
    refreshSheet: peer("refreshSheet"),
  });
  return { WriterState: s, catalog, drafts, recordIntegrity, bound, calls, clone: a.clone };
};
