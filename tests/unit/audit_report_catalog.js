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
    services = { ...facts, ...model, openAt: (c, date) => facts.openAt(c, date, model), TODAY: "2026-10-29" };
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
  console.log("PASS independent report catalog: 11 inert definitions, " + checked + " real-model comparisons and exact metadata");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
