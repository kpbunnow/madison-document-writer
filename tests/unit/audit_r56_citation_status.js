/* R56: re-importing an inspection whose Accela status no longer permits citations clears the stale
   citation marks and their draft data, before and after the draft is saved and reopened. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage());
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.fetch = async () => {
  throw Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 30));
  // An in-memory stand-in for this machine's IndexedDB draft store.
  const store = new Map();
  idbSet = async (key, value) => {
    store.set(key, JSON.parse(JSON.stringify(value)));
    return true;
  };
  idbGet = async (key) => (store.has(key) ? JSON.parse(JSON.stringify(store.get(key))) : undefined);
  WriterState.WRITER_ACCESS = true;
  WriterState.HELPER = null;
  WriterState.CASEDIR = null;
  WriterState.PENDING = [];
  WriterState.EVENTS = {};
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.RECORD_ATTEMPTS = {};
  const k = kase("k1");
  k.parcel = "070822219105";
  k.date = recordDay(today);
  k.time = "09:00";
  newDoc(k.id, "notice");
  const d = doc(WriterState.state.docId);
  d.items = [
    {
      id: "r56-a",
      no: "1",
      title: "Wall repair",
      text: "Repair the wall.",
      sections: ["27.05(2)(c)"],
      due: addDays(recordDay(today), 21),
      cite: false,
    },
    {
      id: "r56-b",
      no: "2",
      title: "Door repair",
      text: "Repair the door.",
      sections: ["27.05(2)(c)"],
      due: addDays(recordDay(today), 21),
      cite: false,
    },
  ];
  const rule = (status) => ({ ...statusRule("Initial Inspection", status), status });
  const citeBoxes = () => {
    render();
    return [...document.querySelectorAll("[data-notecite]")];
  };
  const markMessage = () => checks(d).find((c) => !c.ok && /no item can be cited/.test(c.t));

  // 1. Imported as Citation: items can be marked, which prepares draft citation data.
  applyImportRule(d, rule("Citation"));
  assert.equal(citeBoxes().length, 2);
  citeBoxes()[0].click();
  assert.equal(d.items[0].cite, true);
  assert.ok(d.cits["r56-a"] || d.depositRequests?.["r56-a"], "a cited item has draft citation or deposit data");

  // 2. Corrected to Official Notice in Accela and re-imported: the stale mark and its data are cleared.
  applyImportRule(d, rule("Official Notice"));
  assert.equal(
    d.items.some((i) => i.cite),
    false,
    "no item remains marked for citation",
  );
  assert.equal(d.cits?.["r56-a"], undefined);
  assert.equal(d.depositRequests?.["r56-a"], undefined);
  assert.equal(markMessage(), undefined, "publication is not blocked by a mark the inspector cannot see");
  assert.equal(citeBoxes().length, 0, "Official Notice offers no Cite option");

  // 3. Saved and reopened: the draft comes back clean.
  await saveDrafts();
  WriterState.DOCS = [];
  await restoreDrafts();
  const reopened = doc(d.id);
  assert.ok(reopened, "the draft is restored");
  assert.equal(reopened.importRule.label, "Official Notice");
  assert.equal(
    reopened.items.some((i) => i.cite),
    false,
  );
  assert.equal(
    checks(reopened).some((c) => !c.ok && /no item can be cited/.test(c.t)),
    false,
  );

  // 4. A draft saved while the stale state existed (before this correction) is cleaned on restore.
  const stale = store.get("drafts");
  const staleDoc = stale.docs.find((x) => x.id === d.id);
  staleDoc.items[1].cite = true;
  staleDoc.cits = { "r56-b": { num: "QA-STALE-1" } };
  store.set("drafts", stale);
  WriterState.DOCS = [];
  await restoreDrafts();
  assert.equal(
    doc(d.id).items.some((i) => i.cite),
    false,
    "restored stale marks are cleared",
  );
  assert.equal(doc(d.id).cits["r56-b"], undefined);

  // 5. Supported recovery when a draft has no import status: an existing mark can be removed, not added.
  const legacy = doc(d.id);
  delete legacy.importRule;
  legacy.items[0].cite = true;
  WriterState.state.docId = legacy.id;
  const boxes = citeBoxes();
  assert.equal(boxes.length, 1, "only the existing mark is shown");
  boxes[0].click();
  assert.equal(legacy.items[0].cite, false, "the mark can be removed");
  assert.equal(citeBoxes().length, 0, "and cannot be added back without a Citation import");

  // 6. Reinspection worksheet: Citation corrected to Compliance clears its citation choices.
  const worksheet = {
    id: "r56-visit",
    caseId: k.id,
    draft: true,
    results: { x1: { oc: "notCorrected", cite: true }, x2: { oc: "corrected" } },
  };
  applyImportRule(worksheet, { ...statusRule("Reinspection", "Citation"), status: "Citation" });
  assert.equal(worksheet.results.x1.cite, true, "a Citation status keeps the choice");
  applyImportRule(worksheet, { ...statusRule("Reinspection", "Compliance"), status: "Compliance" });
  assert.equal(worksheet.results.x1.cite, false, "a Compliance status clears it");
  const issued = { ...worksheet, docId: "already-issued", results: { x1: { oc: "notCorrected", cite: true } } };
  applyImportRule(issued, { ...statusRule("Reinspection", "Compliance"), status: "Compliance" });
  assert.equal(issued.results.x1.cite, true, "a worksheet already used for a document is never changed");
  console.log("PASS R56 citation status re-import clears stale marks, survives save and reopen, and keeps a removal path");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
