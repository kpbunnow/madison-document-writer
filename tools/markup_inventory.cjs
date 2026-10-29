/* Read-only inventory of split string literals (adjacent static pieces joined with +) in application modules,
   classified so screen markup can only shrink. Print/issued and approved-wording sites are listed, not ratcheted. */
const fs = require("fs"),
  path = require("path"),
  acorn = require("acorn");

const ROOT = path.resolve(__dirname, ".."),
  MODULES = path.join(ROOT, "app/modules");

/* Modules whose literals are not screen markup; everything else is screen. */
const CLASSES = {
  "print/issued": ["document_render.js", "browser_printing.js"],
  "approved wording": ["mailing_rules.js", "report_metadata.js", "report_workbook_definitions.js", "report_catalog.js"],
};

const isStatic = (n) => (n.type === "Literal" && typeof n.value === "string") || (n.type === "TemplateLiteral" && n.expressions.length === 0);

function flatten(node, out) {
  if (node?.type === "BinaryExpression" && node.operator === "+") {
    flatten(node.left, out);
    flatten(node.right, out);
  } else out.push(node);
  return out;
}

function splitSites(source) {
  let count = 0;
  (function visit(node, inChain) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((child) => visit(child, false));
    const plus = node.type === "BinaryExpression" && node.operator === "+";
    if (plus && !inChain) {
      const parts = flatten(node, []);
      for (let i = 1; i < parts.length; i++) if (isStatic(parts[i]) && isStatic(parts[i - 1])) count++;
    }
    for (const [key, value] of Object.entries(node))
      if (value && typeof value === "object") visit(value, plus && (key === "left" || key === "right"));
  })(acorn.parse(source, { sourceType: "module", ecmaVersion: 2022 }), false);
  return count;
}

function classify(file) {
  return Object.keys(CLASSES).find((name) => CLASSES[name].includes(file)) || "screen";
}

function inventory() {
  const files = {};
  for (const file of fs.readdirSync(MODULES).filter((name) => name.endsWith(".js"))) {
    const count = splitSites(fs.readFileSync(path.join(MODULES, file), "utf8"));
    if (count) files[file] = { class: classify(file), sites: count };
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

/* Screen modules may not gain split literals; a file may only fall. */
function compare(current, baseline) {
  const failures = [];
  for (const [file, { class: kind, sites }] of Object.entries(current)) {
    if (kind !== "screen") continue;
    const allowed = baseline[file]?.sites || 0;
    if (sites > allowed) failures.push(`${file}: ${sites} split literals exceed the recorded ${allowed}; use a template or one literal`);
  }
  return failures;
}

if (require.main === module) {
  const current = inventory();
  if (process.argv[2] === "--write") fs.writeFileSync(path.join(ROOT, "tools/markup-baseline.json"), JSON.stringify(current, null, 2) + "\n");
  else console.log(JSON.stringify(current, null, 2));
}
module.exports = { inventory, compare, splitSites };
