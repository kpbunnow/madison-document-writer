/* Before/after diagnostics must reject missing work and misleading comparison inputs. */
const assert = require("node:assert/strict");
const { compareRuns, median } = require("../../tools/compare_workspace_opening.cjs");
const hash = (c) => c.repeat(64);
function run(after) {
  return {
    cpuSampling: false,
    warmups: 1,
    trialCount: 3,
    htmlSha256: hash(after ? "b" : "a"),
    harnessSha256: hash("c"),
    platform: "linux",
    architecture: "x64",
    node: "v24.19.0",
    playwright: "1.64.1",
    browser: "156.0.8078.4",
    timezone: "America/Chicago",
    viewport: { width: 1400, height: 1000 },
    results: [
      {
        cases: 5,
        drafts: 5,
        events: 15,
        bytes: 1000,
        fixtureSha256: hash("d"),
        trials: [100, 110, 120].map((ms) => ({
          readyMs: ms / (after ? 2 : 1),
          renderMs: ms / (after ? 4 : 2),
          cases: 5,
          docs: 20,
          rows: 5,
          visits: 1,
          firstText: "Private wording 4",
          durableSha256: hash("d"),
          resultSha256: hash("e"),
        })),
      },
    ],
  };
}
const pairs = () =>
  Array.from({ length: 4 }, (_, n) => ({ order: n % 2 ? ["after", "before"] : ["before", "after"], before: run(false), after: run(true) }));
const input = pairs(),
  saved = JSON.stringify(input),
  result = compareRuns(input, [5]);
assert.equal(result.mode, "diagnostic-only");
assert.equal(result.samplesPerVersion, 12);
assert.equal(result.rows[0].metrics.readyMs.percentLessTime, 50);
assert.equal(result.rows[0].metrics.renderMs.percentLessTime, 50);
assert.equal(JSON.stringify(input), saved, "comparison must not rewrite raw evidence");
assert.equal(median([3, 1, 2, 4]), 2.5);
assert.equal(median([3, 1, 2]), 2);
let rejected = 0;
for (const mutate of [
  (p) => p.pop(),
  (p) => p[1].order.reverse(),
  (p) => (p[2].after.cpuSampling = true),
  (p) => (p[2].after.warmups = 0),
  (p) => (p[2].after.browser = "different"),
  (p) => (p[2].after.node = "different"),
  (p) => (p[2].after.harnessSha256 = hash("f")),
  (p) => delete p[2].after.playwright,
  (p) => (p[2].after.htmlSha256 = hash("f")),
  (p) => (p[2].after.results = []),
  (p) => p[2].after.results.push(p[2].after.results[0]),
  (p) => (p[2].after.results[0].fixtureSha256 = hash("f")),
  (p) => p[2].after.results[0].bytes++,
  (p) => p[2].after.results[0].trials.pop(),
  (p) => (p[2].after.results[0].trials[0].resultSha256 = hash("f")),
  (p) => (p[2].after.results[0].trials[0].durableSha256 = hash("f")),
  (p) => p[2].after.results[0].trials[0].rows--,
  (p) => p[2].after.results[0].trials[0].docs--,
  (p) => (p[2].after.results[0].trials[0].readyMs = NaN),
]) {
  const value = pairs();
  mutate(value);
  assert.throws(() => compareRuns(value, [5]));
  rejected++;
}
assert.throws(() => compareRuns(pairs(), [5, 10]), /Missing requested workload/);
const control = pairs();
control.forEach((p) => (p.after = structuredClone(p.before)));
assert.equal(compareRuns(control, [5]).rows[0].metrics.readyMs.percentLessTime, 0, "A/A control must not invent a gain");
console.log("PASS paired benchmark comparison, exact workload/results/environment, A/A control and " + rejected + " rejected corruptions");
