/* R62 (owner, Development 3): authoring-16 Best Interest and Vacancy Extensions cover every uncorrected item.
   Best Interest takes the worksheet's Next due date like a normal Extension; Vacancy prints no due date for
   uncorrected items and keeps only Scope and the next review inspection. Earlier formats are unchanged. Synthetic. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const src = bundleSource(builtPage());
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
  const toasts = [];
  toast = (m) => toasts.push(String(m));
  const stamp = recordDay(today);
  // A notice with three items, then a worksheet: items 1 and 2 outstanding (each with a Next due date), item 3 corrected.
  function fresh(intent) {
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
    WriterState.state.screen = "cases";
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
    r.followupIntent = intent;
    doc(n.id).items.forEach(
      (i, x) =>
        (r.results[i.id] = {
          oc: x === 2 ? "corrected" : "progress",
          on: r.date,
          note: "Synthetic observation " + (x + 1),
          due: x === 0 ? addDays(stamp, 35) : addDays(stamp, 49),
        }),
    );
    return { n: doc(n.id), r };
  }
  const html = (d) => {
    const box = document.createElement("div");
    box.innerHTML = noticeHTML(d) + newDocuments.details(d);
    return box;
  };

  // 1. Best Interest: the worksheet shows and requires Next due date, as for a normal Extension.
  let { n, r } = fresh("bestInterestExtension");
  const sheet = document.createElement("div");
  WriterState.state.reinspId = r.id;
  WriterState.state.riWalk = false;
  WriterState.state.riFilter = "";
  sheet.innerHTML = screenReinspect();
  assert.equal(sheet.querySelectorAll("[data-ridue]").length, 2, "Next due date for each outstanding item");
  const due0 = r.results[n.items[0].id].due;
  r.results[n.items[0].id].due = "";
  assert.ok(
    worksheetFaults(r, "bestInterestExtension").some((t) => /future due date/.test(t)),
    "Best Interest requires a Next due date",
  );
  r.results[n.items[0].id].due = due0;
  assert.deepEqual(worksheetFaults(r, "bestInterestExtension"), []);
  newDocuments.createSpecial(r, "bestInterestExtension");
  let d = doc(WriterState.state.docId);
  assert.equal(d.type, "bestInterestExtension");
  assert.equal(d.authoringVersion, 16);
  assert.deepEqual(d.special.affected, ["1", "2"], "every uncorrected item is covered");
  assert.deepEqual(
    d.items.map((i) => i.due),
    [addDays(stamp, 35), addDays(stamp, 49), n.items[2].due],
    "uncorrected items take the worksheet dates; the corrected item keeps its date",
  );
  d.mailed = stamp;
  let box = html(d);
  assert.equal(box.querySelectorAll("[data-special-item]").length, 0, "no affected-item checkboxes");
  assert.equal(box.querySelectorAll('[data-special="noSafety"],[data-special="safetyBasis"]').length, 0, "no safety confirmation");
  assert.equal(box.querySelectorAll('[data-field="due"]:not([disabled])').length, 2, "due dates stay editable in Violation items");
  assert.ok(!box.querySelector(".extension-signer"), "no signer block");
  assert.ok(blockers(d).some((b) => /reasons for additional time/.test(b.t)));
  d.special.reason = "Documented repair plan.";
  assert.deepEqual(
    blockers(d).map((b) => b.t),
    [],
  );
  assert.match(docBody(d), /Additional time is granted for the uncorrected items for the following reasons: Documented repair plan\./);
  assert.ok(!/selected items|safety/i.test(docBody(d)));
  d.items[0].due = addDays(stamp, -1);
  assert.ok(
    blockers(d).some((b) => /future due date/.test(b.t)),
    "a past due date is refused",
  );
  d.items[0].due = addDays(stamp, 52);
  assert.ok(
    blockers(d).some((b) => /seven days apart/.test(b.t)),
    "outstanding dates at least seven days apart",
  );
  d.items[0].due = addDays(stamp, 35);
  d.items[2].due = addDays(stamp, 70);
  assert.ok(blockers(d).some((b) => /Corrected items keep their dates/.test(b.t)));

  // 2. Vacancy: every uncorrected item, no due date, Scope and review date only.
  ({ n, r } = fresh("vacancyExtension"));
  newDocuments.createSpecial(r, "vacancyExtension");
  d = doc(WriterState.state.docId);
  assert.equal(d.authoringVersion, 16);
  assert.deepEqual(d.special.affected, ["1", "2"]);
  assert.deepEqual(
    d.items.map((i) => i.due),
    ["", "", n.items[2].due],
    "uncorrected items have no due date; the corrected item keeps its date",
  );
  assert.equal(d.special.originalDues["1"], n.items[0].due, "the source deadline is retained");
  d.mailed = stamp;
  box = html(d);
  const fields = [...box.querySelectorAll("#r26-details [data-special]")].map((x) => x.dataset.special).sort();
  assert.deepEqual(fields, ["reviewDate", "scope"], "only Scope and the review inspection date");
  assert.ok(!/Authority, wording and signer review/.test(box.textContent));
  assert.equal(box.querySelectorAll("[data-special-item]").length, 0);
  assert.equal(box.querySelectorAll('[data-field="due"]').length, 0, "no due date input for uncorrected items");
  assert.ok(!box.querySelector(".extension-signer"), "no signer block");
  d.special.scope = "unit";
  assert.ok(blockers(d).some((b) => /unit identifier/.test(b.t)));
  d.special.unit = "2";
  d.special.reviewDate = addDays(stamp, 5);
  assert.ok(blockers(d).some((b) => /at least seven days after the mailing date/.test(b.t)));
  d.special.reviewDate = addDays(stamp, 7);
  assert.deepEqual(
    blockers(d).map((b) => b.t),
    [],
  );
  const body = docBody(d);
  assert.ok(
    body.includes("While the apartment / unit remains vacant and the conditions below are met, we grant an extension for the uncorrected item(s)."),
  );
  assert.ok(body.includes("The next scheduled review inspection is"));
  for (const removed of [
    "Approved conditions",
    "Security, urgent safety obligations",
    "expires on",
    "subject to review under the approved conditions",
    "Item(s)",
    "sale or transfer",
  ])
    assert.ok(!body.includes(removed), "removed: " + removed);
  d.special.scope = "building";
  assert.ok(docBody(d).includes("While the building remains vacant"));
  d.items[0].due = addDays(stamp, 30);
  assert.ok(blockers(d).some((b) => /have no due date/.test(b.t)));
  d.items[0].due = "";
  const frozen = freezeSources(d);
  assert.ok(!frozen.authorizedSigner && !frozen.divisionReview, "no signer or division review is frozen");

  // 3. Administrative family switching keeps the authoring-16 model in both families.
  ({ n, r } = fresh("bestInterestExtension"));
  newDocuments.createSpecial(r, "bestInterestExtension");
  issueDocument(
    Object.assign(doc(WriterState.state.docId), { mailed: stamp, special: { ...doc(WriterState.state.docId).special, reason: "Plan." } }),
  );
  r.draft = false;
  newDocuments.caseAction(base.id, "vacancyExtension");
  d = doc(WriterState.state.docId);
  assert.equal(d.authoringVersion, 16);
  assert.ok(
    d.items.filter((i) => !i.done).every((i) => i.due === ""),
    "an administrative Vacancy Extension has no due dates for uncorrected items",
  );
  const control = (key, value) => {
    const el = document.createElement("input");
    el.dataset.special = key;
    el.value = value;
    newDocuments.editEvent({ target: el, type: "change" });
  };
  d.draft = true;
  control("administrativeType", "bestInterestExtension");
  assert.equal(d.authoringVersion, 16);
  assert.ok(
    d.items.filter((i) => !i.done).every((i) => i.due !== ""),
    "Best Interest restores the source dates for editing",
  );
  control("administrativeType", "vacancyExtension");
  assert.ok(d.items.filter((i) => !i.done).every((i) => i.due === ""));

  // 4. Earlier formats are unchanged.
  const older = {
    ...clone(d),
    authoringVersion: 13,
    special: { ...d.special, deadlineMode: "dated", conditions: "Remain vacant.", transferClause: "Transfer wording." },
  };
  assert.ok(docBody(older).includes("Approved conditions: Remain vacant."));
  assert.ok(/extension for Item\(s\)/.test(docBody(older)));
  const r61 = { ...clone(d), type: "bestInterestExtension", authoringVersion: 15, special: { affected: ["1"], reason: "Plan." } };
  assert.ok(docBody(r61).includes("Additional time is granted for the selected items"));
  d.draft = false;
  d.status = "Final";
  d.eventId = "r62-vacancy-issued";
  d.mailed = stamp;
  d.special.scope = "building";
  d.special.reviewDate = addDays(stamp, 14);
  d.frozen = freezeSources(d);
  const correction = startCorrection(d.id);
  assert.ok(correction);
  const correctionDetails = document.createElement("div");
  correctionDetails.innerHTML = newDocuments.details(correction);
  assert.equal(correctionDetails.querySelector('[data-special="administrativeType"]'), null, "corrections cannot switch document family");
  correction.special.scope = "unit";
  correction.special.unit = "2";
  assert.ok(
    correctionChecks(correction).some((c) => !c.ok && /new action.*scope/.test(c.t)),
    "the browser explains the helper's protected-scope rule before saving",
  );

  console.log(
    "PASS R62 authoring-16 Best Interest and Vacancy Extensions: all uncorrected items, worksheet dates, removed fields, historical formats",
  );
  process.exit(0);
};
eval(src + "\n(" + tests.toString() + ")().catch((e) => { console.error(e); process.exit(1); });");
