/* Picker shortcuts and new-item defaults (owner direction 2026-11-13): Recently used and Favorites are browser-profile
   lists that survive a missing or broken store; they head the picker's group list only when they hold something; a new
   item follows the previous item's location heading (never its due date) while a restored item keeps its own. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");

(async () => {
  const store = new Map();
  global.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  store.set("madison-language-shortcuts-v1", '{"recent":["old",7,null],"favorites":"broken"}');
  const dom = new JSDOM("<!doctype html><body></body>");
  global.document = dom.window.document;
  const api = await compile(
    'export * from "./language_shortcuts.js"; export {createItemSelection} from "./item_selection.js"; export {languagePicker} from "./language_discovery.js"; export {LIBRARY} from "./data/library.js"; export {esc, markBlanks} from "./presentation_format.js";',
  );
  // Stored lists are filtered to strings; a malformed list starts empty.
  assert.deepEqual(api.shortcutKeys("recent"), ["old"]);
  assert.deepEqual(api.shortcutKeys("favorites"), []);
  assert.deepEqual(api.shortcutKeys("other"), []);
  for (let n = 0; n < 15; n++) api.noteLanguageUsed("k" + n);
  api.noteLanguageUsed("k3");
  assert.equal(api.shortcutKeys("recent").length, 12, "the recent list is capped");
  assert.deepEqual(api.shortcutKeys("recent").slice(0, 2), ["k3", "k14"], "newest first, without repeats");
  assert.equal(api.toggleFavorite("a"), true);
  assert.equal(api.isFavorite("a"), true);
  assert.equal(api.toggleFavorite("a"), false);
  assert.deepEqual(JSON.parse(store.get("madison-language-shortcuts-v1")).favorites, []);
  global.localStorage.setItem = () => {
    throw new Error("quota");
  };
  api.noteLanguageUsed("after-failure");
  assert.equal(api.shortcutKeys("recent")[0], "after-failure", "a failed save keeps the list for this session");
  // The active list applies only while browsing.
  assert.equal(api.activeShortcutList({ q: "", cl: -1, pickerList: "recent" }), "recent");
  assert.equal(api.activeShortcutList({ q: "door", cl: -1, pickerList: "recent" }), "");
  assert.equal(api.activeShortcutList({ q: "", cl: 2, pickerList: "recent" }), "");
  assert.equal(api.activeShortcutList({ q: "", cl: -1, pickerList: "favorites" }), "", "an empty list is never shown");

  // New items follow the previous item; a restored item keeps its own heading and date.
  const { LIBRARY } = api;
  const ci = LIBRARY.findIndex((c) => c.code === "ENF_ORDER_CATALOG"),
    group = LIBRARY[ci].groups[0];
  let id = 0;
  const selection = api.createItemSelection({ uid: () => "x" + ++id, snow: { canAdd: () => true, added() {}, removed() {} } });
  const d = { items: [] };
  assert.equal(selection.toggleLibraryItem(d, ci, 0, group.items[0]), true);
  assert.deepEqual([d.items[0].group, d.items[0].due], ["", ""], "the first item starts blank");
  Object.assign(d.items[0], { group: "KITCHEN", due: "2026-12-15" });
  selection.toggleLibraryItem(d, ci, 0, group.items[1]);
  assert.deepEqual([d.items[1].group, d.items[1].due], ["KITCHEN", ""], "the heading follows; a deadline is never inherited");
  selection.toggleLibraryItem(d, ci, 0, group.items[1], true);
  assert.deepEqual([d.items[2].group, d.items[2].due], ["KITCHEN", ""], "Add again follows the previous item's heading too");
  Object.assign(d.items[0], { group: "BATH", due: "2027-01-05" });
  selection.toggleLibraryItem(d, ci, 0, group.items[0]);
  selection.toggleLibraryItem(d, ci, 0, group.items[0]);
  assert.deepEqual([d.items.at(-1).group, d.items.at(-1).due], ["BATH", "2027-01-05"], "a restored item keeps its own edits");
  const key = JSON.stringify([LIBRARY[ci].code, group.code, group.items[0].o]);
  assert.equal(api.shortcutKeys("recent")[0], key, "adding an entry records it as recently used");

  // The picker lists the shortcuts above the categories, shows only that list when chosen, and offers a star per entry.
  const all = [];
  LIBRARY.forEach((c, x) => c.groups.forEach((g, gi) => g.items.forEach((it) => all.push({ ...it, ci: x, gi }))));
  const catalogKey = (i) => JSON.stringify([LIBRARY[i.ci].code, LIBRARY[i.ci].groups[i.gi].code, i.o]);
  api.toggleFavorite(catalogKey(all.find((i) => i.ci === ci && i.gi === 1)));
  const R = {
    LIBRARY,
    state: { picker: true, docId: "d1", q: "", pickerStatus: "all", cl: -1, grp: 0, pickerList: "" },
    doc: () => ({ id: "d1", type: "notice", items: [] }),
    allItems: () => all,
    catalogVisible: () => true,
    catalogKey,
    itemLibraryKey: (i) => i.libraryKey || "",
    effectiveCatalog: (i) => ({ a: i.a, s: i.s }),
    catalogStatus: () => ({ code: "legacy", label: "" }),
    catalogItem: () => null,
    esc: api.esc,
    markBlanks: api.markBlanks,
    checkAttr: (v) => v,
  };
  const parse = (markup) => new JSDOM("<!doctype html><body>" + markup + "</body>").window.document;
  let page = parse(api.languagePicker(R));
  assert.deepEqual(
    [...page.querySelectorAll(".picker-tree [data-language-list]")].map((b) => [b.dataset.languageList, b.getAttribute("aria-current")]),
    [
      ["favorites", "false"],
      ["recent", "false"],
    ],
  );
  assert.ok(page.querySelectorAll(".picker-list .language-favorite").length > 50, "every entry offers a star");
  assert.equal(page.querySelectorAll('.language-favorite[aria-pressed="true"]').length, 1);
  for (const star of page.querySelectorAll(".language-favorite")) assert.ok(star.getAttribute("aria-label").startsWith("Favorite"));
  R.state.pickerList = "favorites";
  page = parse(api.languagePicker(R));
  assert.equal(page.querySelectorAll(".picker-list .language-pick-row").length, 1);
  assert.match(page.querySelector(".pane-h").textContent, /^Favorites · 1 matching/);
  assert.equal(page.querySelector('[data-language-list="favorites"]').getAttribute("aria-current"), "true");
  R.state.q = "door";
  page = parse(api.languagePicker(R));
  assert.ok(page.querySelectorAll(".picker-list .language-pick-row").length > 1, "a search leaves the list");
  console.log("PASS picker shortcuts (recent, favorites, storage failures) and new items follow the previous item's heading only");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
