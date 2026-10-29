/* Real Reports owners; feature listeners are composed explicitly without application startup. */
const path = require("node:path"),
  esbuild = require("esbuild");
module.exports = async function createReportExports({ navigation = false, deposits = false } = {}) {
  const result = await esbuild.build({
      stdin: {
        contents:
          'export {initDepositSchedule} from "./deposit_schedule.js";export {createReportNavigation} from "./report_navigation.js";export {esc} from "./presentation_format.js";export * as facts from "./report_facts.js";export * as metadata from "./report_metadata.js";export {reportActions} from "./report_presentation.js";export {createReportsServices} from "./reports_services.js";export {createReportCatalog} from "./report_catalog.js";export {createReportsScreens} from "./reports_screens.js";export {ReportsState} from "./state.js";',
        resolveDir: path.resolve(__dirname, "../../app/modules"),
      },
      bundle: true,
      format: "cjs",
      write: false,
      define: { __TEST_BUILD__: "false" },
      plugins: [
        {
          name: "data",
          setup(b) {
            b.onResolve({ filter: /\/data\// }, (a) => ({
              path: path.resolve(__dirname, "../../build/generated/modules/data", path.basename(a.path)),
            }));
          },
        },
      ],
    }),
    box = { exports: {} };
  const transport = { fetch: (...args) => global.fetch(...args) };
  new Function("fetch", "module", "exports", result.outputFiles[0].text)((...args) => transport.fetch(...args), box, box.exports);
  const {
      initDepositSchedule,
      createReportNavigation,
      esc,
      facts,
      metadata,
      reportActions,
      createReportsServices,
      createReportCatalog,
      createReportsScreens,
      ReportsState,
    } = box.exports,
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
    parcels: {},
    areas: null,
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
  let reports, screens;
  const reportById = (id) => reports.find((r) => r.id === id),
    render = () => {
      calculations.render();
    };
  const calculations = createReportsServices({
    render,
    reportById,
    REPORT_VIEWS_KEY: "madison-report-views-v1",
    shell: () => screens.shell(),
    A11Y: { enhance() {}, notify() {} },
    TODAY,
    iso: facts.iso,
    STREET_WORDS: facts.STREET_WORDS,
    areaIdOf: facts.areaIdOf,
    uniq: facts.uniq,
    validISO: facts.validISO,
    violOk: facts.violOk,
  });
  const areaLabel = facts.createReportAreaLabel(() => ReportsState.S.F);
  reports = createReportCatalog({ ...facts, areaLabel, ...calculations, TODAY, openAt: (c, date) => facts.openAt(c, date, calculations) });
  const context = () => ({
    ...facts,
    areaLabel,
    esc,
    areaKey: calculations.areaKey,
    REPORTS: reports,
    S: ReportsState.S,
    SAVED_VIEWS: ReportsState.SAVED_VIEWS,
    reportById,
  });
  const depositSchedule = deposits ? initDepositSchedule({ render, esc }) : null;
  screens = createReportsScreens({
    depositSchedule,
    activeFilters: () => facts.activeReportFilters(ReportsState.S.F),
    ...facts,
    areaLabel,
    esc,
    facts: { ...facts, ...calculations, areaLabel },
    REPORTS: reports,
    reportById,
    DEFINITIONS: metadata.DEFINITIONS,
    exports: { EXPORT_SCOPE: metadata.EXPORT_SCOPE },
    humanCorrectionValue: calculations.humanCorrectionValue,
    reports_reportpresentationContext: context,
    actions: () => reportActions(context()),
    STATUSES: ["Notice", "Extension", "Cited", "Referred", "Closed"],
    A11Y: { notify() {} },
  });
  if (navigation)
    document.addEventListener(
      "click",
      createReportNavigation({
        get state() {
          return ReportsState.S;
        },
        iso: facts.iso,
        validISO: facts.validISO,
        TODAY,
        render,
        openCase: screens.openCase,
        openInWriter: calculations.openInWriter,
        loadAll: calculations.loadAll,
        exportWorkbook: screens.exportWorkbook,
        saveReportView: calculations.saveReportView,
        deleteReportView: calculations.deleteReportView,
        propertyHits: screens.propertyHits,
      }),
    );
  return {
    ReportsState,
    buildModel: calculations.buildModel,
    exportSheets: screens.exportSheets,
    render,
    TODAY,
    freshness: screens.freshness,
    currentReportRows: calculations.currentReportRows,
    printReport: calculations.printReport,
    dataView: screens.dataView,
    REPORTS: reports,
    saveReportView: calculations.saveReportView,
    applyReportView: calculations.applyReportView,
    deleteReportView: calculations.deleteReportView,
    loadAll: calculations.loadAll,
    transport,
  };
};
