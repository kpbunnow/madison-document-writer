/* Consolidation Phase 6: feature suites group scenarios by the feature they cover, while every scenario keeps its
   own process, bundle, DOM, application state, storage, mocks and timers, exactly as when it was its own suite.

   A feature suite calls run(__filename, { "label": () => { ...scenario... }, ... }). Run directly, it starts one
   child process per scenario, in order, and fails when any scenario fails, prints nothing, or does not run. In the
   child (DW_SCENARIO set) only that scenario runs; it finishes as an ordinary suite does: bundle_test.cjs exits
   explicitly and settle_ui_timers.cjs suites end when their work completes. Labels name the source suite each
   scenario came from, so release reviews that cite a former suite name can still find it. */
"use strict";
const { spawnSync } = require("child_process"),
  path = require("path");

function run(file, scenarios) {
  const names = Object.keys(scenarios);
  if (!names.length) throw new Error(path.basename(file) + " defines no scenarios");
  const selected = process.env.DW_SCENARIO;
  if (selected !== undefined) {
    if (!Object.hasOwn(scenarios, selected)) throw new Error(path.basename(file) + ": unknown scenario " + JSON.stringify(selected));
    return scenarios[selected]();
  }
  const failed = [];
  for (const name of names) {
    console.log("--- scenario: " + name);
    const child = spawnSync(process.execPath, [file], { env: { ...process.env, DW_SCENARIO: name }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(child.stdout || "");
    process.stderr.write(child.stderr || "");
    if (child.status !== 0 || child.error) failed.push(name + " (exit " + (child.error ? child.error.message : child.status) + ")");
    else if (!/\S/.test(child.stdout || "")) failed.push(name + " (no output)");
  }
  if (failed.length) {
    console.error("FAIL " + path.basename(file) + ": " + failed.length + " of " + names.length + " scenarios failed: " + failed.join("; "));
    process.exitCode = 1;
  } else console.log("PASS " + path.basename(file) + ": " + names.length + " scenarios, each in its own process");
}

module.exports = { run };
