/* R42 document tasks, readiness, publication routing and preserved print packets. */
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
  saveDrafts = async () => true;
  idbSet = async () => true;
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
  d.items = [{ id: "r42-item", no: "1", title: "Wall repair", text: "Repair ( ) on the wall.", sections: ["27.05(2)(c)"], due: "", cite: false }];
  render();
  const app = document.getElementById("app");
  assert.equal(app.querySelectorAll(".topbar-actions .btn-primary").length, 1);
  assert.ok(document.querySelector("#btn-save"));
  assert.equal(app.querySelectorAll("[data-editor-section]").length, 3);
  assert.ok(document.querySelector("#checkbox-panel .fail"));
  assert.equal(document.querySelector(".passed-checks").open, false);
  assert.equal(document.querySelector("#btn-checks").getAttribute("aria-expanded"), "true");
  assert.ok(
    document.querySelector(".desk").compareDocumentPosition(document.querySelector('[aria-label="Assign due dates"]')) &
      window.Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const check = checks(d).find((c) => !c.ok && c.targets?.some((t) => t.selector.includes("text")));
  focusCheckTarget(check.targets[0], check.t);
  assert.equal(document.activeElement.dataset.field, "text");
  document.querySelector('[data-editor-section="editor-review"]').click();
  assert.equal(document.activeElement.id, "editor-review-title");
  const text = document.querySelector('[data-field="text"]');
  text.focus();
  Object.defineProperty(text, "isContentEditable", { value: true });
  text.textContent = "Repair the damaged wall.";
  text.innerText = "Repair the damaged wall.";
  text.dispatchEvent(new window.Event("input", { bubbles: true }));
  await Promise.resolve();
  assert.equal(document.activeElement, text);
  assert.equal(d.items[0].text, "Repair the damaged wall.");
  assert.equal(
    document.querySelector("[data-editor-readiness]").textContent,
    document.querySelector("#chk-chip").textContent,
    "readiness summaries update together",
  );
  d.items[0].due = addDays(recordDay(today), 21);
  render();
  assert.equal(document.querySelector("#btn-final").textContent, "Review & issue");
  const newer = { ...clone(d), id: "r42-newer" };
  WriterState.DOCS.unshift(newer);
  render();
  assert.equal(document.querySelector(".editor-primary").textContent, "Review saved work");
  assert.ok(document.querySelector(".editor-context").textContent.includes("Draft · read-only"));
  WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== newer.id);
  d.pendingAmendment = { type: "notice.issued", payload: {} };
  render();
  assert.equal(document.querySelector(".editor-primary").textContent, "Confirm save");
  assert.equal(document.querySelector("#btn-final"), null);
  delete d.pendingAmendment;
  d.draft = false;
  d.status = "Final";
  d.frozen = freezeSources(d);
  render();
  assert.equal(document.querySelector(".editor-primary").textContent, "Finish PDF filing");
  d.filedAt = nowISO();
  WriterState.RECORD_ATTEMPTS.pending = { cid: d.caseId, recordKey: "pending", pendingAmendment: { payload: { docId: d.id } } };
  render();
  assert.equal(document.querySelector(".editor-primary").getAttribute("data-resumerecord"), "pending");
  WriterState.RECORD_ATTEMPTS = {};
  render();
  assert.equal(document.querySelector(".editor-primary").textContent, "Print issued PDF");
  assert.equal(document.querySelector(".editor-more").open, false);
  assert.ok(document.querySelector(".editor-more #btn-correct"));
  WriterState.state.publicationBusy = d.id;
  render();
  assert.equal(document.querySelector(".editor-primary").disabled, true);
  assert.equal(document.querySelector("#btn-recordnote").disabled, true);
  WriterState.state.publicationBusy = null;
  const follow = { ...clone(d), id: "r42-follow", draft: true, status: "Draft", type: "extension", fromReinspId: "none" };
  WriterState.DOCS.push(follow);
  WriterState.state.docId = follow.id;
  render();
  assert.equal(document.querySelector('[aria-label="Assign due dates"]'), null);
  WriterState.state.docId = d.id;
  d.draft = true;
  d.status = "Draft";
  delete d.frozen;
  d.items[0].cite = true;
  initialCitations.prepare(d);
  render();
  assert.equal(document.querySelectorAll(".initial-citation-previews .cit").length, 4);
  assert.equal(document.querySelectorAll(".initial-citation-previews [data-editor-extra-copy]").length, 3);
  const printable = printJob(initialCitations.preview(d));
  assert.equal((printable.html.match(/class="cit /g) || []).length, 4);
  const printFrame = new JSDOM(printable.html).window.document;
  assert.equal(printFrame.body.querySelector("[data-editor-extra-copy]"), null, "fixed print body never inherits screen copy filtering");
  assert.equal(printFrame.body.querySelector(".document-workspace"), null, "screen-only copy CSS has no matching print ancestor");
  const entry = policyAt(recordDay(today)).entries.find((e) => e.rule?.kind === "mandatory");
  d.items[0].sections = [entry.ordinance];
  d.cits[d.items[0].id] = {
    ord: entry.ordinance,
    issued: recordDay(today),
    ...resolveCitationAmount({ ordinance: entry.ordinance, entryId: entry.id, tier: 1, date: recordDay(today) }),
  };
  render();
  assert.equal(document.querySelector("#btn-final").textContent, "Review held draft");
  assert.equal(document.querySelector("[data-editor-preview]").disabled, true);
  assert.equal(document.querySelectorAll(".cit-inst").length, 0);
  const ids = [...document.querySelectorAll("[id]")].map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "editor has unique element identities");
  console.log(
    "PASS R42 task sections, keyboard check links, draft updates, publication" + "/filing priority, held mandatory draft and full print packet",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
