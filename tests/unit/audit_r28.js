/* Initial citation bundle, editable fields, lost-response retry and immutable snapshots. */
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
global.document = dom.window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.confirm = () => true;
global.fetch = async () => {
  throw new Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  WriterState.REINSP = [];
  WriterState.PENDING = [];
  WriterState.CASEDIR = { helper: true };
  WriterState.CATALOG_VERIFIED = true;
  refreshCatalog = async () => true;
  idbSet = async () => true;
  saveDrafts = async () => true;
  render = () => {};
  writeSummary = async () => true;
  let requests = 0,
    stored = null,
    drop = true;
  const jobs = [];
  helperJSON = async (url, body) => {
    requests++;
    stored = clone(body.file);
    if (drop) {
      drop = false;
      throw new Error("Network request failed after committed write");
    }
    return { ok: true, file: stored, revision: "qa", name: body.name };
  };
  filePdf = async (d, job) => {
    jobs.push({ id: d.id, job });
    return false;
  };
  newDoc("k1", "notice");
  const n = doc(WriterState.state.docId);
  n.items = [1, 2, 3].map((no) => ({
    id: uid("x"),
    no: String(no),
    sections: [no === 2 ? "SPS 999.99" : "27.05(2)(c)"],
    title: "Initial defect " + no,
    text: "Repair the exterior siding.",
    due: addDays(recordDay(today), 21),
    cite: no !== 3,
    done: false,
  }));
  initialCitations.prepare(n);
  const ids = n.items.map((i) => i.id);
  assert.ok(n.depositRequests[ids[1]] && !n.cits[ids[1]]);
  const nums = ids.slice(0, 2).map((id) => (n.cits[id] || n.depositRequests[id]).num);
  assert.equal(new Set(nums).size, 2);
  assert.ok(blockers(n).some((c) => /deposit/.test(c.t)));
  assert.equal(await publishDocument(n), false);
  assert.equal(requests, 0);
  assert.equal(eventsFor(n.caseId).length, 0);
  assert.ok(
    depositStep.complete(n, ids[1], {
      ord: "SPS999.99",
      depositMode: "total",
      amount: "250.00",
      depositSource: "Synthetic court instruction, total includes assessments.",
    }),
  );
  editCitation(n, ids[1], "desc", "Custom inspector description");
  editCitation(n, ids[1], "ord", "SPS999.99");
  assert.equal(n.cits[ids[1]].amount, "250.00", "Blur of unchanged ordinance preserves approved total");
  editCitation(n, ids[1], "depositMode", "total");
  assert.equal(n.cits[ids[1]].depositSource, "Synthetic court instruction, total includes assessments.", "Duplicate change event preserves source");
  document.getElementById("app").innerHTML =
    citationReview(n) + '<div class="initial-citation-previews">' + citationFaces(initialCitations.preview(n), true) + "</div>";
  const ordInput = document.querySelector('[data-review-cit="' + ids[1] + '|ord"]');
  ordInput.focus();
  ordInput.value = "MGO 27.05 (2) (c)";
  editCitation(n, ids[1], "ord", "MGO 27.05 (2) (c)");
  initialCitations.refresh(n);
  assert.equal(document.querySelector('[data-review-cit="' + ids[1] + '|depositMode"]').value, "schedule");
  assert.equal(document.activeElement, ordInput);
  assert.equal(document.querySelector('[data-review-cit="' + ids[1] + '|base"]').value, "200");
  assert.ok(document.querySelector(".initial-citation-previews").textContent.includes("Custom inspector description"));
  assert.ok(document.querySelector(".initial-citation-previews").textContent.includes("197.00"));
  assert.equal(document.querySelector(".initial-citation-previews").textContent.includes("SPS999.99"), false);
  assert.equal(n.cits[ids[1]].ord, "27.05(2)(c)");
  assert.equal(n.cits[ids[1]].amount, "323.00");
  assert.equal(n.cits[ids[1]].desc, "Custom inspector description");
  editCitation(n, ids[1], "differentChargeSource", "Synthetic approval of changed charge QA-INITIAL-2.");
  assert.equal(blockers(n).length, 0, JSON.stringify(blockers(n)));
  const restored = clone(n);
  assert.deepEqual(restored.cits, n.cits);
  assert.equal(restored.initialCitationId, n.initialCitationId);
  n.items[1].cite = false;
  assert.equal(initialCitations.preview(n).items.filter((i) => i.cite).length, 1);
  n.items[1].cite = true;
  assert.equal(n.cits[ids[1]].num, nums[1]);
  n.cits[ids[1]].num = nums[0];
  assert.ok(blockers(n).some((c) => /distinct/.test(c.t)));
  n.cits[ids[1]].num = nums[1];
  editCitation(n, ids[0], "ord", "27.05(2)(c), 27.05(2)(d)");
  assert.ok(blockers(n).some((c) => /one complete ordinance/.test(c.t)));
  editCitation(n, ids[0], "ord", "27.05(2)(c)");
  assert.equal(feeLines("0.25", 48).total, 71.32);
  assert.equal(blockers(n).length, 0);
  const actualPrintJob = printJob;
  printJob = () => {
    throw new Error("Synthetic document render failure");
  };
  assert.equal(await publishDocument(n), false);
  assert.equal(requests, 0, "Failed document preflight sends no issuance");
  assert.equal(eventsFor(n.caseId).length, 0);
  assert.ok(n.draft && !n.pendingAmendment);
  printJob = actualPrintJob;
  assert.equal(await publishDocument(n), false);
  assert.equal(requests, 1);
  assert.ok(n.pendingAmendment);
  assert.equal(eventsFor(n.caseId).length, 0, "Unconfirmed response cannot advance local case");
  const attempt = n.pendingAmendment.id,
    head = stored.events.map((e) => e.id);
  assert.equal(stored.events.filter((e) => e.type === "notice.issued").length, 1);
  assert.equal(stored.events.filter((e) => e.type === "citation.issued").length, 1);
  assert.equal(stored.events.filter((e) => e.type === "reinspection.recorded").length, 0);
  assert.equal(await publishDocument(n), true);
  assert.equal(requests, 2);
  assert.deepEqual(
    stored.events.map((e) => e.id),
    head,
  );
  assert.ok(stored.events.some((e) => e.id === attempt));
  const notice = docsFor(n.caseId).find((d) => d.type === "notice"),
    cit = docsFor(n.caseId).find((d) => d.type === "citation");
  assert.ok(notice && !notice.draft && cit && !cit.draft);
  assert.equal(Object.keys(notice.cits).length, 0);
  assert.equal(Object.keys(cit.cits).length, 2);
  assert.deepEqual(notice.issuanceGroup, cit.issuanceGroup);
  assert.equal(cit.fromDocId, notice.id);
  /* R35: the citation replaces the Official Notice; only it is filed. */ assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, cit.id);
  assert.ok(deliveredByCitation(notice));
  assert.ok(!initialOrderCitation(notice));
  assert.ok(initialOrderCitation(cit));
  const numbers = Object.values(cit.cits).map((c) => c.num);
  assert.deepEqual(numbers.sort(), nums.sort());
  assert.equal(summarize(caseFile(n.caseId)).citations.length, 2);
  assert.equal((citationFaces(cit, true).match(/class="cit-form"/g) || []).length, 8);
  assert.equal(citationFromNotice(notice.id).id, cit.id, "Legacy resume finds issued companion without duplication");
  console.log(
    "PASS R28 initial pair validation, normalized editing, preserved override" +
      "s, two citations, no invented visit, atomic lost-response retry, four co" +
      "pies per charge and report counts",
  );
  process.exit(0);
};
eval(payload + require("../fixtures/projection_capture.cjs") + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
