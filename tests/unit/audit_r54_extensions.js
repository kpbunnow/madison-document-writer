/* R54 shared extension layout: start red against the unchanged R53 renderer. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const runtime = process.env.DW_PRODUCTION_DIR || path.join(path.resolve(__dirname, "../.."), "build/dist");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage("app", runtime),
  payload = bundleSource(html);
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
const test = async () => {
  await new Promise((resolve) => setTimeout(resolve, 25));
  const original = makeR54Fixture();
  const reference = JSON.parse(
    fs.readFileSync(path.join(path.resolve(__dirname, "../.."), "tests/fixtures/reference/R53-extension-rendering.json"), "utf8"),
  );
  for (const [key, expected] of Object.entries(reference.records)) {
    const [type, version, corrected] = key.split("/"),
      d = { ...clone(original), type, authoringVersion: Number(version) };
    d.frozen = freezeSources(d);
    if (corrected) {
      d.correction = { case: clone(docCase(d)), body: docBody(d), blocks: clone(docBlocks(d)), actionDate: "2026-10-20" };
      d.revision = { number: 1, targetId: "r53-original", originalIssued: "2026-10-20", reason: "Synthetic historical correction" };
    }
    const authored = noticeHTML(d).replace(/\b(min|max)="\d{4}-\d{2}-\d{2}"/g, '$1="TODAY-RELATIVE"');
    assert.equal(require("crypto").createHash("sha256").update(authored).digest("hex"), expected, "R53 byte parity: " + key);
  }
  const failures = [];
  const layouts = [];
  for (const type of ["extension", "bestInterestExtension", "vacancyExtension"]) {
    const d = { ...clone(original), type, authoringVersion: 12 },
      root = document.createElement("div");
    root.innerHTML = noticeHTML(d);
    const table = root.querySelector("table.notice:not(.r26-narrative)");
    if (!table) failures.push(type + ": missing regular Extension items table");
    if (root.querySelector(".n-title br")) failures.push(type + ": title still uses two lines");
    if (!root.querySelector('[data-row="r54-corrected"].done')) failures.push(type + ": corrected item is not ruled through");
    if (table && !table.textContent.includes(original.items[0].note)) failures.push(type + ": inspector note omitted");
    if (type !== "extension") {
      const legacyBody = document.createElement("div");
      legacyBody.innerHTML = newDocuments.specialBody({ ...clone(d), authoringVersion: 11 });
      const paragraphs = [...legacyBody.querySelectorAll("p")].map((p) => p.textContent);
      const language = paragraphs.filter(
        (text) => !/^(Affected item references:|Item \d+ —|For questions)/.test(text) && !text.startsWith(original.special.signerName),
      );
      assert.deepEqual(
        [...root.querySelectorAll(".n-body p")].map((p) => p.textContent),
        language,
        type + ": language moved word for word",
      );
      assert.equal(root.querySelector(".extension-signer").textContent, paragraphs.at(-1), "division decision: retain signer after table");
      assert.ok(root.querySelector("table.notice + .extension-signer"), "signer follows the shared items table");
      assert.ok(!root.textContent.includes("Previous deadline:"));
      assert.ok(!root.textContent.includes("Affected item references:"));
    }
    root.querySelector(".n-title").outerHTML = '<div class="n-title">TITLE</div>';
    root.querySelector(".n-body").innerHTML = "LANGUAGE";
    root.querySelector(".extension-signer")?.remove();
    layouts.push(root.innerHTML);
    if (type !== "extension") {
      const legacy = { ...clone(d), authoringVersion: 11 };
      root.innerHTML = noticeHTML(legacy);
      assert.ok(root.querySelector(".r26-narrative"), type + ": retain authoring-11 narrative rendering");
    }
  }
  assert.deepEqual(failures, [], "authoring-12 extensions share the regular Extension layout");
  assert.ok(
    layouts.every((html) => html === layouts[0]),
    "only title, language and the approved special signer exception differ",
  );
  const conditional = { ...clone(original), type: "vacancyExtension", authoringVersion: 12 };
  conditional.special.deadlineMode = "conditional";
  conditional.items[0].due = conditional.special.originalDues[1];
  const before = JSON.stringify(conditional),
    root = document.createElement("div");
  root.innerHTML = noticeHTML(conditional);
  assert.equal(root.querySelector('[data-row="r54-open"] .c-due').textContent.trim(), "Conditional — see conditions above");
  assert.equal(JSON.stringify(conditional), before, "conditional display does not change stored repair dates");
  WriterState.DOCS = [clone(original)];
  WriterState.REINSP = [
    {
      id: "r54-visit",
      caseId: original.caseId,
      sourceDocId: original.id,
      draft: true,
      date: "2026-10-20",
      time: "10:00",
      inspectorId: INSPECTORS[0].id,
      results: Object.fromEntries(
        original.items.map((item, n) => [
          item.id,
          { oc: n ? "corrected" : "progress", on: n ? item.doneOn : "2026-10-20", carried: !!n, note: "R54 visit note", due: "2026-11-20" },
        ]),
      ),
    },
  ];
  newDocuments.createSpecial(WriterState.REINSP[0], "bestInterestExtension");
  const created = doc(WriterState.state.docId);
  // R62: new Best Interest and Vacancy Extensions use the all-item format, authoring 16.
  assert.equal(created.authoringVersion, 16, "new Best Interest Extensions use authoring 16");
  assert.equal(created.items[0].note, "R54 visit note", "shared table uses the current inspection note");
  assert.equal(makePublication(created).payload.snapshot.authoringVersion, 16, "publication retains the selected rendering version");
  // Continue the retained authoring-13 review invalidation contract below.
  created.authoringVersion = 13;
  created.special.affected = ["1"];
  created.special.extendedDues = { 1: "2026-11-20" };
  created.special.reviewed = true;
  created.selectionCache = { [created.type]: clone(created.special) };
  const dueInput = document.createElement("input");
  dueInput.type = "date";
  dueInput.dataset.field = "due";
  dueInput.dataset.id = created.items[0].id;
  dueInput.value = "2026-11-27";
  document.body.appendChild(dueInput);
  const detailDue = document.createElement("input");
  detailDue.type = "date";
  detailDue.dataset.specialDue = "1";
  detailDue.value = "2026-11-20";
  document.body.appendChild(detailDue);
  dueInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal(created.special.extendedDues[1], "2026-11-27", "shared-table edits retain the reviewed extension deadline source");
  assert.equal(created.special.reviewed, false, "shared-table deadline edits require renewed supervisory review");
  assert.equal(created.selectionCache[created.type].extendedDues[1], "2026-11-27", "type cache retains the edited deadline");
  assert.equal(detailDue.value, "2026-11-27", "the existing special deadline control stays synchronized");
  dueInput.remove();
  detailDue.remove();
  for (const type of ["bestInterestExtension", "vacancyExtension"]) {
    created.type = type;
    for (const field of ["text", "sections", "group", "note"]) {
      created.special.reviewed = true;
      created.selectionCache = { bestInterestExtension: clone(created.special), vacancyExtension: clone(created.special) };
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.special = "reviewed";
      checkbox.checked = true;
      const input = document.createElement("textarea");
      input.dataset.field = field;
      input.dataset.id = created.items[0].id;
      input.value = "Synthetic revised " + field;
      document.body.append(checkbox, input);
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
      assert.equal(created.special.reviewed, false, type + ": " + field + " requires renewed review");
      assert.ok(
        blockers(created).some((x) => /Division review/.test(x.t)),
        "publication requires renewed division approval",
      );
      assert.equal(checkbox.checked, false, "approval checkbox synchronized");
      assert.ok(
        Object.values(created.selectionCache).every((details) => details.reviewed === false),
        "all type-switch approvals invalidated",
      );
      assert.equal(WriterState.REINSP[0].actionDetails[type].reviewed, false, "visit cache invalidated");
      assert.deepEqual(created.items[0][field], field === "sections" ? [input.value] : input.value);
      checkbox.remove();
      input.remove();
    }
  }
  for (const initialType of ["bestInterestExtension", "vacancyExtension", "notice"]) {
    WriterState.DOCS = [clone(original)];
    WriterState.REINSP = [];
    newDocuments.caseAction(original.caseId, initialType);
    const administrative = doc(WriterState.state.docId);
    assert.equal(administrative.administrativeAction, true);
    const allItems = initialType !== "notice";
    assert.equal(administrative.authoringVersion, allItems ? 16 : 13, "administrative creation selects the family rendering version");
    for (const type of ["bestInterestExtension", "vacancyExtension"]) {
      const select = document.createElement("select");
      select.dataset.special = "administrativeType";
      select.innerHTML = '<option value="' + type + '">' + type + "</option>";
      document.body.append(select);
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
      const root = document.createElement("div");
      root.innerHTML = noticeHTML(administrative);
      assert.equal(administrative.type, type);
      assert.ok(root.querySelector("table.notice:not(.r26-narrative)"), "administrative type switch uses shared table");
      // Every administrative draft in this loop was created by R62, including the unchanged scoped-order model.
      // Older drafts' defaults remain covered by audit_r61_review_fixes and the explicit authoring-13 cases below.
      assert.equal(makePublication(administrative).payload.snapshot.authoringVersion, 16);
      if (type === "vacancyExtension")
        assert.equal(administrative.special.deadlineMode, undefined, "new authoring-16 Vacancy has no repair-deadline model");
      select.remove();
    }
  }
  // Authoring 13: Vacancy is always dated, even from cached conditional details; dates are entered in the items table.
  WriterState.DOCS = [clone(original)];
  WriterState.REINSP = [
    {
      id: "r56-visit",
      caseId: original.caseId,
      sourceDocId: original.id,
      draft: true,
      date: "2026-10-20",
      time: "10:00",
      inspectorId: INSPECTORS[0].id,
      results: Object.fromEntries(
        original.items.map((item, n) => [
          item.id,
          { oc: n ? "corrected" : "progress", on: n ? item.doneOn : "2026-10-20", carried: !!n, note: "R56 visit note", due: "2026-11-20" },
        ]),
      ),
      actionDetails: { vacancyExtension: { deadlineMode: "conditional" } },
    },
  ];
  newDocuments.createSpecial(WriterState.REINSP[0], "vacancyExtension");
  const vacancy = doc(WriterState.state.docId);
  assert.equal(vacancy.authoringVersion, 16);
  assert.equal(vacancy.special.deadlineMode, undefined, "a cached conditional model does not carry into a new Vacancy Extension");
  // The checks below cover the authoring-13 dated model (R62 covers authoring 16): an authoring-13 draft is dated and
  // began with every item on its source deadline.
  vacancy.authoringVersion = 13;
  vacancy.special.deadlineMode = "dated";
  vacancy.items.forEach((i) => (i.due = vacancy.special.originalDues[i.no] ?? i.due));
  const panel = document.createElement("div");
  panel.innerHTML = newDocuments.details(vacancy);
  assert.equal(panel.querySelector('[data-special="deadlineMode"]'), null, "no deadline-model choice");
  assert.equal(panel.querySelector("[data-special-due]"), null, "no separate per-item deadline fields");
  assert.match(panel.textContent, /Select affected items and enter their new due dates in Violation items/);
  assert.equal(panel.querySelector("fieldset.r26-items"), null, "authoring 13 selects affected items in the items table, not a separate list");
  assert.equal(panel.querySelector("[data-special-item]"), null, "no separate affected-item checkboxes in the details card");
  vacancy.special.affected = [String(vacancy.items[0].no)];
  vacancy.mailed = "2026-10-21";
  const sheet = document.createElement("div");
  sheet.innerHTML = noticeHTML(vacancy);
  const affectedBoxes = [...sheet.querySelectorAll("[data-special-item]")];
  assert.deepEqual(
    affectedBoxes.map((x) => [x.dataset.specialItem, x.checked]),
    vacancy.items.filter((i) => !i.done && !i.withdrawn).map((i) => [String(i.no), vacancy.special.affected.includes(String(i.no))]),
    "each outstanding row carries its Affected selection beside the due date",
  );
  assert.ok(
    affectedBoxes.every((x) => x.closest(".c-due") && x.closest(".no-print")),
    "row Affected selection sits in the due-date cell and never prints",
  );
  assert.equal(sheet.querySelector(".conditional-due"), null, "authoring 13 shows due dates, never the conditional label");
  const dueInputs = [...sheet.querySelectorAll('input[data-field="due"]')];
  assert.equal(dueInputs.find((x) => x.dataset.id === vacancy.items[0].id).disabled, false, "the affected item's due date is editable");
  assert.ok(
    dueInputs.filter((x) => x.dataset.id !== vacancy.items[0].id).every((x) => x.disabled),
    "unaffected items keep their original dates",
  );
  vacancy.items[0].due = vacancy.special.originalDues[vacancy.items[0].no];
  assert.ok(
    blockers(vacancy).some((x) => /new due date in Violation items|later future due date/.test(x.t)),
    "a new due date is required",
  );
  for (const authoringVersion of [11, 12, 13]) {
    const issued = { ...clone(original), id: "r54-correction-source", type: "bestInterestExtension", authoringVersion, eventId: "r54-source-event" };
    issued.frozen = freezeSources(issued);
    WriterState.DOCS = [issued];
    WriterState.REINSP = [];
    const correction = startCorrection(issued.id);
    assert.ok(correction, "historical correction can be opened");
    correction.correction.reason = "Synthetic R54 correction verification";
    correction.correction.externalReference = "Synthetic approved record reference";
    const snap = makeCorrectionAttempt(correction).payload.snapshot;
    assert.equal(snap.authoringVersion, authoringVersion, "correction retains its source rendering version");
    assert.equal(noticeHTML(snap).includes("r26-narrative"), authoringVersion === 11, "correction keeps the source layout family");
  }
  console.log("PASS R54 extension table, notes, corrected items, title and legacy layout");
  process.exit(0);
};
eval(
  payload +
    "\nconst makeR54Fixture = " +
    require("../fixtures/r54_extensions.js").toString() +
    ";\n(" +
    test.toString() +
    ")().catch(error=>{console.error(error);process.exit(1);})",
);
