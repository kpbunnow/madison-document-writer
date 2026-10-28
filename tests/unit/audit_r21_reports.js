/* Saved date semantics and read-only handoff through the public Reports owner, without Reports startup. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://127.0.0.1:8777/madison-reports.html" });
  const w = dom.window,
    localStorage = w.localStorage;
  let opened = 0,
    render = () => {};
  w.open = () => {
    opened++;
    return {};
  };
  w.BroadcastChannel = class {
    constructor() {
      this.sent = [];
    }
    postMessage(value) {
      this.sent.push(value);
    }
  };
  const prompt = () => "Daily review";
  const compiled = await esbuild.build({
    stdin: {
      contents: `export {createReportsServices} from './reports_services.js'; export {ReportsState} from './state.js'; export {recordDay as iso} from '../assets/shared.js';`,
      resolveDir: path.resolve("app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
    define: { __TEST_BUILD__: "false" },
  });
  const box = { exports: {} };
  new Function("window", "localStorage", "prompt", "BroadcastChannel", "module", "exports", compiled.outputFiles[0].text)(
    w,
    localStorage,
    prompt,
    w.BroadcastChannel,
    box,
    box.exports,
  );
  const { createReportsServices, ReportsState, iso } = box.exports;
  assert.deepEqual(ReportsState, {}, "owner imports must not start Reports or initialize preferences");
  const TODAY = iso(new Date()),
    REPORT_VIEWS_KEY = "madison-report-views-v1";
  // A supplied catalog entry isolates preference/handoff behavior from report-definition and screen owners.
  const REPORTS = [{ id: "openCases" }];
  Object.assign(ReportsState, {
    SAVED_VIEWS: [],
    REPORT_LINK: null,
    S: {
      screen: "openCases",
      view: "table",
      dateMode: "fixed",
      savedId: "",
      reportNotice: "",
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
    },
  });
  const { saveReportView, applyReportView, openInWriter } = createReportsServices({
    render: (...args) => render(...args),
    REPORT_VIEWS_KEY,
    REPORT_CHANNEL: "madison-writer-handoff-v1",
    iso,
    reportById: (id) => REPORTS.find((r) => r.id === id),
  });
  const test = async () => {
    const assert = require("assert");
    render = () => {};
    ReportsState.S.M = { byNo: { "QA-CASE": { number: "QA-CASE" } } };
    ReportsState.S.raw = { summaries: [{ case: { number: "QA-CASE" }, eventCount: 7 }] };
    ReportsState.S.screen = REPORTS[0].id;
    ReportsState.S.view = "map";
    ReportsState.S.F.owner = "owner-key";
    ReportsState.S.F.status = "open";
    ReportsState.S.dateMode = "month";
    ReportsState.S.F.from = "2020-01-01";
    saveReportView();
    const monthly = ReportsState.SAVED_VIEWS[0];
    assert.equal(monthly.dateMode, "month");
    assert.equal(monthly.view, "map");
    ReportsState.S.F.from = "2024-01-01";
    ReportsState.S.view = "table";
    ReportsState.S.F.owner = "";
    applyReportView(monthly.id);
    assert.equal(ReportsState.S.F.from, iso(new Date()).slice(0, 7) + "-01");
    assert.equal(ReportsState.S.F.owner, "owner-key");
    assert.equal(ReportsState.S.view, "map");
    ReportsState.S.dateMode = "fixed";
    ReportsState.S.F.from = "2026-01-01";
    ReportsState.S.F.to = "2026-02-28";
    saveReportView();
    ReportsState.S.F.from = "2025-01-01";
    applyReportView(ReportsState.SAVED_VIEWS[1].id);
    assert.equal(ReportsState.S.F.from, "2026-01-01");
    assert.equal(ReportsState.S.F.to, "2026-02-28");
    assert.equal(JSON.parse(localStorage.getItem(REPORT_VIEWS_KEY)).length, 2);
    openInWriter("QA-CASE");
    const request = ReportsState.S.handoff.request,
      channel = ReportsState.REPORT_LINK;
    assert.deepEqual(channel.sent[0], { kind: "open", request, number: "QA-CASE", eventCount: 7 });
    channel.onmessage({ data: { kind: "accepted", request } });
    channel.onmessage({ data: { kind: "result", request, ok: true } });
    assert.equal(opened, 0);
    assert.equal(ReportsState.S.handoff, null);
    assert(/existing Writer/.test(ReportsState.S.reportNotice));
    assert.equal(JSON.parse(localStorage.getItem("madison-report-return-v1")).view, "map");
    openInWriter("MISSING");
    assert.equal(ReportsState.S.handoff, null);
    console.log("R21 Reports focused checks passed");
    process.exit(0);
  };
  await test();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
