/* Order-language picker and browser layout (owner direction 2026-11-10), in the real Writer bundle: results sit under
   checklist and group headings with Consolidated Order Language first and the earlier checklists labelled; each entry
   leads with its ordinance; status badges appear only on the catalog review screen; an ordinance search folds its
   related sections. */
require("../fixtures/bundle_test.cjs")(`
const assert = require("node:assert/strict");
const stamp = recordDay(today);
WriterState.CASES.push({ id: "qa-ol", number: "QA-OL-001", address: "1 LANGUAGE ST", parcel: "070822219199", owner: "SYNTHETIC OWNER",
  ownerAddr: ["1 LANGUAGE ST", "MADISON WI 53703"], inspectorId: "i4", date: addDays(stamp, -1), time: "09:00", emails: [] });
newDoc("qa-ol", "notice");
WriterState.state.picker = true;
WriterState.state.pickerStatus = "all";
const pick = (q) => {
  WriterState.state.q = q;
  render();
  return document.querySelector(".picker-box");
};
const consolidated = LIBRARY.findIndex((c) => c.code === "ENF_ORDER_CATALOG");

let box = pick("");
const tree = [...box.querySelectorAll(".picker-tree .tree-cl, .picker-tree .tree-earlier")].map((e) => e.textContent.trim());
assert.equal(tree[0], LIBRARY[consolidated].name, "Consolidated Order Language heads the group list");
assert.equal(tree[1], "Earlier checklists", "the earlier checklists follow under their own label");
assert.equal(tree.length, LIBRARY.length + 1);
const headings = [...box.querySelectorAll(".picker-list .language-group-h")];
assert.ok(headings.length > 20, "every group has a heading");
assert.match(headings[0].textContent, new RegExp(LIBRARY[consolidated].name));
assert.ok(headings.some((h) => /earlier checklist/.test(h.textContent)), "earlier-checklist groups are labelled");
assert.equal(box.querySelectorAll(".picker-list .tag.ok, .picker-list .tag.warn").length, 0, "no status badges in the picker");
assert.ok(!/FORMAL APPROVAL NOT RECORDED|formal approval not recorded/i.test(box.innerHTML), "the standard-language badge is gone");
const first = box.querySelector(".language-pick-row");
assert.ok(first.querySelector(".language-entry-head .cite-sec"), "each entry leads with its ordinance");

box = pick("27.04(2)(g)");
assert.match(box.querySelector(".pane-h").textContent, /14 entries cite 27\\.04\\(2\\)\\(g\\)/);
const shown = [...box.querySelectorAll(".picker-list > .language-pick-group .language-pick-row")];
assert.equal(shown.length, 14);
assert.ok(shown.every((row) => /27\\.04\\(2\\)\\(g\\)/.test(row.querySelector(".language-entry-head").textContent)));
const firstGroup = box.querySelector(".picker-list > .language-pick-group .language-group-h").textContent;
assert.match(firstGroup, new RegExp(LIBRARY[consolidated].name), "Consolidated results come first");
const related = box.querySelector(".language-related details");
assert.ok(related && !related.open, "related sections are folded");
assert.match(related.querySelector("summary").textContent, /Show related sections \\(\\d+\\)/);
assert.ok(related.querySelectorAll(".language-pick-row").length > 0);
assert.ok(box.querySelector(".language-also"), "earlier entries note that Consolidated has language for the ordinance");

WriterState.state.picker = false;
WriterState.state.screen = "library";
WriterState.state.languageMode = "browse";
WriterState.state.libStatus = "all";
WriterState.state.libFilter = "27.04(2)(g)";
render();
const browse = document.querySelector(".language-browser");
assert.match(browse.querySelector(".language-count").textContent, /14 entries cite/);
assert.equal(browse.querySelectorAll(".tag.ok, .tag.warn").length, 0, "no status badges on Browse language");
assert.equal(browse.querySelector("#lib-checklist option:nth-child(2)").textContent, LIBRARY[consolidated].name);

WriterState.state.languageMode = "admin";
WriterState.state.catalogAdminStatus = "all";
render();
assert.ok(document.querySelectorAll(".language-admin .tag").length > 0, "the catalog review screen keeps the status badges");
console.log("PASS order-language layout: grouped headings, Consolidated first, ordinance tags, folded related sections, badges only on catalog review");
`);
