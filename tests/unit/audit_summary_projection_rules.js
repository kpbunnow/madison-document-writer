/* The browser summary projection against the retained module, over the synthetic projection corpus: replay output,
   summaries, refusals, and untouched inputs, with a roster-less and a roster-bearing case list. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process"),
  esbuild = require("esbuild");

const EXPORTS = "\nexport {INSPECTORS} from './data/inspectors.js'; export {LIBRARY} from './data/library.js';";
async function compile(contents) {
  const build = await esbuild.build({
    stdin: { contents: contents + EXPORTS, resolveDir: path.resolve("app/modules") },
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

const text = (value) => JSON.stringify(value, (_, v) => (v === undefined ? "<undefined>" : v));

function run(api, file, n) {
  const input = structuredClone(file),
    before = text(input);
  const inputs = {
    inspectors: api.INSPECTORS,
    library: api.LIBRARY,
    cases: n % 2 ? [structuredClone(file.case)] : [],
    integrity: { valid: true, label: "checked" },
    build: "test-build",
    written: "2026-10-30T12:00:00.000Z",
  };
  let outcome;
  try {
    outcome = { replay: api.replayEvents(structuredClone(file.events || [])), summary: api.summarizeRecord(input, inputs) };
  } catch (error) {
    outcome = { error: [error.constructor.name, error.message] };
  }
  return text({ outcome, untouched: text(input) === before });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile(fs.readFileSync("app/modules/case_projection.js", "utf8")),
    compile(fs.readFileSync("tests/fixtures/case_projection_reference.txt", "utf8")),
  ]);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "projection-phases-"));
  const seen = { cases: 0, refused: 0, citations: 0, history: 0, restrictions: 0, extensions: 0, snow: 0, corrections: 0, referrals: 0, service: 0 };
  const statuses = new Set();
  try {
    for (const seed of [20261021, 7, 31337]) {
      const file = path.join(folder, "corpus-" + seed + ".json");
      const made = spawnSync("node", ["tests/fixtures/projection_corpus.cjs", file, "1500", String(seed)], { encoding: "utf8" });
      assert.equal(made.status, 0, made.stderr);
      const { cases } = JSON.parse(fs.readFileSync(file, "utf8"));
      cases.forEach((entry, n) => {
        const [before, after] = [run(legacy, entry.file, n), run(current, entry.file, n)];
        assert.equal(after, before, `seed ${seed} case ${n} differs from the retained projection`);
        const { outcome, untouched } = JSON.parse(after);
        assert.equal(untouched, true, "the projection never changes its input");
        seen.cases++;
        if (outcome.error) return void seen.refused++;
        const summary = outcome.summary;
        statuses.add(summary.case.status);
        if (summary.citations.length) seen.citations++;
        if (summary.violations.some((v) => v.history.length)) seen.history++;
        if (summary.restrictions.length) seen.restrictions++;
        if (summary.conditionalExtensions.length) seen.extensions++;
        if (summary.snowInspections.length) seen.snow++;
        if (summary.corrections.length) seen.corrections++;
        if (summary.referrals.length) seen.referrals++;
        if (summary.documents.some((d) => d.serviceRecords.length)) seen.service++;
      });
    }
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
  // The corpus must keep reaching every reportable family, or the comparison would silently weaken.
  for (const [name, count] of Object.entries(seen)) assert.ok(count > (name === "refused" ? 0 : 20), "corpus reaches " + name + " (" + count + ")");
  for (const status of ["Not issued", "Withdrawn", "Closed", "Referred", "Occupancy restricted", "Cited – snow"])
    assert.ok(statuses.has(status), "corpus reaches status " + status);
  console.log("PASS summary projection matches the retained module over " + seen.cases + " corpus cases (" + seen.refused + " refused)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
