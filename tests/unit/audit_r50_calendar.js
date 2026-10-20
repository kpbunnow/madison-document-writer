/* Keep Chicago calendar semantics while avoiding repeated formatter construction. */
const assert = require("assert/strict");
const esbuild = require("esbuild");
const code = esbuild.buildSync({ entryPoints: ["app/assets/shared.js"], bundle: true, format: "cjs", write: false }).outputFiles[0].text;
const Original = Intl.DateTimeFormat;
let constructions = 0;
function Counted(...args) {
  constructions++;
  return new Original(...args);
}
const box = { exports: {} };
new Function("module", "exports", "Intl", code)(box, box.exports, { DateTimeFormat: Counted });
const baseline = new Original("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" });
for (let n = 0; n < 2400; n++) {
  const date = new Date(Date.UTC(2024, 0, 1) + n * 13 * 3600000);
  const parts = baseline.formatToParts(date);
  const value = (kind) => parts.find((p) => p.type === kind).value;
  assert.equal(box.exports.recordDay(date), value("year") + "-" + value("month") + "-" + value("day"));
}
assert.ok(constructions <= 1, "Chicago calendar formatter is constructed once per module");
console.log("PASS 2400 Chicago dates across DST and one formatter allocation");
