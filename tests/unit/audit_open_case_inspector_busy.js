/* Open cases by inspector, found by the 2026-11-27 code review (synthetic): while one inspector's open cases were
   loading, the inspector menu could still be changed, but Show open cases was disabled, so the answer arrived under the
   newly chosen inspector and the new choice was never loaded. The menu is now disabled while a list loads and is
   available again once it has loaded or failed. */
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");

(async () => {
  const built = await esbuild.build({
    stdin: { contents: 'export * from "./app/modules/open_case_list.js";', resolveDir: path.resolve(__dirname, "../..") },
    bundle: true,
    write: false,
    format: "cjs",
  });
  const m = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(m, m.exports);
  const { openCaseCardHTML } = m.exports;
  const state = (extra) => ({
    inspectors: [
      { id: "AONE", name: "Alex One", openCases: 2 },
      { id: "BTWO", name: "Blake Two", openCases: 1 },
    ],
    loading: false,
    error: "",
    selected: "AONE",
    cases: null,
    casesFor: null,
    casesLoading: false,
    casesError: "",
    query: "",
    loadedAt: "",
    ...extra,
  });
  const menu = (s) => new JSDOM(openCaseCardHTML(s)).window.document.getElementById("open-cases-inspector");

  assert.equal(menu(state({ casesLoading: true })).disabled, true, "the menu cannot change while a list loads");
  assert.equal(menu(state({ casesLoading: true })).value, "AONE", "the inspector being loaded stays shown");
  assert.equal(menu(state()).disabled, false, "the menu is available before a load");
  assert.equal(menu(state({ cases: [], casesFor: "AONE" })).disabled, false, "and after a load");
  assert.equal(menu(state({ casesError: "The open cases could not be loaded." })).disabled, false, "and after a failed load");
  console.log("PASS open cases: the inspector menu is held while that inspector's list loads");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
