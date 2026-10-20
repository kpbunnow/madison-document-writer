/* A form input remains authoritative if another listener replaces its node. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
window.scrollTo = () => {};
global.getSelection = () => window.getSelection();
global.fetch = async () => {
  throw Error("offline");
};
let replace = false;
document.addEventListener(
  "input",
  (e) => {
    if (replace && e.target.id === "record-action-text") {
      const blank = e.target.cloneNode();
      blank.value = "";
      e.target.replaceWith(blank);
    }
  },
  true,
);
const payload = Buffer.from(
  /var B="([A-Za-z0-9+/=]+)"/.exec(
    fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8"),
  )[1],
  "base64",
).toString();
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  WriterState.state.modal = "recordnote";
  render();
  replace = true;
  const field = document.getElementById("record-action-text");
  field.value = "A partial record note survives a concurrent redraw.";
  field.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(WriterState.WORK.recordForms[d.id + ":recordnote"].text, field.value);
  render();
  assert.equal(document.getElementById("record-action-text").value, field.value);
  console.log("PASS record-note input survives replaced DOM node and redraw");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
