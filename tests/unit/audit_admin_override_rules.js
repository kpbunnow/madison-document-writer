/* Exact administrative authorization refusals, case precedence and lazy field reads. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/administration.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "initAdministration").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "overrideFault"),
    reference = fs.readFileSync("tests/fixtures/admin_override_reference.txt", "utf8");
  async function compile(contents) {
    const built = await esbuild.build({
      stdin: { contents: contents + '\nexport {WriterState} from "./state.js";', resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
      plugins: [
        {
          name: "data",
          setup(b) {
            b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
          },
        },
      ],
    });
    const box = { exports: {} },
      listeners = [];
    new Function("document", "module", "exports", built.outputFiles[0].text)(
      { addEventListener: (...args) => listeners.push(args) },
      box,
      box.exports,
    );
    const owner = box.exports.initAdministration(
      new Proxy(
        {},
        {
          get() {
            throw Error("eager service read");
          },
        },
      ),
    );
    assert.equal(listeners.length, 1);
    assert.equal(listeners[0][0], "click");
    return { ...box.exports, ...owner };
  }
  const [current, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  let seed = 20261102,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (values) => values[random(values.length)];
  function fixture() {
    return {
      k: { id: "case", number: "QA-001" },
      d: { id: "doc", caseId: "case", authoringVersion: 16 },
      c: {
        num: "CIT-001",
        ord: "27.05(2)(c)",
        pricedOn: "2026-10-24",
        issued: "2026-10-24",
        depositMode: "base",
        amount: "197.00",
        base: "100.00",
        cc: "38.00",
        policyVersionHash: "policy",
        tier: 1,
        computedTier: 1,
        scheduleEntryId: "row",
        measurements: { area: 100 },
        overrideBasis: {
          version: 1,
          confirmed: true,
          administrator: "Test administrator",
          reason: "A sufficiently detailed reason for the exception.",
          sourceReference: "QA reference",
          authorizationId: "a".repeat(32),
          authorizationHash: "b".repeat(64),
          caseNumber: "QA-001",
          citationNumber: "CIT-001",
          ordinance: "27.05(2)(c)",
          pricingDate: "2026-10-24",
          mode: "base",
          totalCents: 19700,
          baseCents: 10000,
          courtCents: 3800,
          policyVersionHash: "policy",
          approvedTier: 1,
          scheduleEntryId: "row",
          measurements: { area: 100 },
        },
      },
    };
  }
  function run(api, input, failAt) {
    const data = structuredClone(input),
      reads = [],
      cache = new WeakMap();
    function proxy(value, at) {
      if (!value || typeof value !== "object") return value;
      if (cache.has(value)) return cache.get(value);
      const p = new Proxy(value, {
        get(target, key, receiver) {
          if (typeof key === "string") {
            reads.push(at + "." + key);
            if (reads.length === failAt) throw Error("interrupted field read");
          }
          return proxy(Reflect.get(target, key, receiver), at + "." + String(key));
        },
      });
      cache.set(value, p);
      return p;
    }
    api.WriterState.CASES = [proxy(data.k, "case")];
    let value, error;
    try {
      value = api.overrideFault(proxy(data.c, "citation"), proxy(data.d, "document"));
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, reads, data };
  }
  function compare(input, failAt) {
    assert.deepEqual(run(current, input, failAt), run(legacy, input, failAt), "scenario " + checked++);
  }
  assert.equal(run(current, fixture()).value, "");
  compare(fixture());
  const changes = [
    (b) => (b.version = 2),
    (b) => (b.confirmed = false),
    (b) => (b.administrator = " "),
    (b) => (b.reason = "short"),
    (b) => (b.sourceReference = ""),
    (b) => (b.authorizationId = "bad"),
    (b) => (b.authorizationHash = "bad"),
    (b) => (b.caseNumber = "other"),
    (b) => (b.citationNumber = "other"),
    (b) => (b.ordinance = "27.01"),
    (b) => (b.pricingDate = "2026-10-23"),
    (b) => (b.mode = "total"),
    (b) => (b.totalCents = 1),
    (b) => (b.baseCents = 1),
    (b) => (b.courtCents = 1),
    (b) => (b.policyVersionHash = "other"),
    (b) => (b.approvedTier = 2),
    (b) => (b.scheduleEntryId = "other"),
    (b) => (b.measurements = { area: 101 }),
  ];
  for (const change of changes) {
    const input = fixture();
    change(input.c.overrideBasis);
    compare(input);
  }
  for (let n = 0; n < 3000; n++) {
    const input = fixture();
    for (let j = 0, size = random(4); j < size; j++) pick(changes)(input.c.overrideBasis);
    if (random(10) === 0) input.c.overrideBasis = pick([undefined, null, false, {}, "legacy"]);
    if (random(4) === 0) input.d.frozen = { case: { ...input.k, number: pick(["QA-001", "frozen"]) } };
    if (random(4) === 0) input.d.correction = { case: { ...input.k, number: pick(["QA-001", "corrected"]) } };
    if (random(4) === 0) input.c.computedTier = pick([undefined, 0, 2, "1"]);
    compare(input);
    if (n < 100) for (const failAt of [1, 5, 15, 30, 50]) compare(input, failAt);
  }
  console.log("PASS administrator override equivalence " + checked + " scenarios: refusal precedence, case source, input reads and exceptions");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
