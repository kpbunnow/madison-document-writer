/* Diagnostic JavaScript coverage (plan Phase 1): a bundled module run through new Function, as the unit suites
   run Writer modules, is attributed to its source file through the inline source map; unexecuted statements and
   branch arms are reported, never counted as covered, and a file that never ran stays in the denominator. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const { decodeMappings, report } = require("../../tools/coverage_js_report.cjs");
const ROOT = path.resolve(__dirname, "../..");

// Source-map VLQ: "AAAA" is the zero segment; "AACA" advances the original line by one.
assert.deepEqual(decodeMappings("AAAA;AACA"), [
  [0, 0, 0, 0, 0],
  [1, 0, 0, 1, 0],
]);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dw-js-coverage-"));
try {
  fs.writeFileSync(
    path.join(dir, "mod.js"),
    [
      "export function pick(x) {",
      "  if (x > 0) {",
      '    return "pos";',
      "  } else {",
      '    return "neg";',
      "  }",
      "}",
      "export const both = (a, b) => a && b;",
      "export function never() {",
      "  return 1;",
      "}",
      "",
    ].join("\n"),
  );
  fs.writeFileSync(path.join(dir, "idle.js"), "export const idle = () => 2;\n");
  fs.writeFileSync(
    path.join(dir, "driver.cjs"),
    `const esbuild = require("esbuild");
esbuild.build({ stdin: { contents: 'export * from "./mod.js";', resolveDir: ${JSON.stringify(dir)} }, bundle: true, write: false, format: "cjs" }).then((b) => {
  const box = { exports: {} };
  new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
  box.exports.pick(1);
  box.exports.both(false, true);
});`,
  );
  const records = path.join(dir, "records");
  const run = spawnSync(process.execPath, ["--require", path.join(ROOT, "tools/coverage_js_preload.cjs"), path.join(dir, "driver.cjs")], {
    cwd: dir,
    env: { ...process.env, NODE_PATH: path.join(ROOT, "node_modules"), DW_JS_COVERAGE_DIR: records },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const result = report(records, dir, ["mod.js", "idle.js"]);
  assert.deepEqual(result["mod.js"], {
    statements: 5,
    coveredStatements: 3,
    branches: 3,
    coveredBranches: 1,
    executed: true,
    uncoveredLines: [5, 10],
  });
  assert.deepEqual(result["idle.js"], { statements: 1, coveredStatements: 0, branches: 0, coveredBranches: 0, executed: false, uncoveredLines: [1] });
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log("PASS JavaScript coverage attribution: source-mapped execution, unexecuted statements/branches and unrun files");
