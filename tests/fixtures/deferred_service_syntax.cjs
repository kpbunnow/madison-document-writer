/* Canonicalize the approved lazy declaration into the literal descriptor shape it generates.
   Only zero-argument identifier resolvers and explicit value-name lists are accepted. */
const assert = require("node:assert/strict");
function serviceComposition(node) {
  if (node.type === "ObjectExpression") return node;
  assert.equal(node.type, "CallExpression");
  assert.equal(node.callee.name, "deferredServices", "only the independently tested lazy adapter is allowed");
  assert.ok(node.arguments.length >= 1 && node.arguments.length <= 2);
  const [bindings, values] = node.arguments;
  assert.equal(bindings.type, "ObjectExpression");
  if (values) assert.equal(values.type, "ArrayExpression");
  const valueKeys = (values?.elements || []).map((element) => {
    assert.equal(element.type, "Literal");
    assert.equal(typeof element.value, "string");
    return element.value;
  });
  assert.equal(new Set(valueKeys).size, valueKeys.length);
  const keys = new Set();
  const properties = bindings.properties.map((property) => {
    assert.equal(property.type, "Property", "no spread registry");
    assert.equal(property.kind, "init");
    assert.equal(property.computed, false);
    assert.equal(typeof property.key.name, "string");
    assert.notEqual(property.key.name, "__proto__", "resolver declarations must use own data properties");
    assert.equal(keys.has(property.key.name), false);
    keys.add(property.key.name);
    assert.equal(property.value.type, "ArrowFunctionExpression");
    assert.equal(property.value.async, false);
    assert.equal(property.value.params.length, 0);
    assert.equal(property.value.body.type, "Identifier", "resolver must defer a named binding");
    const getter = valueKeys.includes(property.key.name),
      target = property.value.body;
    return {
      ...property,
      kind: getter ? "get" : "init",
      value: getter
        ? { type: "FunctionExpression", body: { type: "BlockStatement", body: [{ type: "ReturnStatement", argument: target }] } }
        : { type: "ArrowFunctionExpression", body: { type: "CallExpression", callee: target } },
    };
  });
  for (const key of valueKeys) assert.ok(keys.has(key), "value must name a declared binding");
  return { type: "ObjectExpression", properties };
}
module.exports = { serviceComposition };
