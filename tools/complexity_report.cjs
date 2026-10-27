/* Read-only maintainability ratchet. Identities use lexical owners, never line numbers. */
const { ESLint } = require("eslint");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const LIMITS = { complexity: 20, "max-depth": 4, "max-lines-per-function": 80 };

function compare(current, baseline) {
  const failures = [];
  for (const [key, value] of Object.entries(current)) {
    if (!(key in baseline) || value > baseline[key]) failures.push(`${key}: ${baseline[key] ?? "new"} -> ${value}`);
  }
  for (const key of Object.keys(baseline)) {
    if (!(key in current) || current[key] < baseline[key]) failures.push(`${key}: improved; lower the baseline`);
  }
  return failures;
}

async function report() {
  const owners = new Map();
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfig: [
      {
        plugins: {
          metrics: {
            rules: {
              owners: {
                create(context) {
                  const stack = [],
                    counts = new Map(),
                    found = [];
                  const enter = (node) => {
                    const parent = node.parent;
                    const name =
                      node.id?.name ||
                      (parent.type === "VariableDeclarator"
                        ? parent.id.name
                        : parent.type === "Property"
                          ? parent.key.name || parent.key.value
                          : "anonymous");
                    const prefix = [...stack, name].join("/");
                    const ordinal = (counts.get(prefix) || 0) + 1;
                    counts.set(prefix, ordinal);
                    const identity = `${name}#${ordinal}`;
                    stack.push(identity);
                    found.push({ start: node.loc.start, end: node.loc.end, identity: stack.join("/") });
                  };
                  return {
                    ":function": enter,
                    ":function:exit"() {
                      stack.pop();
                    },
                    "Program:exit"() {
                      owners.set(context.filename, found);
                    },
                  };
                },
              },
            },
          },
        },
        rules: {
          "metrics/owners": "warn",
          complexity: ["warn", 20],
          "max-depth": ["warn", 4],
          "max-lines-per-function": ["warn", { max: 80, skipBlankLines: true, skipComments: true }],
        },
      },
    ],
  });
  const violations = {},
    counts = { complexity: 0, "max-depth": 0, "max-lines-per-function": 0, python: 0 };
  const results = await eslint.lintFiles(["app/modules", "app/assets/shared.js"]);
  for (const result of results) {
    for (const message of result.messages) {
      if (!(message.ruleId in LIMITS)) {
        if (message.severity === 2) throw new Error(`${result.filePath}: ${message.message}`);
        continue;
      }
      const candidates = owners.get(result.filePath).filter((f) => f.start.line <= message.line && f.end.line >= message.line);
      const owner = candidates.sort((a, b) => b.start.line - a.start.line || b.start.column - a.start.column)[0];
      if (!owner) throw new Error(`No owner for ${JSON.stringify(message)}`);
      const value = Number(message.message.match(/(?:complexity of |maximum nesting depth of |nested too deeply \(|too many lines \()(\d+)/)?.[1]);
      if (!value) throw new Error(`Unrecognized metric: ${message.message}`);
      const key = `${path.relative(ROOT, result.filePath)}:${owner.identity}:${message.ruleId}`;
      violations[key] = Math.max(violations[key] || 0, value);
      counts[message.ruleId]++;
    }
  }
  const python = spawnSync(
    process.env.DW_PYTHON || "python3",
    ["-m", "ruff", "check", "--select", "C901", "--output-format", "json", "helper", "tools", "policy"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (![0, 1].includes(python.status)) throw new Error(python.stderr || "Ruff failed");
  for (const finding of JSON.parse(python.stdout)) {
    const match = finding.message.match(/^`([^`]+)` is too complex \((\d+) > 10\)$/);
    if (!match) throw new Error(finding.message);
    const key = `${path.relative(ROOT, finding.filename)}:${match[1]}:C901`;
    if (key in violations) throw new Error(`Ambiguous Python owner: ${key}`);
    violations[key] = Number(match[2]);
    counts.python++;
  }
  return { counts, violations: Object.fromEntries(Object.entries(violations).sort(([a], [b]) => a.localeCompare(b))) };
}

async function main() {
  const current = await report();
  if (process.argv[2] === "--report") return console.log(JSON.stringify(current, null, 2));
  if (process.argv.length !== 2) throw new Error("Usage: node tools/complexity_report.cjs [--report]");
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/complexity-baseline.json"), "utf8"));
  const failures = compare(current.violations, baseline.violations);
  console.log(JSON.stringify(current.counts));
  if (failures.length) throw new Error(failures.join("\n"));
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { compare, report };
