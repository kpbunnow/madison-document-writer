/* Retained click dispatch protects first-match routing, lazy state reads and synchronous effects. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: 'export {createReportNavigation} from "./report_navigation.js";export {iso,validISO} from "./report_facts.js";',
      resolveDir: path.resolve("app/modules"),
    },
    bundle: true,
    write: false,
    format: "cjs",
  });
  class Clock extends Date {
    constructor(...a) {
      super(...(a.length ? a : ["2026-10-29T12:00:00Z"]));
    }
  }
  let active;
  const window = {
      scrollTo(...a) {
        active.calls.push(["scrollTo", a]);
      },
    },
    document = {
      getElementById(id) {
        active.calls.push(["getElementById", id]);
        if (active.x.missing) return null;
        return {
          value: active.x.query,
          scrollIntoView(a) {
            active.calls.push(["scrollIntoView", a]);
          },
        };
      },
    };
  const box = { exports: {} };
  new Function("Date", "window", "document", "module", "exports", built.outputFiles[0].text)(Clock, window, document, box, box.exports);
  const api = box.exports;
  api.createReportNavigation(
    new Proxy(
      {},
      {
        get(_, k) {
          assert.fail("construction read " + String(k));
        },
      },
    ),
  );
  const keys = [
      "iso",
      "validISO",
      "render",
      "TODAY",
      "openCase",
      "openInWriter",
      "loadAll",
      "exportWorkbook",
      "saveReportView",
      "deleteReportView",
      "propertyHits",
    ],
    reference = fs.readFileSync("tests/fixtures/report_navigation_reference.txt", "utf8"),
    makeOriginal = new Function("ReportsState", ...keys, "Date", "window", "document", "return (" + reference + ");");
  function run(original, input) {
    const x = structuredClone(input),
      calls = [];
    let state = x.state,
      n = 0;
    active = { x, calls };
    const root = {
      get S() {
        calls.push("state");
        return state;
      },
    };
    const service = {
      get state() {
        calls.push("state");
        return state;
      },
      TODAY: "2026-10-29",
      // The day is asked for when it is used; the retained original receives the same day as a value.
      currentDay: () => "2026-10-29",
    };
    for (const key of keys.filter((k) => k !== "TODAY"))
      service[key] = (...args) => {
        calls.push([key, structuredClone(args)]);
        if (++n === x.fail) throw Error("interrupted:" + key);
        if (key === "iso") return api.iso(...args);
        if (key === "validISO") return api.validISO(...args);
        if (key === "propertyHits") return [{ number: String(args[0]) }];
        if (key === "render" && x.replace) state = { ...state, changed: true };
      };
    const handler = original ? makeOriginal(root, ...keys.map((k) => service[k]), Clock, window, document) : api.createReportNavigation(service);
    const event = {
      target: x.absent
        ? {}
        : {
            closest(selector) {
              calls.push(["closest", selector]);
              return x.unmatched ? null : { dataset: x.data };
            },
          },
    };
    let error;
    try {
      handler(event);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { state, calls, error };
  }
  let seed = 20261127,
    count = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function fixture() {
    return {
      data: {},
      fail: 0,
      missing: false,
      query: "test <&>",
      replace: false,
      state: {
        screen: "allCases",
        view: "table",
        savedId: "saved",
        reportNotice: "notice",
        dateMode: "fixed",
        tableSort: { ci: 1, dir: 1 },
        drill: { ids: ["old"] },
        F: { from: "2026-01-01", to: "2026-10-29", asOf: "2026-10-29", areaType: "district", boundary: "current", areas: ["1"], owner: "old" },
        M: { counted: [{ opened: "2025-01-01" }, { opened: "bad" }, { opened: "2026-02-01" }] },
        own: { key: "owner" },
        rep: { res: { cols: ["Area", "Open cases"], rows: [["District 1", { ids: ["one"] }]], total: ["All", { ids: ["one", "two"] }] } },
      },
    };
  }
  const routes = [
    { period: "month" },
    { period: "year" },
    { period: "all" },
    { screen: "data" },
    { view: "map" },
    { basemap: "aerial" },
    { areatype: "zip" },
    { boundary: "atOpen" },
    { drill: "0:1" },
    { drill: "t:1" },
    { case: "one" },
    { writer: "one" },
    { owner: "owner" },
    ...[
      "reload",
      "refreshParcels",
      "export",
      "saveView",
      "deleteView",
      "closeDrill",
      "clearOwner",
      "clearFilters",
      "useOwner",
      "propGo",
      "ownGo",
      "unknown",
    ].map((act) => ({ act })),
  ];
  function compare(x) {
    assert.deepEqual(run(false, x), run(true, x), "scenario " + count++);
  }
  for (const data of routes)
    for (const fail of [0, 1, 2, 3]) {
      const x = fixture();
      Object.assign(x, { data, fail });
      compare(x);
    }
  for (let i = 0; i < 5000; i++) {
    const x = fixture();
    x.data = { ...pick(routes), ...(random(3) === 0 ? pick(routes) : {}) };
    x.fail = random(6);
    x.missing = !!random(2);
    x.replace = !!random(2);
    x.absent = random(30) === 0;
    x.unmatched = random(20) === 0;
    if (random(10) === 0) x.state.rep = null;
    if (random(10) === 0) x.data.drill = "9:9";
    compare(x);
  }
  console.log("PASS report navigation equivalence " + count + " events: first-match routes, synchronous effects, lazy state and interrupted actions");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
