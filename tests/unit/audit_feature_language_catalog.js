/* Order language normalization, pricing and classification through public owners without Writer startup.
   Scenario labels retain the source suite name; original behavioral assertions remain unchanged. */
require("../fixtures/scenarios.cjs").run(__filename, {
  "audit_r61_development.js: 27.05(2)(g)2 catalog normalization, pricing and legacy classification": async () => {
    const assert = require("node:assert/strict"),
      path = require("node:path"),
      esbuild = require("esbuild");
    const built = await esbuild.build({
      stdin: {
        contents:
          'export {allItems} from "./catalog_queries.js"; export {canonicalOrdinance,resolveCitationAmount} from "./citation_policy.js"; export {violationType} from "./case_projection.js"; export {recordDay} from "../assets/shared.js"; export {WriterState} from "./state.js";',
        resolveDir: path.resolve("app/modules"),
      },
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
    new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
    const { allItems, canonicalOrdinance, resolveCitationAmount, violationType, recordDay, WriterState } = box.exports;
    assert.deepEqual(WriterState, {}, "catalog/classification imports must remain independent of Writer startup");
    const today = new Date();
    const stamp = recordDay(today);
    const entries = allItems().filter((i) => i.s.includes("27.05(2)(g)2"));
    assert.equal(entries.length, 19);
    assert.equal(canonicalOrdinance("27.05(2)(g)2"), canonicalOrdinance("27.05(2)(g)2."));
    assert.deepEqual(
      resolveCitationAmount({ ordinance: "27.05(2)(g)2", date: stamp }),
      resolveCitationAmount({ ordinance: "27.05(2)(g)2.", date: stamp }),
    );
    assert.ok(!allItems().some((i) => i.s.includes("27.05(2)(g)2.")));
    const legacyMatch = entries.find((entry) => violationType({ title: entry.t, sections: entry.s }).how === "matched");
    assert.ok(legacyMatch);
    const currentClassification = violationType({ title: legacyMatch.t, sections: legacyMatch.s });
    assert.deepEqual(
      violationType({ title: legacyMatch.t, sections: legacyMatch.s.map((s) => (s === "27.05(2)(g)2" ? "27.05(2)(g)2." : s)) }),
      currentClassification,
      "legacy title/section classification survives display punctuation",
    );
    console.log("PASS audit_r61_development.js: 27.05(2)(g)2 catalog normalization, pricing and legacy classification");
  },
});
