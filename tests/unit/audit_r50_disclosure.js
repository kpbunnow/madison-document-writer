/* Same-document disclosure continuity through the public repaint owner. */
const assert = require("assert/strict"),
  path = require("path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents: 'export {createAppScreens} from "./app/modules/app_screens.js";export {WriterState} from "./app/modules/state.js";',
      resolveDir: path.resolve("."),
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
  const dom = new JSDOM('<div id="app"></div><div id="overlay"></div>', { pretendToBeVisual: true }),
    document = dom.window.document;
  const box = { exports: {} };
  new Function("document", "module", "exports", compiled.outputFiles[0].text)(document, box, box.exports);
  const { createAppScreens, WriterState } = box.exports;
  const html = (id) =>
    '<main class="document-workspace" data-editor-doc="' +
    id +
    '"><details id="r26-details"><summary>Review sources</summary><input></details><div data-charge="item-one"><details data-review-details="pricing"><summary>Pricing</summary>Basis</details></div></main>';
  const noop = () => {};
  Object.assign(WriterState, { WRITER_READY: true, STARTUP_STATUS: "ready", DOCS: [], state: { screen: "write", docId: "one" } });
  const { render } = createAppScreens({
    document,
    window: dom.window,
    A11Y: { rememberFocus: noop, enhance: noop },
    app_languagediscoveryContext: () => ({ state: WriterState.state }),
    ensureWalkContext: noop,
    screenWrite: () => html(WriterState.state.docId),
    overlayHTML: () => "",
    paginate: noop,
    editorEnhance: noop,
    restoreWorkControls: noop,
    updateSaveStatus: noop,
    enhanceDialog: noop,
    highlightOpenChecks: noop,
    isLocked: () => false,
  });
  document.getElementById("app").innerHTML = html("one");
  document.getElementById("r26-details").open = true;
  document.querySelector("[data-review-details=pricing]").open = true;
  render();
  assert.equal(document.getElementById("r26-details").open, true);
  assert.equal(document.querySelector("[data-review-details=pricing]").open, true);
  assert.equal(document.querySelector(".editor-initial-options"), null);
  WriterState.state.docId = "two";
  render();
  assert.equal(document.querySelector("[data-review-details=pricing]").open, false);
  dom.window.close();
  console.log("PASS disclosure state survives only the same document repaint");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
