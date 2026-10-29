import { ReportsState } from "./state.js";
import { reportSort } from "./contracts.js";

/* Optional Writer return preferences do not initialize Reports or acquire storage authority. */
export function createReportReturn(services) {
  function restoreReportReturn() {
    try {
      const x = JSON.parse(localStorage.getItem("madison-report-return-v1") || "null");
      if (!x || !services.reportById(x.report)) return false;
      ReportsState.S.screen = x.report;
      ReportsState.S.F = { ...ReportsState.S.F, ...x.filters };
      ReportsState.S.F.ord = services.reportOrdinance(ReportsState.S.F.ord);
      ReportsState.S.view = x.view === "map" ? "map" : "table";
      ReportsState.S.tableSort = reportSort(x.sort, x.report);
      ReportsState.S.dateMode = x.dateMode || "fixed";
      if (services.relativeDates(ReportsState.S.dateMode)) Object.assign(ReportsState.S.F, services.relativeDates(ReportsState.S.dateMode));
      // A drill-down or saved-view selection opened since the handoff belongs to another context; like
      // applyReportView, start the restored report without either so nothing outside its scope stays visible.
      ReportsState.S.drill = null;
      ReportsState.S.savedId = "";
      ReportsState.S.reportNotice = "Returned to the saved report context.";
      services.render();
      return true;
    } catch (e) {
      /* A missing optional return preference does not affect report records or filters. */
      return false;
    }
  }
  return restoreReportReturn;
}
