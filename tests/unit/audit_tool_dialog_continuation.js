/* A completed batch save closes its own utility dialog, never newer unsent work. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom"),
  { compile, listenerTarget } = require("../fixtures/equivalence_harness.cjs");

(async () => {
  const api = await compile('export {createWorkflowEvents} from "./workflow_events.js";');
  const dom = new JSDOM("<body></body>");
  Object.assign(global, { document: dom.window.document, FormData: dom.window.FormData });
  try {
    for (const mode of ["ordinary", "replacement", "closed", "refused"]) {
      document.body.innerHTML = `<dialog id="utility-dialog"><form id="batch-due-form">
        <input name="due" value="2026-12-15"><input type="checkbox" data-batch-item="i" data-batch-doc="d" checked>
        <button type="submit">Save</button></form></dialog>`;
      const original = document.getElementById("utility-dialog"),
        form = document.getElementById("batch-due-form"),
        before = { id: "d", draft: true, items: [{ id: "i", due: "" }] },
        after = { ...before, items: [{ id: "i", due: "2026-12-15" }] },
        messages = [];
      let finish,
        reject,
        closes = 0,
        renders = 0;
      original.close = () => ++closes;
      api.WriterState.DOCS = [before];
      const target = listenerTarget();
      api
        .createWorkflowEvents({
          planBulkDue(changes, due) {
            assert.deepEqual(changes, [{ docId: "d", itemId: "i" }]);
            assert.equal(due, "2026-12-15");
            return new Map([["d", after]]);
          },
          async persistWorkspacePatch(stage, apply) {
            const staged = stage({ docs: [before] });
            assert.deepEqual(staged.docs, [after]);
            await new Promise((resolve, refuse) => {
              finish = resolve;
              reject = refuse;
            });
            apply(staged);
          },
          render: () => ++renders,
          toast: (text) => messages.push(text),
        })
        .registerToolForms(target);
      const pending = target.listeners.submit({ target: form, preventDefault() {} });
      assert.equal(form.querySelector("button").disabled, true);
      if (mode === "replacement") {
        original.remove();
        document.body.innerHTML = '<dialog id="utility-dialog"><textarea>Unsent reminder</textarea></dialog>';
        document.getElementById("utility-dialog").close = () => ++closes;
      } else if (mode === "closed") original.remove();
      if (mode === "refused") reject(new Error("Synthetic storage refusal"));
      else finish();
      await pending;
      assert.equal(closes, mode === "ordinary" ? 1 : 0, mode + ": close only the originating current dialog");
      assert.deepEqual(api.WriterState.DOCS, [mode === "refused" ? before : after]);
      assert.equal(renders, mode === "refused" ? 0 : 1);
      assert.deepEqual(messages, [mode === "refused" ? "Synthetic storage refusal" : "Saved selected draft deadlines"]);
      if (mode === "replacement") assert.equal(document.querySelector("textarea").value, "Unsent reminder");
      if (form.isConnected) assert.equal(form.querySelector("button").disabled, false);
    }
  } finally {
    dom.window.close();
  }
  console.log("PASS delayed batch deadlines preserve later dialogs and acknowledged saves");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
