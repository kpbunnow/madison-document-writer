/* Lexical tokens only: comments/spacing excluded, identifiers and literal spellings retained. No semantic claims. */
const acorn = require("acorn");
function tokens(source) {
  return [...acorn.tokenizer(source, { ecmaVersion: "latest", sourceType: "module", locations: true })]
    .filter((t) => t.type.label !== "eof")
    .map((t) => [t.type.label + ":" + source.slice(t.start, t.end), t.loc.start.line, t.loc.end.line]);
}
if (require.main === module) {
  const fs = require("node:fs"),
    files = JSON.parse(fs.readFileSync(0, "utf8"));
  const rows = files.map((file) => [file, tokens(fs.readFileSync(file, "utf8"))]);
  process.stdout.write(JSON.stringify(Object.fromEntries(rows)));
}
module.exports = { tokens };
