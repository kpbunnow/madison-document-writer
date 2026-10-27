/* Independent focus seam: copied catalog fields, disclosure summaries and search carets survive repaint. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        'export {rememberLanguageFocus,restoreLanguageFocus} from "./app/modules/language_discovery.js";export {checkAttr} from "./app/modules/presentation_format.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
  });
  const dom = new JSDOM('<div class="language-browser" data-language-context="browse"></div>', { pretendToBeVisual: true });
  const box = { exports: {} };
  new Function("document", "module", "exports", built.outputFiles[0].text)(dom.window.document, box, box.exports);
  const { rememberLanguageFocus, restoreLanguageFocus, checkAttr } = box.exports,
    R = { state: { screen: "library", languageMode: "browse" }, checkAttr },
    root = dom.window.document.querySelector("div");
  const repaint = (html) => {
    root.innerHTML = html;
  };
  repaint(
    '<input id="lib-filter" value="wall siding"><div data-language-key="one"><details class="language-details" open><summary>Details</summary></details></div>',
  );
  let field = root.querySelector("input");
  field.focus();
  field.setSelectionRange(2, 6);
  let kept = rememberLanguageFocus(R);
  repaint(
    '<input id="lib-filter" value="wall siding"><div data-language-key="one"><details class="language-details"><summary>Details</summary></details></div>',
  );
  restoreLanguageFocus(R, kept);
  assert.equal(dom.window.document.activeElement.id, "lib-filter");
  assert.equal(dom.window.document.activeElement.selectionStart, 2);
  assert.equal(dom.window.document.activeElement.selectionEnd, 6);
  assert.equal(root.querySelector("details").open, true);
  for (const attribute of [
    "data-pick",
    "data-catalog-open",
    "data-catalog-field",
    "data-catalog-replacement-query",
    "data-language-refresh",
    "data-language-standard",
    "data-language-replacement",
    "data-language-all",
  ]) {
    const html = "<button " + attribute + '="value" data-catalog-key="entry">Action</button>';
    repaint(html);
    root.querySelector("button").focus();
    kept = rememberLanguageFocus(R);
    repaint(html);
    restoreLanguageFocus(R, kept);
    assert.equal(dom.window.document.activeElement, root.querySelector("button"));
    if (attribute === "data-catalog-field") assert.match(kept.selector, /data-catalog-key/);
  }
  const details = '<div data-language-key="one"><details class="language-details" open><summary>Details</summary></details></div>';
  repaint(details);
  root.querySelector("summary").focus();
  kept = rememberLanguageFocus(R);
  repaint(details);
  restoreLanguageFocus(R, kept);
  assert.equal(dom.window.document.activeElement, root.querySelector("summary"));
  R.state.languageMode = "admin";
  assert.equal(rememberLanguageFocus(R), null);
  dom.window.close();
  console.log("PASS independent catalog focus, caret, field identity and disclosures");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
