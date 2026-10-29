/* Real deposit/edit/pricing/court/face owners, with native UI/save and non-snow adapters controlled at their boundaries. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");
module.exports = async function createCitationDepositWorkflow() {
  const built = await esbuild.build({
      stdin: {
        contents: `
    export {WriterState} from './state.js';
    export * as policy from './citation_policy.js';
    export * as calendar from './calendar.js';
    export * as format from './presentation_format.js';
    export {agentLines} from './address_format.js';
    export * as queries from './writer_queries.js';
    export {recordDay} from '../assets/shared.js';
    export {inspAt} from './inspection_facts.js';
    export {createEditorScreens} from './editor_screens.js';
    export {initRecordIntegrity} from './record_integrity.js';
    export {initReviewedLibrary} from './reviewed_library.js';
    export {initCitationPricing} from './citation_pricing.js';
    export {initDepositStep} from './deposit_step.js';
    export {initInitialCitations} from './initial_citations.js';
    export {createCitationCharges,lookupForf,chargeChoices,choosesCharge,feeLines} from './citation_charges.js';
    export {createCitationWorkflow} from './citation_workflow.js';
    export {createCourtScheduling} from './court_scheduling.js';
    export {createCitationHistory} from './citation_history.js';
    export {createCitationDrafts} from './citation_drafts.js';
    export {createDocumentRenderer} from './document_render.js';
    export {createDocumentPrinting} from './document_printing.js';
    export {TEST_CASES} from './test_fixtures.js';`,
        resolveDir: path.resolve("app/modules"),
      },
      bundle: true,
      write: false,
      format: "cjs",
      define: { __TEST_BUILD__: "false" },
      plugins: [
        {
          name: "data",
          setup(b) {
            b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
          },
        },
      ],
    }),
    box = { exports: {} };
  const today = new Date();
  new Function("module", "exports", "today", built.outputFiles[0].text)(box, box.exports, today);
  const a = box.exports,
    s = a.WriterState,
    quiet = () => {};
  assert.deepEqual(s, {}, "feature imports must not run Writer startup");
  Object.assign(s, {
    CASES: structuredClone(a.TEST_CASES),
    DOCS: [],
    REINSP: [],
    EVENTS: {},
    PENDING: [],
    SAVE_CHECKPOINTS: {},
    RECORD_ATTEMPTS: {},
    seq: 100,
    state: { screen: "cases", docId: null },
    WORK: { entry: {}, recordForms: {} },
    HELPER: null,
    CASEDIR: null,
  });
  const uid = (prefix) => prefix + ++s.seq + "-citation-test",
    snow = { is: () => false, isCase: () => false, prepare: quiet },
    isLocked = () => false;
  const libraryReview = a.initReviewedLibrary(),
    recordIntegrity = a.initRecordIntegrity({ kase: a.queries.kase });
  const citationPricingDate = (c, d) => a.policy.citationPricingDate(c, d, a.inspAt(d).date);
  const pricing = a.initCitationPricing({
    inspAt: a.inspAt,
    lookupForf: a.lookupForf,
    toast: quiet,
    renderKeep: quiet,
    citationPricingDate,
    isLocked,
    libraryReview,
    snow,
  });
  const charges = a.createCitationCharges({ citationPricing: pricing, citationPricingDate, document });
  const depositStep = a.initDepositStep({ citationPricing: pricing, citationPricingDate });
  const court = a.createCourtScheduling({ today, nowMillis: () => Date.now(), random: () => Math.random() });
  const history = a.createCitationHistory({ today }),
    drafts = a.createCitationDrafts({ priorCitations: history.priorCitations });
  let initialCitations;
  const workflow = a.createCitationWorkflow({
    citationPricing: pricing,
    citationPricingDate,
    depositStep,
    get initialCitations() {
      return initialCitations;
    },
    initialOrderCitation: () => false,
    isLocked,
    snow,
    applyDeposit: charges.applyDeposit,
    changeCharge: charges.changeCharge,
    chargeChoices: a.chargeChoices,
    choosesCharge: a.choosesCharge,
    feeLines: a.feeLines,
    fmtDate: a.format.fmtDate,
    today,
  });
  const renderer = a.createDocumentRenderer({
    agentLines: a.agentLines,
    docCase: a.queries.docCase,
    docInsp: a.queries.docInsp,
    snow,
    inspAt: a.inspAt,
    fmtDate: a.format.fmtDate,
    fmtTime: a.format.fmtTime,
    longDate: a.format.longDate,
    parseTime: a.calendar.parseTime,
  });
  initialCitations = a.initInitialCitations({
    libraryReview,
    uid,
    inspAt: a.inspAt,
    citationNumber: court.citationNumber,
    nextCourtDate: court.nextCourtDate,
    citationTier: drafts.citationTier,
    fmtDate: a.format.fmtDate,
    applyDeposit: charges.applyDeposit,
    citationPricing: pricing,
    citationReview: workflow.citationReview,
    citationFaces: renderer.citationFaces,
    editorSync: quiet,
  });
  const editor = a.createEditorScreens({
    record: { snow, recordIntegrity },
    edit: { uid, saveDrafts: async () => true },
    ui: { render: quiet, toast: quiet },
  });
  const printing = a.createDocumentPrinting({ citationDepositFault: workflow.citationDepositFault });
  return {
    WriterState: s,
    today,
    recordDay: a.recordDay,
    addDays: a.calendar.addDays,
    doc: a.queries.doc,
    newDoc: editor.newDoc,
    initialCitations,
    depositStep,
    resolveCitationAmount: a.policy.resolveCitationAmount,
    formatDeposit: a.policy.formatDeposit,
    canonicalOrdinance: a.policy.canonicalOrdinance,
    policyAt: a.policy.policyAt,
    editCitation: workflow.editCitation,
    citationReview: workflow.citationReview,
    citationDepositFault: workflow.citationDepositFault,
    citationFaces: renderer.citationFaces,
    printJob: printing.printJob,
  };
};
