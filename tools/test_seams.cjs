/* Read-only inventory: whole-application evaluation is distinct from isolated owner construction. */
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");
const ROOT = path.resolve(__dirname, "..");
function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === "object") walk(value, visit);
  }
}
function classify(source) {
  const result = {
    bundleRead: /(?:built_bundle|reports_bundle)\.cjs|\bbundleSource\s*\(/.test(source),
    evalCalls: 0,
    functionConstructors: 0,
    browserEvaluations: 0,
    vmEvaluations: 0,
    harnessCalls: 0,
    requires: [],
  };
  walk(acorn.parse(source, { ecmaVersion: 2022, sourceType: "script", allowReturnOutsideFunction: true }), (node) => {
    const isRequire = node.type === "CallExpression" && node.callee.name === "require" && typeof node.arguments[0]?.value === "string";
    if (isRequire && node.arguments[0].value.startsWith(".")) result.requires.push(node.arguments[0].value);
    if (
      node.type === "CallExpression" &&
      node.callee.type === "CallExpression" &&
      node.callee.callee.name === "require" &&
      /(?:^|\/)bundle_test\.cjs$/.test(node.callee.arguments[0]?.value || "")
    )
      result.harnessCalls++;
    if (
      node.type === "CallExpression" &&
      ((node.callee.type === "Identifier" && node.callee.name === "eval") ||
        (node.callee.type === "MemberExpression" && node.callee.property.name === "eval"))
    )
      result.evalCalls++;
    if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      ["runInContext", "runInNewContext", "runInThisContext"].includes(node.callee.property.name)
    )
      result.vmEvaluations++;
    if (["CallExpression", "NewExpression"].includes(node.type) && node.callee.type === "Identifier" && node.callee.name === "Function")
      result.functionConstructors++;
    if (node.type === "CallExpression" && node.callee.type === "MemberExpression" && node.callee.property.name === "evaluate")
      result.browserEvaluations++;
  });
  return result;
}
function hookCandidates(source, bindings) {
  const values = [source],
    memo = new WeakMap();
  function value(node) {
    if (memo.has(node)) return memo.get(node);
    let result = null;
    if (node.type === "Literal" && typeof node.value === "string") result = node.value;
    else if (node.type === "BinaryExpression" && node.operator === "+") {
      const left = value(node.left),
        right = value(node.right);
      if (left !== null && right !== null) result = left + right;
    } else if (node.type === "TemplateLiteral" && !node.expressions.length) result = node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
    else if (
      node.type === "TaggedTemplateExpression" &&
      node.tag.object?.name === "String" &&
      node.tag.property?.name === "raw" &&
      !node.quasi.expressions.length
    )
      result = node.quasi.quasis[0].value.raw;
    memo.set(node, result);
    return result;
  }
  walk(acorn.parse(source, { ecmaVersion: 2022, sourceType: "script", allowReturnOutsideFunction: true }), (node) => {
    const folded = value(node);
    if (folded !== null) values.push(folded);
  });
  return bindings.filter((binding) => values.some((text) => new RegExp("\\b" + binding + "\\b").test(text)));
}
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "reference" ? [] : files(full);
    return /\.(?:js|cjs)$/.test(entry.name) ? [full] : [];
  });
}
function inventory() {
  const core = acorn.parse(fs.readFileSync(path.join(ROOT, "app/modules/app_core.js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
  let hook = [];
  walk(core, (node) => {
    if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" && node.left.property.name === "__DW_TEST_REFERENCES")
      hook = node.right.properties.map((property) => ({ key: property.key.name, binding: property.value.name }));
  });
  const records = files(path.join(ROOT, "tests"))
    .sort()
    .map((file) => {
      const source = fs.readFileSync(file, "utf8"),
        record = classify(source);
      const candidates = new Set(
        hookCandidates(
          source,
          hook.map(({ binding }) => binding),
        ),
      );
      const hookBindings = hook.filter(({ binding }) => candidates.has(binding)).map(({ key }) => key);
      return { file: path.relative(ROOT, file).split(path.sep).join("/"), ...record, hookBindings };
    });
  const byFile = new Map(records.map((record) => [record.file, record]));
  function inheritedEvaluation(record, seen = new Set()) {
    if (seen.has(record.file)) return false;
    seen.add(record.file);
    if (record.bundleRead && (record.evalCalls || record.functionConstructors || record.vmEvaluations)) return true;
    return record.requires.some((request) => {
      const relative = path
        .relative(ROOT, path.resolve(ROOT, path.dirname(record.file), request))
        .split(path.sep)
        .join("/");
      const dependency = byFile.get(relative) || byFile.get(relative + ".js") || byFile.get(relative + ".cjs");
      return dependency && inheritedEvaluation(dependency, seen);
    });
  }
  const legacy = Object.fromEntries(
    records
      .filter((record) => inheritedEvaluation(record))
      .map((record) => [record.file, Math.max(1, record.evalCalls + record.functionConstructors + record.vmEvaluations + record.harnessCalls)]),
  );
  return {
    hook,
    counts: {
      files: records.length,
      bundleEvaluators: Object.keys(legacy).length,
      isolatedEvaluators: records.filter((r) => !r.bundleRead && (r.functionConstructors || r.vmEvaluations)).length,
      browserFiles: records.filter((r) => r.browserEvaluations).length,
      hookFields: hook.length,
    },
    legacy,
    records,
  };
}
if (require.main === module) console.log(JSON.stringify(inventory(), null, 2));
module.exports = { classify, inventory, hookCandidates };
