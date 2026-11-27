/* A violation closed by its citation (an initial citation-only item) and a snow case's item are not open (code review
   2026-11-27): the workbook's per-case Open violations and the property card now agree with Open violations by area.
   The retained owner is compiled beside the current one to show the earlier behavior. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/reports_screens.js", "utf8"),
    node = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }).body.find((n) => n.declaration?.id?.name === "createReportsScreens");
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: {
        contents: contents + '\nexport {ReportsState} from "./state.js";export {esc} from "./presentation_format.js";',
        resolveDir: path.resolve("app/modules"),
      },
      bundle: true,
      write: false,
      format: "cjs",
      plugins: [
        {
          name: "data",
          setup(b) {
            b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
          },
        },
      ],
    });
    const box = { exports: {} };
    class Clock extends Date {
      constructor(...a) {
        super(...(a.length ? a : ["2026-10-28T12:00:00Z"]));
      }
    }
    new Function("Date", "module", "exports", b.outputFiles[0].text)(Clock, box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(source.slice(0, node.start) + fs.readFileSync("tests/fixtures/reports_owner_phase_reference.txt", "utf8") + source.slice(node.end)),
  ]);
  let seed = 20261114,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function kase(n) {
    return {
      number: "QA-" + n,
      address: "1 TEST <&> ST",
      parcel: "070913125237",
      parcelKey: "070913125237",
      zip: "53703",
      alderNow: "1",
      alderAtOpen: "2",
      building: "3",
      inspector: "INSPECTOR",
      opened: "2026-01-01",
      noticeIssued: "2026-01-02",
      closedOn: "",
      status: "Notice",
      owner: "OWNER <&>",
      ownerKey: "owner",
      ownerAddr: ["1 TEST ST", "MADISON WI 53703"],
      lat: 43,
      lon: -89,
      caseType: "",
      located: true,
      looked: true,
      description: "Case <&>",
      integrity: { label: "Verified" },
      violations: [
        {
          no: "1",
          title: "Wall <&>",
          typeLabel: "Maintenance",
          typeHow: "matched",
          sections: ["27.05(2)(c)"],
          due: "2026-02-01",
          done: false,
          doneOn: "",
          lastOutcome: "none",
          visits: 1,
          cited: 1,
        },
      ],
      citations: [
        {
          num: "C1",
          no: "1",
          ordinance: "27.05(2)(c)",
          desc: "WALL",
          issued: "2026-01-03",
          courtDate: "2026-02-03",
          amount: 197,
          tier: "1st",
          by: "INSPECTOR",
        },
      ],
      referrals: [{ issued: "2026-01-04", by: "INSPECTOR", owner: "OWNER", ownerAddr: [], ownerKey: "owner" }],
      visits: [{ date: "2026-01-03", inspector: "INSPECTOR", results: [{ no: "1", oc: "none" }] }],
      documents: [{ issued: "2026-01-02", label: "Notice <&>", by: "INSPECTOR", annotations: [{ at: "2026-01-03T12:00:00Z", text: "Note <&>" }] }],
      summary: {
        corrections: [
          {
            at: "2026-01-04T12:00:00Z",
            by: "INSPECTOR",
            docId: "new",
            replaces: "old",
            reason: "Typo",
            changes: [{ label: "Owner", before: "X", after: "Y" }],
          },
        ],
      },
    };
  }
  function fixture(count = 2) {
    return {
      cases: Array.from({ length: count }, (_, n) => kase(n)),
      F: {
        from: "2026-01-01",
        to: "2026-12-31",
        asOf: "2026-12-31",
        areas: [],
        areaType: "district",
        boundary: "current",
        inspector: "",
        vtype: "",
        ord: "",
        status: "",
        owner: "",
      },
      raw: { readAt: "2026-10-28T12:00:00", caseDir: "SYNTHETIC<&>", summaries: [], missing: [], stale: [], unreadable: [], mismatched: [] },
      areas: {},
      rows: [[{ kase: "QA-0" }, { n: 3, fmt: "int", ids: ["QA-0"] }]],
      total: ["Total", { n: 3, fmt: "int" }],
      sort: null,
      fail: 0,
    };
  }
  function run(api, input) {
    const x = structuredClone(input),
      calls = [];
    let steps = 0;
    const effect =
      (name, fn) =>
      (...args) => {
        calls.push([name, ...structuredClone(args)]);
        if (++steps === x.fail) throw new Error("interrupted " + name);
        return fn(...args);
      };
    const facts = {
      uniq: effect("uniq", (a) => [...new Set(a)]),
      areaSort: (a, b) => String(a).localeCompare(String(b)),
      caseOk: effect(
        "caseOk",
        (c, F, opt = {}) =>
          (!F.inspector || opt.noInspector || c.inspector === F.inspector) &&
          (!F.vtype || opt.noViol || c.violations.some((v) => v.typeLabel === F.vtype)),
      ),
      inPeriod: effect("inPeriod", (d, F) => d >= F.from && d <= F.to),
      violOk: effect("violOk", (v, F) => !F.vtype || v.typeLabel === F.vtype),
      areaKey: effect("areaKey", (c) => c.alderNow),
      areaLabel: effect("areaLabel", (a) => "Area " + a),
      ownerKeyLabel: effect("owner", (k) => String(k || "")),
      daysBetween: effect("days", (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)),
      groupBy: (items, key) =>
        effect("groupBy", (items) => {
          const groups = new Map();
          for (const item of items) {
            const k = key(item);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(item);
          }
          return groups;
        })(items),
      normStreet: effect("street", (value) => String(value).toUpperCase()),
      validISO: effect("valid", (s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
    };
    const res = { cols: ["Case", "Count"], rows: x.rows, total: x.total, note: "Scope <&>", points: x.cases, area: {} };
    const services = {
      facts,
      STATUSES: ["Notice", "Closed"],
      STATUS_COL: { Notice: "#123456", Closed: "#abcdef" },
      reports_reportpresentationContext: () => ({
        S: api.ReportsState.S,
        esc: api.esc,
        fmtDate: (s) => String(s),
        areaLabel: (a) => String(a),
        ownerKeyLabel: (a) => String(a),
        REPORTS: services.REPORTS,
        reportById: (id) => services.REPORTS.find((r) => r.id === id),
        SAVED_VIEWS: [],
        fmtNum: services.fmtNum,
        plural: services.plural,
        areaKey: facts.areaKey,
      }),
      exports: {
        CRC_T: new Uint32Array(256),
        xesc: effect("xml", api.esc),
        excelDate: effect("excel", (s) => Math.round((Date.parse(s) - Date.parse("1899-12-30")) / 86400000)),
        STYLES: "<styles/>",
        EXPORT_SCOPE: [["Cases", "case opening date"]],
      },
      D: effect("D", (d) => ({ d })),
      fmtDate: effect("date", (s) => String(s || "")),
      fmtDays: effect("daysFormat", (n) => String(n)),
      fmtNum: effect("numFormat", (n) => String(n)),
      fmtMoney: effect("money", (n) => "$" + n),
      esc: effect("esc", api.esc),
      numOr: effect("num", (v) => (v == null ? null : Number(v))),
      iso: effect("iso", (d) => d.toISOString().slice(0, 10)),
      humanCorrectionValue: effect("change", (v) => JSON.stringify(v)),
      plural: effect("plural", (n, s, p) => n + " " + (n === 1 ? s : p || s + "s")),
      activeFilters: () => !!x.F.inspector,
      A11Y: { notify: effect("notify", () => {}) },
      REPORTS: [{ id: "sample", n: 1, label: "Sample", run: effect("report", () => res) }],
      reportById: (id) => services.REPORTS.find((r) => r.id === id),
      DEFINITIONS: [["Case opened", "Opening date"]],
    };
    const state = api.ReportsState;
    state.S = {
      M: {
        cases: x.cases,
        counted: x.cases.filter((c) => !c.excluded),
        versionStale: [],
        types: [],
        distField: x.distField,
        zipField: x.zipField,
        inspectors: ["Inspector <&>"],
        ords: ["27.05<&>"],
        types: [],
      },
      F: x.F,
      raw: x.raw,
      areas: x.areas,
      tableSort: x.sort,
      screen: "sample",
      rep: { r: { label: "Sample" } },
      drill: x.drill,
      parcelNote: x.parcelNote,
      prop: { q: "Test <&>", hits: x.cases },
      own: { q: "", key: "owner" },
      basemap: "labels",
    };
    const owner = api.createReportsScreens(services);
    services.actions = () => owner.reportActions();
    assert.deepEqual(calls, [], "inert constructor");
    const out = {};
    for (const [key, fn] of Object.entries({
      filters: () => owner.filtersBar("period"),
      asOfFilters: () => owner.filtersBar("asOf"),
      topbar: () => owner.topbar("Report <&>", "Scope <&>", "<button>Owned action</button>"),
      loadingShell: () => {
        state.S.phase = "loading";
        state.S.msg = "Reading <&>";
        return owner.shell();
      },
      errorShell: () => {
        state.S.phase = "error";
        state.S.error = "Unavailable <&>";
        return owner.shell();
      },
      sheets: () => owner.exportSheets(),
      workbook: () =>
        owner.workbook([
          { name: "Repeated[]", rows: [["Name", { d: "2026-01-01" }, { m: 197 }]], opt: { header: true } },
          { name: "Repeated[]", rows: x.rows, opt: { boldRows: [0] } },
        ]),
      table: () => owner.tablePanel(res, "In period"),
      cases: () => owner.caseTable(x.cases),
      cards: () => x.cases.map((c) => owner.caseCard(c)),
      data: () => owner.dataView(),
      property: () => owner.propertyView(),
      owner: () => owner.ownerView(),
      map: () => owner.mapPanel({ label: "Report <&>" }, res),
      report: () => owner.reportScreen({ ...services.REPORTS[0], n: 1, label: "Report <&>", lede: "Scope <&>", date: "period" }),
      invalidPeriod: () => {
        const from = state.S.F.from;
        state.S.F.from = "9999-12-31";
        try {
          return owner.reportScreen({ ...services.REPORTS[0], label: "Report <&>", lede: "Scope <&>", date: "period" });
        } finally {
          state.S.F.from = from;
        }
      },
    })) {
      try {
        out[key] = fn();
      } catch (e) {
        out[key] = { error: [e.name, e.message] };
      }
    }
    return { out, calls, notice: state.S.reportNotice };
  }
  const x = fixture(3);
  // QA-0 keeps an ordinary open item. QA-1's item was closed by its initial citation. QA-2 is a snow case: no notice.
  x.cases[1].violations[0].citationClosedOn = "2026-01-03";
  Object.assign(x.cases[2], { caseType: "snow-10.28", noticeIssued: "", status: "Cited – snow" });
  const openColumn = (result) => {
    const sheet = result.out.sheets.find((s) => s.name === "Cases"),
      col = sheet.rows[0].indexOf("Open violations");
    return Object.fromEntries(sheet.rows.slice(1).map((row) => [row[0], row[col]]));
  };
  const now = run(current, x),
    before = run(legacy, x);
  assert.deepEqual(openColumn(before), { "QA-0": 1, "QA-1": 1, "QA-2": 1 }, "the retained export counted both as open");
  assert.deepEqual(openColumn(now), { "QA-0": 1, "QA-1": 0, "QA-2": 0 });
  assert.match(now.out.cards[1], /Closed by citation 2026-01-03/);
  assert.doesNotMatch(before.out.cards[1], /Closed by citation/);
  assert.match(now.out.cards[0], /No change/, "an ordinary item keeps its last outcome");
  console.log("PASS items closed by citation and snow items are not open in the workbook or on the property card");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
