/* Serial playwright before/after diagnostics. Never merge/release approval.
   node tools/compare_workspace_opening.cjs <before-production.html> <after-production.html> <new-output-dir> */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");

const median = (values) => {
  assert.ok(values.length && values.every(Number.isFinite));
  const sorted = [...values].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function validateRun(run) {
  for (const key of ["platform", "architecture", "node", "playwright", "browser", "timezone", "harnessSha256"])
    assert.ok(typeof run[key] === "string" && run[key].length, "Missing environment/measurement identity: " + key);
  assert.equal(run.cpuSampling, false, "CPU sampling must be separate from timing comparisons");
  assert.ok(run.warmups >= 1 && run.trialCount >= 3);
  assert.match(run.htmlSha256, /^[a-f0-9]{64}$/);
  assert.ok(run.results.length > 0);
  assert.equal(new Set(run.results.map((r) => r.cases)).size, run.results.length);
  for (const row of run.results) {
    assert.ok(Number.isInteger(row.cases) && row.cases > 0 && Number.isInteger(row.bytes) && row.bytes > 0);
    assert.equal(row.drafts, row.cases);
    assert.equal(row.events, row.cases * 3);
    assert.match(row.fixtureSha256, /^[a-f0-9]{64}$/);
    assert.equal(row.trials.length, run.trialCount);
    for (const t of row.trials) {
      assert.ok(t.readyMs > 0 && t.renderMs > 0 && Number.isFinite(t.readyMs) && Number.isFinite(t.renderMs));
      assert.equal(t.cases, row.cases);
      assert.equal(t.rows, row.cases);
      assert.equal(t.docs, row.cases * 4);
      assert.equal(t.visits, Math.ceil(row.cases / 5));
      assert.equal(t.firstText, "Private wording " + (row.cases - 1));
      assert.equal(t.durableSha256, row.fixtureSha256);
      assert.match(t.resultSha256, /^[a-f0-9]{64}$/);
    }
  }
}

function compareRuns(pairs, expectedSizes) {
  assert.ok(pairs.length >= 4 && pairs.length % 2 === 0, "Use an even number of at least four paired rounds");
  const reference = pairs[0].before,
    identities = {};
  assert.deepEqual(
    reference.results.map((r) => r.cases),
    expectedSizes || reference.results.map((r) => r.cases),
    "Missing requested workload",
  );
  for (const [round, pair] of pairs.entries()) {
    assert.deepEqual(pair.order, round % 2 ? ["after", "before"] : ["before", "after"]);
    for (const version of ["before", "after"]) {
      const run = pair[version];
      validateRun(run);
      for (const key of [
        "platform",
        "architecture",
        "node",
        "playwright",
        "browser",
        "viewport",
        "timezone",
        "trialCount",
        "warmups",
        "harnessSha256",
      ])
        assert.deepEqual(run[key], reference[key], "Mismatched environment or trial protocol: " + key);
      identities[version] ||= run.htmlSha256;
      assert.equal(run.htmlSha256, identities[version], "Measured HTML changed between rounds");
      assert.deepEqual(
        run.results.map((r) => r.cases),
        reference.results.map((r) => r.cases),
      );
      for (const [index, row] of run.results.entries()) {
        const expected = reference.results[index];
        for (const key of ["cases", "drafts", "events", "bytes", "fixtureSha256"])
          assert.equal(row[key], expected[key], "Different seeded workload: " + key);
        assert.ok(
          row.trials.every((t) => t.resultSha256 === expected.trials[0].resultSha256),
          "Projected results differ",
        );
      }
    }
  }
  const rows = reference.results.map((row, index) => {
    const metrics = {};
    for (const metric of ["readyMs", "renderMs"]) {
      const before = pairs.flatMap((p) => p.before.results[index].trials.map((t) => t[metric]));
      const after = pairs.flatMap((p) => p.after.results[index].trials.map((t) => t[metric]));
      const pairedPercent = pairs.map(
        (p) => 100 * (1 - median(p.after.results[index].trials.map((t) => t[metric])) / median(p.before.results[index].trials.map((t) => t[metric]))),
      );
      metrics[metric] = {
        beforeMedian: median(before),
        afterMedian: median(after),
        percentLessTime: 100 * (1 - median(after) / median(before)),
        pairedPercent,
        medianPairedPercent: median(pairedPercent),
        beforeRange: [Math.min(...before), Math.max(...before)],
        afterRange: [Math.min(...after), Math.max(...after)],
      };
    }
    return { cases: row.cases, fixtureSha256: row.fixtureSha256, metrics };
  });
  return {
    mode: "diagnostic-only",
    passed: true,
    resultsEqual: true,
    rounds: pairs.length,
    samplesPerVersion: pairs.length * reference.trialCount,
    identities,
    rows,
    pairs,
  };
}

function main() {
  assert.equal(process.argv.length, 5, "Supply before HTML, after HTML and a new output directory");
  const [before, after, directory] = process.argv.slice(2).map((p) => path.resolve(p));
  const rounds = Number(process.env.PROFILE_PAIRS || 4);
  assert.ok(Number.isInteger(rounds) && rounds >= 4 && rounds <= 10 && rounds % 2 === 0);
  fs.mkdirSync(directory); // Refuse existing/stale output rather than mixing runs.
  const sizes = (process.env.PROFILE_SIZES || "100,1000,3000").split(",").map(Number);
  const pairs = [];
  for (let round = 0; round < rounds; round++) {
    const pair = { order: round % 2 ? ["after", "before"] : ["before", "after"] };
    for (const version of pair.order) {
      const label = round + "-" + version;
      const result = spawnSync(process.execPath, [path.join(__dirname, "profile_workspace_opening.cjs"), label], {
        env: {
          ...process.env,
          PROFILE_CPU: "0",
          PROFILE_TRIALS: "3",
          PROFILE_WARMUP: "1",
          DW_PROFILE_OUTPUT: directory,
          DW_PROFILE_HTML: version === "before" ? before : after,
        },
        encoding: "utf8",
        timeout: 600000,
        maxBuffer: 4 * 1024 * 1024,
      });
      fs.writeFileSync(path.join(directory, label + ".log"), (result.stdout || "") + (result.stderr || ""));
      assert.equal(result.status, 0, "Profile failed; inspect " + label + ".log");
      pair[version] = JSON.parse(fs.readFileSync(path.join(directory, label + ".json"), "utf8"));
      assert.equal(pair[version].trialCount, 3);
      assert.equal(pair[version].warmups, 1);
      console.log("Completed", label);
    }
    pairs.push(pair);
  }
  const comparison = compareRuns(pairs, sizes);
  fs.writeFileSync(path.join(directory, "comparison.json"), JSON.stringify(comparison, null, 2));
  console.log(JSON.stringify(comparison.rows, null, 2));
}
if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
}
module.exports = { compareRuns, median };
