/* The isolated Reports workflow must provide the same live-day adapter as production. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom");
const NativeDate = Date;
let instant = "2026-11-27T18:00:00Z";
global.Date = class extends NativeDate {
  constructor(...args) {
    super(...(args.length ? args : [instant]));
  }
};
const dom = new JSDOM("", { url: "http://127.0.0.1:8777/" });
Object.assign(global, { window: dom.window, document: dom.window.document });
try {
  const { ReportsState: s, buildModel, reportById } = require("../fixtures/report_analysis.cjs")();
  const model = buildModel(
    [
      {
        summaryVersion: 6,
        case: { number: "QA-ANALYSIS", owner: "Synthetic", address: "1 TEST ST", opened: "2026-11-01", noticeIssued: "2026-11-01", status: "Notice" },
        violations: [{ no: "1", title: "Repair", type: "structural", typeLabel: "Structural", sections: ["27.05(2)(c)"], done: false }],
        citations: [],
        referrals: [],
        visits: [],
        documents: [],
        corrections: [],
      },
    ],
    {},
    {},
  );
  const filters = { ...s.S.F, from: "2026-01-01", to: "2026-12-31" };
  const first = reportById("daysToCompliance").run(model, filters);
  assert.equal(first.total[6].n, 26, "open-item age uses the supplied current day");
  instant = "2026-11-28T18:00:00Z";
  const next = reportById("daysToCompliance").run(model, filters);
  assert.equal(next.total[6].n, 27, "an already-created fixture reads the clock on the next operation");
  console.log("PASS isolated Reports analysis supplies the live production clock across City day rollover");
} finally {
  global.Date = NativeDate;
  dom.window.close();
}
