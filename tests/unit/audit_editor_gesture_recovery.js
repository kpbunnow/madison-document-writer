/* Actual editor gestures: one registration, normal reorder/cancel, live lock and replaced document/DOM refusal. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom"),
  { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const { createEditorEvents, WriterState: s } = await compile(`export {createEditorEvents} from './editor_events.js';`);
  const dom = new JSDOM('<div id="app"></div>', { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  let trace = [],
    editable = true;
  const draft = () => ({
    id: "draft",
    caseId: "case",
    draft: true,
    items: [
      { id: "a", no: "1" },
      { id: "b", no: "2" },
      { id: "c", no: "3" },
    ],
  });
  function draw() {
    document.body.innerHTML =
      "<table><tbody>" +
      s.DOCS[0].items.map((it) => `<tr data-row="${it.id}"><td><button data-grip="${it.id}">Move</button></td></tr>`).join("") +
      '</tbody></table><input class="hdr-in"><div contenteditable="true" id="text">Typed</div>';
    [...document.querySelectorAll("tr")].forEach((row, i) => (row.getBoundingClientRect = () => ({ top: i * 20, bottom: (i + 1) * 20, height: 20 })));
  }
  function reset() {
    Object.assign(s, { DOCS: [draft()], CASES: [{ id: "case" }], state: { docId: "draft" }, DIRTY: false, dragging: null });
    editable = true;
    trace = [];
    draw();
  }
  const api = createEditorEvents({
    actions: {
      captureWork: () => trace.push(["capture"]),
      structEditable: (d) => {
        trace.push(["editable", d.id]);
        return editable;
      },
      renumber: (d) => {
        trace.push(["renumber", d.items.map((it) => it.id)]);
        d.items.forEach((it, i) => (it.no = String(i + 1)));
      },
      moveItem: (...args) => trace.push(["move", ...args]),
    },
    ui: {
      render: () => trace.push(["render"]),
      refreshSheet: () => {
        trace.push(["refresh"]);
        draw();
      },
      fillBlank: (...args) => trace.push(["blank", ...args]),
    },
  });
  for (const method of [
    "registerPointerStart",
    "registerPointerMove",
    "registerPointerEnd",
    "registerPointerCancel",
    "registerReorderKeys",
    "registerDatePicker",
    "registerPlainPaste",
    "registerReviewCommands",
  ]) {
    api[method](document);
    api[method](document);
  }
  function event(type, target, extra = {}) {
    const e = new dom.window.Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries(extra)) Object.defineProperty(e, key, { value });
    target.dispatchEvent(e);
    return e;
  }
  const grip = (id) => document.querySelector(`[data-grip="${id}"]`),
    ids = () => s.DOCS[0].items.map((it) => it.id);
  function begin() {
    const g = grip("a");
    g.setPointerCapture = () => {
      throw Error("optional capture unavailable");
    };
    event("pointerdown", g, { pointerId: 1 });
    event("pointermove", document, { clientY: 35 });
  }
  reset();
  event("pointermove", document, { clientY: 35 });
  event("pointerup", document);
  assert.deepEqual(trace, []);
  begin();
  assert.equal(s.dragging.tr.classList.contains("dragging"), true);
  event("pointerup", document);
  assert.deepEqual(ids(), ["b", "a", "c"]);
  assert.deepEqual(
    s.DOCS[0].items.map((it) => it.no),
    ["1", "2", "3"],
  );
  assert.equal(s.DIRTY, true);
  assert.equal(s.dragging, null);
  assert.deepEqual(
    trace.map((t) => t[0]),
    ["editable", "renumber", "refresh"],
    "duplicate registration cannot apply or refresh twice",
  );
  reset();
  begin();
  event("pointercancel", document);
  assert.deepEqual(ids(), ["a", "b", "c"]);
  assert.equal(s.dragging, null);
  assert.deepEqual(trace, [["refresh"]]);
  reset();
  begin();
  editable = false;
  event("pointerup", document);
  assert.deepEqual(ids(), ["a", "b", "c"]);
  assert.equal(s.DIRTY, false);
  assert.equal(s.dragging, null);
  assert.deepEqual(trace, [["editable", "draft"]]);
  // A source replacement or a repaint abandons the old gesture. Never apply detached row order to current work.
  reset();
  begin();
  const replacement = draft();
  s.DOCS = [replacement];
  event("pointerup", document);
  assert.deepEqual(ids(), ["a", "b", "c"], "a drag from an earlier document object cannot reorder replacement work");
  assert.equal(s.DIRTY, false);
  assert.equal(s.dragging, null);
  reset();
  begin();
  draw();
  event("pointerup", document);
  assert.deepEqual(ids(), ["a", "b", "c"], "detached old rows cannot reorder a repainted document");
  assert.equal(s.DIRTY, false);
  assert.equal(s.dragging, null);
  reset();
  event("keydown", grip("b"), { key: "ArrowUp" });
  event("keydown", grip("b"), { key: "ArrowDown" });
  event("keydown", grip("b"), { key: "ArrowDown", ctrlKey: true });
  assert.deepEqual(trace, [
    ["move", "b", "up", true],
    ["move", "b", "down", true],
  ]);
  let pickers = 0;
  const date = document.querySelector(".hdr-in");
  date.showPicker = () => {
    pickers++;
    throw Error("optional picker refusal");
  };
  event("click", date);
  date.disabled = true;
  event("click", date);
  assert.equal(pickers, 1);
  let pasted;
  document.execCommand = (...args) => (pasted = args);
  const text = document.getElementById("text");
  event("paste", text, {
    clipboardData: {
      getData: (type) => {
        assert.equal(type, "text/plain");
        return "<b>literal text</b>";
      },
    },
  });
  assert.deepEqual(pasted, ["insertText", false, "<b>literal text</b>"]);
  // Actual review/command routing captures current work and leaves target readiness with the target control.
  reset();
  document.body.insertAdjacentHTML(
    "beforeend",
    '<button data-editor-review>Review</button><button data-editor-command="command-target">Run</button><button id="command-target" disabled>Target</button><div class="topbar"><button class="editor-primary" disabled>Primary</button></div><button data-mobile-primary>Mobile</button>',
  );
  s.state.picker = true;
  document.querySelector("[data-editor-review]").click();
  assert.equal(s.state.picker, false);
  assert.equal(s.state.modal, "review");
  assert.deepEqual(trace, [["capture"], ["render"]]);
  trace = [];
  const target = document.getElementById("command-target"),
    command = document.querySelector("[data-editor-command]");
  let commandClicks = 0,
    primaryClicks = 0;
  target.addEventListener("click", () => commandClicks++);
  command.click();
  assert.equal(commandClicks, 0);
  assert.equal(command.disabled, false);
  target.disabled = false;
  command.click();
  assert.equal(commandClicks, 1);
  assert.equal(command.disabled, true);
  command.click();
  assert.equal(commandClicks, 1);
  const primary = document.querySelector(".editor-primary");
  primary.addEventListener("click", () => primaryClicks++);
  document.querySelector("[data-mobile-primary]").click();
  assert.equal(primaryClicks, 0);
  primary.disabled = false;
  document.querySelector("[data-mobile-primary]").click();
  assert.equal(primaryClicks, 1);
  s.DOCS = [];
  s.state.modal = null;
  trace = [];
  document.querySelector("[data-editor-review]").click();
  assert.equal(s.state.modal, null);
  assert.deepEqual(trace, [["capture"]]);
  // Navigation remains held until the real preflight callback permits it. Issued history blocks a second initial notice.
  reset();
  let proceed;
  const navigation = createEditorEvents({
    actions: {
      preflightCase: (...args) => {
        trace.push(["preflight", ...args.slice(0, 2)]);
        proceed = args[2];
      },
      newDoc: (...args) => trace.push(["new", ...args]),
    },
    ui: {
      render: () => trace.push(["render"]),
      toast: (message) => trace.push(["toast", message]),
    },
  });
  window.scrollTo = (...args) => trace.push(["scroll", ...args]);
  s.state.screen = "workspace";
  navigation.openDocument({ dataset: { open: "missing" } });
  assert.deepEqual(trace, []);
  navigation.openDocument({ dataset: { open: "draft" } });
  assert.equal(s.state.screen, "workspace", "refused or cancelled preflight must not navigate");
  assert.deepEqual(trace, [["preflight", "case", "document"]]);
  proceed();
  assert.equal(s.state.screen, "write");
  assert.equal(s.state.docId, "draft");
  assert.deepEqual(trace.slice(1), [["render"], ["scroll", 0, 0]]);
  reset();
  s.state.screen = "workspace";
  navigation.newNotice({ dataset: { new: "case" } });
  assert.equal(s.state.screen, "workspace");
  assert.deepEqual(trace, [["preflight", "case", "document draft"]]);
  proceed();
  assert.equal(s.state.screen, "write");
  assert.deepEqual(trace.slice(1), [["render"]]);
  reset();
  s.DOCS[0].draft = false;
  navigation.newNotice({ dataset: { new: "case" } });
  assert.deepEqual(trace, [["toast", "This case already has an official notice"]]);
  reset();
  s.DOCS = [];
  navigation.newNotice({ dataset: { new: "case" } });
  assert.deepEqual(trace, [["preflight", "case", "new notice"]]);
  proceed();
  assert.deepEqual(trace.slice(1), [["new", "case", "notice"]]);
  dom.window.close();
  console.log(
    "PASS editor gestures: single registration, reorder/cancel, live lock, replaced source/DOM refusal, keyboard, optional native failures, literal paste and review/command routing",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
