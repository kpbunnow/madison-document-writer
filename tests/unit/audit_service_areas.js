/* Writer services stay grouped by area in app_core.js, in their original order, and cross-area coupling only shrinks. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { serviceAreas } = require("../../tools/service_areas.cjs");
const root = path.resolve(__dirname, "../.."),
  baselinePath = path.join(root, "tools/service-areas.json"),
  baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")),
  current = serviceAreas();

assert.deepEqual(current.headers, baseline.areas, "service area sections keep their recorded order; a new area needs review");
const unplaced = current.owners.filter((o) => !o.area).map((o) => o.owner);
assert.deepEqual(unplaced, [], "every service owner sits inside a service area section");
// Owners of one area are contiguous: construction order is the original order, grouped by area.
const sequence = current.owners.map((o) => o.area).filter((area, i, all) => i === 0 || all[i - 1] !== area);
assert.deepEqual(sequence, baseline.areas, "each area's owners are contiguous and appear in area order");

const grown = [],
  improved = [];
for (const [pair, count] of Object.entries(current.coupling)) {
  const recorded = baseline.coupling[pair] ?? 0;
  if (count > recorded) grown.push(pair + ": " + recorded + " -> " + count);
}
for (const [pair, recorded] of Object.entries(baseline.coupling)) {
  const count = current.coupling[pair] ?? 0;
  if (count < recorded) improved.push(pair + ": " + recorded + " -> " + count);
}
assert.deepEqual(grown, [], "cross-area service coupling grew; depend on an owner in the same area or app_base.js, or review the area map");
assert.deepEqual(improved, [], "cross-area coupling improved; lower tools/service-areas.json to the measured values");
const total = Object.values(current.coupling).reduce((a, b) => a + b, 0);
console.log("PASS service areas: " + baseline.areas.length + " areas, " + current.owners.length + " owners, " + total + " cross-area references");
