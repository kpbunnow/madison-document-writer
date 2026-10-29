/* Frozen complete owner protects workbook bytes, sheet scope and Reports section rendering through phased extraction. */
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
      validISO: effect("valid", (s) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
    };
    const res = { cols: ["Case", "Count"], rows: x.rows, total: x.total, note: "Scope <&>" };
    const services = {
      facts,
      STATUSES: ["Notice", "Closed"],
      reports_reportpresentationContext: () => ({
        S: api.ReportsState.S,
        esc: api.esc,
        fmtDate: (s) => String(s),
        areaLabel: (a) => String(a),
        ownerKeyLabel: (a) => String(a),
        REPORTS: services.REPORTS,
        reportById: (id) => services.REPORTS.find((r) => r.id === id),
        SAVED_VIEWS: [],
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
    };
    const owner = api.createReportsScreens(services);
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
    })) {
      try {
        out[key] = fn();
      } catch (e) {
        out[key] = { error: [e.name, e.message] };
      }
    }
    return { out, calls, notice: state.S.reportNotice };
  }
  function compare(x) {
    assert.deepEqual(run(current, x), run(legacy, x), "scenario " + checked++);
  }
  const initial = run(current, fixture());
  for (const [name, result] of Object.entries(initial.out)) assert.ok(!result?.error, "baseline " + name + " executes successfully");
  for (const count of [0, 1, 3]) compare(fixture(count));
  for (let n = 0; n < 300; n++) {
    const x = fixture(random(4));
    x.F.inspector = pick(["", "INSPECTOR", "OTHER"]);
    x.F.vtype = pick(["", "Maintenance", "Other"]);
    x.F.ord = pick(["", "27.05(2)(c)", "other"]);
    x.F.areaType = pick(["district", "zip"]);
    x.F.boundary = pick(["current", "atOpen"]);
    x.F.status = pick(["", "open"]);
    x.F.owner = pick(["", "owner"]);
    x.F.areas = random(2) ? [] : ["1"];
    x.fail = random(3) ? 0 : random(100) + 1;
    x.rows = pick([
      [],
      x.rows,
      [
        {
          dim: true,
          cells: [
            { owner: "owner", text: "Owner <&>" },
            { n: 0, fmt: "money" },
          ],
        },
      ],
      [
        ["plain", { n: 2.5, fmt: "days" }],
        ["second", { n: 3, fmt: "int" }],
      ],
    ]);
    x.total = pick([null, x.total]);
    x.sort = pick([null, { report: "sample", ci: 1, dir: -1 }]);
    x.drill = random(2) ? null : { at: "0:1" };
    x.parcelNote = pick(["", "Lookup <&>"]);
    x.areas = pick([{}, { districts: {}, districtsDate: "2026-10-01", zips: {}, notes: ["Notice <&>"] }]);
    x.distField = pick(["", "district"]);
    x.zipField = pick(["", "zip"]);
    x.raw.missing = pick([[], ["missing<&>.json"]]);
    x.raw.stale = pick([[], ["stale.json"]]);
    x.raw.unreadable = pick([[], ["unreadable.json"]]);
    x.raw.mismatched = pick([[], ["mismatch.json"]]);
    for (const c of x.cases) {
      c.located = !!random(2);
      c.looked = !!random(2);
      c.parcel = pick(["", c.parcel, "bad"]);
      c.parcelKey = pick(["", c.parcelKey]);
      c.ownerKey = pick(["", "owner"]);
      c.caseType = pick(["", "snow-10.28"]);
      c.violations[0].done = !!random(2);
      c.violations[0].doneOn = "2026-01-10";
      c.violations[0].withdrawn = !!random(2);
      c.documents[0].revision = random(2) ? { number: 2, reason: "Corrected <&>" } : null;
      c.documents[0].void = !!random(2);
      c.documents[0].voidReason = "Entered in error";
      c.documents[0].superseded = !!random(2);
      c.citations[0].overrideBasis = random(2)
        ? { administrator: "QA", reason: "Reason", sourceReference: "Source", approvedAt: "2026-01-01T00:00:00Z" }
        : null;
    }
    compare(x);
  }
  console.log(
    "PASS Reports owner phase equivalence " +
      checked +
      " inputs: exact sheets, workbook bytes, table/case/coverage HTML and ordered service exceptions",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
