/* Search decoration preserves text, controls, handlers and search semantics; no HTML comes from the query. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");

(async () => {
  const { enhanceSearchResults } = await compile('export {enhanceSearchResults} from "./search_highlighting.js";');
  const scenarios = [
    ["case-search", '<table class="case-table"><tbody><tr><td>Test owner</td></tr></tbody></table>'],
    ["folder-search", '<div class="folderlist"><button>Test owner</button></div>'],
    ["open-cases-search", '<div id="open-cases-results"><button class="open-case-main">Test owner</button></div>'],
    ["pk-q", '<div class="picker-list"><h4 class="language-entry-head">Test owner</h4></div>'],
    ["lib-filter", '<div class="language-browser"><div class="language-group">Test owner</div></div>'],
    ["catalog-filter", '<div class="language-admin-list"><button>Test owner</button></div>'],
    ["deposit-schedule-search", '<table class="rep"><tbody><tr><td>Test owner</td></tr></tbody></table>'],
    ["pv-q", '<div class="card-case">Test owner</div>'],
    ["ow-q", '<table class="rep"><tbody><tr><td>Test owner</td></tr></tbody></table>'],
  ];
  for (const [id, result] of scenarios) {
    const dom = new JSDOM('<input id="' + id + '"><main>' + result + "</main>");
    const { document } = dom.window,
      input = document.getElementById(id);
    input.value = "TEST";
    input.focus();
    input.setSelectionRange(1, 3);
    const text = document.querySelector("main").textContent;
    const observer = new dom.window.MutationObserver(() => {});
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    enhanceSearchResults(document.body);
    assert.equal(document.querySelector("mark").textContent, "Test", id);
    assert.equal(document.querySelector("main").textContent, text);
    const count = document.querySelectorAll("mark").length;
    observer.takeRecords();
    enhanceSearchResults(document);
    assert.equal(observer.takeRecords().length, 0, "unchanged enhancement cannot retrigger the accessibility observer: " + id);
    assert.equal(document.querySelectorAll("mark").length, count, "repeated enhancement is stable: " + id);
    assert.equal(document.querySelectorAll("mark mark").length, 0);
    assert.equal(document.activeElement, input);
    assert.deepEqual([input.value, input.selectionStart, input.selectionEnd], ["TEST", 1, 3]);
    input.value = "";
    enhanceSearchResults(document);
    assert.equal(document.querySelectorAll("mark").length, 0);
    assert.equal(document.querySelector("main").textContent, text);
    observer.disconnect();
  }
  const dom = new JSDOM(
    '<input id="lib-filter"><div class="language-browser"><div class="language-group"><h3>Trash</h3><p>Garbage at café — 27.04(2)(g)3. Literal .* &amp; &lt;img&gt;. Antitrash.</p><input value="Garbage"><textarea>Garbage</textarea><div contenteditable="true">Garbage</div></div></div>',
  );
  const { document } = dom.window,
    input = document.getElementById("lib-filter");
  input.value = "garbage";
  enhanceSearchResults(document);
  assert.deepEqual(
    [...document.querySelectorAll("mark")].map((e) => e.textContent),
    ["Trash", "Garbage"],
    "order-language aliases match the search owner",
  );
  assert.equal(document.querySelectorAll("input mark,textarea mark,[contenteditable] mark").length, 0);
  input.value = "27.04 (2) (g)";
  enhanceSearchResults(document);
  assert.equal(document.querySelector("mark").textContent, "27.04(2)(g)");
  input.value = "café";
  enhanceSearchResults(document);
  assert.equal(document.querySelector("mark").textContent, "café", "accent folding keeps original spelling");
  input.id = "case-search";
  document.querySelector(".language-group").className = "case-table";
  // Use a real table for the Workspace selector, with a button whose listener must survive decoration.
  const table = document.createElement("table");
  table.className = "case-table";
  table.innerHTML = "<tbody><tr><td><button>Literal .* &amp; &lt;img&gt;</button></td></tr></tbody>";
  document.body.append(table);
  const button = table.querySelector("button");
  let clicked = 0;
  button.addEventListener("click", () => clicked++);
  input.value = ".*";
  enhanceSearchResults(document);
  assert.equal(document.querySelector("mark").textContent, ".*", "regex syntax is literal");
  input.value = "<img>";
  enhanceSearchResults(document);
  assert.equal(document.querySelector("mark").textContent, "<img>");
  assert.equal(document.querySelectorAll("img,script").length, 0, "query text cannot introduce HTML");
  button.click();
  assert.equal(clicked, 1, "existing controls keep their identities and listeners");
  console.log("PASS screen search highlighting: nine searches, aliases/ordinances, literal/Unicode safety, clear/repeat, focus and controls");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
