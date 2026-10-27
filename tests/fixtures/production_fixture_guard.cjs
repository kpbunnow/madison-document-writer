/* Native production entrypoint check; no application-bundle eval or diagnostic hook is installed. */
const assert = require("assert/strict"),
  http = require("http"),
  acorn = require("acorn");
const { chromium } = require("playwright");
const { productionPage, bundleSource } = require("./built_bundle.cjs");
module.exports = async function productionFixtureGuard() {
  const html = productionPage("app", process.env.DW_PRODUCTION_DIR),
    payload = bundleSource(html);
  assert.ok(!payload.includes("function issueDocument("));
  acorn.parse(payload, { ecmaVersion: 2022, sourceType: "script" });
  const server = http.createServer((request, response) => {
    response.setHeader("Content-Type", request.url === "/" ? "text/html" : "application/json");
    response.end(request.url === "/" ? html : '{"ok":true}');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.DW_BROWSER || undefined, headless: true });
    const page = await browser.newPage();
    await page.addInitScript(() => {
      globalThis.MADISON_TEST_DATA = true;
    });
    await page.goto("http://127.0.0.1:" + server.address().port + "/");
    await page.waitForFunction(() => typeof WriterState !== "undefined" && Array.isArray(WriterState.CASES));
    const actual = await page.evaluate(() => ({
      cases: WriterState.CASES.length,
      issue: typeof issueDocument,
      reissue: typeof reissueDocument,
      due: typeof futureDue,
    }));
    assert.equal(actual.cases, 0);
    assert.equal(actual.issue, "undefined");
    assert.equal(actual.reissue, "undefined");
    assert.equal(actual.due, "undefined");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
};
