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
function compositionCensus(source) {
  const counts = { getters: 0, forwarders: 0, declarations: 0, resolvers: 0 };
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === "Property" && node.kind === "get") counts.getters++;
    if (
      node.type === "ArrowFunctionExpression" &&
      !node.async &&
      node.params.length === 1 &&
      node.params[0].type === "RestElement" &&
      node.body.type === "CallExpression" &&
      node.body.callee.type === "Identifier" &&
      node.body.arguments.length === 1 &&
      node.body.arguments[0].type === "SpreadElement" &&
      node.body.arguments[0].argument.name === node.params[0].argument.name
    )
      counts.forwarders++;
    if (node.type === "CallExpression" && node.callee.name === "deferredServices" && node.arguments[0]?.type === "ObjectExpression") {
      counts.declarations++;
      counts.resolvers += node.arguments[0].properties.length;
    }
    Object.values(node).forEach(visit);
  }
  visit(acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" }));
  return counts;
}
module.exports = { sourceInterfaces, serviceInterfaces, compositionCensus };
if (require.main === module) console.log(JSON.stringify(serviceInterfaces(path.resolve(__dirname, "../app/modules")), null, 2));
