/* The composition guard rejects broad interfaces and eager or undeclared dependencies. */
const assert = require("node:assert/strict"),
  acorn = require("acorn");
const { assertScopedServices } = require("../fixtures/scoped_service_contract.cjs");
const parse = (source) => acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" });
function inspect(owner, wiring) {
  return assertScopedServices(parse(owner), parse("const scope = " + wiring).body[0].declarations[0].init, "synthetic");
}
assert.deepEqual(
  inspect(
    "services.ui.render(); services.record.policy.allowed();",
    "{ui:{render:(...args)=>render(...args)},record:{get policy(){return policy;}}}",
  ),
  ["ui.render", "record.policy"],
);
assert.throws(() => inspect("services.ui.render()", "{ui:{render:render}}"), /lazy/);
assert.throws(() => inspect("services.ui.render()", "{ui:{render:(...args)=>other(...args)}}"));
assert.throws(() => inspect("services.ui.render()", "{ui:{...allServices}}"), /registry/);
assert.throws(() => inspect("services.ui.render()", "{ui:{get render(){return render();}}}"));
assert.throws(() => inspect("services.ui[key]()", "{ui:{render:(...args)=>render(...args)}}"), /statically named/);
assert.throws(() => inspect("services.ui.missing()", "{ui:{render:(...args)=>render(...args)}}"), /undeclared/);
assert.throws(() => inspect("services.ui.render()", "{ui:{render:(...args)=>render(...args),unused:(...args)=>unused(...args)}}"), /exactly/);
assert.deepEqual(inspect("services.ui.policy[key]", "{ui:{get policy(){return policy;}}}"), ["ui.policy"]);
assert.throws(() => inspect("services[key].policy", "{ui:{get policy(){return policy;}}}"), /statically named/);
const broad = "{" + Array.from({ length: 26 }, (_, i) => "field" + i + ":(...args)=>field" + i + "(...args)").join(",") + "}";
assert.throws(() => inspect("", broad), /25/);
assert.throws(() => inspect("", "{ui:" + broad + "}"), /25/);
console.log("PASS scoped composition: exact dependencies, lazy leaves, named groups and per-interface width");
