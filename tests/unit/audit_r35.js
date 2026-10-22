/* R35: an initial-inspection citation replaces the Official Notice; earlier pairs and recovery citations are unchanged. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage());
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
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  WriterState.REINSP = [];
  WriterState.PENDING = [];
  const day = recordDay(today);
  WriterState.CASES = [
    {
      id: "k1",
      number: "QA-R35-INITIAL",
      address: "100 TEST ST",
      parcel: "070822219101",
      owner: "SYNTHETIC OWNER",
      ownerAddr: ["100 TEST ST", "MADISON WI 53703"],
      inspectorId: "i4",
      date: day,
      time: "09:00",
    },
  ];
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  // This suite retains the R35 authoring-11 behavior. R59 separately checks that current drafts stay at 13.
  d.authoringVersion = 11;
  const ci = LIBRARY.findIndex((x) => x.code === "ENF_PM_PROPMAINT"),
    groups = LIBRARY[ci].groups;
  const add = (code, n) => {
    const gi = groups.findIndex((g) => g.code === code);
    toggleLibraryItem(d, ci, gi, groups[gi].items[n]);
  };
  add("OTHER", 0);
  add("ROW", 0);
  d.items.forEach((i) => {
    i.due = addDays(day, 21);
  });
  d.items[0].cite = true;
  d.mailed = day;
  initialCitations.prepare(d);
  assert.equal(d.authoringVersion, 11);
  assert.ok(initialCitations.enabled(d));
  // The replacing citation's letter carries the notice's order language and furniture; it does not refer to a separate notice.
  const p = initialCitations.preview(d);
  assert.ok(initialOrderCitation(p));
  const body = docBody(p);
  for (const phrase of [
    "An inspector found one or more code violations at the above property.",
    "We are issuing a citation for the documented violation.",
    "Complete the corrections listed below by the due dates shown.",
    "Issue another citation; or",
    "You must comply with this order on a continuous basis.",
    "may be subject to rent abatement",
    "To appeal this order, you must contact us in writing within 15 days",
  ])
    assert.ok(body.includes(phrase), phrase);
  assert.ok(!body.includes("remain those in the Official Notice"));
  assert.ok(!body.includes("If you complete the work by the due date, you may avoid"));
  const blocks = activeBlocks(p);
  assert.ok(blocks.includes("FEES") && blocks.includes("LANGUAGE"), JSON.stringify(blocks));
  assert.deepEqual(activeBlocks(p), activeBlocks(d));
  assert.equal(p.items.length, 2, "the letter lists every item on the inspection, cited or not");
  // Draft screen: banner and button.
  WriterState.state.screen = "write";
  WriterState.state.docId = d.id;
  const screen = screenWrite();
  assert.ok(screen.includes("This inspection will be issued as a citation."));
  // The notice snapshot of an authoring-11 pair is a record delivered within the citation.
  const notice = {
    id: "n11",
    type: "notice",
    caseId: "k1",
    authoringVersion: 11,
    issuanceGroup: { id: "e", noticeId: "n11", citationId: "c11" },
    items: [],
    cits: {},
  };
  const cit = {
    id: "c11",
    type: "citation",
    caseId: "k1",
    authoringVersion: 11,
    fromDocId: "n11",
    issuanceGroup: notice.issuanceGroup,
    items: [],
    cits: {},
  };
  WriterState.DOCS.push(notice, cit);
  assert.ok(deliveredByCitation(notice));
  assert.ok(!deliveredByCitation(cit));
  assert.ok(initialOrderCitation(cit));
  assert.equal(effectiveFiled(notice), false);
  cit.filedAt = "2026-10-13T12:00:00Z";
  assert.equal(effectiveFiled(notice), true);
  assert.ok(filingPanel(notice).includes("Delivered within the citation"));
  // Authoring-10 (R34) pairs keep two filed documents and the old companion letter.
  const n10 = { ...notice, id: "n10", authoringVersion: 10 },
    c10 = { ...cit, id: "c10", authoringVersion: 10, filedAt: undefined };
  assert.ok(!deliveredByCitation(n10));
  assert.ok(!initialOrderCitation(c10));
  assert.ok(docBody(c10).includes("The compliance deadlines remain those in the Official Notice."));
  assert.deepEqual(activeBlocks(c10), []);
  // A recovery citation for an older, already-mailed notice keeps the companion letter.
  const recovery = { id: "r11", type: "citation", caseId: "k1", authoringVersion: 11, fromDocId: "n-old", items: [], cits: {} };
  assert.ok(!initialOrderCitation(recovery));
  assert.ok(docBody(recovery).includes("The compliance deadlines remain those in the Official Notice."));
  // Record-note text typed by the inspector survives a re-rendered dialog followed by any save (captureWork).
  WriterState.state.docId = d.id;
  WriterState.state.modal = "recordnote";
  render();
  const field = document.getElementById("record-action-text");
  field.value = "A partial record note survives save and continue.";
  field.dispatchEvent(new window.Event("input", { bubbles: true }));
  field.value = "";
  captureWork();
  assert.equal(WriterState.WORK.recordForms[recordFormKey()].text, "A partial record note survives save and continue.");
  field.value = "";
  field.dispatchEvent(new window.Event("input", { bubbles: true }));
  captureWork();
  assert.equal(WriterState.WORK.recordForms[recordFormKey()].text, "", "a deliberate clear is kept");
  WriterState.state.modal = null;
  console.log(
    "PASS R35 initial citation replaces the Official Notice: order language a" +
      "nd furniture, notice record delivered within the citation, R34 pairs and" +
      " recovery citations unchanged; typed record notes survive re-render and " +
      "save",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
