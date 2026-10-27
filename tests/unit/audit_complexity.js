const assert = require("node:assert/strict");
const { compare, report } = require("../../tools/complexity_report.cjs");
const baseline = require("../../tools/complexity-baseline.json");
assert.deepEqual(compare({ a: 21 }, { a: 21 }), []);
assert.equal(compare({ a: 22 }, { a: 21 }).length, 1, "existing debt cannot increase");
assert.equal(compare({ a: 21, b: 21 }, { a: 21 }).length, 1, "new debt is refused");
assert.equal(compare({ a: 20 }, { a: 21 }).length, 1, "improvements must lower the baseline");
assert.equal(compare({}, { a: 21 }).length, 1, "removed debt must leave the baseline");
assert.deepEqual(compare({}, {}), []);
report()
  .then(({ violations, counts }) => {
    assert.deepEqual(compare(violations, baseline.violations), []);
    console.log("PASS complexity ratchet", counts);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
