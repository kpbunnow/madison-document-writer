import { reportSort } from "./contracts.js";

/* Optional Writer return preferences do not initialize Reports or acquire storage authority. */
export function createReportReturn(services) {
  function restoreReportReturn() {
    try {
      const x = JSON.parse(localStorage.getItem("madison-report-return-v1") || "null");
      if (!x || !services.reportById(x.report)) return false;
      services.state.screen = x.report;
      services.state.F = { ...services.state.F, ...x.filters };
      services.state.F.ord = services.reportOrdinance(services.state.F.ord);
      services.state.view = x.view === "map" ? "map" : "table";
      services.state.tableSort = reportSort(x.sort, x.report);
      services.state.dateMode = x.dateMode || "fixed";
      if (services.relativeDates(services.state.dateMode)) Object.assign(services.state.F, services.relativeDates(services.state.dateMode));
      // A drill-down or saved-view selection opened since the handoff belongs to another context; like
      // applyReportView, start the restored report without either so nothing outside its scope stays visible.
      services.state.drill = null;
      services.state.savedId = "";
      services.state.reportNotice = "Returned to the saved report context.";
      services.render();
      return true;
    } catch (e) {
      /* A missing optional return preference does not affect report records or filters. */
      return false;
    }
  }
  return restoreReportReturn;
}
