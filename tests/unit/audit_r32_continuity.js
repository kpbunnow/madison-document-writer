/* A form input remains authoritative if another listener replaces its node. */
const assert = require("assert/strict"),
  path = require("path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents:
        'export {createRecoveryEvents} from "./app/modules/recovery_events.js";export {createCorrectionUI} from "./app/modules/correction_ui.js";export {WriterState} from "./app/modules/state.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
    define: { __TEST_BUILD__: "false" },
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
  let replace = false;
  document.addEventListener(
    "input",
    (e) => {
      if (replace && e.target.id === "record-action-text") {
        const blank = e.target.cloneNode();
        blank.value = "";
        e.target.replaceWith(blank);
      }
    },
    true,
  );
  const box = { exports: {} };
  new Function("document", "module", "exports", compiled.outputFiles[0].text)(document, box, box.exports);
  const { createRecoveryEvents, createCorrectionUI, WriterState } = box.exports;
  const d = { id: "document", caseId: "case", type: "notice", draft: true };
  Object.assign(WriterState, {
    DOCS: [d],
    CASES: [{ id: "case", inspectorId: "i4" }],
    RECORD_ATTEMPTS: {},
    WORK: { entry: {}, recordForms: {} },
    state: { screen: "write", docId: d.id, modal: "recordnote" },
  });
  const ui = createCorrectionUI({});
  const render = () => {
    document.getElementById("overlay").innerHTML = ui.recordActionModal();
  };
  createRecoveryEvents({
    ENTRY_IDS: [],
    recordFormKey: () => WriterState.state.docId + ":" + WriterState.state.modal,
    scheduleDraftSave: () => {},
  }).registerWorkingInput(document);
  render();
  replace = true;
  const field = document.getElementById("record-action-text");
  field.value = "A partial record note survives a concurrent redraw.";
  field.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  assert.equal(WriterState.WORK.recordForms[d.id + ":recordnote"].text, field.value);
  render();
  assert.equal(document.getElementById("record-action-text").value, field.value);
  dom.window.close();
  console.log("PASS record-note input survives replaced DOM node and redraw");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
