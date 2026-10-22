/* R56 usability phase 2: one readiness summary with a first-field link, a single Review checklist, a decision-focused
   issuance dialog that still validates at issuance, row selection for shared due dates, and authoring-13 affected-item
   selection beside each due date (authoring 12 unchanged). */
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
window.HTMLElement.prototype.scrollIntoView = function () {};
global.fetch = async () => {
  throw Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 30));
  saveDrafts = async () => true;
  idbSet = async () => true;
  const toasts = [];
  const originalToast = toast;
  toast = (message, options) => {
    toasts.push(String(message));
    return originalToast(message, options);
  };
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
  const day = (n) => addDays(recordDay(today), n);
  const change = (el, checked) => {
    el.checked = checked;
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  const input = (el, value) => {
    el.value = value;
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };

  // ITEM 8. One readiness summary at the top of the editor.
  newDoc(k.id, "notice");
  const d = doc(WriterState.state.docId);
  d.items = [
    { id: "u2-a", no: "1", title: "Wall repair", text: "Repair ( ) on the wall.", sections: ["27.05(2)(c)"], due: "", cite: false },
    { id: "u2-b", no: "2", title: "Porch repair", text: "Repair the porch.", sections: ["27.05(2)(c)"], due: "", cite: false },
    { id: "u2-c", no: "3", title: "Gutter repair", text: "Repair the gutter.", sections: ["27.05(2)(c)"], due: "", cite: false },
  ];
  render();
  const readiness = () => editorReadiness(d);
  const summaryText = (r) => {
    const fixes = r.required.length + " required fix" + (r.required.length === 1 ? "" : "es"),
      notes = r.advice.length ? r.advice.length + " advisor" + (r.advice.length === 1 ? "y" : "ies") : "";
    return r.required.length ? [fixes, notes].filter(Boolean).join(" · ") : ["Ready for review", notes].filter(Boolean).join(" · ");
  };
  let ready = readiness();
  assert.ok(ready.required.length > 1, "the draft starts with several required fixes");
  assert.equal(document.querySelectorAll("#chk-chip").length, 1, "one status chip");
  assert.equal(document.querySelectorAll("[data-editor-readiness]").length, 1, "one readiness summary");
  const chip = document.getElementById("chk-chip");
  assert.ok(chip.closest(".editor-readiness"), "the summary is the editor's top readiness line");
  assert.ok(chip.matches("[data-editor-readiness].cchip.bad"));
  assert.equal(chip.textContent, summaryText(ready));
  assert.match(chip.textContent, /^\d+ required fix(es)?( · \d+ advisor(y|ies))?$/);
  assert.ok(!document.getElementById("app").textContent.includes("Required checks link to the field that needs attention."));
  assert.equal(document.querySelector("#btn-review").textContent, "Review · " + ready.required.length);
  // R59: one complete checklist in the Review dialog: blocking concerns, then advisories, then the collapsed passed
  // checks, without a second status chip. The document page carries no competing checklist.
  assert.equal(document.querySelectorAll("#checkbox-panel,#btn-checks,.passed-checks").length, 0, "no checklist on the page");
  document.querySelector("#btn-review").click();
  const review = document.querySelector("#overlay [data-review-dialog]");
  assert.equal(review.querySelector("h2").textContent, "Review");
  assert.equal(document.querySelectorAll(".passed-checks").length, 1);
  assert.equal(review.querySelector(".passed-checks").open, false);
  assert.equal(review.querySelectorAll(".cchip").length, 0, "Review does not repeat the status chip");
  assert.equal(review.querySelector("[data-review-blocking] h3").textContent, "Must fix before issuing");
  assert.equal(review.querySelectorAll("[data-review-blocking] .check.fail").length, ready.required.length, "every required fix is listed once");
  assert.equal(review.querySelectorAll(".check.fail").length, ready.required.length);
  WriterState.state.modal = null;
  render();
  // Go to first required field uses the existing check-link path to the first unresolved required check's field.
  const go = document.querySelector(".editor-readiness [data-readiness-first]");
  assert.equal(go.textContent, "Go to first required field");
  const firstIndex = ready.list.findIndex((c) => !c.ok && !c.soft && c.targets?.length),
    first = ready.list[firstIndex];
  assert.equal(go.dataset.checkIndex, String(firstIndex));
  go.click();
  assert.equal(document.activeElement, document.querySelector(first.targets[0].selector), "focus lands on the first required field");
  assert.ok(document.activeElement.closest(".desk"), "the field is on the working document");
  // Open full checklist opens the same Review dialog.
  document.querySelector(".editor-readiness [data-open-checklist]").click();
  assert.equal(WriterState.state.modal, "review");
  assert.ok(document.querySelector("#overlay [data-review-dialog]").contains(document.activeElement));
  WriterState.state.modal = null;
  render();
  // Typing updates the summary and its first-field button in place.
  const text = document.querySelector('[data-field="text"][data-id="u2-a"]');
  text.textContent = "Repair the damaged wall.";
  text.innerText = "Repair the damaged wall.";
  text.dispatchEvent(new window.Event("input", { bubbles: true }));
  await Promise.resolve();
  d.items.forEach((i, n) => (i.due = day(21 + n * 7)));
  syncChip();
  ready = readiness();
  assert.equal(ready.required.length, 0, JSON.stringify(ready.required.map((c) => c.t)));
  assert.equal(document.getElementById("chk-chip").textContent, summaryText(ready));
  assert.match(document.getElementById("chk-chip").textContent, /^Ready for review( · \d+ advisor(y|ies))?$/);
  assert.ok(document.getElementById("chk-chip").classList.contains("good"));
  const after = document.querySelector(".editor-readiness [data-readiness-first]");
  if (ready.advice.some((c) => c.targets?.length)) assert.equal(after.textContent, "Go to first advisory");
  else assert.equal(after, null, "no first-field button without an open check");
  assert.equal(document.querySelector("#btn-review").textContent, "Review");
  // An advisory-only document offers its first advisory.
  const advisory = { ...ready, required: [], advice: [{ ok: false, soft: true, t: "Advisory", targets: [checkTarget("#bulk-due", "x")] }] };
  advisory.list = [{ ok: true, t: "Passed" }, ...advisory.advice];
  assert.deepEqual(readinessFirst(advisory), { index: 1, label: "Go to first advisory" });
  assert.equal(readinessText([], advisory.advice), "Ready for review · 1 advisory");
  assert.equal(readinessText([{}], [{}, {}]), "1 required fix · 2 advisories");
  assert.equal(readinessText([{}, {}], []), "2 required fixes");
  assert.equal(readinessText([], []), "Ready for review");

  // ITEM 8. The issuance dialog shows the decision: failures (linked), facts and acknowledgments, not the passed list.
  d.items[0].due = "";
  WriterState.state.modal = "final";
  render();
  let modal = document.querySelector(".modal");
  assert.ok(blockers(d).length > 0);
  assert.ok(modal.querySelector(".banner.alert").textContent.includes("to fix before this can be issued"));
  assert.ok(modal.querySelector(".check.fail .check-link"), "each failure links back to its field");
  assert.equal(modal.querySelector(".passed-checks"), null, "no repeated passed-checks list");
  assert.equal(modal.querySelectorAll(".check.pass").length, 0);
  assert.ok(modal.querySelector("#fin-mailed"), "mailing date stays in the decision");
  assert.equal(modal.querySelector("#fin-go").disabled, true, "issuance is disabled while checks fail");
  // A forced click is still refused by the full validation at issuance.
  modal.querySelector("#fin-go").disabled = false;
  modal.querySelector("#fin-go").click();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(toasts.at(-1), "Clear the outstanding checks before finalizing");
  assert.equal(d.draft, true, "not issued");
  // A dialog rendered ready still validates the current document when Issue is pressed.
  d.items[0].due = day(21);
  render();
  modal = document.querySelector(".modal");
  assert.deepEqual(blockers(d), []);
  assert.equal(modal.querySelector("#fin-go").disabled, false);
  assert.equal(modal.querySelector(".passed-checks"), null);
  d.items[0].due = day(-1);
  modal.querySelector("#fin-go").click();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(toasts.at(-1), "Clear the outstanding checks before finalizing", "issuance validates at the final boundary");
  assert.equal(d.draft, true);
  WriterState.state.modal = null;

  // ITEM 9. Rows select items for a shared due date; the compact bar applies the date through assignDue.
  d.items.push({ id: "u2-d", no: "4", title: "Fence repair", text: "Repair the fence.", sections: ["27.05(2)(c)"], due: "", cite: false });
  d.items.forEach((i) => (i.due = ""));
  d.dueWork = {};
  render();
  const panel = document.querySelector('[aria-label="Assign due dates"]');
  assert.ok(document.querySelector(".desk").compareDocumentPosition(panel) & window.Node.DOCUMENT_POSITION_FOLLOWING, "bar below the notice");
  assert.equal(panel.querySelectorAll("[data-due-select],.deadline-item,[data-due-label]").length, 0, "no repeated per-item list");
  assert.equal(panel.querySelector("[data-due-count]").textContent, "0 of 3 dates used");
  assert.equal(panel.querySelector('label[for="bulk-due"]').textContent, "Date for selected items");
  assert.equal(panel.querySelector("#btn-bulkdue").textContent, "Apply date to selected items");
  assert.deepEqual(
    [...panel.querySelectorAll("[data-due-all]")].map((b) => b.textContent),
    ["Select all", "Clear selection"],
  );
  const rowBoxes = () => [...document.querySelectorAll(".desk [data-due-select]")];
  assert.deepEqual(
    rowBoxes().map((b) => b.dataset.dueSelect),
    d.items.map((i) => i.id),
  );
  assert.ok(
    rowBoxes().every(
      (b, n) => b.closest(".c-due") && b.matches(".no-print") && b.getAttribute("aria-label") === "Select item " + (n + 1) + " for a shared due date",
    ),
    "each row's selection sits beside its due date and never prints",
  );
  change(rowBoxes()[0], true);
  change(rowBoxes()[2], true);
  assert.deepEqual(d.dueWork.selected, ["u2-a", "u2-c"], "rows use the panel's selection state");
  assert.equal(document.querySelector("[data-due-selected]").textContent, "2 of 4 items selected");
  const A = day(21),
    B = day(35),
    C = day(49);
  input(document.getElementById("bulk-due"), A);
  document.getElementById("btn-bulkdue").click();
  assert.deepEqual(
    d.items.map((i) => i.due),
    [A, "", A, ""],
    "the date applies only to selected rows",
  );
  assert.deepEqual(
    rowBoxes().map((b) => b.checked),
    [true, false, true, false],
    "selection survives the repaint",
  );
  assert.equal(document.querySelector("[data-due-count]").textContent, "1 of 3 dates used");
  // Existing validation refuses a past date, a fourth distinct date and dates closer than seven days.
  const refuse = (ids, value, pattern) => {
    const before = d.items.map((i) => i.due);
    document.querySelector('[data-due-all="0"]').click();
    ids.forEach((id) => change(document.querySelector('.desk [data-due-select="' + id + '"]'), true));
    input(document.getElementById("bulk-due"), value);
    document.getElementById("btn-bulkdue").click();
    assert.match(toasts.at(-1), pattern);
    assert.deepEqual(
      d.items.map((i) => i.due),
      before,
      "a refused date changes nothing",
    );
  };
  refuse(["u2-b"], day(-1), /future due date/);
  refuse(["u2-b"], day(25), /seven days apart/);
  d.items[1].due = B;
  d.items[3].due = C;
  // Item 1 shares its date with item 3, so moving it alone would add a fourth distinct date.
  refuse(["u2-a"], day(63), /more than three due dates/);
  document.querySelector('[data-due-all="1"]').click();
  assert.ok(
    rowBoxes().every((b) => b.checked),
    "Select all checks every row",
  );
  document.querySelector('[data-due-all="0"]').click();
  assert.ok(
    rowBoxes().every((b) => !b.checked),
    "Clear selection clears every row",
  );
  assert.deepEqual(d.dueWork.selected, []);
  // Row selection is confined to editable new-notice drafts.
  const quiet = (x) => {
    const root = document.createElement("div");
    root.innerHTML = noticeHTML(x);
    return root.querySelectorAll("[data-due-select],[data-special-item],.due-pick,.affected-pick").length;
  };
  assert.equal(quiet({ ...clone(d), draft: false, status: "Final" }), 0, "issued notice");
  assert.equal(quiet({ ...clone(d), correction: { case: clone(docCase(d)), body: docBody(d), blocks: clone(docBlocks(d)) } }), 0, "correction");
  assert.equal(quiet({ ...clone(d), type: "extension" }), 0, "regular extension");
  assert.equal(quiet({ ...clone(d), type: "bestInterestExtension", authoringVersion: 12 }), 0, "authoring-12 special extension");

  // Worksheet (open reinspection) bulk dates keep their item list and validation.
  const worksheet = {
    id: "u2-r",
    caseId: k.id,
    draft: true,
    sourceDocId: "u2-src",
    results: { s1: { oc: "none", due: "" }, s2: { oc: "progress", due: "" } },
  };
  WriterState.DOCS.push({
    id: "u2-src",
    caseId: k.id,
    type: "notice",
    draft: false,
    items: [
      { id: "s1", no: "1", title: "Gutters" },
      { id: "s2", no: "2", title: "Porch" },
    ],
  });
  const sheet = document.createElement("div");
  sheet.innerHTML = duePanel(worksheet, true);
  assert.equal(sheet.querySelectorAll(".deadline-item [data-due-select]").length, 2, "worksheet keeps its item list");
  assert.equal(sheet.querySelectorAll("[data-due-label]").length, 2);
  assert.equal(sheet.querySelector("[data-due-selected]").textContent, "0 of 2 items selected");
  assert.equal(sheet.querySelector("#btn-bulkdue").textContent, "Apply date to selected items");
  assert.equal(assignDue(worksheet, true, A, ["s1"]), "");
  assert.equal(worksheet.results.s1.due, A);
  assert.match(assignDue(worksheet, true, day(-2), ["s2"]), /future due date/);
  assert.match(assignDue(worksheet, true, day(24), ["s2"]), /seven days apart/);
  WriterState.DOCS = WriterState.DOCS.filter((x) => x.id !== "u2-src");

  // Cross-case Batch draft due dates stays distinct and validates every selected draft together.
  assert.throws(() => planBulkDue([{ docId: d.id, itemId: "u2-a" }], day(-1)), /future due date/);
  assert.throws(() => planBulkDue([{ docId: d.id, itemId: "u2-b" }], day(45)), /seven days apart/);
  const planned = planBulkDue([{ docId: d.id, itemId: "u2-b" }], A);
  assert.equal(planned.get(d.id).items[1].due, A);
  assert.equal(d.items[1].due, B, "planning does not change the draft");
  showBulkDue();
  const batch = document.getElementById("batch-due-form");
  assert.ok(batch, "Batch draft due dates form");
  assert.ok(batch.textContent.includes("New due date"));
  assert.ok(batch.querySelector('[data-batch-doc="' + d.id + '"][data-batch-item="u2-a"]'));
  WriterState.state.screen = "write";
  WriterState.state.docId = d.id;

  // ITEM 10. Authoring-13 Best Interest / Vacancy: Affected beside each due date; the details card has no separate list.
  for (const type of ["bestInterestExtension", "vacancyExtension"]) {
    d.type = type;
    d.authoringVersion = DATED_EXTENSIONS;
    d.items = [
      { id: "x-a", no: "1", title: "Porch", text: "Repair the porch.", sections: ["27.05(2)(c)"], due: day(10) },
      { id: "x-b", no: "2", title: "Gutter", text: "Repair the gutter.", sections: ["27.05(2)(c)"], due: day(10) },
      {
        id: "x-c",
        no: "3",
        title: "Siding",
        text: "Repair the siding.",
        sections: ["27.05(2)(c)"],
        due: day(10),
        done: true,
        doneOn: recordDay(today),
      },
    ];
    d.special = { originalDues: { 1: day(10), 2: day(10), 3: day(10) }, ...(type === "vacancyExtension" ? { deadlineMode: "dated" } : {}) };
    delete d.dueWork;
    render();
    const details = document.getElementById("r26-details");
    assert.equal(details.querySelector("fieldset.r26-items"), null, type + ": no distant affected-item list");
    assert.equal(details.querySelectorAll("[data-special-item],[data-special-due]").length, 0);
    assert.ok(details.textContent.includes("Select affected items and enter their new due dates in Violation items."));
    assert.equal(document.querySelector('[aria-label="Assign due dates"]'), null, type + ": no shared-date bar");
    assert.equal(document.querySelectorAll(".desk [data-due-select]").length, 0);
    const boxes = () => [...document.querySelectorAll(".desk [data-special-item]")];
    const due = (id) => document.querySelector('.desk [data-field="due"][data-id="' + id + '"]');
    assert.deepEqual(
      boxes().map((b) => b.dataset.specialItem),
      ["1", "2"],
      "one Affected checkbox per outstanding row",
    );
    assert.ok(boxes().every((b) => b.closest(".c-due") && b.closest(".no-print") && b.closest("label").textContent === "Affected"));
    assert.ok(due("x-a").disabled && due("x-b").disabled, "unaffected rows keep the read-only original date");
    // The affected check links to the first row's Affected checkbox.
    const affectedCheck = checks(d).find((c) => !c.ok && c.t === "Select at least one outstanding affected item.");
    focusCheckTarget(affectedCheck.targets[0], affectedCheck.t);
    assert.equal(document.activeElement, boxes()[0]);
    d.special.reviewed = true;
    change(boxes()[0], true);
    assert.deepEqual(d.special.affected, ["1"], "special.affected stays the source of truth");
    assert.equal(d.special.reviewed, false, "selection requires renewed review");
    assert.equal(boxes()[0].checked, true);
    assert.equal(document.activeElement, boxes()[0], "focus returns to the row's Affected checkbox");
    assert.equal(due("x-a").disabled, false, "the affected row's due date becomes editable");
    assert.equal(due("x-b").disabled, true);
    // The later-date check is still enforced and links to the affected row's due date.
    const later = () => newDocuments.specialChecks(d).find((c) => /later future due date/.test(c.t));
    assert.equal(later().ok, false);
    assert.deepEqual(
      later().targets.map((t) => t.selector),
      [itemSelector("x-a", "due")],
    );
    input(due("x-a"), day(5));
    assert.equal(later().ok, false, "an earlier date is refused");
    input(due("x-a"), day(30));
    assert.equal(d.items[0].due, day(30));
    assert.equal(d.special.extendedDues[1], day(30));
    assert.equal(later().ok, true);
    // Clearing the selection restores the original date and disables the field again.
    change(boxes()[0], false);
    assert.deepEqual(d.special.affected, []);
    assert.equal(d.items[0].due, day(10), "unselected item keeps its original date");
    assert.equal(due("x-a").disabled, true);
  }
  // A locked authoring-13 document has no row selection.
  const locked = { ...clone(d), draft: false, status: "Final" };
  locked.frozen = freezeSources(locked);
  const lockedRoot = document.createElement("div");
  lockedRoot.innerHTML = noticeHTML(locked);
  assert.equal(lockedRoot.querySelectorAll("[data-special-item],.affected-pick").length, 0);

  // Authoring 12 keeps its fieldset and separate extended-deadline fields exactly as before.
  for (const type of ["bestInterestExtension", "vacancyExtension"]) {
    d.type = type;
    d.authoringVersion = 12;
    d.special = { affected: ["1"], originalDues: { 1: day(10), 2: day(10) }, deadlineMode: "dated" };
    render();
    const details = document.getElementById("r26-details");
    assert.ok(details.querySelector("fieldset.r26-items legend").textContent === "Affected outstanding items", type + ": authoring-12 fieldset");
    assert.deepEqual(
      [...details.querySelectorAll("fieldset.r26-items [data-special-item]")].map((b) => [b.dataset.specialItem, b.checked]),
      [
        ["1", true],
        ["2", false],
      ],
    );
    assert.ok(details.querySelector('[data-special-due="1"]'), type + ": authoring-12 extended deadline field");
    assert.ok(!details.textContent.includes("Select affected items and enter their new due dates"));
    assert.equal(document.querySelectorAll(".desk [data-special-item],.desk .affected-pick").length, 0, "no row selection");
    const target = checks(d).find((c) => c.targets?.some((t) => t.selector.includes("data-special-item")));
    if (target)
      assert.ok(
        target.targets.every((t) => !t.selector.startsWith(".desk")),
        "authoring-12 checks link the fieldset",
      );
  }
  console.log(
    "PASS usability phase 2: one readiness summary with first-field link, single Review checklist, issuance dialog validates at " +
      "issuance, row selection for shared due dates with unchanged validation, worksheet and batch dates, authoring-13 Affected " +
      "beside due dates and authoring-12 unchanged",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
