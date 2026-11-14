/* Workflow locality census (plan Phase 3; diagnostic only, never gate or release evidence).
   Usage: node tools/workflow_locality.cjs [config.json] > census.json

   For each configured workflow, every listed function is measured by its lexical identity (the same owner names as
   tools/complexity_report.cjs, e.g. `createX#1/inner#1`). Nested functions are part of their owner unless they are
   listed separately. Within each function this counts, syntactically:
   - peers: distinct semantic dependencies reached through an identifier named `services`: `services.a` or, for a
     grouped service, `services.a.b` (counted as a.b, so grouping cannot hide the operations used);
   - state: distinct members read or written on bindings imported from the live-state modules (*_state.js, state.js),
     with writes counted separately;
   - queries: distinct live workspace queries called (bindings imported from writer_queries.js; some initialize state);
   - dom: distinct browser globals referenced (document, window, navigator, localStorage, sessionStorage, location).
   "Mutable peer access" is peers + state members + queries. Calculation phases are the functions whose role is
   "calculation"; workflow totals unite every role, so a fact provider or coordinator cannot hide a dependency. */
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");
const ROOT = path.resolve(__dirname, "..");
const DOM = new Set(["document", "window", "navigator", "localStorage", "sessionStorage", "location"]);
const isStateModule = (source) => /(^|\/)(\w+_)?state\.js$/.test(source);
const isQueryModule = (source) => /(^|\/)writer_queries\.js$/.test(source);

const isFunction = (node) => /^(FunctionDeclaration|FunctionExpression|ArrowFunctionExpression)$/.test(node?.type);

function functionName(node, parent) {
  if (node.id?.name) return node.id.name;
  if (parent?.type === "VariableDeclarator") return parent.id.name;
  if (parent?.type === "Property" || parent?.type === "MethodDefinition") return parent.key.name || parent.key.value;
  return "anonymous";
}

// Every function with its lexical identity, in source order (matches the complexity ratchet's owner identities).
function functionIdentities(ast) {
  const found = [],
    counts = new Map();
  function visit(node, parent, stack) {
    if (!node || typeof node.type !== "string") return;
    let next = stack;
    if (isFunction(node)) {
      const name = functionName(node, parent),
        prefix = [...stack, name].join("/"),
        ordinal = (counts.get(prefix) || 0) + 1;
      counts.set(prefix, ordinal);
      next = [...stack, `${name}#${ordinal}`];
      found.push({ identity: next.join("/"), node });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === "loc") continue;
      if (Array.isArray(value)) value.forEach((child) => visit(child, node, next));
      else if (value && typeof value.type === "string") visit(value, node, next);
    }
  }
  visit(ast, null, []);
  return found;
}

function importKinds(ast) {
  const state = new Set(),
    queries = new Set();
  for (const node of ast.body) {
    if (node.type !== "ImportDeclaration") continue;
    const names = node.specifiers.map((s) => s.local.name);
    if (isStateModule(node.source.value)) names.forEach((n) => state.add(n));
    if (isQueryModule(node.source.value)) names.forEach((n) => queries.add(n));
  }
  return { state, queries };
}

const memberName = (node) => (node.computed ? (node.property.type === "Literal" ? String(node.property.value) : "[computed]") : node.property.name);

function measureFunction(fn, kinds, excluded) {
  const peers = new Set(),
    state = new Set(),
    writes = new Set(),
    queries = new Set(),
    dom = new Set();
  function stateAccess(node, parent, grand) {
    // `workspace.DOCS` names DOCS; `editor.state.docId` names docId through editorState's `.state` holder.
    const direct = memberName(node);
    if (direct !== "state") return { member: direct, target: node, above: parent };
    if (parent?.type === "MemberExpression" && parent.object === node) return { member: memberName(parent), target: parent, above: grand };
    return null;
  }
  function visit(node, parent, grand) {
    if (!node || typeof node.type !== "string") return;
    if (node !== fn && excluded.has(node)) return;
    if (node.type === "MemberExpression" && node.object.type === "Identifier") {
      const base = node.object.name;
      // `services.inspection.validISO` is the semantic dependency inspection.validISO, not just its group.
      if (base === "services")
        peers.add(
          parent?.type === "MemberExpression" && parent.object === node && !parent.computed
            ? memberName(node) + "." + memberName(parent)
            : memberName(node),
        );
      const access = kinds.state.has(base) && stateAccess(node, parent, grand);
      if (access) {
        state.add(base + "." + access.member);
        if (isWriteTarget(access.target, access.above)) writes.add(base + "." + access.member);
      }
    }
    if (node.type === "CallExpression" && node.callee.type === "Identifier" && kinds.queries.has(node.callee.name)) queries.add(node.callee.name);
    if (node.type === "Identifier" && DOM.has(node.name) && !isPropertyName(node, parent)) dom.add(node.name);
    for (const [key, value] of Object.entries(node)) {
      if (key === "loc") continue;
      if (Array.isArray(value)) value.forEach((child) => visit(child, node, parent));
      else if (value && typeof value.type === "string") visit(value, node, parent);
    }
  }
  visit(fn, null, null);
  return { peers: [...peers].sort(), state: [...state].sort(), writes: [...writes].sort(), queries: [...queries].sort(), dom: [...dom].sort() };
}

// `x.document` and `{ document: 1 }` name properties, not the browser global.
function isPropertyName(node, parent) {
  if (parent?.type === "MemberExpression") return parent.property === node && !parent.computed;
  if (parent?.type === "Property") return parent.key === node && !parent.computed && !parent.shorthand;
  return false;
}

function isWriteTarget(target, parent) {
  if (!parent) return false;
  if (parent.type === "AssignmentExpression" && parent.left === target) return true;
  if (parent.type === "UpdateExpression" && parent.argument === target) return true;
  if (parent.type === "UnaryExpression" && parent.operator === "delete" && parent.argument === target) return true;
  return false;
}

const union = (rows, key) => [...new Set(rows.flatMap((r) => r[key]))].sort();

function summarize(rows) {
  const peers = union(rows, "peers"),
    state = union(rows, "state"),
    queries = union(rows, "queries");
  return {
    functions: rows.length,
    peers,
    state,
    writes: union(rows, "writes"),
    queries,
    dom: union(rows, "dom"),
    mutablePeerAccess: peers.length + state.length + queries.length,
  };
}

function measureWorkflow(workflow) {
  const source = fs.readFileSync(path.join(ROOT, workflow.file), "utf8");
  const ast = acorn.parse(source, { ecmaVersion: "latest", sourceType: "module" });
  const identities = functionIdentities(ast),
    kinds = importKinds(ast);
  const listed = workflow.functions.map((entry) => {
    const match = identities.find((f) => f.identity === entry.identity);
    if (!match) throw new Error(`${workflow.id}: no function ${entry.identity} in ${workflow.file}`);
    return { ...entry, node: match.node };
  });
  const excluded = new Set(listed.map((f) => f.node));
  const rows = listed.map((f) => ({ identity: f.identity, role: f.role, ...measureFunction(f.node, kinds, excluded) }));
  return {
    id: workflow.id,
    file: workflow.file,
    functions: rows,
    calculation: summarize(rows.filter((r) => r.role === "calculation")),
    total: summarize(rows),
  };
}

function census(config) {
  return { workflows: config.workflows.map(measureWorkflow) };
}

if (require.main === module) {
  const file = process.argv[2] || path.join(ROOT, "tools/workflow-locality.json");
  process.stdout.write(JSON.stringify(census(JSON.parse(fs.readFileSync(file, "utf8"))), null, 1) + "\n");
}
module.exports = { census, functionIdentities, measureFunction, importKinds };
