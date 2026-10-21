/* Run the built Reports bundle on a /reporting/index response and print what reaches report output.
   Usage: node tests/fixtures/report_output.cjs <index.json> <screen> <output.json>
   Writes JSON: report rows, counted cases, coverage text, workbook sheets and the rendered/printed page. */
const fs = require("fs"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("./built_bundle.cjs");
const [indexPath, screen, outputPath] = process.argv.slice(2);
const payload = bundleSource(builtPage("reports"));
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: "http://127.0.0.1:8777/madison-reports.html",
    pretendToBeVisual: true,
  }),
  w = dom.window;
w.__NO_AUTOLOAD__ = true;
global.window = w;
global.document = w.document;
global.localStorage = w.localStorage;
global.location = w.location;
w.scrollTo = () => {};
w.print = () => {};
globalThis.__REPORT = { index: JSON.parse(fs.readFileSync(indexPath, "utf8")), screen, outputPath };
const run = () => {
  ReportsState.S.raw = __REPORT.index;
  ReportsState.S.M = buildModel(__REPORT.index.summaries, {}, {});
  ReportsState.S.phase = "ready";
  ReportsState.S.F.from = "2020-01-01";
  ReportsState.S.F.to = TODAY;
  ReportsState.S.screen = __REPORT.screen;
  render();
  const rows = currentReportRows();
  printReport();
  require("fs").writeFileSync(
    __REPORT.outputPath,
    JSON.stringify({
      rows,
      counted: ReportsState.S.M.counted.length,
      coverage: freshness(),
      sheets: exportSheets(),
      page: document.getElementById("app").innerHTML,
    }),
  );
  process.exit(0);
};
eval(payload + "\n(" + run.toString() + ")();");
