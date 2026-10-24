/* Static browser dependency inventory. Never evaluates application code or generated data. */
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

function moduleGraph(directory) {
  const files = fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".js"))
    .sort();
  const nodes = new Set(files);
  const imports = {};
  const edges = {};
  for (const name of files) {
    const tree = acorn.parse(fs.readFileSync(path.join(directory, name), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
    const dependencies = new Set();
    function visit(node) {
      if (!node || typeof node !== "object") return;
      if ((node.type === "ImportDeclaration" || node.type === "ExportAllDeclaration" || node.type === "ExportNamedDeclaration") && node.source)
        dependencies.add(node.source.value);
      if (node.type === "ImportExpression")
        dependencies.add(node.source.type === "Literal" && typeof node.source.value === "string" ? node.source.value : "<dynamic>");
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") visit(value);
      }
    }
    visit(tree);
    imports[name] = [...dependencies].sort();
    edges[name] = imports[name]
      .filter((value) => value.startsWith("."))
      .map((value) => path.resolve(directory, value))
      .filter((target) => path.dirname(target) === path.resolve(directory) && nodes.has(path.basename(target)))
      .map((target) => path.basename(target));
  }
  const indices = new Map(),
    low = new Map(),
    stack = [],
    active = new Set(),
    components = [];
  let next = 0;
  function connect(name) {
    indices.set(name, next);
    low.set(name, next++);
    stack.push(name);
    active.add(name);
    for (const target of edges[name]) {
      if (!indices.has(target)) {
        connect(target);
        low.set(name, Math.min(low.get(name), low.get(target)));
      } else if (active.has(target)) low.set(name, Math.min(low.get(name), indices.get(target)));
    }
    if (low.get(name) !== indices.get(name)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      active.delete(member);
      component.push(member);
    } while (member !== name);
    components.push(component.sort());
  }
  files.forEach((name) => {
    if (!indices.has(name)) connect(name);
  });
  const cycles = components.filter((c) => c.length > 1 || edges[c[0]].includes(c[0])).sort((a, b) => a[0].localeCompare(b[0]));
  return { imports, edges, cycles };
}
module.exports = { moduleGraph };
if (require.main === module) console.log(JSON.stringify(moduleGraph(path.resolve(__dirname, "../app/modules")), null, 2));
