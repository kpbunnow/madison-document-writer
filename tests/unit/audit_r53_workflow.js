/* R53 WP2 (group due dates on reinspection) and WP3 (top-of-page warnings clear after 15 seconds). */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const payload = Buffer.from(
  /var B="([A-Za-z0-9+/=]+)"/.exec(
    fs.readFileSync(path.join(path.resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8"),
  )[1],
  "base64",
).toString();
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.fetch = async () => {
  throw new Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  // WP2: the reinspection worksheet lists only outstanding items and applies one date to the selected ones.
  WriterState.DOCS = [
    {
      id: "n1",
      caseId: "k1",
      type: "notice",
      draft: false,
      items: [
        { id: "a", no: "1", title: "Gutters" },
        { id: "b", no: "2", title: "Porch" },
        { id: "c", no: "3", title: "Siding" },
        { id: "d", no: "4", title: "Grass" },
      ],
    },
  ];
  const r = {
    id: "r1",
    caseId: "k1",
    draft: true,
    sourceDocId: "n1",
    results: { a: { oc: "none", due: "" }, b: { oc: "progress", due: "" }, c: { oc: "noaccess", due: "" }, d: { oc: "corrected" } },
  };
  const html = duePanel(r, true);
  assert.ok(html.includes("Assign due dates"));
  for (const no of ["1", "2", "3"]) assert.ok(html.includes("Item " + no), "item " + no);
  assert.ok(!html.includes("Item 4"), "corrected item excluded");
  const date = addDays(recordDay(today), 30);
  assert.equal(assignDue(r, true, date, ["a", "b"]), "");
  assert.equal(r.results.a.due, date);
  assert.equal(r.results.b.due, date);
  assert.equal(r.results.c.due, "");
  assert.equal(r.results.d.due, undefined);
  assert.match(assignDue(r, true, "2020-01-01", ["c"]), /future due date/);
  assert.match(assignDue(r, true, date, []), /Select at least one outstanding item/);
  assert.equal(duePanel({ ...r, draft: false }, true), "", "issued worksheet has no panel");

  // WP3: a top-of-page warning clears at 15 seconds and is kept in Message history.
  const app = document.getElementById("app");
  app.insertAdjacentHTML(
    "afterbegin",
    '<div class="banner warn" id="w1"><div>Test warning one</div></div><section class="card"><div class="banner warn" id="w2"><div>Card warning</div></div></section>',
  );
  const t0 = 1_000_000;
  A11Y.bannerSweep(t0);
  A11Y.bannerSweep(t0 + 14_999);
  assert.equal(document.getElementById("w1").hidden, false, "visible before 15 s");
  A11Y.bannerSweep(t0 + 15_000);
  assert.equal(document.getElementById("w1").hidden, true, "cleared at 15 s");
  assert.equal(document.getElementById("w2").hidden, false, "warnings inside cards are not top-of-page");
  A11Y.showHistory();
  assert.ok(document.body.textContent.includes("Test warning one"), "kept in Message history");
  // A re-rendered copy of the same warning stays cleared; a recurring condition shows again.
  document.getElementById("w1").remove();
  app.insertAdjacentHTML("afterbegin", '<div class="banner warn" id="w1b"><div>Test warning one</div></div>');
  A11Y.bannerSweep(t0 + 15_500);
  assert.equal(document.getElementById("w1b").hidden, true, "re-render of a cleared warning stays cleared");
  document.getElementById("w1b").remove();
  A11Y.bannerSweep(t0 + 16_000);
  app.insertAdjacentHTML("afterbegin", '<div class="banner warn" id="w1c"><div>Test warning one</div></div>');
  A11Y.bannerSweep(t0 + 16_500);
  assert.equal(document.getElementById("w1c").hidden, false, "a recurring condition shows again");
  // Keyboard focus restarts the timer.
  app.insertAdjacentHTML("afterbegin", '<div class="banner alert" id="w3"><div>Focus warning <button id="w3b">Details</button></div></div>');
  A11Y.bannerSweep(t0 + 20_000);
  document.getElementById("w3b").focus();
  A11Y.bannerSweep(t0 + 40_000);
  assert.equal(document.getElementById("w3").hidden, false, "focused warning stays");
  document.getElementById("w3b").blur();
  A11Y.bannerSweep(t0 + 54_999);
  assert.equal(document.getElementById("w3").hidden, false, "timer restarted on leaving focus");
  A11Y.bannerSweep(t0 + 55_000);
  assert.equal(document.getElementById("w3").hidden, true);
  console.log("PASS R53 group due dates on reinspection worksheets and 15-second top-of-page warnings");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
