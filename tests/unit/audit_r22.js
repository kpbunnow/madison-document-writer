/* R22 reconciler, catalog, recovery, artifact and details regressions. Synthetic DOM. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
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
global.confirm = () => true;
global.prompt = () => "";
global.URL = { createObjectURL: () => "", revokeObjectURL() {} };
global.Blob = function () {};
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};
const test = async () => {
  await new Promise((r) => setTimeout(r, 30));
  scheduleDraftSave = () => {};
  const k = kase("k1");
  k.savedAt = nowISO();
  WriterState.SAVE_CHECKPOINTS[k.id] = { case: caseDetails(k), events: [] };
  const shared = caseFile(k.id);
  k.owner = "LOCAL OWNER";
  assert.equal(compareSharedCase(k, [], shared, WriterState.SAVE_CHECKPOINTS[k.id]).kind, "local-only");
  assert.equal(
    (
      await recoverySharedState({
        bundle: { cases: [clone(k)], events: { [k.id]: [] }, checkpoints: { [k.id]: WriterState.SAVE_CHECKPOINTS[k.id] } },
      })
    ).kind,
    "unavailable",
  );
  shared.case.address = "SHARED STREET";
  const compatible = compareSharedCase(k, [], shared, WriterState.SAVE_CHECKPOINTS[k.id]);
  assert.equal(compatible.kind, "compatible");
  assert.equal(compatible.merged.owner, "LOCAL OWNER");
  assert.equal(compatible.merged.address, "SHARED STREET");
  shared.case.owner = "OTHER OWNER";
  assert.equal(compareSharedCase(k, [], shared, WriterState.SAVE_CHECKPOINTS[k.id]).kind, "conflict");
  shared.case.owner = WriterState.SAVE_CHECKPOINTS[k.id].case.owner;
  shared.events.push({ id: "remote1", type: "case.note", at: nowISO(), payload: { text: "issued" } });
  newDoc(k.id, "notice");
  const draftId = WriterState.state.docId;
  assert.equal(compareSharedCase(k, [], shared, WriterState.SAVE_CHECKPOINTS[k.id]).kind, "history-conflict");
  let ran = false;
  WriterState.CASEDIR = { helper: true };
  WriterState.state.screen = "cases";
  WriterState.state.docId = null;
  WriterState.state.reinspId = null;
  const priorHelper = helperJSON;
  helperJSON = async () => ({ file: caseFile(k.id) });
  assert.equal(await preflightCase(k.id, "draft", () => (ran = true)), true);
  assert.equal(ran, true);
  const formKey = catalogKey(allItems().find((i) => i.p !== "draft" && i.s.length));
  WriterState.CATALOG_VERIFIED = true;
  WriterState.CATALOG_EVENTS = [];
  assert.equal(catalogStatus(catalogItem(formKey)).code, "legacy");
  WriterState.CATALOG_EVENTS = [{ id: "review1", key: formKey, version: 1, status: "retired", at: nowISO() }];
  helperJSON = async () => {
    throw new Error("storage offline");
  };
  await refreshCatalog();
  assert.equal(catalogStatus(catalogItem(formKey)).code, "retired");
  assert.match(WriterState.CATALOG_ERROR, /Last verified/);
  WriterState.CATALOG_EVENTS = [
    {
      id: "review2",
      key: formKey,
      version: 2,
      status: "approved",
      reviewer: "QA",
      at: nowISO(),
      wording: "UNIQUE REVIEWED WORDING",
      ordinances: ["SPECIAL 77"],
      source: "synthetic",
    },
  ];
  assert.equal(effectiveCatalog(catalogItem(formKey)).a, "UNIQUE REVIEWED WORDING");
  WriterState.state.libFilter = "SPECIAL 77";
  WriterState.state.screen = "library";
  assert.match(screenLibrary(), /UNIQUE REVIEWED WORDING/);
  const baseDoc = doc(draftId);
  const selection = catalogSelection(catalogItem(formKey));
  assert.equal(selection.a, "UNIQUE REVIEWED WORDING");
  assert.equal(selection.catalogReviewId, "review2");
  const f = catalogForm(formKey, catalogItem(formKey), catalogReview(formKey));
  WriterState.CATALOG_FORMS[formKey] = { ...f, reviewer: "Unsubmitted name", open: true };
  keepCatalogForms();
  WriterState.state.libFilter = "something else";
  assert.match(catalogReviewPanel(catalogItem(formKey)), /Unsubmitted name/);
  assert.equal(JSON.parse(localStorage.getItem("madison-catalog-forms-v1"))[formKey].reviewer, "Unsubmitted name");
  WriterState.WORK.recordForms = { [baseDoc.id + ":note"]: { text: "Unfinished record note" } };
  assert(recoveryIncluded(k.id).some((x) => x.includes("record form")));
  const backup = recoverySnapshot(k.id, recoveryCaseKey(k.id));
  assert.equal(backup.bundle.work.recordForms[baseDoc.id + ":note"].text, "Unfinished record note");
  const imported = {
    workspace: backup.workspace,
    case: backup.case,
    number: backup.number,
    name: "Imported file",
    imported: JSON.parse(JSON.stringify(backup)),
  };
  WriterState.RECOVERY.list = [imported];
  WriterState.state.modal = "recovery";
  helperJSON = async () => ({ file: caseFile(k.id) });
  await selectRecovery(imported);
  assert.equal(WriterState.RECOVERY.selected.case, backup.case);
  assert.throws(
    () => validateRecovery({ ...backup, bundle: { ...backup.bundle, docs: [{ ...backup.bundle.docs[0], caseId: "unrelated" }] } }, imported),
    /unrelated/,
  );
  const priorGet = idbGet,
    priorSet = idbSet,
    device = { pending: [{ id: "old" }], drafts: { old: true } };
  idbGet = async (key) => device[key];
  idbSet = async (key, value) => {
    if (key === "drafts" && !value.old) return false;
    device[key] = value;
    return true;
  };
  assert.equal(await persistRecoveryState({ replacement: true }, [{ id: "new" }]), false);
  assert.equal(device.pending[0].id, "old");
  assert.equal(device.drafts.old, true);
  idbGet = priorGet;
  idbSet = priorSet;
  WriterState.state.modal = null;
  const captured = [];
  WriterState.HELPER = { caseStore: true };
  helperJSON = async (url, body) => {
    if (url === "/artifact/status") {
      captured.push(body.items.length);
      if (body.items.some((x) => x.docId === "bad")) throw new Error("Invalid artifact status identity");
      return { items: body.items.map((x) => ({ docId: x.docId, locations: ["local"] })) };
    }
    return { ok: true };
  };
  WriterState.DOCS = Array.from({ length: 600 }, (_, i) => ({
    id: "pdf" + i,
    caseId: k.id,
    draft: false,
    filedAt: nowISO(),
    filedArtifact: { filename: "file" + i + ".pdf", sha256: "a".repeat(64) },
  }));
  WriterState.DOCS.push({ id: "bad", caseId: k.id, draft: false, filedAt: nowISO(), filedArtifact: { filename: "bad.pdf", sha256: "a".repeat(64) } });
  await refreshArtifactLocations();
  assert(captured.every((n) => n <= 100));
  assert.equal(
    captured.slice(0, 7).reduce((a, b) => a + b, 0),
    601,
  );
  assert.equal(WriterState.ARTIFACT_VERIFY.bad, "invalid");
  assert.equal(WriterState.ARTIFACT_LOCATIONS.pdf599[0], "local");
  for (const count of [0, 1, 200, 201, 600]) {
    WriterState.DOCS = Array.from({ length: count }, (_, i) => ({
      id: "size" + i,
      caseId: k.id,
      draft: false,
      filedAt: nowISO(),
      filedArtifact: { filename: "size" + i + ".pdf", sha256: "b".repeat(64) },
    }));
    captured.length = 0;
    await refreshArtifactLocations();
    assert(captured.every((n) => n <= 100));
    assert.equal(Object.values(WriterState.ARTIFACT_VERIFY).filter((x) => x === "verified").length, count);
  }
  WriterState.DOCS = Array.from({ length: 201 }, (_, i) => ({
    id: "partial" + i,
    caseId: k.id,
    draft: false,
    filedAt: nowISO(),
    filedArtifact: { filename: "partial" + i + ".pdf", sha256: "c".repeat(64) },
  }));
  helperJSON = async (url, body) => {
    if (body.items.some((x) => x.docId === "partial100")) throw new Error("Shared storage unavailable");
    return { items: body.items.map((x) => ({ docId: x.docId, locations: ["local"] })) };
  };
  await refreshArtifactLocations();
  assert.equal(WriterState.ARTIFACT_VERIFY.partial0, "verified");
  assert.equal(WriterState.ARTIFACT_VERIFY.partial100, "unavailable");
  assert.equal(WriterState.ARTIFACT_VERIFY.partial200, "verified");
  helperJSON = async () => {
    throw new Error("Storage unavailable");
  };
  await refreshArtifactLocations();
  assert.equal(WriterState.ARTIFACT_LOCATIONS.partial0[0], "local");
  assert.equal(WriterState.ARTIFACT_VERIFY.partial0, "unavailable");
  assert.match(pdfTransferState(WriterState.DOCS[0]), /last verified/);
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  WriterState.REINSP = [];
  newDoc(k.id, "notice");
  const n = doc(WriterState.state.docId);
  n.items = [{ id: "detail-one", no: "1", sections: ["1"], title: "One", text: "Fix", due: addDays(iso(today), 21), prov: "notice" }];
  issueDocument(n);
  startReinspection(k.id);
  const r = reinsp(WriterState.state.reinspId);
  r.time = "10:00";
  r.followupIntent = "extension";
  clearWalk();
  WriterState.state.riWalk = true;
  WriterState.state.riWalkContext = walkIdentity(r);
  WriterState.state.riWalkItem = "detail-one";
  WriterState.state.riWalkMode = "details";
  assert(recordReinspectionOutcome("detail-one", "progress"));
  assert.equal(WriterState.state.riWalkStage, "details");
  assert.equal(advanceWalk(r), false);
  assert.equal(WriterState.state.riWalkItem, "detail-one");
  assert.equal(skipWalkDetails(r), true);
  assert(WriterState.state.riWalkSkipped.includes("detail-one"));
  assert(returnWalkDetails(r));
  assert.equal(WriterState.state.riWalkItem, "detail-one");
  r.results["detail-one"].note = "A later observation";
  assert(undoWalkOutcome());
  assert.equal(r.results["detail-one"].note, "A later observation");
  assert.equal(r.results["detail-one"].oc, "");
  r.followupIntent = "referral";
  recordReinspectionOutcome("detail-one", "progress");
  assert.equal(walkItemReady(r, "detail-one"), true);
  helperJSON = priorHelper;
  console.log("R22 Writer focused checks passed");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
