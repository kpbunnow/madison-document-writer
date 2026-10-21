/* R21 cross-workflow browser-model regressions. Live Chromium is separate. */
globalThis.MADISON_TEST_DATA = true;
const { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  payload = bundleSource(html);
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
const w = dom.window;
global.window = w;
global.document = w.document;
global.localStorage = w.localStorage;
global.getSelection = () => w.getSelection();
global.confirm = () => true;
global.prompt = () => "";
global.URL = { createObjectURL: () => "test", revokeObjectURL() {} };
global.Blob = function () {};
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};
const test = async () => {
  const assert = require("assert");
  const originalSchedule = scheduleDraftSave;
  scheduleDraftSave = () => {};
  WriterState.CATALOG_VERIFIED = true;
  const all = allItems();
  assert.equal(all.length, 250);
  assert.equal(all.filter((i) => i.p === "draft").length, 130);
  assert.equal(all.filter((i) => !i.s.length).length, 10);
  const pending = all.find((i) => i.p === "draft" && i.s.length && i.legacyKeys?.length);
  assert.equal(catalogStatus(pending).code, "review");
  const key = catalogKey(pending),
    legacy = pending.legacyKeys[0],
    event = {
      key,
      status: "approved",
      version: 1,
      id: "review-1",
      reviewer: "QA reviewer",
      at: "2026-10-01T01:00:00Z",
      wording: "Approved and reviewed wording",
      ordinances: ["27.05(2)(c)"],
      source: "Division review",
      replaces: JSON.stringify(legacy.split("/").map((x, n) => (n === 2 ? +x : x))),
    };
  WriterState.CATALOG_EVENTS = [event];
  assert.equal(catalogStatus(pending).code, "ready");
  assert.equal(catalogSelection(pending).a, event.wording);
  const old = all.find((i) => catalogKey(i) === event.replaces);
  if (old) assert.equal(catalogStatus(old).code, "superseded");
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  newDoc("k1", "notice");
  let d = doc(WriterState.state.docId);
  toggleLibraryItem(d, pending.ci, pending.gi, { ...pending, catalogVersion: 0 });
  const prior = d.items[0];
  prior.text = "Inspector edited wording";
  assert.equal(catalogDraftBlocked(prior), true);
  assert.match(catalogDraftNotice(prior), /Review and use v1/);
  const retained = prior.id;
  assert.equal(adoptCatalogReview(d, prior), true);
  assert.equal(prior.id, retained);
  assert.equal(prior.text, event.wording);
  assert.equal(catalogDraftBlocked(prior), false);
  d.items = [
    { id: "fixed-one", no: "1", title: "One", sections: ["27.05(2)(c)"], text: "One", due: "", prov: "notice" },
    { id: "fixed-two", no: "2", title: "Two", sections: ["27.05(2)(c)"], text: "Two", due: "", prov: "notice" },
  ];
  render();
  document.querySelector('[data-move="fixed-one"][data-direction="down"]').click();
  assert.deepEqual(
    d.items.map((x) => x.id),
    ["fixed-two", "fixed-one"],
  );
  const grip = document.querySelector('[data-grip="fixed-one"]');
  grip.focus();
  grip.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }));
  assert.deepEqual(
    d.items.map((x) => x.id),
    ["fixed-one", "fixed-two"],
  );
  assert.equal(document.activeElement.dataset.grip, "fixed-one");
  d.items[0].due = "";
  d.items[1].due = "bad";
  const noticeId = d.id;
  issueDocument(d);
  d = doc(noticeId);
  let st = caseState(kase("k1"));
  assert.equal(st.due, "");
  assert.equal(st.days, null);
  assert.equal(st.soon, false);
  d.items[0].due = iso(today);
  st = caseState(kase("k1"));
  assert.equal(st.soon, true);
  assert.equal(st.days, 0);
  const extra = { ...clone(d), id: uid("d"), type: "extension", draft: false, filedAt: null };
  WriterState.DOCS.push(extra);
  assert.equal(workspaceTasks([{ k: kase("k1"), st: caseState(kase("k1")) }]).find((t) => t.key === "filing").count, 2);
  d.filedAt = "2026-10-01T00:00:00Z";
  d.filedArtifact = { filename: "archived.pdf", sha256: "a".repeat(64) };
  WriterState.ARTIFACT_LOCATIONS[d.id] = ["local"];
  assert.equal(pdfTransferState(d), "local outbox");
  assert.equal(workspaceTasks([{ k: kase("k1"), st: caseState(kase("k1")) }]).find((t) => t.key === "outbox").count, 1);
  WriterState.ARTIFACT_LOCATIONS[d.id] = ["shared"];
  assert.equal(pdfTransferState(d), "shared");
  WriterState.ARTIFACT_LOCATIONS[d.id] = ["shared conflict"];
  assert.equal(pdfTransferState(d), "artifact conflict");
  assert.equal(workspaceTasks([{ k: kase("k1"), st: caseState(kase("k1")) }]).find((t) => t.key === "artifacts").count, 1);
  WriterState.ARTIFACT_LOCATIONS = {};
  delete d.filedAt;
  delete d.filedArtifact;
  d.items[0].due = addDays(iso(today), 21);
  d.items[1].due = addDays(iso(today), 28);
  startReinspection("k1");
  const visit = reinsp(WriterState.state.reinspId);
  visit.time = "10:00";
  render();
  document.querySelector('[data-riwalk="on"]').click();
  const mode = document.getElementById("ri-walk-mode");
  mode.value = "details";
  mode.dispatchEvent(new w.Event("change", { bubbles: true }));
  const first = d.items[0].id;
  document.querySelector('[data-setoc="progress"][data-item="' + first + '"]').click();
  assert.equal(WriterState.state.riWalkItem, first);
  assert.equal(WriterState.state.riWalkStage, "details");
  const note = document.querySelector('[data-rinote="' + first + '"]');
  note.value = "Observed work";
  note.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert.equal(visit.results[first].note, "Observed work");
  document.querySelector('[data-action-group="enforcement"]').click();
  document.querySelector('[data-action-type="referral"]').click();
  assert.equal(visit.followupIntent, "referral");
  assert.equal(visit.results[first].due, "");
  document.querySelector("[data-riwalk-next]").click();
  assert.equal(WriterState.state.riWalkItem, d.items[1].id);
  document.querySelector("[data-riwalk-prev]").click();
  assert.equal(WriterState.state.riWalkItem, first);
  assert.equal(visit.results[first].note, "Observed work");
  captureWork();
  const saved = clone(draftBundle());
  assert.equal(saved.work.walk.context, walkIdentity(visit));
  clearWalk();
  WriterState.state.screen = "cases";
  WriterState.WORK.walk = saved.work.walk;
  startReinspection("k1");
  assert.equal(WriterState.state.riWalkMode, "details");
  assert.equal(WriterState.state.riWalkItem, first);
  const before = JSON.stringify(visit.results);
  assert.equal(recordReinspectionOutcome("unrelated-id", "corrected"), false);
  assert.equal(JSON.stringify(visit.results), before);
  // The recipient link opens the exact locality control without changing text.
  newDoc("k2", "notice");
  d = doc(WriterState.state.docId);
  kase("k2").ccList = [{ name: "Copy", addr: "123 Main St", city: "Madison, ZZ 53703" }];
  d.items = [{ id: "ccitem", no: "1", sections: ["27.05(2)(c)"], title: "Item", text: "Work", due: addDays(iso(today), 21), prov: "notice" }];
  render();
  const recipient = checks(d).find((c) => /Copy 1:/.test(c.t));
  assert(recipient);
  focusCheckTarget(recipient.targets[0], recipient.t);
  assert.equal(WriterState.state.modal, "cc");
  assert.equal(document.activeElement.dataset.cc, "0|city");
  assert.equal(document.activeElement.getAttribute("aria-describedby"), "cc-address-error");
  // A late shared response cannot switch cases or mutate an active draft.
  WriterState.state.modal = null;
  WriterState.state.screen = "cases";
  let resolveShared;
  const oldFolder = WriterState.CASEDIR,
    oldHelper = helperJSON;
  WriterState.CASEDIR = { helper: true };
  helperJSON = () =>
    new Promise((resolve) => {
      resolveShared = resolve;
    });
  let ran = false;
  const waiting = preflightCase("k2", "draft", () => {
    ran = true;
  });
  WriterState.state.screen = "library";
  resolveShared({ file: caseFile("k2") });
  await waiting;
  assert.equal(ran, false);
  assert.equal(d.draft, true);
  helperJSON = oldHelper;
  WriterState.CASEDIR = oldFolder;
  // A selected backup restores one case into an occupied workspace and keeps
  // a pending operation identity; older formats fail before any mutation.
  WriterState.state.screen = "cases";
  WriterState.WORK.recordForms = { [d.id + ":note"]: { reason: "Backed-up note" } };
  const backup = recoverySnapshot("k2", recoveryCaseKey("k2"));
  backup.pending = [{ cid: "k2", name: "pending.json", body: JSON.stringify(caseFile("k2")), at: "2026-10-01T01:00:00Z" }];
  const row = { workspace: backup.workspace, case: backup.case, number: backup.number, name: "snapshot.json" };
  assert.throws(() => validateRecovery({ ...backup, version: 0 }, row), /unsupported/);
  const attemptsBefore = Object.keys(WriterState.RECORD_ATTEMPTS).length;
  WriterState.RECOVERY.list = [row];
  WriterState.RECOVERY.selected = backup;
  WriterState.RECOVERY.shared = { kind: "unchanged", detail: "Shared issued history matches the backup." };
  WriterState.state.modal = "recovery";
  const oldSet = idbSet,
    oldGet = idbGet,
    oldBackupHelper = helperJSON;
  const changed = caseFile("k2");
  changed.events.push({ id: "later-event", type: "case.note", payload: { note: "Later work" }, at: "2026-10-01T01:01:00Z" });
  helperJSON = async () => ({ file: changed });
  assert.equal((await recoverySharedState(backup)).kind, "history-conflict");
  helperJSON = async () => {
    throw new Error("Network disconnected");
  };
  assert.equal(recoverySharedConflict(await recoverySharedState(backup)), false);
  helperJSON = async () => {
    const e = new Error("Invalid shared JSON");
    e.definitive = true;
    throw e;
  };
  assert.equal(recoverySharedConflict(await recoverySharedState(backup)), true);
  helperJSON = oldBackupHelper;
  idbSet = async () => true;
  idbGet = async () => null;
  helperJSON = async () => ({ ok: true, file: caseFile("k2") });
  const oldConfirm = global.confirm;
  global.confirm = () => true;
  WriterState.WORK.recordForms = {};
  await restoreRecovery();
  assert(WriterState.PENDING.some((p) => p.name === "pending.json"));
  assert.equal(WriterState.WORK.recordForms[d.id + ":note"].reason, "Backed-up note");
  assert.equal(Object.keys(WriterState.RECORD_ATTEMPTS).length, attemptsBefore);
  idbSet = oldSet;
  idbGet = oldGet;
  helperJSON = oldBackupHelper;
  global.confirm = oldConfirm;
  scheduleDraftSave = originalSchedule;
  console.log("R21 Writer focused checks passed");
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
