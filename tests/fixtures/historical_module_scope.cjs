/* Frozen functions retain explicit original bindings as production imports narrow.
   This is test composition only; reference bytes and assertions remain unchanged. */
const acorn = require("acorn");
const imports = { WriterState: "./state.js", esc: "./presentation_format.js" };
function withHistoricalBindings(source, names = ["WriterState"]) {
  const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" });
  const bound = new Set(
    ast.body.filter((node) => node.type === "ImportDeclaration").flatMap((node) => node.specifiers.map((specifier) => specifier.local.name)),
  );
  const missing = names.filter((name) => !bound.has(name));
  const prefix = missing
    .map((name) => {
      if (!Object.hasOwn(imports, name)) throw new Error("Unknown historical binding: " + name);
      return "import {" + name + "} from " + JSON.stringify(imports[name]) + ";\n";
    })
    .join("");
  return prefix + source;
}
module.exports = { withHistoricalBindings };
