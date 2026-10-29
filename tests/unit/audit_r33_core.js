/* Retained court/mandatory/legacy-face regression through focused public citation owners. */
const fs = require("fs"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', { url: "http://127.0.0.1:8777/" });
Object.assign(global, { window: dom.window, document: dom.window.document });
(async () => {
  const {
    WriterState,
    clone,
    freezeSources,
    today,
    recordDay,
    addDays,
    doc,
    newDoc,
    initialCitations,
    resolveCitationAmount,
    policyAt,
    citationFaces,
  } = await require("../fixtures/citation_deposit_workflow.cjs")();

  const legacy = JSON.parse(fs.readFileSync("tests/fixtures/reference/r32-legacy-citation-face.json"));
  assert.equal(citationFaces(legacy.document, true), legacy.html);
  const fresh = clone(legacy.document);
  fresh.caseId = "k1";
  fresh.inspectorId = "i4";
  fresh.authoringVersion = 9;
  fresh.frozen = null;
  assert.equal((citationFaces(fresh, true).match(/RM#203,/g) || []).length, 4);
  fresh.frozen = freezeSources(fresh);
  assert.equal(fresh.frozen.court.room, "RM#203,");
  for (const c of Object.values(fresh.cits))
    Object.assign(c, { ord: "23.45", mandatoryAppearance: true, amount: "", base: "", cc: "", assessments: null });
  assert.ok(citationFaces({ ...fresh, draft: true }, true).includes("preview is on hold"));
  fresh.draft = false;
  const html = citationFaces(fresh, true);
  assert.equal((html.match(/NONE – MANDATORY APPEARANCE/g) || []).length, 4);
  assert.equal((html.match(/Building Inspection Case Number/g) || []).length, 4);
  assert.equal((html.match(/RM#203,/g) || []).length, 4);
  for (const c of Object.values(fresh.cits)) c.ord = "23.20(2)";
  assert.equal((citationFaces(fresh, true).match(/NONE – MANDATORY APPEARANCE/g) || []).length, 4);
  const rows = policyAt("2026-10-12").entries.filter((e) => e.ordinance === "29.40(4)(b)"),
    small = rows.find((e) => /Less than/i.test(e.description)),
    large = rows.find((e) => /or More/i.test(e.description));
  const price = resolveCitationAmount({
    ordinance: "29.40(4)(b)",
    entryId: small.id,
    tier: 1,
    date: "2026-10-12",
    measurements: { area: 200000, days: 400 },
  });
  assert.equal(price.scheduleEntryId, large.id);
  assert.equal(price.amount, "12761.00");
  assert.match(price.rowSelectionNotice, /200,000/);
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId),
    key = JSON.stringify(["ENF_PM_PROPMAINT", "OTHER", 748]);
  d.items = [
    {
      id: "corrected",
      no: "1",
      libraryKey: key,
      title: "Animal Feces",
      sections: ["27.04(2)(c)"],
      text: "Remove animal feces.",
      due: addDays(recordDay(today), 21),
      cite: true,
    },
  ];
  initialCitations.prepare(d);
  assert.deepEqual(d.items[0].sections, ["27.05(3)(a)"]);
  assert.equal(d.items[0].libraryKey, key);
  assert.equal(d.cits.corrected.amount, "323.00");
  assert.match(d.items[0].citationReviewNotice, /corrected to 27.05/);
  console.log("PASS R33 immutable R32 faces, court fields, mandatory labels, size selection and draft library correction");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
