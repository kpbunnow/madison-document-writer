/* Phase 4 negative evidence: each suite migrated from whole-application evaluation to real owners is run once with a
   deliberate regression in the rule it guards (one exact source edit, applied by its owner workflow fixture). The
   unmodified suite passes and every mutated run fails for a reason other than the mutation itself. */
const assert = require("node:assert/strict"),
  { spawnSync } = require("node:child_process"),
  path = require("node:path");

const MUTATIONS = [
  {
    suite: "audit_r37.js",
    rule: "Record Category Snow Removal makes an import a snow case",
    find: "/^snow removal$/i.test(category) ||",
    replace: "false ||",
  },
  {
    suite: "audit_r36.js",
    rule: "Scheduled inspection rows are discarded",
    find: 'new Set(["scheduled", "pending", "completed", "inspection", "no violation"])',
    replace: 'new Set(["pending", "completed", "inspection", "no violation"])',
  },
  {
    suite: "audit_lookup.js",
    rule: "duplicate shared case files block the lookup",
    find: '  if (hits.length > 1)\n    throw new Error("More than one shared file has this case number. Ask the record administrator',
    replace: '  if (false)\n    throw new Error("More than one shared file has this case number. Ask the record administrator',
  },
  {
    suite: "audit_r59_import_selection.js",
    rule: "each selection change invalidates an in-flight shared check",
    find: "  acc.sel = index;\n  importsState.ACC_SELECTION_SERIAL++;\n  return true;",
    replace: "  acc.sel = index;\n  return true;",
  },
  {
    suite: "audit_safety.js",
    rule: "a reviewed merge value resolves a field conflict",
    find: 'choice.kind === "shared" ? f.shared : choice.value;',
    replace: 'choice.kind === "shared" ? f.shared : f.shared;',
  },
];

const run = (suite, mutation) =>
  spawnSync(process.execPath, [path.join(__dirname, suite)], {
    encoding: "utf8",
    timeout: 300000,
    env: { ...process.env, ...(mutation ? { DW_WORKFLOW_MUTATION: JSON.stringify(mutation) } : {}) },
  });

const results = [];
for (const m of MUTATIONS) {
  const clean = run(m.suite);
  assert.equal(clean.status, 0, m.suite + " passes unmodified:\n" + clean.stdout + clean.stderr);
  const mutated = run(m.suite, { find: m.find, replace: m.replace });
  const output = mutated.stdout + mutated.stderr;
  assert.ok(!/the mutation applies exactly once/.test(output), m.suite + ": the mutation must apply exactly once\n" + output);
  assert.notEqual(mutated.status, 0, m.suite + " must detect the regression: " + m.rule);
  results.push({ suite: m.suite, rule: m.rule, detected: true });
}
console.log(JSON.stringify({ passed: true, mutations: results }));
