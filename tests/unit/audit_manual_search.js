/* Manual search remains local, readable and keyboard navigable, including synonym hits and nested transcripts. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { JSDOM } = require("jsdom");
const source = fs.readFileSync("docs/staff/manual-search.js", "utf8");
const dom = new JSDOM(
  `<!doctype html><html lang="en"><body>
<nav aria-label="Manual navigation"><a href="#manual-search-input" data-manual-search-link hidden>Search manual</a></nav>
<section data-manual-search hidden><label for="manual-search-input">Search words</label><input id="manual-search-input">
<button id="manual-search-clear" type="button" hidden>Clear search</button><p id="manual-search-status" role="status"></p><ol id="manual-search-results"></ol></section>
<div id="instructions"><h2 id="chapter-1">Citation tasks</h2><p id="charge">Prepare a citation for the documented violation.</p>
<p id="accent">Café safety inspection.</p><details id="outer"><summary>More help</summary><details id="inner"><summary>Transcript</summary><p id="hidden-passage">Unique recovery instructions.</p></details></details>
${Array.from({ length: 45 }, (_, i) => `<p>Searchable example passage ${i}.</p>`).join("")}</div></body></html>`,
  { runScripts: "outside-only", url: "https://example.invalid/PROGRAM-MANUAL.html" },
);
const { window } = dom,
  doc = window.document,
  input = doc.getElementById("manual-search-input"),
  clear = doc.getElementById("manual-search-clear"),
  results = doc.getElementById("manual-search-results");
window.setTimeout = (fn) => {
  fn();
  return 1;
};
window.clearTimeout = () => {};
window.eval(source);
function search(text) {
  input.value = text;
  input.dispatchEvent(new window.Event("input"));
}
try {
  assert.equal(doc.querySelector("[data-manual-search]").hidden, false);
  search("ticket");
  assert.ok(
    [...results.querySelectorAll("mark")].some((m) => /citation/i.test(m.textContent)),
    "a synonym match highlights the actual matching word",
  );
  assert.equal(doc.querySelector("[data-manual-search-link]").hidden, false);
  assert.equal(clear.hidden, false);
  search("cafe");
  assert.equal(results.querySelector("mark").textContent, "Café", "accent folding retains the original highlighted text");
  search("unique recovery");
  results.querySelector('a[href="#hidden-passage"]').click();
  assert.ok(doc.getElementById("outer").open && doc.getElementById("inner").open, "all transcript ancestors open");
  assert.equal(doc.activeElement.id, "hidden-passage");
  search("searchable example");
  assert.equal(results.children.length, 40);
  assert.match(doc.getElementById("manual-search-status").textContent, /40 of 45/, "the result limit does not obscure the total");
  search("<img src=x onerror=alert(1)>");
  assert.equal(results.querySelector("img,script"), null);
  clear.click();
  assert.equal(input.value, "");
  assert.equal(results.children.length, 0);
  assert.equal(clear.hidden, true);
  assert.equal(doc.activeElement, input);
  console.log("PASS manual search: synonyms, accents, exact result counts, safe text, nested transcripts and clear/focus recovery");
} finally {
  window.close();
}
