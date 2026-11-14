/* Phase 3 workflow locality census: counting rules, configured identities and no regression from the pre-edit record. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  acorn = require("acorn"),
  { census, functionIdentities, measureFunction, importKinds } = require("../../tools/workflow_locality.cjs");

const sample = `
import { workspaceState as workspace } from "./workspace_state.js";
import { editorState as editor } from "./editor_state.js";
import { doc, docsFor } from "./writer_queries.js";
import { clone } from "./record_values.js";
export function owner(services) {
  function decide(r) {
    const d = doc(r.id), all = docsFor(r.caseId);
    if (services.isLocked(d) || services.inspection.validISO(r.date)) return clone(all);
    editor.state.docId = d.id;
    workspace.DOCS = all;
    delete workspace.PENDING[r.id];
    const n = { document: 1 };
    return workspace.CASES.length + document.title + n.document;
  }
  function inner() { return services.ui.toast("x"); }
  function lookups() { return { all: docsFor, doc: 1 }; }
  return { decide, inner, lookups };
}`;
const ast = acorn.parse(sample, { ecmaVersion: "latest", sourceType: "module" });
const identities = functionIdentities(ast);
assert.deepEqual(
  identities.map((f) => f.identity),
  ["owner#1", "owner#1/decide#1", "owner#1/inner#1", "owner#1/lookups#1"],
);
const kinds = importKinds(ast);
assert.deepEqual([...kinds.state].sort(), ["editor", "workspace"]);
assert.deepEqual([...kinds.queries].sort(), ["doc", "docsFor"]);
const decide = identities.find((f) => f.identity === "owner#1/decide#1").node,
  inner = identities.find((f) => f.identity === "owner#1/inner#1").node,
  outer = identities.find((f) => f.identity === "owner#1").node;
const measured = measureFunction(decide, kinds, new Set([decide]));
assert.deepEqual(measured.peers, ["inspection.validISO", "isLocked"], "grouped services count by operation");
assert.deepEqual(measured.state, ["editor.docId", "workspace.CASES", "workspace.DOCS", "workspace.PENDING"]);
assert.deepEqual(measured.writes, ["editor.docId", "workspace.DOCS"], "assignments are writes; a nested delete target is a read of its holder");
assert.deepEqual(measured.queries, ["doc", "docsFor"]);
assert.deepEqual(measured.dom, ["document"], "an object key named document is not the browser global");
// A query handed on as an explicit lookup still counts; a property key with the same name does not.
const lookups = identities.find((f) => f.identity === "owner#1/lookups#1").node;
assert.deepEqual(measureFunction(lookups, kinds, new Set([lookups])).queries, ["docsFor"]);
// A listed nested function is measured separately and never double-counted in its owner.
assert.deepEqual(measureFunction(outer, kinds, new Set([outer, decide, inner, lookups])).peers, []);
assert.deepEqual(measureFunction(outer, kinds, new Set([outer])).peers, ["inspection.validISO", "isLocked", "ui.toast"]);

// Every configured workflow resolves, and calculation phases never regress from the recorded pre-edit census.
const config = JSON.parse(fs.readFileSync("tools/workflow-locality.json", "utf8"));
const current = census(config);
const baseline = JSON.parse(fs.readFileSync("docs/developer/maintainability/locality-baseline-2026-11-14.json", "utf8"));
assert.ok(config.workflows.length >= 3, "at least three costly workflows are tracked");
for (const workflow of current.workflows) {
  const before = baseline.workflows.find((w) => w.id === workflow.id);
  assert.ok(before, workflow.id + " has a recorded pre-edit census");
  assert.ok(workflow.calculation.functions > 0, workflow.id + " names its calculation phases");
  assert.ok(
    workflow.calculation.mutablePeerAccess <= before.calculation.mutablePeerAccess,
    `${workflow.id}: calculation access ${before.calculation.mutablePeerAccess} -> ${workflow.calculation.mutablePeerAccess}`,
  );
  // No dependency silently leaves the census: every one the pre-edit workflow had is still counted somewhere in it,
  // unless the configuration names it as removed with a reason.
  const deps = (summary) => [...summary.peers, ...summary.state, ...summary.queries];
  const removed = new Set(Object.keys(config.workflows.find((w) => w.id === workflow.id).removedDependencies || {}));
  const now = new Set(deps(workflow.total));
  const lost = deps(before.total).filter((dep) => !now.has(dep) && !removed.has(dep));
  assert.deepEqual(lost, [], workflow.id + ": dependencies dropped from the census without a recorded removal");
  assert.ok(
    workflow.total.mutablePeerAccess <= before.total.mutablePeerAccess,
    `${workflow.id}: workflow access ${before.total.mutablePeerAccess} -> ${workflow.total.mutablePeerAccess}; a provider must not add dependencies`,
  );
}
console.log(
  "workflow locality: " + current.workflows.map((w) => `${w.id} ${w.calculation.mutablePeerAccess}/${w.total.mutablePeerAccess}`).join(", "),
);
