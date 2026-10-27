/* Real Chromium owner seam: repaint identity/caret and redirect timing before extraction. */
const assert = require("node:assert/strict");
const esbuild = require("esbuild");
const { chromium } = require("playwright");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        'import {createAppScreens} from "./app/modules/app_screens.js"; import {WriterState} from "./app/modules/state.js"; window.audit={createAppScreens,WriterState};',
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "iife",
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({
            path: require("node:path").resolve("build/generated/modules/data", require("node:path").basename(a.path)),
          }));
        },
      },
    ],
  });
  const browser = await chromium.launch({ executablePath: process.env.DW_BROWSER || undefined, headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div id="app"></div><div id="overlay"></div>');
    await page.addScriptTag({ content: built.outputFiles[0].text });
    const result = await page.evaluate(() => {
      const { createAppScreens, WriterState: s } = window.audit;
      s.WRITER_READY = true;
      s.STARTUP_STATUS = "ready";
      s.state = { screen: "write", docId: "d", modal: null, picker: false };
      s.DOCS = [{ id: "d", items: [{ id: "i", text: "typed text" }] }];
      const calls = [];
      const noop = () => {};
      const services = {
        document,
        window,
        location,
        IDB_OK: true,
        A11Y: { rememberFocus: noop, enhance: noop },
        app_languagediscoveryContext: () => ({ state: s.state }),
        isLocked: () => false,
        ensureWalkContext: noop,
        screenCases: () => "<h1>Cases</h1>",
        screenWrite: () =>
          '<div class="document-workspace" data-editor-doc="d"><div data-field="text" data-id="i" contenteditable="true">typed text</div><details class="editor-more"><summary>Actions</summary><button id="action">Save</button></details></div>',
        overlayHTML: () => "",
        paginate: () => calls.push("paginate"),
        editorEnhance: () => calls.push("editor"),
        restoreWorkControls: noop,
        updateSaveStatus: noop,
        enhanceDialog: noop,
        highlightOpenChecks: noop,
      };
      const screens = createAppScreens(services);
      screens.render();
      const live = document.querySelector('[data-field="text"]');
      live.focus();
      const range = document.createRange();
      range.setStart(live.firstChild, 2);
      range.setEnd(live.firstChild, 6);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      screens.render();
      const kept = live === document.querySelector('[data-field="text"]') && live === document.activeElement;
      const caret = [getSelection().anchorOffset, getSelection().focusOffset];
      document.querySelector(".editor-more").open = true;
      document.getElementById("action").focus();
      screens.render();
      const actions = document.querySelector(".editor-more").open && document.activeElement.id === "action";
      calls.length = 0;
      services.screenWrite = () => {
        s.state.screen = "cases";
        return services.screenCases();
      };
      screens.render();
      const redirected = document.getElementById("app").dataset.renderScreen === "cases" && calls.length === 0;
      s.state.screen = "write";
      services.ensureWalkContext = () => {
        s.state.screen = "cases";
      };
      services.screenWrite = () => {
        throw new Error("captured route before walk context");
      };
      screens.render();
      return { kept, caret, actions, redirected, routeAfterWalk: document.querySelector("h1").textContent === "Cases" };
    });
    assert.deepEqual(result, { kept: true, caret: [2, 6], actions: true, redirected: true, routeAfterWalk: true });
    console.log("PASS real-browser repaint keepers and live route reads");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
