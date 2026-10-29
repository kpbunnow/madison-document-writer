/* Consolidation Phase 1 (B2): the screen frame escapes its plain-text title and breadcrumb exactly once. Imported
   addresses on the case-actions screen (referred and normal branches) and on the worksheet and editor screens appear
   as literal text and never as markup or event handlers. Synthetic only. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
(async () => {
  const dom = new JSDOM('<div id="app"></div><div id="overlay"></div>', { url: "http://127.0.0.1:8777/" });
  const { window } = dom,
    { document } = window;
  Object.assign(global, { window, document });
  const { WriterState, kase, shell, newDocuments, newDoc, screenWrite } = await require("../fixtures/writer_shell.cjs")();
  let saveDrafts, scheduleDraftSave;

  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  const hostile = '<b>X</b> & Co <img src=x onerror="window.__pwned=1">';
  const render = (html) => {
    const box = document.createElement("div");
    box.innerHTML = html;
    return box;
  };
  const noInjection = (box, label) => {
    assert.equal(box.querySelector("h1 b, h1 img, .crumb b, .crumb img"), null, label + ": no injected element");
    assert.ok(
      ![...box.querySelectorAll("h1 *, .crumb *")].some((el) => [...el.attributes].some((a) => a.name.startsWith("on"))),
      label + ": no handler",
    );
    assert.equal(window.__pwned, undefined, label + ": no handler ran");
  };

  // The frame itself: title and breadcrumb are plain text, escaped once (no double escaping).
  let box = render(shell(hostile, "A & B · " + hostile, "", ""));
  assert.equal(box.querySelector("h1").textContent, hostile);
  assert.equal(box.querySelector(".crumb").textContent, "A & B · " + hostile);
  noInjection(box, "shell");
  assert.equal(render(shell("Tools & settings", "Building Inspection", "", "")).querySelector("h1").textContent, "Tools & settings");

  // The case-actions screen, normal and referred branches.
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  WriterState.PENDING = [];
  const k = kase("k1");
  k.address = hostile;
  WriterState.WORK.currentAction = { cid: "k1", type: "", group: "" };
  box = render(newDocuments.caseActionScreen());
  assert.equal(box.querySelector("h1").textContent, hostile, "normal branch shows the address as text");
  noInjection(box, "case actions");
  const source = { id: "src", caseId: "k1", type: "notice", draft: false, status: "Final", inspDate: "2026-09-01", items: [] };
  WriterState.DOCS = [{ id: "ref", caseId: "k1", type: "referral", draft: false, status: "Final", fromDocId: "src", items: [], cits: {} }, source];
  box = render(newDocuments.caseActionScreen());
  assert.match(box.textContent, /Only an Update for Case Referral or a Compliance Letter/, "referred branch rendered");
  assert.equal(box.querySelector("h1").textContent, hostile, "referred branch shows the address as text");
  noInjection(box, "referred case actions");

  // The reinspection worksheet and document editor frames show the same address once escaped.
  WriterState.DOCS = [];
  newDoc("k1", "notice");
  WriterState.state.screen = "write";
  box = render(screenWrite());
  assert.equal(box.querySelector("h1").textContent, hostile, "editor title");
  noInjection(box, "editor");
  console.log("PASS screen titles and breadcrumbs escape imported text once (case actions, referred case actions, editor)");
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
