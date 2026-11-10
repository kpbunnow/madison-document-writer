/* Order-language picker and Browse language layout (owner direction 2026-11-10), from the screen module with the real
   bundled library: results sit under checklist and group headings with Consolidated Order Language first and the earlier
   checklists labelled; each entry leads with its ordinance; status badges appear only on Review catalog; an ordinance
   search folds its related sections. */
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
  const draft = { id: "d1", type: "notice", items: [] };
  const R = {
    LIBRARY,
    state: { picker: true, docId: "d1", q: "", pickerStatus: "all", cl: -1, grp: 0, keepAdding: true, libCl: -1, libFilter: "", libStatus: "all" },
    doc: () => draft,
    allItems: () => all,
    catalogVisible: () => true,
    catalogKey: key,
    itemLibraryKey: (i) => i.libraryKey || "",
    effectiveCatalog: (i) => ({ a: i.a, s: i.s }),
    catalogStatus: (i) => ({ code: i.s.length ? "legacy" : "incomplete", label: "" }),
    catalogItem: () => null,
    catalogReviewPanel: () => "",
    esc: api.esc,
    markBlanks: api.markBlanks,
    shell: (title, sub, actions, body) => body,
    checkAttr: (v) => v,
    CATALOG_AT: "2026-11-10",
  };
  const parse = (markup) => new JSDOM("<!doctype html><body>" + markup + "</body>").window.document;
  const consolidated = LIBRARY.findIndex((c) => c.code === "ENF_ORDER_CATALOG");

  let page = parse(api.languagePicker(R));
  const tree = [...page.querySelectorAll(".picker-tree .tree-cl, .picker-tree .tree-earlier")].map((e) => e.textContent.trim());
  assert.equal(tree[0], LIBRARY[consolidated].name, "Consolidated Order Language heads the group list");
  assert.equal(tree[1], "Earlier checklists", "the earlier checklists follow under their own label");
  const headings = [...page.querySelectorAll(".picker-list .language-group-h")];
  assert.ok(headings.length > 20, "every group has a heading");
  assert.match(headings[0].textContent, new RegExp(LIBRARY[consolidated].name));
  assert.ok(
    headings.some((h) => /earlier checklist/.test(h.textContent)),
    "earlier-checklist groups are labelled",
  );
  assert.equal(page.querySelectorAll(".picker-list .tag.ok, .picker-list .tag.warn").length, 0, "no status badges in the picker");
  assert.ok(page.querySelector(".language-pick-row .language-entry-head .cite-sec"), "each entry leads with its ordinance");

  R.state.q = "27.04(2)(g)";
  page = parse(api.languagePicker(R));
  assert.match(page.querySelector(".pane-h").textContent, /14 entries cite 27\.04\(2\)\(g\)/);
  const shown = [...page.querySelectorAll(".picker-list > .language-pick-group .language-pick-row")];
  assert.equal(shown.length, 14);
  assert.ok(shown.every((row) => /27\.04\(2\)\(g\)/.test(row.querySelector(".language-entry-head").textContent)));
  assert.match(page.querySelector(".picker-list > .language-pick-group .language-group-h").textContent, new RegExp(LIBRARY[consolidated].name));
  const related = page.querySelector(".language-related details");
  assert.ok(related && !related.hasAttribute("open"), "related sections are folded");
  assert.match(related.querySelector("summary").textContent, /Show related sections \(\d+\)/);
  assert.ok(page.querySelector(".language-also"), "earlier entries note that Consolidated has language for the ordinance");

  R.state.picker = false;
  R.state.languageMode = "browse";
  R.state.libFilter = "27.04(2)(g)";
  page = parse(api.languageScreen(R));
  assert.match(page.querySelector(".language-count").textContent, /14 entries cite/);
  assert.equal(page.querySelectorAll(".tag.ok, .tag.warn").length, 0, "no status badges on Browse language");
  assert.equal(page.querySelector("#lib-checklist option:nth-child(2)").textContent, LIBRARY[consolidated].name);

  R.state.languageMode = "admin";
  R.state.catalogAdminStatus = "all";
  page = parse(api.languageScreen(R));
  assert.ok(page.querySelectorAll(".language-admin .tag").length > 0, "Review catalog keeps the status badges");
  console.log(
    "PASS order-language layout: grouped headings, Consolidated first, ordinance tags, folded related sections, badges only on Review catalog",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
