/* Split-literal ratchet: screen modules may not gain adjacent string pieces joined with +, and the counter detects them. */
const assert = require("node:assert/strict"),
  { inventory, compare, splitSites } = require("../../tools/markup_inventory.cjs"),
  baseline = require("../../tools/markup-baseline.json");

assert.equal(splitSites('const a = "x" + "y";'), 1);
assert.equal(splitSites('const a = "x" + b + "y" + `z`;'), 1);
assert.equal(splitSites('const a = "x" + b + "y";'), 0);
assert.equal(splitSites('const a = b + "x" + "y" + "z";'), 2);
assert.equal(splitSites("const a = `x` + `y${b}`;"), 0);

const current = inventory();
assert.deepEqual(compare(current, baseline), [], "screen modules gained split literals");
assert.equal(compare({ "new.js": { class: "screen", sites: 1 } }, baseline).length, 1);
assert.equal(compare({ "document_render.js": { class: "print/issued", sites: 9999 } }, baseline).length, 0);
const stale = Object.entries(baseline).filter(([file, { sites }]) => (current[file]?.sites || 0) < sites);
assert.deepEqual(stale, [], "lower tools/markup-baseline.json: a file has fewer split literals than recorded");
console.log(
  "PASS split-literal ratchet",
  Object.values(current)
    .filter((x) => x.class === "screen")
    .reduce((a, x) => a + x.sites, 0),
  "screen sites",
);
