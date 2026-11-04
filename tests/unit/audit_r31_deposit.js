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
    citationReview,
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
  const manual = {
    id: "manual-level",
    caseId: "k1",
    type: "citation",
    draft: true,
    authoringVersion: 16,
    mailed: "2026-10-11",
    inspDate: "2026-10-10",
    inspTime: "09:00",
    items: [{ id: "level-item", no: "1", title: "Wall", sections: ["27.05(2)(c)"], cite: true }],
    cits: {
      "level-item": {
        ...resolveCitationAmount({ ordinance: "27.05(2)(c)", tier: 1, date: "2026-10-11" }),
        ord: "27.05(2)(c)",
        num: "QA-LEVEL",
        issued: "2026-10-11",
        violDate: "2026-10-10",
        depositMode: "schedule",
      },
    },
  };
  WriterState.DOCS = [manual];
  citationReview(manual);
  const level = manual.cits["level-item"];
  const form = document.createElement("div");
  form.innerHTML = citationReview(manual);
  const select = form.querySelector('[data-review-cit="level-item|offenseLevel"]');
  assert.ok(select);
  assert.deepEqual(
    [...select.options].map((o) => o.value),
    ["", "1", "2", "3"],
  );
  assert.equal(select.value, "");
  editCitation(manual, "level-item", "offenseLevel", "2");
  assert.match(citationDepositFault(level, manual, manual.items[0]), /source/);
  editCitation(manual, "level-item", "tierOverrideSource", "Synthetic approved court tier decision");
  for (const [value, base, amount] of [
    ["1", "100.00", "197.00"],
    ["2", "200.00", "323.00"],
    ["3", "200.00", "323.00"],
  ]) {
    editCitation(manual, "level-item", "offenseLevel", value);
    assert.equal(level.tierOverride, value);
    assert.equal(Object.hasOwn(level, "offenseLevel"), false, "the UI selector stores only the existing override fields");
    assert.equal(level.base, Number(base));
    assert.equal(level.amount, amount);
    assert.equal(citationDepositFault(level, manual, manual.items[0]), "");
    assert.equal(level.num, "QA-LEVEL");
  }
  const unchanged = JSON.stringify(manual);
  editCitation(manual, "level-item", "offenseLevel", "bad");
  assert.equal(JSON.stringify(manual), unchanged);
  editCitation(manual, "level-item", "offenseLevel", "");
  assert.equal(level.tierOverride, undefined);
  assert.equal(level.tierOverrideSource, undefined);
  assert.equal(level.amount, "197.00");
  assert.equal(level.tier, "1st");
  manual.items[0].sections = ["18.08"];
  manual.cits["level-item"] = {
    ...resolveCitationAmount({ ordinance: "18.08", tier: 1, date: "2026-10-11" }),
    ord: "18.08",
    num: "QA-LEVEL-3",
    issued: "2026-10-11",
    violDate: "2026-10-10",
    depositMode: "schedule",
    tierOverrideSource: "Synthetic approved three-level decision",
  };
  for (const [value, base, amount] of [
    ["1", 200, "323.00"],
    ["2", 500, "701.00"],
    ["3", 1000, "1331.00"],
  ]) {
    editCitation(manual, "level-item", "offenseLevel", value);
    const c = manual.cits["level-item"];
    assert.equal(c.base, base);
    assert.equal(c.amount, amount);
    assert.equal(citationDepositFault(c, manual, manual.items[0]), "");
  }
  editCitation(manual, "level-item", "offenseLevel", "");
  assert.equal(manual.cits["level-item"].amount, "323.00");
  manual.pendingAmendment = {};
  const pending = JSON.stringify(manual);
  editCitation(manual, "level-item", "offenseLevel", "3");
  assert.equal(JSON.stringify(manual), pending);
  delete manual.pendingAmendment;
  manual.draft = false;
  const issued = JSON.stringify(manual);
  editCitation(manual, "level-item", "offenseLevel", "3");
  assert.equal(JSON.stringify(manual), issued);
  console.log("PASS R31 required deposits, edits, renderer and print guard");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
