/* PR 33 review correction (Reports): R61 prints 27.05(2)(g)2 while citation charges keep the canonical
   27.05(2)(g)2. — Reports lists, filters and counts both as one ordinance. Stored summaries are unchanged. */
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
  const summary = (number, section, ordinance) => ({
    summaryVersion: 6,
    case: {
      number,
      address: number + " TEST ST",
      opened: "2026-01-05",
      noticeIssued: "2026-01-05",
      status: "Notice",
      inspector: "INSPECTOR A",
      owner: "OWNER",
    },
    violations: [{ no: "1", title: "Structure", type: "structural", typeLabel: "Structural", sections: [section] }],
    citations: [{ num: "C-" + number, no: "1", ordinance, issued: "2026-01-20", by: "INSPECTOR A" }],
    referrals: [],
    visits: [],
    documents: [],
    corrections: [],
  });
  const summaries = [summary("QA-OLD", "27.05(2)(g)2.", "27.05(2)(g)2."), summary("QA-NEW", "27.05(2)(g)2", "27.05(2)(g)2.")];
  const stored = JSON.stringify(summaries);
  const M = buildModel(summaries, {}, {});
  assert.deepEqual(
    M.ords.filter((x) => x.startsWith("27.05(2)(g)")),
    ["27.05(2)(g)2."],
    "one ordinance entry",
  );
  const F = { ord: "27.05(2)(g)2." };
  assert.deepEqual(
    M.cases.flatMap((c) => c.violations.filter((v) => violOk(v, F)).map((v) => v.c.number)).sort(),
    ["QA-NEW", "QA-OLD"],
    "the filter matches old and new violations",
  );
  assert.equal(M.cases.flatMap((c) => c.citations).filter((x) => x.ordinance === F.ord).length, 2, "and both citations");
  // Other ordinances are unchanged.
  const other = buildModel([summary("QA-C", "27.05(2)(c)", "27.05(2)(c)")], {}, {});
  assert.deepEqual(other.cases[0].violations[0].sections, ["27.05(2)(c)"]);
  assert.equal(JSON.stringify(summaries), stored, "the stored summaries are not changed");
  console.log("PASS R61 Reports treats 27.05(2)(g)2 and 27.05(2)(g)2. as one ordinance");
};
eval(payload + "\n(" + test.toString() + ")();process.exit(0);");
