/* Independent R30 monetary and charge regression vectors. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const payload = Buffer.from(
  /var B="([A-Za-z0-9+/=]+)"/.exec(
    fs.readFileSync(
      path.join(process.env.DW_OUTPUT_DIR || path.join(require("path").resolve(__dirname, "../.."), "build/dist"), "madison-document-writer.html"),
      "utf8",
    ),
  )[1],
  "base64",
).toString();
const golden = JSON.parse(fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "tests/fixtures/deposit_golden.json"), "utf8"));
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
  throw new Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  let failures = 0;
  const check = (name, fn) => {
    try {
      fn();
      console.log("PASS " + name);
    } catch (e) {
      failures++;
      console.error("FAIL " + name + ": " + e.message);
    }
  };
  for (const g of golden.rows)
    check("F1/F2/F4/F8 " + g.ordinance + " tier " + g.tier, () => {
      const f = lookupForf([g.ordinance], "", g.entryId),
        p = f?.tiers?.[Math.min(g.tier, f.tiers.length) - 1];
      if (g.ordinance) assert.equal(Math.round(p?.a * 100), g.base);
      const fees = feeLines(g.base / 100, 48);
      assert.deepEqual(
        fees.rows.map((r) => Math.round(r.v * 100)),
        [g.base, g.penalty, g.jail, g.crimeLab, g.court],
      );
      assert.equal(Math.round(fees.total * 100), g.total);
    });
  for (const o of golden.blocked)
    check("F13/F16/F17 blocked " + o, () =>
      assert.ok(["27.05(2)(s)", "29.21", "30.01(5)"].includes(o) ? lookupForf([o])?.tiers?.length : !lookupForf([o])?.tiers?.length),
    );
  check("F3 numbered paragraphs", () => {
    newDoc("k1", "notice");
    const d = doc(WriterState.state.docId);
    d.items = [{ id: "qa", no: "1", cite: true, sections: ["27.05(2)(h)10."], title: "Test", text: "Repair", due: addDays(recordDay(today), 21) }];
    initialCitations.prepare(d);
    assert.ok(!authoringChecks(initialCitations.preview(d)).some((x) => !x.ok && /one complete ordinance/.test(x.t)));
  });
  check("F10 stale prepared charge", () => {
    const d = doc(WriterState.state.docId);
    d.items[0].sections = ["27.05(2)(cc)"];
    initialCitations.prepare(d);
    assert.equal(d.cits.qa.ord, "");
  });
  check("F11 tree format", () => assert.ok(!JSON.stringify(LIBRARY).includes("27.05(2)f")));
  check("Wednesday court", () => assert.equal(new Date(nextCourtDate("2026-10-08") + "T12:00:00").getDay(), 3));
  for (const o of golden.valid) check("F3/F4 grammar " + o, () => assert.ok(canonicalOrdinance(o)));
  for (const o of golden.invalid) check("F3 rejects list " + o, () => assert.equal(canonicalOrdinance(o), ""));
  check("F14 expanded ranges and F15 retained authorized rows", () => {
    for (const o of [
      "28.141(10)(a)",
      "28.141(10)(b)",
      "28.141(10)(c)",
      "23.24(1)",
      "23.24(2)",
      "27.05(3)(a)",
      "27.085(2)",
      "8.15(1)",
      "9.13",
      "9.13(4)",
      "9.13(7)",
      "9.135",
      "9.136(1)",
      "9.54",
      "9.54(1)",
      "9.54(12)",
      "12.128(14)",
      "12.145(1)(d)",
      "23.61",
    ])
      assert.ok(
        CITATION_POLICY.entries.some((e) => e.ordinance === o),
        o,
      );
  });
  check("F8 unverified Street Tree tiers retained", () => {
    const e = policyAt("2026-10-10").entries.find((e) => e.ordinance === "10.105(8)(a)");
    assert.equal(e.sourceStatus, "manual-only");
    assert.equal(e.status, "calculated");
    assert.deepEqual(
      e.tiers.map((t) => t.amountCents),
      [10000, 25000, 50000],
    );
    assert.equal(lookupForf([e.ordinance]).tiers.length, 3);
  });
  const baseCase = clone(kase("k1"));
  baseCase.owner = "SYNTHETIC R30 OWNER";
  baseCase.ownerAddr = ["101 TEST STREET", "MADISON WI 53703"];
  baseCase.number = "QA-R30";
  baseCase.date = "2026-01-01";
  WriterState.CASES = [baseCase];
  const reset = () => {
    WriterState.DOCS = [];
    WriterState.EVENTS = {};
    WriterState.REINSP = [];
  };
  const history = (ord, date, number, k = baseCase) => {
    const i = { id: "prior-" + number, no: "77", cite: true, sections: [ord] },
      d = {
        id: "history-" + number,
        type: "citation",
        caseId: k.id,
        mailed: date,
        inspDate: date,
        items: [i],
        frozen: { case: clone(k) },
        cits: { [i.id]: { ord, num: number, violDate: date } },
      };
    WriterState.DOCS.push(d);
    return d;
  };
  const draft = (ord, count = 1) => {
    newDoc(baseCase.id, "notice");
    const d = doc(WriterState.state.docId);
    d.items = Array.from({ length: count }, (_, n) => ({
      id: "r30-" + n,
      no: String(n + 1),
      cite: true,
      sections: [ord],
      title: "Actual R30 charge",
      text: "Repair.",
      due: addDays(recordDay(today), 21),
    }));
    initialCitations.prepare(d);
    for (const c of Object.values(d.cits)) c.violDate = "2026-09-24";
    citationPricing.refresh(d);
    return d;
  };
  check("F9 recovery and reinspection explicit multi-section charge", () => {
    reset();
    const n = draft("27.05(2)(c)");
    n.items[0].sections = ["27.05(2)(c)", "27.05(2)(cc)"];
    initialCitations.prepare(n);
    assert.equal(n.cits["r30-0"].ord, "");
    issueDocument(n);
    const c = citationFromNotice(n.id);
    assert.equal(Object.keys(c.cits).length, 0);
    assert.ok(Object.keys(c.depositRequests).length);
    WriterState.DOCS = WriterState.DOCS.filter((d) => !d.draft);
    startReinspection(baseCase.id);
    const r = reinsp(WriterState.state.reinspId),
      it = doc(n.id).items[0];
    r.time = "10:00";
    r.results[it.id] = { oc: "none", on: r.date, note: "Synthetic continuing violation.", due: addDays(recordDay(today), 21), cite: true };
    docFromReinspection(r, "citation");
    const follow = doc(WriterState.state.docId);
    assert.equal(follow.type, "citation");
    assert.equal(Object.keys(follow.cits).length, 0);
    assert.ok(Object.keys(follow.depositRequests).length);
    assert.ok(authoringChecks(follow).some((x) => !x.ok && /one complete ordinance/.test(x.t)));
    assert.ok(depositStep.complete(follow, follow.items[0].id, { ord: "27.05(2)(c)", depositMode: "schedule" }));
    assert.equal(Object.values(follow.cits)[0].amount, "197.00");
    issueDocument(follow);
    const original = JSON.stringify(doc(follow.id)),
      revision = startCorrection(follow.id);
    citationPricing.refresh(revision);
    assert.equal(Object.values(revision.cits)[0].amount, "197.00");
    assert.equal(JSON.stringify(doc(follow.id)), original);
  });
  check("F5 entry windows anchored to violation date", () => {
    reset();
    history("10.18(7)", "2025-08-24", "old-12");
    let d = draft("10.18(7)");
    assert.equal(d.cits["r30-0"].tier, "1st");
    reset();
    history("10.05(15)", "2025-08-24", "old-36");
    d = draft("10.05(15)");
    assert.equal(d.cits["r30-0"].tier, "2nd");
  });
  check("F6 two same-row items escalate sequentially", () => {
    reset();
    const d = draft("27.05(2)(c)", 2);
    assert.deepEqual(
      Object.values(d.cits).map((c) => c.base),
      [100, 200],
    );
    assert.equal(d.cits["r30-1"].countedOffenses[0].prepared, true);
  });
  check("F6 cross-case respondent and normalized mailing address", () => {
    reset();
    history("27.05(2)(c)", "2026-08-01", "cross-case", { ...baseCase, number: "QA-OTHER", ownerAddr: ["101 TEST ST", "MADISON WI 53703-1234"] });
    const d = draft("27.05(2)(c)");
    assert.equal(d.cits["r30-0"].tier, "2nd");
  });
  check("F7 void history reprices a prepared draft", () => {
    reset();
    const prior = history("27.05(2)(c)", "2026-08-01", "void-me"),
      d = draft("27.05(2)(c)");
    assert.equal(d.cits["r30-0"].base, 200);
    prior.void = true;
    initialCitations.prepare(d);
    assert.equal(d.cits["r30-0"].base, 100);
  });
  check("F8 fourth offense reached", () => {
    reset();
    for (let n = 0; n < 3; n++) history("10.18(5)(f)", "2026-08-01", "fourth-" + n);
    const d = draft("10.18(5)(f)");
    assert.equal(d.cits["r30-0"].tier, "4th");
    assert.equal(d.cits["r30-0"].amount, "1331.00");
  });
  check("F18 description follows actual library/item charge", () => {
    reset();
    const d = draft("27.05(2)(c)");
    assert.equal(d.cits["r30-0"].desc, "ACTUAL R30 CHARGE");
  });
  check("F10 different charge requires explicit source", () => {
    reset();
    const d = draft("27.05(2)(c)");
    editCitation(d, "r30-0", "ord", "27.05(2)(cc)");
    assert.ok(authoringChecks(initialCitations.preview(d)).some((x) => !x.ok && /current sections/.test(x.t)));
    editCitation(d, "r30-0", "differentChargeSource", "Synthetic reviewed different charge approval.");
    assert.ok(!authoringChecks(initialCitations.preview(d)).some((x) => !x.ok && /current sections/.test(x.t)));
  });
  check("Approved base replaces scheduled assessment evidence", () => {
    reset();
    const d = draft("27.05(2)(c)"),
      c = d.cits["r30-0"];
    assert.equal(c.assessments.base, 10000);
    editCitation(d, "r30-0", "depositMode", "base");
    assert.equal(c.amount, "197.00");
    editCitation(d, "r30-0", "base", "1500");
    editCitation(d, "r30-0", "depositSource", "Synthetic approved manual base instruction.");
    assert.equal(c.amount, "1966.00");
    assert.deepEqual(c.assessments, assessmentCents(150000, 4800));
    assert.match(citationDepositFault(c, initialCitations.preview(d), d.items[0]), /calculated deposit/);
    const face = document.createElement("div");
    face.innerHTML = citationFaces(initialCitations.preview(d), true);
    assert.equal(face.querySelectorAll(".cit-assessments").length, 4);
    for (const fees of face.querySelectorAll(".cit-assessments")) assert.ok(fees.textContent.includes("Jail $15.00"));
    editCitation(d, "r30-0", "cc", "38");
    assert.equal(c.assessments.court, 3800);
    editCitation(d, "r30-0", "depositMode", "total");
    assert.equal(c.assessments, undefined);
  });
  check("Library sweep grammar and explicit manual markers", () => {
    for (const c of LIBRARY)
      for (const g of c.groups)
        for (const i of g.items)
          for (const o of i.s) {
            assert.ok(canonicalOrdinance(o), o);
            const f = lookupForf([o], JSON.stringify([c.code, g.code, i.o]));
            assert.ok(f?.tiers?.length || i.citationManualSections[o], o);
          }
  });
  check("Court-cost transition and all four assessment copies", () => {
    reset();
    const d = draft("9.25(4)");
    const c = d.cits["r30-0"];
    c.tierOverride = 3;
    c.tierOverrideSource = "Synthetic court-approved offense tier.";
    citationPricing.refresh(d);
    assert.equal(c.amount, "3236.00");
    const el = document.createElement("div");
    el.innerHTML = citationFaces(initialCitations.preview(d), true);
    assert.equal(el.querySelectorAll(".cit .amt").length, 4);
    for (const amount of el.querySelectorAll(".cit .amt")) assert.equal(amount.textContent, "$3,236.00");
    for (const fees of el.querySelectorAll(".cit-assessments")) assert.ok(fees.textContent.includes("Jail $25.00"));
    assert.equal(courtCents("2026-07-29"), 3800);
    assert.equal(courtCents("2026-07-30"), 4800);
  });
  process.exit(failures ? 1 : 0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
