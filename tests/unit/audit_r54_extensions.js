/* R54 shared extension layout: start red against the unchanged R53 renderer. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(path.resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8"),
  payload = Buffer.from(/var B="([A-Za-z0-9+/=]+)"/.exec(html)[1], "base64").toString();
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
  assert.equal(created.authoringVersion, 12, "new special extensions use authoring 12");
  assert.equal(created.items[0].note, "R54 visit note", "shared table uses the current inspection note");
  assert.equal(makePublication(created).payload.snapshot.authoringVersion, 12, "publication retains the selected rendering version");
  for (const authoringVersion of [11, 12]) {
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
