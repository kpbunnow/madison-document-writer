/* A record note/withdrawal/follow-through finishing later must not close or overwrite a newer dialog. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const api = await compile('export {createRecordActions} from "./record_actions.js";export {createCorrectionEvents} from "./correction_events.js";');
  const s = api.WriterState,
    dom = new JSDOM("<body></body>");
  global.document = dom.window.document;
  function fields(text, reference) {
    document.body.innerHTML =
      '<textarea id="record-action-text"></textarea><textarea id="record-action-external"></textarea><input id="record-action-inspector" value="officer"><button id="record-action-go"></button>';
    document.getElementById("record-action-text").value = text;
    document.getElementById("record-action-external").value = reference;
  }
  for (const mode of ["void", "recordnote", "reconcile"])
    for (const confirmed of [false, true]) {
      const old = { id: "old_doc", caseId: "old_case", type: "notice", draft: false },
        later = { id: "new_doc", caseId: "new_case", type: "notice", draft: false };
      Object.assign(s, {
        CASES: [{ id: "old_case", inspectorId: "officer" }],
        DOCS: [old, later],
        EVENTS: { old_case: [] },
        RECORD_ATTEMPTS: {},
        state: { screen: "write", docId: old.id, modal: mode },
      });
      let release,
        committed = 0;
      const actions = api.createRecordActions({
        correctionEligibility: () => "",
        evid: () => "event1",
        commitAmendment: async () => {
          committed++;
          return await new Promise((resolve) => {
            release = resolve;
          });
        },
        render() {},
        toast() {},
      });
      const events = api.createCorrectionEvents(actions);
      fields("Original record detail", "Original external reference");
      events.commitRecordAction(document.getElementById("record-action-go"), old);
      assert.equal(committed, 1);
      Object.assign(s.state, { docId: later.id, modal: "recordnote" });
      fields("Later unsent record note", "Later external reference");
      release(confirmed);
      for (let n = 0; n < 12; n++) await Promise.resolve();
      assert.equal(s.state.docId, later.id);
      assert.equal(s.state.modal, "recordnote", "confirmation cannot close the newer record dialog");
      assert.equal(document.getElementById("record-action-text").value, "Later unsent record note", "old finalizer cannot overwrite a newer note");
      assert.equal(document.getElementById("record-action-external").value, "Later external reference");
    }
  dom.window.close();
  console.log("PASS successful and refused record actions preserve newer dialogs and unsent fields for withdrawal, notes and follow-through");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
