/* R26 scoped actions, truthful restrictions and inspection reuse. Synthetic only. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  src = bundleSource(html);
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = window.document;
global.localStorage = window.localStorage;
global.getSelection = () => window.getSelection();
global.confirm = () => true;
window.scrollTo = () => {};
const tests = async () => {
  await new Promise((r) => setTimeout(r, 20));
  const base = clone(kase("k1"));
  render = () => {};
  idbSet = async () => true;
  idbGet = async () => null;
  filePdf = async () => true;
  writeSummary = async () => true;
  emailDocument = async () => true;
  const stamp = recordDay(today),
    review = {
      scope: "building",
      reviewer: "SYNTHETIC DIVISION REVIEWER",
      reviewRef: "SYNTHETIC QA ONLY — current code and approved wording fixture",
      codeSource: "https://example.invalid/synthetic-qa-code",
      codeRevision: "SYNTHETIC QA code revision and amendment review",
      reviewDateLegal: stamp,
      reviewed: true,
      authority: "27.08",
      signerName: "QA AUTHORIZED SIGNER",
      signerTitle: "QA Director",
      delegation: "SYNTHETIC QA authorization record",
    };
  function fresh() {
    WriterState.CASES = [clone(base)];
    WriterState.CASES[0].date = addDays(stamp, -30);
    WriterState.DOCS = [];
    WriterState.REINSP = [];
    WriterState.EVENTS = {};
    WriterState.PENDING = [];
    WriterState.SAVE_CHECKPOINTS = {};
    WriterState.WORK = { entry: {}, recordForms: {} };
    WriterState.RECORD_ATTEMPTS = {};
    COMMITTED.clear();
    WriterState.state.docId = null;
    WriterState.state.reinspId = null;
    WriterState.state.screen = "cases";
    WriterState.state.modal = null;
    WriterState.CASEDIR = { helper: true };
    WriterState.HELPER = { caseStore: true };
    newDoc(base.id, "notice");
    const n = doc(WriterState.state.docId);
    n.items = Array.from({ length: 3 }, (_, x) => ({
      id: uid("x"),
      no: String(x + 1),
      sections: ["27.05(2)(c)"],
      text: "Repair condition " + (x + 1) + ".",
      title: "Condition " + (x + 1),
      due: addDays(stamp, 14),
      done: false,
      doneOn: "",
    }));
    issueDocument(n);
    startReinspection(base.id);
    const r = reinsp(WriterState.state.reinspId);
    r.time = "10:15";
    doc(n.id).items.forEach(
      (i, x) =>
        (r.results[i.id] = {
          oc: x === 2 ? "corrected" : "progress",
          on: r.date,
          note: "Synthetic observation",
          due: addDays(stamp, 35),
          cite: false,
        }),
    );
    return { n: doc(n.id), r };
  }
  function create(r, type, facts) {
    newDocuments.createSpecial(r, type);
    const d = doc(WriterState.state.docId);
    assert.equal(d.type, type);
    // Retain the original reviewed special-document contract; R61 has separate coverage.
    d.authoringVersion = 13;
    d.mailed = stamp;
    d.special = { ...d.special, ...review, ...facts };
    return d;
  }
  for (const type of ["summaryAbatement", "nonSummaryAbatement"])
    for (const variant of ["junk", "sidewalk", "tree", ...(type === "summaryAbatement" ? ["secure"] : [])]) {
      const { n, r } = fresh();
      const d = create(r, type, {
        variant,
        findings: "Specific observed condition at west entry.",
        work: "Remove the observed nuisance.",
        summaryBasis: "Specific immediate danger established by QA review.",
        orderDue: addDays(stamp, 9),
        servicePlan: "Approved service plan fixture; service is not yet completed.",
        remedyReviewed: true,
        forestryRef: "QA forestry report",
        securingConditions: "Secure all described openings; remove animals and materials as reviewed.",
        boarding: true,
        boardingRef: "QA prior written Director approval",
      });
      assert.equal(blockers(d).length, 0, JSON.stringify(blockers(d)));
      assert.ok(noticeHTML(d).includes("Order to Abate Public Nuisance"));
      d.special.work = "Remove ( )";
      assert.ok(blockers(d).length > 0);
      assert.ok(docBody(d).includes('class="blank"'));
      d.special.work = "Remove the observed nuisance.";
      const body = docBody(d);
      assert.ok(body.includes(type === "summaryAbatement" ? "immediately" : "thirty (30) days of service or publication"));
      assert.ok(!body.includes("fifteen"));
      assert.ok(!body.includes("7 feet"));
      issueDocument(d);
      assert.equal(sourceDocFor(base.id).id, n.id);
      assert.equal(reinspFor(base.id).length, 1);
      assert.equal(summarize(caseFile(base.id)).documents.length, 2);
      assert.deepEqual(
        doc(d.id).items.map((i) => i.due),
        n.items.map((i) => i.due),
      );
    }
  let { n, r } = fresh();
  let d = create(r, "noOccupancy", {
    mode: "restrict",
    scope: "unit",
    unit: "B-204",
    posting: "pending",
    prePostingRef: "QA approved pre-posting wording",
    effective: stamp,
    findings: "Unsafe sleeping-room conditions.",
    releaseConditions: "Correct defects and obtain written reoccupation permission.",
  });
  assert.equal(blockers(d).length, 0);
  assert.ok(!docBody(d).includes("was posted"));
  issueDocument(d);
  const restrictionId = d.id;
  r = reinsp(r.id);
  d = create(r, "summaryAbatement", {
    variant: "secure",
    summaryBasis: "Emergency openings permit entry.",
    findings: "Unsecured north opening.",
    work: "Secure the north opening.",
    securingConditions: "Approved securing and removal conditions.",
  });
  assert.equal(blockers(d).length, 0);
  issueDocument(d);
  assert.equal(reinspFor(base.id).length, 1);
  assert.equal(activeRestrictions(docsFor(base.id)).length, 1);
  assert.equal(summarize(caseFile(base.id)).visits.length, 1);
  r = reinsp(r.id);
  docFromReinspection(r, "extension");
  d = doc(WriterState.state.docId);
  assert.equal(d.type, "extension");
  assert.equal(blockers(d).length, 0, JSON.stringify(blockers(d)));
  issueDocument(d);
  assert.equal(reinspFor(base.id).length, 1);
  assert.equal(sourceDocFor(base.id).type, "extension");
  assert.equal(caseState(kase(base.id)).label, "Occupancy restricted");
  startReinspection(base.id);
  r = reinsp(WriterState.state.reinspId);
  r.time = "11:00";
  sourceDocFor(base.id).items.forEach((i) => {
    if (!i.done) r.results[i.id] = { oc: "corrected", on: r.date, note: "" };
  });
  docFromReinspection(r, "compliance");
  d = doc(WriterState.state.docId);
  issueDocument(d);
  assert.equal(caseState(kase(base.id)).closed, false);
  assert.equal(summarize(caseFile(base.id)).case.status, "Occupancy restricted");
  assert.equal(activeRestrictions(docsFor(base.id)).length, 1);
  newDocuments.caseAction(base.id, "noOccupancy");
  d = doc(WriterState.state.docId);
  d.mailed = stamp;
  d.special = {
    ...review,
    mode: "release",
    scope: "unit",
    unit: "B-204",
    releases: restrictionId,
    effective: stamp,
    releaseInspection: stamp,
    releaseFacts: "QA reinspection record confirms all release conditions.",
    placardRemoved: true,
    removalDate: stamp,
    releaseFormRef: "QA approved release form",
    releaseVisitId: reinspFor(base.id).at(-1).id,
  };
  assert.equal(blockers(d).length, 0, JSON.stringify(blockers(d)));
  issueDocument(d);
  assert.equal(activeRestrictions(docsFor(base.id)).length, 0);
  assert.equal(caseState(kase(base.id)).closed, true);
  ({ n, r } = fresh());
  d = create(r, "bestInterestExtension", {
    scope: "building",
    affected: ["1"],
    noSafety: true,
    safetyBasis: "QA reviewer excluded all safety and urgent conditions.",
    noticeRef: "Original notice QA",
    reason: "Documented repair plan benefits the City and owner.",
    intentions: "Contractor will complete work.",
    supervisor: "QA supervisor",
    stage: "administrative",
  });
  d.items[0].due = addDays(stamp, 35);
  assert.equal(blockers(d).length, 0, JSON.stringify(blockers(d)));
  assert.equal(d.items[1].due, n.items[1].due);
  d.items[1].due = addDays(stamp, 49);
  assert.ok(blockers(d).some((x) => /Unselected/.test(x.t)));
  d.items[1].due = n.items[1].due;
  d.special.reviewed = false;
  assert.ok(blockers(d).some((x) => /Division review/.test(x.t)));
  ({ n, r } = fresh());
  d = create(r, "vacancyExtension", {
    scope: "unit",
    unit: "A",
    affected: ["1"],
    noSafety: true,
    safetyBasis: "Reviewed nonurgent interior repairs only.",
    requestRef: "QA request",
    vacancyFacts: "Verified vacant unit at inspection.",
    conditions: "Remain vacant and meet maintenance obligations.",
    reviewDate: addDays(stamp, 42),
    expiryMode: "review",
    expiryPolicyRef: "QA reviewed policy",
    deadlineMode: "conditional",
    transferClause: "QA approved applicable transfer and disclosure wording.",
  });
  assert.equal(blockers(d).length, 0, JSON.stringify(blockers(d)));
  assert.ok(docBody(d).includes("building common areas"));
  assert.equal(d.items[0].due, n.items[0].due);
  assert.ok(noticeHTML(d).includes("Conditional — see conditions above"));
  assert.ok(docBody({ ...clone(d), authoringVersion: 11 }).includes("no replacement repair date"), "retain historical conditional wording");
  d.special.unit = "";
  assert.ok(blockers(d).some((x) => /unit identifier/.test(x.t)));
  const saved = clone(draftBundle());
  assert.ok(saved.docs.some((x) => x.id === d.id && x.special.reviewDate === d.special.reviewDate));
  assert.equal(migrate({ schema: 3, events: [] }).schema, 4);
  assert.equal(SUMMARY_VERSION, 6);
  // A corrected item recorded by a supplemental action remains corrected in later work.
  ({ n, r } = fresh());
  d = create(r, "summaryAbatement", {
    variant: "junk",
    summaryBasis: "Reviewed immediate danger.",
    findings: "Specific nuisance.",
    work: "Remove nuisance.",
  });
  issueDocument(d);
  newDocuments.caseAction(base.id, "bestInterestExtension");
  d = doc(WriterState.state.docId);
  assert.equal(d.factualVisitId, r.id);
  assert.equal(d.items[2].done, true);
  assert.equal(d.items[2].doneOn, r.date);
  assert.equal(d.inspDate, r.date);
  d.special.affected = ["1"];
  const control = (key, value) => {
    const el = document.createElement("input");
    el.dataset.special = key;
    el.value = value;
    newDocuments.editEvent({ target: el, type: "change" });
  };
  const dueControl = document.createElement("input");
  dueControl.dataset.specialDue = "1";
  dueControl.value = addDays(stamp, 35);
  newDocuments.editEvent({ target: dueControl, type: "change" });
  control("administrativeType", "vacancyExtension");
  assert.equal(d.items[0].due, n.items[0].due);
  control("administrativeType", "bestInterestExtension");
  assert.equal(d.items[0].due, addDays(stamp, 35), "Returning to the action retains its extended dates");
  control("administrativeType", "vacancyExtension");
  d.special.affected = ["1"];
  d.special.extendedDues = { 1: addDays(stamp, 42) };
  control("deadlineMode", "dated");
  assert.equal(d.items[0].due, addDays(stamp, 42));
  control("deadlineMode", "conditional");
  assert.equal(d.items[0].due, n.items[0].due, "Inactive specific deadlines cannot alter conditional source facts");
  control("deadlineMode", "dated");
  assert.equal(d.items[0].due, addDays(stamp, 42));
  WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== d.id);
  startReinspection(base.id);
  r = reinsp(WriterState.state.reinspId);
  assert.equal(r.results[n.items[2].id].carried, true);
  assert.equal(r.results[n.items[2].id].on, n.items[2].doneOn || stamp);
  ({ n, r } = fresh());
  const before = JSON.stringify(r.results);
  r.followupIntent = "";
  const chooser = newDocuments.chooser(r);
  assert.ok(chooser.includes("All document types (10 families)"));
  assert.equal((chooser.match(/data-create-action/g) || []).length, 1);
  assert.ok(!chooser.includes(" checked"));
  r.followupIntent = "summaryAbatement";
  assert.equal(JSON.stringify(r.results), before);
  // Emergency initial drafts need no fabricated notice or visit; legitimately no item rows.
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  newDoc(base.id, "notice");
  d = doc(WriterState.state.docId);
  d.type = "summaryAbatement";
  d.initialAction = true;
  d.special = {
    ...review,
    variant: "junk",
    findings: "Immediate sanitary danger.",
    work: "Remove contaminated material.",
    summaryBasis: "QA documented immediate danger.",
  };
  d.mailed = stamp;
  assert.equal(blockers(d).length, 0, JSON.stringify(blockers(d)));
  assert.equal(d.items.length, 0);
  assert.ok(!noticeHTML(d).includes("No items yet"));
  issueDocument(d);
  assert.equal(reinspFor(base.id).length, 0);
  console.log(
    "PASS R26 variants, scoped deadlines, authority gates, shared visits, per" +
      "sistent restrictions, explicit release, migrations and draft retention",
  );
  process.exit(0);
};
eval(src + require("../fixtures/projection_capture.cjs") + "\n(" + tests.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
