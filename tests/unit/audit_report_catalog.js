/* Real model/history services exercise all catalog reports without Reports startup or a browser. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
      stdin: {
        contents:
          'export {createReportCatalog} from "./report_catalog.js";export {createReportsServices} from "./reports_services.js";export {ReportsState} from "./state.js";export {recordDay} from "../assets/shared.js";export * as reportFacts from "./report_facts.js";',
        resolveDir: path.resolve("app/modules"),
      },
      bundle: true,
      write: false,
      format: "cjs",
      define: { __TEST_BUILD__: "false" },
    }),
    box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createReportCatalog, createReportsServices, ReportsState, recordDay } = box.exports;
  assert.equal(
    createReportCatalog(
      new Proxy(
        {},
        {
          get(_, k) {
            throw Error("construction read " + k);
          },
        },
      ),
    ).length,
    11,
  );
  const primitive = {
    uniq: (a) => [...new Set(a)],
    validISO: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || ""),
    STREET_WORDS: {},
    areaIdOf: (f, key) => String(f.properties[key] ?? ""),
  };
  const model = createReportsServices(primitive),
    facts = box.exports.reportFacts,
    services = {
      ...facts,
      areaLabel: facts.createReportAreaLabel(() => ReportsState.S.F),
      ...model,
      openAt: (c, date) => facts.openAt(c, date, model),
      TODAY: "2026-10-29",
      // The day is asked for when it is used; the retained original receives the same day as a value.
      currentDay: () => "2026-10-29",
    };
  primitive.violOk = facts.violOk;
  const keys = [
    "TODAY",
    "areaKey",
    "areaLabel",
    "areaSort",
    "avg",
    "caseOk",
    "daysBetween",
    "fmtDate",
    "groupBy",
    "inPeriod",
    "median",
    "openAt",
    "ordSort",
    "ownerKeyLabel",
    "plural",
    "statusAt",
    "uniq",
    "violOk",
    "violOpenAt",
    "violationAt",
  ];
  const original = new Function(
      ...keys,
      "recordDay",
      'const cell=(n,ids,fmt)=>({n:n,ids:ids?uniq(ids):null,fmt:fmt||"int"});const nos=list=>list.map(x=>x.c?x.c.number:x.number);const count=l=>cell(l.length,nos(l));return ' +
        fs.readFileSync("tests/fixtures/report_catalog_reference.txt", "utf8"),
    )(...keys.map((k) => services[k]), recordDay),
    current = createReportCatalog(services);
  assert.deepEqual(
    current.map(({ id, n, label, date, lede }) => ({ id, n, label, date, lede })),
    original.map(({ id, n, label, date, lede }) => ({ id, n, label, date, lede })),
  );
  let seed = 20261124,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  for (let n = 0; n < 250; n++) {
    const summaries = Array.from({ length: random(9) }, (_, i) => ({
      summaryVersion: 6,
      case: {
        id: "c" + i,
        number: "QA-" + i,
        address: "100 TEST ST",
        owner: "Owner " + (i % 2),
        ownerAddr: ["100 TEST ST", "MADISON WI 53703"],
        opened: pick(["2026-01-01", "2026-09-01"]),
        noticeIssued: "2026-01-02",
        status: pick(["Notice", "Referred", "Closed"]),
        closedOn: pick(["", "2026-10-01"]),
        inspector: pick(["Inspector", "Other"]),
        zip: "53703",
      },
      violations: [
        {
          no: "1",
          type: "wall",
          typeLabel: "Wall",
          sections: ["27.05(2)(c)"],
          done: !!random(2),
          doneOn: "2026-10-01",
          opened: "2026-01-02",
          due: "2026-02-01",
          visits: 1,
          cited: 1,
        },
      ],
      citations: [{ no: "1", ordinance: "27.05(2)(c)", issued: "2026-09-01", amount: 197, by: "Inspector", num: "QA" + i }],
      referrals: [{ issued: "2026-09-01", by: "Inspector", owner: "Owner", ownerAddr: ["100 TEST ST", "MADISON WI 53703"] }],
      documents: [{ id: "notice" + i, type: "notice", issued: "2026-01-02", by: "Inspector" }],
      visits: [],
    }));
    ReportsState.S = { parcelMissing: [] };
    const M = model.buildModel(summaries, {}, {}),
      F = {
        from: "2026-01-01",
        to: "2026-12-31",
        asOf: pick(["2026-01-01", "2026-09-30", "2026-12-31"]),
        areaType: pick(["zip", "district"]),
        boundary: pick(["current", "atOpen"]),
        areas: [],
        inspector: pick(["", "Inspector"]),
        ord: pick(["", "27.05(2)(c)"]),
        vtype: pick(["", "wall"]),
        status: pick(["", "open"]),
        owner: "",
      };
    ReportsState.S.F = F;
    for (let i = 0; i < current.length; i++) {
      const run = (r) => {
        try {
          return { value: r.run(M, F) };
        } catch (e) {
          return { error: [e.name, e.message] };
        }
      };
      const a = run(current[i]),
        b = run(original[i]);
      assert.deepEqual(a, b, current[i].id + " scenario " + n);
      assert.ok(!a.error, "report executes: " + current[i].id + " " + a.error);
      checked++;
    }
  }
  // Code-review corrections (2026-11-05). A synthetic snow case: one citation issued January 5.
  const snow = (i, extra = {}) => ({
    summaryVersion: 6,
    case: {
      id: "s" + i,
      number: "QA-SNOW-" + i,
      caseType: "snow-10.28",
      address: "200 SNOW ST",
      owner: "Snow Owner",
      ownerAddr: ["200 SNOW ST", "MADISON WI 53703"],
      opened: "2026-01-05",
      status: "Cited – snow",
      closedOn: "",
      inspector: "Inspector",
      zip: "53703",
      ...extra.case,
    },
    violations: [],
    citations: extra.citations || [{ no: "1", ordinance: "10.28", issued: "2026-01-05", amount: 197, by: "Inspector", num: "QS" + i }],
    referrals: [],
    documents: extra.documents || [{ id: "cit" + i, type: "citation", issued: "2026-01-05", effectiveFrom: "2026-01-05", by: "Inspector" }],
    visits: [],
  });
  const runReport = (id, summaries, F) => {
    ReportsState.S = { parcelMissing: [] };
    const M = model.buildModel(summaries, {}, {});
    ReportsState.S.F = F;
    return current.find((r) => r.id === id).run(M, F);
  };
  const filters = (extra) => ({
    from: "2026-01-01",
    to: "2026-12-31",
    asOf: "2026-01-06",
    areaType: "zip",
    boundary: "current",
    areas: [],
    inspector: "",
    ord: "",
    vtype: "",
    status: "",
    owner: "",
    ...extra,
  });
  // MCR-010: withdrawing the only snow citation on January 10 does not remove the case from a January 6 count.
  const issued = runReport("openCases", [snow(1)], filters());
  const withdrawn = snow(1, {
    citations: [],
    documents: [
      {
        id: "cit1",
        type: "citation",
        issued: "2026-01-05",
        effectiveFrom: "2026-01-05",
        effectiveTo: "2026-01-10",
        void: true,
        voidAt: "2026-01-10",
      },
    ],
  });
  assert.equal(issued.total[1].n, 1, "open as of January 6 before the withdrawal");
  assert.equal(runReport("openCases", [withdrawn], filters()).total[1].n, 1, "still open as of January 6 after the withdrawal");
  assert.equal(runReport("openCases", [withdrawn], filters({ asOf: "2026-01-11" })).total[1].n, 0, "not open after the withdrawal day");
  assert.equal(runReport("openCases", [withdrawn], filters({ asOf: "2026-01-04" })).total[1].n, 0, "not open before it was issued");
  // MCR-011: snow cases closed on filing are not still open in Repeat cases by owner, as in All cases.
  const closed = [snow(2, { case: { closedOn: "2026-01-06" } }), snow(3, { case: { closedOn: "2026-01-06" } })];
  const repeat = runReport("repeatOwners", closed, filters({ asOf: "2026-10-29" }));
  const repeatRow = repeat.rows.find((r) => r[1] && String(r[1]).length);
  assert.equal(repeat.rows[0][2].n, 2, "two cases for the owner");
  assert.equal(repeat.rows[0][3].n, 0, "neither filed snow case is still open");
  assert.ok(repeatRow);
  const all = runReport("allCases", closed, filters({ asOf: "2026-10-29" }));
  assert.equal(all.total[2].n, 0, "All cases agrees: none still open");
  const mixed = runReport("repeatOwners", [closed[0], snow(4)], filters({ asOf: "2026-10-29" }));
  assert.equal(mixed.rows[0][3].n, 1, "an unfiled snow case stays open");
  console.log("PASS snow as-of withdrawal (MCR-010) and repeat-owner filing closure (MCR-011)");
  console.log("PASS independent report catalog: 11 inert definitions, " + checked + " real-model comparisons and exact metadata");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
