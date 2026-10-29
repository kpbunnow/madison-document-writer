/* Frozen-original comparisons replace one function with its retained original. After a factory's pure functions moved
   to module level (`<prefix><Name>(services, ...)`), the retained original, which calls its siblings as closure
   functions, runs inside a wrapper that rebuilds those sibling closures from the module-level functions. */
const acorn = require("acorn");

/* `const sibling = (...args) => <prefix>Sibling(services, ...args);` for each moved function the reference calls. */
function bridgesFor(source, prefix, reference, except = "") {
  const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" });
  return ast.body
    .filter(
      (n) =>
        n.type === "FunctionDeclaration" && n.id.name.startsWith(prefix) && n.id.name !== except && /^[A-Z]/.test(n.id.name.slice(prefix.length)),
    )
    .map((n) => ({ lifted: n.id.name, name: n.id.name[prefix.length].toLowerCase() + n.id.name.slice(prefix.length + 1) }))
    .filter((s) => new RegExp("(?<![\\w$.])" + s.name + "(?![\\w$])").test(reference))
    .map((s) => `const ${s.name} = (...args) => ${s.lifted}(services, ...args);`)
    .join("\n");
}

function liftedSplice(source, prefix, name, reference) {
  const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" });
  const target = prefix + name[0].toUpperCase() + name.slice(1);
  const fn = ast.body.find((n) => n.type === "FunctionDeclaration" && n.id.name === target);
  if (!fn) throw new Error("no module-level function " + target);
  const bridges = bridgesFor(source, prefix, reference, target);
  const wrapper = `function ${target}(services, ...args) {\n${bridges}\n${reference}\nreturn ${name}(...args);\n}`;
  return source.slice(0, fn.start) + wrapper + source.slice(fn.end);
}
module.exports = { liftedSplice, bridgesFor };
