/* Production wiring of the Reports clock: the three Reports service objects in reports_core.js supply the day through
   a currentDay accessor whose function reads the clock when called; none supplies the load-time constant, which only seeds
   the first view's default filters. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  acorn = require("acorn");
const source = fs.readFileSync("app/modules/reports_core.js", "utf8");
const forwarders = [];
let todayGetters = 0;
(function walk(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach(walk);
  if (node.type === "Property" && node.key?.name === "TODAY" && node.kind === "get") todayGetters++;
  if (node.type === "Property" && node.kind === "get" && node.key?.name === "currentDay") forwarders.push(node);
  for (const value of Object.values(node)) walk(value);
})(acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }));
assert.equal(todayGetters, 0, "no service reads the page-load day");
assert.equal(forwarders.length, 3, "the three Reports service objects that supply the day");
for (const property of forwarders) {
  const statement = property.value.body.body[0];
  assert.equal(statement.type, "ReturnStatement");
  assert.equal(statement.argument.name, "currentDay", "services hand out currentDay(), which reads the clock when called");
}
assert.match(source, /export const currentDay = \(\) => iso\(new Date\(\)\);/);
for (const file of ["report_navigation", "report_catalog", "reports_services"]) {
  const text = fs.readFileSync(`app/modules/${file}.js`, "utf8");
  assert.doesNotMatch(text, /services\.TODAY/, file + " asks for the day, not the load-time constant");
}
console.log("PASS Reports services read the current day when asked");
