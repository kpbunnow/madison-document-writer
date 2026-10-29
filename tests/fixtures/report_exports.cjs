/* Real report calculations and screen/export owners, with no application startup or event listeners. */
const path = require("node:path"),
  esbuild = require("esbuild");
module.exports = async function createReportExports() {
  const result = await esbuild.build({
      stdin: {
        contents:
          'export {esc} from "./presentation_format.js";export * as facts from "./report_facts.js";export * as metadata from "./report_metadata.js";export {reportActions} from "./report_presentation.js";export {createReportsServices} from "./reports_services.js";export {createReportCatalog} from "./report_catalog.js";export {createReportsScreens} from "./reports_screens.js";export {ReportsState} from "./state.js";',
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
  new Function("module", "exports", result.outputFiles[0].text)(box, box.exports);
  const { esc, facts, metadata, reportActions, createReportsServices, createReportCatalog, createReportsScreens, ReportsState } = box.exports,
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
  let reports, screens;
  const reportById = (id) => reports.find((r) => r.id === id),
    render = () => {
      document.getElementById("app").innerHTML = screens.reportScreen(reportById(ReportsState.S.screen));
    };
  const calculations = createReportsServices({
    render,
    reportById,
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
  screens = createReportsScreens({
    ...facts,
    areaLabel,
    esc,
    facts: { ...facts, ...calculations, areaLabel },
    REPORTS: reports,
    DEFINITIONS: metadata.DEFINITIONS,
    exports: { EXPORT_SCOPE: metadata.EXPORT_SCOPE },
    humanCorrectionValue: calculations.humanCorrectionValue,
    reports_reportpresentationContext: context,
    actions: () => reportActions(context()),
    STATUSES: ["Notice", "Extension", "Cited", "Referred", "Closed"],
    A11Y: { notify() {} },
  });
  return { ReportsState, buildModel: calculations.buildModel, exportSheets: screens.exportSheets, render };
};
