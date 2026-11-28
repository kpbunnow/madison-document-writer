/* Accepted retained records can contain empty email slots; reads keep their indices and original facts. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { JSDOM } = require("jsdom"),
  { compile } = require("../fixtures/equivalence_harness.cjs");

(async () => {
  const overlay = await compile(`export {createScreenOverlays} from './screen_overlays.js';
    export {caseFileFault} from './case_file_rules.js';export {emailList} from './mailing_rules.js';
    export {createRecipientWorkflow} from './recipient_workflow.js';
    export {initAddressParser} from './address_parser.js';
    export {createWorkingPapers} from './working_papers.js';`);
  const privateOwner = (name, symbols) => compile(fs.readFileSync("app/modules/" + name + ".js", "utf8") + "\nexport {" + symbols + "};");
  const render = await privateOwner("document_render", "noticeMailRows"),
    correction = await privateOwner("correction_workflow", "recipientRows"),
    activity = await privateOwner("case_activity", "reminderDraftHTML"),
    choices = await privateOwner("screen_overlays", "finalRecipientsHTML"),
    contact = await privateOwner("contact_events", "contactSendDocument");
  const dom = new JSDOM('<div id="app"></div>');
  Object.assign(global, { window: dom.window, document: dom.window.document });
  try {
    const first = { addr: "first@example.invalid", kind: "Other", on: false },
      second = { addr: "second@example.invalid", kind: "Agent" };
    for (const emails of [[null, first], [first, null, second], [null]]) {
      const k = { id: "k", number: "QA-EMAIL-SLOTS", owner: "Synthetic owner", emails: structuredClone(emails) },
        before = structuredClone(k),
        d = { id: "d", caseId: "k", type: "notice", draft: true },
        selected = emails.filter((e) => e?.addr),
        state = { screen: "write", docId: "d", modal: "cc" };
      assert.equal(overlay.caseFileFault({ format: "madison-case-file", case: k, events: [] }), "");
      for (const api of [overlay, render, correction, activity, choices, contact])
        Object.assign(api.WriterState, { CASES: [k], DOCS: [d], WORK: { recordForms: {} }, HELPER: { chrome: true }, state });
      assert.equal(overlay.emailList(k), k.emails, "raw getter cannot compact contact indices");
      const owner = overlay.createScreenOverlays({
        recipientPreview: overlay.createRecipientWorkflow({ addressParser: overlay.initAddressParser({}) }).recipientPreview,
      });
      document.getElementById("app").innerHTML = owner.overlayHTML();
      emails.forEach((e, ix) => assert.equal(!!document.querySelector('[data-em="' + ix + '|addr"]'), !!e));
      assert.deepEqual(
        render.noticeMailRows(d, k),
        selected.filter((e) => e.on !== false),
      );
      assert.deepEqual(render.noticeMailRows({ ...d, draft: false, emailedTo: [null, ...selected] }, k), selected);
      assert.doesNotThrow(() => activity.reminderDraftHTML(k, "Synthetic subject", "Synthetic message"));
      assert.deepEqual(
        correction.recipientRows({ ...d, emailedTo: [null, ...selected] }),
        selected.map((e) => ({ ...e, on: true })),
      );
      assert.deepEqual(k, before, "display and correction preparation cannot rewrite retained case contacts");
      state.modal = "sendto";
      document.getElementById("app").innerHTML = owner.overlayHTML();
      const sendBoxes = [...document.querySelectorAll("[data-sendto]")];
      assert.equal(sendBoxes.length, selected.length);
      sendBoxes.forEach((box, ix) => (box.checked = ix === selected.length - 1));
      let sent;
      contact.contactSendDocument({ render() {}, emailDocument: (_, rows) => (sent = rows) }, { id: "btn-sendselected" });
      assert.deepEqual(sent, selected.length ? [selected.at(-1)] : [{ addr: "", kind: "" }], "send choices use the same filtered indices");
      state.modal = "final";
      document.getElementById("app").innerHTML = choices.finalRecipientsHTML({ d });
      const finalBoxes = [...document.querySelectorAll("[data-finsend]")];
      assert.equal(finalBoxes.length, selected.length);
      finalBoxes.forEach((box) => (box.checked = true));
      overlay.createWorkingPapers({ document }).captureWork();
      if (selected.length)
        assert.deepEqual(
          d.emailSelection,
          selected.map((e) => e.addr + "|" + e.kind),
        );
      assert.deepEqual(k, before, "capturing selections cannot compact the raw recipients");
    }
  } finally {
    dom.window.close();
  }
  console.log("PASS retained empty email slots: original indices/data, draft/issued display, reminders, corrections and final selections");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
