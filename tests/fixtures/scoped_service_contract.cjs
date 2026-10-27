/* Inspect explicit composition without executing it or reading a service getter. */
const assert = require("node:assert/strict");
const { serviceComposition } = require("./deferred_service_syntax.cjs");
function assertScopedServices(owner, composition, label) {
  const leaves = [],
    used = new Set();
  function inspect(object, prefix = []) {
    object = serviceComposition(object);
    assert.equal(object.type, "ObjectExpression", label + ": explicit service object");
    assert.ok(object.properties.length <= 25, label + ": each interface has at most 25 fields");
    for (const property of object.properties) {
      assert.equal(property.type, "Property", label + ": no spread registry");
      assert.equal(property.computed, false);
      const key = property.key.name,
        path = [...prefix, key];
      if (
        property.value.type === "ObjectExpression" ||
        (property.value.type === "CallExpression" && property.value.callee.name === "deferredServices")
      ) {
        assert.equal(property.kind, "init");
        inspect(property.value, path);
      } else {
        leaves.push(path.join("."));
        if (property.kind === "get") {
          assert.equal(property.value.body.body.length, 1);
          assert.equal(property.value.body.body[0].type, "ReturnStatement");
          assert.equal(property.value.body.body[0].argument.name, key);
        } else {
          assert.equal(property.value.type, "ArrowFunctionExpression", "dependencies stay lazy");
          assert.equal(property.value.body.type, "CallExpression");
          assert.equal(property.value.body.callee.name, key);
        }
      }
    }
  }
  inspect(composition);
  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "MemberExpression") {
      const segments = [];
      let root = node;
      while (root.type === "MemberExpression") {
        segments.unshift(root.computed ? null : root.property.name);
        root = root.object;
      }
      if (root.name === "services") {
        const path = segments.join(".");
        const leaf = leaves.find((key) => path === key || path.startsWith(key + "."));
        if (leaf) used.add(leaf);
        else {
          assert.ok(!segments.includes(null), label + ": statically named service access");
          assert.ok(
            leaves.some((key) => key.startsWith(path + ".")),
            label + ": undeclared service " + path,
          );
        }
      }
    }
    Object.values(node).forEach(walk);
  }
  walk(owner);
  assert.deepEqual(new Set(leaves), used, label + ": exactly the required scoped interface");
  return leaves;
}
module.exports = { assertScopedServices };
