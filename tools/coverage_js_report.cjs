/* Diagnostic JavaScript statement and branch coverage from tools/coverage_js_preload.cjs records.
   Usage: node tools/coverage_js_report.cjs <records dir> <run root> <file>... > report.json

   Every listed file is in the denominator, executed or not. Statements are the statement and declaration nodes
   acorn finds (block statements and function/class declarations themselves excluded; their bodies count).
   Branches are the explicit arms of if/else, conditional expressions, the right operand of &&, || and ??, and each
   switch case. An implicit missing else is not counted. A statement or branch is covered when the first source-map
   segment at or after its start, within its own range, maps to generated code that ran (V8 precise block
   coverage: the innermost enclosing range decides the count). Executions are united across every bundle. */
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const DIGIT = Object.fromEntries([...B64].map((c, i) => [c, i]));

// Source-map v3 mappings into [generatedLine, generatedColumn, source, originalLine, originalColumn] (all 0-based).
function decodeMappings(mappings) {
  const out = [];
  let source = 0,
    line = 0,
    column = 0;
  mappings.split(";").forEach((group, generatedLine) => {
    let generatedColumn = 0;
    for (const segment of group.split(",")) {
      if (!segment) continue;
      const fields = [];
      let value = 0,
        shift = 0;
      for (const ch of segment) {
        const digit = DIGIT[ch];
        value += (digit & 31) << shift;
        if (digit & 32) shift += 5;
        else {
          fields.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = shift = 0;
        }
      }
      generatedColumn += fields[0];
      if (fields.length < 4) continue;
      source += fields[1];
      line += fields[2];
      column += fields[3];
      out.push([generatedLine, generatedColumn, source, line, column]);
    }
  });
  return out;
}

const lineStarts = (text) => {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") starts.push(i + 1);
  return starts;
};

// The count at each offset: the innermost (latest-starting, shortest) V8 range containing it.
function countsAt(functions, offsets) {
  const ranges = functions.flatMap((f) => f.ranges).sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  const order = offsets.map((offset, index) => [offset, index]).sort((a, b) => a[0] - b[0]);
  const counts = new Array(offsets.length).fill(0);
  const stack = [];
  let next = 0;
  for (const [offset, index] of order) {
    while (next < ranges.length && ranges[next].startOffset <= offset) stack.push(ranges[next++]);
    while (stack.length && stack.at(-1).endOffset <= offset) stack.pop();
    // A popped outer range may still contain the offset; search down for the innermost one that does.
    let i = stack.length - 1;
    while (i >= 0 && !(stack[i].startOffset <= offset && offset < stack[i].endOffset)) i--;
    counts[index] = i >= 0 ? stack[i].count : 0;
  }
  return counts;
}

// new Function prefixes its body with a two-line header; eval, vm and jsdom scripts start at the mapped text.
const headerLines = (source) => (source.startsWith("(function anonymous(") ? 2 : 0);

function executedPositions(recordsDir, runRoot) {
  const positions = new Map(); // file -> Map("line:column" -> ran)
  for (const name of fs.readdirSync(recordsDir).filter((n) => n.endsWith(".json"))) {
    const { cwd, records } = JSON.parse(fs.readFileSync(path.join(recordsDir, name), "utf8"));
    for (const record of records) {
      if (!record.sourceMapURL || !record.source) continue;
      const map = JSON.parse(Buffer.from(record.sourceMapURL.split(",", 2)[1], "base64").toString("utf8"));
      const files = map.sources.map((s) =>
        path
          .relative(runRoot, path.resolve(cwd, map.sourceRoot || "", s))
          .split(path.sep)
          .join("/"),
      );
      const starts = lineStarts(record.source),
        header = headerLines(record.source);
      const segments = decodeMappings(map.mappings).filter(([line]) => starts[line + header] !== undefined);
      const counts = countsAt(
        record.functions,
        segments.map(([line, column]) => starts[line + header] + column),
      );
      segments.forEach(([, , source, line, column], i) => {
        const byFile = positions.get(files[source]) || positions.set(files[source], new Map()).get(files[source]);
        const key = line + 1 + ":" + column;
        byFile.set(key, byFile.get(key) || counts[i] > 0);
      });
    }
  }
  return positions;
}

function walk(node, visit, parent) {
  if (!node || typeof node.type !== "string") return;
  visit(node, parent);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit, node));
    else if (value && typeof value.type === "string") walk(value, visit, node);
  }
}

const NOT_STATEMENTS = new Set(["BlockStatement", "FunctionDeclaration", "ClassDeclaration", "ExportNamedDeclaration", "ExportDefaultDeclaration"]);
function targets(tree) {
  const statements = [],
    branches = [];
  walk(tree, (node) => {
    if (/(Statement|Declaration)$/.test(node.type) && !NOT_STATEMENTS.has(node.type)) statements.push(node);
    if (node.type === "IfStatement" || node.type === "ConditionalExpression")
      branches.push(node.consequent, ...(node.alternate ? [node.alternate] : []));
    if (node.type === "LogicalExpression") branches.push(node.right);
    if (node.type === "SwitchCase") branches.push(node);
  });
  return { statements, branches };
}

// Mapped segments of one file, sorted by original position, each with its line, column and whether it ran.
function fileSegments(byFile) {
  return [...(byFile || new Map())]
    .map(([key, ran]) => {
      const [line, column] = key.split(":").map(Number);
      return { line, column, ran };
    })
    .sort((a, b) => a.line - b.line || a.column - b.column);
}

function ranAt(segments, node) {
  const { start, end } = node.loc;
  let lo = 0,
    hi = segments.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const s = segments[mid];
    if (s.line < start.line || (s.line === start.line && s.column < start.column)) lo = mid + 1;
    else hi = mid;
  }
  const s = segments[lo];
  return !!s && (s.line < end.line || (s.line === end.line && s.column < end.column)) && s.ran;
}

function report(recordsDir, runRoot, files) {
  const positions = executedPositions(recordsDir, runRoot);
  const result = {};
  for (const file of files) {
    const text = fs.readFileSync(path.join(runRoot, file), "utf8");
    const tree = acorn.parse(text, {
      ecmaVersion: "latest",
      sourceType: file.endsWith(".cjs") ? "script" : "module",
      locations: true,
      allowHashBang: true,
    });
    const { statements, branches } = targets(tree);
    const segments = fileSegments(positions.get(file));
    const uncovered = statements.filter((n) => !ranAt(segments, n)).map((n) => n.loc.start.line);
    result[file] = {
      statements: statements.length,
      coveredStatements: statements.length - uncovered.length,
      branches: branches.length,
      coveredBranches: branches.filter((n) => ranAt(segments, n)).length,
      executed: segments.some((s) => s.ran),
      uncoveredLines: [...new Set(uncovered)],
    };
  }
  return result;
}

if (require.main === module) {
  const [recordsDir, runRoot, ...files] = process.argv.slice(2);
  process.stdout.write(JSON.stringify(report(recordsDir, path.resolve(runRoot), files)));
}
module.exports = { decodeMappings, countsAt, report, targets };
