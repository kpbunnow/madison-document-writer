/* Diagnostic JavaScript maintainability measurement (tools/measure_maintainability.py). Read-only; never gate or
   release evidence. Reuses the ratchet's lexical function owners so identities match tools/complexity-baseline.json. */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { report } = require("./complexity_report.cjs");
const { moduleGraph } = require("./module_graph.cjs");
const { serviceAreas } = require("./service_areas.cjs");
const { inventory } = require("./test_seams.cjs");
const ROOT = path.resolve(__dirname, "..");
// The type-checked entry points, exactly as tools/run_tests.py passes them to tsc.
const CHECKED_ENTRIES = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/checked-js.json"), "utf8")).entries;

const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/");
const scopeFiles = () => [
  ...fs
    .readdirSync(path.join(ROOT, "app/modules"))
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => "app/modules/" + name),
  "app/assets/shared.js",
];
// Lines that hold code: not blank and not only a comment (block comments are tracked across lines).
function logicLines(text) {
  let inBlock = false,
    count = 0;
  for (const raw of text.split("\n")) {
    let line = raw.trim();
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end < 0) continue;
      inBlock = false;
      line = line.slice(end + 2).trim();
    }
    while (line.startsWith("/*")) {
      const end = line.indexOf("*/", 2);
      if (end < 0) {
        inBlock = true;
        line = "";
        break;
      }
      line = line.slice(end + 2).trim();
    }
    if (line && !line.startsWith("//")) count++;
  }
  return count;
}

function checkedFiles() {
  const run = spawnSync(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "--allowJs",
      "--checkJs",
      "--noEmit",
      "--target",
      "ES2022",
      "--lib",
      "ES2022,DOM",
      "--listFilesOnly",
      ...CHECKED_ENTRIES,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (run.status) throw new Error("tsc --listFilesOnly failed: " + (run.stderr || run.stdout));
  return run.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.includes("node_modules"))
    .map((line) => rel(path.resolve(ROOT, line)))
    .sort();
}

async function measure() {
  const files = scopeFiles();
  const { violations } = await report({ complexity: 0, "max-depth": 0, "max-lines-per-function": 0 });
  const functions = {};
  for (const [key, value] of Object.entries(violations)) {
    if (!key.startsWith("app/")) continue;
    const at = key.lastIndexOf(":"),
      identity = key.slice(0, at),
      metric = { complexity: "complexity", "max-depth": "depth", "max-lines-per-function": "lines" }[key.slice(at + 1)];
    (functions[identity] = functions[identity] || {})[metric] = value;
  }
  const fileStats = files.map((file) => {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    const owned = Object.entries(functions).filter(([id]) => id.startsWith(file + ":") && !id.endsWith("<top-level>"));
    return { file, lines: text.split("\n").length, logicLines: logicLines(text), functions: owned.length };
  });
  const graph = moduleGraph(path.join(ROOT, "app/modules"));
  const areas = serviceAreas();
  const seams = inventory();
  const checked = checkedFiles();
  const scope = new Set(files);
  const checkedLogic = fileStats.filter((f) => checked.includes(f.file)).reduce((n, f) => n + f.logicLines, 0);
  const totalLogic = fileStats.reduce((n, f) => n + f.logicLines, 0);
  // Whole-application evaluator classification is owned by the test-seam baseline (tests/unit/audit_test_seams.js).
  const classified = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/test-seam-baseline.json"), "utf8"));
  const seamClasses = {};
  for (const [file, record] of Object.entries(classified)) (seamClasses[record.class] = seamClasses[record.class] || []).push(file);
  return {
    scope: { files: files.length, logicLines: totalLogic, description: "app/modules/*.js and app/assets/shared.js" },
    files: fileStats,
    functions,
    cycles: graph.cycles,
    serviceAreas: {
      occurrences: Object.values(areas.coupling).reduce((n, v) => n + v, 0),
      pairs: Object.keys(areas.coupling).length,
      top: Object.entries(areas.coupling)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
    },
    testSeams: { counts: seams.counts, classes: seamClasses },
    checkedCode: {
      entries: CHECKED_ENTRIES,
      files: checked,
      inScope: checked.filter((file) => scope.has(file)),
      logicLines: checkedLogic,
      share: totalLogic ? checkedLogic / totalLogic : 0,
    },
  };
}

if (require.main === module)
  measure()
    .then((result) => process.stdout.write(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.stack || error.message);
      process.exitCode = 1;
    });
module.exports = { measure, logicLines };
