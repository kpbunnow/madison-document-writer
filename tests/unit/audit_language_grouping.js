/* Order-language picker and Browse language layout (owner directions 2026-11-10 and 2026-11-11), from the screen module
   with the real bundled library: the consolidated catalog is shown as Violation Categories with title-case groups; the
   picker's group list holds only those categories, while a search still reaches the earlier checklists; the picker has no
   Keep adding or Save draft controls; results sit under headings; each entry leads with its ordinance; status badges
   appear only on Review catalog; an ordinance search folds its related sections. */
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
  assert.deepEqual(tree, ["Violation Categories"], "the group list shows only the Violation Categories");
  const categories = [...page.querySelectorAll(".picker-tree .tree-g[data-grp] > span:first-child")].map((e) => e.textContent);
  assert.equal(categories.length, LIBRARY[consolidated].groups.length);
  assert.ok(categories.includes("Interior Surfaces") && categories.includes("Doors and Security"), "category names are in title case");
  assert.ok(categories.every((name) => name.split(" ").every((w) => /^[A-Z]/.test(w) || ["and", "or", "of"].includes(w))));
  assert.match(page.querySelector(".picker-tree [data-language-all]").textContent, /^All violation categories/);
  assert.equal(page.querySelector("#keep-adding"), null, "no Keep adding checkbox: the picker stays open until Done adding");
  assert.equal(page.querySelector(".picker #btn-savework"), null, "no Save draft button in the picker");
  assert.ok(page.querySelector(".picker-footer [data-close='picker']"), "Done adding remains");
  const headings = [...page.querySelectorAll(".picker-list .language-group-h")];
  assert.equal(headings.length, LIBRARY[consolidated].groups.length, "browsing lists the categories only");
  assert.ok(headings.every((h) => /Violation Categories/.test(h.textContent) && !/earlier checklist/.test(h.textContent)));
  assert.match(page.querySelector(".pane-h").textContent, /All violation categories/);
  assert.equal(page.querySelectorAll(".picker-list .tag.ok, .picker-list .tag.warn").length, 0, "no status badges in the picker");
  assert.ok(page.querySelector(".language-pick-row .language-entry-head .cite-sec"), "each entry leads with its ordinance");

  R.state.q = "27.04(2)(g)";
  page = parse(api.languagePicker(R));
  assert.match(page.querySelector(".pane-h").textContent, /14 entries cite 27\.04\(2\)\(g\)/);
  const shown = [...page.querySelectorAll(".picker-list > .language-pick-group .language-pick-row")];
  assert.equal(shown.length, 14);
  assert.ok(shown.every((row) => /27\.04\(2\)\(g\)/.test(row.querySelector(".language-entry-head").textContent)));
  assert.match(page.querySelector(".picker-list > .language-pick-group .language-group-h").textContent, /Violation Categories/);
  const related = page.querySelector(".language-related details");
  assert.ok(related && !related.hasAttribute("open"), "related sections are folded");
  assert.match(related.querySelector("summary").textContent, /Show related sections \(\d+\)/);
  assert.match(page.querySelector(".language-also").textContent, /Violation Categories also has language/);

  // A search still reaches the earlier checklists, so language found only there (such as snow removal) can be added.
  R.state.q = "snow";
  page = parse(api.languagePicker(R));
  assert.ok(
    [...page.querySelectorAll(".picker-list .language-group-h")].some((h) => /Property Maintenance · earlier checklist/.test(h.textContent)),
    "a search finds earlier-checklist language",
  );

  R.state.picker = false;
  R.state.languageMode = "browse";
  R.state.libFilter = "27.04(2)(g)";
  page = parse(api.languageScreen(R));
  assert.match(page.querySelector(".language-count").textContent, /14 entries cite/);
  assert.equal(page.querySelectorAll(".tag.ok, .tag.warn").length, 0, "no status badges on Browse language");
  assert.equal(page.querySelector("#lib-checklist option:nth-child(2)").textContent, "Violation Categories");

  R.state.languageMode = "admin";
  R.state.catalogAdminStatus = "all";
  page = parse(api.languageScreen(R));
  assert.ok(page.querySelectorAll(".language-admin .tag").length > 0, "Review catalog keeps the status badges");
  console.log(
    "PASS order-language layout: Violation Categories only in the group list (title case), no Keep adding or Save draft, searches reach earlier checklists, ordinance tags, folded related sections, badges only on Review catalog",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
