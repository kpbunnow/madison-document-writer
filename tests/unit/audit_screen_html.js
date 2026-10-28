/* Screen interpolation is escaped by default; print owners remain outside this helper. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");
const { moduleGraph } = require("../../tools/module_graph.cjs");
(async () => {
  const compiled = await esbuild.build({ entryPoints: [path.resolve("app/modules/screen_html.js")], bundle: true, write: false, format: "cjs" });
  const box = { exports: {} };
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { html, raw } = box.exports;
  for (const [value, escaped] of [
    ["<&>\"'", "&lt;&amp;&gt;&quot;&#39;"],
    [null, ""],
    [undefined, ""],
    [0, "0"],
    [false, "false"],
    ["雪 ◯ —", "雪 ◯ —"],
  ])
    assert.equal(html`<p>${value}</p>`, "<p>" + escaped + "</p>");
  assert.equal(html`<input value="${'" onfocus="unsafe'}">`, '<input value="&quot; onfocus=&quot;unsafe">');
  const fragment = raw('<span class="trusted">Safe renderer</span>');
  assert.equal(Object.isFrozen(fragment), true);
  assert.equal(html`<p>${fragment}</p>`, '<p><span class="trusted">Safe renderer</span></p>');
  assert.equal(html`${{ value: "<unsafe>" }}`, "[object Object]", "plain objects cannot forge a trusted fragment");
  assert.equal(html`${["<unsafe>"]}`, "&lt;unsafe&gt;");
  assert.equal(html`first\n${"line"}\tend`, "first\nline\tend");
  assert.equal(html`${raw(null)}${raw(undefined)}`, "nullundefined", "trusted fragments retain explicit string coercion");
  const graph = moduleGraph(path.resolve("app/modules"));
  for (const owner of [
    "document_render.js",
    "browser_printing.js",
    "document_pagination.js",
    "initial_citations.js",
    "document_printing.js",
    "document_delivery.js",
  ]) {
    const visited = new Set();
    const visit = (name) => {
      if (visited.has(name)) return;
      visited.add(name);
      for (const next of graph.edges[name] || []) visit(next);
    };
    visit(owner);
    assert.equal(visited.has("screen_html.js"), false, owner + " must retain its approved print/delivery path");
  }
  console.log("PASS screen escaping, explicit trusted fragments, coercion and print-owner exclusion");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
