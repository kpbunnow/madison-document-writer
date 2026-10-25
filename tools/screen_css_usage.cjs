/* Resolve adjacent literal runs even in left-associated expressions with dynamic prefixes. */
const fs = require("fs"),
  path = require("path"),
  acorn = require("acorn");
function literalRuns(node) {
  if (node?.type === "BinaryExpression" && node.operator === "+") return [...literalRuns(node.left), ...literalRuns(node.right)];
  if (node?.type === "Literal" && typeof node.value === "string") return [node.value];
  if (node?.type === "TemplateLiteral")
    return node.quasis.flatMap((q, i) => (i < node.expressions.length ? [q.value.cooked, null] : [q.value.cooked]));
  return [null];
}
function classReferences(source, classes) {
  const found = new Set(),
    ast = acorn.parse(source, { sourceType: "module", ecmaVersion: 2022 });
  function visit(node) {
    if (!node || typeof node !== "object") return;
    const text = literalRuns(node)
      .map((part) => (part === null ? "\u0000" : part))
      .join("");
    for (const name of classes) if (new RegExp("(^|[^A-Za-z0-9_-])" + name + "([^A-Za-z0-9_-]|$)").test(text)) found.add(name);
    for (const child of Object.values(node))
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child === "object") visit(child);
  }
  visit(ast);
  return [...found];
}
function scanModules(directory, classes) {
  const consumers = Object.fromEntries(classes.map((name) => [name, []]));
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".js")))
    for (const name of classReferences(fs.readFileSync(path.join(directory, file), "utf8"), classes)) consumers[name].push(file);
  return consumers;
}
module.exports = { literalRuns, classReferences, scanModules };

/* Semantic contract of surviving rules, preserving cascade/group/declaration order. */
function styleContract(source, removedClasses, removeLegacySpin = false) {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM("<style></style>");
  const style = dom.window.document.querySelector("style");
  style.textContent = source;
  if (!style.sheet) throw new Error("Stylesheet did not parse");
  const declarations = (s) => Array.from({ length: s.length }, (_, i) => [s[i], s.getPropertyValue(s[i]), s.getPropertyPriority(s[i])]);
  function rules(list) {
    return [...list].flatMap((r) => {
      if (removeLegacySpin && r.name === "spin") return [];
      if (r.selectorText) {
        const selectors = r.selectorText
          .split(",")
          .map((s) => s.trim().replace(/\s+/g, " "))
          .filter((s) => !removedClasses.some((name) => new RegExp("\\." + name + "(?![A-Za-z0-9_-])").test(s)));
        return selectors.length ? [["style", selectors, declarations(r.style)]] : [];
      }
      if (r.cssRules) {
        const children = rules(r.cssRules);
        return children.length ? [[r.type, r.conditionText || r.media?.mediaText || r.name || "", children]] : [];
      }
      return [[r.type, r.keyText || "", r.style ? declarations(r.style) : r.cssText]];
    });
  }
  const value = JSON.stringify(rules(style.sheet.cssRules));
  dom.window.close();
  return value;
}
module.exports.styleContract = styleContract;
