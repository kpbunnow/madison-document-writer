globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage());
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.confirm = () => true;
global.fetch = async () => {
  throw Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(resolveCitationAmount({ ordinance: "27.05(2)(c)", tier: 1, date: "2026-10-11" }).amount, "197.00");
  assert.equal(resolveCitationAmount({ ordinance: "SPS321.125", tier: 1, date: "2026-10-11" }).kind, "needs-basis");
  assert.equal(formatDeposit("6411.00"), "$6,411.00");
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  d.items = [
    { id: "qa31", no: "1", title: "Synthetic charge", text: "Repair.", cite: true, sections: ["SPS321.125"], due: addDays(recordDay(today), 21) },
  ];
  initialCitations.prepare(d);
  assert.equal(d.cits.qa31, undefined);
  assert.ok(d.depositRequests.qa31);
  assert.throws(() => printJob(initialCitations.preview(d)), /deposit/i);
  assert.equal(
    depositStep.complete(d, "qa31", { ord: "SPS321.125", depositMode: "base", base: "5000", depositSource: "Synthetic court approved base." }),
    true,
  );
  let c = d.cits.qa31;
  assert.equal(c.amount, "6411.00");
  assert.ok(c.depositSource);
  editCitation(d, "qa31", "depositMode", "total");
  assert.equal(c.amount, "6411.00");
  editCitation(d, "qa31", "depositMode", "base");
  assert.equal(c.amount, "6411.00");
  editCitation(d, "qa31", "ord", "SPS999.99");
  assert.equal(c.amount, "6411.00");
  assert.ok(c.reconfirmDeposit);
  assert.match(citationDepositFault(c, d, d.items[0]), /confirm/i);
  const p = initialCitations.preview(d);
  p.authoringVersion = 7;
  assert.ok(citationFaces(p, true).includes("$6,411.00"));
  assert.ok(citationFaces(p, true).includes('class="cit cit-dollar"'));
  p.authoringVersion = 6;
  assert.ok(!citationFaces(p, true).includes("cit-dollar"));
  assert.ok(!citationFaces(p, true).includes("$6,411.00"));
  const legacy = JSON.parse(fs.readFileSync("tests/fixtures/reference/r30-legacy-citation-face.json"));
  assert.equal(citationFaces(legacy.document, true), legacy.html);
  console.log("PASS R31 required deposits, edits, renderer and print guard");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
