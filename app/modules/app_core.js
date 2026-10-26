import { createWorkspaceDatabase } from "./workspace_database.js";
import { createDraftPersistence } from "./draft_persistence.js";
import { createCorrectionPreparation } from "./correction_preparation.js";
import { createCorrectionWorkflow } from "./correction_workflow.js";
import { createPublicationPreparation } from "./publication_preparation.js";
import { createPublicationWorkflow } from "./publication_workflow.js";
import { createRecordCommit } from "./record_commit.js";
import { createCitationWorkflow } from "./citation_workflow.js";
import { createItemSelection } from "./item_selection.js";
import { createWorkspaceTasks } from "./workspace_tasks.js";
import { createDeadlineAssignment, activeDueTarget, dueContext, dueSelectedText, dueDateSpacingConflicts } from "./deadline_assignment.js";
import { createWriterHandoff } from "./writer_handoff.js";
import { createPdfArtifacts, pdfTransferState } from "./pdf_artifacts.js";
import { inspAt } from "./inspection_facts.js";
import { createDocumentPagination } from "./document_pagination.js";
import { createUtilityEvents } from "./utility_events.js";
import { createRecoveryEvents } from "./recovery_events.js";
import { createCatalogEvents } from "./catalog_events.js";
import { createSafetyEvents } from "./safety_events.js";
import { createWorkflowEvents } from "./workflow_events.js";
import { createWorkspaceEvents } from "./workspace_events.js";
import { createCitationEvents } from "./citation_events.js";
import { createDueDateEvents } from "./due_date_events.js";
import { createImportEvents } from "./import_events.js";
import { createReinspectionEvents } from "./reinspection_events.js";
import { createEditorEvents } from "./editor_events.js";
import { createSpecialDocumentEvents } from "./special_document_events.js";
import { createCorrectionEvents } from "./correction_events.js";
import { createContactEvents } from "./contact_events.js";
import { BLOCKS, DOCBODY } from "./document_types.js";
import { frozenOf, specialType } from "./document_rules.js";
import { kase, doc, docsFor, reinspFor, correctionSource, docCase, docInsp, eventsFor } from "./writer_queries.js";
import { stableJSON } from "./record_values.js";
import { esc } from "./presentation_format.js";
import { parseDate, parseTime, validISO, addDays } from "./calendar.js";

import {
  feeLines,
  citationNumber,
  fmtDate,
  nextCourtDate,
  changeCharge as changeChargeBasis,
  chargeChoices,
  choosesCharge,
  applyDeposit,
  checks as dep_checks,
  freezeSources,
  lookupForf,
  activeBlocks,
  checkHelper,
  checks,
  emailDocument,
  filePdf,
  fillBlank,
  openIssuedCopy,
  printJob,
  rnd12,
  splitOwner,
  toast,
  toastUndo,
  fmtTime,
  longDate,
  allItems,
} from "./court_and_deposits.js";
import {
  shell,
  evid,
  caseFile,
  caseNumberAllowed,
  grantCaseFolder,
  helperJSON,
  linkCaseFolder,
  loadCaseFile,
  printNotice,
  testWrite,
  sourceDocFor,
  appendEvent,
  project,
  rememberSaved,
  mergeCaseEvents,
} from "./workspace_shell.js";
import { caseFileName } from "./case_file_rules.js";

import {
  updateSaveStatus,
  scheduleDraftSave,
  addCC,
  addEmail,
  bootStorage,
  caseUnsaved,
  clearCases,
  discardDraft,
  downloadFile,
  flushPending,
  listCaseFolder,
  openFromFolder,
  pickCaseFile,
  rebuildIndex,
  recipientPreview,
  removeCC,
  removeCase,
  removeEmail,
  saveCaseFile,
  writeSummary,
  standardCityStateZip,
  standardStreetAddress,
  startReinspection,
  validateAndStandardizeAddresses,
} from "./case_files.js";
import { createReinspection } from "./reinspection.js";
import { uiIcon, caseState, renderKeep, render, screenCases, overlayHTML, revealIssuedCase, focusIssuedCase } from "./app_screens.js";
import { createAccelaImport } from "./accela_import.js";
import {
  hasSetupWork,
  citationTier,
  addRecordNote,
  captureWork,
  citationFromNotice,
  itemHistory,
  itemInspectionHistory,
  needsInitialCitation,
  reconcileDocument,
  recordReinspection,
  runFinalize,
  voidDocument,
  commitRecordAttempt,
  documentItemHistory,
  revisionPrintNote,
  hasItemInspectionHistory,
  citationRecoveryPanel,
  correctionPanel,
  filingPanel,
  recordHistoryHTML,
} from "./issuance_and_corrections.js";
import {
  backupUnfinished,
  catalogKey,
  cleanVisit,
  changeVisitDate,
  discardWorksheet,
  downloadWorkspace,
  keepCatalogForms,
  listRecovery,
  recoveryJobs,
  recoveryWorkspace,
  restorePreviousDraft,
  restoreRecovery,
  restoreWorkspaceFile,
  returnToWorksheet,
  saveAndContinue,
  selectRecovery,
  validateRecovery,
  unissuedVisitFor,
  worksheetFaults,
  recoveryStatusHTML,
  recoveryCaseKey,
  recoverySnapshot,
  scheduleRecoveryBackup,
} from "./draft_recovery.js";
import { createLanguageCatalog } from "./language_catalog.js";
import { createCaseActivity, timelineCategory } from "./case_activity.js";

import { createEditorScreens } from "./editor_screens.js";

import { DEPOSITS } from "./data/deposits.js";
import { WriterState } from "./state.js";
// Approved wording lives in app/assets/approved_language.json (acceptance item L5).

import { createLanguageActions } from "./language_actions.js";
import { initSnow } from "./snow_cases.js";
import { initAdministration } from "./administration.js";
import { initReviewedLibrary } from "./reviewed_library.js";
import { SUMMARY_VERSION, recordDay } from "../assets/shared.js";

import { initNewDocuments } from "./new_documents.js";
import { initInitialCitations } from "./initial_citations.js";
import { initAddressParser } from "./address_parser.js";
import { initRecordIntegrity } from "./record_integrity.js";
import { initNavigation } from "./navigation.js";
import { createAccessibility } from "./accessibility.js";

import { citationPricingDate as policyCitationPricingDate } from "./citation_policy.js";
import { initDepositStep } from "./deposit_step.js";
import { initCitationPricing } from "./citation_pricing.js";

import { initTestFixtures, TEST_CASES as TEST_CASE_DATA } from "./test_fixtures.js";

import { createDocumentRenderer } from "./document_render.js";

import { createSavedWorkContext, createWorkspaceQueueContext, createLanguageDiscoveryContext } from "./app_view_contexts.js";

/* Editor copy-click registration precedes the existing feature-service registrations. Dependencies stay lazy. */
const editorScreens = createEditorScreens({
  checks: (...args) => checks(...args),
  fmtDate: (...args) => fmtDate(...args),
  toast: (...args) => toast(...args),
  shell: (...args) => shell(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  checkRowHTML: (...args) => checkRowHTML(...args),
  highlightOpenChecks: (...args) => highlightOpenChecks(...args),
  screenCases: (...args) => screenCases(...args),
  render: (...args) => render(...args),
  overlayHTML: (...args) => overlayHTML(...args),
  citationRecoveryPanel: (...args) => citationRecoveryPanel(...args),
  correctionEligibility: (...args) => correctionEligibility(...args),
  correctionPanel: (...args) => correctionPanel(...args),
  filingPanel: (...args) => filingPanel(...args),
  recordHistoryHTML: (...args) => recordHistoryHTML(...args),
  publicationPanel: (...args) => publicationPanel(...args),
  citationReview: (...args) => citationReview(...args),
  duePanel: (...args) => duePanel(...args),
  get initialCitations() {
    return initialCitations;
  },
  isLocked: (...args) => isLocked(...args),
  get newDocuments() {
    return newDocuments;
  },
  get recordIntegrity() {
    return recordIntegrity;
  },
  get snow() {
    return snow;
  },
  structEditable: (...args) => structEditable(...args),
  uid: (...args) => uid(...args),
  documentHTML: (...args) => documentHTML(...args),
  citationFaces: (...args) => citationFaces(...args),
  app_savedworkContext: (...args) => app_savedworkContext(...args),
  get A11Y() {
    return A11Y;
  },
  app_languagediscoveryContext: (...args) => app_languagediscoveryContext(...args),
  paginate: (...args) => paginate(...args),
});
export let {
  editorSync,
  renumber,
  moveItem,
  newDoc,
  reviewModalHTML,
  screenWrite,
  editorEnhance,
  refreshSheet,
  syncChip,
  refreshOverlay,
  enhanceDialog,
} = editorScreens;
const { editorReadiness, readinessText, readinessFirst, reviewConcernsHTML } = editorScreens;

export const snow = initSnow({
  citationNumber: (...args) => citationNumber(...args),
  fmtDate: (...args) => fmtDate(...args),
  nextCourtDate: (...args) => nextCourtDate(...args),
  toast: (...args) => toast(...args),
  validISO: (...args) => validISO(...args),
  helperJSON: (...args) => helperJSON(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  renderKeep: (...args) => renderKeep(...args),
  render: (...args) => render(...args),
  refreshSheet: (...args) => refreshSheet(...args),
  get citationPricing() {
    return citationPricing;
  },
  get initialCitations() {
    return initialCitations;
  },
  isLocked: (...args) => isLocked(...args),
  uid: (...args) => uid(...args),
});
export const administration = initAdministration({
  toast: (...args) => toast(...args),
  helperJSON: (...args) => helperJSON(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  render: (...args) => render(...args),
  get A11Y() {
    return A11Y;
  },
  get citationPricing() {
    return citationPricing;
  },
  isLocked: (...args) => isLocked(...args),
  get snow() {
    return snow;
  },
});
export const libraryReview = initReviewedLibrary();
export const newDocuments = initNewDocuments({
  fmtDate: (...args) => fmtDate(...args),
  inspAt: (...args) => inspAt(...args),
  toast: (...args) => toast(...args),
  validISO: (...args) => validISO(...args),
  evid: (...args) => evid(...args),
  shell: (...args) => shell(...args),
  sourceDocFor: (...args) => sourceDocFor(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  screenCases: (...args) => screenCases(...args),
  renderKeep: (...args) => renderKeep(...args),
  render: (...args) => render(...args),
  commitRecordAttempt: (...args) => commitRecordAttempt(...args),
  worksheetFaults: (...args) => worksheetFaults(...args),
  newDoc: (...args) => newDoc(...args),
  docFromReinspection: (...args) => docFromReinspection(...args),
  refreshSheet: (...args) => refreshSheet(...args),
  docBody: (...args) => docBody(...args),
  isLocked: (...args) => isLocked(...args),
  get snow() {
    return snow;
  },
  uid: (...args) => uid(...args),
});
export const citationPricing = initCitationPricing({
  inspAt: (...args) => inspAt(...args),
  lookupForf: (...args) => lookupForf(...args),
  toast: (...args) => toast(...args),
  renderKeep: (...args) => renderKeep(...args),
  citationPricingDate: (...args) => citationPricingDate(...args),
  isLocked: (...args) => isLocked(...args),
  get libraryReview() {
    return libraryReview;
  },
  get snow() {
    return snow;
  },
});
export const depositStep = initDepositStep({
  changeChargeBasis: (...args) => changeChargeBasis(...args),
  chargeChoices: (...args) => chargeChoices(...args),
  choosesCharge: (...args) => choosesCharge(...args),
  toast: (...args) => toast(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  saveAndContinue: (...args) => saveAndContinue(...args),
  citationDepositFault: (...args) => citationDepositFault(...args),
  render: (...args) => render(...args),
  get citationPricing() {
    return citationPricing;
  },
  citationPricingDate: (...args) => citationPricingDate(...args),
  isLocked: (...args) => isLocked(...args),
});
export const initialCitations = initInitialCitations({
  applyDeposit: (...args) => applyDeposit(...args),
  dep_checks: (...args) => dep_checks(...args),
  citationNumber: (...args) => citationNumber(...args),
  fmtDate: (...args) => fmtDate(...args),
  freezeSources: (...args) => freezeSources(...args),
  inspAt: (...args) => inspAt(...args),
  nextCourtDate: (...args) => nextCourtDate(...args),
  evid: (...args) => evid(...args),
  citationTier: (...args) => citationTier(...args),
  citationReview: (...args) => citationReview(...args),
  editorSync: (...args) => editorSync(...args),
  citationFaces: (...args) => citationFaces(...args),
  get citationPricing() {
    return citationPricing;
  },
  get libraryReview() {
    return libraryReview;
  },
  uid: (...args) => uid(...args),
});
export const navigation = initNavigation({
  toast: (...args) => toast(...args),
  shell: (...args) => shell(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  uiIcon: (...args) => uiIcon(...args),
  render: (...args) => render(...args),
  captureWork: (...args) => captureWork(...args),
  cancelCaseLookup: (...args) => cancelCaseLookup(...args),
  get WRITER_READY_WAIT() {
    return WRITER_READY_WAIT;
  },
});
const languageClick = createLanguageActions({
  catalogKey: (...args) => catalogKey(...args),
  keepCatalogForms: (...args) => keepCatalogForms(...args),
  catalogForm: (...args) => catalogForm(...args),
  catalogItem: (...args) => catalogItem(...args),
  catalogReview: (...args) => catalogReview(...args),
  refreshCatalog: (...args) => refreshCatalog(...args),
  render: (...args) => render(...args),
  refreshOverlay: (...args) => refreshOverlay(...args),
  get navigation() {
    return navigation;
  },
});
export const recordIntegrity = initRecordIntegrity({
  store: WriterState,
  kase: (...args) => kase(...args),
  doc: (...args) => doc(...args),
  esc: (...args) => esc(...args),
  helperJSON: (...args) => helperJSON(...args),
  render: () => render(),
});
export const addressParser = initAddressParser({
  toast: (...args) => toast(...args),
  helperJSON: (...args) => helperJSON(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  render: (...args) => render(...args),
  get A11Y() {
    return A11Y;
  },
  get recordIntegrity() {
    return recordIntegrity;
  },
  uid: (...args) => uid(...args),
});
const reinspection = createReinspection({
  fmtDate: (...args) => fmtDate(...args),
  inspAt: (...args) => inspAt(...args),
  parseTime: (...args) => parseTime(...args),
  toast: (...args) => toast(...args),
  validISO: (...args) => validISO(...args),
  checks: (...args) => checks(...args),
  applyDeposit: (...args) => applyDeposit(...args),
  citationNumber: (...args) => citationNumber(...args),
  nextCourtDate: (...args) => nextCourtDate(...args),
  shell: (...args) => shell(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  validateAndStandardizeAddresses: (...args) => validateAndStandardizeAddresses(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  captureWork: (...args) => captureWork(...args),
  itemHistory: (...args) => itemHistory(...args),
  itemInspectionHistory: (...args) => itemInspectionHistory(...args),
  worksheetFaults: (...args) => worksheetFaults(...args),
  returnToWorksheet: (...args) => returnToWorksheet(...args),
  dueContext: (...args) => dueContext(...args),
  dueDateSpacingConflicts: (...args) => dueDateSpacingConflicts(...args),
  duePanel: (...args) => duePanel(...args),
  renderKeep: (...args) => renderKeep(...args),
  screenCases: (...args) => screenCases(...args),
  render: (...args) => render(...args),
  isLocked: (...args) => isLocked(...args),
  get newDocuments() {
    return newDocuments;
  },
  MINDUE: (...args) => MINDUE(...args),
  get depositStep() {
    return depositStep;
  },
  uid: (...args) => uid(...args),
  openImportWorkspace: (...args) => openImportWorkspace(...args),
});
export let {
  walkIdentity,
  clearWalk,
  restoreWalkFor,
  ensureWalkContext,
  nextWalkItem,
  focusWalkItem,
  walkItemReady,
  advanceWalk,
  skipWalkDetails,
  returnWalkDetails,
  previousWalk,
  editableWalkItem,
  recordReinspectionOutcome,
  undoWalkOutcome,
  narrativeFor,
  attachCheckTargets,
  worksheetChecks,
  highlightOpenChecks,
  focusCheckTarget,
  dueCheck,
  checkRowHTML,
  screenReinspect,
  docFromReinspection,
} = reinspection;
const { focusWalkDetails, worksheetCheckPanel } = reinspection;

const languageCatalog = createLanguageCatalog({
  allItems: (...args) => allItems(...args),
  toast: (...args) => toast(...args),
  helperJSON: (...args) => helperJSON(...args),
  idbSet: (...args) => idbSet(...args),
  loadCaseFile: (...args) => loadCaseFile(...args),
  project: (...args) => project(...args),
  rememberSaved: (...args) => rememberSaved(...args),
  caseUnsaved: (...args) => caseUnsaved(...args),
  draftBundle: (...args) => draftBundle(...args),
  saveCaseFile: (...args) => saveCaseFile(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  clearWalk: (...args) => clearWalk(...args),
  captureWork: (...args) => captureWork(...args),
  catalogKey: (...args) => catalogKey(...args),
  recoveryCaseKey: (...args) => recoveryCaseKey(...args),
  recoverySnapshot: (...args) => recoverySnapshot(...args),
  scheduleRecoveryBackup: (...args) => scheduleRecoveryBackup(...args),
  render: (...args) => render(...args),
  get A11Y() {
    return A11Y;
  },
  get RECOVERY_WORKSPACE() {
    return RECOVERY_WORKSPACE;
  },
  get WORKFLOW_PREFS_KEY() {
    return WORKFLOW_PREFS_KEY;
  },
  get navigation() {
    return navigation;
  },
  get recordIntegrity() {
    return recordIntegrity;
  },
  app_savedworkContext: (...args) => app_savedworkContext(...args),
  refreshSheet: (...args) => refreshSheet(...args),
});
export let {
  catalogReview,
  catalogStatus,
  effectiveCatalog,
  catalogItem,
  catalogDraftBlocked,
  catalogDraftNotice,
  adoptCatalogReview,
  catalogSelection,
  catalogVisible,
  refreshCatalog,
  catalogForm,
  catalogReplacementOptions,
  catalogReviewPanel,
  compareSharedCase,
  preflightCase,
  sharedChangeModal,
  keepChangedLocal,
  openChangedShared,
  persistWorkspacePatch,
  applyConflict,
  safetyCaseStatus,
  showSafety,
  showHealth,
  inspectLock,
  showLock,
  saveWorkflowPrefs,
  caseSearchText,
  globalSearch,
} = languageCatalog;
const { catalogReplacement, readSharedCase, localCaseWork, resolvedCaseFields, friendlyField, conflictControls } = languageCatalog;

const accelaImport = createAccelaImport({
  fmtTime: (...args) => fmtTime(...args),
  toast: (...args) => toast(...args),
  fmtDate: (...args) => fmtDate(...args),
  get snow() {
    return snow;
  },
  uid: (...args) => uid(...args),
  get citationPricing() {
    return citationPricing;
  },
  get COMMITTED() {
    return COMMITTED;
  },
  newDoc: (...args) => newDoc(...args),
  sourceDocFor: (...args) => sourceDocFor(...args),
  loadCaseFile: (...args) => loadCaseFile(...args),
  helperJSON: (...args) => helperJSON(...args),
  shell: (...args) => shell(...args),
  unissuedVisitFor: (...args) => unissuedVisitFor(...args),
  caseState: (...args) => caseState(...args),
  render: (...args) => render(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  listCaseFolder: (...args) => listCaseFolder(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  startReinspection: (...args) => startReinspection(...args),
  captureWork: (...args) => captureWork(...args),
  preflightCase: (...args) => preflightCase(...args),
});
export const {
  ACC_MAX,
  ACC_EXPANDED_MAX,
  ACC_COLS,
  ACC_REQUIRED,
  ACC_LABEL,
  inspectionKind,
  statusRule,
  hiddenImportRow,
  accStatusEligible,
  ACC_CASEFIELDS,
  accXml,
  accAll,
  accKids,
  accText,
  accColIx,
  accStr,
  accNorm,
  accTime,
  accInspector,
  LOOKUP_READY,
  SQL_COLUMNS,
  accelaTable,
  baseLookupPlan,
  readAccelaFile,
  accelaFromShare,
  baseLookupAccept,
  pickAccelaFile,
  screenImport,
  openImportWorkspace,
  lookupCard,
  cancelCaseLookup,
  checkLookupShared,
  findDatabaseCase,
  selectImportInspection,
  confirmDatabaseCase,
  accelaPlan,
  acceptAccela,
} = accelaImport;
const { accHM, accInflate, readXlsx, accSerial, accWhen, accParcel, applyImportRule, accelaPanel, sqlReport, lookupPlanSignature, lookupCanOpen } =
  accelaImport;

const caseActivity = createCaseActivity({
  caseState: (...args) => caseState(...args),
  sourceDocFor: (...args) => sourceDocFor(...args),
  fmtDate: (...args) => fmtDate(...args),
  get navigation() {
    return navigation;
  },
  get A11Y() {
    return A11Y;
  },
  get today() {
    return today;
  },
});
export let { remindersPanel, showReminders, showReminderDraft, timelineRows, showTimeline } = caseActivity;
const { remindersDue } = caseActivity;

const pdfArtifacts = createPdfArtifacts({
  get navigation() {
    return navigation;
  },
  get A11Y() {
    return A11Y;
  },
  helperJSON: (...args) => helperJSON(...args),
  toast: (...args) => toast(...args),
  render: (...args) => render(...args),
});
export let { showOutbox, selectedOutbox, printOutbox, refreshArtifactLocations } = pdfArtifacts;

const writerHandoff = createWriterHandoff({
  render: (...args) => render(...args),
  preflightCase: (...args) => preflightCase(...args),
  helperJSON: (...args) => helperJSON(...args),
  loadCaseFile: (...args) => loadCaseFile(...args),
  get WRITER_READY_WAIT() {
    return WRITER_READY_WAIT;
  },
  get HANDOFF_CHANNEL() {
    return HANDOFF_CHANNEL;
  },
});
export let { markWriterReady, markWriterFailed, writerOpenReportedCase, initWriterHandoff } = writerHandoff;

const deadlineAssignment = createDeadlineAssignment({
  MINDUE: (...args) => MINDUE(...args),
  structEditable: (...args) => structEditable(...args),
  isLocked: (...args) => isLocked(...args),
  fmtDate: (...args) => fmtDate(...args),
  get navigation() {
    return navigation;
  },
  get A11Y() {
    return A11Y;
  },
  get snow() {
    return snow;
  },
});
export let { planBulkDue, showBulkDue, updateDueIndicators, duePanel, assignDue } = deadlineAssignment;

const itemSelection = createItemSelection({
  uid: (...args) => uid(...args),
  get snow() {
    return snow;
  },
});
export let { toggleLibraryItem } = itemSelection;
const citationWorkflow = createCitationWorkflow({
  get administration() {
    return administration;
  },
  get citationPricing() {
    return citationPricing;
  },
  citationPricingDate: (...args) => citationPricingDate(...args),
  get depositStep() {
    return depositStep;
  },
  get initialCitations() {
    return initialCitations;
  },
  initialOrderCitation: (...args) => initialOrderCitation(...args),
  isLocked: (...args) => isLocked(...args),
  get snow() {
    return snow;
  },
  unchangedCorrectionValue: (...args) => unchangedCorrectionValue(...args),
  applyDeposit: (...args) => applyDeposit(...args),
  changeCharge: (...args) => changeChargeBasis(...args),
  chargeChoices: (...args) => chargeChoices(...args),
  choosesCharge: (...args) => choosesCharge(...args),
  feeLines: (...args) => feeLines(...args),
  fmtDate: (...args) => fmtDate(...args),
  get today() {
    return today;
  },
});
export let { depositComplete, initialCitationBody, citationDepositFault, editCitation, commitCitationEdits, authoringChecks, citationReview } =
  citationWorkflow;

const workspaceTaskPresentation = createWorkspaceTasks({
  fmtDate: (...args) => fmtDate(...args),
  hasSetupWork: (...args) => hasSetupWork(...args),
  depositComplete: (...args) => depositComplete(...args),
});
export let { workspaceTasks } = workspaceTaskPresentation;

const recordCommit = createRecordCommit({
  toast: (...args) => toast(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  caseFile: (...args) => caseFile(...args),
  get COMMITTED() {
    return COMMITTED;
  },
  helperJSON: (...args) => helperJSON(...args),
  mergeCaseEvents: (...args) => mergeCaseEvents(...args),
  project: (...args) => project(...args),
  rememberSaved: (...args) => rememberSaved(...args),
  idbSet: (...args) => idbSet(...args),
  writeSummary: (...args) => writeSummary(...args),
  render: (...args) => render(...args),
});
export let { commitAmendment } = recordCommit;

const publicationPreparation = createPublicationPreparation({
  get snow() {
    return snow;
  },
  get newDocuments() {
    return newDocuments;
  },
  sourceDocFor: (...args) => sourceDocFor(...args),
  worksheetFaults: (...args) => worksheetFaults(...args),
  get today() {
    return today;
  },
  cleanVisit: (...args) => cleanVisit(...args),
  evid: (...args) => evid(...args),
  freezeSources: (...args) => freezeSources(...args),
  get initialCitations() {
    return initialCitations;
  },
});
export let { lifecycleChecks } = publicationPreparation;
const { makePublication } = publicationPreparation;

const publicationWorkflow = createPublicationWorkflow({
  get recordIntegrity() {
    return recordIntegrity;
  },
  toast: (...args) => toast(...args),
  commitCitationEdits: (...args) => commitCitationEdits(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  render: (...args) => render(...args),
  refreshCatalog: (...args) => refreshCatalog(...args),
  get initialCitations() {
    return initialCitations;
  },
  get citationPricing() {
    return citationPricing;
  },
  blockers: (...args) => blockers(...args),
  makePublication: (...args) => makePublication(...args),
  commitAmendment: (...args) => commitAmendment(...args),
  printJob: (...args) => printJob(...args),
  filePdf: (...args) => filePdf(...args),
  emailDocument: (...args) => emailDocument(...args),
  needsInitialCitation: (...args) => needsInitialCitation(...args),
  revealIssuedCase: (...args) => revealIssuedCase(...args),
  focusIssuedCase: (...args) => focusIssuedCase(...args),
});
export let { publishDocument, publicationPanel } = publicationWorkflow;

const correctionPreparation = createCorrectionPreparation({
  validateAndStandardizeAddresses: (...args) => validateAndStandardizeAddresses(...args),
  freezeSources: (...args) => freezeSources(...args),
  hasItemInspectionHistory: (...args) => hasItemInspectionHistory(...args),
  documentItemHistory: (...args) => documentItemHistory(...args),
  evid: (...args) => evid(...args),
  get today() {
    return today;
  },
});
export let { correctionChanges, correctionEligibility, correctionChecks, correctionTypeAllowed, correctionVisitPatch } = correctionPreparation;
const { makeCorrectionAttempt } = correctionPreparation;

const correctionWorkflow = createCorrectionWorkflow({
  correctionEligibility: (...args) => correctionEligibility(...args),
  uid: (...args) => uid(...args),
  get today() {
    return today;
  },
  docBody: (...args) => docBody(...args),
  docBlocks: (...args) => docBlocks(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  render: (...args) => render(...args),
  toast: (...args) => toast(...args),
  get recordIntegrity() {
    return recordIntegrity;
  },
  commitCitationEdits: (...args) => commitCitationEdits(...args),
  get citationPricing() {
    return citationPricing;
  },
  blockers: (...args) => blockers(...args),
  makeCorrectionAttempt: (...args) => makeCorrectionAttempt(...args),
  commitAmendment: (...args) => commitAmendment(...args),
  printJob: (...args) => printJob(...args),
  filePdf: (...args) => filePdf(...args),
  emailDocument: (...args) => emailDocument(...args),
  scrollTo: (...args) => window.scrollTo(...args),
});
export let { startCorrection, issueCorrection } = correctionWorkflow;

const workspaceDatabase = createWorkspaceDatabase({
  get IDB_OK() {
    return IDB_OK;
  },
  get indexedDB() {
    return indexedDB;
  },
});
export let { idb, idbGet, idbSet } = workspaceDatabase;

const draftPersistence = createDraftPersistence({
  get recordIntegrity() {
    return recordIntegrity;
  },
  captureWork: (...args) => captureWork(...args),
  updateSaveStatus: (...args) => updateSaveStatus(...args),
  scheduleRecoveryBackup: (...args) => scheduleRecoveryBackup(...args),
  get IDB_OK() {
    return IDB_OK;
  },
  idbGet: (...args) => idbGet(...args),
  idbSet: (...args) => idbSet(...args),
  project: (...args) => project(...args),
  render: (...args) => render(...args),
  toast: (...args) => toast(...args),
});
export let { draftBundle, saveDrafts, restoreDrafts } = draftPersistence;

const documentRenderer = createDocumentRenderer({
  fmtDate: (...args) => fmtDate(...args),
  fmtTime: (...args) => fmtTime(...args),
  inspAt: (...args) => inspAt(...args),
  longDate: (...args) => longDate(...args),
  parseTime: (...args) => parseTime(...args),
  validISO: (...args) => validISO(...args),
  documentItemHistory: (...args) => documentItemHistory(...args),
  revisionPrintNote: (...args) => revisionPrintNote(...args),
  hasItemInspectionHistory: (...args) => hasItemInspectionHistory(...args),
  catalogDraftNotice: (...args) => catalogDraftNotice(...args),
  get newDocuments() {
    return newDocuments;
  },
  MINDUE: (...args) => MINDUE(...args),
  agentLines: (...args) => agentLines(...args),
  ccLines: (...args) => ccLines(...args),
  docBlocks: (...args) => docBlocks(...args),
  docBody: (...args) => docBody(...args),
  get initialCitations() {
    return initialCitations;
  },
  isLocked: (...args) => isLocked(...args),
  get snow() {
    return snow;
  },
  structEditable: (...args) => structEditable(...args),
  docCase: (...args) => docCase(...args),
  docInsp: (...args) => docInsp(...args),
  eventsFor: (...args) => eventsFor(...args),
});
export const { documentHTML, citationFaces } = documentRenderer;
const { noticeHTML, citAmount, referralHistoryHTML } = documentRenderer;

export const app_savedworkContext = createSavedWorkContext({
  get caseUnsaved() {
    return caseUnsaved;
  },
  get caseState() {
    return caseState;
  },
  get recoveryStatusHTML() {
    return recoveryStatusHTML;
  },
  get pdfTransferState() {
    return pdfTransferState;
  },
  get A11Y() {
    return A11Y;
  },
  get CASEDIR_EXPECT() {
    return CASEDIR_EXPECT;
  },
  get COMMITTED() {
    return COMMITTED;
  },
  get recordIntegrity() {
    return recordIntegrity;
  },
  get storageMode() {
    return storageMode;
  },
});
export const app_workspacequeueContext = createWorkspaceQueueContext({
  get caseNumberAllowed() {
    return caseNumberAllowed;
  },
  get pdfTransferState() {
    return pdfTransferState;
  },
  get recordIntegrity() {
    return recordIntegrity;
  },
  get snow() {
    return snow;
  },
});
export const app_languagediscoveryContext = createLanguageDiscoveryContext({
  get allItems() {
    return allItems;
  },
  get shell() {
    return shell;
  },
  get catalogKey() {
    return catalogKey;
  },
  get catalogItem() {
    return catalogItem;
  },
  get catalogReviewPanel() {
    return catalogReviewPanel;
  },
  get catalogStatus() {
    return catalogStatus;
  },
  get catalogVisible() {
    return catalogVisible;
  },
  get effectiveCatalog() {
    return effectiveCatalog;
  },
});

const documentPagination = createDocumentPagination({
  get PAGE_PX() {
    return PAGE_PX;
  },
  get snow() {
    return snow;
  },
  hasItemInspectionHistory: (...args) => hasItemInspectionHistory(...args),
});
// Retain the original mutable function binding used by the existing disclosure audit.
export let { paginate } = documentPagination;
const { contHead } = documentPagination;

/* Feature interfaces are lazy: no service or later state is read during construction. */
const utilityEvents = createUtilityEvents({
  checks: (...args) => checks(...args),
  focusCheckTarget: (...args) => focusCheckTarget(...args),
  highlightOpenChecks: (...args) => highlightOpenChecks(...args),
  get navigation() {
    return navigation;
  },
  render: (...args) => render(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  toast: (...args) => toast(...args),
  worksheetChecks: (...args) => worksheetChecks(...args),
});
const recoveryEvents = createRecoveryEvents({
  get ENTRY_IDS() {
    return ENTRY_IDS;
  },
  get IDB_OK() {
    return IDB_OK;
  },
  captureWork: (...args) => captureWork(...args),
  citationFromNotice: (...args) => citationFromNotice(...args),
  discardDraft: (...args) => discardDraft(...args),
  downloadFile: (...args) => downloadFile(...args),
  downloadWorkspace: (...args) => downloadWorkspace(...args),
  filePdf: (...args) => filePdf(...args),
  helperJSON: (...args) => helperJSON(...args),
  get initialCitations() {
    return initialCitations;
  },
  isLocked: (...args) => isLocked(...args),
  keepChangedLocal: (...args) => keepChangedLocal(...args),
  listRecovery: (...args) => listRecovery(...args),
  loadCaseFile: (...args) => loadCaseFile(...args),
  needsInitialCitation: (...args) => needsInitialCitation(...args),
  openChangedShared: (...args) => openChangedShared(...args),
  printJob: (...args) => printJob(...args),
  publishDocument: (...args) => publishDocument(...args),
  recordFormKey: (...args) => recordFormKey(...args),
  render: (...args) => render(...args),
  restorePreviousDraft: (...args) => restorePreviousDraft(...args),
  restoreRecovery: (...args) => restoreRecovery(...args),
  restoreWorkspaceFile: (...args) => restoreWorkspaceFile(...args),
  returnToWorksheet: (...args) => returnToWorksheet(...args),
  saveAndContinue: (...args) => saveAndContinue(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  selectRecovery: (...args) => selectRecovery(...args),
  toast: (...args) => toast(...args),
  validateRecovery: (...args) => validateRecovery(...args),
});
const catalogEvents = createCatalogEvents({
  adoptCatalogReview: (...args) => adoptCatalogReview(...args),
  catalogForm: (...args) => catalogForm(...args),
  catalogItem: (...args) => catalogItem(...args),
  catalogKey: (...args) => catalogKey(...args),
  catalogReplacementOptions: (...args) => catalogReplacementOptions(...args),
  catalogReview: (...args) => catalogReview(...args),
  catalogSelection: (...args) => catalogSelection(...args),
  catalogStatus: (...args) => catalogStatus(...args),
  helperJSON: (...args) => helperJSON(...args),
  keepCatalogForms: (...args) => keepCatalogForms(...args),
  languageClick: (...args) => languageClick(...args),
  refreshCatalog: (...args) => refreshCatalog(...args),
  refreshOverlay: (...args) => refreshOverlay(...args),
  render: (...args) => render(...args),
  renumber: (...args) => renumber(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  get snow() {
    return snow;
  },
  structEditable: (...args) => structEditable(...args),
  toast: (...args) => toast(...args),
  toggleLibraryItem: (...args) => toggleLibraryItem(...args),
});
const safetyEvents = createSafetyEvents({
  get A11Y() {
    return A11Y;
  },
  applyConflict: (...args) => applyConflict(...args),
  backupUnfinished: (...args) => backupUnfinished(...args),
  caseState: (...args) => caseState(...args),
  commitAmendment: (...args) => commitAmendment(...args),
  flushPending: (...args) => flushPending(...args),
  helperJSON: (...args) => helperJSON(...args),
  inspectLock: (...args) => inspectLock(...args),
  pdfTransferState: (...args) => pdfTransferState(...args),
  preflightCase: (...args) => preflightCase(...args),
  get recordIntegrity() {
    return recordIntegrity;
  },
  recoveryJobs: (...args) => recoveryJobs(...args),
  refreshCatalog: (...args) => refreshCatalog(...args),
  render: (...args) => render(...args),
  saveCaseFile: (...args) => saveCaseFile(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  showHealth: (...args) => showHealth(...args),
  showLock: (...args) => showLock(...args),
  showOutbox: (...args) => showOutbox(...args),
  showSafety: (...args) => showSafety(...args),
  startReinspection: (...args) => startReinspection(...args),
  toast: (...args) => toast(...args),
});
const workflowEvents = createWorkflowEvents({
  checkHelper: (...args) => checkHelper(...args),
  downloadFile: (...args) => downloadFile(...args),
  globalSearch: (...args) => globalSearch(...args),
  helperJSON: (...args) => helperJSON(...args),
  persistWorkspacePatch: (...args) => persistWorkspacePatch(...args),
  planBulkDue: (...args) => planBulkDue(...args),
  printOutbox: (...args) => printOutbox(...args),
  refreshArtifactLocations: (...args) => refreshArtifactLocations(...args),
  render: (...args) => render(...args),
  saveWorkflowPrefs: (...args) => saveWorkflowPrefs(...args),
  selectedOutbox: (...args) => selectedOutbox(...args),
  showBulkDue: (...args) => showBulkDue(...args),
  showOutbox: (...args) => showOutbox(...args),
  showReminderDraft: (...args) => showReminderDraft(...args),
  showReminders: (...args) => showReminders(...args),
  showTimeline: (...args) => showTimeline(...args),
  timelineCategory: (...args) => timelineCategory(...args),
  timelineRows: (...args) => timelineRows(...args),
  toast: (...args) => toast(...args),
  validISO: (...args) => validISO(...args),
  writerOpenReportedCase: (...args) => writerOpenReportedCase(...args),
});
const workspaceEvents = createWorkspaceEvents({
  captureWork: (...args) => captureWork(...args),
  caseFile: (...args) => caseFile(...args),
  caseFileName: (...args) => caseFileName(...args),
  caseNumberAllowed: (...args) => caseNumberAllowed(...args),
  caseState: (...args) => caseState(...args),
  caseUnsaved: (...args) => caseUnsaved(...args),
  clearCases: (...args) => clearCases(...args),
  downloadFile: (...args) => downloadFile(...args),
  flushPending: (...args) => flushPending(...args),
  grantCaseFolder: (...args) => grantCaseFolder(...args),
  linkCaseFolder: (...args) => linkCaseFolder(...args),
  listCaseFolder: (...args) => listCaseFolder(...args),
  get navigation() {
    return navigation;
  },
  openFromFolder: (...args) => openFromFolder(...args),
  pickCaseFile: (...args) => pickCaseFile(...args),
  preflightCase: (...args) => preflightCase(...args),
  rebuildIndex: (...args) => rebuildIndex(...args),
  refreshOverlay: (...args) => refreshOverlay(...args),
  removeCase: (...args) => removeCase(...args),
  render: (...args) => render(...args),
  rnd12: (...args) => rnd12(...args),
  saveCaseFile: (...args) => saveCaseFile(...args),
  saveWorkflowPrefs: (...args) => saveWorkflowPrefs(...args),
  startReinspection: (...args) => startReinspection(...args),
  storageMode: (...args) => storageMode(...args),
  testWrite: (...args) => testWrite(...args),
  toast: (...args) => toast(...args),
  get catalogEvents() {
    return catalogEvents;
  },
  get citationEvents() {
    return citationEvents;
  },
  get contactEvents() {
    return contactEvents;
  },
  get correctionEvents() {
    return correctionEvents;
  },
  get editorEvents() {
    return editorEvents;
  },
  get importEvents() {
    return importEvents;
  },
  get recoveryEvents() {
    return recoveryEvents;
  },
  get reinspectionEvents() {
    return reinspectionEvents;
  },
  get workflowEvents() {
    return workflowEvents;
  },
});
const citationEvents = createCitationEvents({
  get depositStep() {
    return depositStep;
  },
  editCitation: (...args) => editCitation(...args),
  get initialCitations() {
    return initialCitations;
  },
  isLocked: (...args) => isLocked(...args),
  refreshSheet: (...args) => refreshSheet(...args),
  render: (...args) => render(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  structEditable: (...args) => structEditable(...args),
  syncChip: (...args) => syncChip(...args),
  get dueDateEvents() {
    return dueDateEvents;
  },
});
const dueDateEvents = createDueDateEvents({
  activeDueTarget: (...args) => activeDueTarget(...args),
  assignDue: (...args) => assignDue(...args),
  dueContext: (...args) => dueContext(...args),
  dueSelectedText: (...args) => dueSelectedText(...args),
  isLocked: (...args) => isLocked(...args),
  render: (...args) => render(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  toast: (...args) => toast(...args),
  toastUndo: (...args) => toastUndo(...args),
});
const importEvents = createImportEvents({
  accelaFromShare: (...args) => accelaFromShare(...args),
  accelaPlan: (...args) => accelaPlan(...args),
  acceptAccela: (...args) => acceptAccela(...args),
  cancelCaseLookup: (...args) => cancelCaseLookup(...args),
  confirmDatabaseCase: (...args) => confirmDatabaseCase(...args),
  findDatabaseCase: (...args) => findDatabaseCase(...args),
  openImportWorkspace: (...args) => openImportWorkspace(...args),
  pickAccelaFile: (...args) => pickAccelaFile(...args),
  preflightCase: (...args) => preflightCase(...args),
  readAccelaFile: (...args) => readAccelaFile(...args),
  render: (...args) => render(...args),
  renderKeep: (...args) => renderKeep(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  selectImportInspection: (...args) => selectImportInspection(...args),
});
const reinspectionEvents = createReinspectionEvents({
  advanceWalk: (...args) => advanceWalk(...args),
  changeVisitDate: (...args) => changeVisitDate(...args),
  clearWalk: (...args) => clearWalk(...args),
  discardWorksheet: (...args) => discardWorksheet(...args),
  docFromReinspection: (...args) => docFromReinspection(...args),
  ensureWalkContext: (...args) => ensureWalkContext(...args),
  focusWalkItem: (...args) => focusWalkItem(...args),
  nextWalkItem: (...args) => nextWalkItem(...args),
  preflightCase: (...args) => preflightCase(...args),
  previousWalk: (...args) => previousWalk(...args),
  recordReinspection: (...args) => recordReinspection(...args),
  recordReinspectionOutcome: (...args) => recordReinspectionOutcome(...args),
  render: (...args) => render(...args),
  renderKeep: (...args) => renderKeep(...args),
  returnWalkDetails: (...args) => returnWalkDetails(...args),
  saveCaseFile: (...args) => saveCaseFile(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  skipWalkDetails: (...args) => skipWalkDetails(...args),
  startReinspection: (...args) => startReinspection(...args),
  toast: (...args) => toast(...args),
  undoWalkOutcome: (...args) => undoWalkOutcome(...args),
  walkIdentity: (...args) => walkIdentity(...args),
});
const editorEvents = createEditorEvents({
  MINDUE: (...args) => MINDUE(...args),
  blockers: (...args) => blockers(...args),
  captureWork: (...args) => captureWork(...args),
  fillBlank: (...args) => fillBlank(...args),
  grantCaseFolder: (...args) => grantCaseFolder(...args),
  get initialCitations() {
    return initialCitations;
  },
  isLocked: (...args) => isLocked(...args),
  issueCorrection: (...args) => issueCorrection(...args),
  moveItem: (...args) => moveItem(...args),
  newDoc: (...args) => newDoc(...args),
  get newDocuments() {
    return newDocuments;
  },
  openIssuedCopy: (...args) => openIssuedCopy(...args),
  parseDate: (...args) => parseDate(...args),
  parseTime: (...args) => parseTime(...args),
  preflightCase: (...args) => preflightCase(...args),
  printJob: (...args) => printJob(...args),
  printNotice: (...args) => printNotice(...args),
  refreshCatalog: (...args) => refreshCatalog(...args),
  refreshSheet: (...args) => refreshSheet(...args),
  render: (...args) => render(...args),
  renumber: (...args) => renumber(...args),
  runFinalize: (...args) => runFinalize(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  splitOwner: (...args) => splitOwner(...args),
  structEditable: (...args) => structEditable(...args),
  syncChip: (...args) => syncChip(...args),
  toast: (...args) => toast(...args),
  toastUndo: (...args) => toastUndo(...args),
  unchangedCorrectionValue: (...args) => unchangedCorrectionValue(...args),
  updateDueIndicators: (...args) => updateDueIndicators(...args),
  get catalogEvents() {
    return catalogEvents;
  },
  get citationEvents() {
    return citationEvents;
  },
  get contactEvents() {
    return contactEvents;
  },
  get correctionEvents() {
    return correctionEvents;
  },
  get importEvents() {
    return importEvents;
  },
  get reinspectionEvents() {
    return reinspectionEvents;
  },
  get workspaceEvents() {
    return workspaceEvents;
  },
});
const specialDocumentEvents = createSpecialDocumentEvents({
  get newDocuments() {
    return newDocuments;
  },
});
const correctionEvents = createCorrectionEvents({
  addRecordNote: (...args) => addRecordNote(...args),
  commitAmendment: (...args) => commitAmendment(...args),
  correctionChanges: (...args) => correctionChanges(...args),
  correctionTypeAllowed: (...args) => correctionTypeAllowed(...args),
  docBody: (...args) => docBody(...args),
  downloadFile: (...args) => downloadFile(...args),
  isLocked: (...args) => isLocked(...args),
  issueCorrection: (...args) => issueCorrection(...args),
  itemHistory: (...args) => itemHistory(...args),
  itemInspectionHistory: (...args) => itemInspectionHistory(...args),
  preflightCase: (...args) => preflightCase(...args),
  reconcileDocument: (...args) => reconcileDocument(...args),
  render: (...args) => render(...args),
  saveDrafts: (...args) => saveDrafts(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  startCorrection: (...args) => startCorrection(...args),
  toast: (...args) => toast(...args),
  voidDocument: (...args) => voidDocument(...args),
});
const contactEvents = createContactEvents({
  addCC: (...args) => addCC(...args),
  addEmail: (...args) => addEmail(...args),
  emailDocument: (...args) => emailDocument(...args),
  recipientPreview: (...args) => recipientPreview(...args),
  refreshOverlay: (...args) => refreshOverlay(...args),
  removeCC: (...args) => removeCC(...args),
  removeEmail: (...args) => removeEmail(...args),
  render: (...args) => render(...args),
  scheduleDraftSave: (...args) => scheduleDraftSave(...args),
  validateAndStandardizeAddresses: (...args) => validateAndStandardizeAddresses(...args),
});
utilityEvents.registerHelpClicks();
utilityEvents.registerHelpKeys();
utilityEvents.registerHelpClose();
const $testFixtures = __TEST_BUILD__
  ? initTestFixtures({
      fmtDate: (...args) => fmtDate(...args),
      freezeSources: (...args) => freezeSources(...args),
      toast: (...args) => toast(...args),
      appendEvent: (...args) => appendEvent(...args),
      project: (...args) => project(...args),
      saveDrafts: (...args) => saveDrafts(...args),
      validateAndStandardizeAddresses: (...args) => validateAndStandardizeAddresses(...args),
      recordReinspection: (...args) => recordReinspection(...args),
      startCorrection: (...args) => startCorrection(...args),
      render: (...args) => render(...args),
      MINDUE: (...args) => MINDUE(...args),
    })
  : null;

/* R35: an initial-inspection citation (authoring 11+) is the only mailed document; its paired Official Notice
   snapshot is the case's internal record of the deadlines and is never printed, filed or emailed separately. */
export const initialOrderCitation = (d) =>
  !!d && d.type === "citation" && !d.fromReinspId && d.authoringVersion >= 11 && !snow.is(d) && !!(d.issuanceGroup || d.initialPreview);

// One suggested session; inspector reviews court scheduling.

/* The inspector identifies the offence. The deposit and the statutory
   assessments follow from MGO 1.08(3) with no arithmetic on their part. */

/* 1.08(3)(b): chapters that fall back to a standard ladder when the offence
   is not on the enumerated schedule. */

/* Exact ordinance, then the same section at a finer subsection (the division
   writes 10.25 on the ticket where the schedule enumerates 10.25(5)), then the
   chapter fallback. Never a guess. */

/* ---------- inspector roster ----------
   From the division's own list of inspectors, emails and badge numbers.
   Six rows had the Last and First columns transposed; the email local part
   (initial + surname) resolves which is which. Two corrections: the sheet
   spells BLANC-CLUM where both the email and an issued citation say
   BLANC-BLUM, and Asaph Lehman's address reads 'alhman', which looks like
   a missing letter. Four badges read PLACE HOLDER and are carried as blank
   rather than as text that could print on a citation.
   Phone numbers are not in the sheet — the four here are read back from
   notices the division has issued. */

const TEST_CASES = __TEST_BUILD__ ? TEST_CASE_DATA : [];

WriterState.CASES = __TEST_BUILD__ && globalThis.MADISON_TEST_DATA ? JSON.parse(JSON.stringify(TEST_CASES)) : [];

WriterState.DOCS = [];

WriterState.REINSP = [];
/* reinspection worksheets: one per return visit */
WriterState.state = {
  acc: null,
  screen: "cases",
  docId: null,
  reinspId: null,
  folder: null,
  riFilter: "",
  riWalk: false,
  riWalkContext: null,
  riWalkItem: null,
  riWalkUndo: null,
  riWalkSkipped: [],
  riWalkMode: "quick",
  riWalkStage: "outcome",
  caseQ: "",
  caseFilter: "attention",
  caseInspector: "",
  issuedCase: "",
  metric: "",
  keepAdding: true,
  folderQ: "",
  emailOnIssue: false,
  sendDoc: null,
  sendJob: null,
  sendReuse: undefined,
  picker: false,
  q: "",
  cl: -1,
  grp: 0,
  modal: null,
  libFilter: "",
  libStatus: "approved",
  pickerStatus: "approved",
  libCl: -1,
  languageMode: "browse",
  catalogAdminKey: "",
  catalogAdminQ: "",
  catalogAdminStatus: "review",
  pickerDoc: null,
};

export const A11Y = createAccessibility();
/* Ids have to be unique across machines, not only within this session:
   two inspectors working the same case offline both allocate ids and the
   files are merged by union, so a plain counter collides. The counter is
   kept as a readable prefix; the random tail is what makes it unique. */
WriterState.seq = 100;

export const uid = (p) => p + ++WriterState.seq + "-" + rnd12();
WriterState.DIRTY = false;

/* The clock is read at the moment it is used, never captured at load. A
   laptop left open overnight must not keep writing yesterday onto
   documents, and a fixture date silently backdates everything. */
Object.defineProperty(globalThis, "today", {
  configurable: true,
  get() {
    return new Date();
  },
});

/* The header dates are typed, not picked, so they read as plain text on the
   page. Parsing is deliberately forgiving; anything unreadable leaves the
   stored value alone rather than wiping it mid-keystroke. */
/* the table prints a dash for a missing date; an editable field shows nothing
   so its placeholder can do the work */
/* test fixture API: retained for audit_*.js; production uses confirmed publication. */
// Test hook: exported so the test build keeps it; tests call it by name.
export const fmtDateEd = __TEST_BUILD__ ? $testFixtures.fmtDateEd : undefined;

WriterState.undoFn = null;

editorEvents.registerBlankClicks();
editorEvents.registerBlankKeys();
reinspectionEvents.registerWalkKeys();

export const docBody = (d) =>
  snow.is(d) && d.authoringVersion >= 9
    ? snow.body(d)
    : (d && d.correction && d.correction.body) ||
      (frozenOf(d) && frozenOf(d).body) ||
      (specialType(d && d.type)
        ? newDocuments.specialBody(d)
        : d && d.type === "citation" && !d.fromReinspId
          ? initialCitationBody(d)
          : DOCBODY[d && d.type]) ||
      DOCBODY.notice;
const blockText = (b) => ({ key: b, label: (BLOCKS[b] || {}).label || "", text: (BLOCKS[b] || {}).text || "" });
export const docBlocks = (d) => (d && d.correction && d.correction.blocks) || (frozenOf(d) && frozenOf(d).blocks) || activeBlocks(d).map(blockText);

export const blockers = (d) => checks(d).filter((c) => !c.ok && !c.soft);

export const MINDUE = () => addDays(recordDay(today), 1);
// a due date is never today or earlier
/* test fixture API: retained for audit_*.js; production uses confirmed publication. */
// Test hook: exported so the test build keeps it; tests call it by name.
export const futureDue = __TEST_BUILD__ ? $testFixtures.futureDue : undefined;

/* Printing: window.print() is blocked inside a sandboxed frame, so the
   notice is rendered into its own document and printed from there. */
/* Address - Case Number - Document Type - Date */
/* The name ends in the document's own id. Without it two documents of the
   same type on one case, mailed the same day — a replacement especially —
   write to the same file, and the second silently replaces the first. */

/* Is the local helper there? It is what turns the finished page into a PDF and
   files it, which a browser cannot do on its own. */
WriterState.HELPER = null;

/* Items can be reordered or removed only while the first notice is still a
   draft. Once it is issued the owner has that numbered list, and every later
   document refers back to it. */
/* A document is closed to editing once it is finalized, once a reinspection
   has been walked against it, or once a later document exists on the case.
   Any of those means it is out of the inspector's hands. */
export const isLocked = (d) =>
  !d ||
  recordIntegrity.blocked(d.caseId) ||
  !!d.pendingAmendment ||
  d.status === "Final" ||
  WriterState.REINSP.some((r) => !r.draft && r.sourceDocId === d.id) ||
  docsFor(d.caseId)
    .filter((x) => x.draft)
    .indexOf(d) > 0 ||
  (!d.draft && docsFor(d.caseId)[0] !== d);
/* Items may be reordered or removed only while the first notice is still a
   draft, before anything has been issued against the case. */
export const structEditable = (d) =>
  !!d && !d.correction && d.type === "notice" && d.draft && !isLocked(d) && !docsFor(d.caseId).some((x) => !x.draft) && !reinspFor(d.caseId).length;

WriterState.EVENTS = {};

/* The in-memory projection the screens read. Drafts sit on top of the
   replayed history. */

/* ---------- writing and reading the file ---------- */
WriterState.SAVE_CHECKPOINTS = {};

WriterState.WRITER_ACCESS = true;
WriterState.releaseWorkspaceLock = null;

/* ids are preserved on load — reinspection results are keyed by item id, so
   they must survive the round trip. Push the counter past anything incoming. */

/* Loading merges rather than replaces: events already held are kept, new ones
   are added, and anything present in both is deduplicated by event id. */
/* Everything a case file has to satisfy before any of it is believed. A
   file that fails here changes nothing at all: half an import leaves cases
   and events that cannot be replayed, and the screen behind it broken. */

/* The same case can be held here under a different id. Events merge into
   the id already in use, so every reference inside them is repointed first
   or the documents replay onto a case nothing looks at. */

/* ---------- storage ----------
   Served from localhost the browser gives us two things a file:// page cannot
   have: the File System Access API, so the case folder on the share is written
   in place, and IndexedDB, so drafts survive a closed laptop without ever
   touching the share. Drafts are working papers; only issued documents belong
   in the shared record. */
export const FS_OK = typeof window !== "undefined" && !!window.showDirectoryPicker;
export const CASEDIR_EXPECT = "Case JSON Files"; /* the division's folder for case records */
export const IDB_OK = typeof indexedDB !== "undefined" && !!indexedDB;
WriterState.CASEDIR = null;
/* handle on the case folder, remembered between sessions */
WriterState.DIRNAME = "";

WriterState.NEEDGRANT = false;
/* handle restored but the browser wants a click first */
WriterState.PENDING = [];
/* writes the share could not take yet */

/* One connection for the session. A fresh one per autosave leaves live
   connections behind and blocks any later upgrade of the database. */
WriterState.IDBCONN = null;

export const storageMode = () =>
  WriterState.CASEDIR ? (WriterState.NEEDGRANT ? "folder-locked" : "folder") : FS_OK ? "folder-not-linked" : "download";

/* ---------- the case folder ---------- */

/* Returns the reason it failed rather than a bare false, because a write that
   quietly does nothing is the hardest kind of fault to report. A permission
   that has lapsed mid-session is flagged as such so the next save can ask for
   it back rather than blaming the network. */
WriterState.LASTWRITE = null;

WriterState.LASTINDEX = null;
/* what the last reporting-summary write did */ /* {name, ok, why, at} — what the last write attempt did */
export const COMMITTED = new Map();

/* A summary goes into Reporting Index inside the case folder: the one place
   the browser's permission already reaches. A failed summary never blocks
   the case file; the reports page shows it as missing or stale and a
   rebuild writes it. */

/* Writes a summary for every case file in the folder, including ones this
   machine never opened. Cases are read and replayed here only; nothing is
   loaded into the working list. Must be started from a click. */

/* A write the share could not take is held and retried, so a dropped
   connection never costs an inspector their work. The queue is on disk, so it
   also survives closing the laptop mid-visit. */
/* The case id travels with the held write so the retry can re-serialise the
   case as it stands then, rather than replaying a body that was already
   superseded by a later save that succeeded. */

/* The case file on the share is one whole document and is replaced whole.
   Another inspector may have written to it since this copy was opened, so
   it is read back and merged before the write; otherwise their events are
   simply dropped. This closes the ordinary case — two people working the
   same case at different moments — and not a true simultaneous write,
   which needs a lock or a compare-and-swap the folder API does not offer. */

/* ---------- drafts ----------
   Working papers stay on this machine. They are not part of the shared record
   and are not published until the document is issued. */
WriterState.draftTimer = null;

/* A worksheet is walked against an issued document, and a follow-up draft
   carries items from one. Those live in the event log, not in the draft, so
   the events of any case a draft depends on are kept beside it. Without
   them a restored worksheet has no source to resolve and drops the
   inspector back to the case list with the original file possibly on a
   share they cannot reach. */

WriterState.LOCAL_SAVE = { ok: true, at: "", saving: false };

WriterState.LOCAL_CHANGED = 0;

export const ccLines = (c, normalize = true) =>
  [
    String(c.name || "").trim(),
    normalize ? standardStreetAddress(c.addr) || String(c.addr || "").trim() : String(c.addr || "").trim(),
    normalize ? standardCityStateZip(c.city) || String(c.city || "").trim() : String(c.city || "").trim(),
  ].filter(Boolean);
export const agentLines = (k, normalize = true) => {
  const a = (k && k.agent) || {};
  return [
    String(a.name || "").trim(),
    normalize ? standardStreetAddress(a.addr) || String(a.addr || "").trim() : String(a.addr || "").trim(),
    normalize ? standardCityStateZip(a.city) || String(a.city || "").trim() : String(a.city || "").trim(),
  ].filter(Boolean);
};

/* ---------- publishing ----------
   Issuing is the moment the working draft stops being editable and becomes a
   line in the case history. The snapshot holds everything that printed, so the
   record still reads correctly years later when the library language has moved
   on and the owner has changed. */
/* test fixture API: retained for audit_*.js; production uses confirmed publication. */
// Test hook: exported so the test build keeps it; tests call it by name.
export const issueDocument = __TEST_BUILD__ ? $testFixtures.issueDocument : undefined;

export const unchangedCorrectionValue = (d, id, key) => {
  const src = correctionSource(d),
    old = src && src.items.find((i) => i.id === id),
    it = d && d.items.find((i) => i.id === id);
  return !!old && !!it && stableJSON(old[key]) === stableJSON(it[key]);
};
export const unchangedCourtDate = (d, id) => {
  const src = correctionSource(d);
  return !!src && !!src.cits && !!src.cits[id] && src.cits[id].courtDate === ((d.cits || {})[id] || {}).courtDate;
};

/* test fixture API */
// Test hook: exported so the test build keeps it; tests call it by name.
export const reissueDocument = __TEST_BUILD__ ? $testFixtures.reissueDocument : undefined;

WriterState.AMENDMENT_BUSY = false;

/* PDF filing and email requests in flight in this window; Exit Document Writer waits for them. */
WriterState.FILING_ACTIVE = 0;

WriterState.RECORD_ATTEMPTS = {};

/* Lifecycle boundaries, durable working papers, and confirmed publication.
   Shared records contain issued facts only. A pending transaction is local. */
WriterState.WORK = { entry: {}, acc: null, recordForms: {} };

WriterState.LOCAL_SAVE_CHAIN = Promise.resolve();

export const ENTRY_IDS = ["lookup-number"];
export const recordFormKey = () => WriterState.state.docId + ":" + WriterState.state.modal;

// These handlers own working forms even before a case/document identity exists.
recoveryEvents.registerWorkingInput();
recoveryEvents.registerWorkingChange();
recoveryEvents.registerWorkingActions();

/* Local-helper draft recovery. Backups are independent of IndexedDB and of
   official case files. A restore stages and validates all records first. */
export const RECOVERY_WORKSPACE_KEY = "madison-recovery-workspace-v1";

export const RECOVERY_WORKSPACE = recoveryWorkspace();
export const RECOVERY_CASE_KEYS = "madison-recovery-case-keys-v1";

WriterState.RECOVERY = { at: "", error: "", list: [], selected: null, shared: null, loading: false };

WriterState.RECOVERY_TIMER = null;
WriterState.RECOVERY_SIGNATURES = {};
WriterState.RECOVERY_SELECT_SEQ = 0;
WriterState.RECOVERY_NEXT = null;
WriterState.RECOVERY_BUSY = false;

recoveryEvents.registerRecoveryActions();
recoveryEvents.registerRecoveryImport();

/* Catalog review events live on the share. Bundled wording stays immutable;
   a review is applied only to a newly selected item, never issued history. */
WriterState.CATALOG_EVENTS = [];
WriterState.CATALOG_ERROR = "";
WriterState.CATALOG_VERIFIED = false;
WriterState.CATALOG_FROM_CACHE = false;
WriterState.CATALOG_AT = "";
WriterState.CATALOG_FORMS = {};

try {
  const cache = JSON.parse(localStorage.getItem("madison-catalog-events-v1") || "null");
  if (cache && Array.isArray(cache.events)) {
    WriterState.CATALOG_EVENTS = cache.events;
    WriterState.CATALOG_AT = cache.at;
    WriterState.CATALOG_VERIFIED = true;
    WriterState.CATALOG_FROM_CACHE = true;
  }
  WriterState.CATALOG_FORMS = JSON.parse(localStorage.getItem("madison-catalog-forms-v1") || "{}") || {};
} catch (e) {
  /* Cached review metadata is optional; fresh helper review verification still governs issuance. */
}

catalogEvents.registerGuidanceToggle();
catalogEvents.registerReviewInput();
catalogEvents.registerReplacementQuery();
catalogEvents.registerReviewChange();
catalogEvents.registerReviewActions();

/* Early reconciliation is advisory; publication still uses the locked gate. */
WriterState.PREFLIGHT_SEQ = 0;
WriterState.PREFLIGHT_CONFLICT = null;
WriterState.PREFLIGHT_NOTICE = "";

recoveryEvents.registerSharedConflictActions();

/* Plain-language safety centre; no automatic lock release. */
WriterState.SAFETY_HEALTH = null;
WriterState.SAFETY_LOCK = null;
WriterState.RESOLUTION_BUSY = false;
WriterState.WORK_PATCH = null;

safetyEvents.registerLockRelease();
safetyEvents.registerSafetyActions();

/* Browser-profile preferences and optional inspector workflow aids. */
export const WORKFLOW_PREFS_KEY = "madison-workspace-preferences-v1";
WriterState.WORKFLOW_PREFS = { filter: "attention", query: "", inspector: "", reminders: { enabled: false, days: 7, plans: {}, dismissed: [] } };

try {
  const raw = JSON.parse(localStorage.getItem(WORKFLOW_PREFS_KEY) || "null");
  if (raw && typeof raw === "object") {
    if (["attention", "all", "continue", "deadlines", "resolution", "drafts", "soon", "overdue", "open", "closed"].includes(raw.filter))
      WriterState.WORKFLOW_PREFS.filter = raw.filter;
    for (const key of ["query", "inspector"]) if (typeof raw[key] === "string") WriterState.WORKFLOW_PREFS[key] = raw[key].slice(0, 200);
    if (raw.reminders && typeof raw.reminders === "object") {
      const r = raw.reminders;
      WriterState.WORKFLOW_PREFS.reminders = {
        enabled: r.enabled === true,
        days: Math.min(30, Math.max(1, Number(r.days) || 7)),
        plans: Object.fromEntries(Object.entries(r.plans && typeof r.plans === "object" ? r.plans : {}).filter(([, value]) => validISO(value))),
        dismissed: Array.isArray(r.dismissed) ? r.dismissed.filter((x) => typeof x === "string").slice(-200) : [],
      };
    }
  }
} catch (error) {
  /* An optional local preference cannot change case records or issued documents. */
}
WriterState.state.caseFilter = WriterState.WORKFLOW_PREFS.filter;
WriterState.state.caseQ = WriterState.WORKFLOW_PREFS.query;
WriterState.state.caseInspector = WriterState.WORKFLOW_PREFS.inspector;

WriterState.TIMELINE_CASE = "";
WriterState.TIMELINE_FILTER = "all";

WriterState.OUTBOX_FILES = [];

workflowEvents.registerToolForms();
workflowEvents.registerToolActions();
workflowEvents.registerTimelineFilter();
workflowEvents.registerSearchPreferences();

/* Workspace task counts are built from the same records used by the task list.
   Artifact location is checked by the helper against approved outbox paths. */
WriterState.ARTIFACT_LOCATIONS = {};
WriterState.ARTIFACT_VERIFY = {};
WriterState.ARTIFACT_SEQ = 0;
WriterState.ARTIFACT_IDENTITY = {};

workspaceEvents.registerQueueViews();
workspaceEvents.registerCaseTasks();

/* Reports sends only a case number. Writer resolves it through the validated
   shared-case route and preserves its single-tab Web Lock. */
export const HANDOFF_CHANNEL = "madison-writer-handoff-v1";
WriterState.WRITER_CHANNEL = null;
WriterState.REPORT_RETURN = false;
WriterState.HANDOFF_SEQ = 0;

WriterState.RETURN_ACK = "";

WriterState.WRITER_READY = false;
WriterState.STARTUP_STATUS = "starting";
// A browser without IndexedDB has no retained workspace to restore; its existing save warnings still apply.
WriterState.WORKSPACE_RESTORED = !IDB_OK;
WriterState.STARTUP_ERROR = "";
WriterState.releaseWriterReady = undefined;

export const WRITER_READY_WAIT = new Promise((resolve) => {
  WriterState.releaseWriterReady = resolve;
});

workspaceEvents.registerReportReturn();

citationEvents.registerReviewInput();
citationEvents.registerReviewChange();
dueDateEvents.registerBulkAssignment();

/* Imported inspection identity excludes mutable status, owner and inspector names.
   The fixed source query has no inspection ID: date/type/time are the available key.
   Missing historical time conservatively matches any time on that date. */

/* R5 direct lookup uses the existing report importer and publication gates. */
WriterState.LOOKUP_BUSY = false;
WriterState.LOOKUP_ERROR = "";
WriterState.LOOKUP_CONTROLLER = null;
WriterState.LOOKUP_SERIAL = 0;
// R59: bumps on every inspection-candidate change so a check started for an earlier selection is ignored.
WriterState.ACC_SELECTION_SERIAL = 0;

importEvents.registerLookupSubmit();
importEvents.registerLookupClicks();

importEvents.registerLookupDrop();

utilityEvents.registerCheckLinks();
// Run after editing handlers, without replacing the active input or losing its caret.
utilityEvents.registerInputChecks();
utilityEvents.registerChangeChecks();

// empty box / checked box

/* ---------- picker ---------- */

/* ---------- render ---------- */
// only one overlay at a time — the modal supersedes the picker

/* Reordering is a pointer gesture so it works the same with a mouse or a
   thumb. Rows move live; the item array is rewritten and renumbered on drop. */
WriterState.dragging = null;

editorEvents.registerPointerStart();
editorEvents.registerPointerMove();
editorEvents.registerPointerEnd();
editorEvents.registerPointerCancel();

editorEvents.registerReorderKeys();
// structural changes only — never while someone is typing

/* A follow-up is a derivative of the notice, not a fresh document. Only the
   items that failed reinspection come across, and they keep the number the
   owner already has — item 3 stays item 3 through extension and citation. */

/* ---------- pagination ----------
   The notice is written as one flowing document and then cut into letter
   pages here, so what is on screen is what comes out of the printer. Each
   page carries the table header and the division footer; only the first
   carries the letterhead and the envelope window. */
export const PAGE_PX = 11 * 96;

utilityEvents.registerDialogKeys();
specialDocumentEvents.registerActionClicks();
specialDocumentEvents.registerActionInput();
specialDocumentEvents.registerActionChange();
recoveryEvents.registerVisibilitySave();
/* ---------- events ---------- */
WriterState.groupOld = null;

editorEvents.registerGroupFocus();
// paste into the document as plain text so the notice keeps its own formatting
/* The field is small by design, so the whole of it opens the picker rather
   than the few pixels of the calendar icon. */
editorEvents.registerDatePicker();

editorEvents.registerPlainPaste();

editorEvents.registerReviewCommands();

workspaceEvents.registerWorkspaceClicks();

/* the Accela report can be dropped on the import card */
importEvents.registerDragOver();
importEvents.registerDragLeave();
importEvents.registerFileDrop();

/* Durable workspace recovery starts before the application becomes editable. */
if (document.documentElement) document.documentElement.lang = "en";
if (typeof bootStorage === "function") bootStorage();
recoveryEvents.registerUnloadWarning();

/* typing on the document writes straight to state — no re-render, no lost cursor */
editorEvents.registerDocumentInput();

editorEvents.registerDocumentChange();

utilityEvents.registerDismissKey();

render();

// Preserve the legacy audit constant only in the fixture build.
if (__TEST_BUILD__) globalThis.SUMMARY_VERSION = SUMMARY_VERSION;

catalogEvents.registerLanguageActions();
catalogEvents.registerFilterInput();
catalogEvents.registerFilterChange();

export function citationPricingDate(c, d) {
  return policyCitationPricingDate(c, d, inspAt(d).date);
}

if (__TEST_BUILD__)
  globalThis.__DW_TEST_REFERENCES = {
    deposits: DEPOSITS,
    remindersDue,
    focusWalkDetails,
    worksheetCheckPanel,
    catalogReplacement,
    readSharedCase,
    localCaseWork,
    resolvedCaseFields,
    friendlyField,
    conflictControls,
    ACC_MAX,
    ACC_EXPANDED_MAX,
    ACC_COLS,
    ACC_REQUIRED,
    ACC_LABEL,
    inspectionKind,
    statusRule,
    hiddenImportRow,
    accStatusEligible,
    ACC_CASEFIELDS,
    accXml,
    accAll,
    accKids,
    accText,
    accColIx,
    accStr,
    accNorm,
    accTime,
    accInspector,
    LOOKUP_READY,
    SQL_COLUMNS,
    accelaTable,
    baseLookupPlan,
    readAccelaFile,
    accelaFromShare,
    baseLookupAccept,
    pickAccelaFile,
    screenImport,
    openImportWorkspace,
    lookupCard,
    cancelCaseLookup,
    checkLookupShared,
    findDatabaseCase,
    selectImportInspection,
    confirmDatabaseCase,
    accelaPlan,
    acceptAccela,
    accHM,
    accInflate,
    readXlsx,
    accSerial,
    accWhen,
    accParcel,
    applyImportRule,
    accelaPanel,
    sqlReport,
    lookupPlanSignature,
    lookupCanOpen,
    safety: safetyCaseStatus,
    noticeHTML,
    citAmount,
    referralHistoryHTML,
    contHead,
    editorReadiness,
    readinessText,
    readinessFirst,
    reviewConcernsHTML,
  };
