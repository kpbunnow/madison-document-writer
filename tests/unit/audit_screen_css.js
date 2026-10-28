/* Guard the reviewed dead-class decision, including split literals that fooled the former text scan. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
const { classReferences, scanModules, styleContract } = require("../../tools/screen_css_usage.cjs");
const inventory = require("../fixtures/screen_shell_css.json"),
  root = path.resolve(__dirname, "../..");
assert.deepEqual(
  classReferences("const html = value + '<label class=\"case' + '-view\"><button class=\"queue-pri' + 'mary\">';", ["case-view", "queue-primary"]),
  ["case-view", "queue-primary"],
);
assert.deepEqual(classReferences('const html = `<span class="chip">${value}</span>`;', ["chip", "chips"]), ["chip"]);
assert.deepEqual(classReferences('const markup = html`<span class="chip">${value}</span>`;', ["chip", "chips"]), ["chip"]);
const consumers = scanModules(path.join(root, "app/modules"), [...inventory.removedClasses, ...inventory.retainedClasses]);
for (const name of inventory.removedClasses) assert.deepEqual(consumers[name], [], name + " regained a source consumer; restore/review its styles");
for (const name of inventory.retainedClasses) assert.ok(consumers[name].length, name + " must be retained as a split-literal regression case");
for (const [name, facts] of Object.entries(inventory.files)) {
  const bytes = fs.readFileSync(path.join(root, "app/assets", name));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), facts.afterSha256, name + " requires screen-reference review");
  assert.equal(
    crypto
      .createHash("sha256")
      .update(styleContract(bytes.toString("utf8"), inventory.removedClasses, name === "writer.css"))
      .digest("hex"),
    facts.retainedRulesSha256,
    name + " changed surviving declarations/cascade order",
  );
  for (const cls of inventory.removedClasses)
    assert.ok(!new RegExp("\\." + cls + "(?![A-Za-z0-9_-])").test(bytes.toString("utf8")), name + " still declares " + cls);
}
console.log(
  JSON.stringify({
    passed: true,
    removedClasses: inventory.removedClasses.length,
    retainedDynamicClasses: inventory.retainedClasses,
    preservedPrintReference: true,
  }),
);
