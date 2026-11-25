/* Weights and Measures (MGO Chapter 22) in the order-language picker and Browse language, from the screen module with
   the real bundled library: it is listed after Violation Categories with title-case groups and is not marked as an
   earlier checklist; ordinary terms and Chapter 22 sections find its entries; its draft entries are hidden by the
   default "usable" status and, when shown, cannot be selected until division review is recorded. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");

(async () => {
  const api = await compile(
    'export {languagePicker, languageScreen} from "./language_discovery.js"; export {LIBRARY} from "./data/library.js"; export {esc, markBlanks} from "./presentation_format.js";',
  );
  const { LIBRARY } = api;
  const all = [];
  LIBRARY.forEach((c, ci) => c.groups.forEach((g, gi) => g.items.forEach((it) => all.push({ ...it, ci, gi }))));
  const key = (i) => JSON.stringify([LIBRARY[i.ci].code, LIBRARY[i.ci].groups[i.gi].code, i.o]);
  // The catalog's own rule for bundled entries without a recorded review (language_catalog.js).
  const status = (i) => ({ code: !i.s.length ? "incomplete" : i.p === "draft" ? "review" : "legacy", label: "" });
  const visible = (i, filter) =>
    filter === "all" ||
    (filter === "usable" && status(i).code === "legacy") ||
    (filter === "review" && ["review", "incomplete"].includes(status(i).code));
  const draft = { id: "d1", type: "notice", items: [] };
  const R = {
    LIBRARY,
    state: { picker: true, docId: "d1", q: "", pickerStatus: "all", cl: -1, grp: 0, libCl: -1, libFilter: "", libStatus: "all" },
    doc: () => draft,
    allItems: () => all,
    catalogVisible: visible,
    catalogKey: key,
    itemLibraryKey: (i) => i.libraryKey || "",
    effectiveCatalog: (i) => ({ a: i.a, s: i.s }),
    catalogStatus: status,
    catalogItem: () => null,
    catalogReviewPanel: () => "",
    esc: api.esc,
    markBlanks: api.markBlanks,
    shell: (title, sub, actions, body) => body,
    checkAttr: (v) => v,
    CATALOG_AT: "2026-11-25",
  };
  const parse = (markup) => new JSDOM("<!doctype html><body>" + markup + "</body>").window.document;
  const weights = LIBRARY.findIndex((c) => c.code === "ENF_WEIGHTS_MEASURES");
  assert.ok(weights >= 0, "the Weights and Measures checklist is bundled");

  let page = parse(api.languagePicker(R));
  const tree = [...page.querySelectorAll(".picker-tree .tree-cl")].map((e) => e.textContent.trim());
  assert.deepEqual(tree, ["Violation Categories", "Weights and Measures"]);
  const groups = [...page.querySelectorAll('.picker-tree .tree-g[data-grp^="' + weights + ':"] > span:first-child')].map((e) => e.textContent);
  assert.deepEqual(groups, [
    "Licensing",
    "Device Accuracy and Use",
    "Security Seals and Repairs",
    "Method of Sale and Quantity",
    "Pricing",
    "Motor Fuel Dispensers",
    "Temporary Vendors",
    "Orders, Access and License Actions",
  ]);

  for (const [q, title] of [
    ["scale", "Incorrect weighing or measuring device"],
    ["skimmer", "Pump locks not unique"],
    ["farmers market", "Temporary vendor not approved"],
    ["22.06(2)", "Security seal missing"],
  ]) {
    R.state.q = q;
    page = parse(api.languagePicker(R));
    const rows = [...page.querySelectorAll(".picker-list .language-pick-row")];
    const row = rows.find((r) => r.querySelector("h4").textContent.includes(title));
    assert.ok(row, q + " finds " + title);
    const heading = row.closest(".language-pick-group").querySelector(".language-group-h").textContent;
    assert.match(heading, /Weights and Measures/);
    assert.doesNotMatch(heading, /earlier checklist/);
    assert.ok(row.querySelector("button.gitem").disabled, "a draft entry cannot be selected");
    assert.match(row.textContent, /Not available for a new selection until division review is recorded/);
  }

  R.state.q = "";
  R.state.pickerStatus = "usable";
  page = parse(api.languagePicker(R));
  assert.equal(page.querySelectorAll('.picker-tree .tree-g[data-grp^="' + weights + ':"]').length, 0, "drafts are hidden by the usable status");
  R.state.pickerStatus = "review";
  page = parse(api.languagePicker(R));
  assert.equal(page.querySelectorAll('.picker-tree .tree-g[data-grp^="' + weights + ':"]').length, 8, "drafts are listed for review");

  R.state.picker = false;
  R.state.languageMode = "browse";
  page = parse(api.languageScreen(R));
  assert.equal(page.querySelector("#lib-checklist option:nth-child(3)").textContent, "Weights and Measures");
  console.log(
    "PASS Weights and Measures: listed after Violation Categories in title case, found by terms and Chapter 22 sections, drafts unselectable until division review",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
