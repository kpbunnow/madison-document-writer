/* Consolidation Phase 6: feature suites run each scenario in its own process (tests/fixtures/scenarios.cjs). The
   harness isolates scenarios, reports each one, and fails the suite when any scenario throws, rejects, exits
   non-zero or prints nothing. */
const assert = require("assert/strict"),
  fs = require("fs"),
  os = require("os"),
  path = require("path"),
  { spawnSync } = require("child_process");
const harness = path.resolve(__dirname, "../fixtures/scenarios.cjs");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "madison-scenarios-"));
function suite(name, scenarios) {
  const file = path.join(dir, name + ".js");
  fs.writeFileSync(file, "require(" + JSON.stringify(harness) + ").run(__filename, {\n" + scenarios + "\n});\n");
  const env = { ...process.env };
  delete env.DW_SCENARIO;
  return spawnSync(process.execPath, [file], { env, encoding: "utf8" });
}
try {
  // Isolation: a global set by one scenario is absent in the next, which runs in another process.
  let run = suite(
    "isolated",
    `"first": () => { globalThis.LEAKED = process.pid; console.log("PASS first " + process.pid); },
     "second": () => { if (globalThis.LEAKED !== undefined) throw new Error("state leaked"); console.log("PASS second " + process.pid); },`,
  );
  assert.equal(run.status, 0, run.stdout + run.stderr);
  const pids = [...run.stdout.matchAll(/PASS (?:first|second) (\d+)/g)].map((m) => m[1]);
  assert.equal(pids.length, 2);
  assert.notEqual(pids[0], pids[1], "each scenario runs in its own process");
  assert.match(run.stdout, /--- scenario: first[\s\S]*--- scenario: second/, "scenarios run in declared order");
  assert.match(run.stdout, /PASS isolated\.js: 2 scenarios, each in its own process/);

  // Every failure mode fails the suite and names the scenario; later scenarios still run.
  const failures = {
    throws: `() => { throw new Error("boom"); }`,
    rejects: `() => { Promise.reject(new Error("async boom")); console.log("started"); }`,
    silent: `() => {}`,
    exits: `() => { console.log("partial"); setTimeout(() => process.exit(3), 10); }`,
  };
  for (const [name, body] of Object.entries(failures)) {
    run = suite("fails-" + name, `${JSON.stringify(name)}: ${body},\n"after": () => console.log("PASS after"),`);
    assert.equal(run.status, 1, name + ": " + run.stdout + run.stderr);
    assert.match(run.stderr, new RegExp("FAIL fails-" + name + "\\.js: 1 of 2 scenarios failed: " + name), name);
    assert.match(run.stdout, /PASS after/, name + ": the remaining scenarios still run");
  }

  // A scenario name that does not exist is refused in the child.
  const file = path.join(dir, "isolated.js");
  run = spawnSync(process.execPath, [file], { env: { ...process.env, DW_SCENARIO: "missing" }, encoding: "utf8" });
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /unknown scenario "missing"/);
  // A suite without scenarios is refused.
  run = suite("empty", "");
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /defines no scenarios/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("PASS feature-suite harness: isolated processes, declared order, every failure mode fails the suite");
