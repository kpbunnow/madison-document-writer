import { areaKey as ctx_reports_areaKey } from "./reports_services.js";
import {
  REPORTS as ctx_reports_REPORTS,
  areaLabel as ctx_reports_areaLabel,
  esc as ctx_reports_esc,
  fmtDate as ctx_reports_fmtDate,
  fmtNum as ctx_reports_fmtNum,
  ownerKeyLabel as ctx_reports_ownerKeyLabel,
  plural as ctx_reports_plural,
  reportById as ctx_reports_reportById,
} from "./reports_core.js";
import { ReportsState } from "./state.js";
export function reports_reportpresentationContext() {
  return {
    REPORTS: ctx_reports_REPORTS,
    S: ReportsState.S,
    SAVED_VIEWS: ReportsState.SAVED_VIEWS,
    areaKey: ctx_reports_areaKey,
    areaLabel: ctx_reports_areaLabel,
    esc: ctx_reports_esc,
    fmtDate: ctx_reports_fmtDate,
    fmtNum: ctx_reports_fmtNum,
    ownerKeyLabel: ctx_reports_ownerKeyLabel,
    plural: ctx_reports_plural,
    reportById: ctx_reports_reportById,
  };
}
