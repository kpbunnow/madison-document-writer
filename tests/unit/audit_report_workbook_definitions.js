/* Preserve every CRC entry, XML style byte, encoded scalar and Excel date from the core declarations. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  esbuild = require("esbuild");
const box = (source) => {
    const module = { exports: {} };
    new Function("module", "exports", esbuild.transformSync(source, { format: "cjs" }).code)(module, module.exports);
    return module.exports;
  },
  original = box(fs.readFileSync("tests/fixtures/report_workbook_definitions_reference.txt", "utf8")),
  actual = box(fs.readFileSync("app/modules/report_workbook_definitions.js", "utf8"));
assert.deepEqual(actual.CRC_T, original.CRC_T);
assert.equal(actual.STYLES, original.STYLES);
let count = 0;
for (const value of [null, undefined, 0, -1, NaN, true, false, "", 'a&<b>"', "\u0000\u0001\t\n\r\uFFFE\uFFFF", "é😀\u2028", "normal text"]) {
  assert.equal(actual.xesc(value), original.xesc(value));
  count++;
}
for (let year = 1900; year <= 2100; year++)
  for (let month = 1; month <= 12; month++)
    for (const day of [1, 28, 29, 30, 31]) {
      const value = [year, String(month).padStart(2, "0"), String(day).padStart(2, "0")].join("-");
      assert.equal(actual.excelDate(value), original.excelDate(value));
      count++;
    }
assert.equal(count, 12072);
console.log("PASS retained workbook definitions: CRC table, exact styles and " + count + " scalar/date comparisons");
