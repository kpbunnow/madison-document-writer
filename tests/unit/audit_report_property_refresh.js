/* A searched property must follow the current loaded model, including changed and excluded cases. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom");
(async () => {
  const dom = new JSDOM('<div id="app"></div>', { url: "http://127.0.0.1:8777/" });
  Object.assign(global, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage });
  window.scrollTo = () => {};
  const api = await require("../fixtures/report_exports.cjs")({ navigation: true }),
    s = api.ReportsState.S;
  const row = (number, owner) => ({
    number,
    address: "1 SYNTHETIC ST",
    parcel: "",
    parcelKey: "",
    alderNow: "",
    alderAtOpen: "",
    owner,
    ownerAddr: [],
    ownerKey: "",
    inspector: "Synthetic",
    opened: "2026-01-01",
    closedOn: "",
    status: "Notice",
    documents: [],
    violations: [],
    visits: [],
    citations: [],
  });
  function model(cases) {
    return { cases, counted: cases, byNo: Object.fromEntries(cases.map((c) => [c.number, c])), types: [], ords: [], inspectors: [] };
  }
  const before = row("CASE-1", "Earlier owner");
  s.M = model([before]);
  s.raw = { readAt: "2026-11-27T12:00:00Z", missing: [], stale: [], unreadable: [], mismatched: [] };
  s.phase = "ready";
  s.screen = "property";
  s.prop = { q: "SYNTHETIC", hits: [before] };
  api.render();
  assert.match(document.getElementById("app").textContent, /Earlier owner/);
  s.M = model([row("CASE-1", "Corrected owner"), row("CASE-2", "New matching case")]);
  s.raw.readAt = "2026-11-28T12:00:00Z";
  api.render();
  assert.match(document.getElementById("app").textContent, /Corrected owner/, "the refreshed property card must use the new model");
  assert.match(document.getElementById("app").textContent, /New matching case/, "new matching cases appear after refresh");
  assert.doesNotMatch(document.getElementById("app").textContent, /Earlier owner/);
  s.M = model([]);
  api.render();
  assert.equal(document.querySelectorAll(".card-case").length, 0, "excluded/removed summaries do not remain as property cards");
  assert.match(document.getElementById("app").textContent, /No case matches/);
  s.prop = { q: "SYNTHETIC", hits: null };
  api.render();
  assert.doesNotMatch(document.getElementById("app").textContent, /No case matches/, "an unsubmitted search remains unsubmitted");
  dom.window.close();
  console.log("PASS property results use refreshed facts, include new matches, drop excluded records and preserve unsubmitted searches");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
