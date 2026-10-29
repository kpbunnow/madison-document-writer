// Reporting, reports side. Fed with summaries written by the real Document
// Writer (mk_summaries.js) plus hand-built ones whose counts are known.
// Consolidation Phase 2 (T1): run remaining long UI timers once the suite completes instead of waiting.
const { settle } = require("../fixtures/settle_ui_timers.cjs");
const fs = require("fs"),
  cp = require("child_process");
const { JSDOM } = require("jsdom");
cp.execFileSync("node", ["tests/fixtures/mk_summaries.js"], { cwd: require("path").resolve(__dirname, "../.."), stdio: "ignore" });
const REAL = JSON.parse(fs.readFileSync("/tmp/real_summaries.json", "utf8"));
const { builtPage } = require("../fixtures/built_bundle.cjs");
const html = builtPage("reports");
const CSS = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
const dom = new JSDOM(
  "<!doctype html><html><head><meta name='docwriter-token' content='SYNTHETIC-REPORT-TEST'><style>" +
    CSS +
    '</style></head><body><div id="app"></div></body></html>',
  {
    pretendToBeVisual: true,
    url: "http://127.0.0.1:8777/madison-reports.html",
  },
);
const w = dom.window;
global.window = w;
global.document = w.document;
global.location = w.location;
global.Blob = function (p) {
  this.p = p;
};
global.URL = { createObjectURL: () => "b", revokeObjectURL() {} };
w.scrollTo = () => {};

// ---- fixtures -------------------------------------------------------------
function mk(no, o) {
  return {
    format: "madison-case-summary",
    summaryVersion: o.ver == null ? 6 : o.ver,
    schema: 3,
    build: "x",
    written: "2026-09-18T10:00:00Z",
    eventCount: 3,
    case: Object.assign(
      {
        number: no,
        address: o.address || "1 " + no + " ST",
        siteCity: o.siteCity || "",
        zip: o.zip || "",
        parcel: o.parcel || "",
        inspector: o.inspector || "TEST INSPECTOR",
        opened: o.opened,
        noticeIssued: o.noticeIssued == null ? o.opened : o.noticeIssued,
        status: o.status,
        closedOn: o.closedOn || "",
        owner: o.owner || "OWNER " + no,
        ownerAddr: o.ownerAddr || ["9 " + no + " RD", "MADISON, WI 53704"],
      },
      {},
    ),
    violations: (o.v || []).map((v, i) =>
      Object.assign(
        {
          no: String(i + 1),
          title: "T" + (i + 1),
          sections: ["27.05(2)(c)"],
          type: "X/Y/1",
          typeLabel: "Type A",
          typeHow: "library",
          due: "",
          done: false,
          doneOn: "",
          lastOutcome: "",
          visits: 0,
          cited: 0,
        },
        v,
      ),
    ),
    visits: o.visits || [],
    documents: o.documents || [],
    citations: o.citations || [],
    referrals: o.referrals || [],
  };
}
const T1 = mk("T1", {
  parcel: "1111-111-1111-1",
  opened: "2026-01-15",
  noticeIssued: "2026-01-16",
  status: "Notice",
  owner: "ACME LLC",
  ownerAddr: ["% UPM", "516 E WASHINGTON AVE", "MADISON WI 53703"],
  v: [{}, {}],
});
const T2 = mk("T2", {
  parcel: "222222222222",
  opened: "2026-05-10",
  status: "Cited",
  owner: "O'NEIL & <SONS>",
  ownerAddr: ["516 East Washington Avenue", "Madison, WI 53703-1234"],
  v: [
    { done: true, doneOn: "2026-06-09", lastOutcome: "corrected", visits: 1 },
    { type: "X/Y/2", typeLabel: "Type B" },
  ],
  citations: [
    {
      num: "B00000000001",
      no: "2",
      ordinance: "27.05(2)(c)",
      desc: "X",
      issued: "2026-06-01",
      courtDate: "2026-07-01",
      amount: 197,
      tier: "1st",
      by: "TEST INSPECTOR",
    },
  ],
  visits: [
    {
      date: "2026-06-09",
      inspector: "TEST INSPECTOR",
      results: [
        { no: "1", oc: "corrected" },
        { no: "2", oc: "none" },
      ],
    },
  ],
  documents: [
    { id: "d1", type: "notice", label: "Official Notice", issued: "2026-05-10", by: "TEST INSPECTOR", void: false, voidReason: "", replaces: "" },
    { id: "d2", type: "citation", label: "Citation", issued: "2026-05-20", by: "TEST INSPECTOR", void: true, voidReason: "wrong date", replaces: "" },
    { id: "d3", type: "citation", label: "Citation", issued: "2026-06-01", by: "TEST INSPECTOR", void: false, voidReason: "", replaces: "d2" },
  ],
});
const T3 = mk("T3", { opened: "2025-12-01", status: "Closed", closedOn: "2026-01-05", zip: "53711", v: [{ done: true, doneOn: "2026-01-05" }] });
const T4 = mk("T4", { parcel: "444444444444", opened: "2026-02-01", noticeIssued: "", status: "Not issued" });
const T5 = mk("T5", { ver: 6, opened: "2026-07-01", status: "Notice", ownerAddr: [], v: [{ type: "X/Y/2", typeLabel: "Type B" }] });
const TOLD = mk("TOLD", { ver: 0, opened: "2026-07-01", status: "Notice", v: [{}] });
const SUMS = REAL.concat([T1, T2, T3, T4, T5, TOLD]);

const sq = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
const AREAS = {
  ok: true,
  notes: [],
  districtsDate: "2026-09-01",
  districts: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { OBJECTID: 1, ALD_DIST: 6, NAME: "Six" },
        geometry: { type: "Polygon", coordinates: [sq(-89.37, 43.06, -89.3, 43.12)] },
      },
      {
        type: "Feature",
        properties: { OBJECTID: 2, ALD_DIST: 10, NAME: "Ten" },
        geometry: { type: "Polygon", coordinates: [sq(-89.53, 43.02, -89.45, 43.08)] },
      },
    ],
  },
  zips: {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: { ZIP5: "53703" }, geometry: { type: "Polygon", coordinates: [sq(-89.4, 43.05, -89.3, 43.13)] } }],
  },
};
const CACHED = {
  "070822219103": {
    history: [
      { fetched: "2026-01-01", alder: 9, building: 3, lat: 43.05, lon: -89.5 },
      { fetched: "2026-06-01", alder: 10, building: 3, lat: 43.05, lon: -89.5 },
    ],
  },
  111111111111: { history: [{ fetched: "2026-01-01", alder: 6, building: 1, lat: 43.08, lon: -89.33 }] },
  222222222222: { history: [{ fetched: "2026-01-01", alder: 6, building: 1, lat: 43.09, lon: -89.34 }] },
  444444444444: { history: [{ fetched: "2026-01-01", alder: 6, building: 1, lat: 43.09, lon: -89.34 }] },
};
const POSTED = [];
let FAIL = false;
global.fetch = w.fetch = async (u, o) => {
  const R = (j) => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(j)) });
  if (FAIL) throw new Error("connection refused");
  if (u === "/reporting/index")
    return R({
      ok: true,
      caseDir: "S:\\Case JSON Files",
      summaries: SUMS,
      unreadable: [],
      missing: ["9 NOWHERE - CB-MISSING.json"],
      stale: [],
      readAt: "2026-09-18T10:00:00",
    });
  if (u === "/reporting/parcels" && !o?.method) return R({ ok: true, parcels: CACHED, missing: [] });
  if (u === "/reporting/parcels") {
    const b = JSON.parse(o.body);
    POSTED.push(b);
    return R({
      ok: true,
      error: "",
      invalid: [],
      parcels: { "071036411518": { history: [{ fetched: "2026-02-01", alder: 6, building: 2, lat: 43.09, lon: -89.35 }] } },
      missing: ["070913305114"],
    });
  }
  if (u === "/reporting/areas") return R(AREAS);
  throw new Error("unexpected " + u);
};

const completion = require("../fixtures/report_exports.cjs")({ navigation: true, filterChanges: true, maps: true }).then(async (owners) => {
  const {
    ReportsState,
    TODAY,
    REPORTS,
    render,
    exportSheets,
    loadAll,
    reportById,
    rules: { ownerKey, polyHas, detectField, openAt, statusAt, violationAt, violOpenAt },
    workbook: { build: workbook, crc32 },
  } = owners;
  await loadAll(false);

  var fails = [];
  function H(t) {
    console.log("\n=== " + t + " ===");
  }
  function ok(l, c, x) {
    console.log("  " + (c ? "ok   " : "FAIL ") + l + (x !== undefined ? "   " + x : ""));
    if (!c) fails.push(l);
  }
  function click(el) {
    el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  }
  function change(el, v) {
    el.value = v;
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
  }
  const $ = (s) => document.querySelector(s),
    $$ = (s) => Array.from(document.querySelectorAll(s));
  // asOf is today: the writer-made fixtures are issued today, whatever day the suite runs
  const setF = (o) => {
    Object.assign(
      ReportsState.S.F,
      {
        from: "2026-01-01",
        to: TODAY > "2026-12-31" ? TODAY : "2026-12-31",
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
      o || {},
    );
    ReportsState.S.drill = null;
  };
  const run = (id, o) => {
    setF(o);
    return reportById(id).run(ReportsState.S.M, ReportsState.S.F);
  };
  const rowOf = (res, label) => res.rows.map((r) => r.cells || r).find((r) => (typeof r[0] === "string" ? r[0] : r[0] && r[0].text) === label);
  const N = (x) => (x && typeof x === "object" ? x.n : x);

  return (async function () {
    H("Owner key");
    ok("name line skipped", ownerKey(["HANIF, JAWAD", "1910 LEWON DR", "MADISON, WI 53711"]) === "1910 LEWON DR|53711");
    ok("PO box", ownerKey(["PO BOX 555", "MONROE, WI 53566"]) === "PO BOX 555|53566");
    ok("P.O. Box spelled otherwise", ownerKey(["P.O. Box 555", "Monroe WI 53566"]) === "PO BOX 555|53566");
    ok(
      "care-of block and long form key alike",
      ownerKey(["% UPM", "516 E WASHINGTON AVE", "MADISON WI 53703"]) === ownerKey(["516 East Washington Avenue", "Madison, WI 53703-1234"]),
    );
    ok(
      "unit markers agree",
      ownerKey(["12 Main St #3", "Madison WI 53703"]) === ownerKey(["12 MAIN STREET APT 3", "MADISON, WI 53703"]) &&
        ownerKey(["12 Main St Unit 3", "Madison WI 53703"]) === ownerKey(["12 Main St Suite 3", "Madison WI 53703"]),
    );
    ok("street type matters", ownerKey(["12 MAIN ST", "MADISON WI 53703"]) !== ownerKey(["12 MAIN AVE", "MADISON WI 53703"]));
    ok("direction matters", ownerKey(["12 N MAIN ST", "MADISON WI 53703"]) !== ownerKey(["12 S MAIN ST", "MADISON WI 53703"]));
    ok("house number matters", ownerKey(["12 MAIN ST", "MADISON WI 53703"]) !== ownerKey(["14 MAIN ST", "MADISON WI 53703"]));
    ok("ZIP matters", ownerKey(["12 MAIN ST", "MADISON WI 53703"]) !== ownerKey(["12 MAIN ST", "MADISON WI 53704"]));
    ok("no ZIP, no key", ownerKey(["12 MAIN ST", "MADISON WI"]) === "");
    ok("no street line, no key", ownerKey(["ACME LLC", "MADISON WI 53703"]) === "");
    ok("one line, no key", ownerKey(["12 MAIN ST MADISON WI 53703"]) === "" && ownerKey([]) === "" && ownerKey(null) === "");

    H("Geometry");
    var holed = { type: "Polygon", coordinates: [sq(0, 0, 10, 10), sq(4, 4, 6, 6)] };
    ok("inside", polyHas(holed, 1, 1));
    ok("outside", !polyHas(holed, 11, 1));
    ok("in the hole", !polyHas(holed, 5, 5));
    ok("multipolygon second part", polyHas({ type: "MultiPolygon", coordinates: [[sq(0, 0, 1, 1)], [sq(5, 5, 6, 6)]] }, 5.5, 5.5));
    ok("district field found", detectField(AREAS.districts, "district") === "ALD_DIST");
    ok("zip field found", detectField(AREAS.zips, "zip") === "ZIP5");
    ok("a name field is not taken for a district", detectField({ features: [{ properties: { DISTRICT_NAME: "Six" } }] }, "district") === "");

    await new Promise((r) => setTimeout(r, 60));
    H("Loading");
    ok("ready", ReportsState.S.phase === "ready", ReportsState.S.phase + " " + ReportsState.S.error);
    ok(
      "only uncached parcels were looked up",
      POSTED.length === 1 && POSTED[0].ids.slice().sort().join() === "070913305114,071036411518" && !POSTED[0].refresh,
      JSON.stringify(POSTED),
    );
    ok("real writer summaries parsed", ReportsState.S.M.byNo["CB2026-238-03639"] && ReportsState.S.M.byNo["CB2026-238-03639"].status === "Closed");
    ok("a case with no issued notice is not counted", !!ReportsState.S.M.byNo.T4 && ReportsState.S.M.counted.indexOf(ReportsState.S.M.byNo.T4) < 0);
    ok(
      "district now and when opened",
      ReportsState.S.M.byNo["CB2026-238-03639"].alderNow === "10" && ReportsState.S.M.byNo["CB2026-238-03639"].alderAtOpen === "9",
    );
    ok("ZIP from the outline when Accela had none", ReportsState.S.M.byNo["CB2026-216-03297"].zip === "53703");
    ok("ZIP from the case wins", ReportsState.S.M.byNo.T3.zip === "53711");
    ok(
      "parcel not on the city layer is unlocated",
      !ReportsState.S.M.byNo["CB2026-239-03712"].located && ReportsState.S.M.byNo["CB2026-239-03712"].looked,
    );
    ok("an older summary format is flagged", ReportsState.S.M.versionStale.join() === "TOLD" && !ReportsState.S.M.byNo.TOLD);

    H("Correction and withdrawal effective dates");
    var historical = {
      noticeIssued: "2026-01-01",
      status: "Withdrawn",
      documents: [
        { id: "old", type: "notice", issued: "2026-01-01", effectiveFrom: "2026-01-01", effectiveTo: "2026-02-01", superseded: true },
        {
          id: "new",
          type: "notice",
          issued: "2026-01-01",
          effectiveFrom: "2026-02-01",
          effectiveTo: "2026-03-01",
          void: true,
          voidAt: "2026-03-01",
          allWithdrawn: true,
        },
      ],
    };
    var hv = {
      done: false,
      withdrawn: true,
      type: "new-type",
      history: [
        { issued: "2026-01-01", effectiveFrom: "2026-01-01", effectiveTo: "2026-02-01", done: false, withdrawn: false, key: "old-type" },
        {
          issued: "2026-02-01",
          effectiveFrom: "2026-02-01",
          effectiveTo: "2026-03-01",
          void: true,
          voidAt: "2026-03-01",
          done: false,
          withdrawn: true,
          key: "new-type",
        },
      ],
    };
    ok("January retains the notice that was then effective", openAt(historical, "2026-01-31") && statusAt(historical, "2026-01-31") === "Notice");
    ok("Administrative withdrawal is not compliance", !openAt(historical, "2026-02-01") && statusAt(historical, "2026-02-01") === "Withdrawn");
    ok("March withdrawal does not erase January", statusAt(historical, "2026-03-01") === "Not issued" && openAt(historical, "2026-01-15"));
    ok("Violation stays open before its later withdrawal", violOpenAt(hv, "2026-01-31") && !violOpenAt(hv, "2026-02-01"));
    ok("Historical ordinance classification is retained", violationAt(hv, "2026-01-31").type === "old-type");

    H("1. Open cases by area");
    var r = run("openCases");
    ok("District 6: three open, one referred", N(rowOf(r, "District 6")[1]) === 3 && N(rowOf(r, "District 6")[3]) === 1);
    ok("Unlocated: two", N(rowOf(r, "Unlocated")[1]) === 2);
    ok("closed cases are not open", !rowOf(r, "District 10"));
    ok("total five", N(r.total[1]) === 5);
    ok("Unlocated sorts last", (r.rows[r.rows.length - 1].cells || r.rows[r.rows.length - 1])[0] === "Unlocated");
    r = run("openCases", { asOf: "2026-02-01" });
    ok("as of an earlier date: T1 and T3 closed after", N(r.total[1]) === 1 && rowOf(r, "District 6"), JSON.stringify(r.total[1]));
    r = run("openCases", { areas: ["6"] });
    ok("area filter", N(r.total[1]) === 3 && r.rows.length === 1);

    H("2. Cases by inspector");
    r = run("byInspector");
    ok("six cases opened in 2026", N(r.total[r.total.length - 1]) === 6);
    ok("matrix has a column per area plus total", r.cols.length === 1 + 3 + 1 && r.cols.indexOf("District 10") > 0, JSON.stringify(r.cols));
    var ti = rowOf(r, "TEST INSPECTOR");
    ok("the test inspector has three (T1, T2, T5)", ti && N(ti[ti.length - 1]) === 3);
    r = run("byInspector", { inspector: "TEST INSPECTOR" });
    ok("inspector filter", N(r.total[r.total.length - 1]) === 3 && r.rows.length === 1);

    H("3. Open violations by area");
    r = run("openViolations");
    ok(
      "District 6: five open items on three cases",
      N(rowOf(r, "District 6")[1]) === 5 && N(rowOf(r, "District 6")[2]) === 3,
      JSON.stringify(rowOf(r, "District 6")),
    );
    ok("total eight", N(r.total[1]) === 8);
    r = run("openViolations", { vtype: "X/Y/2" });
    ok("type filter: Type B only", N(r.total[1]) === 2);

    H("4. All cases");
    r = run("allCases");
    ok("six in the period, T3 opened in 2025 is out", N(r.total[1]) === 6);
    ok("cited two, referred one", N(r.total[r.cols.indexOf("Cited")]) === 2 && N(r.total[r.cols.indexOf("Referred")]) === 1);
    ok("District 10 one closed", N(rowOf(r, "District 10")[1]) === 1 && N(rowOf(r, "District 10")[3]) === 1);
    r = run("allCases", { boundary: "atOpen" });
    ok("boundaries when opened: District 9", !!rowOf(r, "District 9") && !rowOf(r, "District 10"));
    r = run("allCases", { areaType: "zip" });
    ok("by ZIP: 53703 three, Unlocated three", N(rowOf(r, "53703")[1]) === 3 && N(rowOf(r, "Unlocated")[1]) === 3);
    r = run("allCases", { status: "open" });
    ok("open status filter", N(r.total[1]) === 5);
    r = run("allCases", { ord: "27.05(2)(f)" });
    ok("ordinance filter keeps cases with that section", N(r.total[1]) === 3, N(r.total[1]));

    H("5. All violations");
    r = run("allViolations");
    ok("Type A and Type B rows", !!rowOf(r, "Type A") && !!rowOf(r, "Type B"));
    ok("Type A: T1 two + T2 one", N(rowOf(r, "Type A")[1]) === 3);
    ok("real unclassified types present", !!rowOf(r, "Unclassified: 27.05(2)(f)"));
    ok("total eleven (T5 has one item)", N(r.total[1]) === 11, N(r.total[1]));

    H("6. Days to compliance");
    r = run("daysToCompliance");
    var ta = rowOf(r, "Type A");
    ok("Type A: one corrected in 30 days", N(ta[2]) === 1 && N(ta[3]) === 30 && N(ta[4]) === 30, JSON.stringify(ta.map(N)));
    var tf = rowOf(r, "Unclassified: 27.05(2)(f)");
    ok("the real closed case: 19 days from the initial inspection", tf && N(tf[3]) === 19, JSON.stringify(tf && tf.map(N)));

    H("7. Repeat cases by owner");
    r = run("repeatOwners");
    var own = r.rows.find((x) => x[0] && x[0].owner === "516 E WASHINGTON AVE|53703");
    ok(
      "a manager address groups three owners, every name shown",
      own && N(own[2]) === 3 && own[0].text.split("; ").sort().join("|") === "ACME LLC|ESPESETH FAMILY TRUST|O'NEIL & <SONS>",
      JSON.stringify(own && own[0]),
    );
    var un = r.rows.find((x) => x.dim);
    ok("unmatched listed separately", un && N(un.cells[2]) === 1);

    H("8. Citations by ordinance");
    r = run("citations");
    ok("two citations", N(r.total[1]) === 2);
    ok("27.05(2)(c): one, $197", N(rowOf(r, "27.05(2)(c)")[1]) === 1 && N(rowOf(r, "27.05(2)(c)")[rowOf(r, "27.05(2)(c)").length - 1]) === 197);
    r = run("citations", { ord: "27.05(2)(c)" });
    ok("ordinance filter", r.rows.length === 1 && N(r.total[1]) === 1);
    r = run("citations", { from: "2026-06-02" });
    ok("period on the issue date", N(r.total[1]) === 1, N(r.total[1]));

    H("9. Referrals");
    r = run("referrals");
    ok("one referral, the real one", r.rows.length === 1 && r.rows[0][1].kase === "CB2026-216-03297");

    H("10. R26 document actions");
    var preNotice = { ...ReportsState.S.M.byNo.T4 };
    preNotice.number = "R26-PRE-NOTICE";
    preNotice.documents = [{ id: "r26-initial-order", type: "summaryAbatement", label: "Summary Abatement", issued: TODAY, by: "TEST INSPECTOR" }];
    var scoped = { ...ReportsState.S.M.byNo.T2 };
    scoped.number = "R26-SCOPED";
    scoped.documents = [
      { id: "r26-void", type: "noOccupancy", label: "No Occupancy", issued: TODAY, by: "TEST INSPECTOR", void: true },
      { id: "r26-old", type: "noOccupancy", label: "No Occupancy", issued: TODAY, by: "TEST INSPECTOR", superseded: true },
      { id: "r26-current", type: "noOccupancy", label: "No Occupancy", issued: TODAY, by: "TEST INSPECTOR" },
      { id: "r26-ref-update", type: "referralUpdate", label: "Update for Case Referral", issued: TODAY, by: "TEST INSPECTOR" },
    ];
    setF();
    var actionModel = { ...ReportsState.S.M, cases: [preNotice, scoped] },
      ar = reportById("documentActions").run(actionModel, ReportsState.S.F);
    ok(
      "Includes an initial order without counting another case opening",
      N(rowOf(ar, "Summary Abatement")[1]) === 1 && ReportsState.S.M.counted.indexOf(ReportsState.S.M.byNo.T4) < 0,
    );
    ok("Correction and withdrawal do not duplicate current actions", N(rowOf(ar, "No Occupancy")[1]) === 1 && N(ar.total[1]) === 3);
    ok("Referral update stays in its existing family", N(rowOf(ar, "Referral for Prosecution")[1]) === 1);
    setF({ inspector: "ANOTHER INSPECTOR" });
    ok("New-family counts follow issuing inspector", N(reportById("documentActions").run(actionModel, ReportsState.S.F).total[1]) === 0);
    setF();

    H("Screens, drill-through and escaping");
    setF();
    ReportsState.S.screen = "allCases";
    ReportsState.S.view = "table";
    render();
    ok("filters bar and table drawn", !!$("#f-from") && !!$("table.rep"));
    var b = $$("button[data-drill]").find((x) => x.closest("tr").firstElementChild.textContent === "District 6");
    ok("count cell is a button", !!b);
    if (b) click(b);
    ok("drill panel lists the three cases", ReportsState.S.drill && ReportsState.S.drill.ids.length === 3 && $$("#drill tbody tr").length === 3);
    ok("count cells carry a bar", $$("td.bar").length > 0);
    change($("#f-from"), "2026-05-01");
    ok("changing a filter re-runs the report", N(ReportsState.S.rep.res.total[1]) === 2 && !ReportsState.S.drill, N(ReportsState.S.rep.res.total[1]));
    change($("#f-from"), "2026-0");
    ok("a half-typed date is ignored", ReportsState.S.F.from === "2026-05-01");
    setF();
    click($('button[data-screen="repeatOwners"]'));
    ok("owner names are escaped", document.body.innerHTML.indexOf("&lt;SONS&gt;") > 0 && !document.querySelector("sons"));
    click($('button[data-owner="516 E WASHINGTON AVE|53703"]'));
    ok("owner view", ReportsState.S.screen === "owner" && $$(".panel tbody tr").length === 3);
    click($('button[data-act="useOwner"]'));
    ok(
      "filter reports to the owner",
      ReportsState.S.F.owner === "516 E WASHINGTON AVE|53703" && ReportsState.S.screen === "allCases" && N(ReportsState.S.rep.res.total[1]) === 3,
    );
    click($('button[data-act="clearFilters"]'));
    ok("owner filter cleared", !ReportsState.S.F.owner);
    // A tab left open past New Year resets its filters from the day it is now, not the day it loaded.
    {
      const RealDate = Date,
        later = RealDate.UTC(new RealDate().getUTCFullYear() + 1, 0, 2, 18, 0, 0),
        newYear = new RealDate(later).getUTCFullYear() + "-01-02";
      global.Date = class extends RealDate {
        constructor(...args) {
          if (args.length) super(...args);
          else super(later);
        }
        static now() {
          return later;
        }
      };
      try {
        click($('button[data-act="clearFilters"]'));
        ok(
          "reset filters read the current day " + JSON.stringify([ReportsState.S.F.from, ReportsState.S.F.to, ReportsState.S.F.asOf, newYear, String(new global.Date()), String(!!$('button[data-act="clearFilters"]'))]),
          ReportsState.S.F.to === newYear && ReportsState.S.F.asOf === newYear && ReportsState.S.F.from === newYear.slice(0, 4) + "-01-01",
        );
      } finally {
        global.Date = RealDate;
      }
    }
    click($('button[data-screen="property"]'));
    $("#pv-q").value = "2222-222-2222-2";
    click($('button[data-act="propGo"]'));
    ok("property found by dashed parcel", ReportsState.S.prop.hits.length === 1 && $$(".card-case").length === 1);
    ok("the void citation is shown struck", !!$(".timeline .void"));
    ok("citation listed on its item", document.body.innerHTML.indexOf("B00000000001") > 0);
    click($('button[data-screen="data"]'));
    var t = document.body.textContent;
    ok("data view: missing summary named", t.indexOf("CB-MISSING") > 0);
    ok("data view: stale format named", t.indexOf("TOLD (earlier summary format)") > 0);
    ok("data view: unlocated reasons", t.indexOf("not on the city parcel layer") > 0 && t.indexOf("T3, 1 T3 ST: no parcel on the case") > 0);
    ok("data view: district field reported", t.indexOf("ALD_DIST") > 0);

    H("Every screen renders");
    var junk = function (s) {
      return ["undefined", "NaN", "[object"]
        .filter(function (w) {
          return s.indexOf(w) >= 0;
        })
        .join(",");
    };
    var bad = [];
    REPORTS.forEach(function (rp) {
      ["table", "map"].forEach(function (v) {
        try {
          setF();
          ReportsState.S.screen = rp.id;
          ReportsState.S.view = v;
          render();
          var j = junk($("#app").textContent);
          if (!$(".panel") || j) bad.push(rp.id + "/" + v + " " + j);
        } catch (e) {
          bad.push(rp.id + "/" + v + ": " + e.message);
        }
      });
    });
    ["property", "owner", "data"].forEach(function (sc) {
      try {
        ReportsState.S.screen = sc;
        ReportsState.S.view = "table";
        render();
        var j = junk($("#app").textContent);
        if (j) bad.push(sc + " " + j);
      } catch (e) {
        bad.push(sc + ": " + e.message);
      }
    });
    setF({ areaType: "zip" });
    REPORTS.forEach(function (rp) {
      try {
        ReportsState.S.screen = rp.id;
        ReportsState.S.view = "table";
        render();
      } catch (e) {
        bad.push(rp.id + "/zip: " + e.message);
      }
    });
    ok("all nine reports, both views, three look-ups and ZIP mode render cleanly", !bad.length, bad.join("; "));
    ReportsState.S.view = "table";
    H("Map");
    setF();
    ReportsState.S.screen = "allCases";
    ReportsState.S.view = "map";
    render();
    ok("Leaflet 1.9.4 is present", !!window.L && window.L.version === "1.9.4");
    ok("the map element is drawn", !!$("#map"));
    ok("map legend counts located cases", /4 cases on the map, 2 not located/.test($(".legend").textContent), $(".legend").textContent);
    ok("districts can be shaded", /Shading is this report/.test($(".legend").textContent));
    ok("map points are the report points", ReportsState.S.rep.res.points.length === 6);
    ReportsState.S.view = "table";

    H("Excel");
    setF();
    var sheets = exportSheets(),
      wb = workbook(sheets);
    ok("eighteen sheets including override audit and document actions", wb.names.length === 18, wb.names.join(" | "));
    ok(
      "sheet names are legal",
      wb.names.every((n) => n.length <= 31 && !/[\[\]:*?\/\\]/.test(n)),
    );
    require("fs").writeFileSync("/tmp/rep.xlsx", Buffer.from(wb.bytes));
    var py = require("child_process").spawnSync(
      "python3",
      [
        "-c",
        [
          "import openpyxl,json,datetime",
          'wb=openpyxl.load_workbook("/tmp/rep.xlsx")',
          'c=wb["Cases"];hdr=[x.value for x in c[1]]',
          "rows={r[0].value:r for r in c.iter_rows(min_row=2)}",
          't2=rows.get("T2")',
          'cit=wb["Citations"];cr=[r for r in cit.iter_rows(min_row=2) if r[0].value=="B00000000001"][0]',
          's4=wb["4 All cases"];last=[x.value for x in list(s4.iter_rows())[-1]]',
          'v=wb["Violations"];vr=[r for r in v.iter_rows(min_row=2) if r[0].value=="T2" and r[3].value==1][0]',
          'print(json.dumps({"sheets":wb.sheetnames,"hdr":hdr[:3],"n":len(rows),"opened_is_date":isinstance(t2[8].value,datetime.datetime),"opened":str(t2[8].value)[:10],"fmt":t2[8].number_format,',
          '"amount":cr[9].value,"amtfmt":cr[9].number_format,"total":last,"days":vr[12].value,"frozen":c.freeze_panes,"owner":t2[12].value}))',
        ].join("\n"),
      ],
      { encoding: "utf8" },
    );
    var X = null;
    try {
      X = JSON.parse(py.stdout);
    } catch (e) {}
    ok("openpyxl opens the workbook", !!X, py.stderr.slice(-400));
    if (X) {
      ok("Cases: six rows, headers", X.n === 6 && X.hdr.join() === "Case number,Address,Parcel");
      ok("dates are real dates", X.opened_is_date && X.opened === "2026-05-10" && X.fmt === "mm/dd/yyyy", X.opened + " " + X.fmt);
      ok("money is numeric", X.amount === 197 && X.amtfmt === "#,##0.00");
      ok("days to compliance is a number", X.days === 30);
      ok("summary sheet total", X.total[0] === "All areas" && X.total[1] === 6, JSON.stringify(X.total));
      ok("header row frozen", X.frozen === "A2");
      ok("text survives unescaped", X.owner === "O'NEIL & <SONS>");
    }
    ok(
      "export follows the owner filter",
      (function () {
        setF({ owner: "516 E WASHINGTON AVE|53703" });
        var s = exportSheets();
        return s[1].rows.length === 4;
      })(),
    );
    setF();
    setF({ inspector: "ANOTHER INSPECTOR" });
    ok("Citation export obeys issuing inspector filter", exportSheets().find((s) => s.name === "Citations").rows.length === 1);
    setF({ inspector: "TEST INSPECTOR" });
    ok(
      "Citation export retains matching issuing inspector",
      exportSheets()
        .find((s) => s.name === "Citations")
        .rows.some((r) => r[0] === "B00000000001"),
    );
    setF();
    var crcOk = crc32(new TextEncoder().encode("123456789")) === 0xcbf43926;
    ok("CRC-32 check value", crcOk);

    H("No server");
    FAIL = true;
    await loadAll(false);
    ok(
      "says what to do",
      ReportsState.S.phase === "error" && /Document Writer window is open/.test(ReportsState.S.error) && !!$('button[data-act="reload"]'),
    );
    FAIL = false;
    await loadAll(false);
    ok("recovers on retry", ReportsState.S.phase === "ready");

    console.log("\n" + (fails.length ? fails.length + " FAILURE(S): " + fails.join(" | ") : "all checks passed"));
    if (fails.length) process.exitCode = 1;
  })().catch((e) => {
    console.log("CRASH", (e && e.stack) || e);
    process.exitCode = 1;
  });
});
settle(completion, global.window).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
