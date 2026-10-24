import { allItems as ctx_app_allItems } from "./court_and_deposits.js";
import { caseFileName as ctx_app_caseFileName, summaryName as ctx_app_summaryName } from "./case_file_rules.js";
import { caseNumberAllowed as ctx_app_caseNumberAllowed, shell as ctx_app_shell } from "./workspace_shell.js";
import { caseUnsaved as ctx_app_caseUnsaved } from "./case_files.js";
import { caseState as ctx_app_caseState } from "./app_screens.js";
import { catalogKey as ctx_app_catalogKey, recoveryStatusHTML as ctx_app_recoveryStatusHTML } from "./draft_recovery.js";
import {
  catalogItem as ctx_app_catalogItem,
  catalogReviewPanel as ctx_app_catalogReviewPanel,
  catalogStatus as ctx_app_catalogStatus,
  catalogVisible as ctx_app_catalogVisible,
  effectiveCatalog as ctx_app_effectiveCatalog,
} from "./language_catalog.js";
import { pdfTransferState as ctx_app_pdfTransferState } from "./case_timeline.js";
import {
  A11Y as ctx_app_A11Y,
  CASEDIR_EXPECT as ctx_app_CASEDIR_EXPECT,
  COMMITTED as ctx_app_COMMITTED,
  recordIntegrity as ctx_app_recordIntegrity,
  snow as ctx_app_snow,
  storageMode as ctx_app_storageMode,
} from "./app_core.js";

import { checkAttr as ctx_app_checkAttr, esc as ctx_app_esc, markBlanks as ctx_app_markBlanks } from "./presentation_format.js";
import { deliveredByCitation as ctx_app_deliveredByCitation, itemLibraryKey as ctx_app_itemLibraryKey } from "./document_rules.js";
import { doc as ctx_app_doc, docsFor as ctx_app_docsFor, kase as ctx_app_kase } from "./writer_queries.js";
import { LIBRARY as ctx_app_LIBRARY } from "./data/library.js";
import { WriterState } from "./state.js";
export function app_savedworkContext() {
  return {
    A11Y: ctx_app_A11Y,
    CASEDIR: WriterState.CASEDIR,
    CASEDIR_EXPECT: ctx_app_CASEDIR_EXPECT,
    CASES: WriterState.CASES,
    CATALOG_AT: WriterState.CATALOG_AT,
    COMMITTED: ctx_app_COMMITTED,
    DIRNAME: WriterState.DIRNAME,
    HELPER: WriterState.HELPER,
    LOCAL_SAVE: WriterState.LOCAL_SAVE,
    NEEDGRANT: WriterState.NEEDGRANT,
    PENDING: WriterState.PENDING,
    PREFLIGHT_CONFLICT: WriterState.PREFLIGHT_CONFLICT,
    caseFileName: ctx_app_caseFileName,
    caseState: ctx_app_caseState,
    caseUnsaved: ctx_app_caseUnsaved,
    deliveredByCitation: ctx_app_deliveredByCitation,
    docsFor: ctx_app_docsFor,
    draftTimer: WriterState.draftTimer,
    esc: ctx_app_esc,
    kase: ctx_app_kase,
    pdfTransferState: ctx_app_pdfTransferState,
    recordIntegrity: ctx_app_recordIntegrity,
    recoveryStatusHTML: ctx_app_recoveryStatusHTML,
    storageMode: ctx_app_storageMode,
    summaryName: ctx_app_summaryName,
  };
}

export function app_workspacequeueContext() {
  return {
    ARTIFACT_LOCATIONS: WriterState.ARTIFACT_LOCATIONS,
    CASEDIR: WriterState.CASEDIR,
    NEEDGRANT: WriterState.NEEDGRANT,
    PREFLIGHT_CONFLICT: WriterState.PREFLIGHT_CONFLICT,
    caseNumberAllowed: ctx_app_caseNumberAllowed,
    docsFor: ctx_app_docsFor,
    esc: ctx_app_esc,
    pdfTransferState: ctx_app_pdfTransferState,
    recordIntegrity: ctx_app_recordIntegrity,
    snow: ctx_app_snow,
  };
}

export function app_languagediscoveryContext() {
  return {
    CATALOG_AT: WriterState.CATALOG_AT,
    CATALOG_ERROR: WriterState.CATALOG_ERROR,
    CATALOG_FROM_CACHE: WriterState.CATALOG_FROM_CACHE,
    LIBRARY: ctx_app_LIBRARY,
    allItems: ctx_app_allItems,
    catalogItem: ctx_app_catalogItem,
    catalogKey: ctx_app_catalogKey,
    catalogReviewPanel: ctx_app_catalogReviewPanel,
    catalogStatus: ctx_app_catalogStatus,
    catalogVisible: ctx_app_catalogVisible,
    checkAttr: ctx_app_checkAttr,
    doc: ctx_app_doc,
    effectiveCatalog: ctx_app_effectiveCatalog,
    esc: ctx_app_esc,
    itemLibraryKey: ctx_app_itemLibraryKey,
    markBlanks: ctx_app_markBlanks,
    shell: ctx_app_shell,
    state: WriterState.state,
  };
}
