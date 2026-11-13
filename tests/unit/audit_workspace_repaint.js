/* Unchanged rows keep live DOM/focus/disclosures; changed policy output and unsafe partial shapes repaint. */
const assert = require("node:assert/strict"),
  { JSDOM } = require("jsdom"),
  { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const { paintWorkspace } = await compile('export {paintWorkspace} from "./workspace_repaint.js";');
  const dom = new JSDOM('<div id="app"></div>'),
    root = dom.window.document.getElementById("app");
  const row = (key, text) =>
    '<tr data-queue-case="' +
    key +
    '"><td><button data-open="' +
    key +
    '">' +
    text +
    "</button><details><summary>Options</summary>Details</details></td></tr>";
  const screen = (rows, note = "Same") =>
    "<p>" +
    note +
    '</p><input id="outside" value="saved"><div class="case-table-wrap workspace-cases"><table><tbody>' +
    rows.join("") +
    "</tbody></table></div>";
  const a = row("a", "First"),
    b = row("b", "Second");
  paintWorkspace(root, screen([a, b]), true);
  const first = root.querySelector('[data-queue-case="a"]'),
    second = root.querySelector('[data-queue-case="b"]'),
    input = root.querySelector("input");
  let clicks = 0;
  first.querySelector("button").addEventListener("click", () => clicks++);
  first.querySelector("details").open = true;
  input.value = "typing";
  first.querySelector("button").focus();
  for (let n = 0; n < 30; n++) paintWorkspace(root, screen([a, b]), true);
  assert.equal(root.querySelector('[data-queue-case="a"]'), first);
  assert.equal(root.querySelector('[data-queue-case="b"]'), second);
  assert.equal(root.querySelector("input"), input);
  assert.equal(input.value, "typing");
  assert.equal(first.querySelector("details").open, true);
  assert.equal(dom.window.document.activeElement, first.querySelector("button"));
  first.querySelector("button").click();
  assert.equal(clicks, 1, "retained controls keep one existing listener");
  paintWorkspace(root, screen([row("b", "Changed proof/action"), a]), true);
  assert.equal(root.querySelector('[data-queue-case="a"]'), first, "an unrelated case is not replaced");
  assert.notEqual(root.querySelector('[data-queue-case="b"]'), second, "changed case output replaces its row");
  assert.match(root.textContent, /Changed proof\/action/);
  assert.equal(dom.window.document.activeElement, first.querySelector("button"), "sorting keeps surviving control focus");
  paintWorkspace(root, screen([a, row("c", "New case")]), true);
  assert.equal(root.querySelector('[data-queue-case="a"]'), first);
  assert.equal(root.querySelector('[data-queue-case="b"]'), null);
  assert.equal(root.querySelectorAll("tr").length, 2);
  paintWorkspace(root, screen([a], "Changed warning"), true);
  assert.notEqual(root.querySelector('[data-queue-case="a"]'), first, "outside warnings use the complete repaint");
  assert.equal(root.querySelector("input").value, "saved");
  paintWorkspace(root, "<h1>Different screen</h1>", false);
  paintWorkspace(root, screen([a]), true);
  assert.equal(root.querySelectorAll("tr").length, 1, "returning from another screen starts a fresh row set");
  const current = root.querySelector("tr");
  paintWorkspace(root, screen([a, a]), true);
  assert.equal(root.querySelectorAll("tr").length, 2, "duplicate keys use full HTML, never drop a case");
  assert.notEqual(root.querySelector("tr"), current);
  const escaped = row("quoted&amp;&quot;key", "Escaped key");
  paintWorkspace(root, screen([escaped]), true);
  const escapedRow = root.querySelector("tr");
  paintWorkspace(root, screen([escaped]), true);
  assert.equal(root.querySelector("tr"), escapedRow);
  assert.equal(escapedRow.dataset.queueCase, 'quoted&"key');
  root.innerHTML = "<h1>Interruption</h1>";
  paintWorkspace(root, screen([escaped]), true);
  assert.equal(root.querySelectorAll("tr").length, 1, "a detached old table cannot suppress restoration");
  paintWorkspace(root, screen(['<tr data-queue-case="nested"><td><table><tbody><tr><td>Nested</td></tr></tbody></table></td></tr>']), true);
  assert.match(root.textContent, /Nested/, "unexpected nested shapes use the full renderer");
  dom.window.close();
  console.log(
    "PASS Workspace DOM reuse: repeated updates, changed rows, sorting/focus, live controls, additions/removal and conservative full-repaint fallbacks",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
