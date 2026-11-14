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
  {
    suite: "audit_feature_accela_import.js",
    scenario: "audit_status_own_property.js: inherited-property statuses and case numbers are ordinary text",
    rule: "status rules read only their own entries",
    find: "rule = Object.hasOwn(rules, key) ? rules[key] : null;",
    replace: "rule = rules[key] || null;",
  },
  {
    suite: "audit_feature_accela_import.js",
    scenario: "audit_r50_import.js: result-status eligibility table",
    rule: "result statuses match their rule regardless of spacing and case",
    find: 'var accNorm = (v) => accStr(v).replace(/\\s+/g, " ").toLowerCase();',
    replace: "var accNorm = (v) => accStr(v).toLowerCase();",
  },
  {
    suite: "audit_feature_accela_import.js",
    scenario: "audit_r45_import.js: source-selection parity, interruption and draft continuity",
    rule: "a late capture never replaces typed lookup work",
    find: "if (el && editorState.WORK.entry[id] === void 0) editorState.WORK.entry[id] = el.value;",
    replace: "if (el) editorState.WORK.entry[id] = el.value;",
  },
];

const run = (m, mutation) =>
  spawnSync(process.execPath, [path.join(__dirname, m.suite)], {
    encoding: "utf8",
    timeout: 300000,
    env: {
      ...process.env,
      ...(m.scenario ? { DW_SCENARIO: m.scenario } : {}),
      ...(mutation ? { DW_WORKFLOW_MUTATION: JSON.stringify(mutation) } : {}),
    },
  });

const { normalOutcome } = require("../fixtures/mutation_outcome.cjs");
const results = [];
for (const m of MUTATIONS) {
  const clean = run(m);
  assert.equal(normalOutcome(clean, m.suite), 0, (m.scenario || m.suite) + " passes unmodified:\n" + clean.stdout + clean.stderr);
  const mutated = run(m, { find: m.find, replace: m.replace });
  const output = mutated.stdout + mutated.stderr;
  assert.doesNotMatch(output, /Invalid owner bundle:/, m.suite + ": syntax-invalid mutation is not a detected regression");
  assert.ok(!/the mutation applies exactly once/.test(output), m.suite + ": the mutation must apply exactly once\n" + output);
  assert.notEqual(normalOutcome(mutated, m.suite), 0, m.suite + " must detect the regression: " + m.rule);
  results.push({ suite: m.suite, scenario: m.scenario, rule: m.rule, detected: true });
}
console.log(JSON.stringify({ passed: true, mutations: results }));
