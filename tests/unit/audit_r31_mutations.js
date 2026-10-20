/* Prove that the properties kill the three originally missed regressions. */
const { spawnSync } = require("child_process"),
  assert = require("assert/strict");
for (const mutation of ["jail", "blank-reinspection", "case-fold"]) {
  const run = spawnSync(process.execPath, ["tests/unit/audit_properties.js"], {
    env: { ...process.env, DW_MUTATION: mutation },
    encoding: "utf8",
    timeout: 40000,
  });
  assert.ok(run.status !== 0, "Surviving mutant " + mutation);
  assert.ok(
    (run.stdout + run.stderr).includes("AssertionError") || (run.stdout + run.stderr).includes("seed="),
    "Mutant must fail a property, not infrastructure",
  );
  console.log("PASS killed " + mutation);
}
