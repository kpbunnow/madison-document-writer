/* Frozen legacy functions keep their original workspace binding as production imports narrow.
   This is test composition only; references and assertions remain byte-for-byte unchanged. */
const acorn = require("acorn");
function withHistoricalState(source) {
  const ast = acorn.parse(source, { ecmaVersion: 2022, sourceType: "module" });
  const bound = ast.body.some(
    (node) => node.type === "ImportDeclaration" && node.specifiers.some((specifier) => specifier.local.name === "WriterState"),
  );
  return bound ? source : 'import {WriterState} from "./state.js";\n' + source;
}
module.exports = { withHistoricalState };
