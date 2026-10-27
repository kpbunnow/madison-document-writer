/* Retain bounded ownership after the state and service-interface migrations. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn");
const { serviceInterfaces, sourceInterfaces, compositionCensus } = require("../../tools/service_interfaces.cjs");
const { moduleGraph } = require("../../tools/module_graph.cjs");
const directory = path.resolve(__dirname, "../../app/modules");
const boundaries = ["workspace", "editor", "startup", "catalog", "recovery", "imports"].map((name) => name + "_state.js");
const allowed = new Set(["app_core.js", "reports_core.js", "reports_screens.js", "reports_services.js", "reports_view_contexts.js", ...boundaries]);
const graph = moduleGraph(directory),
  importers = Object.keys(graph.imports).filter((name) => graph.imports[name].includes("./state.js"));
assert.deepEqual(new Set(importers), allowed, "new root-state coupling requires architectural review");
assert.deepEqual(graph.cycles, []);
const fields = new Set();
for (const name of boundaries) {
  const syntax = acorn.parse(fs.readFileSync(path.join(directory, name), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
  const declaration = syntax.body.find((node) => node.type === "ExportNamedDeclaration").declaration.declarations[0];
  assert.equal(declaration.init.callee.object.name, "Object");
  assert.equal(declaration.init.callee.property.name, "freeze");
  const properties = declaration.init.arguments[0].properties;
  const reads = properties.filter((property) => property.kind === "get"),
    writes = properties.filter((property) => property.kind === "set");
  assert.equal(properties.length, reads.length + writes.length);
  assert.ok(reads.length <= 25);
  assert.deepEqual(new Set(reads.map((property) => property.key.name)), new Set(writes.map((property) => property.key.name)));
  for (const property of reads) {
    assert.equal(fields.has(property.key.name), false, "state fields have one boundary owner");
    fields.add(property.key.name);
    const statement = property.value.body.body;
    assert.equal(statement.length, 1);
    assert.equal(statement[0].argument.object.name, "WriterState");
    assert.equal(statement[0].argument.property.name, property.key.name);
  }
}
assert.equal(fields.size, 70, "review any change to the existing root-state surface");
const census = compositionCensus(fs.readFileSync(path.join(directory, "app_core.js"), "utf8"));
assert.ok(census.forwarders <= 19, "new transparent forwarding boilerplate must use declared composition");
assert.ok(census.getters <= 8, "retain only the reviewed custom getter compositions");
assert.deepEqual(
  compositionCensus("const old={get current(){return current;},call:(...args)=>call(...args)};createOwner(deferredServices({a:()=>a}));"),
  { getters: 1, forwarders: 1, declarations: 1, resolvers: 1 },
);
assert.equal(compositionCensus("const native=(...args)=>window.scrollTo(...args);const custom=(...args)=>call(...args, true);").forwarders, 0);
const interfaces = serviceInterfaces(directory);
assert.ok(interfaces.length > 100, "inventory must include Writer and Reports composition");
for (const row of interfaces) {
  assert.ok(row.fields <= 25, row.scope + ": " + row.fields);
  assert.deepEqual(row.opaque, [], row.scope + ": only statically declared fields");
}
assert.deepEqual(
  sourceInterfaces('createOwner(deferredServices({first:()=>first,current:()=>current},["current"]))', "fixture").map(({ fields }) => fields),
  [2],
);
const sample = sourceInterfaces("createOwner({ui:{first:()=>first},get current(){return current;}})", "fixture");
assert.deepEqual(
  sample.map(({ fields }) => fields),
  [2, 1],
);
assert.deepEqual(sourceInterfaces("initOwner({...wide})", "fixture")[0].opaque, ["SpreadElement"]);
assert.deepEqual(sourceInterfaces("initOwner({[key]:value})", "fixture")[0].opaque, ["Property"]);
console.log(
  JSON.stringify({
    passed: true,
    composition: census,
    stateImporters: importers.length,
    ownedStateFields: fields.size,
    interfaces: interfaces.length,
    largestInterface: Math.max(...interfaces.map((row) => row.fields)),
    cycles: graph.cycles.length,
  }),
);
