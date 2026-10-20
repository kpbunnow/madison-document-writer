/* Saved date semantics and read-only report-to-Writer transport. */
const fs = require("fs"),
  path = require("path"),
  { JSDOM } = require("jsdom");
const html = fs.readFileSync(
  path.join(process.env.DW_OUTPUT_DIR || path.join(require("path").resolve(__dirname, "../.."), "build/dist"), "madison-reports.html"),
  "utf8",
);
const payload = Buffer.from(/var B="([A-Za-z0-9+\/=]+)"/.exec(html)[1], "base64").toString("utf8");
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://127.0.0.1:8777/madison-reports.html" });
const w = dom.window;
w.__NO_AUTOLOAD__ = true;
global.window = w;
global.document = w.document;
global.localStorage = w.localStorage;
global.location = w.location;
global.prompt = () => "Daily review";
global.confirm = () => true;
let opened = 0;
w.open = () => {
  opened++;
  return {};
};
w.BroadcastChannel = class {
  constructor() {
    this.sent = [];
  }
  postMessage(x) {
    this.sent.push(x);
  }
};
global.BroadcastChannel = w.BroadcastChannel;
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
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
