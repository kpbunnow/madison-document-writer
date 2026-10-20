/* R43 inline completion, multiple charges, focus and retained pricing boundaries. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const payload = Buffer.from(
  /var B="([A-Za-z0-9+/=]+)"/.exec(
    fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8"),
  )[1],
  "base64",
).toString();
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.FormData = dom.window.FormData;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.fetch = async () => {
  throw Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 30));
  saveDrafts = async () => true;
  scheduleDraftSave = () => {};
  idbSet = async () => true;
  WriterState.HELPER = null;
  WriterState.CASEDIR = null;
  WriterState.PENDING = [];
  WriterState.EVENTS = {};
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  const k = kase("k1");
  k.date = recordDay(today);
  k.time = "09:00";
  newDoc(k.id, "notice");
  const d = doc(WriterState.state.docId);
  const ords = ["27.05(2)(c)", "29.40(4)(b)", "SPS321.125", "SPS999.99", "23.45", "10.101(7)(b)"];
  d.items = ords.map((ord, n) => ({
    id: "r43-" + n,
    no: String(n + 1),
    sections: [ord],
    title: "Synthetic charge " + (n + 1),
    text: "Correct the observed condition.",
    cite: true,
    due: addDays(recordDay(today), 21),
  }));
  initialCitations.prepare(d);
  render();
  assert.equal(document.querySelectorAll("[data-charge]").length, 6);
  assert.equal(document.querySelectorAll("[data-deposit-request]").length, 4);
  assert.equal(document.querySelector("dialog"), null);
  assert.equal(document.querySelector('[data-charge="r43-0"] [data-review-details="pricing"]').open, false);
  assert.equal(document.querySelector('[data-charge="r43-4"] .charge-result strong').textContent, "Mandatory appearance");
  assert.match(document.querySelector(".charge-hold").textContent, /wording approval/);
  assert.ok(!citationDepositFault(d.cits["r43-4"], initialCitations.preview(d), d.items[4]));
  const original = clone(d.cits["r43-0"]);
  depositStep.openNext(d);
  assert.ok(document.activeElement.closest("[data-deposit-form]"));
  assert.equal(document.querySelector("dialog"), null);
  const enter = (id, name, value) => {
    const el = document.querySelector('[data-deposit-form="' + id + '"] [name="' + name + '"]');
    el.value = value;
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  enter("r43-1", "measure-area", "200000");
  enter("r43-1", "measure-days", "400");
  assert.deepEqual(d.depositRequests["r43-1"].measurements, { area: 200000, days: 400 });
  const submit = (id) =>
    document.querySelector('[data-deposit-form="' + id + '"]').dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  submit("r43-1");
  assert.equal(d.cits["r43-1"].amount, "12761.00");
  assert.equal(document.activeElement.dataset.charge, "r43-1");
  assert.ok(d.depositRequests["r43-2"] && d.depositRequests["r43-3"]);
  enter("r43-2", "base", "145");
  enter("r43-2", "depositSource", "short");
  const retained = clone(d.depositRequests);
  render();
  assert.deepEqual(d.depositRequests, retained);
  assert.equal(document.querySelector('[data-deposit-form="r43-2"] [name=base]').value, "145");
  submit("r43-2");
  assert.equal(d.cits["r43-2"], undefined);
  assert.match(document.querySelector('[data-deposit-form="r43-2"] [role=alert]').textContent, /approval source/);
  enter("r43-2", "depositSource", "Synthetic court approval for manual base.");
  submit("r43-2");
  assert.ok(d.cits["r43-2"].amount);
  assert.equal(d.cits["r43-2"].depositMode, "base");
  assert.deepEqual(d.cits["r43-0"], original, "Unrelated completions preserve confirmed pricing");
  enter("r43-5", "measure-diameter", "12");
  submit("r43-5");
  assert.equal(d.cits["r43-5"].amount, "2347.00");
  const ord = document.querySelector('[data-review-cit="r43-2|ord"]');
  ord.closest("details").open = true;
  ord.focus();
  ord.value = "SPS 321.125";
  ord.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(document.activeElement, ord);
  ord.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(d.cits["r43-2"].depositSource, "Synthetic court approval for manual base.");
  assert.equal(document.activeElement, ord);
  assert.ok(ord.closest("details").open);
  assert.ok(blockers(d).some((x) => /division-approved defendant instructions/.test(x.t)));
  assert.throws(() => printJob(initialCitations.preview(d)), /deposit|mandatory|instructions/i);
  d.draft = false;
  d.status = "Final";
  render();
  let actions = document.querySelector(".editor-more");
  assert.ok(actions);
  actions.open = true;
  document.getElementById("btn-savecase").focus();
  render();
  assert.equal(document.querySelector(".editor-more").open, true);
  assert.equal(document.activeElement.id, "btn-savecase", "Late filing redraw retains action focus");
  document.querySelector(".editor-more summary").focus();
  render();
  assert.equal(document.activeElement, document.querySelector(".editor-more summary"), "Disclosure keyboard focus is retained");
  const other = { ...clone(d), id: "r43-other-actions" };
  WriterState.DOCS.push(other);
  WriterState.state.docId = other.id;
  render();
  assert.equal(document.querySelector(".editor-more").open, false, "Actions do not open on another document");
  WriterState.state.docId = d.id;
  render();
  assert.equal(document.querySelector(".editor-more").open, false, "Returning to a different document starts with closed actions");
  console.log(
    "PASS R43 six charge cards, inline measured/manual completion, partial dr" +
      "aft retention, focus, mandatory hold, unchanged pricing and late filing " +
      "action continuity",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
