/* Exact action-screen and service-evidence presentation, through real state/query owners. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
(async () => {
  const source = fs.readFileSync("app/modules/new_documents.js", "utf8"),
    reference = fs.readFileSync("tests/fixtures/writer_details_templates_reference.txt", "utf8"),
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
  function run(api, x) {
    const calls = [];
    let steps = 0;
    const effect =
      (name, fn) =>
      (...args) => {
        calls.push([name, structuredClone(args)]);
        if (++steps === x.fail) throw Error("interrupted:" + name);
        return fn(...args);
      };
    const d = {
      id: "doc",
      caseId: "case",
      type: x.type,
      authoringVersion: x.version,
      items: [
        { id: "one", no: "1", title: "Wall <&>", text: "Repair <&>", due: "2026-11-01" },
        { id: "two", no: "2", text: "Repair <&>", due: "2026-11-02", done: x.done, withdrawn: x.withdrawn },
      ],
      administrativeAction: x.admin,
      initialAction: x.initial,
      correction: x.correction ? { targetId: "issued" } : null,
    };
    if (!x.empty)
      d.special = {
        scope: x.scope,
        unit: "Unit <&>",
        variant: x.variant,
        mode: x.mode,
        releaseVisitId: x.external ? "external" : "",
        posting: x.posting,
        affected: x.affected ? ["1", "2"] : [],
        reason: "Reasons <&>",
        findings: "Facts <&>",
        reviewRef: 'Review " <&>',
        stage: x.stage,
        boarding: x.boarding,
        expiryMode: x.expiry,
        deadlineMode: x.deadline,
      };
    if (x.imported) d.importRule = { label: "Label <&>", status: "Status <&>" };
    Object.assign(api.WriterState, {
      CASES: [{ id: "case" }],
      DOCS: [
        d,
        {
          id: "restriction",
          caseId: "case",
          type: "noOccupancy",
          special: { scope: "unit", unit: "A <&>", mode: "restrict", effective: "2026-09-01" },
          items: [],
        },
      ],
      REINSP: [{ id: "visit", caseId: "case", date: "2026-10-29", inspectorId: "i4", draft: false }],
      EVENTS: {},
      state: {},
    });
    const owner = api.initNewDocuments({ isLocked: effect("locked", () => x.locked), fmtDate: effect("date", (v) => v) });
    assert.equal(calls.length, 0);
    let value,
      error = null;
    try {
      value = owner.details(d);
    } catch (e) {
      error = [e.name, e.message];
    }
    return { value, error, calls, state: structuredClone(api.WriterState) };
  }
  let count = 0,
    rendered = 0,
    release = 0;
  for (let i = 0; i < 4096; i++) {
    const x = {
      type: ["notice", "bestInterestExtension", "vacancyExtension", "summaryAbatement", "nonSummaryAbatement", "noOccupancy"][i % 6],
      version: [11, 12, 13, 14, 15, 16][Math.floor(i / 6) % 6],
      admin: !!(i & 1),
      initial: !!(i & 2),
      done: !!(i & 4),
      withdrawn: !!(i & 8),
      affected: !!(i & 16),
      boarding: !!(i & 32),
      correction: i % 13 === 0,
      locked: i % 17 === 0,
      empty: i % 19 === 0,
      imported: i % 7 === 0,
      scope: i % 2 ? "unit" : "building",
      variant: ["custom", "tree", "secure", "junk"][Math.floor(i / 36) % 4],
      mode: Math.floor(i / 9) % 2 ? "release" : "restrict",
      external: !!(i & 64),
      posting: i % 3 ? "posted" : "pending",
      stage: i % 3 ? "supervisory" : "administrative",
      expiry: i % 3 ? "fixed" : "review",
      deadline: i % 3 ? "dated" : "conditional",
      fail: i % 23 === 0 ? (i % 4) + 1 : 0,
    };
    const actual = run(current, x);
    assert.deepEqual(actual, run(original, x), "details:" + i);
    if (actual.value) {
      rendered++;
      if (x.type === "noOccupancy" && x.mode === "release") release++;
    }
    count++;
  }
  assert.ok(rendered > 2500);
  assert.ok(release > 100);
  assert.equal(count, 4096);
  console.log("PASS Writer details templates " + count + " exact HTML/state/callback comparisons");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
