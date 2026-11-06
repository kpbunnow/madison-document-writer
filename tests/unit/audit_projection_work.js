/* A summary projects continuing item state once, preserving retained output and fresh-call behavior. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");

async function compile(file) {
  let source = fs.readFileSync(file, "utf8");
  const signature = "export function continuingItemsForVisits(source, visits) {";
  assert.equal(source.split(signature).length, 2, "instrument the same real calculation exactly once");
  source =
    "let observedWork = 0;\n" + source.replace(signature, signature + "\n observedWork++;") + "\nexport function workCount(){return observedWork;}";
  const built = await esbuild.build({
    stdin: { contents: source, resolveDir: path.resolve("app/modules") },
    bundle: true,
    write: false,
    format: "cjs",
    plugins: [
      {
        name: "data",
        setup(build) {
          build.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  return box.exports;
}

(async () => {
  const current = await compile("app/modules/case_projection.js"),
    retained = await compile("tests/fixtures/case_projection_reference.txt");
  for (const size of [25, 100]) {
    const items = Array.from({ length: size }, (_, n) => ({
      id: "item-" + n,
      no: String(n + 1),
      title: "Synthetic repair",
      text: "Retain order wording",
      sections: ["27.05(2)(c)"],
      due: "2026-12-01",
    }));
    const notice = { id: "notice", caseId: "case", type: "notice", authoringVersion: 16, mailed: "2026-01-03", items, cits: {} },
      record = {
        format: "madison-case-file",
        schema: 5,
        case: { id: "case", number: "QA-WORK", owner: "SYNTHETIC" },
        events: [{ id: "issued", type: "notice.issued", at: "2026-01-03T12:00:00Z", payload: { snapshot: notice } }],
      };
    for (let n = 0; n < 8; n++) {
      const date = "2026-02-0" + (n + 1);
      record.events.push({
        id: "visit-event-" + n,
        type: "reinspection.recorded",
        at: date + "T12:00:00Z",
        payload: {
          reinspection: {
            id: "visit-" + n,
            caseId: "case",
            sourceDocId: "notice",
            date,
            results: Object.fromEntries(items.map((it, q) => [it.id, { oc: n === 7 && q % 3 === 0 ? "corrected" : "outstanding" }])),
          },
        },
      });
    }
    const context = { inspectors: [], library: [], cases: [], integrity: {}, build: "synthetic", written: "2026-11-05" },
      before = JSON.stringify(record),
      actualCount = current.workCount(),
      oldCount = retained.workCount();
    const actual = current.summarizeRecord(record, context);
    assert.deepEqual(actual, retained.summarizeRecord(record, context));
    assert.equal(JSON.stringify(record), before, "projection never mutates source history");
    assert.equal(current.workCount() - actualCount, 1);
    assert.equal(retained.workCount() - oldCount, size);
    assert.equal(actual.violations[0].done, true);
    record.events.at(-1).payload.reinspection.results["item-0"].oc = "outstanding";
    const fresh = current.summarizeRecord(record, context);
    assert.equal(fresh.violations[0].done, false, "another summary must compute fresh visit results");
    assert.equal(current.workCount() - actualCount, 2);
    assert.deepEqual(fresh, retained.summarizeRecord(record, context));
  }
  console.log("PASS one continuing-item calculation per summary at 25/100 items: retained output, source immutability and fresh-call results");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
