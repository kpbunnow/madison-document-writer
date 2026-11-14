/* Diagnostic JavaScript measurement (plan Phase 0): logic lines exclude blank and comment-only lines, including
   block comments spanning lines, and the type-checked entry list is the one tools/run_tests.py checks. */
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { logicLines } = require("../../tools/maintainability_js.cjs");
assert.equal(logicLines(""), 0);
assert.equal(logicLines("a();\n\n// note\n  b();"), 2);
assert.equal(logicLines("/* one\n two\n three */\nc();"), 1);
assert.equal(logicLines("/* a */ d(); /* b */\n/* c */"), 1, "code after a closed comment counts once");
assert.equal(logicLines("e(); // trailing\n  /** doc */"), 1);
const checked = JSON.parse(fs.readFileSync("tools/checked-js.json", "utf8"));
assert.ok(checked.entries.length && checked.entries.every((file) => fs.existsSync(file)), "every checked entry exists");
assert.match(fs.readFileSync("tools/run_tests.py", "utf8"), /checked-js\.json/, "the gate type-checks the same entries");
console.log("PASS maintainability JavaScript measurement: logic lines and checked entries");
