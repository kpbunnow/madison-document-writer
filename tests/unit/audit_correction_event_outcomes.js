/* Actual correction event bodies: pending guards, immutable source, withdrawals, review invalidation and async UI recovery. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom"),
  { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const { createCorrectionEvents, WriterState: s } = await compile(`export {createCorrectionEvents} from './correction_events.js';`);
  const dom = new JSDOM(
    '<input id="record-action-text" value="Typed note"><input id="record-action-external" value="External review"><input id="record-action-inspector" value="officer"><button id="record-action-go"></button>',
  );
  global.document = dom.window.document;
  let calls = [],
    locked = false,
    allow = true,
    answer = null,
    resolveAction;
  global.prompt = () => answer;
  const src = { id: "source", caseId: "case", type: "notice", eventId: "source-event", items: [{ id: "item", no: "1", text: "Issued" }] };
  const draft = {
    id: "draft",
    caseId: "case",
    type: "notice",
    draft: true,
    authoringVersion: 16,
    inspDate: "2026-10-25",
    items: [{ ...src.items[0] }],
    correction: { targetId: "source", reviewed: true },
  };
  Object.assign(s, {
    CASES: [{ id: "case", number: "QA-CORRECTION" }],
    DOCS: [src, draft],
    EVENTS: { case: [] },
    RECORD_ATTEMPTS: { holder: { cid: "case", pendingAmendment: { id: "attempt" } } },
    state: { docId: "draft", modal: "recordnote" },
    DIRTY: false,
  });
  const api = createCorrectionEvents({
    commitAmendment: (...a) => calls.push(["commit", ...a]),
    preflightCase: (cid, mode, fn) => {
      calls.push(["preflight", cid, mode]);
      fn();
    },
    startCorrection: (id) => calls.push(["start", id]),
    downloadFile: (name, body) => calls.push(["download", name, JSON.parse(body)]),
    correctionChanges: () => [{ path: "item.text" }],
    issueCorrection: (d) => calls.push(["issue", d]),
    toast: (t) => calls.push(["toast", t]),
    render: () => calls.push(["render"]),
    saveDrafts: () => calls.push(["save"]),
    scheduleDraftSave: () => calls.push(["schedule"]),
    isLocked: () => locked,
    correctionTypeAllowed: () => allow,
    docBody: () => "Original body",
    itemInspectionHistory: () => [{ observed: "retained" }],
    itemHistory: () => [{ legacy: true }],
    voidDocument: (...a) => {
      calls.push(["void", ...a]);
      return new Promise((r) => (resolveAction = r));
    },
    reconcileDocument: (...a) => calls.push(["reconcile", ...a]),
    addRecordNote: (...a) => calls.push(["note", ...a]),
  });
  api.resumeRecord({ dataset: { resumerecord: "missing" } });
  assert.deepEqual(calls, []);
  api.resumeRecord({ dataset: { resumerecord: "holder" } });
  assert.equal(calls[0][1], "case");
  calls = [];
  api.startCorrection(src);
  assert.deepEqual(calls, [
    ["preflight", "case", "correction"],
    ["start", "source"],
  ]);
  api.exportCorrection(draft);
  assert.equal(calls.at(-1)[2].format, "madison-correction-draft-review");
  assert.equal(calls.at(-1)[2].source.id, "source");
  api.retryCorrection(draft);
  assert.equal(calls.at(-1)[0], "issue");
  api.refuseBusyNote();
  assert.match(calls.at(-1)[1], /Finishing/);
  for (const [id, mode] of [
    ["btn-void", "void"],
    ["btn-recordnote", "recordnote"],
    ["btn-reconcile", "reconcile"],
  ]) {
    api.openRecordAction({ id });
    assert.equal(s.state.modal, mode);
    assert.equal(s.state.amendmentError, "");
  }
  const before = structuredClone(src);
  calls = [];
  locked = true;
  api.withdrawItem(draft, { dataset: { withdraw: "item" } });
  assert.deepEqual(calls, []);
  locked = false;
  for (const reason of [null, "short"]) {
    answer = reason;
    api.withdrawItem(draft, { dataset: { withdraw: "item" } });
    assert.equal(draft.items[0].withdrawn, undefined);
  }
  answer = "Entered under wrong ordinance";
  api.withdrawItem(draft, { dataset: { withdraw: "item" } });
  assert.equal(draft.items[0].withdrawn, true);
  assert.equal(draft.items[0].withdrawalReason, answer);
  assert.equal(draft.correction.reviewed, false);
  assert.deepEqual(src, before);
  api.withdrawItem(draft, { dataset: { withdraw: "item" } });
  assert.equal(draft.items[0].withdrawn, undefined);
  src.items[0].withdrawn = true;
  draft.items[0].withdrawn = true;
  api.withdrawItem(draft, { dataset: { withdraw: "item" } });
  assert.equal(draft.items[0].withdrawn, true);
  assert.match(calls.at(-1)[1], /prior revision/);
  delete src.items[0].withdrawn;
  delete draft.items[0].withdrawn;
  draft.pendingAmendment = { id: "retained" };
  const frozen = structuredClone(draft);
  calls = [];
  api.editActionDate({ value: "2026-10-20" });
  api.editCorrectionReason({ id: "correction-reason", value: "Changed" });
  api.changeCorrection({ target: { id: "correction-type", value: "referral" } });
  assert.deepEqual(draft, frozen);
  assert.deepEqual(calls, []);
  delete draft.pendingAmendment;
  api.editActionDate({ value: "2026-10-20" });
  assert.equal(draft.correction.actionDate, "2026-10-20");
  api.editCorrectionReason({ id: "correction-reason", value: "Reason" });
  api.editCorrectionReason({ id: "correction-external", value: "Authority" });
  assert.equal(draft.correction.reason, "Reason");
  assert.equal(draft.correction.externalReference, "Authority");
  allow = false;
  api.changeCorrection({ target: { id: "correction-type", value: "referral" } });
  assert.equal(draft.type, "notice");
  allow = true;
  api.changeCorrection({ target: { id: "correction-type", value: "referral" } });
  assert.equal(draft.type, "referral");
  assert.equal(draft.items[0].hist[0].observed, "retained");
  api.changeCorrection({ target: { id: "", dataset: { correctionOutcome: "item" }, value: "corrected" } });
  assert.equal(draft.items[0].doneOn, "2026-10-25");
  assert.equal(draft.correction.outcomes.item, "corrected");
  api.changeCorrection({ target: { id: "", dataset: { correctionOutcome: "item" }, value: "none" } });
  assert.equal(draft.items[0].done, false);
  assert.equal(draft.items[0].doneOn, "");
  s.state.modal = "void";
  const button = document.getElementById("record-action-go");
  api.commitRecordAction(button, src);
  assert.equal(button.disabled, true);
  assert.deepEqual(calls.at(-1), ["void", "source", "Typed note", "External review", "officer"]);
  // The screen may have rerendered during the request; restore values on the current controls.
  document.body.innerHTML = '<input id="record-action-text"><input id="record-action-external"><button id="record-action-go" disabled></button>';
  resolveAction(false);
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(document.getElementById("record-action-text").value, "Typed note");
  assert.equal(document.getElementById("record-action-external").value, "External review");
  assert.equal(document.getElementById("record-action-go").disabled, false);
  dom.window.close();
  console.log(
    "PASS correction events: retained/pending guards, source immutability, withdrawal/refusal, type/outcome review and replaced async controls",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
