/* Citation numbers that differ only in letter case are one printed citation (code review 2026-11-27): the Writer's
   publication and initial-citation checks refuse a new citation whose number matches an issued one in any case, or a
   repeated number on the same citation. The retained module accepted them, and only the exact spelling was refused. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");

async function compile(contents) {
  const build = await esbuild.build({
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
  new Function("module", "exports", build.outputFiles[0].text)(box, box.exports);
  return box.exports;
}

// Any service the checks ask for answers with an inert value; these name the ones the citation path reads.
function services(source) {
  const answers = { sourceDocFor: () => source, worksheetFaults: () => [], "snow.is": () => false, today: new Date("2026-10-26T12:00:00Z") };
  const make = (trail) =>
    new Proxy(function () {}, {
      get(_, key) {
        const name = trail.concat(String(key)).join(".");
        return name === "today" ? answers.today : make(trail.concat(String(key)));
      },
      apply(_, __, args) {
        const result = answers[trail.join(".")];
        return typeof result === "function" ? result(...args) : result;
      },
    });
  return make([]);
}

function citationFault(api, draftNumbers, issuedNumber) {
  const source = {
    id: "src",
    caseId: "case",
    draft: false,
    type: "notice",
    items: draftNumbers.map((_, n) => ({ id: "i" + n, no: String(n + 1) })),
    cits: issuedNumber ? { i0: { num: issuedNumber } } : {},
    inspDate: "2026-10-20",
  };
  const draft = {
    id: "draft",
    caseId: "case",
    draft: true,
    type: "citation",
    items: draftNumbers.map((_, n) => ({ id: "i" + n, no: String(n + 1), cite: true })),
    cits: Object.fromEntries(draftNumbers.map((num, n) => ["i" + n, { num, issued: "2026-10-21" }])),
    fromDocId: "src",
    fromReinspId: "",
    inspDate: "2026-10-20",
    inspTime: "09:00",
    mailed: "2026-10-21",
  };
  Object.assign(api.WriterState, {
    CASES: [{ id: "case", date: "2026-10-20", time: "09:00" }],
    DOCS: [source, draft],
    REINSP: [],
    EVENTS: { case: [{ id: "a", type: "notice.issued" }] },
  });
  const checks = api.createPublicationPreparation(services(source)).lifecycleChecks(draft) || [];
  return checks.some((c) => /unique citation number/.test(c.t));
}

(async () => {
  const [current, retained] = await Promise.all([
    compile(fs.readFileSync("app/modules/publication_preparation.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/publication_preparation_reference.txt", "utf8")),
  ]);
  for (const api of [current, retained]) {
    assert.equal(citationFault(api, ["B2000000002"], "B2000000001"), false, "a different number is accepted");
    assert.equal(citationFault(api, ["B2000000001"], "B2000000001"), true, "the same spelling is refused");
  }
  assert.equal(citationFault(current, ["b2000000001"], "B2000000001"), true, "an issued number in another case of letters is refused");
  assert.equal(citationFault(current, ["B7", "b7"], ""), true, "a repeated number on one citation is refused in any case");
  assert.equal(citationFault(retained, ["b2000000001"], "B2000000001"), false, "the retained module accepted it");
  const { citationNumberKey } = await compile('export {citationNumberKey} from "./record_values.js";');
  assert.equal(citationNumberKey("b20-x"), "B20-X");
  assert.equal(citationNumberKey(undefined), "");
  console.log("PASS citation numbers that differ only in letter case are refused as one printed citation");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
