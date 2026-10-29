/* Return preferences preserve partial state and callback order, including two relative-date reads. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  async function compile(contents) {
    const b = await esbuild.build({
      stdin: { contents: contents + '\nexport {ReportsState} from "./state.js";', resolveDir: path.resolve("app/modules") },
      bundle: true,
      write: false,
      format: "cjs",
    });
    return (storage) => {
      const box = { exports: {} };
      new Function("localStorage", "module", "exports", b.outputFiles[0].text)(storage, box, box.exports);
      return box.exports;
    };
  }
  const current = await compile(fs.readFileSync("app/modules/report_return.js", "utf8")),
    old = fs.readFileSync("tests/fixtures/report_return_reference.txt", "utf8").replace("export function", "function"),
    original = await compile(
      'import {ReportsState} from "./state.js";import {reportSort} from "./contracts.js";export function createReportReturn(services){const reportById=(...a)=>services.reportById(...a),reportOrdinance=(...a)=>services.reportOrdinance(...a),relativeDates=(...a)=>services.relativeDates(...a),render=(...a)=>services.render(...a);' +
        old +
        "return restoreReportReturn;}",
    );
  function run(load, x) {
    const calls = [];
    let step = 0;
    function effect(k, a) {
      calls.push([k, a]);
      if (++step === x.fail) throw Error("interrupted:" + k);
    }
    const api = load({
      getItem(k) {
        effect("getItem", k);
        return x.serialized;
      },
    });
    api.ReportsState.S = { screen: "before", F: { ord: "before", asOf: "2026-10-29" }, drill: { case: "old" }, savedId: "old", reportNotice: "old" };
    const owner = api.createReportReturn({
      reportById(id) {
        effect("reportById", id);
        return ["openCases", "openViolations"].includes(id);
      },
      reportOrdinance(s) {
        effect("reportOrdinance", s);
        return s === "27.05(2)(g)2" ? s + "." : s;
      },
      relativeDates(mode) {
        effect("relativeDates", mode);
        return mode === "month" ? { from: "2026-10-01", to: "2026-10-29" } : null;
      },
      render() {
        effect("render", null);
      },
    });
    assert.deepEqual(calls, []);
    const result = owner();
    return { result, state: api.ReportsState.S, calls };
  }
  let count = 0;
  for (const report of ["openCases", "openViolations", "missing", null])
    for (const mode of ["fixed", "month", "", null])
      for (const view of ["map", "table", "bad"])
        for (const fail of [0, 1, 2, 3, 4, 5, 6, 7]) {
          const x = {
            serialized: JSON.stringify({ report, dateMode: mode, view, filters: { ord: "27.05(2)(g)2" }, sort: { report, ci: 1, dir: -1 } }),
            fail,
          };
          assert.deepEqual(run(current, x), run(original, x), "scenario " + count++);
        }
  for (const serialized of [null, "null", "{}", "bad", "[]"]) {
    const x = { serialized, fail: 0 };
    assert.deepEqual(run(current, x), run(original, x));
    count++;
  }
  console.log(
    "PASS report return equivalence " + count + " inputs: optional storage, canonical filters, relative dates, refusal and partial mutation",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
