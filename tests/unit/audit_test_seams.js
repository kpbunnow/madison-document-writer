const assert = require("node:assert/strict");
const { classify, inventory, hookCandidates } = require("../../tools/test_seams.cjs");
const baseline = require("../fixtures/test-seam-baseline.json");
const retainedHooks = require("../fixtures/test-hook-baseline.json");
assert.equal(classify('const {bundleSource}=require("./built_bundle.cjs");eval(bundleSource(page));').evalCalls, 1);
assert.equal(classify('new Function("module", source)(box);').functionConstructors, 1);
assert.equal(classify("window.eval(source);").evalCalls, 1);
assert.equal(classify("vm.runInNewContext(source, services);").vmEvaluations, 1);
assert.equal(classify("page.evaluate(() => owner.render());").browserEvaluations, 1);
assert.equal(classify('const text="eval(bundle)"; // new Function(source)\n').evalCalls, 0);
assert.deepEqual(hookCandidates('const payload="cont"+"Head(d)";', ["contHead", "noticeHTML"]), ["contHead"]);
assert.deepEqual(hookCandidates("const payload=String.raw`noticeHTML(d)`;", ["contHead", "noticeHTML"]), ["noticeHTML"]);
assert.equal(classify('require("../fixtures/bundle_test.cjs")("payload");').harnessCalls, 1);
const current = inventory();
assert.deepEqual(current.hook.map((field) => field.key).sort(), retainedHooks, "review retained diagnostic changes explicitly");
for (const [file, count] of Object.entries(current.legacy))
  assert.ok(count <= (baseline[file]?.count || 0), "new whole-application evaluation: " + file);
for (const file of Object.keys(baseline)) assert.equal(current.legacy[file], baseline[file].count, "lower the baseline after migrating " + file);
for (const [file, entry] of Object.entries(baseline)) {
  assert.ok(["integration", "migratable"].includes(entry.class), "classify " + file);
  if (entry.class === "integration") assert.ok(entry.reason?.length >= 20, "an integration evaluator needs its reason: " + file);
  else assert.ok(entry.owner?.length >= 10, "a migratable evaluator names its owner: " + file);
}
console.log("PASS test-seam inventory", current.counts);
