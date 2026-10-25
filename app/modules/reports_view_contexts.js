import { ReportsState } from "./state.js";

/* Named lazy dependencies keep this owner independent of Reports startup. */
export function createReportsViewContext(services) {
  function reports_reportpresentationContext() {
    return {
      REPORTS: services.ctx_reports_REPORTS,
      S: ReportsState.S,
      SAVED_VIEWS: ReportsState.SAVED_VIEWS,
      areaKey: services.ctx_reports_areaKey,
      areaLabel: services.ctx_reports_areaLabel,
      esc: services.ctx_reports_esc,
      fmtDate: services.ctx_reports_fmtDate,
      fmtNum: services.ctx_reports_fmtNum,
      ownerKeyLabel: services.ctx_reports_ownerKeyLabel,
      plural: services.ctx_reports_plural,
      reportById: services.ctx_reports_reportById,
    };
  }
  return { reports_reportpresentationContext };
}
