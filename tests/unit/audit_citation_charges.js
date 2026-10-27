const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Independent court calendar/numbering and charge/deposit edit boundaries. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, f));
  f(n);
  Object.values(n).forEach((c) => walk(c, f));
}
const defs = {
  courtScheduling: ["court_scheduling", "createCourtScheduling", ["today", "nowMillis", "random"]],
  citationCharges: ["citation_charges", "createCitationCharges", ["citationPricing", "citationPricingDate", "document"]],
};
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
let previous = entries.findIndex((n) => n.id.name === "documentDelivery");
for (const [name, [file, ctor, fields]] of Object.entries(defs)) {
  const used = new Set();
  walk(parse(file), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") {
      assert.equal(n.computed, false);
      used.add(n.property.name);
    }
  });
  assert.deepEqual([...used].sort(), fields.slice().sort());
  const e = entries.find((n) => n.id.name === name);
  assert.equal(e.init.callee.name, ctor);
  assert.deepEqual(new Set(serviceComposition(e.init.arguments[0]).properties.map((p) => p.key.name)), used);
  assert.ok(entries.indexOf(e) > previous);
  assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "documentRenderer"));
  previous = entries.indexOf(e);
  for (const p of serviceComposition(e.init.arguments[0]).properties) {
    if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
    else if (name === "courtScheduling") {
      assert.equal(p.value.type, "ArrowFunctionExpression");
      assert.equal(p.value.body.callee.object.name, p.key.name === "nowMillis" ? "Date" : "Math");
      assert.equal(p.value.body.callee.property.name, p.key.name === "nowMillis" ? "now" : "random");
    } else {
      assert.equal(p.value.body.callee.name, p.key.name);
    }
  }
}
const copy = (v) => JSON.parse(JSON.stringify(v));
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createCourtScheduling} from './court_scheduling.js'; export * from './citation_charges.js'; export {WriterState} from './state.js'; export {CITEPOCH} from './document_types.js';",
      resolveDir: dir,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const {
    createCourtScheduling,
    createCitationCharges,
    chargeChoices,
    choosesCharge,
    feeLines,
    lookupForf,
    CHARGE_DERIVED,
    WriterState: s,
    CITEPOCH,
  } = box.exports;
  assert.deepEqual(s, {});
  for (const c of [createCourtScheduling, createCitationCharges]) c(new Proxy({}, { get: (_, k) => assert.fail("premature " + String(k)) }));
  assert.deepEqual(s, {});
  let day = "2026-09-30",
    now = CITEPOCH + 123456000,
    random = 0.37,
    clockCalls = 0,
    randomCalls = 0;
  const calendar = createCourtScheduling({
    get today() {
      return day;
    },
    nowMillis() {
      clockCalls++;
      return now;
    },
    random() {
      randomCalls++;
      return random;
    },
  });
  assert.equal(calendar.nextCourtDate("2026-09-30"), "2026-11-18");
  assert.equal(calendar.nextCourtDate("2024-05-08"), "2024-06-26");
  assert.equal(calendar.nextCourtDate("2024-11-13"), "2025-01-08");
  assert.equal(calendar.nextCourtDate(), "2026-11-18");
  day = "2026-10-08";
  assert.equal(calendar.nextCourtDate(), "2026-11-25");
  assert.equal(clockCalls, 0);
  assert.equal(randomCalls, 0);
  s.DOCS = [
    { draft: true, cits: { a: { num: "B00012345637" } } },
    { void: true, cits: { b: { num: "B00012345638" } } },
  ];
  assert.equal(calendar.citationNumber(), "B00012345639");
  assert.equal(clockCalls, 1);
  assert.equal(randomCalls, 1);
  s.DOCS = [];
  assert.equal(calendar.citationNumber(), "B00012345637");
  now += 1000;
  random = 0;
  assert.equal(calendar.citationNumber(), "B00012345700");
  assert.equal(clockCalls, 3);
  assert.deepEqual(chargeChoices({ sections: [" 27.05(2)(c) ", "27.05(2)(c)", ""] }), [{ value: "27.05(2)(c)", label: "27.05(2)(c)" }]);
  assert.equal(choosesCharge({ sections: ["27.05(2)(c)", "27.05(2)(c)"] }), true);
  assert.equal(choosesCharge({ sections: ["27.05(2)(c)"] }), false);
  assert.equal(feeLines(100, 48, "2026-10-26").total, 197);
  assert.equal(feeLines("0.25", 48, "2026-10-26").total, 71.32);
  assert.equal(lookupForf(["29.22", "27.05(2)(c)"]), null);
  assert.ok(lookupForf(["29.22"]).tiers.length);
  assert.equal(lookupForf(["99.99"]), null);
  const dom = new JSDOM('<span data-cit="item|amount">old DOM amount</span>');
  let calls = [],
    mode = "observe",
    pricing = {
      refresh(d) {
        calls.push(copy(d));
        if (mode === "price") for (const c of Object.values(d.cits || {})) c.amount = "197.00";
      },
    },
    d;
  const edits = createCitationCharges({
    get citationPricing() {
      return pricing;
    },
    citationPricingDate: () => "2026-10-26",
    get document() {
      return dom.window.document;
    },
  });
  function reset(multiple = true) {
    calls = [];
    mode = "observe";
    d = {
      id: "draft",
      caseId: "one",
      type: "citation",
      draft: true,
      authoringVersion: 9,
      items: [{ id: "item", sections: multiple ? ["27.05(2)(c)", "29.22"] : ["27.05(2)(c)"] }],
      cits: {
        item: {
          ord: "27.05(2)(c)",
          base: "100.00",
          amount: "197.00",
          cc: "48.00",
          tier: "2",
          measurements: { area: 10 },
          overrideBasis: { totalCents: 19700 },
          depositApproved: true,
          depositMode: "total",
          depositSource: "old source",
          tierOverrideSource: "old authority",
          num: "KEEP",
          courtDate: "2026-12-01",
        },
      },
    };
    s.DOCS = [d];
  }
  reset();
  assert.equal(edits.changeCharge(d, "missing", "29.22"), false);
  const before = copy(d);
  assert.equal(edits.changeCharge(d, "item", " 27.05(2)(c) "), false);
  assert.deepEqual(d, before);
  assert.equal(calls.length, 0);
  assert.equal(edits.changeCharge(d, "item", "29.22"), true);
  const changed = d.cits.item;
  for (const field of CHARGE_DERIVED) assert.equal(Object.hasOwn(changed, field), false, field);
  assert.equal(changed.depositMode, "schedule");
  assert.equal(changed.autoFilledCharge, false);
  assert.equal(changed.num, "KEEP");
  assert.equal(changed.courtDate, "2026-12-01");
  assert.equal(d.authoringVersion, 11);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cits.item.ord, "29.22");
  reset(false);
  edits.changeCharge(d, "item", "29.22");
  assert.equal(d.cits.item.base, "100.00");
  assert.equal(d.cits.item.amount, "197.00");
  assert.equal("measurements" in d.cits.item, false);
  assert.equal("overrideBasis" in d.cits.item, false);
  assert.equal("depositApproved" in d.cits.item, false);
  assert.equal(d.cits.item.depositSource, "old source");
  reset();
  mode = "price";
  assert.equal(edits.applyDeposit(d, "item", "29.22"), "197.00");
  assert.equal(dom.window.document.querySelector('[data-cit="item|amount"]').textContent, "197.00");
  assert.equal(d.cits.item.depositMode, "schedule");
  assert.equal(d.cits.item.depositApproved, undefined);
  assert.equal(d.cits.item.tierOverrideSource, undefined);
  assert.equal(edits.applyDeposit(d, "missing", "29.22"), undefined);
  let replaced = false;
  pricing = {
    refresh() {
      replaced = true;
    },
  };
  edits.applyDeposit(d, "item", "29.22");
  assert.equal(replaced, true);
  reset();
  const retained = {
    ord: "27.05(2)(c)",
    amount: "150.00",
    base: "100.00",
    depositMode: "total",
    tier: "2nd",
    measurements: { area: 12 },
    overrideBasis: { totalCents: 15000 },
    depositSource: "Retained source",
    num: "KEEP",
  };
  const original = { id: "issued", caseId: "one", type: "citation", cits: { item: copy(retained) } };
  d.correction = { targetId: original.id };
  d.cits.item.ord = "29.22";
  d.cits.item.assessments = { total: 999 };
  s.DOCS = [d, original];
  edits.changeCharge(d, "item", "27.05(2)(c)");
  for (const field of [...CHARGE_DERIVED, "depositMode", "tier"]) assert.deepEqual(d.cits.item[field], retained[field], field);
  assert.notEqual(d.cits.item.measurements, original.cits.item.measurements);
  assert.equal(d.authoringVersion, 9);
  assert.equal(d.cits.item.num, "KEEP");
  reset();
  d.depositRequests = { item: d.cits.item };
  d.cits = {};
  edits.changeCharge(d, "item", "99.99");
  assert.ok(typeof d.depositRequests.item.reason === "string" && d.depositRequests.item.reason.length);
  assert.ok(Array.isArray(d.depositRequests.item.measurementFields));
  assert.equal(d.authoringVersion, 9);
  dom.window.close();
  console.log(
    JSON.stringify({
      passed: true,
      schedulingInputs: 3,
      chargeInputs: 3,
      inertConstruction: true,
      holidayAndLiveClock: true,
      numberCollisionScan: true,
      chargeBasisClearing: true,
      retainedCorrectionBasis: true,
      currencySemantics: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
