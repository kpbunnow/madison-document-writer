/* Where Document Writer opens, in real Chromium. The helper reports caseLookup only on Windows, so the test answers
   /dw-status for one page: a PC with the City lookup opens on Workspace and begins loading the inspector list at
   once; this Linux helper's own answer keeps the Workspace start. Each page gets its own browser context because only
   one Writer tab may hold the workspace. */
const assert = require("assert/strict");
module.exports = async function (browser, hostPage) {
  const base = new URL("/", hostPage.url()).href;
  const options = { viewport: { width: 1400, height: 1100 }, timezoneId: "America/Chicago" };
  const cityContext = await browser.newContext(options);
  const plainContext = await browser.newContext(options);
  const asked = [];
  try {
    await cityContext.route("**/inspector-cases/list", async (route) => {
      asked.push("list");
      await route.fulfill({ json: { ok: true, inspectors: [{ id: "JSMITH", name: "Jordan Smith", openCases: 2 }] } });
    });
    await cityContext.route("**/dw-status", async (route) => {
      const real = await route.fetch();
      const body = await real.json();
      await route.fulfill({ json: { ...body, caseLookup: true } });
    });
    const city = await cityContext.newPage();
    await city.goto(base);
    await city.waitForFunction(() => typeof WriterState !== "undefined" && WriterState.WRITER_READY === true);
    await city.locator("#open-cases").waitFor();
    assert.equal(await city.evaluate(() => WriterState.state.screen), "cases", "opens on Workspace");
    await city.locator("#open-cases-inspector").waitFor();
    assert.equal(asked.length, 1, "the inspector list started loading when the program opened");
    assert.equal(await city.locator('.writer-navigation [data-nav="cases"]').count(), 1, "the Workspace navigation remains available");

    const plain = await plainContext.newPage();
    await plain.goto(base);
    await plain.waitForFunction(() => typeof WriterState !== "undefined" && WriterState.WRITER_READY === true);
    assert.equal(await plain.evaluate(() => WriterState.state.screen), "cases", "a helper that reports no City lookup keeps the Workspace start");
  } finally {
    await cityContext.close();
    await plainContext.close();
  }
  return { passed: true, opensOnWorkspace: true, workspaceKept: true };
};
