import { deferredServices } from "./deferred_services.js";
import { createHelperRequests } from "./helper_requests.js";
import { createCaseSummaryAdapter } from "./case_summary_adapter.js";
import { evid, appendEvent } from "./record_event_log.js";
import { sourceDocFor } from "./writer_queries.js";
import { createFolderConnections } from "./folder_connections.js";
import { createReinspectionEntry } from "./reinspection_entry.js";
import { createCaseWorkspaceActions } from "./case_workspace_actions.js";
import { createDraftSaveControls } from "./draft_save_controls.js";
import { createLocalCaseFiles } from "./local_case_files.js";
import { createCaseFolderWorkflow } from "./case_folder_workflow.js";
import { ccLines, agentLines, addressProblem } from "./address_format.js";
import { createRecipientWorkflow } from "./recipient_workflow.js";
import { createDocumentReadiness } from "./document_readiness.js";
import { createDocumentSources } from "./document_sources.js";
import { createDocumentFeedback } from "./document_feedback.js";
import { createCourtScheduling } from "./court_scheduling.js";
import { createCitationCharges, chargeChoices, choosesCharge, feeLines, lookupForf, CHARGE_DERIVED } from "./citation_charges.js";
import { createDocumentPrinting } from "./document_printing.js";
import { createDocumentDelivery } from "./document_delivery.js";
import { authFetch } from "./helper_transport.js";
import { createCitationDrafts } from "./citation_drafts.js";
import { createVisitRecording } from "./visit_recording.js";
import { createWorkingPapers, hasSetupWork, filingPanel } from "./working_papers.js";
import { createInspectionHistory, itemHistory, itemInspectionHistory, hasItemInspectionHistory } from "./inspection_history.js";
import { createCorrectionUI } from "./correction_ui.js";
import { createRecordActions } from "./record_actions.js";
import { createRecoveryUI } from "./recovery_ui.js";
import { createCatalogForms, catalogKey } from "./catalog_forms.js";
import { createRecordHistory } from "./record_history.js";
import { createWorksheetWorkflow, cleanVisit, changeVisitDate } from "./worksheet_workflow.js";
import { createCaseRecovery } from "./case_recovery.js";
import { createAutomaticRecovery } from "./automatic_recovery.js";
import { createWorkspaceBackup } from "./workspace_backup.js";
import { createCaseLoading } from "./case_loading.js";
import { caseFile, caseNumberAllowed, project, rememberSaved, mergeCaseEvents } from "./case_records.js";
import { createSharedCaseStorage } from "./shared_case_storage.js";
import { createPendingCaseSaves } from "./pending_case_saves.js";
import { createCaseSaveWorkflow } from "./case_save_workflow.js";
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
import { createOpenCaseList } from "./open_case_list.js";
import { createOpenCaseEvents } from "./open_case_events.js";
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

import { fmtDate, longDate, fmtTime } from "./presentation_format.js";
import { splitOwner } from "./mailing_rules.js";
import { rnd12 } from "./record_ids.js";
import { allItems } from "./catalog_queries.js";
import { createWorkspaceShell } from "./workspace_shell.js";
import { createBrowserPrinting } from "./browser_printing.js";
import { createStorageStatus } from "./storage_status.js";
import { createStorageProbe } from "./storage_probe.js";
import { caseFileName } from "./case_file_rules.js";

import { createWriterStartup } from "./writer_startup.js";
import { createReinspection } from "./reinspection.js";
import { uiIcon } from "./ui_icons.js";
import { createCaseStatus } from "./case_status.js";
import { createCitationHistory } from "./citation_history.js";
import { createWorkspaceScreen } from "./workspace_screen.js";
import { createLanguageViews } from "./language_views.js";
import { createScreenOverlays } from "./screen_overlays.js";
import { createAppScreens } from "./app_screens.js";
import { createAccelaImport } from "./accela_import.js";

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
  ui: deferredServices(
    {
      toast: () => toast,
      shell: () => shell,
      highlightOpenChecks: () => highlightOpenChecks,
      screenCases: () => screenCases,
      render: () => render,
      overlayHTML: () => overlayHTML,
      A11Y: () => A11Y,
      paginate: () => paginate,
    },
    ["A11Y"],
  ),
  edit: deferredServices({
    saveDrafts: () => saveDrafts,
    scheduleDraftSave: () => scheduleDraftSave,
    isLocked: () => isLocked,
    structEditable: () => structEditable,
    uid: () => uid,
  }),
  record: deferredServices(
    {
      checks: () => checks,
      fmtDate: () => fmtDate,
      checkRowHTML: () => checkRowHTML,
      citationRecoveryPanel: () => citationRecoveryPanel,
      correctionEligibility: () => correctionEligibility,
      correctionPanel: () => correctionPanel,
      filingPanel: () => filingPanel,
      recordHistoryHTML: () => recordHistoryHTML,
      publicationPanel: () => publicationPanel,
      citationReview: () => citationReview,
      duePanel: () => duePanel,
      initialCitations: () => initialCitations,
      newDocuments: () => newDocuments,
      recordIntegrity: () => recordIntegrity,
      snow: () => snow,
      documentHTML: () => documentHTML,
      citationFaces: () => citationFaces,
      app_savedworkContext: () => app_savedworkContext,
      app_languagediscoveryContext: () => app_languagediscoveryContext,
    },
    ["initialCitations", "newDocuments", "recordIntegrity", "snow"],
  ),
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

export const snow = initSnow(
  deferredServices(
    {
      citationNumber: () => citationNumber,
      fmtDate: () => fmtDate,
      nextCourtDate: () => nextCourtDate,
      toast: () => toast,
      validISO: () => validISO,
      helperJSON: () => helperJSON,
      saveDrafts: () => saveDrafts,
      scheduleDraftSave: () => scheduleDraftSave,
      renderKeep: () => renderKeep,
      render: () => render,
      refreshSheet: () => refreshSheet,
      citationPricing: () => citationPricing,
      initialCitations: () => initialCitations,
      isLocked: () => isLocked,
      uid: () => uid,
    },
    ["citationPricing", "initialCitations"],
  ),
);
export const administration = initAdministration(
  deferredServices(
    {
      toast: () => toast,
      helperJSON: () => helperJSON,
      saveDrafts: () => saveDrafts,
      render: () => render,
      A11Y: () => A11Y,
      citationPricing: () => citationPricing,
      isLocked: () => isLocked,
      snow: () => snow,
    },
    ["A11Y", "citationPricing", "snow"],
  ),
);
export const libraryReview = initReviewedLibrary();
export const newDocuments = initNewDocuments(
  deferredServices(
    {
      fmtDate: () => fmtDate,
      inspAt: () => inspAt,
      toast: () => toast,
      validISO: () => validISO,
      evid: () => evid,
      shell: () => shell,
      sourceDocFor: () => sourceDocFor,
      saveDrafts: () => saveDrafts,
      scheduleDraftSave: () => scheduleDraftSave,
      screenCases: () => screenCases,
      renderKeep: () => renderKeep,
      render: () => render,
      commitRecordAttempt: () => commitRecordAttempt,
      worksheetFaults: () => worksheetFaults,
      newDoc: () => newDoc,
      docFromReinspection: () => docFromReinspection,
      refreshSheet: () => refreshSheet,
      docBody: () => docBody,
      isLocked: () => isLocked,
      snow: () => snow,
      uid: () => uid,
    },
    ["snow"],
  ),
);
export const citationPricing = initCitationPricing(
  deferredServices(
    {
      inspAt: () => inspAt,
      lookupForf: () => lookupForf,
      toast: () => toast,
      renderKeep: () => renderKeep,
      citationPricingDate: () => citationPricingDate,
      isLocked: () => isLocked,
      libraryReview: () => libraryReview,
      snow: () => snow,
    },
    ["libraryReview", "snow"],
  ),
);
export const depositStep = initDepositStep(
  deferredServices(
    {
      changeChargeBasis: () => changeChargeBasis,
      chargeChoices: () => chargeChoices,
      choosesCharge: () => choosesCharge,
      toast: () => toast,
      saveDrafts: () => saveDrafts,
      scheduleDraftSave: () => scheduleDraftSave,
      saveAndContinue: () => saveAndContinue,
      citationDepositFault: () => citationDepositFault,
      render: () => render,
      citationPricing: () => citationPricing,
      citationPricingDate: () => citationPricingDate,
      isLocked: () => isLocked,
    },
    ["citationPricing"],
  ),
);
export const initialCitations = initInitialCitations(
  deferredServices(
    {
      applyDeposit: () => applyDeposit,
      dep_checks: () => dep_checks,
      citationNumber: () => citationNumber,
      fmtDate: () => fmtDate,
      freezeSources: () => freezeSources,
      inspAt: () => inspAt,
      nextCourtDate: () => nextCourtDate,
      evid: () => evid,
      citationTier: () => citationTier,
      citationReview: () => citationReview,
      editorSync: () => editorSync,
      citationFaces: () => citationFaces,
      citationPricing: () => citationPricing,
      libraryReview: () => libraryReview,
      uid: () => uid,
    },
    ["citationPricing", "libraryReview"],
  ),
);
export const navigation = initNavigation(
  deferredServices(
    {
      toast: () => toast,
      shell: () => shell,
      saveDrafts: () => saveDrafts,
      uiIcon: () => uiIcon,
      render: () => render,
      captureWork: () => captureWork,
      cancelCaseLookup: () => cancelCaseLookup,
      WRITER_READY_WAIT: () => WRITER_READY_WAIT,
    },
    ["WRITER_READY_WAIT"],
  ),
);
const languageClick = createLanguageActions(
  deferredServices(
    {
      catalogKey: () => catalogKey,
      keepCatalogForms: () => keepCatalogForms,
      catalogForm: () => catalogForm,
      catalogItem: () => catalogItem,
      catalogReview: () => catalogReview,
      refreshCatalog: () => refreshCatalog,
      render: () => render,
      refreshOverlay: () => refreshOverlay,
      navigation: () => navigation,
    },
    ["navigation"],
  ),
);
export const recordIntegrity = initRecordIntegrity({
  store: WriterState,
  kase: (...args) => kase(...args),
  doc: (...args) => doc(...args),
  esc: (...args) => esc(...args),
  helperJSON: (...args) => helperJSON(...args),
  render: () => render(),
});
export const addressParser = initAddressParser(
  deferredServices(
    {
      toast: () => toast,
      helperJSON: () => helperJSON,
      saveDrafts: () => saveDrafts,
      render: () => render,
      A11Y: () => A11Y,
      recordIntegrity: () => recordIntegrity,
      uid: () => uid,
    },
    ["A11Y", "recordIntegrity"],
  ),
);
const helperRequests = createHelperRequests(deferredServices({ recordIntegrity: () => recordIntegrity }, ["recordIntegrity"]));
export let { helperJSON } = helperRequests;
const caseSummaryAdapter = createCaseSummaryAdapter(deferredServices({ recordIntegrity: () => recordIntegrity }, ["recordIntegrity"]));
export let { summarize } = caseSummaryAdapter;

const workspaceShell = createWorkspaceShell(
  deferredServices({ navigation: () => navigation, recordIntegrity: () => recordIntegrity, app_savedworkContext: () => app_savedworkContext }, [
    "navigation",
    "recordIntegrity",
  ]),
);
export let { shell } = workspaceShell;
const browserPrinting = createBrowserPrinting(
  deferredServices(
    { document: () => document, window: () => window, URL: () => URL, Blob: () => Blob, setTimeout: () => setTimeout, toast: () => toast },
    ["document", "window", "URL", "Blob"],
  ),
);
export let { printableHTML, printNotice } = browserPrinting;
const storageStatus = createStorageStatus({
  get window() {
    return typeof window !== "undefined" ? window : undefined;
  },
  get FS_OK() {
    return FS_OK;
  },
  get IDB_OK() {
    return IDB_OK;
  },
  get CASEDIR_EXPECT() {
    return CASEDIR_EXPECT;
  },
  storageMode: (...args) => storageMode(...args),
});
export let { storageReport, reindexReport } = storageStatus;
const storageProbe = createStorageProbe(
  deferredServices({
    toast: () => toast,
    grantCaseFolder: () => grantCaseFolder,
    helperJSON: () => helperJSON,
    writeToFolder: () => writeToFolder,
    render: () => render,
  }),
);
export let { testWrite } = storageProbe;

const caseStatus = createCaseStatus(
  deferredServices({ snow: () => snow, today: () => today, unissuedVisitFor: () => unissuedVisitFor }, ["snow", "today"]),
);
export let { caseState } = caseStatus;
const citationHistory = createCitationHistory(deferredServices({ today: () => today }, ["today"]));
export let { priorCitations } = citationHistory;
const workspaceScreen = createWorkspaceScreen(
  deferredServices(
    {
      app_workspacequeueContext: () => app_workspacequeueContext,
      caseSearchText: () => caseSearchText,
      caseState: () => caseState,
      document: () => document,
      recoveryStatusHTML: () => recoveryStatusHTML,
      remindersPanel: () => remindersPanel,
      saveWorkflowPrefs: () => saveWorkflowPrefs,
      shell: () => shell,
      workspaceTasks: () => workspaceTasks,
    },
    ["document"],
  ),
);
export let { revealIssuedCase, focusIssuedCase, screenCases } = workspaceScreen;
const languageViews = createLanguageViews(deferredServices({ app_languagediscoveryContext: () => app_languagediscoveryContext }));
export let { screenLibrary, pickerHTML } = languageViews;
const screenOverlays = createScreenOverlays(
  deferredServices(
    {
      CASEDIR_EXPECT: () => CASEDIR_EXPECT,
      blockers: () => blockers,
      caseUnsaved: () => caseUnsaved,
      checkRowHTML: () => checkRowHTML,
      checks: () => checks,
      correctionDiffHTML: () => correctionDiffHTML,
      initialCitations: () => initialCitations,
      pickerHTML: () => pickerHTML,
      recipientPreview: () => recipientPreview,
      recordActionModal: () => recordActionModal,
      recoveryModal: () => recoveryModal,
      reindexReport: () => reindexReport,
      reviewModalHTML: () => reviewModalHTML,
      sharedChangeModal: () => sharedChangeModal,
      storageReport: () => storageReport,
      today: () => today,
    },
    ["CASEDIR_EXPECT", "blockers", "initialCitations", "today"],
  ),
);
export let { overlayHTML } = screenOverlays;
const appScreens = createAppScreens(
  deferredServices(
    {
      A11Y: () => A11Y,
      IDB_OK: () => IDB_OK,
      app_languagediscoveryContext: () => app_languagediscoveryContext,
      document: () => document,
      editorEnhance: () => editorEnhance,
      enhanceDialog: () => enhanceDialog,
      ensureWalkContext: () => ensureWalkContext,
      highlightOpenChecks: () => highlightOpenChecks,
      isLocked: () => isLocked,
      location: () => location,
      navigation: () => navigation,
      newDocuments: () => newDocuments,
      overlayHTML: () => overlayHTML,
      paginate: () => paginate,
      restoreWorkControls: () => restoreWorkControls,
      scheduleDraftSave: () => scheduleDraftSave,
      screenCases: () => screenCases,
      screenImport: () => importScreen,
      screenLibrary: () => screenLibrary,
      screenReinspect: () => screenReinspect,
      screenWrite: () => screenWrite,
      updateSaveStatus: () => updateSaveStatus,
      walkIdentity: () => walkIdentity,
      window: () => window,
    },
    ["A11Y", "IDB_OK", "document", "location", "navigation", "newDocuments", "window"],
  ),
);
export let { render, renderKeep } = appScreens;

const folderConnections = createFolderConnections(
  deferredServices(
    {
      FS_OK: () => FS_OK,
      window: () => window,
      idbSet: () => idbSet,
      flushPending: () => flushPending,
      toast: () => toast,
      render: () => render,
      helperFolder: () => helperFolder,
      CASEDIR_EXPECT: () => CASEDIR_EXPECT,
      idbGet: () => idbGet,
    },
    ["FS_OK", "window", "CASEDIR_EXPECT"],
  ),
);
export let { linkCaseFolder, restoreCaseFolder, grantCaseFolder } = folderConnections;

const caseFolderWorkflow = createCaseFolderWorkflow(
  deferredServices(
    {
      toast: () => toast,
      grantCaseFolder: () => grantCaseFolder,
      summarize: () => summarize,
      writeIndexFile: () => writeIndexFile,
      render: () => render,
      recordIntegrity: () => recordIntegrity,
      loadCaseFile: () => loadCaseFile,
    },
    ["recordIntegrity"],
  ),
);
export let { writeSummary, rebuildIndex, listCaseFolder, openFromFolder } = caseFolderWorkflow;

const localCaseFiles = createLocalCaseFiles(
  deferredServices(
    {
      Blob: () => Blob,
      URL: () => URL,
      document: () => document,
      setTimeout: () => setTimeout,
      FileReader: () => FileReader,
      toast: () => toast,
      loadCaseFile: () => loadCaseFile,
    },
    ["Blob", "URL", "document", "FileReader"],
  ),
);
export let { downloadFile, pickCaseFile } = localCaseFiles;

const draftSaveControls = createDraftSaveControls(
  deferredServices(
    {
      document: () => document,
      app_savedworkContext: () => app_savedworkContext,
      IDB_OK: () => IDB_OK,
      setTimeout: () => setTimeout,
      clearTimeout: () => clearTimeout,
      saveDrafts: () => saveDrafts,
    },
    ["document", "IDB_OK"],
  ),
);
export let { updateSaveStatus, scheduleDraftSave } = draftSaveControls;

const caseWorkspaceActions = createCaseWorkspaceActions(
  deferredServices({ toast: () => toast, clearWalk: () => clearWalk, saveDrafts: () => saveDrafts, render: () => render }),
);
export let { discardDraft, caseUnsaved, removeCase, clearCases } = caseWorkspaceActions;

const reinspectionEntry = createReinspectionEntry(
  deferredServices(
    {
      snow: () => snow,
      recordIntegrity: () => recordIntegrity,
      clearWalk: () => clearWalk,
      restoreWalkFor: () => restoreWalkFor,
      newDocuments: () => newDocuments,
      uid: () => uid,
      saveDrafts: () => saveDrafts,
      render: () => render,
      sourceDocFor: () => sourceDocFor,
      unissuedVisitFor: () => unissuedVisitFor,
      today: () => today,
      toast: () => toast,
    },
    ["snow", "recordIntegrity", "newDocuments", "today"],
  ),
);
export let { startReinspection } = reinspectionEntry;

const recipientWorkflow = createRecipientWorkflow(deferredServices({ addressParser: () => addressParser, render: () => render }, ["addressParser"]));
export let { validateAndStandardizeAddresses, recipientPreview, addCC, removeCC, addEmail, removeEmail } = recipientWorkflow;

const reinspection = createReinspection({
  ui: deferredServices({
    toast: () => toast,
    shell: () => shell,
    renderKeep: () => renderKeep,
    screenCases: () => screenCases,
    render: () => render,
  }),
  inspection: deferredServices({
    fmtDate: () => fmtDate,
    inspAt: () => inspAt,
    parseTime: () => parseTime,
    validISO: () => validISO,
    checks: () => checks,
    captureWork: () => captureWork,
    itemHistory: () => itemHistory,
    itemInspectionHistory: () => itemInspectionHistory,
    worksheetFaults: () => worksheetFaults,
    returnToWorksheet: () => returnToWorksheet,
    dueContext: () => dueContext,
    dueDateSpacingConflicts: () => dueDateSpacingConflicts,
    duePanel: () => duePanel,
    isLocked: () => isLocked,
    uid: () => uid,
    openImportWorkspace: () => openImportWorkspace,
  }),
  authoring: deferredServices(
    {
      applyDeposit: () => applyDeposit,
      citationNumber: () => citationNumber,
      nextCourtDate: () => nextCourtDate,
      scheduleDraftSave: () => scheduleDraftSave,
      validateAndStandardizeAddresses: () => validateAndStandardizeAddresses,
      saveDrafts: () => saveDrafts,
      newDocuments: () => newDocuments,
      MINDUE: () => MINDUE,
      depositStep: () => depositStep,
    },
    ["newDocuments", "depositStep"],
  ),
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
const { worksheetCheckPanel } = reinspection;

const languageCatalog = createLanguageCatalog(
  deferredServices(
    {
      allItems: () => allItems,
      toast: () => toast,
      helperJSON: () => helperJSON,
      idbSet: () => idbSet,
      loadCaseFile: () => loadCaseFile,
      project: () => project,
      rememberSaved: () => rememberSaved,
      caseUnsaved: () => caseUnsaved,
      draftBundle: () => draftBundle,
      saveCaseFile: () => saveCaseFile,
      saveDrafts: () => saveDrafts,
      clearWalk: () => clearWalk,
      captureWork: () => captureWork,
      catalogKey: () => catalogKey,
      recoveryCaseKey: () => recoveryCaseKey,
      recoverySnapshot: () => recoverySnapshot,
      scheduleRecoveryBackup: () => scheduleRecoveryBackup,
      render: () => render,
      A11Y: () => A11Y,
      RECOVERY_WORKSPACE: () => RECOVERY_WORKSPACE,
      WORKFLOW_PREFS_KEY: () => WORKFLOW_PREFS_KEY,
      navigation: () => navigation,
      recordIntegrity: () => recordIntegrity,
      app_savedworkContext: () => app_savedworkContext,
      refreshSheet: () => refreshSheet,
    },
    ["A11Y", "RECOVERY_WORKSPACE", "WORKFLOW_PREFS_KEY", "navigation", "recordIntegrity"],
  ),
);
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
const { resolvedCaseFields } = languageCatalog;

const accelaImport = createAccelaImport(
  deferredServices(
    {
      fmtTime: () => fmtTime,
      toast: () => toast,
      fmtDate: () => fmtDate,
      snow: () => snow,
      uid: () => uid,
      citationPricing: () => citationPricing,
      COMMITTED: () => COMMITTED,
      newDoc: () => newDoc,
      sourceDocFor: () => sourceDocFor,
      loadCaseFile: () => loadCaseFile,
      helperJSON: () => helperJSON,
      shell: () => shell,
      unissuedVisitFor: () => unissuedVisitFor,
      caseState: () => caseState,
      render: () => render,
      scheduleDraftSave: () => scheduleDraftSave,
      listCaseFolder: () => listCaseFolder,
      saveDrafts: () => saveDrafts,
      startReinspection: () => startReinspection,
      captureWork: () => captureWork,
      preflightCase: () => preflightCase,
    },
    ["snow", "citationPricing", "COMMITTED"],
  ),
);
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

const caseActivity = createCaseActivity(
  deferredServices(
    {
      caseState: () => caseState,
      sourceDocFor: () => sourceDocFor,
      fmtDate: () => fmtDate,
      navigation: () => navigation,
      A11Y: () => A11Y,
      today: () => today,
    },
    ["navigation", "A11Y", "today"],
  ),
);
export let { remindersPanel, showReminders, showReminderDraft, timelineRows, showTimeline } = caseActivity;
const { remindersDue } = caseActivity;

const pdfArtifacts = createPdfArtifacts(
  deferredServices({ navigation: () => navigation, A11Y: () => A11Y, helperJSON: () => helperJSON, toast: () => toast, render: () => render }, [
    "navigation",
    "A11Y",
  ]),
);
export let { showOutbox, selectedOutbox, printOutbox, refreshArtifactLocations } = pdfArtifacts;

const writerHandoff = createWriterHandoff(
  deferredServices(
    {
      render: () => render,
      preflightCase: () => preflightCase,
      helperJSON: () => helperJSON,
      loadCaseFile: () => loadCaseFile,
      WRITER_READY_WAIT: () => WRITER_READY_WAIT,
      HANDOFF_CHANNEL: () => HANDOFF_CHANNEL,
    },
    ["WRITER_READY_WAIT", "HANDOFF_CHANNEL"],
  ),
);
export let { markWriterReady, markWriterFailed, writerOpenReportedCase, initWriterHandoff } = writerHandoff;

const deadlineAssignment = createDeadlineAssignment(
  deferredServices(
    {
      MINDUE: () => MINDUE,
      structEditable: () => structEditable,
      isLocked: () => isLocked,
      fmtDate: () => fmtDate,
      navigation: () => navigation,
      A11Y: () => A11Y,
      snow: () => snow,
    },
    ["navigation", "A11Y", "snow"],
  ),
);
export let { planBulkDue, showBulkDue, updateDueIndicators, duePanel, assignDue } = deadlineAssignment;

const itemSelection = createItemSelection(deferredServices({ uid: () => uid, snow: () => snow }, ["snow"]));
export let { toggleLibraryItem } = itemSelection;
const citationWorkflow = createCitationWorkflow(
  deferredServices(
    {
      administration: () => administration,
      citationPricing: () => citationPricing,
      citationPricingDate: () => citationPricingDate,
      depositStep: () => depositStep,
      initialCitations: () => initialCitations,
      initialOrderCitation: () => initialOrderCitation,
      isLocked: () => isLocked,
      snow: () => snow,
      unchangedCorrectionValue: () => unchangedCorrectionValue,
      applyDeposit: () => applyDeposit,
      changeCharge: () => changeChargeBasis,
      chargeChoices: () => chargeChoices,
      choosesCharge: () => choosesCharge,
      feeLines: () => feeLines,
      fmtDate: () => fmtDate,
      today: () => today,
    },
    ["administration", "citationPricing", "depositStep", "initialCitations", "snow", "today"],
  ),
);
export let { depositComplete, initialCitationBody, citationDepositFault, editCitation, commitCitationEdits, authoringChecks, citationReview } =
  citationWorkflow;

const workspaceTaskPresentation = createWorkspaceTasks(
  deferredServices({ fmtDate: () => fmtDate, hasSetupWork: () => hasSetupWork, depositComplete: () => depositComplete }),
);
export let { workspaceTasks } = workspaceTaskPresentation;

const recordCommit = createRecordCommit(
  deferredServices(
    {
      toast: () => toast,
      saveDrafts: () => saveDrafts,
      caseFile: () => caseFile,
      COMMITTED: () => COMMITTED,
      helperJSON: () => helperJSON,
      mergeCaseEvents: () => mergeCaseEvents,
      project: () => project,
      rememberSaved: () => rememberSaved,
      idbSet: () => idbSet,
      writeSummary: () => writeSummary,
      render: () => render,
    },
    ["COMMITTED"],
  ),
);
export let { commitAmendment } = recordCommit;

const publicationPreparation = createPublicationPreparation(
  deferredServices(
    {
      snow: () => snow,
      newDocuments: () => newDocuments,
      sourceDocFor: () => sourceDocFor,
      worksheetFaults: () => worksheetFaults,
      today: () => today,
      cleanVisit: () => cleanVisit,
      evid: () => evid,
      freezeSources: () => freezeSources,
      initialCitations: () => initialCitations,
    },
    ["snow", "newDocuments", "today", "initialCitations"],
  ),
);
export let { lifecycleChecks } = publicationPreparation;
const { makePublication } = publicationPreparation;

const publicationWorkflow = createPublicationWorkflow(
  deferredServices(
    {
      recordIntegrity: () => recordIntegrity,
      toast: () => toast,
      commitCitationEdits: () => commitCitationEdits,
      saveDrafts: () => saveDrafts,
      render: () => render,
      refreshCatalog: () => refreshCatalog,
      initialCitations: () => initialCitations,
      citationPricing: () => citationPricing,
      blockers: () => blockers,
      makePublication: () => makePublication,
      commitAmendment: () => commitAmendment,
      printJob: () => printJob,
      filePdf: () => filePdf,
      emailDocument: () => emailDocument,
      needsInitialCitation: () => needsInitialCitation,
      revealIssuedCase: () => revealIssuedCase,
      focusIssuedCase: () => focusIssuedCase,
    },
    ["recordIntegrity", "initialCitations", "citationPricing"],
  ),
);
export let { publishDocument, publicationPanel } = publicationWorkflow;

const correctionPreparation = createCorrectionPreparation(
  deferredServices(
    {
      validateAndStandardizeAddresses: () => validateAndStandardizeAddresses,
      freezeSources: () => freezeSources,
      hasItemInspectionHistory: () => hasItemInspectionHistory,
      documentItemHistory: () => documentItemHistory,
      evid: () => evid,
      today: () => today,
    },
    ["today"],
  ),
);
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

const workspaceDatabase = createWorkspaceDatabase(deferredServices({ IDB_OK: () => IDB_OK, indexedDB: () => indexedDB }, ["IDB_OK", "indexedDB"]));
export let { idb, idbGet, idbSet } = workspaceDatabase;

const draftPersistence = createDraftPersistence(
  deferredServices(
    {
      recordIntegrity: () => recordIntegrity,
      captureWork: () => captureWork,
      updateSaveStatus: () => updateSaveStatus,
      scheduleRecoveryBackup: () => scheduleRecoveryBackup,
      IDB_OK: () => IDB_OK,
      idbGet: () => idbGet,
      idbSet: () => idbSet,
      project: () => project,
      render: () => render,
      toast: () => toast,
    },
    ["recordIntegrity", "IDB_OK"],
  ),
);
export let { draftBundle, saveDrafts, restoreDrafts } = draftPersistence;

const sharedCaseStorage = createSharedCaseStorage(
  deferredServices(
    {
      CASEDIR_EXPECT: () => CASEDIR_EXPECT,
      helperJSON: () => helperJSON,
      recordIntegrity: () => recordIntegrity,
      COMMITTED: () => COMMITTED,
      mergeCaseEvents: () => mergeCaseEvents,
      project: () => project,
    },
    ["CASEDIR_EXPECT", "recordIntegrity", "COMMITTED"],
  ),
);
export let { helperFolder, writeToFolder, writeIndexFile } = sharedCaseStorage;

const pendingCaseSaves = createPendingCaseSaves(
  deferredServices(
    {
      idbSet: () => idbSet,
      toast: () => toast,
      idbGet: () => idbGet,
      IDB_OK: () => IDB_OK,
      render: () => render,
      loadCaseFile: () => loadCaseFile,
      mergeSharedFile: () => mergeSharedFile,
      caseFile: () => caseFile,
      writeToFolder: () => writeToFolder,
      rememberSaved: () => rememberSaved,
      writeSummary: () => writeSummary,
      saveDrafts: () => saveDrafts,
    },
    ["IDB_OK"],
  ),
);
export let { queuePending, restorePending, flushPending } = pendingCaseSaves;

const caseSaveWorkflow = createCaseSaveWorkflow(
  deferredServices({
    caseNumberAllowed: () => caseNumberAllowed,
    caseFile: () => caseFile,
    downloadWorkspace: () => downloadWorkspace,
    rememberSaved: () => rememberSaved,
    downloadFile: () => downloadFile,
    toast: () => toast,
    render: () => render,
    grantCaseFolder: () => grantCaseFolder,
    mergeSharedFile: () => mergeSharedFile,
    queuePending: () => queuePending,
    writeToFolder: () => writeToFolder,
    idbSet: () => idbSet,
    writeSummary: () => writeSummary,
    saveDrafts: () => saveDrafts,
  }),
);
export let { saveCaseFile } = caseSaveWorkflow;

const caseLoading = createCaseLoading(
  deferredServices(
    {
      toast: () => toast,
      recordIntegrity: () => recordIntegrity,
      render: () => render,
      saveDrafts: () => saveDrafts,
      refreshArtifactLocations: () => refreshArtifactLocations,
    },
    ["recordIntegrity"],
  ),
);
export let { loadCaseFile, mergeSharedFile } = caseLoading;

const workspaceBackup = createWorkspaceBackup(
  deferredServices(
    {
      captureWork: () => captureWork,
      draftBundle: () => draftBundle,
      downloadFile: () => downloadFile,
      toast: () => toast,
      hasSetupWork: () => hasSetupWork,
      idbSet: () => idbSet,
      recordIntegrity: () => recordIntegrity,
      render: () => render,
      saveDrafts: () => saveDrafts,
      refreshArtifactLocations: () => refreshArtifactLocations,
      today: () => today,
    },
    ["recordIntegrity", "today"],
  ),
);
export let { downloadWorkspace, restoreWorkspaceBackup } = workspaceBackup;

const automaticRecovery = createAutomaticRecovery(
  deferredServices(
    {
      localStorage: () => localStorage,
      RECOVERY_WORKSPACE_KEY: () => RECOVERY_WORKSPACE_KEY,
      RECOVERY_CASE_KEYS: () => RECOVERY_CASE_KEYS,
      RECOVERY_WORKSPACE: () => RECOVERY_WORKSPACE,
      rnd12: () => rnd12,
      draftBundle: () => draftBundle,
      helperJSON: () => helperJSON,
      renderRecoveryStatus: () => renderRecoveryStatus,
      setTimeout: () => setTimeout,
      clearTimeout: () => clearTimeout,
    },
    ["localStorage", "RECOVERY_WORKSPACE_KEY", "RECOVERY_CASE_KEYS", "RECOVERY_WORKSPACE"],
  ),
);
export let { recoveryWorkspace, recoveryCaseKey, recoverySnapshot, recoveryJobs, backupUnfinished, scheduleRecoveryBackup } = automaticRecovery;
const { recoveryIncluded } = automaticRecovery;

const caseRecovery = createCaseRecovery(
  deferredServices(
    {
      render: () => render,
      helperJSON: () => helperJSON,
      compareSharedCase: () => compareSharedCase,
      walkIdentity: () => walkIdentity,
      IDB_OK: () => IDB_OK,
      idb: () => idb,
      idbGet: () => idbGet,
      idbSet: () => idbSet,
      draftBundle: () => draftBundle,
      toast: () => toast,
      hasSetupWork: () => hasSetupWork,
      caseUnsaved: () => caseUnsaved,
      recoverySnapshot: () => recoverySnapshot,
      recoveryCaseKey: () => recoveryCaseKey,
      RECOVERY_WORKSPACE: () => RECOVERY_WORKSPACE,
      confirm: () => confirm,
      clearWalk: () => clearWalk,
      refreshArtifactLocations: () => refreshArtifactLocations,
    },
    ["IDB_OK", "RECOVERY_WORKSPACE"],
  ),
);
export let { listRecovery, selectRecovery, validateRecovery, restoreRecovery } = caseRecovery;
const { recoverySharedState, persistRecoveryState } = caseRecovery;

const worksheetWorkflow = createWorksheetWorkflow(
  deferredServices(
    {
      sourceDocFor: () => sourceDocFor,
      today: () => today,
      newDocuments: () => newDocuments,
      dueCheck: () => dueCheck,
      saveDrafts: () => saveDrafts,
      render: () => render,
      toast: () => toast,
      clearWalk: () => clearWalk,
    },
    ["today", "newDocuments"],
  ),
);
export let { unissuedVisitFor, worksheetFaults, returnToWorksheet, restorePreviousDraft, discardWorksheet } = worksheetWorkflow;

const recoveryUI = createRecoveryUI(
  deferredServices(
    {
      document: () => document,
      ENTRY_IDS: () => ENTRY_IDS,
      recordFormKey: () => recordFormKey,
      cancelCaseLookup: () => cancelCaseLookup,
      captureWork: () => captureWork,
      clearTimeout: () => clearTimeout,
      navigation: () => navigation,
      render: () => render,
      toast: () => toast,
      restoreWorkspaceBackup: () => restoreWorkspaceBackup,
      caseUnsaved: () => caseUnsaved,
    },
    ["document", "ENTRY_IDS", "navigation"],
  ),
);
export let { restoreWorkControls, saveAndContinue, restoreWorkspaceFile, renderRecoveryStatus, recoveryStatusHTML, recoveryModal } = recoveryUI;
const catalogForms = createCatalogForms(deferredServices({ localStorage: () => localStorage }, ["localStorage"]));
export let { keepCatalogForms } = catalogForms;
const recordHistory = createRecordHistory(deferredServices({ fmtDate: () => fmtDate }));
export let { recordHistoryHTML, revisionPrintNote } = recordHistory;

const inspectionHistory = createInspectionHistory(deferredServices({ correctionVisitPatch: () => correctionVisitPatch }));
export let { documentItemHistory } = inspectionHistory;
const correctionUI = createCorrectionUI(
  deferredServices({ correctionChanges: () => correctionChanges, today: () => today, correctionTypeAllowed: () => correctionTypeAllowed }, ["today"]),
);
export let { correctionDiffHTML, correctionPanel, recordActionModal } = correctionUI;
const { correctionValueText } = correctionUI;
const recordActions = createRecordActions(
  deferredServices({
    issueCorrection: () => issueCorrection,
    publishDocument: () => publishDocument,
    correctionEligibility: () => correctionEligibility,
    toast: () => toast,
    evid: () => evid,
    render: () => render,
    commitAmendment: () => commitAmendment,
  }),
);
export let { runFinalize, voidDocument, addRecordNote, reconcileDocument, commitRecordAttempt } = recordActions;

const workingPapers = createWorkingPapers(
  deferredServices(
    { ensureWalkContext: () => ensureWalkContext, ENTRY_IDS: () => ENTRY_IDS, document: () => document, recordFormKey: () => recordFormKey },
    ["ENTRY_IDS", "document"],
  ),
);
export let { captureWork } = workingPapers;
const citationDrafts = createCitationDrafts(
  deferredServices(
    {
      priorCitations: () => priorCitations,
      uid: () => uid,
      today: () => today,
      citationNumber: () => citationNumber,
      fmtDate: () => fmtDate,
      nextCourtDate: () => nextCourtDate,
      applyDeposit: () => applyDeposit,
      saveDrafts: () => saveDrafts,
      depositStep: () => depositStep,
      sourceDocFor: () => sourceDocFor,
      unissuedVisitFor: () => unissuedVisitFor,
    },
    ["today", "depositStep"],
  ),
);
export let { citationTier, citationFromNotice, needsInitialCitation, citationRecoveryPanel } = citationDrafts;
const visitRecording = createVisitRecording(
  deferredServices({
    appendEvent: () => appendEvent,
    saveDrafts: () => saveDrafts,
    toast: () => toast,
    fmtDate: () => fmtDate,
    render: () => render,
  }),
);
export let { recordReinspection } = visitRecording;

const documentPrinting = createDocumentPrinting(
  deferredServices(
    {
      fmtDate: () => fmtDate,
      today: () => today,
      document: () => document,
      citationDepositFault: () => citationDepositFault,
      documentHTML: () => documentHTML,
      snow: () => snow,
      printableHTML: () => printableHTML,
      paginate: () => paginate,
    },
    ["today", "document", "snow"],
  ),
);
export let { printJob } = documentPrinting;
const { documentFileName } = documentPrinting;
const documentDelivery = createDocumentDelivery(
  deferredServices(
    {
      authFetch: () => authFetch,
      fmtDate: () => fmtDate,
      today: () => today,
      toast: () => toast,
      toastHold: () => toastHold,
      render: () => render,
      documentFileName: () => documentFileName,
      printJob: () => printJob,
      document: () => document,
      window: () => window,
      URL: () => URL,
      Blob: () => Blob,
      atob: () => atob,
      setTimeout: () => setTimeout,
      confirm: () => confirm,
      printNotice: () => printNotice,
      recordIntegrity: () => recordIntegrity,
      appendEvent: () => appendEvent,
      saveCaseFile: () => saveCaseFile,
      refreshArtifactLocations: () => refreshArtifactLocations,
    },
    ["today", "document", "window", "URL", "Blob", "recordIntegrity"],
  ),
);
export let { checkHelper, emailDocument, openIssuedCopy, filePdf } = documentDelivery;

const documentReadiness = createDocumentReadiness(
  deferredServices(
    {
      addressProblem: () => addressProblem,
      validateAndStandardizeAddresses: () => validateAndStandardizeAddresses,
      correctionChecks: () => correctionChecks,
      lifecycleChecks: () => lifecycleChecks,
      authoringChecks: () => authoringChecks,
      citationDepositFault: () => citationDepositFault,
      catalogDraftBlocked: () => catalogDraftBlocked,
      initialCitations: () => initialCitations,
      newDocuments: () => newDocuments,
      snow: () => snow,
      unchangedCorrectionValue: () => unchangedCorrectionValue,
      unchangedCourtDate: () => unchangedCourtDate,
      attachCheckTargets: () => attachCheckTargets,
      today: () => today,
    },
    ["initialCitations", "newDocuments", "snow", "today"],
  ),
);
export let { checks } = documentReadiness;
const dep_checks = checks;

const documentFeedback = createDocumentFeedback(
  deferredServices({ A11Y: () => A11Y, isLocked: () => isLocked, document: () => document, Event: () => Event }, ["A11Y", "document", "Event"]),
);
export let { toast, toastHold, toastUndo, fillBlank } = documentFeedback;
const documentSources = createDocumentSources(
  deferredServices({ snow: () => snow, initialOrderCitation: () => initialOrderCitation, docBody: () => docBody, docBlocks: () => docBlocks }, [
    "snow",
  ]),
);
export let { activeBlocks, freezeSources } = documentSources;

const courtScheduling = createCourtScheduling({
  get today() {
    return today;
  },
  nowMillis: () => Date.now(),
  random: () => Math.random(),
});
export let { nextCourtDate, citationNumber } = courtScheduling;
const citationCharges = createCitationCharges(
  deferredServices({ citationPricing: () => citationPricing, citationPricingDate: () => citationPricingDate, document: () => document }, [
    "citationPricing",
    "document",
  ]),
);
export let { changeCharge: changeChargeBasis, applyDeposit } = citationCharges;
const { changeCharge } = citationCharges;

const documentRenderer = createDocumentRenderer(
  deferredServices(
    {
      fmtDate: () => fmtDate,
      fmtTime: () => fmtTime,
      inspAt: () => inspAt,
      longDate: () => longDate,
      parseTime: () => parseTime,
      validISO: () => validISO,
      documentItemHistory: () => documentItemHistory,
      revisionPrintNote: () => revisionPrintNote,
      hasItemInspectionHistory: () => hasItemInspectionHistory,
      catalogDraftNotice: () => catalogDraftNotice,
      newDocuments: () => newDocuments,
      MINDUE: () => MINDUE,
      agentLines: () => agentLines,
      ccLines: () => ccLines,
      docBlocks: () => docBlocks,
      docBody: () => docBody,
      initialCitations: () => initialCitations,
      isLocked: () => isLocked,
      snow: () => snow,
      structEditable: () => structEditable,
      docCase: () => docCase,
      docInsp: () => docInsp,
      eventsFor: () => eventsFor,
    },
    ["newDocuments", "initialCitations", "snow"],
  ),
);
export const { documentHTML, citationFaces } = documentRenderer;
const { noticeHTML, citAmount, referralHistoryHTML } = documentRenderer;

export const app_savedworkContext = createSavedWorkContext(
  deferredServices(
    {
      caseUnsaved: () => caseUnsaved,
      caseState: () => caseState,
      recoveryStatusHTML: () => recoveryStatusHTML,
      pdfTransferState: () => pdfTransferState,
      A11Y: () => A11Y,
      CASEDIR_EXPECT: () => CASEDIR_EXPECT,
      COMMITTED: () => COMMITTED,
      recordIntegrity: () => recordIntegrity,
      storageMode: () => storageMode,
    },
    ["caseUnsaved", "caseState", "recoveryStatusHTML", "pdfTransferState", "A11Y", "CASEDIR_EXPECT", "COMMITTED", "recordIntegrity", "storageMode"],
  ),
);
export const app_workspacequeueContext = createWorkspaceQueueContext(
  deferredServices(
    {
      caseNumberAllowed: () => caseNumberAllowed,
      pdfTransferState: () => pdfTransferState,
      recordIntegrity: () => recordIntegrity,
      snow: () => snow,
    },
    ["caseNumberAllowed", "pdfTransferState", "recordIntegrity", "snow"],
  ),
);
export const app_languagediscoveryContext = createLanguageDiscoveryContext(
  deferredServices(
    {
      allItems: () => allItems,
      shell: () => shell,
      catalogKey: () => catalogKey,
      catalogItem: () => catalogItem,
      catalogReviewPanel: () => catalogReviewPanel,
      catalogStatus: () => catalogStatus,
      catalogVisible: () => catalogVisible,
      effectiveCatalog: () => effectiveCatalog,
    },
    ["allItems", "shell", "catalogKey", "catalogItem", "catalogReviewPanel", "catalogStatus", "catalogVisible", "effectiveCatalog"],
  ),
);

const documentPagination = createDocumentPagination(
  deferredServices({ PAGE_PX: () => PAGE_PX, snow: () => snow, hasItemInspectionHistory: () => hasItemInspectionHistory }, ["PAGE_PX", "snow"]),
);
// Retain the original mutable function binding used by the existing disclosure audit.
export let { paginate } = documentPagination;
const { contHead } = documentPagination;

/* Feature interfaces are lazy: no service or later state is read during construction. */
const utilityEvents = createUtilityEvents(
  deferredServices(
    {
      checks: () => checks,
      focusCheckTarget: () => focusCheckTarget,
      highlightOpenChecks: () => highlightOpenChecks,
      navigation: () => navigation,
      render: () => render,
      saveDrafts: () => saveDrafts,
      toast: () => toast,
      worksheetChecks: () => worksheetChecks,
    },
    ["navigation"],
  ),
);
const recoveryEvents = createRecoveryEvents({
  ui: deferredServices({ captureWork: () => captureWork, render: () => render, scheduleDraftSave: () => scheduleDraftSave, toast: () => toast }),
  recovery: deferredServices(
    {
      ENTRY_IDS: () => ENTRY_IDS,
      IDB_OK: () => IDB_OK,
      discardDraft: () => discardDraft,
      downloadWorkspace: () => downloadWorkspace,
      helperJSON: () => helperJSON,
      keepChangedLocal: () => keepChangedLocal,
      listRecovery: () => listRecovery,
      loadCaseFile: () => loadCaseFile,
      openChangedShared: () => openChangedShared,
      recordFormKey: () => recordFormKey,
      restorePreviousDraft: () => restorePreviousDraft,
      restoreRecovery: () => restoreRecovery,
      restoreWorkspaceFile: () => restoreWorkspaceFile,
      returnToWorksheet: () => returnToWorksheet,
      saveAndContinue: () => saveAndContinue,
      saveDrafts: () => saveDrafts,
      selectRecovery: () => selectRecovery,
      validateRecovery: () => validateRecovery,
    },
    ["ENTRY_IDS", "IDB_OK"],
  ),
  publication: deferredServices(
    {
      citationFromNotice: () => citationFromNotice,
      downloadFile: () => downloadFile,
      filePdf: () => filePdf,
      initialCitations: () => initialCitations,
      isLocked: () => isLocked,
      needsInitialCitation: () => needsInitialCitation,
      printJob: () => printJob,
      publishDocument: () => publishDocument,
    },
    ["initialCitations"],
  ),
});
const catalogEvents = createCatalogEvents(
  deferredServices(
    {
      adoptCatalogReview: () => adoptCatalogReview,
      catalogForm: () => catalogForm,
      catalogItem: () => catalogItem,
      catalogKey: () => catalogKey,
      catalogReplacementOptions: () => catalogReplacementOptions,
      catalogReview: () => catalogReview,
      catalogSelection: () => catalogSelection,
      catalogStatus: () => catalogStatus,
      helperJSON: () => helperJSON,
      keepCatalogForms: () => keepCatalogForms,
      languageClick: () => languageClick,
      refreshCatalog: () => refreshCatalog,
      refreshOverlay: () => refreshOverlay,
      render: () => render,
      renumber: () => renumber,
      saveDrafts: () => saveDrafts,
      snow: () => snow,
      structEditable: () => structEditable,
      toast: () => toast,
      toggleLibraryItem: () => toggleLibraryItem,
    },
    ["snow"],
  ),
);
const safetyEvents = createSafetyEvents(
  deferredServices(
    {
      A11Y: () => A11Y,
      applyConflict: () => applyConflict,
      backupUnfinished: () => backupUnfinished,
      caseState: () => caseState,
      commitAmendment: () => commitAmendment,
      flushPending: () => flushPending,
      helperJSON: () => helperJSON,
      inspectLock: () => inspectLock,
      pdfTransferState: () => pdfTransferState,
      preflightCase: () => preflightCase,
      recordIntegrity: () => recordIntegrity,
      recoveryJobs: () => recoveryJobs,
      refreshCatalog: () => refreshCatalog,
      render: () => render,
      saveCaseFile: () => saveCaseFile,
      saveDrafts: () => saveDrafts,
      showHealth: () => showHealth,
      showLock: () => showLock,
      showOutbox: () => showOutbox,
      showSafety: () => showSafety,
      startReinspection: () => startReinspection,
      toast: () => toast,
    },
    ["A11Y", "recordIntegrity"],
  ),
);
const workflowEvents = createWorkflowEvents(
  deferredServices(
    {
      checkHelper: () => checkHelper,
      downloadFile: () => downloadFile,
      globalSearch: () => globalSearch,
      helperJSON: () => helperJSON,
      navigation: () => navigation,
      persistWorkspacePatch: () => persistWorkspacePatch,
      planBulkDue: () => planBulkDue,
      printOutbox: () => printOutbox,
      refreshArtifactLocations: () => refreshArtifactLocations,
      render: () => render,
      saveWorkflowPrefs: () => saveWorkflowPrefs,
      selectedOutbox: () => selectedOutbox,
      showBulkDue: () => showBulkDue,
      showOutbox: () => showOutbox,
      showReminderDraft: () => showReminderDraft,
      showReminders: () => showReminders,
      showTimeline: () => showTimeline,
      timelineCategory: () => timelineCategory,
      timelineRows: () => timelineRows,
      toast: () => toast,
      validISO: () => validISO,
      writerOpenReportedCase: () => writerOpenReportedCase,
    },
    ["navigation"],
  ),
);
const workspaceEvents = createWorkspaceEvents({
  ui: deferredServices(
    {
      captureWork: () => captureWork,
      navigation: () => navigation,
      refreshOverlay: () => refreshOverlay,
      render: () => render,
      saveWorkflowPrefs: () => saveWorkflowPrefs,
      toast: () => toast,
    },
    ["navigation"],
  ),
  events: deferredServices(
    {
      catalogEvents: () => catalogEvents,
      citationEvents: () => citationEvents,
      contactEvents: () => contactEvents,
      correctionEvents: () => correctionEvents,
      editorEvents: () => editorEvents,
      importEvents: () => importEvents,
      recoveryEvents: () => recoveryEvents,
      reinspectionEvents: () => reinspectionEvents,
      workflowEvents: () => workflowEvents,
    },
    [
      "catalogEvents",
      "citationEvents",
      "contactEvents",
      "correctionEvents",
      "editorEvents",
      "importEvents",
      "recoveryEvents",
      "reinspectionEvents",
      "workflowEvents",
    ],
  ),
  cases: deferredServices({
    caseFile: () => caseFile,
    caseFileName: () => caseFileName,
    caseNumberAllowed: () => caseNumberAllowed,
    caseState: () => caseState,
    caseUnsaved: () => caseUnsaved,
    clearCases: () => clearCases,
    downloadFile: () => downloadFile,
    flushPending: () => flushPending,
    grantCaseFolder: () => grantCaseFolder,
    linkCaseFolder: () => linkCaseFolder,
    listCaseFolder: () => listCaseFolder,
    openFromFolder: () => openFromFolder,
    pickCaseFile: () => pickCaseFile,
    preflightCase: () => preflightCase,
    rebuildIndex: () => rebuildIndex,
    removeCase: () => removeCase,
    rnd12: () => rnd12,
    saveCaseFile: () => saveCaseFile,
    startReinspection: () => startReinspection,
    storageMode: () => storageMode,
    testWrite: () => testWrite,
  }),
});
const citationEvents = createCitationEvents(
  deferredServices(
    {
      depositStep: () => depositStep,
      editCitation: () => editCitation,
      initialCitations: () => initialCitations,
      isLocked: () => isLocked,
      refreshSheet: () => refreshSheet,
      render: () => render,
      saveDrafts: () => saveDrafts,
      scheduleDraftSave: () => scheduleDraftSave,
      structEditable: () => structEditable,
      syncChip: () => syncChip,
      dueDateEvents: () => dueDateEvents,
    },
    ["depositStep", "initialCitations", "dueDateEvents"],
  ),
);
const dueDateEvents = createDueDateEvents(
  deferredServices({
    activeDueTarget: () => activeDueTarget,
    assignDue: () => assignDue,
    dueContext: () => dueContext,
    dueSelectedText: () => dueSelectedText,
    isLocked: () => isLocked,
    render: () => render,
    saveDrafts: () => saveDrafts,
    scheduleDraftSave: () => scheduleDraftSave,
    toast: () => toast,
    toastUndo: () => toastUndo,
  }),
);
const openCaseList = createOpenCaseList(
  deferredServices({
    helperJSON: () => helperJSON,
    render: () => render,
    findDatabaseCase: () => findDatabaseCase,
  }),
);
/* The Import inspection screen with the open-case list above the case-number lookup. */
const importScreen = () => screenImport(openCaseList.card());
const openCaseEvents = createOpenCaseEvents(deferredServices({ openCaseList: () => openCaseList }, ["openCaseList"]));
const importEvents = createImportEvents(
  deferredServices({
    accelaFromShare: () => accelaFromShare,
    accelaPlan: () => accelaPlan,
    acceptAccela: () => acceptAccela,
    cancelCaseLookup: () => cancelCaseLookup,
    confirmDatabaseCase: () => confirmDatabaseCase,
    findDatabaseCase: () => findDatabaseCase,
    openImportWorkspace: () => openImportWorkspace,
    pickAccelaFile: () => pickAccelaFile,
    preflightCase: () => preflightCase,
    readAccelaFile: () => readAccelaFile,
    render: () => render,
    renderKeep: () => renderKeep,
    saveDrafts: () => saveDrafts,
    scheduleDraftSave: () => scheduleDraftSave,
    selectImportInspection: () => selectImportInspection,
  }),
);
const reinspectionEvents = createReinspectionEvents(
  deferredServices({
    advanceWalk: () => advanceWalk,
    changeVisitDate: () => changeVisitDate,
    clearWalk: () => clearWalk,
    discardWorksheet: () => discardWorksheet,
    docFromReinspection: () => docFromReinspection,
    ensureWalkContext: () => ensureWalkContext,
    focusWalkItem: () => focusWalkItem,
    nextWalkItem: () => nextWalkItem,
    preflightCase: () => preflightCase,
    previousWalk: () => previousWalk,
    recordReinspection: () => recordReinspection,
    recordReinspectionOutcome: () => recordReinspectionOutcome,
    render: () => render,
    renderKeep: () => renderKeep,
    returnWalkDetails: () => returnWalkDetails,
    saveCaseFile: () => saveCaseFile,
    saveDrafts: () => saveDrafts,
    scheduleDraftSave: () => scheduleDraftSave,
    skipWalkDetails: () => skipWalkDetails,
    startReinspection: () => startReinspection,
    toast: () => toast,
    undoWalkOutcome: () => undoWalkOutcome,
    walkIdentity: () => walkIdentity,
  }),
);
const editorEvents = createEditorEvents({
  ui: deferredServices({
    fillBlank: () => fillBlank,
    refreshSheet: () => refreshSheet,
    render: () => render,
    syncChip: () => syncChip,
    toast: () => toast,
    toastUndo: () => toastUndo,
  }),
  events: deferredServices(
    {
      catalogEvents: () => catalogEvents,
      citationEvents: () => citationEvents,
      contactEvents: () => contactEvents,
      correctionEvents: () => correctionEvents,
      importEvents: () => importEvents,
      reinspectionEvents: () => reinspectionEvents,
      workspaceEvents: () => workspaceEvents,
    },
    ["catalogEvents", "citationEvents", "contactEvents", "correctionEvents", "importEvents", "reinspectionEvents", "workspaceEvents"],
  ),
  actions: deferredServices(
    {
      MINDUE: () => MINDUE,
      blockers: () => blockers,
      captureWork: () => captureWork,
      grantCaseFolder: () => grantCaseFolder,
      initialCitations: () => initialCitations,
      isLocked: () => isLocked,
      issueCorrection: () => issueCorrection,
      moveItem: () => moveItem,
      newDoc: () => newDoc,
      newDocuments: () => newDocuments,
      openIssuedCopy: () => openIssuedCopy,
      parseDate: () => parseDate,
      parseTime: () => parseTime,
      preflightCase: () => preflightCase,
      printJob: () => printJob,
      printNotice: () => printNotice,
      refreshCatalog: () => refreshCatalog,
      renumber: () => renumber,
      runFinalize: () => runFinalize,
      saveDrafts: () => saveDrafts,
      scheduleDraftSave: () => scheduleDraftSave,
      splitOwner: () => splitOwner,
      structEditable: () => structEditable,
      unchangedCorrectionValue: () => unchangedCorrectionValue,
      updateDueIndicators: () => updateDueIndicators,
    },
    ["initialCitations", "newDocuments"],
  ),
});
const specialDocumentEvents = createSpecialDocumentEvents(deferredServices({ newDocuments: () => newDocuments }, ["newDocuments"]));
const correctionEvents = createCorrectionEvents(
  deferredServices({
    addRecordNote: () => addRecordNote,
    commitAmendment: () => commitAmendment,
    correctionChanges: () => correctionChanges,
    correctionTypeAllowed: () => correctionTypeAllowed,
    docBody: () => docBody,
    downloadFile: () => downloadFile,
    isLocked: () => isLocked,
    issueCorrection: () => issueCorrection,
    itemHistory: () => itemHistory,
    itemInspectionHistory: () => itemInspectionHistory,
    preflightCase: () => preflightCase,
    reconcileDocument: () => reconcileDocument,
    render: () => render,
    saveDrafts: () => saveDrafts,
    scheduleDraftSave: () => scheduleDraftSave,
    startCorrection: () => startCorrection,
    toast: () => toast,
    voidDocument: () => voidDocument,
  }),
);
const contactEvents = createContactEvents(
  deferredServices({
    addCC: () => addCC,
    addEmail: () => addEmail,
    emailDocument: () => emailDocument,
    recipientPreview: () => recipientPreview,
    refreshOverlay: () => refreshOverlay,
    removeCC: () => removeCC,
    removeEmail: () => removeEmail,
    render: () => render,
    scheduleDraftSave: () => scheduleDraftSave,
    validateAndStandardizeAddresses: () => validateAndStandardizeAddresses,
  }),
);
utilityEvents.registerHelpClicks();
utilityEvents.registerHelpKeys();
utilityEvents.registerHelpClose();
const $testFixtures = __TEST_BUILD__
  ? initTestFixtures(
      deferredServices({
        fmtDate: () => fmtDate,
        freezeSources: () => freezeSources,
        toast: () => toast,
        appendEvent: () => appendEvent,
        project: () => project,
        saveDrafts: () => saveDrafts,
        validateAndStandardizeAddresses: () => validateAndStandardizeAddresses,
        recordReinspection: () => recordReinspection,
        startCorrection: () => startCorrection,
        render: () => render,
        MINDUE: () => MINDUE,
      }),
    )
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
  libStatus: "usable",
  pickerStatus: "usable",
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

export { ccLines, agentLines };

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
openCaseEvents.registerOpenCaseSubmit();
openCaseEvents.registerOpenCaseInputs();
openCaseEvents.registerOpenCaseClicks();

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
const writerStartup = createWriterStartup(
  deferredServices(
    {
      navigator: () => navigator,
      document: () => document,
      location: () => location,
      restoreCaseFolder: () => restoreCaseFolder,
      initWriterHandoff: () => initWriterHandoff,
      markWriterReady: () => markWriterReady,
      markWriterFailed: () => markWriterFailed,
      refreshArtifactLocations: () => refreshArtifactLocations,
      refreshCatalog: () => refreshCatalog,
      recordIntegrity: () => recordIntegrity,
      restoreDrafts: () => restoreDrafts,
      restorePending: () => restorePending,
      flushPending: () => flushPending,
      checkHelper: () => checkHelper,
      scheduleRecoveryBackup: () => scheduleRecoveryBackup,
    },
    ["navigator", "document", "location", "recordIntegrity"],
  ),
);
export let { bootStorage } = writerStartup;
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
    CHARGE_DERIVED,
    changeCharge,
    documentFileName,
    correctionValueText,
    recoveryIncluded,
    recoverySharedState,
    persistRecoveryState,
    remindersDue,
    worksheetCheckPanel,
    resolvedCaseFields,
    statusRule,
    accStatusEligible,
    accTime,
    accInspector,
    LOOKUP_READY,
    accelaTable,
    baseLookupPlan,
    readAccelaFile,
    baseLookupAccept,
    openImportWorkspace,
    lookupCard,
    cancelCaseLookup,
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
