const { withHistoricalBindings } = require("../fixtures/historical_module_scope.cjs");
/* Readiness results and effect order must equal the original owner across generated documents. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  fc = require("fast-check");
(async () => {
  const dir = path.resolve("app/modules"),
    source = fs.readFileSync(path.join(dir, "document_readiness.js"), "utf8");
  const reference = require("../fixtures/readiness_reference.cjs");
  const built = await esbuild.build({
    stdin: {
      contents:
        withHistoricalBindings(source) +
        "\nexport function reference(services){" +
        reference +
        ';return checks;}export {WriterState} from "./state.js";',
      resolveDir: dir,
    },
    bundle: true,
    format: "cjs",
    write: false,
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
  const { createDocumentReadiness, reference: legacy, WriterState: s } = box.exports;
  s.DOCS = [];
  s.REINSP = [];
  const kase = {
    id: "c",
    number: "BI-123",
    address: "100 TEST ST",
    owner: "SYNTHETIC OWNER",
    ownerAddr: ["100 TEST ST", "MADISON WI 53703"],
    parcel: "070912345678",
    date: "2026-10-20",
    time: "10:00",
  };
  s.CASES = [kase];
  let calls = [],
    flags = {};
  const track =
    (name, value) =>
    (...args) => {
      calls.push([name, ...args]);
      return value;
    };
  const services = {
    get today() {
      calls.push("today");
      return "2026-10-27";
    },
    get snow() {
      calls.push("snow-adapter");
      return { is: track("snow-is", flags.snow), checks: track("snow-checks", []) };
    },
    get initialCitations() {
      calls.push("initial-adapter");
      return { prepare: track("prepare", undefined), checks: track("initial-checks", []) };
    },
    get newDocuments() {
      calls.push("special-adapter");
      return { specialChecks: track("special-checks", []) };
    },
    unchangedCorrectionValue: (...a) => track("retained-due", flags.retained)(...a),
    unchangedCourtDate: (...a) => track("retained-court", flags.retained)(...a),
    citationDepositFault: (...a) => track("deposit", flags.fault ? "Deposit fault" : "")(...a),
    catalogDraftBlocked: (...a) => track("catalog", flags.fault)(...a),
    addressProblem: track("agent", ""),
    validateAndStandardizeAddresses: (...a) =>
      track("recipients", flags.fault ? { message: "Recipient fault", scope: "copy", index: 0, field: "city" } : null)(...a),
    authoringChecks: track("authoring", []),
    correctionChecks: track("correction", []),
    lifecycleChecks: track("lifecycle", []),
    attachCheckTargets: (d, row) => {
      calls.push(["target", row]);
      return row;
    },
  };
  const old = legacy(services),
    current = createDocumentReadiness(services).checks;
  let checked = 0;
  function compare(d) {
    calls = [];
    const expected = old(d),
      trace = JSON.stringify(calls);
    calls = [];
    assert.deepEqual(current(d), expected, JSON.stringify(d));
    assert.equal(JSON.stringify(calls), trace, "effect/getter order");
    checked++;
  }
  compare(null);
  compare({});
  const item = fc.record({
    id: fc.constant("i"),
    no: fc.constant(1),
    text: fc.constantFrom("Repair siding", "Repair [___]", ""),
    sections: fc.constantFrom([], ["27.05(2)(c)"]),
    due: fc.constantFrom("", "bad", "2026-10-01", "2026-10-28", "2026-11-20", "2027-12-01"),
    done: fc.boolean(),
    withdrawn: fc.boolean(),
    cite: fc.boolean(),
    doneOn: fc.constantFrom("", "2026-10-26", "2027-01-01"),
  });
  fc.assert(
    fc.property(
      fc.array(item, { maxLength: 4 }),
      fc.constantFrom("notice", "citation", "compliance", "referral", "extension", "vacancy", "bestInterest"),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      (items, type, snow, retained, fault) => {
        flags = { snow, retained, fault };
        const d = {
          id: "d",
          caseId: "c",
          type,
          draft: true,
          mailed: "2026-10-27",
          authoringVersion: 16,
          items,
          frozen: { inspector: { name: "Inspector" } },
          cits: { i: { num: "N", courtDate: "2026-12-02", amount: "125", desc: "Violation", ord: "27.05(2)(c)", deptId: "123" } },
        };
        if (retained) d.correction = { case: kase };
        if (fault) d.importRule = { kind: "initial", cite: snow, doc: "notice", status: "Official Notice" };
        compare(d);
      },
    ),
    { seed: 20261027, numRuns: 3000 },
  );
  console.log("PASS readiness-rule equivalence", checked, "cases, exact rows/targets and getter/effect order");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
