/* Retained deposit/pricing/renderer assertions through real feature owners without Writer startup. */
const fs = require("fs"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
Object.assign(global, { window: dom.window, document: dom.window.document, getSelection: () => dom.window.getSelection() });
(async () => {
  const {
    WriterState,
    today,
    recordDay,
    addDays,
    doc,
    newDoc,
    initialCitations,
    depositStep,
    resolveCitationAmount,
    formatDeposit,
    editCitation,
    citationDepositFault,
    citationFaces,
    printJob,
  } = await require("../fixtures/citation_deposit_workflow.cjs")();

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
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
