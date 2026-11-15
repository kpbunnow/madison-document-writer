/* Real Accela import owner composed with the real owners its outcomes depend on: snow cases, citation pricing,
   court numbering, record integrity and the editor's document creation. Every other peer is a bounded service:
   the test supplies it through `bound`, or a use of it fails naming the service. Each call evaluates a fresh copy of
   the modules, so module state, WriterState and the DOM are new; no Writer startup runs and no test hook is used. */
const { compileOwner } = require("./mutation_outcome.cjs");
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom"),
  createBoundedServices = require("./bounded_services.cjs");

// app_core.js owns the import screen's entry fields; the working-papers owner is given the same list.
const ENTRY_IDS = ["lookup-number"];
assert.ok(
  fs
    .readFileSync(path.resolve(__dirname, "../../app/modules/app_core.js"), "utf8")
    .includes("export const ENTRY_IDS = " + JSON.stringify(ENTRY_IDS) + ";"),
  "the import entry fields match app_core.js",
);

let compiled = null;
async function moduleText() {
  if (compiled) return compiled;
  const built = await esbuild.build({
    stdin: {
      contents: `
    export {WriterState} from './state.js';
    export {createAccelaImport} from './accela_import.js';
    export {initSnow} from './snow_cases.js';
    export {initCitationPricing} from './citation_pricing.js';
    export {initReviewedLibrary} from './reviewed_library.js';
    export {initRecordIntegrity} from './record_integrity.js';
    export {createCourtScheduling} from './court_scheduling.js';
    export {createEditorScreens} from './editor_screens.js';
    export {createWorkingPapers} from './working_papers.js';
    export {createCaseLoading} from './case_loading.js';
    export {createCaseFolderWorkflow} from './case_folder_workflow.js';
    export {createWorksheetWorkflow} from './worksheet_workflow.js';
    export {createCaseStatus} from './case_status.js';
    export {createReinspectionEntry} from './reinspection_entry.js';
    export {initNewDocuments} from './new_documents.js';
    export {createImportEvents} from './import_events.js';
    export {createWorkspaceEvents} from './workspace_events.js';
    export {createRecoveryEvents} from './recovery_events.js';
    export {evid} from './record_event_log.js';
    export {createReinspection} from './reinspection.js';
    export {itemHistory, itemInspectionHistory} from './inspection_history.js';
    export {parseTime} from './calendar.js';
    export {dueContext, dueDateSpacingConflicts} from './deadline_assignment.js';
    export {initAddressParser} from './address_parser.js';
    export {createRecipientWorkflow} from './recipient_workflow.js';
    export {initTestFixtures} from './test_fixtures.js';
    export {createVisitRecording} from './visit_recording.js';
    export {appendEvent} from './record_event_log.js';
    export {project, caseFile, rememberSaved} from './case_records.js';
    export {caseFileName} from './case_file_rules.js';
    export {lookupForf} from './citation_charges.js';
    export {citationPricingDate} from './citation_policy.js';
    export {inspAt, sameInspection} from './inspection_facts.js';
    export * as queries from './writer_queries.js';
    export {fmtDate, fmtTime} from './presentation_format.js';
    export {validISO, addDays, iso} from './calendar.js';
    export {uid, COMMITTED, MINDUE} from './app_base.js';
    export {clone, stableJSON} from './record_values.js';
    export {INSPECTORS} from './data/inspectors.js';
    export {recordDay} from '../assets/shared.js';`,
      resolveDir: path.resolve(__dirname, "../../app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    // The test build the migrated suites ran against: the helper transport accepts a missing session token.
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
  compiled = built.outputFiles[0].text;
  // A deliberate regression for tests/unit/audit_owner_migration_mutations.js: one exact source edit, applied once.
  if (process.env.DW_WORKFLOW_MUTATION) {
    const { find, replace } = JSON.parse(process.env.DW_WORKFLOW_MUTATION);
    assert.equal(compiled.split(find).length - 1, 1, "the mutation applies exactly once: " + find);
    compiled = compiled.replace(find, () => replace);
  }
  return compiled;
}

const DOM = '<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>';

module.exports = async function createImportWorkflow({ today = new Date(), html = DOM } = {}) {
  const dom = new JSDOM(html, { url: "http://127.0.0.1:8777/", pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.getSelection = () => dom.window.getSelection();
  dom.window.scrollTo = () => {};
  const box = { exports: {} };
  compileOwner(await moduleText())(today, box, box.exports);
  const a = box.exports,
    s = a.WriterState;
  assert.deepEqual(s, {}, "loading the owners must not run Writer startup");
  // The initial values app_core.js assigns to the fields these owners read; a test changes them as before.
  Object.assign(s, {
    CASES: [],
    DOCS: [],
    REINSP: [],
    state: { acc: null, screen: "cases", docId: null, reinspId: null, modal: null, q: "" },
    seq: 100,
    DIRTY: false,
    HELPER: null,
    EVENTS: {},
    SAVE_CHECKPOINTS: {},
    CASEDIR: null,
    PENDING: [],
    RECORD_ATTEMPTS: {},
    WORK: { entry: {}, acc: null, recordForms: {} },
    LOOKUP_BUSY: false,
    LOOKUP_ERROR: "",
    LOOKUP_CONTROLLER: null,
    LOOKUP_SERIAL: 0,
    ACC_SELECTION_SERIAL: 0,
  });
  const toasts = [];
  /* Bounded peers. A test replaces any of them at any time; every owner reads them when called. */
  const { bound, calls, peer, group, partial } = createBoundedServices({
    render: () => {},
    renderKeep: () => {},
    refreshSheet: () => {},
    saveDrafts: async () => true,
    scheduleDraftSave: () => {},
    toast: (message) => toasts.push(message),
    isLocked: () => false,
    // Filed-PDF location display refresh after a case merge; these scenarios file no PDFs.
    refreshArtifactLocations: async () => {},
  });
  const court = a.createCourtScheduling({ today, nowMillis: () => Date.now(), random: () => Math.random() });
  const recordIntegrity = a.initRecordIntegrity({ kase: a.queries.kase }),
    libraryReview = a.initReviewedLibrary();
  let snow = null;
  const citationPricing = a.initCitationPricing({
    inspAt: a.inspAt,
    lookupForf: a.lookupForf,
    toast: peer("toast"),
    renderKeep: peer("renderKeep"),
    citationPricingDate: (c, d) => a.citationPricingDate(c, d, a.inspAt(d).date),
    isLocked: peer("isLocked"),
    libraryReview,
    get snow() {
      return snow;
    },
  });
  snow = a.initSnow({
    citationNumber: court.citationNumber,
    fmtDate: a.fmtDate,
    nextCourtDate: court.nextCourtDate,
    toast: peer("toast"),
    validISO: a.validISO,
    helperJSON: peer("helperJSON"),
    saveDrafts: peer("saveDrafts"),
    scheduleDraftSave: peer("scheduleDraftSave"),
    renderKeep: peer("renderKeep"),
    render: peer("render"),
    refreshSheet: peer("refreshSheet"),
    citationPricing,
    initialCitations: group("initialCitations"),
    isLocked: peer("isLocked"),
    uid: a.uid,
  });
  const editor = a.createEditorScreens({
    record: { snow, recordIntegrity },
    edit: { uid: a.uid, saveDrafts: peer("saveDrafts") },
    ui: { render: peer("render"), toast: peer("toast") },
  });
  let newDocuments = null,
    reinspection = null;
  const worksheets = a.createWorksheetWorkflow({
    sourceDocFor: a.queries.sourceDocFor,
    today,
    dueCheck: (...args) => reinspection.dueCheck(...args),
    saveDrafts: peer("saveDrafts"),
    render: peer("render"),
    toast: peer("toast"),
    clearWalk: (...args) => reinspection.clearWalk(...args),
  });
  const caseStatus = a.createCaseStatus({ snow, today, unissuedVisitFor: worksheets.unissuedVisitFor });
  const caseLoading = a.createCaseLoading({
    toast: peer("toast"),
    recordIntegrity,
    render: peer("render"),
    saveDrafts: peer("saveDrafts"),
    refreshArtifactLocations: peer("refreshArtifactLocations"),
  });
  const caseFolders = a.createCaseFolderWorkflow({
    toast: peer("toast"),
    grantCaseFolder: peer("grantCaseFolder"),
    summarize: peer("summarize"),
    writeIndexFile: peer("writeIndexFile"),
    render: peer("render"),
    recordIntegrity,
    loadCaseFile: caseLoading.loadCaseFile,
  });
  const workingPapers = a.createWorkingPapers({
    ensureWalkContext: (...args) => reinspection.ensureWalkContext(...args),
    ENTRY_IDS,
    document,
    recordFormKey: peer("recordFormKey"),
  });
  const addressParser = a.initAddressParser({
    toast: peer("toast"),
    helperJSON: peer("helperJSON"),
    saveDrafts: peer("saveDrafts"),
    render: peer("render"),
    A11Y: group("A11Y"),
    recordIntegrity,
    uid: a.uid,
  });
  const recipients = a.createRecipientWorkflow({ addressParser, render: peer("render") });
  /* Issuance through the test build's own issue path: real address validation, event log and projection. Print
     sources are the one boundary (the document body is composed in app_core.js); a stand-in snapshot is recorded. */
  bound.freezeSources = (d) => ({ boundary: "print sources", docId: d.id, items: a.clone(d.items || []) });
  const visits = a.createVisitRecording({
    appendEvent: a.appendEvent,
    saveDrafts: peer("saveDrafts"),
    toast: peer("toast"),
    fmtDate: a.fmtDate,
    render: peer("render"),
  });
  const issuance = a.initTestFixtures({
    fmtDate: a.fmtDate,
    freezeSources: peer("freezeSources"),
    toast: peer("toast"),
    appendEvent: a.appendEvent,
    project: a.project,
    saveDrafts: peer("saveDrafts"),
    validateAndStandardizeAddresses: recipients.validateAndStandardizeAddresses,
    recordReinspection: visits.recordReinspection,
    startCorrection: peer("startCorrection"),
    render: peer("render"),
    MINDUE: a.MINDUE,
  });
  const reinspectionEntry = a.createReinspectionEntry({
    snow,
    recordIntegrity,
    clearWalk: (...args) => reinspection.clearWalk(...args),
    restoreWalkFor: (...args) => reinspection.restoreWalkFor(...args),
    get newDocuments() {
      return newDocuments;
    },
    uid: a.uid,
    saveDrafts: peer("saveDrafts"),
    render: peer("render"),
    sourceDocFor: a.queries.sourceDocFor,
    unissuedVisitFor: worksheets.unissuedVisitFor,
    today,
    toast: peer("toast"),
  });
  newDocuments = a.initNewDocuments({
    fmtDate: a.fmtDate,
    inspAt: a.inspAt,
    toast: peer("toast"),
    validISO: a.validISO,
    evid: a.evid,
    shell: peer("shell"),
    sourceDocFor: a.queries.sourceDocFor,
    saveDrafts: peer("saveDrafts"),
    scheduleDraftSave: peer("scheduleDraftSave"),
    screenCases: peer("screenCases"),
    renderKeep: peer("renderKeep"),
    render: peer("render"),
    commitRecordAttempt: peer("commitRecordAttempt"),
    worksheetFaults: worksheets.worksheetFaults,
    newDoc: editor.newDoc,
    docFromReinspection: (...args) => reinspection.docFromReinspection(...args),
    refreshSheet: peer("refreshSheet"),
    docBody: peer("docBody"),
    isLocked: peer("isLocked"),
    snow,
    uid: a.uid,
  });
  let importer = null;
  reinspection = a.createReinspection({
    ui: {
      toast: peer("toast"),
      shell: peer("shell"),
      renderKeep: peer("renderKeep"),
      screenCases: peer("screenCases"),
      render: peer("render"),
    },
    inspection: {
      fmtDate: a.fmtDate,
      inspAt: a.inspAt,
      parseTime: a.parseTime,
      validISO: a.validISO,
      checks: peer("checks"),
      captureWork: workingPapers.captureWork,
      itemHistory: a.itemHistory,
      itemInspectionHistory: a.itemInspectionHistory,
      worksheetFaults: worksheets.worksheetFaults,
      returnToWorksheet: worksheets.returnToWorksheet,
      dueContext: a.dueContext,
      dueDateSpacingConflicts: a.dueDateSpacingConflicts,
      duePanel: peer("duePanel"),
      isLocked: peer("isLocked"),
      uid: a.uid,
      openImportWorkspace: (...args) => importer.openImportWorkspace(...args),
    },
    authoring: {
      applyDeposit: peer("applyDeposit"),
      citationNumber: court.citationNumber,
      nextCourtDate: court.nextCourtDate,
      scheduleDraftSave: peer("scheduleDraftSave"),
      validateAndStandardizeAddresses: recipients.validateAndStandardizeAddresses,
      saveDrafts: peer("saveDrafts"),
      get newDocuments() {
        return newDocuments;
      },
      MINDUE: a.MINDUE,
      depositStep: group("depositStep"),
    },
  });
  importer = a.createAccelaImport({
    fmtTime: a.fmtTime,
    fmtDate: a.fmtDate,
    toast: peer("toast"),
    snow,
    uid: a.uid,
    citationPricing,
    COMMITTED: a.COMMITTED,
    newDoc: editor.newDoc,
    sourceDocFor: a.queries.sourceDocFor,
    loadCaseFile: caseLoading.loadCaseFile,
    helperJSON: peer("helperJSON"),
    shell: peer("shell"),
    unissuedVisitFor: worksheets.unissuedVisitFor,
    caseState: caseStatus.caseState,
    render: peer("render"),
    scheduleDraftSave: peer("scheduleDraftSave"),
    listCaseFolder: caseFolders.listCaseFolder,
    saveDrafts: peer("saveDrafts"),
    startReinspection: reinspectionEntry.startReinspection,
    captureWork: workingPapers.captureWork,
    preflightCase: peer("preflightCase"),
  });
  // Registered as app_core.js registers them, after the lookup state exists.
  const importEvents = a.createImportEvents({
    accelaFromShare: importer.accelaFromShare,
    accelaPlan: importer.accelaPlan,
    acceptAccela: importer.acceptAccela,
    cancelCaseLookup: importer.cancelCaseLookup,
    confirmDatabaseCase: importer.confirmDatabaseCase,
    findDatabaseCase: importer.findDatabaseCase,
    openImportWorkspace: importer.openImportWorkspace,
    preflightCase: peer("preflightCase"),
    render: peer("render"),
    renderKeep: peer("renderKeep"),
    saveDrafts: peer("saveDrafts"),
    scheduleDraftSave: peer("scheduleDraftSave"),
    selectImportInspection: importer.selectImportInspection,
  });
  importEvents.registerLookupSubmit();
  importEvents.registerLookupClicks();
  /* The workspace click router routes the import screen's buttons (case, candidate, Import, Cancel) through its own
     action table. Only the import events are composed; any other route it reaches fails as unbounded. */
  const workspaceEvents = a.createWorkspaceEvents({
    ui: partial("ui", { captureWork: workingPapers.captureWork }),
    events: partial("events", { importEvents }),
    cases: group("cases"),
  });
  workspaceEvents.registerWorkspaceClicks();
  // The working-entry listeners record typed and cleared import fields, registered in app_core.js's order.
  const recoveryEvents = a.createRecoveryEvents({
    ui: partial("ui", {
      captureWork: workingPapers.captureWork,
      render: peer("render"),
      scheduleDraftSave: peer("scheduleDraftSave"),
      toast: peer("toast"),
    }),
    recovery: partial("recovery", { ENTRY_IDS, recordFormKey: peer("recordFormKey") }),
    publication: group("publication"),
  });
  recoveryEvents.registerWorkingInput();
  recoveryEvents.registerWorkingChange();
  return {
    window: dom.window,
    WriterState: s,
    importer,
    snow,
    citationPricing,
    recordIntegrity,
    newDoc: editor.newDoc,
    captureWork: workingPapers.captureWork,
    issueDocument: issuance.issueDocument,
    COMMITTED: a.COMMITTED,
    caseFile: a.caseFile,
    caseFileName: a.caseFileName,
    rememberSaved: a.rememberSaved,
    docFromReinspection: reinspection.docFromReinspection,
    reinspection,
    startReinspection: reinspectionEntry.startReinspection,
    caseState: caseStatus.caseState,
    unissuedVisitFor: worksheets.unissuedVisitFor,
    uid: a.uid,
    bound,
    calls,
    toasts,
    today,
    INSPECTORS: a.INSPECTORS,
    recordDay: a.recordDay,
    addDays: a.addDays,
    iso: a.iso,
    clone: a.clone,
    fmtDate: a.fmtDate,
    fmtTime: a.fmtTime,
    stableJSON: a.stableJSON,
    sameInspection: a.sameInspection,
    queries: a.queries,
  };
};
