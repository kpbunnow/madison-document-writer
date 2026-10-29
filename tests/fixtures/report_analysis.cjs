/* Actual calculation, history, catalog and preference owners; rendering is outside these rule tests. */
const path = require("node:path"),
  esbuild = require("esbuild");
module.exports = function createReportAnalysis() {
  const result = esbuild.buildSync({
      stdin: {
        contents:
          'export * as facts from "./report_facts.js";export {createReportsServices} from "./reports_services.js";export {createReportCatalog} from "./report_catalog.js";export {createReportReturn} from "./report_return.js";export {ReportsState} from "./state.js";',
        resolveDir: path.resolve(__dirname, "../../app/modules"),
      },
      bundle: true,
      format: "cjs",
      write: false,
      define: { __TEST_BUILD__: "false" },
    }),
    box = { exports: {} };
  new Function("module", "exports", result.outputFiles[0].text)(box, box.exports);
  const { facts, createReportsServices, createReportCatalog, createReportReturn, ReportsState } = box.exports,
    TODAY = facts.iso(new Date());
  ReportsState.S = {
    phase: "loading",
    M: null,
    raw: null,
    screen: "openCases",
    view: "table",
    drill: null,
    tableSort: null,
    dateMode: "fixed",
    savedId: "",
    reportNotice: "",
    parcelMissing: [],
    F: {
      from: TODAY.slice(0, 4) + "-01-01",
      to: TODAY,
      asOf: TODAY,
      areaType: "district",
      boundary: "current",
      areas: [],
      inspector: "",
      vtype: "",
      ord: "",
      status: "",
      owner: "",
    },
  };
  ReportsState.SAVED_VIEWS = [];
  let reports, restoreReportReturn;
  const render = () => {},
    reportById = (id) => reports.find((r) => r.id === id);
  const service = createReportsServices({
    render,
    reportById,
    get restoreReportReturn() {
      return restoreReportReturn;
    },
    TODAY,
    iso: facts.iso,
    STREET_WORDS: facts.STREET_WORDS,
    areaIdOf: facts.areaIdOf,
    uniq: facts.uniq,
    validISO: facts.validISO,
    violOk: facts.violOk,
  });
  const areaLabel = facts.createReportAreaLabel(() => ReportsState.S.F);
  reports = createReportCatalog({ ...facts, areaLabel, ...service, TODAY, openAt: (c, date) => facts.openAt(c, date, service) });
  restoreReportReturn = createReportReturn({
    get state() {
      return ReportsState.S;
    },
    render,
    reportById,
    reportOrdinance: service.reportOrdinance,
    relativeDates: service.relativeDates,
  });
  return {
    ReportsState,
    buildModel: service.buildModel,
    violOk: facts.violOk,
    reportById,
    applyReportView: service.applyReportView,
    restoreReportReturn,
  };
};
