/* A summary the helper excluded as not matching its verified case is reported as coverage,
   explains the rebuild, and never reaches totals, tables, CSV, workbook or print output. */
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
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
require("../fixtures/report_exports.cjs")({ navigation: true })
  .then(({ ReportsState, buildModel, exportSheets, render, TODAY, freshness, currentReportRows, printReport }) => {
    const test = () => {
      const summary = {
        summaryVersion: 6,
        case: {
          number: "QA-VERIFIED",
          address: "1 TEST",
          opened: "2026-01-02",
          noticeIssued: "2026-01-03",
          status: "Notice",
          inspector: "QA",
          owner: "VERIFIED OWNER",
        },
        violations: [],
        citations: [],
        referrals: [],
        visits: [],
        documents: [],
      };
      const excluded = "qa-altered.json (101 TEST - QA-ALTERED.json; differs in case, citations)";
      ReportsState.S.raw = { readAt: "2026-10-21T10:00:00", summaries: [summary], missing: [], stale: [], unreadable: [], mismatched: [excluded] };
      ReportsState.S.M = buildModel(ReportsState.S.raw.summaries, {}, {});
      ReportsState.S.phase = "ready";
      ReportsState.S.F.from = "2026-01-01";
      ReportsState.S.F.to = TODAY;
      ReportsState.S.screen = "allCases";
      render();
      assert.match(freshness(), /Coverage incomplete/);
      assert.match(freshness(), /1 summary not matching its verified case/);
      const sheets = exportSheets();
      const about = sheets.find((s) => s.name === "About");
      assert.deepEqual(
        about.rows.find((r) => r[0] === "Summaries not matching their case"),
        ["Summaries not matching their case", 1],
      );
      assert.equal(
        about.opt.boldRows[1],
        about.rows.findIndex((r) => r[0] === "Definitions"),
      );
      const exported = JSON.stringify(sheets) + JSON.stringify(currentReportRows()) + document.getElementById("app").innerHTML;
      assert.match(exported, /QA-VERIFIED/);
      assert.doesNotMatch(exported, /QA-ALTERED/);
      assert.equal(ReportsState.S.M.counted.length, 1);
      printReport();
      assert.doesNotMatch(document.getElementById("app").innerHTML, /QA-ALTERED/);
      document.querySelector('[data-screen="data"]').click();
      const data = document.getElementById("app").textContent;
      assert.match(data, /1 summary not matching the verified case\./);
      assert.match(data, /rebuild the reporting index in Writer/);
      assert.match(data, /never the case or its history/);
      assert.ok(data.includes(excluded));
      ReportsState.S.raw.mismatched = [excluded, excluded.replace("altered", "second")];
      render();
      assert.match(document.getElementById("app").textContent, /2 summaries not matching the verified case\./);
      console.log("PASS summaries not matching their verified case are explained and excluded from every report output");
      process.exit(0);
    };
    test();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
