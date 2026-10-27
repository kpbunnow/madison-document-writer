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
  };
  walk(acorn.parse(source, { ecmaVersion: 2022, sourceType: "script", allowReturnOutsideFunction: true }), (node) => {
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
      const hookBindings = hook.filter(({ binding }) => new RegExp("\\b" + binding + "\\b").test(source)).map(({ key }) => key);
      return { file: path.relative(ROOT, file).split(path.sep).join("/"), ...record, hookBindings };
    });
  const legacy = Object.fromEntries(
    records
      .filter((r) => r.bundleRead && (r.evalCalls || r.functionConstructors || r.vmEvaluations))
      .map((r) => [r.file, r.evalCalls + r.functionConstructors + r.vmEvaluations]),
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
module.exports = { classify, inventory };
