/* Exact action-screen and service-evidence presentation, through real state/query owners. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/new_documents.js", "utf8"),
    reference = fs.readFileSync("tests/fixtures/document_action_templates_reference.txt", "utf8"),
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
  function run(api, method, input) {
    const x = structuredClone(input),
      calls = [];
    let steps = 0;
    const effect =
      (name, fn) =>
      (...args) => {
        calls.push([name, structuredClone(args)]);
        if (++steps === x.fail) throw Error("interrupted:" + name);
        return fn(...args);
      };
    const k = { id: "case", number: "QA-CASE", address: "Property <&> Street", owner: "Owner", inspectorId: "i4" },
      d = {
        id: "doc",
        caseId: k.id,
        type: x.type,
        draft: x.draft,
        void: x.void,
        superseded: x.superseded,
        initialAction: x.initial,
        fromReinspId: x.from ? "visit" : "",
        items: [],
        special: { scope: "unit", unit: "Unit <&>" },
        serviceRecords: x.records
          ? [{ method: "service <&>", date: "2026-10-01", reference: "Record <&>", courtRestriction: x.court, courtReference: "Court <&>" }]
          : [],
      };
    Object.assign(api.WriterState, {
      CASES: x.missing ? [] : [k],
      DOCS: [d, ...(x.referred ? [{ id: "referral", caseId: k.id, type: "referral", items: [] }] : [])],
      REINSP: [],
      EVENTS: {},
      WORK: {
        currentAction: { cid: k.id, type: x.picked, group: x.group },
        recordForms: { ["service:" + d.id]: { method: x.method, reference: "Form <&>", courtReference: "Court <&>", date: "2026-10-02" } },
      },
      state: { publicationBusy: x.busy ? d.id : "" },
    });
    const services = {
        sourceDocFor: effect("source", api.sourceDocFor),
        shell: effect("shell", (...args) => args),
        snow: { is: effect("snow", () => x.snow) },
        fmtDate: effect("date", (v) => v),
      },
      owner = api.initNewDocuments(services);
    assert.equal(calls.length, 0, "inert constructor");
    let value,
      error = null;
    try {
      value = method === "case" ? owner.caseActionScreen() : owner.actionPanel(d);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, calls, state: api.WriterState };
  }
  let count = 0,
    serviceEvidence = 0,
    referredScreens = 0;
  for (let i = 0; i < 768; i++)
    for (const method of ["case", "panel"]) {
      const x = {
        type: ["notice", "nonSummaryAbatement", "noOccupancy", "compliance"][Math.floor(i / 3) % 4],
        draft: !!(i & 1),
        void: !!(i & 2),
        superseded: !!(i & 4),
        initial: !!(i & 8),
        from: !!(i & 16),
        records: !!(i & 32),
        court: !!(i & 64),
        busy: !!(i & 128),
        snow: i % 17 === 0,
        referred: i % 11 === 0,
        missing: i % 19 === 0,
        picked: ["", "noOccupancy", "summaryAbatement"][i % 3],
        group: ["", "time", "occupancy", "enforcement"][i % 4],
        method: i % 2 ? "service" : "publication",
        fail: i % 7 === 0 ? (i % 5) + 1 : 0,
      };
      const result = run(current, method, x);
      assert.deepEqual(result, run(original, method, x), method + ":" + i);
      if (typeof result.value === "string" && result.value.includes("Service and court evidence")) serviceEvidence++;
      if (Array.isArray(result.value) && result.value[3]?.includes("Import a CA Reinspection")) referredScreens++;
      count++;
    }
  assert.ok(serviceEvidence > 0, "archived non-summary service evidence is exercised");
  assert.ok(referredScreens > 0, "referred case branch is exercised");
  assert.equal(count, 1536);
  console.log("PASS document action templates " + count + " exact HTML/state/callback comparisons");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
