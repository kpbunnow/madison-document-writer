/* Production wiring of the Reports clock: every service getter named TODAY in reports_core.js reads the day when
   it is asked (currentDay()), not the day the page loaded; only the first view's defaults use the load-time constant. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  acorn = require("acorn");
const source = fs.readFileSync("app/modules/reports_core.js", "utf8");
const getters = [];
(function walk(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach(walk);
  if (node.type === "Property" && node.kind === "get" && node.key.name === "TODAY") getters.push(node);
  for (const value of Object.values(node)) walk(value);
})(acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }));
assert.equal(getters.length, 3, "the three Reports service objects that supply TODAY");
for (const getter of getters) {
  const statement = getter.value.body.body[0];
  assert.equal(statement.type, "ReturnStatement");
  assert.equal(statement.argument.type, "CallExpression");
  assert.equal(statement.argument.callee.name, "currentDay", "TODAY is read through currentDay() when asked");
}
assert.match(source, /export const currentDay = \(\) => iso\(new Date\(\)\);/);
console.log("PASS Reports services read the current day when asked");
