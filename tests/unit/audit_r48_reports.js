/* R48 filtering, stable output ordering, coverage, saved preferences and overlapping reads. */
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage("reports"),
  payload = bundleSource(html);
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: "http://127.0.0.1:8777/madison-reports.html",
  pretendToBeVisual: true,
});
const w = dom.window;
w.__NO_AUTOLOAD__ = true;
global.window = w;
global.document = w.document;
global.localStorage = w.localStorage;
global.location = w.location;
w.scrollTo = () => {};
global.prompt = () => "R48 local";
global.confirm = () => true;
const test = async () => {
  const summary = (no, extra = {}) => ({
    summaryVersion: 6,
    case: { number: no, address: no + " TEST", opened: "2026-01-02", noticeIssued: "2026-01-03", status: "Notice", inspector: "QA", zip: "53703" },
    violations: [],
    citations: [],
    referrals: [],
    visits: [],
    documents: [],
    ...extra,
  });
  ReportsState.S.raw = {
    readAt: "2026-10-16T10:00:00",
    summaries: [],
    missing: ["missing"],
    stale: ["mismatch"],
    unreadable: ["duplicate (excluded)"],
  };
  ReportsState.S.M = buildModel([summary("QA-2"), summary("QA-10"), summary("OLD", { summaryVersion: 5 })], {}, {});
  ReportsState.S.phase = "ready";
  ReportsState.S.screen = "allCases";
  ReportsState.S.F.from = "2026-01-01";
  ReportsState.S.F.to = TODAY;
  render();
  assert.equal(ReportsState.S.M.counted.length, 2);
  assert.deepEqual(ReportsState.S.M.versionStale, ["OLD"]);
  assert.equal(ReportsState.S.M.byNo.OLD, undefined);
  assert.match(freshness(), /1 revision mismatch/);
  assert.match(freshness(), /1 unreadable\/duplicate/);
  assert.match(freshness(), /categories can overlap/);
  assert.match(freshness(), /Workspace queue/);
  assert.match(dataView(), /Rebuild reporting index/);
  assert.equal(document.querySelector("#report-more-filters").open, false);
  assert.ok(document.querySelector(".applied-filters").textContent.includes("01/01/2026"));
  assert.equal(document.querySelectorAll("[data-act=clearFilters]").length, 1);
  const more = document.querySelector("#report-more-filters");
  more.open = true;
  document.getElementById("f-status").focus();
  ReportsState.S.F.status = "open";
  render();
  assert.equal(document.activeElement.id, "f-status");
  assert.equal(document.querySelector("#report-more-filters").open, true);
  assert.match(document.querySelector(".applied-filters").textContent, /Status: open/);
  for (const r of REPORTS) {
    ReportsState.S.screen = r.id;
    ReportsState.S.tableSort = { report: r.id, ci: 0, dir: -1 };
    render();
    const rows = currentReportRows(),
      sheet = exportSheets().find((s) => s.name === r.n + " " + r.label);
    assert.deepEqual(
      sheet.rows.map((row) => row.map((x) => (x && typeof x === "object" ? (x.f ?? x.m ?? x.d ?? "") : (x ?? "")))),
      rows,
      "matching workbook and CSV row model for " + r.id,
    );
  }
  ReportsState.S.screen = "allCases";
  ReportsState.S.tableSort = { report: "allCases", ci: 0, dir: -1 };
  render();
  const expected = currentReportRows();
  assert.ok(expected.length > 2);
  const body = [...document.querySelectorAll("table.rep tbody tr")]
    .slice(0, -1)
    .map((tr) => (tr.cells[0].querySelector("button")?.textContent || tr.cells[0].textContent).trim());
  assert.deepEqual(
    body,
    expected.slice(1, -1).map((r) => r[0]),
  );
  ReportsState.S.F.owner = "owner";
  ReportsState.S.dateMode = "month";
  saveReportView();
  ReportsState.S.tableSort = null;
  ReportsState.S.F.owner = "";
  applyReportView(ReportsState.S.savedId);
  assert.equal(ReportsState.S.F.owner, "owner");
  assert.equal(ReportsState.S.tableSort.dir, -1);
  assert.equal(ReportsState.S.F.from, TODAY.slice(0, 7) + "-01");
  document.querySelector("[data-act=clearFilters]").click();
  assert.equal(ReportsState.S.F.owner, "");
  assert.equal(ReportsState.S.F.from, TODAY.slice(0, 4) + "-01-01");
  assert.equal(ReportsState.S.F.areaType, "district");
  assert.equal(ReportsState.S.tableSort, null);
  ReportsState.S.tableSort = { report: ReportsState.S.screen, ci: 0, dir: 3 };
  render();
  assert.equal(
    document.querySelectorAll("th[aria-sort=ascending],th[aria-sort=descending]").length,
    0,
    "malformed saved sort cannot diverge screen and exports",
  );
  const confirmed = ReportsState.SAVED_VIEWS.slice(),
    savedId = ReportsState.SAVED_VIEWS[0].id,
    write = w.Storage.prototype.setItem;
  w.Storage.prototype.setItem = () => {
    throw new Error("Synthetic storage full");
  };
  saveReportView();
  assert.deepEqual(ReportsState.SAVED_VIEWS, confirmed);
  ReportsState.S.savedId = savedId;
  deleteReportView();
  assert.deepEqual(ReportsState.SAVED_VIEWS, confirmed);
  w.Storage.prototype.setItem = write;
  ReportsState.S.screen = "allCases";
  ReportsState.S.F.from = "2030-01-01";
  ReportsState.S.F.to = "2026-01-01";
  render();
  assert.equal(ReportsState.S.rep, null);
  assert.deepEqual(currentReportRows(), []);
  ReportsState.S.F.from = "2026-01-01";
  ReportsState.S.F.to = TODAY;
  const original = getJSON;
  let release,
    request = 0;
  getJSON = async (url) => {
    if (url === "/reporting/index") {
      const n = ++request;
      if (n === 1)
        return new Promise(
          (r) => (release = () => r({ ok: true, readAt: "old", summaries: [summary("OLD-RESPONSE")], missing: [], stale: [], unreadable: [] })),
        );
      return { ok: true, readAt: "new", summaries: [summary("NEW-RESPONSE")], missing: [], stale: [], unreadable: [] };
    }
    return url === "/reporting/parcels" ? { parcels: {}, missing: [] } : { ok: true };
  };
  const old = loadAll(false);
  await loadAll(false);
  release();
  await old;
  assert.equal(ReportsState.S.raw.readAt, "new");
  assert.ok(ReportsState.S.M.byNo["NEW-RESPONSE"]);
  assert.equal(ReportsState.S.M.byNo["OLD-RESPONSE"], undefined);
  getJSON = original;
  ReportsState.S.screen = "deposit";
  render();
  const rows = [...document.querySelectorAll("tbody tr")];
  assert.equal(rows.length, 40);
  assert.match(document.querySelector("#deposit-matches").textContent, /matching schedule rows/);
  const tree = rows.find((tr) => tr.cells[0].textContent === "10.05(11)(d)1.");
  assert.match(tree.cells[2].textContent, /per whole inch/);
  assert.equal(tree.cells[2].textContent.includes('"kind"'), false);
  assert.match(tree.querySelector("pre").textContent, /tree-alternative/);
  console.log("PASS R48 report output parity, legacy-format exclusion, coverage, reset," + " focus, saved sort, stale response, human deposit rules");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
