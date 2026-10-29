/* Exact state and callback-order comparison against the original production listener. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const acorn = require("acorn"),
    core = acorn.parse(fs.readFileSync("app/modules/reports_core.js", "utf8"), { ecmaVersion: 2022, sourceType: "module" }),
    listeners = core.body
      .filter((n) => n.type === "ExpressionStatement" && n.expression.callee?.property?.name === "addEventListener")
      .map((n) => n.expression),
    filterIndex = listeners.findIndex((n) => n.arguments[0]?.value === "change"),
    registration = listeners[filterIndex].arguments[1];
  assert.equal(listeners[filterIndex - 1].arguments[1].callee.name, "createReportNavigation");
  assert.equal(listeners[filterIndex + 1].arguments[0].value, "toggle");
  assert.equal(registration.callee.name, "createReportFilterChange");
  assert.deepEqual(
    registration.arguments[0].properties.map((p) => [p.key.name, p.kind]),
    ["state", "applyReportView", "toggleArea", "validISO", "render"].map((key) => [key, "get"]),
  );
  const b = await esbuild.build({
      stdin: {
        contents: 'export {createReportFilterChange} from "./report_filter_events.js";export {validISO} from "./report_facts.js";',
        resolveDir: path.resolve("app/modules"),
      },
      bundle: true,
      write: false,
      format: "cjs",
    }),
    box = { exports: {} };
  new Function("module", "exports", b.outputFiles[0].text)(box, box.exports);
  const { createReportFilterChange, validISO } = box.exports,
    original = new Function(
      "ReportsState",
      "applyReportView",
      "toggleArea",
      "validISO",
      "render",
      "return (" + fs.readFileSync("tests/fixtures/report_filter_event_reference.txt", "utf8") + ");",
    );
  createReportFilterChange(
    new Proxy(
      {},
      {
        get(_, key) {
          assert.fail("eager read " + String(key));
        },
      },
    ),
  );
  function run(old, x) {
    const calls = [],
      initial = {
        F: { from: "2026-01-01", to: "2026-10-29", asOf: "2026-10-29", inspector: "old" },
        savedId: "saved",
        drill: { ids: ["case"] },
        dateMode: "month",
      };
    let state = structuredClone(initial),
      n = 0;
    const root = {
        get S() {
          calls.push("state");
          return state;
        },
      },
      services = {
        get state() {
          calls.push("state");
          return state;
        },
      };
    for (const key of ["applyReportView", "toggleArea", "validISO", "render"])
      services[key] = (...args) => {
        calls.push([key, structuredClone(args)]);
        if (++n === x.fail) throw Error("interrupt:" + key);
        if (x.replace) state = { ...state, F: { ...state.F, inspector: "replacement" } };
        if (key === "validISO") return validISO(...args);
      };
    const handler = old
      ? original(root, services.applyReportView, services.toggleArea, services.validISO, services.render)
      : createReportFilterChange(services);
    let error = null;
    try {
      handler({ target: structuredClone(x.target) });
    } catch (e) {
      error = [e.name, e.message];
    }
    return { state, initial, calls, error };
  }
  let count = 0;
  for (const id of ["saved-view", "f-from", "f-to", "f-asOf", "f-inspector", "f-vtype", "f-ord", "f-status", "unknown", ""])
    for (const value of ["", "2026-02-28", "2026-02-30", "2026-0", "QA", "<b>owner</b>", null])
      for (const dataset of [undefined, {}, { area: "" }, { area: "6" }])
        for (const fail of [0, 1, 2])
          for (const replace of [false, true]) {
            const x = { target: { id, value, dataset }, fail, replace };
            assert.deepEqual(run(false, x), run(true, x), JSON.stringify(x));
            count++;
          }
  assert.equal(count, 1680);
  console.log("PASS report filter event equivalence " + count + " changes: original refusal, live state and callback order");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
