/* Phase-six outcome combinations, worksheet visibility and action ownership. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  payload = bundleSource(html);
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = window.document;
global.localStorage = window.localStorage;
global.getSelection = () => window.getSelection();
global.confirm = () => true;
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = function () {};
const test = async () => {
  await new Promise((r) => setTimeout(r, 30));
  const save = saveDrafts,
    schedule = scheduleDraftSave;
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  WriterState.WORK = { entry: {}, recordForms: {} };
  newDoc("k1", "notice");
  const n = doc(WriterState.state.docId);
  n.items = Array.from({ length: 6 }, (_, i) => ({
    id: uid("r46-item"),
    no: String(i + 1),
    rootItemId: "r46-root-" + i,
    title: "Synthetic condition " + (i + 1),
    text: "Repair this synthetic condition.",
    sections: ["27.05(2)(c)"],
    due: futureDue(recordDay(today), 14),
    done: i === 4,
    doneOn: i === 4 ? kase("k1").date : "",
    withdrawn: i === 5,
    withdrawalReason: i === 5 ? "Synthetic recording error." : "",
  }));
  issueDocument(n);
  startReinspection("k1");
  const r = reinsp(WriterState.state.reinspId);
  r.time = "10:00";
  const items = doc(r.sourceDocId).items,
    identity = walkIdentity(r),
    carried = clone(r.results);
  // All 4^4 combinations use deliberate per-item operations and retain fixed identities.
  const realRender = render;
  for (let mask = 0; mask < 256; mask++) {
    r.results = clone(carried);
    clearWalk();
    WriterState.state.riWalkMode = "quick";
    if (!mask) {
      render();
      document.querySelector('[data-riwalk="on"]').click();
    } else {
      render = () => {};
      WriterState.state.riWalk = true;
      WriterState.state.riWalkContext = walkIdentity(r);
      WriterState.state.riWalkItem = items[0].id;
    }
    for (let ix = 0; ix < 4; ix++) {
      assert.equal(WriterState.state.riWalkItem, items[ix].id);
      if (!mask) assert.equal(document.querySelectorAll(".ri-item:not([hidden])").length, 1);
      const outcome = OUTCOMES[(mask >> (ix * 2)) & 3].id;
      assert.equal(recordReinspectionOutcome(items[ix].id, outcome), true);
      assert.equal(r.results[items[ix].id].oc, outcome);
    }
    assert.equal(unchecked(r).length, 0);
    assert.equal(walkIdentity(r), identity);
    assert.deepEqual(r.results[items[4].id], carried[items[4].id]);
    assert.deepEqual(r.results[items[5].id], carried[items[5].id]);
    if (!mask) {
      assert.equal(document.querySelectorAll(".ri-item:not([hidden])").length, 6);
      assert.equal(document.activeElement.dataset.riwalk, "off");
    }
  }
  render = realRender;
  render();
  assert.match(document.querySelector(".ri-progress").textContent, /5 of 5 active items/);
  assert.match(document.querySelector(".ri-progress").textContent, /1 withdrawn/);
  assert.equal(recordReinspectionOutcome(items[4].id, "none"), false);
  assert.equal(recordReinspectionOutcome(items[5].id, "corrected"), false);
  r.results = { ...clone(carried), [items[0].id]: { oc: "noaccess", on: r.date, note: "Unable to enter north unit." } };
  WriterState.state.riWalkItem = items[1].id;
  render();
  const target = checkTarget('[data-setoc][data-item="' + items[2].id + '"]', "Item 3 outcome");
  focusCheckTarget(target, "Choose an outcome");
  assert.equal(WriterState.state.riWalk, false);
  assert.equal(document.activeElement.dataset.item, items[2].id);
  assert.equal(document.activeElement.closest(".ri-item").hidden, false);
  assert.match(document.querySelector('[data-ri-item="' + items[0].id + '"]').textContent, /Access attempt and observations/);
  r.followupIntent = "extension";
  r.results = clone(carried);
  items
    .slice(0, 4)
    .forEach(
      (it, ix) => (r.results[it.id] = { oc: ix ? "corrected" : "progress", on: r.date, due: futureDue(r.date, 21), note: "Synthetic observations." }),
    );
  WriterState.state.screen = "reinspect";
  render();
  let chooser = document.querySelector(".r26-chooser");
  assert.match(chooser.textContent, /Primary follow-up/);
  assert.equal(chooser.querySelectorAll("[data-action-type]:disabled").length, 0);
  assert.ok(!newDocuments.eligibility(r, "extension"));
  assert.ok(newDocuments.eligibility(r, "citation"));
  assert.ok(!chooser.querySelector('[data-action-type="citation"]'));
  const before = stableJSON(r.results);
  docFromReinspection(r, "extension");
  const d = doc(WriterState.state.docId);
  assert.equal(d.fromReinspId, r.id);
  assert.equal(returnToWorksheet(d), true);
  assert.equal(stableJSON(r.results), before);
  assert.equal(restorePreviousDraft(r), true);
  assert.equal(doc(WriterState.state.docId).id, d.id);
  saveDrafts = save;
  scheduleDraftSave = schedule;
  console.log(
    "PASS R46 256 outcome combinations, carried and withdrawn identity, visib" +
      "le focus targets, no-access details, chooser ownership and draft return",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);});");
