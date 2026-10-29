/* Retained deposit/pricing/renderer assertions through real feature owners without Writer startup. */
const fs = require("fs"),
  assert = require("assert/strict"),
  cp = require("child_process"),
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
    canonicalOrdinance,
    policyAt,
    editCitation,
    citationReview,
    citationDepositFault,
    citationFaces,
  } = await require("../fixtures/citation_deposit_workflow.cjs")();

  assert.equal(canonicalOrdinance("Section 27.05(2)(c)"), "27.05(2)(c)");
  const cases = [];
  for (const e of policyAt("2026-10-11").entries)
    for (let tier = 1; tier <= Math.max(5, e.tiers.length + 1); tier++) {
      const m = { diameter: 12, removed: true, tons: 2.01, percent: 20.01, area: 200000, days: 400, fee: 60 };
      const args = { ordinance: e.ordinance, entryId: e.id, tier, date: "2026-10-11", measurements: m };
      const result = resolveCitationAmount(args);
      cases.push({
        args,
        base: result.kind === "priced" && !result.mandatoryAppearance ? Math.round(result.base * 100) : null,
        mandatory: !!result.mandatoryAppearance,
      });
      assert.equal(result.kind, "priced", e.id);
    }
  let seed = 32011026;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let n = 0; n < 500; n++) {
    const args = {
      ordinance: "29.40(4)(b)",
      tier: 1,
      date: "2026-10-11",
      measurements: { area: Math.floor(random() * 250000), days: Math.floor(random() * 700) },
    };
    const result = resolveCitationAmount(args);
    cases.push({ args, base: Math.round(result.base * 100) });
  }
  for (const e of policyAt("2026-10-11").entries.filter((e) => e.measurements?.length))
    for (let n = 0; n < 50; n++) {
      const args = {
        ordinance: e.ordinance,
        entryId: e.id,
        tier: 1,
        date: "2026-10-11",
        measurements: {
          diameter: 1 + Math.floor(random() * 60),
          removed: random() > 0.5,
          tons: random() * 5,
          percent: 1 + random() * 99,
          area: Math.floor(random() * 250000),
          days: Math.floor(random() * 700),
          fee: Math.floor(random() * 100),
        },
      };
      const result = resolveCitationAmount(args);
      assert.equal(result.kind, "priced");
      cases.push({ args, base: Math.round(result.base * 100) });
    }
  const answers = JSON.parse(
    cp.execFileSync(
      "python3",
      [
        "-c",
        "import json,sys,citation_pricing as p;print(json.dumps([p.base_cents(p.r" +
          "esolve(x['args']['ordinance'],entry_id=x['args'].get('entryId',''),at=x[" +
          "'args']['date']),x['args']['tier'],x['args']['measurements']) for x in j" +
          "son.load(sys.stdin)]))",
      ],
      { input: JSON.stringify(cases), encoding: "utf8", maxBuffer: 4000000 },
    ),
  );
  cases.forEach((x, n) => assert.equal(x.base, answers[n], JSON.stringify(x.args)));
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  d.items = [
    {
      id: "r32qa",
      no: "1",
      title: "Noxious weeds",
      text: "Remove weeds.",
      cite: true,
      sections: ["27.05(2)(b)"],
      due: addDays(recordDay(today), 21),
    },
  ];
  initialCitations.prepare(d);
  assert.equal(d.cits.r32qa.amount, "197.00");
  const prepared = JSON.parse(JSON.stringify(d.cits.r32qa));
  delete d.cits.r32qa;
  d.depositRequests = { r32qa: prepared };
  initialCitations.prepare(d);
  assert.equal(d.cits.r32qa.amount, "197.00");
  assert.equal(Object.keys(d.depositRequests).length, 0);
  assert.equal(Object.keys(d.depositRequests || {}).length, 0);
  assert.equal(citationDepositFault(d.cits.r32qa, initialCitations.preview(d), d.items[0]), "");
  editCitation(d, "r32qa", "ord", "SPS321.125");
  document.getElementById("app").innerHTML = citationReview(d);
  const method = () => document.querySelector('[data-review-cit="r32qa|depositMode"]');
  assert.equal(method().querySelector("option[value=total]").disabled, false);
  editCitation(d, "r32qa", "ord", "27.05(2)(b)");
  initialCitations.refresh(d);
  assert.equal(method().querySelector("option[value=total]").disabled, true, "Charge changes update the manual option without a full redraw");
  assert.equal(document.querySelector('[data-review-cit="r32qa|base"]').readOnly, true);
  editCitation(d, "r32qa", "ord", "SPS321.125");
  initialCitations.refresh(d);
  assert.equal(method().querySelector("option[value=total]").disabled, false);
  d.items[0].sections = ["10.101(7)(b)"];
  delete d.cits.r32qa;
  initialCitations.prepare(d);
  assert.ok(d.depositRequests.r32qa.measurementFields.length);
  assert.ok(depositStep.complete(d, "r32qa", { depositMode: "schedule", measurements: { diameter: 12 } }));
  assert.equal(d.cits.r32qa.amount, "2347.00");
  assert.equal(citationDepositFault(d.cits.r32qa, initialCitations.preview(d), d.items[0]), "");
  const legacy = JSON.parse(fs.readFileSync("tests/fixtures/reference/r31-legacy-citation-face.json"));
  assert.equal(citationFaces(legacy.document, true), legacy.html);
  const display = JSON.parse(JSON.stringify(legacy.document));
  display.authoringVersion = 8;
  const faces = citationFaces(display, true);
  assert.ok(faces.includes("Base $5,000.00"));
  assert.ok(faces.includes("SPS 321.125"));
  for (const c of Object.values(display.cits)) {
    c.assessments.base = 0;
    c.assessments.penalty = 0;
    c.amount = "71.00";
  }
  assert.ok(citationFaces(display, true).includes("Base $0.00 · Penalty $0.00"));
  assert.equal(
    resolveCitationAmount({ ordinance: "10.185(6)(a)2.", tier: 1, date: "2026-10-11", measurements: { percent: 0.5 } }).kind,
    "needs-basis",
  );
  console.log("PASS R32 " + cases.length + " row/tier/measurement parity and automatic draft workflow");
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
