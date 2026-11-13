/* Review of PRs 480–482: typed-result preservation, intersected picker scopes, single click ownership and stale focus. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");
let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log("PASS " + name);
  } catch (error) {
    failures++;
    console.error("FAIL " + name, error);
  }
}
(async () => {
  await check("bulk Undo restores pre-existing fields and keeps later edits", async () => {
    const api = await compile('export {recordRemaining} from "./reinspection_batch.js"; export {createReinspection} from "./reinspection.js";');
    const s = api.WriterState;
    Object.assign(s, {
      state: { screen: "reinspect", reinspId: "r", riWalk: false, riWalkSkipped: [] },
      DOCS: [{ id: "src", caseId: "k", items: [{ id: "a" }, { id: "b" }] }],
      REINSP: [
        {
          id: "r",
          caseId: "k",
          sourceDocId: "src",
          date: "2026-11-12",
          draft: true,
          results: { a: { note: "Existing observations", due: "2026-12-10", on: "2026-11-11", manualDate: true } },
        },
      ],
    });
    const r = s.REINSP[0],
      before = structuredClone(r.results.a);
    const recorder = api.createReinspection({ authoring: { scheduleDraftSave() {} }, ui: { renderKeep() {} } });
    let undo;
    const services = {
      recordReinspectionOutcome: recorder.recordReinspectionOutcome,
      toastUndo: (_, fn) => {
        undo = fn;
      },
      saveDrafts() {},
      render() {},
    };
    assert.equal(api.recordRemaining(services, "corrected"), 2);
    undo();
    assert.deepEqual(r.results.a, before, "Undo restores notes, manual dates and due dates that existed before the batch");
    assert.equal(r.results.b, undefined, "an originally absent result stays absent");
    api.recordRemaining(services, "none");
    r.results.a.note = "New observations after marking";
    r.results.a.due = "2026-12-18";
    undo();
    assert.ok(!r.results.a.oc, "Undo clears the batch outcome");
    assert.equal(r.results.a.note, "New observations after marking");
    assert.equal(r.results.a.due, "2026-12-18");
    api.recordRemaining(services, "corrected");
    r.results.b.carried = true;
    const carried = structuredClone(r.results.b);
    undo();
    assert.deepEqual(r.results.b, carried, "Undo never changes a result that became carried");
    delete r.results.b;
    api.recordRemaining(services, "none");
    recorder.recordReinspectionOutcome("b", "corrected");
    recorder.recordReinspectionOutcome("b", "none");
    const remarked = structuredClone(r.results.b);
    undo();
    assert.deepEqual(r.results.b, remarked, "a later manual outcome is not undone even when its value matches the batch");
    delete r.results.b;
    api.recordRemaining(services, "none");
    const changedSource = structuredClone(r.results);
    r.sourceDocId = "replacement-source";
    undo();
    assert.deepEqual(r.results, changedSource, "a changed worksheet source invalidates the old batch Undo");
    r.sourceDocId = "src";
    r.results.a = JSON.parse('{"note":"Original","__proto__":{"oc":"corrected"}}');
    api.recordRemaining(services, "none");
    r.results.a.note = "Later";
    undo();
    assert.equal(Object.getPrototypeOf(r.results.a), Object.prototype, "restored JSON fields cannot become the result prototype");
    assert.ok(Object.hasOwn(r.results.a, "__proto__"));
    assert.deepEqual(r.results.a.__proto__, { oc: "corrected" });
    assert.ok(!r.results.a.oc, "only the batch outcome is reversed; an unusual data key is not an inherited finding");
    assert.equal(r.results.a.note, "Later");
  });
  await check("Favorites intersects the Selected language scope", async () => {
    global.localStorage = { getItem: () => null, setItem() {} };
    const api = await compile(
      'export {languagePicker} from "./language_discovery.js"; export {toggleFavorite} from "./language_shortcuts.js"; export {esc,markBlanks} from "./presentation_format.js";',
    );
    const items = [0, 1].map((o) => ({ o, ci: 0, gi: 0, t: "Entry " + o, a: "Repair item " + o, s: ["27.05"] }));
    const key = (i) => "key-" + i.o;
    api.toggleFavorite(key(items[0]));
    const R = {
      LIBRARY: [{ code: "ENF_ORDER_CATALOG", name: "Catalog", groups: [{ code: "A", name: "Repairs", items }] }],
      state: { picker: true, docId: "d", q: "", cl: -1, grp: 0, pickerStatus: "selected", pickerList: "favorites" },
      doc: () => ({ id: "d", type: "notice", items: items.map((i) => ({ libraryKey: key(i) })) }),
      allItems: () => items,
      catalogKey: key,
      itemLibraryKey: (i) => i.libraryKey,
      catalogVisible: () => true,
      effectiveCatalog: (i) => ({ a: i.a, s: i.s }),
      catalogStatus: () => ({ code: "legacy" }),
      catalogItem: () => null,
      esc: api.esc,
      markBlanks: api.markBlanks,
      checkAttr: (v) => v,
    };
    const dom = new JSDOM(api.languagePicker(R));
    assert.deepEqual(
      [...dom.window.document.querySelectorAll(".language-pick-row")].map((el) => el.dataset.languageKey),
      [key(items[0])],
    );
    assert.equal(dom.window.document.querySelector('[data-language-list="favorites"]').getAttribute("aria-current"), "true");
    dom.window.close();
  });
  await check("All categories has one repaint and clears the shortcut list", async () => {
    const dom = new JSDOM('<div id="overlay"><div class="picker-box"><button data-language-all>All</button><input id="pk-q"></div></div>');
    global.document = dom.window.document;
    global.localStorage = { getItem: () => null, setItem() {} };
    const api = await compile(
      'export {createLanguageShortcuts} from "./language_shortcuts.js"; export {createLanguageActions} from "./language_actions.js";',
    );
    api.WriterState.state = { screen: "write", picker: true, pickerList: "favorites", q: "repair", cl: 2 };
    let paints = 0;
    const services = {
      refreshOverlay() {
        paints++;
        document.getElementById("overlay").innerHTML = '<div class="picker-box"><button data-language-all>All</button><input id="pk-q"></div>';
      },
    };
    api.createLanguageShortcuts(services);
    document.addEventListener("click", api.createLanguageActions(services));
    document.querySelector("button").click();
    assert.equal(paints, 1, "one click must not replace the picker twice");
    assert.equal(api.WriterState.state.pickerList, "");
    assert.equal(api.WriterState.state.q, "");
    assert.equal(api.WriterState.state.cl, -1);
    assert.equal(document.activeElement.id, "pk-q");
    dom.window.close();
  });
  await check("a fill-in box abandoned by navigation never writes or steals focus", async () => {
    const dom = new JSDOM(
      '<main><div tabindex="0" data-field="text" data-id="a"><span id="blank" class="blank-edit" tabindex="0">( )</span></div><div data-field="text" data-id="b"><span class="blank-edit" tabindex="0">( )</span></div></main><button id="navigation">Workspace</button>',
    );
    const api = await compile('export {createDocumentFeedback} from "./document_feedback.js";');
    const s = api.WriterState;
    Object.assign(s, { state: { screen: "write", docId: "d" }, DOCS: [{ id: "d", items: [{ id: "a" }, { id: "b" }] }] });
    let inputs = 0;
    const ui = api.createDocumentFeedback({
      document: dom.window.document,
      Event: dom.window.Event,
      isLocked: () => false,
      A11Y: { notify() {}, utility: () => assert.fail("no corrective-action dialog") },
    });
    dom.window.document.addEventListener("input", () => inputs++);
    ui.fillBlank(dom.window.document.getElementById("blank"));
    const box = dom.window.document.activeElement;
    assert.ok(box.classList.contains("blank-input"));
    box.value = "Repair detail";
    // Navigation replaces the editor before the box is left; its late blur must do nothing.
    s.state.docId = "other";
    dom.window.document.querySelector("main").innerHTML = '<span class="blank-edit" tabindex="0">Other document</span>';
    const navigation = dom.window.document.getElementById("navigation");
    navigation.focus();
    box.dispatchEvent(new dom.window.Event("blur"));
    assert.equal(dom.window.document.activeElement, navigation);
    assert.equal(inputs, 0);
    assert.equal(dom.window.document.querySelector("main").textContent, "Other document");
    dom.window.close();
  });
  process.exitCode = failures ? 1 : 0;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
