import { startupState as startup } from "./startup_state.js";
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { catalogState as catalog } from "./catalog_state.js";
/* View-scoped dependencies are supplied by core; each call reads current workspace facts. */

import { caseFileName as ctx_app_caseFileName, summaryName as ctx_app_summaryName } from "./case_file_rules.js";

import { checkAttr as ctx_app_checkAttr, esc as ctx_app_esc, markBlanks as ctx_app_markBlanks } from "./presentation_format.js";
import { deliveredByCitation as ctx_app_deliveredByCitation, itemLibraryKey as ctx_app_itemLibraryKey } from "./document_rules.js";
import { doc as ctx_app_doc, docsFor as ctx_app_docsFor, kase as ctx_app_kase } from "./writer_queries.js";
import { LIBRARY as ctx_app_LIBRARY } from "./data/library.js";
export function createSavedWorkContext(services) {
  function app_savedworkContext() {
    return {
      A11Y: services.A11Y,
      CASEDIR: workspace.CASEDIR,
      CASEDIR_EXPECT: services.CASEDIR_EXPECT,
      CASES: workspace.CASES,
      CATALOG_AT: catalog.CATALOG_AT,
      COMMITTED: services.COMMITTED,
      DIRNAME: workspace.DIRNAME,
      HELPER: startup.HELPER,
      LOCAL_SAVE: editor.LOCAL_SAVE,
      NEEDGRANT: workspace.NEEDGRANT,
      PENDING: workspace.PENDING,
      PREFLIGHT_CONFLICT: workspace.PREFLIGHT_CONFLICT,
      caseFileName: ctx_app_caseFileName,
      caseState: services.caseState,
      caseUnsaved: services.caseUnsaved,
      deliveredByCitation: ctx_app_deliveredByCitation,
      docsFor: ctx_app_docsFor,
      draftTimer: editor.draftTimer,
      esc: ctx_app_esc,
      kase: ctx_app_kase,
      pdfTransferState: services.pdfTransferState,
      recordIntegrity: services.recordIntegrity,
      recoveryStatusHTML: services.recoveryStatusHTML,
      storageMode: services.storageMode,
      summaryName: ctx_app_summaryName,
    };
  }
  return app_savedworkContext;
}

export function createWorkspaceQueueContext(services) {
  function app_workspacequeueContext() {
    return {
      ARTIFACT_LOCATIONS: workspace.ARTIFACT_LOCATIONS,
      CASEDIR: workspace.CASEDIR,
      NEEDGRANT: workspace.NEEDGRANT,
      PREFLIGHT_CONFLICT: workspace.PREFLIGHT_CONFLICT,
      caseNumberAllowed: services.caseNumberAllowed,
      docsFor: ctx_app_docsFor,
      esc: ctx_app_esc,
      pdfTransferState: services.pdfTransferState,
      recordIntegrity: services.recordIntegrity,
      snow: services.snow,
    };
  }
  return app_workspacequeueContext;
}

export function createLanguageDiscoveryContext(services) {
  function app_languagediscoveryContext() {
    return {
      CATALOG_AT: catalog.CATALOG_AT,
      CATALOG_ERROR: catalog.CATALOG_ERROR,
      CATALOG_FROM_CACHE: catalog.CATALOG_FROM_CACHE,
      LIBRARY: ctx_app_LIBRARY,
      allItems: services.allItems,
      catalogItem: services.catalogItem,
      catalogKey: services.catalogKey,
      catalogReviewPanel: services.catalogReviewPanel,
      catalogStatus: services.catalogStatus,
      catalogVisible: services.catalogVisible,
      checkAttr: ctx_app_checkAttr,
      doc: ctx_app_doc,
      effectiveCatalog: services.effectiveCatalog,
      esc: ctx_app_esc,
      itemLibraryKey: ctx_app_itemLibraryKey,
      markBlanks: ctx_app_markBlanks,
      shell: services.shell,
      state: editor.state,
    };
  }
  return app_languagediscoveryContext;
}
