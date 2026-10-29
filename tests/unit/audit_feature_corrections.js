/* Correction value formatting through its owning public factory; original behavioral assertions retained. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_r61_development.js: correction value text for money, assessments, overrides and ordinances": async () => {
    const assert = require("node:assert/strict"),
      path = require("node:path"),
      esbuild = require("esbuild");
    const built = await esbuild.build({
      stdin: {
        contents: 'export {createCorrectionUI} from "./correction_ui.js";export {WriterState} from "./state.js";',
        resolveDir: path.resolve("app/modules"),
      },
      bundle: true,
      write: false,
      format: "cjs",
      define: { __TEST_BUILD__: "true" },
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
    new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
    assert.deepEqual(box.exports.WriterState, {}, "formatter owner import must not start Writer");
    const { correctionValueText } = box.exports.createCorrectionUI(
      new Proxy(
        {},
        {
          get(_, key) {
            assert.fail("unexpected formatter service read: " + key);
          },
        },
      ),
    );
    assert.equal(correctionValueText("citation.1.base", 100), "$100.00");
    assert.equal(correctionValueText("citation.1.amount", "197.00"), "$197.00");
    assert.equal(correctionValueText("citation.1.cc", 0), "$0.00");
    assert.equal(correctionValueText("citation.1.amount", "1234.50"), "$1,234.50");
    for (const value of [null, undefined, "", false, "NaN", "1.234"]) assert.equal(correctionValueText("citation.1.base", value), "—");
    const assessment = { base: 10000, penalty: 2600, jail: 1000, crimeLab: 1300, court: 4800, total: 19700 };
    const savedAssessment = JSON.stringify(assessment);
    assert.equal(
      correctionValueText("citation.1.assessments", assessment),
      "Base: $100.00; Penalty assessment: $26.00; Jail assessment: $10.00; Crime lab: $13.00; Court costs: $48.00; Total: $197.00",
    );
    assert.equal(JSON.stringify(assessment), savedAssessment, "display never changes stored cents");
    assert.equal(correctionValueText("citation.1.overrideBasis", { totalCents: 32300, tier: 2 }), "Total: $323.00; tier: 2");
    assert.equal(correctionValueText("citation.1.ord", "27.05(2)(g)2."), "27.05(2)(g)2.");
    console.log("PASS audit_r61_development.js: correction value text for money, assessments, overrides and ordinances");
  },
});
