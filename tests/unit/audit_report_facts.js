/* Source-body parity and direct fact checks retain historical filter/display behavior. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
function parse(s) {
  return acorn.parse(s, { ecmaVersion: 2022, sourceType: "module" });
}
function normalized(x) {
  if (Array.isArray(x)) return x.map(normalized);
  if (!x || typeof x !== "object") return x;
  return Object.fromEntries(
    Object.entries(x)
      .filter(([k]) => !["start", "end", "raw"].includes(k))
      .map(([k, v]) => [k, normalized(v)]),
  );
}
const current = parse(fs.readFileSync("app/modules/report_facts.js", "utf8")),
  original = parse(fs.readFileSync("tests/fixtures/report_facts_reference.txt", "utf8"));
const decls = (t) => t.body.flatMap((n) => (n.declaration || n).declarations || []);
const references = [
  ...decls(original),
  ...decls(parse(fs.readFileSync("tests/fixtures/report_lookup_facts_reference.txt", "utf8"))),
  ...decls(parse(fs.readFileSync("tests/fixtures/report_export_cell_reference.txt", "utf8"))),
];
const retained = references
  .filter((d) => d.id.name !== "areaLabel")
  .map((d) => {
    const value = structuredClone(d);
    if (value.id.name === "fmtDate") value.id.name = "formatReportDate";
    return value;
  });
assert.deepEqual(
  normalized(decls(current)),
  normalized(retained),
  "sixteen moved expressions remain unchanged apart from the explicit Reports formatter name",
);
const labelFactory = current.body.find((n) => n.declaration?.id?.name === "createReportAreaLabel").declaration;
const priorLabel = references.find((d) => d.id.name === "areaLabel").init;
function scopedLabel(node) {
  if (Array.isArray(node)) return node.map(scopedLabel);
  if (!node || typeof node !== "object") return node;
  if (node.type === "MemberExpression" && node.property.name === "F" && node.object?.object?.name === "ReportsState")
    return parse("readFilters();").body[0].expression;
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, scopedLabel(v)]));
}
assert.deepEqual(
  normalized(labelFactory.body.body[0].argument),
  normalized(scopedLabel(priorLabel)),
  "area label retains its exact expression through a scoped filter read",
);
assert.deepEqual(
  normalized(decls(parse(fs.readFileSync("app/modules/report_metadata.js", "utf8")))),
  normalized(decls(parse(fs.readFileSync("tests/fixtures/report_metadata_reference.txt", "utf8")))),
  "shared report definitions and workbook scope retain their exact expressions",
);
const open = current.body.find((n) => n.type === "FunctionDeclaration" && n.id.name === "reportCaseOpenAt");
function unscoped(x) {
  if (Array.isArray(x)) return x.map(unscoped);
  if (!x || typeof x !== "object") return x;
  if (x.type === "MemberExpression" && x.object.name === "history") return x.property;
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, unscoped(v)]));
}
assert.deepEqual(
  normalized(unscoped(open.body.body[0].argument)),
  normalized(parse("const original=" + fs.readFileSync("tests/fixtures/report_open_at_reference.txt", "utf8") + ";").body[0].declarations[0].init),
);
(async () => {
  const built = await esbuild.build({
      stdin: { contents: 'export * from "./report_facts.js";export {ReportsState} from "./state.js";', resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
    }),
    box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const api = box.exports;
  assert.deepEqual(api.ReportsState, {}, "facts do not initialize Reports");
  const areaLabel = api.createReportAreaLabel(() => api.ReportsState.S.F);
  assert.equal(api.createReportAreaLabel(() => assert.fail("empty area must not read filters"))(""), "Unlocated");
  api.ReportsState.S = { F: { areaType: "zip" } };
  assert.equal(areaLabel("53703"), "53703");
  api.ReportsState.S.F = { areaType: "district" };
  assert.equal(areaLabel("1"), "District 1");
  assert.equal(areaLabel(""), "Unlocated");
  for (const date of ["2024-02-29", "2026-01-01", "2026-12-31"]) {
    assert.equal(api.validISO(date), true);
    assert.equal(api.inPeriod(date, { from: date, to: date }), true);
  }
  for (const date of ["2026-02-29", "2026-13-01", "", "bad"]) {
    assert.equal(api.validISO(date), false);
    assert.equal(api.fmtDate(date), "—");
  }
  assert.equal(api.avg([]), null);
  assert.equal(api.avg([1, 2, 3]), 2);
  assert.equal(api.plural(2, "case"), "2 cases");
  console.log(
    "PASS independently loaded report facts: 17 unchanged expressions, metadata parity, original historical open predicate and live filter/date checks",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
