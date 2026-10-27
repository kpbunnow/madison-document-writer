const { withHistoricalBindings } = require("../fixtures/historical_module_scope.cjs");
/* Historical special formats retain ordered refusals, targets and affected-item mutation. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  fc = require("fast-check"),
  acorn = require("acorn");
(async () => {
  const dir = path.resolve("app/modules");
  let source = fs.readFileSync(path.join(dir, "new_documents.js"), "utf8");
  const tree = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }),
    factory = tree.body.find((n) => n.declaration?.id.name === "initNewDocuments").declaration,
    ret = factory.body.body.at(-1);
  const reference = require("../fixtures/special_checks_reference.cjs").replace("function specialChecks(", "function referenceSpecialChecks(");
  source = source.slice(0, ret.start) + reference + "\n" + source.slice(ret.start).replace("specialChecks,", "specialChecks,referenceSpecialChecks,");
  source += '\nexport {WriterState} from "./state.js";export {validISO} from "./calendar.js";';
  const built = await esbuild.build({
    stdin: { contents: withHistoricalBindings(source), resolveDir: dir },
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
  new Function("today", "module", "exports", built.outputFiles[0].text)(new Date("2026-10-27T12:00:00Z"), box, box.exports);
  const { initNewDocuments, WriterState: s, validISO } = box.exports;
  s.CASES = [{ id: "c", date: "2026-10-20", address: "100 TEST ST" }];
  s.DOCS = [];
  s.REINSP = [{ id: "r", caseId: "c", date: "2026-10-26", draft: false }];
  s.EVENTS = {};
  let calls = [];
  const services = {
    isLocked: (d) => {
      calls.push(["locked", d.id]);
      return false;
    },
    validISO: (v) => {
      calls.push(["date", v]);
      return validISO(v);
    },
    docBody: (d) => {
      calls.push(["body", d.id]);
      return "No placeholders";
    },
  };
  const api = initNewDocuments(services);
  let checked = 0;
  function outcome(fn, d) {
    try {
      return { value: fn(d) };
    } catch (error) {
      return { error: { name: error.name, message: error.message } };
    }
  }
  function compare(d) {
    const before = structuredClone(d),
      after = structuredClone(d);
    calls = [];
    const expected = outcome(api.referenceSpecialChecks, before),
      trace = JSON.stringify(calls);
    calls = [];
    assert.deepEqual(outcome(api.specialChecks, after), expected, JSON.stringify(d));
    assert.deepEqual(after, before, "affected-item mutations");
    assert.equal(JSON.stringify(calls), trace, "service-call precedence");
    checked++;
  }
  const types = ["notice", "summaryAbatement", "nonSummaryAbatement", "noOccupancy", "bestInterestExtension", "vacancyExtension"];
  const fields = [
    "scope",
    "unit",
    "variant",
    "findings",
    "work",
    "summaryBasis",
    "reviewer",
    "reviewRef",
    "codeSource",
    "codeRevision",
    "authority",
    "signerName",
    "signerTitle",
    "delegation",
    "reviewDateLegal",
    "reviewed",
    "effective",
    "mode",
    "releases",
    "releaseInspection",
    "releaseVisitId",
    "releaseInspectorId",
    "placardRemoved",
    "removalDate",
    "reason",
    "reviewDate",
    "noSafety",
    "safetyBasis",
    "stage",
    "expiryMode",
    "expiryDate",
    "deadlineMode",
    "postedDate",
    "posting",
    "boarding",
    "boardingRef",
  ];
  const values = [
    "",
    "unit",
    "building",
    "secure",
    "tree",
    "custom",
    "release",
    "restrict",
    "external",
    "r",
    "i4",
    "2026-10-26",
    "2027-01-01",
    "dated",
    "conditional",
    "posted",
    true,
    false,
    "Verified synthetic text",
    "◯",
  ];
  const item = fc.record({
    id: fc.constant("i"),
    no: fc.constant(1),
    done: fc.boolean(),
    withdrawn: fc.boolean(),
    due: fc.constantFrom("", "2026-10-01", "2026-11-15", "2026-11-16"),
    text: fc.constant("Repair"),
    sections: fc.constant(["27.05(2)(c)"]),
  });
  fc.assert(
    fc.property(
      fc.constantFrom(...types),
      fc.integer({ min: 11, max: 16 }),
      fc.array(item, { maxLength: 4 }),
      fc.array(fc.tuple(fc.constantFrom(...fields), fc.constantFrom(...values)), { maxLength: 15 }),
      (type, authoringVersion, items, changes) => {
        compare({
          id: "d",
          caseId: "c",
          type,
          authoringVersion,
          draft: true,
          mailed: "2026-10-27",
          items,
          special: { ...Object.fromEntries(changes), affected: ["1"], originalDues: { 1: "2026-10-01" } },
        });
      },
    ),
    { seed: 20261027, numRuns: 5000 },
  );
  console.log("PASS special-rule equivalence", checked, "historical cases, exact targets/mutations and effects");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
