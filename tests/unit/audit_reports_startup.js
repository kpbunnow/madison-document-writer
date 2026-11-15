/* Exercise actual Reports composition, load/refusal/retry and controls in a synthetic DOM (no native claims). */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const build = await esbuild.build({
    stdin: { contents: `export * from './reports_core.js';export {ReportsState} from './state.js';`, resolveDir: path.resolve("app/modules") },
    bundle: true,
    write: false,
    format: "cjs",
    define: { __TEST_BUILD__: "false" },
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/(data|vendor)\// }, (a) => ({
            path: path.resolve("build/generated/modules", a.path.includes("/vendor/") ? "vendor" : "data", path.basename(a.path)),
          }));
        },
      },
    ],
  });
  const dom = new JSDOM('<meta name="docwriter-token" content="synthetic"><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
    url: "http://127.0.0.1:8777/madison-reports.html",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  const w = dom.window;
  w.__NO_AUTOLOAD__ = true;
  w.module = { exports: {} };
  w.exports = w.module.exports;
  w.Headers = Headers;
  w.AbortController = AbortController;
  w.scrollTo = () => {};
  w.localStorage.setItem(
    "madison-report-views-v1",
    JSON.stringify([
      { version: 1, name: "Synthetic", report: "openCases", filters: {} },
      { version: 0, name: "Old" },
    ]),
  );
  let mode = "refused",
    routes = [],
    held = [];
  w.fetch = async (url, options) => {
    routes.push(url);
    assert.equal(options.headers.get("X-DocWriter-Token"), "synthetic");
    if (mode === "held" && url === "/reporting/index") return new Promise((resolve) => held.push(resolve));
    const data =
      url === "/reporting/index"
        ? mode === "refused"
          ? { ok: false, error: "synthetic unreadable index" }
          : { ok: true, summaries: [], excluded: [] }
        : url === "/reporting/parcels"
          ? { ok: true, parcels: {} }
          : { ok: false, notes: ["Synthetic outlines unavailable"] };
    return { ok: true, status: 200, json: async () => data };
  };
  w.eval(build.outputFiles[0].text);
  const api = w.module.exports,
    s = api.ReportsState.S;
  assert.equal(api.ReportsState.SAVED_VIEWS.length, 1);
  await api.loadAll(false);
  assert.equal(s.phase, "error");
  assert.match(s.error, /synthetic unreadable index/);
  assert.match(w.document.getElementById("app").textContent, /could not be read/);
  mode = "ok";
  await api.loadAll(false);
  assert.equal(s.phase, "ready");
  assert.equal(s.M.cases.length, 0);
  assert.deepEqual(routes.slice(-3), ["/reporting/index", "/reporting/parcels", "/reporting/areas"]);
  assert.match(w.document.getElementById("app").textContent, /Reports/);
  // The actual root listener saves disclosure state and ignores unrelated keys.
  const details = w.document.createElement("details");
  details.id = "f-areas";
  w.document.body.append(details);
  details.open = true;
  details.dispatchEvent(new w.Event("toggle", { bubbles: true }));
  assert.equal(s.areasOpen, true);
  // Superseded requests must not replace the newer complete model, even if their response arrives last.
  mode = "held";
  const old = api.loadAll(false);
  for (let i = 0; i < 20 && !held.length; i++) await Promise.resolve();
  assert.equal(held.length, 1);
  mode = "ok";
  await api.loadAll(false);
  assert.equal(s.phase, "ready");
  const model = s.M;
  held[0]({ ok: true, status: 200, json: async () => ({ ok: false, error: "late stale refusal" }) });
  await old;
  assert.equal(s.phase, "ready");
  assert.equal(s.M, model);
  assert.equal(s.error, "");
  assert.equal(api.esc("<unsafe>"), "&lt;unsafe&gt;");
  dom.window.close();
  console.log(
    "PASS real Reports startup/composition: saved-view filtering, load refusal/retry, authenticated routes, live controls and superseded responses",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
