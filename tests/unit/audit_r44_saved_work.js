/* R44 states and actions must describe the actual owner; no replacement save protocol. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
// Expose only this private diagnostic inside the test's evaluated bundle; production stays unchanged.
const original = bundleSource(builtPage());
const src = original.replace(/return \{ shell: (\w+) \};/, "return { shell: $1, storageBar };");
assert.ok(src !== original, "the shell diagnostic must be attached to its actual factory");
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.FormData = dom.window.FormData;
global.localStorage = dom.window.localStorage;
global.getSelection = () => window.getSelection();
global.fetch = async () => {
  throw Error("offline");
};
window.scrollTo = () => {};
window.HTMLDialogElement.prototype.showModal = function () {
  this.open = true;
};
window.HTMLDialogElement.prototype.close = function () {
  this.open = false;
  this.dispatchEvent(new window.Event("close"));
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 40));
  scheduleRecoveryBackup = () => {};
  scheduleDraftSave = () => {};
  WriterState.CASES = [{ id: "r44", number: "QA-R44", address: "4400 SYNTHETIC STREET", date: recordDay(today), time: "09:00", inspectorId: "i4" }];
  WriterState.EVENTS = {};
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.PENDING = [];
  WriterState.RECORD_ATTEMPTS = {};
  WriterState.SAVE_CHECKPOINTS = {};
  WriterState.HELPER = { ok: true };
  WriterState.CASEDIR = { helper: true };
  WriterState.NEEDGRANT = false;
  WriterState.LOCAL_SAVE = { ok: true, at: nowISO(), saving: false };
  const k = WriterState.CASES[0];
  rememberSaved(k, caseFile(k.id));
  COMMITTED.clear();
  assert.equal(safetyCaseStatus(k)[0], "Shared copy needs check", "A restored checkpoint is not a current helper read");
  COMMITTED.set(summaryName(k), { file: caseFile(k.id) });
  assert.equal(safetyCaseStatus(k)[0], "Shared copy current");
  WriterState.CASEDIR = null;
  assert.equal(safetyCaseStatus(k)[0], "Waiting for connection");
  assert.equal(safetyCaseStatus(k)[2], "storage");
  WriterState.CASEDIR = { helper: true };
  idbSet = async () => true;
  newDoc(k.id, "notice");
  await saveDrafts();
  let d = doc(WriterState.state.docId);
  assert.equal(safetyCaseStatus(k)[2], "document");
  WriterState.LOCAL_SAVE.ok = false;
  render();
  assert.match(document.querySelector("[data-document-device-save]").textContent, /Not saved/);
  assert.ok(!workspaceShell.storageBar().includes("Nothing has been lost"));
  // Real device-save failure keeps all edits and subsequently clears the resolved navigation alert.
  const originalSet = idbSet;
  idbSet = async () => false;
  await saveDrafts();
  assert.equal(WriterState.LOCAL_SAVE.ok, false);
  assert.ok(doc(d.id));
  idbSet = async () => true;
  await saveDrafts();
  assert.equal(WriterState.LOCAL_SAVE.ok, true);
  idbSet = originalSet;
  const attempt = { eventId: "same-operation", sourceHash: "retained-source", payload: { snapshot: clone(d) } };
  d.pendingAmendment = attempt;
  const before = stableJSON(d.pendingAmendment);
  assert.equal(safetyCaseStatus(k)[0], "Save confirmation needed");
  assert.equal(safetyCaseStatus(k)[2], "pending");
  assert.equal(stableJSON(d.pendingAmendment), before);
  delete d.pendingAmendment;
  WriterState.PREFLIGHT_CONFLICT = { cid: k.id };
  assert.equal(safetyCaseStatus(k)[2], "conflict");
  WriterState.PREFLIGHT_CONFLICT = null;
  const originalStatus = recordIntegrity.status;
  recordIntegrity.status = () => ({ valid: false });
  assert.equal(safetyCaseStatus(k)[2], "integrity");
  recordIntegrity.status = originalStatus;
  d.draft = false;
  d.status = "Final";
  assert.equal(safetyCaseStatus(k)[0], "PDF filing needed");
  assert.equal(safetyCaseStatus(k)[2], "pdf");
  d.filedAt = nowISO();
  assert.equal(safetyCaseStatus(k)[2], "pdf", "A filed marker is not archived PDF proof");
  const originalTransfer = pdfTransferState;
  pdfTransferState = () => "local outbox";
  assert.equal(safetyCaseStatus(k)[2], "outbox");
  pdfTransferState = () => "shared";
  assert.notEqual(safetyCaseStatus(k)[2], "pdf");
  pdfTransferState = originalTransfer;
  WriterState.PENDING = [{ cid: k.id, name: caseFileName(k), body: "{}" }];
  WriterState.CASEDIR = null;
  assert.equal(safetyCaseStatus(k)[2], "storage");
  WriterState.CASEDIR = { helper: true };
  assert.equal(safetyCaseStatus(k)[2], "save");
  WriterState.PENDING = [];
  // Slow health cannot hide recovery, overwrite a newer utility or steal focus/disclosures.
  let finish;
  helperJSON = async () => await new Promise((resolve) => (finish = resolve));
  const pending = showSafety(k.id);
  assert.ok(document.querySelector("[data-saved-work-panel]"));
  document.querySelector("[data-saved-detail=recovery]").open = true;
  document.getElementById("btn-recovery").focus();
  finish({ ok: true, caseReachable: true, outbox: 0 });
  await pending;
  assert.ok(document.querySelector("[data-saved-detail=recovery]").open);
  assert.equal(document.activeElement.id, "btn-recovery");
  const summaryWait = showSafety(k.id);
  const summary = document.querySelector("[data-saved-detail=recovery] > summary");
  summary.parentElement.open = true;
  summary.focus();
  finish({ ok: true, caseReachable: true, outbox: 0 });
  await summaryWait;
  assert.equal(document.activeElement, document.querySelector("[data-saved-detail=recovery] > summary"), "Late health retains summary focus");
  WriterState.PENDING = [{ cid: k.id, name: caseFileName(k), body: "{}" }];
  const caseWait = showSafety(k.id);
  document.querySelector("[data-safety-case]").focus();
  finish({ ok: true, caseReachable: false, outbox: 0 });
  await caseWait;
  assert.equal(document.activeElement.dataset.safetyCase, k.id);
  assert.equal(document.activeElement.dataset.safetyAction, "storage", "Health may change the action without losing case focus");
  WriterState.PENDING = [];
  WriterState.RECOVERY.at = nowISO();
  WriterState.RECOVERY.error = "";
  const nestedWait = showSafety(k.id);
  document.querySelector("[data-saved-detail=recovery]").open = true;
  const nested = document.querySelector("[data-saved-detail=automatic-backup]");
  nested.open = true;
  nested.querySelector("summary").focus();
  finish({ ok: true, caseReachable: true, outbox: 0 });
  await nestedWait;
  assert.ok(document.querySelector("[data-saved-detail=automatic-backup]").open);
  assert.equal(document.activeElement, document.querySelector("[data-saved-detail=automatic-backup] > summary"));
  A11Y.notify("Synthetic utility conflict", { severity: "error" });
  await Promise.resolve();
  assert.equal(document.querySelectorAll("#utility-dialog [role=alert]").length, 1);
  assert.ok(document.querySelector("#utility-dialog [role=alert]").textContent.includes("Synthetic utility conflict"));
  const late = showSafety();
  A11Y.utility("Newer task", "<p>Keep this task.</p>");
  finish({ ok: true, outbox: 99 });
  await late;
  assert.equal(document.getElementById("utility-title").textContent, "Newer task");
  helperJSON = async () => {
    throw Error("Synthetic unavailable share");
  };
  await showSafety();
  assert.match(document.querySelector("[data-saved-work-panel]").textContent, /Outbox count not checked/);
  assert.ok(!document.querySelector("[data-saved-work-panel]").textContent.includes("0 PDFs reported"));
  helperJSON = async () => ({ files: [] });
  WriterState.HELPER.outbox = 5;
  await showOutbox();
  assert.equal(WriterState.HELPER.outbox, 0, "A fresh empty outbox clears the cached transfer count");
  WriterState.state.screen = "tools";
  document.getElementById("utility-dialog").close();
  render();
  assert.equal(
    document.querySelectorAll(".tools-section .tool-action").length,
    10,
    "Tools retains one saved-work entry, open case and dedicated order-language review",
  );
  for (const sel of ["#btn-workbackup", "#btn-recovery", "#btn-workrestore", "[data-outbox]", "[data-setup-health]", "#btn-storage"])
    assert.equal(document.querySelectorAll(".tools-section " + sel).length, 0, sel);
  // Deduplicate persistent errors without erasing distinct operation confirmations or Undo callbacks.
  for (const el of document.querySelectorAll("[data-message-dismiss]")) el.click();
  A11Y.notify("Synthetic unresolved share", { severity: "error" });
  A11Y.notify("Synthetic unresolved share", { severity: "error" });
  await Promise.resolve();
  assert.equal([...document.querySelectorAll("[data-message]")].filter((el) => el.textContent.includes("Synthetic unresolved share")).length, 1);
  assert.equal(JSON.parse(localStorage.getItem("madison-message-history-v1")).filter((m) => m.text === "Synthetic unresolved share").length, 1);
  A11Y.notify("Synthetic device failure", { severity: "error", key: "test-device" });
  await Promise.resolve();
  [...document.querySelectorAll("[data-message]")]
    .find((el) => el.textContent.includes("Synthetic device failure"))
    .querySelector("button")
    .click();
  A11Y.notify("Synthetic device failure", { severity: "error", key: "test-device" });
  await Promise.resolve();
  assert.ok(![...document.querySelectorAll("[data-message]")].some((el) => el.textContent.includes("Synthetic device failure")));
  A11Y.resolve("test-device");
  A11Y.notify("Synthetic device failure", { severity: "error", key: "test-device" });
  await Promise.resolve();
  assert.ok([...document.querySelectorAll("[data-message]")].some((el) => el.textContent.includes("Synthetic device failure")));
  console.log(
    "PASS R44 device failure/retry, shared states, pending identity, conflict" +
      "s, PDF evidence, offline queue, immediate recovery, late health focus, c" +
      "onsolidated tools and deduplicated persistent history",
  );
  process.exit(0);
};
eval(src + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
