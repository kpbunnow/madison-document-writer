/* Focused, single-item reinspection walk-through regression tests. */
globalThis.MADISON_TEST_DATA = true;
// Consolidation Phase 2 (T1): run remaining long UI timers once the suite completes instead of waiting.
const { settle } = require("../fixtures/settle_ui_timers.cjs");
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
global.getSelection = () => w.getSelection();
global.confirm = () => true;
global.prompt = () => "";
global.URL = { createObjectURL: () => "test", revokeObjectURL() {} };
global.Blob = function () {};
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};
const test = async () => {
  const failures = [];
  let count = 0;
  const ok = (label, condition) => {
    count++;
    if (!condition) {
      failures.push(label);
      console.log("FAIL " + label);
    }
  };
  const originalSchedule = scheduleDraftSave;
  scheduleDraftSave = () => {};
  WriterState.DOCS.length = 0;
  WriterState.REINSP.length = 0;
  WriterState.EVENTS = {};
  WriterState.state.docId = null;
  WriterState.state.reinspId = null;
  WriterState.state.riWalk = false;
  WriterState.state.riWalkItem = null;
  WriterState.state.riWalkUndo = null;
  WriterState.state.riFilter = "";
  newDoc("k1", "notice");
  const n = doc(WriterState.state.docId);
  n.items = Array.from({ length: 4 }, (_, i) => ({
    id: uid("walk"),
    no: String(i + 1),
    sections: ["27.05(2)(c)"],
    title: "Walk item " + (i + 1),
    text: "Inspect condition " + (i + 1),
    due: futureDue(iso(today), 21),
    prov: "notice",
    done: false,
    doneOn: "",
  }));
  issueDocument(n);
  startReinspection("k1");
  const r = reinsp(WriterState.state.reinspId);
  r.time = "10:00";
  WriterState.state.screen = "reinspect";
  render();
  document.querySelector('[data-riwalk="on"]').click();
  ok(
    "walk-through starts at first unresolved item",
    WriterState.state.riWalk &&
      WriterState.state.riWalkItem === doc(r.sourceDocId).items[0].id &&
      document.querySelector('[data-ri-walk-current="true"]'),
  );
  ok(
    "walk mode displays four outcome shortcuts",
    /1<\/kbd> Corrected/.test(document.querySelector(".ri-walk-panel").innerHTML) &&
      /4<\/kbd> No access/.test(document.querySelector(".ri-walk-panel").innerHTML),
  );
  ok(
    "walk mode keeps results item-specific",
    document.querySelectorAll("[data-setoc][data-item]").length === 16 && !/apply to all/i.test(document.body.textContent),
  );
  const press = (key, repeat = false) =>
    document.activeElement.dispatchEvent(new w.KeyboardEvent("keydown", { key, repeat, bubbles: true, cancelable: true }));
  press("2");
  ok(
    "shortcut 2 records Progress made for only the active item",
    r.results[doc(r.sourceDocId).items[0].id]?.oc === "progress" && Object.keys(r.results).length === 1,
  );
  ok(
    "result advances and focuses the next unresolved item",
    WriterState.state.riWalkItem === doc(r.sourceDocId).items[1].id && document.activeElement.dataset.item === WriterState.state.riWalkItem,
  );
  press("3", true);
  ok(
    "held keys do not spill outcomes onto the next item",
    !r.results[doc(r.sourceDocId).items[1].id] && WriterState.state.riWalkItem === doc(r.sourceDocId).items[1].id,
  );
  const second = WriterState.state.riWalkItem;
  document.querySelector('[data-setoc="corrected"][data-item="' + second + '"]').click();
  ok(
    "mouse selection advances the same way as a shortcut",
    r.results[second]?.oc === "corrected" && WriterState.state.riWalkItem === doc(r.sourceDocId).items[2].id,
  );
  document.querySelector("[data-riwalk-undo]").click();
  ok(
    "Undo restores the previous unanswered state",
    !r.results[second] && WriterState.state.riWalkItem === second && document.activeElement.dataset.item === second,
  );
  press("4");
  ok("shortcut 4 records No access", r.results[second]?.oc === "noaccess" && WriterState.state.riWalkItem === doc(r.sourceDocId).items[2].id);
  press("u");
  ok(
    "U undoes the latest result and returns focus to that item",
    !r.results[second] && WriterState.state.riWalkItem === second && document.activeElement.dataset.item === second,
  );
  const date = document.getElementById("ri-date"),
    before = Object.keys(r.results).length;
  date.focus();
  date.dispatchEvent(new w.KeyboardEvent("keydown", { key: "1", bubbles: true, cancelable: true }));
  ok(
    "number shortcuts are ignored while a date field has focus",
    Object.keys(r.results).length === before && WriterState.state.riWalkItem === second,
  );
  focusWalkItem();
  press("4");
  document.querySelector("[data-riwalk-undo]").focus();
  press("u");
  ok("U works with focus on the visible Undo control", !r.results[second] && WriterState.state.riWalkItem === second);
  focusWalkItem();
  press("1");
  focusWalkItem();
  press("3");
  focusWalkItem();
  press("4");
  ok(
    "all four results can be entered one item at a time",
    doc(r.sourceDocId)
      .items.map((i) => r.results[i.id]?.oc)
      .join(",") === "progress,corrected,none,noaccess",
  );
  ok(
    "walk-through announces review after every item has a result",
    WriterState.state.riWalkItem === null && /All items have a result/.test(document.querySelector(".ri-walk-panel").textContent),
  );
  ok(
    "filtering resumes after pausing walk-through",
    (document.querySelector('[data-riwalk="off"]').click(), !WriterState.state.riWalk && document.querySelector('[data-rifilter="open"]')),
  );
  // Independent case and visit contexts. Durable worksheet results survive navigation.
  const oldId = doc(r.sourceDocId).items[0].id,
    firstResult = r.results[oldId].oc;
  WriterState.state.riWalk = true;
  WriterState.state.riWalkContext = walkIdentity(r);
  WriterState.state.riWalkItem = oldId;
  WriterState.state.riWalkUndo = { context: walkIdentity(r), itemId: oldId, before: null, after: clone(r.results[oldId]) };
  const originalSave = saveDrafts;
  saveDrafts = async () => true;
  document.querySelector('[data-nav="cases"]').click();
  await new Promise((resolve) => setImmediate(resolve));
  saveDrafts = originalSave;
  ok("navigation clears active item and Undo", !WriterState.state.riWalk && !WriterState.state.riWalkUndo && !WriterState.state.riWalkContext);
  WriterState.CASES.push({ ...clone(kase("k1")), id: "k-walk-b", number: "QA-WALK-B" });
  newDoc("k-walk-b", "notice");
  const noticeB = doc(WriterState.state.docId);
  noticeB.items = [{ ...clone(n.items[0]), id: uid("case-b-item") }];
  issueDocument(noticeB);
  startReinspection("k-walk-b");
  const rb = reinsp(WriterState.state.reinspId);
  rb.time = "11:00";
  ok(
    "case B starts without stale walk state",
    !WriterState.state.riWalk && WriterState.state.riWalkItem === null && WriterState.state.riWalkUndo === null,
  );
  ok("case A mouse target cannot enter B", recordReinspectionOutcome(oldId, "none") === false && Object.keys(rb.results).length === 0);
  document.querySelector('[data-riwalk="on"]').click();
  WriterState.state.riWalkItem = oldId;
  press("2");
  ok("case A keyboard target cannot enter B", Object.keys(rb.results).length === 0);
  ok("stale Undo cannot change B", undoWalkOutcome() === false && Object.keys(rb.results).length === 0);
  render();
  document.querySelector('[data-riwalk="on"]').click();
  WriterState.state.riWalkItem = noticeB.items[0].id;
  document.querySelector('[data-setoc="progress"][data-item="' + WriterState.state.riWalkItem + '"]').click();
  ok("valid B mouse result is isolated", rb.results[noticeB.items[0].id]?.oc === "progress" && !rb.results[oldId]);
  document.querySelector("[data-riwalk-undo]").click();
  ok("B Undo restores only B item", !rb.results[noticeB.items[0].id]);
  startReinspection("k1");
  ok(
    "return to A preserves outcome and resets controls",
    r.results[oldId].oc === firstResult && !WriterState.state.riWalk && !WriterState.state.riWalkUndo,
  );
  recordReinspection(r, true);
  const follow = { ...clone(n), id: uid("d"), draft: true, status: "Draft", type: "extension", fromReinspId: r.id, fromDocId: n.id };
  WriterState.DOCS.unshift(follow);
  issueDocument(follow);
  startReinspection("k1");
  const later = reinsp(WriterState.state.reinspId);
  ok("successive visit has a distinct worksheet identity", later.id !== r.id && later.caseId === r.caseId);
  document.querySelector('[data-riwalk="on"]').click();
  WriterState.state.riWalkUndo = { context: walkIdentity(r), itemId: oldId, before: null, after: { oc: "none" } };
  ok("earlier visit Undo cannot alter later visit", undoWalkOutcome() === false && Object.keys(later.results).length === 0);
  WriterState.state.riWalkUndo = null;
  clearWalk();
  WriterState.state.screen = "cases";
  render();
  startReinspection("k1");
  ok("resume keeps worksheet results and resets controls", Object.keys(reinsp(later.id).results).length === 0 && !WriterState.state.riWalk);
  ok("unrelated item IDs never enter a worksheet", !rb.results[oldId] && !later.results[oldId]);
  // Simulate a fresh browser profile loading the saved IndexedDB draft bundle.
  const firstLater = doc(later.sourceDocId).items[0].id;
  recordReinspectionOutcome(firstLater, "progress");
  const savedDraft = clone(draftBundle());
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  clearWalk();
  WriterState.state.screen = "cases";
  WriterState.state.reinspId = null;
  const oldGet = idbGet;
  idbGet = async (key) => (key === "drafts" ? clone(savedDraft) : null);
  await restoreDrafts();
  idbGet = oldGet;
  startReinspection("k1");
  ok("reload restores the valid single-item outcome", reinsp(WriterState.state.reinspId)?.results[firstLater]?.oc === "progress");
  ok("reload cannot restore prior focus or Undo", !WriterState.state.riWalk && !WriterState.state.riWalkUndo && !WriterState.state.riWalkContext);
  ok(
    "reload has no unrelated item IDs",
    Object.keys(reinsp(WriterState.state.reinspId)?.results || {}).every((id) =>
      doc(reinsp(WriterState.state.reinspId).sourceDocId).items.some((it) => it.id === id),
    ),
  );
  scheduleDraftSave = originalSchedule;
  console.log("Walk-through checks: " + count + " assertions, " + failures.length + " failures.");
  if (failures.length) process.exit(1);
};
settle(eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);});"), global.window);
