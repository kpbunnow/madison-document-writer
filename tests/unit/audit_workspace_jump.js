/* Workspace "Find a case in this list" (owner direction 2026-11-13): typing marks matching rows without hiding any,
   Enter scrolls to the first match and focuses it, and the status line says what happened. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");

(async () => {
  const dom = new JSDOM(
    '<input type="search" id="workspace-jump"><p id="workspace-jump-status"></p><table><tbody>' +
      [
        ["a", "944 RISE LN", "CB2026-260-03957"],
        ["b", "12 EXAMPLE ST", "CB2026-260-04001"],
        ["c", "950 RISE LN", "CB2026-111-00002"],
      ]
        .map(
          ([id, addr, number]) =>
            `<tr data-queue-case="${id}"><td><div class="addr">${addr}</div><div class="case-number">${number}</div><p>OWNER RISE LLC</p></td></tr>`,
        )
        .join("") +
      "</tbody></table>",
  );
  const { document } = dom.window;
  global.document = document;
  const api = await compile('export {createWorkspaceJump} from "./workspace_jump.js";');
  api.createWorkspaceJump();
  const input = document.getElementById("workspace-jump"),
    status = document.getElementById("workspace-jump-status"),
    rows = [...document.querySelectorAll("tr")],
    hits = () => rows.filter((r) => r.classList.contains("case-jump-hit")).map((r) => r.dataset.queueCase);
  const type = (value) => {
    input.value = value;
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  };
  let scrolled = "";
  for (const row of rows) row.scrollIntoView = () => (scrolled = row.dataset.queueCase);
  type("rise");
  assert.deepEqual(hits(), ["a", "c"], "address matches are marked; the owner name is not searched");
  assert.match(status.textContent, /^2 cases highlighted/);
  assert.equal(rows.length, 3, "no row is removed or hidden");
  assert.ok(rows.every((r) => !r.hidden));
  type("04001");
  assert.deepEqual(hits(), ["b"]);
  assert.match(status.textContent, /^1 case highlighted/);
  input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  assert.equal(scrolled, "b");
  assert.equal(document.activeElement, rows[1], "Enter moves focus to the first match");
  type("nothing here");
  assert.deepEqual(hits(), []);
  assert.equal(status.textContent, "No case in this list matches.");
  type("");
  assert.equal(status.textContent, "");
  console.log("PASS Workspace find-a-case marks, scrolls and never hides rows");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
