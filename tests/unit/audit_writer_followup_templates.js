/* Exact action-screen and service-evidence presentation, through real state/query owners. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/new_documents.js", "utf8"),
    reference = fs.readFileSync("tests/fixtures/writer_followup_templates_reference.txt", "utf8"),
    parse = (s) => acorn.parse(s, { ecmaVersion: 2022, sourceType: "module" }),
    functions = parse(source).body.find((n) => n.declaration?.id?.name === "initNewDocuments").declaration.body.body,
    originals = parse(reference).body;
  let old = source;
  for (const n of functions.filter((n) => originals.some((o) => o.id?.name === n.id?.name)).sort((a, b) => b.start - a.start)) {
    const o = originals.find((o) => o.id.name === n.id.name);
    old = old.slice(0, n.start) + reference.slice(o.start, o.end) + old.slice(n.end);
  }
  async function load(contents) {
    const b = await esbuild.build({
        stdin: {
          contents: contents + '\nexport {WriterState} from "./state.js";export {sourceDocFor} from "./writer_queries.js";',
          resolveDir: path.resolve("app/modules"),
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
      }),
      box = { exports: {} };
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, original] = await Promise.all([load(source), load(old)]);
  function run(api, input) {
    const x = structuredClone(input),
      calls = [];
    let steps = 0;
    const source = { id: "source", caseId: "case", type: "notice", draft: false, items: [{ id: "a", no: "1", due: "2026-11-01" }] };
    const r = {
      id: "visit",
      caseId: "case",
      sourceDocId: x.missing ? "missing" : "source",
      draft: x.draft,
      date: "2026-10-29",
      followupIntent: x.picked,
      actionGroup: x.group,
      results: { a: { oc: x.corrected ? "corrected" : "none", cite: x.cite } },
    };
    if (x.rule) r.importRule = x.rule;
    Object.assign(api.WriterState, {
      CASES: [{ id: "case" }],
      DOCS: [
        source,
        ...(x.referred ? [{ id: "referral", caseId: "case", type: "referral", items: [] }] : []),
        ...(x.issued ? [{ id: "issued", caseId: "case", type: x.issued, fromReinspId: r.id, items: [] }] : []),
      ],
      REINSP: [r],
      EVENTS: {},
      WORK: { actionChoices: x.saved ? { visit: { intent: "extension", group: "time" } } : {} },
      state: {},
    });
    const owner = api.initNewDocuments({
      worksheetFaults(...args) {
        calls.push(["faults", structuredClone(args)]);
        if (++steps === x.fail) throw Error("interrupted:faults");
        return x.fault ? ["Fault <&>"] : [];
      },
    });
    let value,
      error = null;
    try {
      value = owner.chooser(r);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, calls, state: structuredClone(api.WriterState) };
  }
  let count = 0,
    rendered = 0,
    status = 0,
    saved = 0;
  const types = ["", "extension", "citation", "referral", "compliance", "noOccupancy", "bestInterestExtension", "vacancyExtension"];
  const rules = [
    null,
    { status: "Extension <&>", label: "Choose <&>", choose: ["extension", "bestInterestExtension", "vacancyExtension"] },
    { status: "Citation", label: "Citation", doc: "citation", cite: true },
    { status: "Corrected", label: "Compliance", doc: "compliance", allCorrected: true },
  ];
  for (let i = 0; i < 2048; i++) {
    const x = {
      picked: types[i % types.length],
      group: ["", "time", "enforcement", "occupancy", "compliance"][Math.floor(i / 8) % 5],
      rule: rules[Math.floor(i / 40) % 4],
      draft: !!(i & 1),
      corrected: !!(i & 2),
      cite: !!(i & 4),
      referred: i % 7 === 0,
      missing: i % 13 === 0,
      saved: i % 11 === 0,
      issued: ["", "extension", "summaryAbatement"][Math.floor(i / 160) % 3],
      fault: i % 17 === 0,
      fail: i % 19 === 0 ? 1 : 0,
    };
    const result = run(current, x);
    assert.deepEqual(result, run(original, x), "followup:" + i);
    if (result.value) {
      rendered++;
      if (x.rule) status++;
      if (x.saved && !x.draft && !x.rule) saved++;
    }
    count++;
  }
  assert.ok(rendered > 1900);
  assert.ok(status > 1000);
  assert.ok(saved > 0);
  console.log("PASS Writer followup templates " + count + " exact HTML/state/callback comparisons");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
