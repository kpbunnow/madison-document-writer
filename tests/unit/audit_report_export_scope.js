/* Workbook sheet scope (#27): each record sheet's date basis and filter exceptions are stated on the About sheet and
   in the export note, and the selections themselves are unchanged. The expected rows were recorded from the exporter
   before the About and note text changed. */
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage("reports"));
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: "http://127.0.0.1:8777/madison-reports.html",
    pretendToBeVisual: true,
  }),
  w = dom.window;
w.__NO_AUTOLOAD__ = true;
Object.assign(global, { window: w, document: w.document, localStorage: w.localStorage, location: w.location });
w.scrollTo = () => {};
const test = () => {
  const summary = (number, opened, inspector, violation, extra) => ({
    summaryVersion: 6,
    case: { number, address: number + " TEST ST", opened, noticeIssued: opened, status: "Notice", inspector, owner: "OWNER " + number },
    violations: [{ no: "1", title: violation.type, type: violation.type, typeLabel: violation.type, sections: [violation.section] }],
    citations: [],
    referrals: [],
    visits: [],
    documents: [],
    corrections: [],
    ...extra,
  });
  const summaries = [
    // Opened in January; visited in March; cited in January by another inspector.
    summary(
      "QA-A",
      "2026-01-05",
      "INSPECTOR A",
      { type: "trash", section: "27.05(2)(c)" },
      {
        visits: [{ date: "2026-03-10", inspector: "INSPECTOR A", results: [{ no: "1", oc: "Not corrected" }] }],
        citations: [{ num: "C-A", no: "1", ordinance: "27.05(2)(c)", issued: "2026-01-20", by: "INSPECTOR B" }],
      },
    ),
    summary(
      "QA-B",
      "2026-01-07",
      "INSPECTOR A",
      { type: "paint", section: "27.05(2)(d)" },
      {
        citations: [{ num: "C-B", no: "1", ordinance: "27.05(2)(d)", issued: "2026-01-25", by: "INSPECTOR A" }],
        referrals: [{ issued: "2026-01-26", by: "INSPECTOR B", owner: "OWNER QA-B", ownerAddr: [] }],
      },
    ),
    // Opened in 2025; cited and corrected in January 2026.
    summary(
      "QA-C",
      "2025-11-03",
      "INSPECTOR A",
      { type: "trash", section: "27.05(2)(c)" },
      {
        citations: [{ num: "C-C", no: "1", ordinance: "27.05(2)(c)", issued: "2026-01-10", by: "INSPECTOR A" }],
        corrections: [
          {
            at: "2026-01-15T18:00:00Z",
            by: "INSPECTOR A",
            docId: "d2",
            replaces: "d1",
            reason: "Typo",
            changes: [{ label: "Owner", before: "X", after: "Y" }],
          },
        ],
      },
    ),
  ];
  ReportsState.S.raw = { readAt: "2026-02-01T10:00:00", summaries, missing: [], stale: [], unreadable: [], mismatched: [] };
  ReportsState.S.M = buildModel(summaries, {}, {});
  ReportsState.S.phase = "ready";
  const january = { ...ReportsState.S.F, from: "2026-01-01", to: "2026-01-31", asOf: "2026-01-31" };
  const recordSheets = ["Cases", "Violations", "Visits", "Citations", "Referrals", "Corrections"];
  const exportWith = (filters) => {
    ReportsState.S.F = { ...january, ...filters };
    const sheets = exportSheets();
    return {
      sheets,
      first: Object.fromEntries(
        recordSheets.map((name) => [
          name,
          sheets
            .find((s) => s.name === name)
            .rows.slice(1)
            .map((r) => r[0]),
        ]),
      ),
    };
  };

  // Unchanged selections, recorded before the text change.
  const expected = {
    none: {
      Cases: ["QA-B", "QA-A"],
      Violations: ["QA-B", "QA-A"],
      Visits: ["QA-A"],
      Citations: ["C-B", "C-A", "C-C"],
      Referrals: ["QA-B"],
      Corrections: ["QA-C"],
    },
    vtype: { Cases: ["QA-B"], Violations: ["QA-B"], Visits: [], Citations: ["C-B", "C-A", "C-C"], Referrals: ["QA-B"], Corrections: [] },
    inspector: { Cases: [], Violations: [], Visits: [], Citations: ["C-A"], Referrals: ["QA-B"], Corrections: [] },
    ord: { Cases: ["QA-A"], Violations: ["QA-A"], Visits: ["QA-A"], Citations: ["C-A", "C-C"], Referrals: [], Corrections: ["QA-C"] },
  };
  const none = exportWith({});
  assert.deepEqual(none.first, expected.none);
  // Visits: a case opened in the period keeps a visit dated outside it.
  assert.equal(none.sheets.find((s) => s.name === "Visits").rows[1][3].d, "2026-03-10");
  // Corrections: a case opened in 2025 appears by the date its correction was recorded, while Cases omits it.
  assert.ok(!none.first.Cases.includes("QA-C") && none.first.Corrections.includes("QA-C"));
  // Citations: violation type is not applied, so a citation on a case whose only item has another type remains.
  const vtype = exportWith({ vtype: "paint" });
  assert.deepEqual(vtype.first, expected.vtype);
  assert.ok(!vtype.first.Cases.includes("QA-A") && vtype.first.Citations.includes("C-A"));
  // Inspector is the issuing or referring inspector on Citations and Referrals, the case inspector elsewhere.
  assert.deepEqual(exportWith({ inspector: "INSPECTOR B" }).first, expected.inspector);
  assert.deepEqual(exportWith({ ord: "27.05(2)(c)" }).first, expected.ord);

  // The About sheet states the basis it now promises.
  const about = none.sheets.find((s) => s.name === "About").rows;
  const row = (label) => about.find((r) => r[0] === label);
  assert.deepEqual(row("Period"), ["Period", "01/01/2026 to 01/31/2026 (each sheet's date is listed under Sheet scope)"]);
  const scopeAt = about.findIndex((r) => r[0] === "Sheet scope"),
    definitionsAt = about.findIndex((r) => r[0] === "Definitions");
  assert.ok(scopeAt > 0 && scopeAt < definitionsAt);
  assert.deepEqual(
    about.slice(scopeAt + 1, scopeAt + 8).map((r) => r[0]),
    recordSheets.concat("Numbered report sheets"),
  );
  assert.match(row("Cases")[1], /opened in the period \(case opening date\)/);
  assert.match(row("Violations")[1], /case opening date/);
  assert.match(row("Visits")[1], /visit can fall outside the period/);
  assert.match(row("Citations")[1], /issued in the period \(issue date\)/);
  assert.match(row("Citations")[1], /Inspector means the issuing inspector/);
  assert.match(row("Citations")[1], /Violation type is not applied/);
  assert.match(row("Referrals")[1], /Inspector means the referring inspector/);
  assert.match(row("Corrections")[1], /recorded in the period \(date recorded, Central time\)/);
  assert.match(row("Numbered report sheets")[1], /Reports 1 and 3 use the As of date/);
  assert.match(row("Case opened")[1], /Corrections sheet filters by the date each correction was recorded/);
  const bold = none.sheets.find((s) => s.name === "About").opt.boldRows;
  assert.ok(bold.includes(scopeAt) && bold.includes(definitionsAt));
  // The export note no longer claims that every sheet applies the same filters.
  render();
  const note = document.querySelector("[data-report-export-note]").textContent;
  assert.doesNotMatch(note, /All sheets use the same filters/);
  assert.match(note, /Citations ignores violation type and uses the issuing inspector/);
  assert.match(note, /correction recorded/);
  assert.match(note, /The About sheet lists each sheet’s scope/);
  console.log("PASS workbook sheet scope: unchanged selections, About sheet date basis and filter exceptions, export note");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")();");
