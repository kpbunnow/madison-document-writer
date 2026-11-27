/* Open violations by area: an issued notice is required (code review 2026-11-27). Real model, with the retained catalog for comparison. */
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
  // Open violations by area counts items on cases whose notice was issued by the as-of date. A snow case has no notice
  // (noticeIssued is empty) and its one item is never marked corrected, so it was counted as an open violation forever.
  const summary = (i, extra) => ({
    summaryVersion: 6,
    case: {
      id: "c" + i,
      number: "QA-" + i,
      address: "100 TEST ST",
      owner: "Owner",
      ownerAddr: ["100 TEST ST", "MADISON WI 53703"],
      opened: "2026-01-05",
      noticeIssued: "2026-01-06",
      status: "Notice",
      closedOn: "",
      inspector: "Inspector",
      zip: "53703",
      ...extra,
    },
    violations: [
      { no: "1", type: "wall", typeLabel: "Wall", sections: ["27.05(2)(c)"], done: false, doneOn: "", opened: "2026-01-06", due: "2026-02-01" },
    ],
    citations: [],
    referrals: [],
    documents: [{ id: "doc" + i, type: extra?.caseType ? "citation" : "notice", issued: "2026-01-06", effectiveFrom: "2026-01-06", by: "Inspector" }],
    visits: [],
  });
  const snowCase = summary(2, { caseType: "snow-10.28", noticeIssued: "", status: "Cited – snow", closedOn: "2026-01-07" });
  snowCase.citations = [{ no: "1", ordinance: "10.28", issued: "2026-01-06", amount: 197, by: "Inspector", num: "QS2" }];
  snowCase.violations[0] = { ...snowCase.violations[0], type: "snow", typeLabel: "Snow", sections: ["10.28"] };
  const F = {
    from: "2026-01-01",
    to: "2026-12-31",
    asOf: "2026-03-01",
    areaType: "zip",
    boundary: "current",
    areas: [],
    inspector: "",
    ord: "",
    vtype: "",
    status: "",
    owner: "",
  };
  ReportsState.S = { parcelMissing: [] };
  const M = model.buildModel([summary(1), snowCase], {}, {});
  ReportsState.S.F = F;
  const pick = (list) => list.find((r) => r.id === "openViolations").run(M, F);
  const now = pick(current),
    before = pick(original);
  assert.equal(before.total[1].n, 2, "the retained report counted the snow item as an open violation");
  assert.equal(now.total[1].n, 1, "only the notice case's uncorrected item is open");
  assert.deepEqual(now.total[2].ids, ["QA-1"]);
  F.asOf = "2026-01-05";
  assert.equal(pick(current).total[1].n, 0, "nothing is open before the notice is issued");
  console.log("PASS open violations count only cases with an issued notice; snow cases are not counted as open forever");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
