/* Preserve lineage termination, observed visits and citation annotation precedence. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/inspection_history.js", "utf8"),
    fn = acorn
      .parse(source, { ecmaVersion: 2022, sourceType: "module" })
      .body.find((n) => n.declaration?.id?.name === "itemInspectionHistory").declaration,
    reference = fs.readFileSync("tests/fixtures/inspection_history_reference.txt", "utf8");
  async function compile(contents) {
    const built = await esbuild.build({
      stdin: { contents: contents + '\nexport {WriterState} from "./state.js";', resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
      plugins: [
        {
          name: "data",
          setup(build) {
            build.onResolve({ filter: /\/data\// }, (args) => ({ path: path.resolve("build/generated/modules/data", path.basename(args.path)) }));
          },
        },
      ],
    });
    const box = { exports: {} };
    new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, legacy] = await Promise.all([compile(source), compile(source.slice(0, fn.start) + reference + source.slice(fn.end))]);
  let seed = 20261030,
    checked = 0;
  const random = (n) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    },
    pick = (a) => a[random(a.length)];
  function run(api, input) {
    const state = structuredClone(input);
    Object.assign(api.WriterState, state);
    const d = state.DOCS[state.focus],
      it = d.items[0];
    let result, error;
    try {
      result = api.itemInspectionHistory(d, it);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { result, error, state };
  }
  function compare(input) {
    assert.deepEqual(run(current, input), run(legacy, input), "scenario " + checked);
    checked++;
  }
  const days = ["", "2026-01-01", "2026-04-12", "2026-10-28"];
  for (let n = 0; n < 4000; n++) {
    const docs = [],
      visits = [];
    for (let j = 0, size = 1 + random(7); j < size; j++) {
      const d = {
        id: "doc" + j,
        caseId: "case",
        type: pick(["notice", "citation", "extension", "referral"]),
        inspDate: pick(days),
        mailed: pick(days),
        items: [{ id: "item" + j, no: 1, cite: !!random(2), withdrawn: random(6) === 0 }],
        cits: {},
      };
      d.cits["item" + j] = { num: pick(["", "CIT-" + j]) };
      if (j && random(4)) {
        d.fromDocId = "doc" + (j - 1);
        d.items[0].srcItemId = pick(["item" + (j - 1), "missing", undefined]);
      }
      if (random(5) === 0) d.fromReinspId = "visit" + random(7);
      if (random(10) === 0) d.fromDocId = "doc" + random(7); // cycles and dangling sources
      for (const flag of ["draft", "void", "superseded"]) if (random(8) === 0) d[flag] = true;
      docs.push(d);
    }
    for (let j = 0, size = random(8); j < size; j++) {
      const source = random(docs.length),
        id = "item" + source;
      visits.push({
        id: "visit" + j,
        caseId: pick(["case", "case", "other"]),
        sourceDocId: "doc" + source,
        draft: random(4) === 0,
        date: pick(days),
        results:
          random(8) === 0
            ? undefined
            : {
                [id]: {
                  oc: pick(["", "corrected", "none", "withdrawn", "progress"]),
                  on: pick(days),
                  manualDate: !!random(2),
                  carried: random(6) === 0,
                  note: pick(["", " observed ", null]),
                },
              },
      });
    }
    compare({ DOCS: docs, REINSP: visits, CASES: [{ id: "case", date: "2026-01-01" }], focus: docs.length - 1 });
  }
  console.log("PASS inspection history equivalence " + checked + " scenarios: lineage, cycles, visit dates, citations and mutation");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
