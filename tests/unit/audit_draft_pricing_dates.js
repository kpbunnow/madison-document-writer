/* A draft's incomplete/invalid issue date must remain editable and render its readiness fault, not throw. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom");
(async () => {
  const dom = new JSDOM('<div id="app"></div><div id="overlay"></div>');
  Object.assign(global, { window: dom.window, document: dom.window.document });
  const flow = await require("../fixtures/citation_deposit_workflow.cjs")();
  flow.newDoc("k1", "notice");
  const d = flow.doc(flow.WriterState.state.docId);
  d.items = [
    {
      id: "item",
      no: "1",
      title: "Noxious weeds",
      text: "Remove weeds.",
      cite: true,
      sections: ["27.05(2)(b)"],
      due: flow.addDays(flow.recordDay(flow.today), 21),
    },
  ];
  flow.initialCitations.prepare(d);
  const original = structuredClone(d.cits.item),
    currentDay = flow.recordDay(flow.today);
  for (const bad of ["not a date", "2026-02-31", "2026-13-01"]) {
    d.cits.item = structuredClone(original);
    assert.doesNotThrow(() => flow.editCitation(d, "item", "issued", bad), "invalid draft date must reach readiness without crashing its edit");
    assert.equal(d.cits.item.issued, bad, "unreadable entered text stays for deliberate correction");
    assert.doesNotThrow(() => flow.citationReview(d));
    assert.match(flow.citationDepositFault(d.cits.item, flow.initialCitations.preview(d), d.items[0]), /valid.*date/i);
    assert.equal(d.cits.item.amount, original.amount, "an invalid date does not invent a new price");
    assert.doesNotThrow(() => flow.editCitation(d, "item", "issued", currentDay));
    assert.equal(flow.citationDepositFault(d.cits.item, flow.initialCitations.preview(d), d.items[0]), "");
  }
  d.cits.item = { ...structuredClone(original), depositMode: "base", issued: "not a date", pricedOn: "not a date" };
  assert.doesNotThrow(() => flow.editCitation(d, "item", "base", "120"));
  assert.doesNotThrow(() => flow.citationReview(d));
  assert.doesNotThrow(() => flow.editCitation(d, "item", "depositMode", "total"));
  assert.doesNotThrow(() => flow.editCitation(d, "item", "depositMode", "base"));
  d.depositRequests = { item: { ...structuredClone(original), issued: "not a date", pricedOn: "not a date" } };
  delete d.cits.item;
  const request = structuredClone(d.depositRequests.item);
  assert.equal(flow.depositStep.complete(d, "item", { depositMode: "base", base: "120", depositSource: "Synthetic approved source" }), false);
  assert.deepEqual(d.depositRequests.item, request, "invalid date cannot complete or replace the retained request");
  assert.doesNotThrow(() => flow.citationReview(d));
  dom.window.close();
  console.log("PASS invalid citation draft dates retain edits/amounts, show readiness faults, support manual fields and recover after correction");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
