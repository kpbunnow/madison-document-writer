/* Shared inspection facts load independently and retain historical/live reuse evidence. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  directory = path.join(root, "app/modules");
function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
// Calculations import their defining owners; the old orchestration modules are not forwarding barrels.
const moved = new Set(["validISO", "parseDate", "parseTime", "inspAt", "inspectionIdentity", "sameInspection", "inspectionUsed"]);
for (const name of fs.readdirSync(directory).filter((n) => n.endsWith(".js"))) {
  const tree = acorn.parse(fs.readFileSync(path.join(directory, name), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
  for (const node of tree.body) {
    if (node.type === "ImportDeclaration" && ["./court_and_deposits.js", "./case_timeline.js"].includes(node.source.value))
      assert.ok(!node.specifiers.some((s) => moved.has(s.imported?.name)), name + " imports facts from an orchestration owner");
    if (["court_and_deposits.js", "case_timeline.js"].includes(name) && node.type === "ExportNamedDeclaration")
      assert.ok(!node.specifiers.some((s) => moved.has(s.exported.name)), name + " must not re-export facts");
  }
}
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export * from './inspection_facts.js'; export {validISO,parseDate,parseTime} from './calendar.js'; export {WriterState} from './state.js';",
      resolveDir: directory,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const oldNow = Date.now,
    oldRandom = Math.random;
  try {
    Date.now = Math.random = () => {
      throw Error("inspection facts must not read ambient time or randomness");
    };
    const box = { exports: {} };
    new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
    const { inspAt, inspectionIdentity, sameInspection, inspectionUsed, validISO, parseDate, parseTime, WriterState: state } = box.exports;
    assert.deepEqual(state, {}, "independent loading must not initialize Writer, read state or require a DOM");
    for (const date of ["2024-02-29", "2026-01-01", "2000-02-29"]) assert.equal(validISO(date), true);
    for (const date of ["2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-1-01", "", null]) assert.equal(validISO(date), false);
    for (const [value, expected] of [
      [" 2/29/24 ", "2024-02-29"],
      ["10.25.2026", "2026-10-25"],
      ["2026-10-25", "2026-10-25"],
      ["2/31/2026", null],
      ["2026-02-29", null],
      ["1/1/1899", null],
      ["1/1/2201", null],
      ["", null],
    ])
      assert.equal(parseDate(value), expected);
    for (const [value, expected] of [
      ["12:00 AM", "00:00"],
      ["12:00 PM", "12:00"],
      ["2:30:59.123 p", "14:30"],
      ["00:00", "00:00"],
      ["23:59:00", "23:59"],
      ["13:30 PM", null],
      ["00:30 AM", null],
      ["24:00", null],
      ["10:60", null],
      ["10:30:60", null],
      ["", null],
    ])
      assert.equal(parseTime(value), expected);

    const k = freeze({ id: "c", date: "2026-10-01", time: "08:00" }),
      row = freeze({ typeKey: "reinspection", date: "2026-10-20", time: "2:30 PM" });
    state.CASES = freeze([k]);
    state.DOCS = freeze([]);
    state.REINSP = freeze([]);
    assert.deepEqual(inspAt({ caseId: "c" }), { date: k.date, time: k.time, own: false });
    const frozen = freeze({ caseId: "c", frozen: { case: { date: "2026-10-02", time: "09:00" } } });
    assert.deepEqual(inspAt(frozen), { date: "2026-10-02", time: "09:00", own: false });
    assert.deepEqual(inspAt({ ...frozen, correction: { case: { date: "2026-10-03" } } }), { date: "2026-10-03", time: "", own: false });
    assert.deepEqual(inspAt({ ...frozen, inspDate: "", inspTime: "" }), { date: "", time: "", own: true }, "blank own inspection never falls back");
    assert.deepEqual(inspAt({ caseId: "c", inspDate: "2026-10-04", inspTime: "10:00" }), { date: "2026-10-04", time: "10:00", own: true });
    assert.deepEqual(inspAt(Object.assign(Object.create({ inspDate: "inherited" }), { caseId: "c" })), {
      date: k.date,
      time: k.time,
      own: false,
    });
    assert.deepEqual(inspAt(null), { date: "", time: "", own: false });
    const identity = inspectionIdentity(row);
    assert.deepEqual(identity, { type: "reinspection", date: row.date, time: "14:30" });
    assert.deepEqual(inspectionIdentity({ ...row, time: "bad" }), { ...identity, time: "" });
    assert.equal(sameInspection(identity, { ...identity, time: "" }), true, "missing time remains a conservative wildcard");
    assert.equal(sameInspection({ ...identity, time: "" }, identity), true);
    assert.equal(sameInspection(identity, { ...identity, time: "14:31" }), false);
    assert.equal(sameInspection(identity, { ...identity, type: "caReinspection" }), false);
    assert.equal(sameInspection(identity, { ...identity, date: "2026-10-21" }), false);
    assert.equal(sameInspection(null, identity), false);
    assert.equal(inspectionUsed(k, row), false);
    state.DOCS = freeze([{ caseId: "other", importInspection: identity }]);
    assert.equal(inspectionUsed(k, row), false, "another case's evidence does not block this case");
    for (const flags of [{ void: true }, { superseded: true }, { draft: true }]) {
      state.DOCS = freeze([{ caseId: "c", importInspection: identity, ...flags }]);
      assert.equal(inspectionUsed(k, row), true, "retained document evidence is not recycled after state changes");
    }
    state.DOCS = freeze([{ caseId: "c", type: "notice" }]);
    assert.equal(inspectionUsed(k, { ...row, typeKey: "initial", date: "2026-10-25" }), true);
    assert.equal(inspectionUsed(k, row), false);
    state.DOCS = freeze([]);
    state.REINSP = freeze([{ caseId: "c", date: row.date, time: "14:30" }]);
    assert.equal(inspectionUsed(k, row), true, "legacy visit uses retained reinspection facts");
    state.REINSP = freeze([{ caseId: "c", date: row.date, importInspection: { ...identity, type: "caReinspection" } }]);
    assert.equal(inspectionUsed(k, row), false, "explicit visit type outranks the legacy fallback");
    assert.equal(inspectionUsed(k, { ...row, typeKey: "caReinspection" }), true);
    state.REINSP = freeze([]);
    state.DOCS = freeze([{ caseId: "c", type: "extension", fromReinspId: "retained", inspDate: row.date, inspTime: "14:30" }]);
    assert.equal(inspectionUsed(k, row), true);
    state.DOCS = freeze([{ ...frozen, type: "extension", fromReinspId: "retained" }]);
    assert.equal(inspectionUsed(k, { ...row, date: "2026-10-02", time: "09:00" }), true, "legacy follow-up preserves frozen inspection facts");
    state.DOCS = freeze([{ caseId: "c", type: "extension", inspDate: row.date, inspTime: "14:30" }]);
    assert.equal(inspectionUsed(k, row), false, "a document without reinspection lineage does not invent visit evidence");
    state.CASES = freeze([{ id: "c", date: "2026-10-25", time: "11:00" }]);
    assert.deepEqual(inspAt({ caseId: "c" }), { date: "2026-10-25", time: "11:00", own: false }, "read replaced case arrays at call time");
    assert.deepEqual(inspAt(frozen), { date: "2026-10-02", time: "09:00", own: false });
    state.DOCS = freeze([]);
    assert.equal(inspectionUsed(k, row), false, "read replaced document/visit arrays at call time");
    console.log(JSON.stringify({ passed: true, independentInspectionFacts: true, historicalPrecedence: true, retainedReuseEvidence: true }));
  } finally {
    Date.now = oldNow;
    Math.random = oldRandom;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
