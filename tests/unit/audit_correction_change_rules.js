/* Retain correction field ordering and historical extension cutoffs against the old owner. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/correction_preparation.js", "utf8"),
    factory = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "createCorrectionPreparation").declaration,
    fn = factory.body.body.find((n) => n.id?.name === "correctionChanges");
  async function compile(contents) {
    const b = await esbuild.build({
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
    const box = { exports: {} };
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([
    compile(source),
    compile(source.slice(0, fn.start) + fs.readFileSync("tests/fixtures/correction_changes_reference.txt", "utf8") + source.slice(fn.end)),
  ]);
  let seed = 20261109,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return Math.floor((seed / 4294967296) * n);
    },
    pick = (a) => a[random(a.length)];
  function run(api, input) {
    const x = structuredClone(input),
      reads = [];
    function observed(v, label) {
      if (!v) return v;
      return new Proxy(v, {
        get(o, k) {
          if (typeof k !== "symbol") reads.push(label + "." + k);
          return o[k];
        },
      });
    }
    x.old.special = observed(x.old.special, "old.special");
    x.d.special = observed(x.d.special, "new.special");
    const old = observed(x.old, "old"),
      d = observed(x.d, "new");
    Object.assign(api.WriterState, {
      DOCS: x.source ? [old] : [],
      CASES: [{ id: "case", number: "BLD2026-00001", owner: "Original" }],
      REINSP: [{ id: "visit", results: { source: { oc: "none", carried: x.carried } } }],
    });
    const owner = api.createCorrectionPreparation(
      new Proxy(
        {},
        {
          get(_, k) {
            assert.fail("unexpected service " + k);
          },
        },
      ),
    );
    let changes, error;
    try {
      changes = owner.correctionChanges(d);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { changes, error, reads };
  }
  function fixture(type, version) {
    const item = {
      id: "item",
      no: "1",
      srcItemId: "source",
      text: "Retained",
      title: "Item",
      sections: ["27.05(2)(c)"],
      due: "2026-11-01",
      done: false,
    };
    const old = {
      id: "old",
      caseId: "case",
      type,
      authoringVersion: version,
      mailed: "2026-10-20",
      inspDate: "2026-10-19",
      inspectorId: "i4",
      fromReinspId: "visit",
      items: [item],
      cits: { item: { base: "100", amount: "197", cc: "38" } },
      special: { reason: "Retained reason", noSafety: true, scope: "unit", unit: "1", reviewDate: "2026-11-02" },
    };
    const d = structuredClone(old);
    d.id = "draft";
    d.correction = { targetId: "old", actionDate: "2026-10-20", outcomes: {}, case: { id: "case", number: "BLD2026-00001", owner: "Original" } };
    return { old, d, source: true, carried: false };
  }
  function compare(x) {
    assert.deepEqual(run(current, x), run(legacy, x), "scenario " + checked++);
  }
  for (const type of ["notice", "extension", "bestInterestExtension", "vacancyExtension"])
    for (const version of [9, 12, 14, 15, 16, 17])
      for (const field of ["reason", "noSafety", "scope", "unit", "reviewDate"]) {
        const x = fixture(type, version);
        x.d.special[field] = field === "noSafety" ? false : "Changed <&>";
        compare(x);
      }
  for (let n = 0; n < 4000; n++) {
    const x = fixture(pick(["notice", "bestInterestExtension", "vacancyExtension"]), pick([9, 12, 14, 15, 16, 17]));
    x.source = !!random(8);
    x.carried = !!random(2);
    if (random(2)) x.d.special = pick([undefined, {}, { reason: "Changed", noSafety: false, scope: "building", unit: "", reviewDate: "2026-11-03" }]);
    if (random(2)) x.old.special = pick([undefined, {}, x.old.special]);
    if (random(2)) x.old.revision = { actionDate: pick(["2026-10-18", ""]), originalIssued: "2026-10-19" };
    if (random(2)) x.d.correction.case.owner = "Changed";
    if (random(2)) x.d.items[0].text = "Changed text";
    if (random(2)) x.d.items[0].id = "new";
    if (random(2)) x.d.cits.item = { amount: "250", extra: "basis" };
    if (random(2)) x.d.correction.outcomes = { item: "corrected" };
    compare(x);
  }
  console.log("PASS correction change equivalence " + checked + " scenarios: historical cutoffs, field order, citation/visit changes and lazy reads");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
