/* Writer service areas: which area owns each app_core owner, and how often one area's owners reach into another.
   Read-only syntax inspection; nothing is executed. Used by tests/unit/audit_service_areas.js. */
const fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn");
const ROOT = path.resolve(__dirname, "..");
const CORE = path.join(ROOT, "app/modules/app_core.js");
const HEADER = /^\/\* =+ Service area: (.+?) =+ \*\/$/;

function boundNames(pattern, out = []) {
  if (!pattern) return out;
  if (pattern.type === "Identifier") out.push(pattern.name);
  else if (pattern.type === "ObjectPattern") pattern.properties.forEach((p) => boundNames(p.value || p.argument, out));
  else if (pattern.type === "ArrayPattern") pattern.elements.forEach((e) => boundNames(e, out));
  return out;
}

// An owner is a top-level construction: `name = createX(...)`/`initX(...)`, or a bare `createX(...)` statement.
function ownerOf(node) {
  const declaration = node.declaration || node;
  if (declaration.type === "VariableDeclaration" && declaration.declarations.length === 1) {
    const d = declaration.declarations[0];
    if (d.id.type === "Identifier" && d.init?.type === "CallExpression" && /^(create|init)[A-Z]/.test(d.init.callee.name || "")) return d.id.name;
  }
  if (declaration.type === "ExpressionStatement" && declaration.expression.type === "CallExpression") {
    const name = declaration.expression.callee.name || "";
    if (/^create[A-Z]/.test(name)) return name;
  }
  return null;
}

// Lazy dependencies: `() => name` resolvers and `get name() { return name; }` forwarders.
function lazyReferences(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((n) => lazyReferences(n, out));
    return out;
  }
  if (node.type === "ArrowFunctionExpression" && node.params.length === 0 && node.body.type === "Identifier") out.push(node.body.name);
  if (node.type === "Property" && node.kind === "get" && node.value.body.body.length === 1) {
    const statement = node.value.body.body[0];
    if (statement.type === "ReturnStatement" && statement.argument?.type === "Identifier") out.push(statement.argument.name);
  }
  for (const key of Object.keys(node)) if (key !== "loc") lazyReferences(node[key], out);
  return out;
}

function serviceAreas(source = fs.readFileSync(CORE, "utf8")) {
  const comments = [];
  const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module", onComment: comments });
  const headers = comments
    .filter((c) => c.type === "Block" && HEADER.test("/*" + c.value + "*/"))
    .map((c) => ({ start: c.start, area: HEADER.exec("/*" + c.value + "*/")[1] }));
  const areaAt = (position) => headers.filter((h) => h.start < position).at(-1)?.area || null;
  const owners = [],
    nameArea = {},
    baseNames = new Set();
  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      if (node.source.value === "./app_base.js") node.specifiers.forEach((s) => baseNames.add(s.local.name));
      continue;
    }
    const declaration = node.declaration || node,
      owner = ownerOf(node),
      area = areaAt(node.start);
    if (owner) owners.push({ owner, area, node });
    if (declaration.type === "VariableDeclaration")
      for (const d of declaration.declarations) for (const name of boundNames(d.id)) nameArea[name] = area;
    if (declaration.type === "FunctionDeclaration") nameArea[declaration.id.name] = area;
  }
  const coupling = {};
  for (const { area, node } of owners)
    for (const name of lazyReferences(node)) {
      const target = baseNames.has(name) ? "base" : nameArea[name];
      if (!target || target === area) continue; // module imports and same-area references are not coupling
      const key = area + " -> " + target;
      coupling[key] = (coupling[key] || 0) + 1;
    }
  return { headers: headers.map((h) => h.area), owners: owners.map(({ owner, area }) => ({ owner, area })), coupling };
}

module.exports = { serviceAreas };
if (require.main === module) console.log(JSON.stringify(serviceAreas(), null, 2));
