/* Read-only field-width inventory of statically declared factory injection objects.
   Namespace internals and behavioral coupling are not inferred from this count. */
const fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn");
function objectInterfaces(node, label, out) {
  if (node.type === "CallExpression" && node.callee.name === "deferredServices") node = node.arguments[0];
  const opaque = node.properties.filter((p) => p.type !== "Property" || p.computed).map((p) => p.type);
  out.push({ scope: label, fields: node.properties.length, opaque });
  for (const property of node.properties) {
    if (
      property.type === "Property" &&
      (property.value.type === "ObjectExpression" || (property.value.type === "CallExpression" && property.value.callee.name === "deferredServices"))
    )
      objectInterfaces(property.value, label + "." + property.key.name, out);
  }
}
function sourceInterfaces(source, file) {
  const out = [],
    syntax = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" });
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (
      node.type === "CallExpression" &&
      /^(create|init)[A-Z]/.test(node.callee.name || "") &&
      (node.arguments[0]?.type === "ObjectExpression" || node.arguments[0]?.callee?.name === "deferredServices")
    )
      objectInterfaces(node.arguments[0], file + ":" + node.callee.name, out);
    Object.values(node).forEach(visit);
  }
  visit(syntax);
  return out;
}
function serviceInterfaces(directory) {
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".js"))
    .flatMap((name) => sourceInterfaces(fs.readFileSync(path.join(directory, name), "utf8"), name));
}
module.exports = { sourceInterfaces, serviceInterfaces };
if (require.main === module) console.log(JSON.stringify(serviceInterfaces(path.resolve(__dirname, "../app/modules")), null, 2));
