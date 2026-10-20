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
const fc = require("fast-check");
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  render = () => {};
  saveDrafts = async () => true;
  depositStep.openNext = () => {};
  WriterState.CASES = [
    {
      id: "k1",
      number: "QA-PROPERTY-001",
      address: "123 SYNTHETIC ST",
      owner: "SYNTHETIC OWNER",
      ownerAddr: ["123 SYNTHETIC ST", "MADISON WI 53703"],
      date: "2026-10-11",
      time: "09:00",
      inspectorId: "i4",
    },
  ];
  if (process.env.DW_MUTATION === "jail") {
    const original = assessmentCents;
    assessmentCents = (b, c) => {
      const v = original(b, c);
      v.jail = 1000;
      v.total = v.base + v.penalty + v.jail + v.crimeLab + v.court;
      return v;
    };
  }
  if (process.env.DW_MUTATION === "blank-reinspection") {
    const original = applyDeposit;
    applyDeposit = (d, id, o) => {
      const v = original(d, id, o);
      if (d.type === "citation" && d.cits[id]) d.cits[id].amount = "";
      return v;
    };
  }
  if (process.env.DW_MUTATION === "case-fold") {
    const original = canonicalOrdinance;
    canonicalOrdinance = (v) => (/\(CC\)/.test(String(v)) ? "" : original(v));
  }
  const seed = Number(process.env.DW_SEED || 31011026),
    runs = process.env.DW_DEEP === "1" ? 100000 : 500,
    corpus = { seed, runs, arithmetic: [], normalization: [], validation: [], resolutions: [] };
  const check = (name, arb, fn) => {
    for (const saved of JSON.parse(fs.readFileSync("tests/fixtures/deposit_golden.json")).generatedFailures || []) {
      if (saved.name === name) {
        const replay = fc.check(fc.property(arb, fn), { seed: saved.seed, path: saved.path, numRuns: runs });
        assert.ok(!replay.failed, "Permanent shrunk regression " + saved.path + " " + replay.errorInstance);
      }
    }
    const result = fc.check(fc.property(arb, fn), { seed, numRuns: runs, ...(process.env.DW_PATH ? { path: process.env.DW_PATH } : {}) });
    if (result.failed) {
      const g = JSON.parse(fs.readFileSync("tests/fixtures/deposit_golden.json"));
      (g.generatedFailures ??= []).push({ name, seed: result.seed, path: result.counterexamplePath, counterexample: result.counterexample });
      if (!process.env.DW_MUTATION) fs.writeFileSync("tests/fixtures/deposit_golden.json", JSON.stringify(g, null, 2) + "\n");
      throw Error(name + " seed=" + result.seed + " path=" + result.counterexamplePath + " " + result.errorInstance);
    }
    console.log("PASS " + name + " " + runs);
  };
  assert.equal(canonicalOrdinance("MGO 27.05 (2) (CC)"), canonicalOrdinance("27.05(2)(cc)"));
  console.log("Property seed " + seed + " runs " + runs);
  const moneyArb = fc.record({ base: fc.integer({ min: 1, max: 100000000 }), court: fc.integer({ min: 1500, max: 4800 }) });
  check("P1 parity and P2 independent arithmetic", moneyArb, ({ base, court }) => {
    const v = assessmentCents(base, court);
    assert.equal(v.penalty, Math.floor((base * 26 + 50) / 100));
    assert.equal(v.jail, Math.max(1000, Math.floor((base + 50) / 100)));
    assert.equal(v.total - v.base - v.penalty - v.jail - v.crimeLab - v.court, 0);
    corpus.arithmetic.push({ base, court, answer: v });
  });
  check("Dated boundary parity", fc.tuple(fc.integer({ min: 0, max: 36500 }), fc.integer({ min: 1, max: 1000000 })), ([offset, base]) => {
    const date = new Date(Date.UTC(1950, 0, 1 + offset)).toISOString().slice(0, 10),
      court = policyAt(date).fees.courtRates.at(-1).cents;
    corpus.arithmetic.push({ base, court, date, answer: assessmentCents(base, court, date) });
  });
  check("P3 monetary monotonicity", fc.tuple(moneyArb, fc.integer({ min: 1, max: 1000000 })), ([{ base, court }, delta]) =>
    assert.ok(assessmentCents(base + delta, court).total >= assessmentCents(base, court).total),
  );
  const sections = LIBRARY.flatMap((c) => c.groups.flatMap((g) => g.items.flatMap((i) => i.s))),
    ords = [...new Set(sections)];
  check(
    "P4 never blank creation and P7 render round trip",
    fc.tuple(fc.constantFrom(...ords), fc.integer({ min: 1, max: 20 }), fc.constantFrom("initial", "recovery", "reinspection")),
    ([ord, tier, pathName]) => {
      const result = resolveCitationAmount({ ordinance: ord, tier, date: "2026-10-11" });
      assert.ok(result.kind === "needs-basis" || cents(result.amount) > 0);
      corpus.resolutions.push({ ord, tier, date: "2026-10-11", kind: result.kind, amount: result.amount });
      const d = {
        id: "property-doc",
        caseId: "k1",
        type: pathName === "initial" ? "notice" : "citation",
        draft: true,
        mailed: "2026-10-11",
        items: [{ id: "pitem", no: "1", cite: true, sections: [ord] }],
        cits: { pitem: { ord, tier: tierLabel(tier), issued: "2026-10-11", depositMode: "schedule" } },
      };
      if (pathName === "initial") initialCitations.prepare(d);
      else applyDeposit(d, "pitem", ord);
      const c = d.cits.pitem;
      assert.ok(c ? cents(c.amount) > 0 : !!d.depositRequests.pitem);
      if (c) {
        assert.ok(c.depositSource);
        const before = JSON.stringify(c);
        const copy = JSON.parse(JSON.stringify(c));
        assert.equal(copy.amount, c.amount);
        d.authoringVersion = 7;
        assert.equal(citAmount(d, d.items[0]), formatDeposit(c.amount));
        assert.equal(JSON.stringify(c), before);
      }
    },
  );
  check("P5 formatting noise", fc.tuple(fc.constantFrom(...ords), fc.constantFrom("MGO ", "Sec. ", "§ "), fc.boolean()), ([ord, prefix, upper]) => {
    const noise = prefix + (upper ? ord.toUpperCase() : ord.toLowerCase()).replace(/\(/g, " ( ").replace(/\)/g, " ) ");
    assert.equal(canonicalOrdinance(noise), canonicalOrdinance(ord));
    const a = resolveCitationAmount({ ordinance: ord, date: "2026-10-11" }),
      b = resolveCitationAmount({ ordinance: noise, date: "2026-10-11" });
    assert.equal(a.kind, b.kind);
    assert.equal(a.amount, b.amount);
    corpus.normalization.push({ noise, answer: canonicalOrdinance(ord) });
  });
  check(
    "P6 method and ordinance edit sequences",
    fc.array(fc.constantFrom("base", "total", "schedule", "29.21", "27.05(2)(c)", "SPS321.125"), { minLength: 1, maxLength: 12 }),
    (ops) => {
      const d = {
        id: "edits",
        caseId: "k1",
        type: "citation",
        draft: true,
        mailed: "2026-10-11",
        items: [{ id: "i", cite: true, sections: ["27.05(2)(c)"] }],
        cits: {
          i: {
            ord: "27.05(2)(c)",
            issued: "2026-10-11",
            depositMode: "schedule",
            ...resolveCitationAmount({ ordinance: "27.05(2)(c)", date: "2026-10-11" }),
          },
        },
      };
      for (const op of ops) {
        editCitation(d, "i", op.includes(".") ? "ord" : "depositMode", op);
        assert.ok(cents(d.cits.i.amount) > 0);
        assert.ok(
          !citationDepositFault(d.cits.i, d, d.items[0]) || d.cits.i.reconfirmDeposit || String(d.cits.i.depositSource || "").trim().length < 10,
          JSON.stringify({ c: d.cits.i, fault: citationDepositFault(d.cits.i, d, d.items[0]) }),
        );
      }
    },
  );
  check(
    "P8 mutated validation agreement",
    fc.tuple(moneyArb, fc.constantFrom("valid", "tier", "base", "amount", "source", "ord")),
    ([{ base, court }, mutation]) => {
      const v = assessmentCents(base, court),
        c = {
          ord: "27.05(2)(c)",
          issued: "2026-08-01",
          depositMode: "base",
          depositSource: "Synthetic approved arithmetic test basis.",
          tier: "1st",
          base: (base / 100).toFixed(2),
          cc: (court / 100).toFixed(2),
          amount: (v.total / 100).toFixed(2),
        };
      if (mutation === "tier") Object.assign(c, { depositMode: "schedule", tier: "2nd", base: "100", cc: "48", amount: "197" });
      if (mutation === "base") c.base = ((base + 1) / 100).toFixed(2);
      if (mutation === "amount") c.amount = "";
      if (mutation === "source") c.depositSource = "";
      if (mutation === "ord") c.ord = "27.05(2)(c), 29.21";
      const verdict = !citationDepositFault(c);
      corpus.validation.push({ c, verdict });
      assert.equal(verdict, mutation === "valid");
    },
  );
  for (const e of CITATION_POLICY.entries.filter((e) => e.status === "verified" && !e.stale))
    for (let t = 1; t < e.tiers.length; t++) assert.ok(e.tiers[t].amountCents >= e.tiers[t - 1].amountCents);
  // Permanent shrunk seeds replay before the next gate, independently of random seed.
  for (const failure of JSON.parse(fs.readFileSync("tests/fixtures/deposit_golden.json")).generatedFailures || [])
    assert.ok(failure.seed && typeof failure.path === "string");
  fs.mkdirSync("build/test-results", { recursive: true });
  fs.writeFileSync("build/test-results/property-corpus.json", JSON.stringify(corpus));
  console.log("PASS generated browser corpus");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
