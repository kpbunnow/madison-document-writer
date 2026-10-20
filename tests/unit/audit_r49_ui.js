/* R49 saved-view truth and exact singular/plural coverage wording. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-reports.html"), "utf8"),
  payload = Buffer.from(/var B="([A-Za-z0-9+\/=]+)"/.exec(html)[1], "base64").toString("utf8");
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
const test = () => {
  const summary = {
    summaryVersion: 6,
    case: { number: "QA-R49", address: "1 TEST", opened: "2026-01-02", noticeIssued: "2026-01-03", status: "Notice", inspector: "QA" },
    violations: [],
    citations: [],
    referrals: [],
    visits: [],
    documents: [],
  };
  ReportsState.S.raw = { readAt: "2026-10-16T10:00:00", summaries: [summary], missing: ["missing"], stale: ["stale"], unreadable: ["duplicate"] };
  ReportsState.S.M = buildModel([summary], {}, {});
  ReportsState.S.phase = "ready";
  ReportsState.S.F.from = "2026-01-01";
  ReportsState.S.F.to = TODAY;
  ReportsState.S.F.inspector = "QA";
  ReportsState.S.screen = "allCases";
  ReportsState.S.savedId = "retained-view";
  ReportsState.S.reportNotice = "Returned to the saved report context.";
  ReportsState.S.tableSort = { report: "allCases", ci: 0, dir: -1 };
  render();
  assert.match(freshness(), /1 case file/);
  assert.doesNotMatch(freshness(), /1 case files/);
  assert.match(freshness(), /1 revision mismatch/);
  assert.match(freshness(), /1 unreadable\/duplicate summary entry/);
  document.querySelector('[data-screen="byInspector"]').click();
  assert.equal(ReportsState.S.screen, "byInspector");
  assert.equal(ReportsState.S.savedId, "");
  assert.equal(ReportsState.S.reportNotice, "");
  assert.equal(ReportsState.S.F.inspector, "QA");
  assert.deepEqual(ReportsState.S.tableSort, { report: "allCases", ci: 0, dir: -1 });
  assert.deepEqual(
    exportSheets()
      .find((s) => s.name === "2 Cases by inspector")
      .rows.map((r) => r.map((x) => (x && typeof x === "object" ? (x.f ?? x.m ?? x.d ?? "") : (x ?? "")))),
    currentReportRows(),
  );
  document.querySelector('[data-screen="allCases"]').click();
  assert.equal(ReportsState.S.tableSort.dir, -1);
  assert.equal(document.querySelectorAll('th[aria-sort="descending"]').length, 1);
  console.log(
    "PASS R49 coverage grammar and truthful saved-view selection across repor" + "t switches with retained filters, sort and export parity",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")();");
