/* Output-safety primitives with literal expectations (plan Phase 1 mutation pilot): other suites compare rendered
   screens against esc() itself, so a broken escape could not fail them. Every HTML-special character, newline
   handling, fill-in bubbles and selector quoting are checked against fixed strings. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
    stdin: { contents: 'export * from "./presentation_format.js";', resolveDir: path.resolve(__dirname, "../../app/modules") },
    bundle: true,
    write: false,
    format: "cjs",
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { esc, nl2, markBlanks, countBlanks, checkAttr, itemSelector, money, validMoney } = box.exports;
  assert.equal(esc(`Tom & Jerry <b>"quoted"</b> 'single'`), "Tom &amp; Jerry &lt;b&gt;&quot;quoted&quot;&lt;/b&gt; &#39;single&#39;");
  assert.equal(esc("&amp;"), "&amp;amp;", "an existing entity is escaped again, never trusted");
  assert.equal(esc(null), "");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
  assert.equal(nl2("a & b\nc"), "a &amp; b<br>c");
  assert.equal(markBlanks("Repair ( ) <now>"), 'Repair <span class="blank" role="img" aria-label="fill-in bubble"></span> &lt;now&gt;');
  assert.equal(countBlanks("( ) and (   ) but not (x)"), 2);
  assert.equal(checkAttr('a"b\\c'), 'a\\"b\\\\c');
  assert.equal(itemSelector('x"y', "due"), '[data-id="x\\"y"][data-field="due"]');
  assert.equal(money("12.345"), "12.35");
  assert.equal(validMoney("10.5"), true);
  assert.equal(validMoney("01"), false);
  console.log("PASS presentation escaping: literal HTML escaping, newlines, fill-in bubbles, selectors and money text");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
