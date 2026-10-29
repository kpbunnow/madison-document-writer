const { withHistoricalBindings } = require("../fixtures/historical_module_scope.cjs");
/* Check rows have an independent oracle: the historical full-screen fixture calls this shared owner. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { liftedSplice } = require("../fixtures/lifted_splice.cjs");
(async () => {
  const source = fs.readFileSync("app/modules/reinspection.js", "utf8"),
    reference = JSON.parse(fs.readFileSync("tests/fixtures/worksheet_checks_reference.json", "utf8"));
  let legacy = liftedSplice(source, "reinspection", "checkRowHTML", reference.row);
  const panel = acorn.parse(legacy, { ecmaVersion: 2022, sourceType: "module" }).body.find((n) => n.id?.name === "worksheetCheckPanelHTML");
  legacy = legacy.slice(0, panel.start) + reference.panel + legacy.slice(panel.end);
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: { contents: contents + "\nexport {worksheetCheckPanelHTML};", resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
      plugins: [
        {
          name: "data",
          setup(b) {
            b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
          },
        },
      ],
    });
    const box = { exports: {} };
    new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
    return box.exports;
  }
  const [current, old] = await Promise.all([compile(source), compile(withHistoricalBindings(legacy, ["esc"]))]);
  function owner(api) {
    return api.createReinspection(
      new Proxy(
        {},
        {
          get(_, k) {
            assert.fail("unexpected service read " + k);
          },
        },
      ),
    );
  }
  const a = owner(current),
    b = owner(old);
  let checked = 0;
  for (const ok of [false, true])
    for (const soft of [false, true])
      for (const t of ["Plain", "<&>\"'", "", null])
        for (const targets of [undefined, [], [{ label: "Open <&> record" }], [{ label: "One" }, { label: "Two <&>" }, { label: null }]])
          for (const worksheet of [false, true, "visit", undefined])
            for (const ix of [0, 1, 100]) {
              const c = { ok, soft, t, targets };
              assert.equal(a.checkRowHTML(c, ix, worksheet), b.checkRowHTML(c, ix, worksheet), "row " + checked++);
              assert.equal(
                current.worksheetCheckPanelHTML([c, { ...c, ok: !ok }], a.checkRowHTML),
                old.worksheetCheckPanelHTML([c, { ...c, ok: !ok }], b.checkRowHTML),
                "panel " + checked++,
              );
            }
  assert.equal(current.worksheetCheckPanelHTML([], a.checkRowHTML), "");
  console.log("PASS worksheet check HTML equivalence " + checked + " cases: severity, escaping, targets, worksheet flags and ordered panels");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
