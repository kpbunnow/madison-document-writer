const { withHistoricalState } = require("../fixtures/historical_module_scope.cjs");
/* Differential refusal precedence over generated policy cases and malformed field combinations. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  fc = require("fast-check");
(async () => {
  const dir = path.resolve("app/modules");
  const source = fs.readFileSync(path.join(dir, "citation_workflow.js"), "utf8");
  const reference = require("../fixtures/deposit_fault_reference.cjs");
  const built = await esbuild.build({
    stdin: {
      contents:
        withHistoricalState(source) +
        "\nexport function reference(services){" +
        reference +
        '; return citationDepositFault;} export {WriterState} from "./state.js"; export {CITATION_POLICY} from "./citation_policy.js";',
      resolveDir: dir,
    },
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
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createCitationWorkflow, reference: legacy, WriterState: s, CITATION_POLICY: policy } = box.exports;
  s.CASES = [{ id: "c", owner: "SYNTHETIC OWNER", ownerAddr: ["100 TEST ST", "MADISON WI 53703"] }];
  const item = { id: "i", sections: ["27.05(2)(c)"], cite: true };
  const doc = { caseId: "c", items: [item], authoringVersion: 16, type: "citation" };
  let original = null,
    override = "",
    calls = [];
  const services = {
    citationPricing: {
      unchangedCorrection: () => {
        calls.push("correction");
        return original;
      },
    },
    administration: {
      overrideFault: () => {
        calls.push("override");
        return override;
      },
    },
    feeLines: () => {
      calls.push("fees");
      return { total: 125 };
    },
  };
  const actual = createCitationWorkflow(services).citationDepositFault,
    expected = legacy(services);
  let checked = 0;
  function compare(c, d = doc, i = item) {
    calls = [];
    const old = expected(c, d, i),
      trace = calls.slice();
    calls = [];
    assert.equal(actual(c, d, i), old, JSON.stringify(c));
    assert.deepEqual(calls, trace, "service call order");
    checked++;
  }
  const base = {
    ord: "27.05(2)(c)",
    amount: "125.00",
    base: "50",
    cc: "33",
    depositMode: "total",
    depositSource: "Approved synthetic authority",
    pricedOn: "2026-10-26",
    issued: "2026-10-26",
    overrideBasis: { approved: true },
  };
  compare(base);
  for (const entry of policy.entries)
    for (const version of [6, 7, 8, 9, 16])
      for (const mode of ["schedule", "base", "total"]) {
        compare(
          { ...base, ord: entry.ordinance || base.ord, scheduleEntryId: entry.id, depositMode: mode, overrideBasis: null },
          { ...doc, authoringVersion: version },
        );
      }
  const values = [
    undefined,
    null,
    "",
    false,
    true,
    "0",
    "1",
    "-1",
    "12.345",
    "bad",
    "2026-10-26",
    "2026-99-99",
    "source too short",
    "Approved synthetic authority",
  ];
  const fields = [
    "amount",
    "base",
    "cc",
    "ord",
    "issued",
    "pricedOn",
    "depositMode",
    "depositSource",
    "tierOverrideSource",
    "tierOverride",
    "computedTier",
    "tier",
    "mandatoryAppearance",
    "depositEditInvalid",
    "reconfirmDeposit",
    "assessments",
  ];
  fc.assert(
    fc.property(
      fc.array(fc.tuple(fc.constantFrom(...fields), fc.constantFrom(...values)), { maxLength: 8 }),
      fc.integer({ min: 6, max: 16 }),
      fc.boolean(),
      fc.boolean(),
      (changes, version, retained, fault) => {
        const c = { ...base, ...Object.fromEntries(changes) };
        original = retained ? { ...base } : null;
        override = fault ? "Approval mismatch" : "";
        compare(c, { ...doc, authoringVersion: version });
      },
    ),
    { seed: 20261027, numRuns: 3000 },
  );
  original = null;
  override = "";
  for (const key of fields) for (const value of values) compare({ ...base, [key]: value }, null, null);
  console.log("PASS ordered deposit-rule equivalence", checked, "cases, exact refusals and service order");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
