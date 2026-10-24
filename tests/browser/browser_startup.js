/* Startup must restore real IndexedDB before user navigation or saving can replace private work. */
const assert = require("assert/strict");

module.exports = async function (browser, hostPage, OUT, axeScreen) {
  const context = await browser.newContext({ timezoneId: "America/Chicago", viewport: { width: 1400, height: 1000 } });
  const errors = [];
  context.on("page", (p) => p.on("pageerror", (error) => errors.push(error.message)));
  let release;
  try {
    await context.addInitScript((applicationOrigin) => {
      // Blank pages and opaque-origin frames cannot access sessionStorage.
      if (location.origin !== applicationOrigin) return;
      if (sessionStorage.getItem("qa-storage-failure") === "1") {
        indexedDB.open = () => {
          throw new DOMException("Synthetic storage failure", "UnknownError");
        };
      }
    }, new URL(hostPage.url()).origin);
    const page = await context.newPage();
    await page.goto(new URL("/", hostPage.url()).href);
    await page.waitForFunction(() => typeof WriterState !== "undefined" && WriterState.WRITER_READY === true);
    await page.evaluate(async () => {
      WriterState.CASES = [
        {
          id: "startup-case",
          number: "QA-STARTUP",
          address: "100 SYNTHETIC AVENUE",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["100 TEST ROAD", "Madison, WI 53703"],
          inspectorId: INSPECTORS[0].id,
          date: "2026-03-07",
          time: "09:00",
          emails: [],
        },
      ];
      newDoc("startup-case", "notice");
      doc(WriterState.state.docId).items = [
        { id: "startup-item", no: "1", title: "Wall", text: "Retain this private wording.", sections: ["27.05(2)(c)"] },
      ];
      WriterState.WORK.entry["lookup-number"] = "QA-RETAIN-ENTRY";
      await saveDrafts();
    });
    const retained = async () =>
      page.evaluate(async () => {
        const b = await idbGet("drafts");
        return { cases: b.cases.length, docs: b.docs.length, text: b.docs[0]?.items[0]?.text, entry: b.work.entry["lookup-number"] };
      });
    const expected = { cases: 1, docs: 1, text: "Retain this private wording.", entry: "QA-RETAIN-ENTRY" };
    assert.deepEqual(await retained(), expected);
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    let started;
    const delayed = new Promise((resolve) => {
      started = resolve;
    });
    await context.route("**/catalog/reviews", async (route) => {
      started();
      await gate;
      await route.continue();
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof WriterState !== "undefined" && WriterState.HELPER);
    assert.equal(await page.evaluate(() => WriterState.WRITER_READY), false);
    await page.waitForFunction(() => document.querySelector("h1")?.textContent === "Restoring saved workspace");
    await delayed;
    assert.equal(await page.locator(".writer-navigation").count(), 0, "editable routes are not exposed while restoring");
    assert.equal(await page.evaluate(() => saveDrafts()), false, "a direct save cannot overwrite a not-yet-restored workspace");
    assert.deepEqual(await retained(), expected);
    // This real click waits for the navigation to become available; it must not save the initial empty model.
    const navigation = page.locator('.writer-navigation [data-nav="library"]').click();
    await axeScreen(page, "startup-restoring-workspace");
    assert.deepEqual(await retained(), expected);
    release();
    await navigation;
    await page.waitForFunction(() => WriterState.WRITER_READY && WriterState.state.screen === "library");
    assert.deepEqual(await retained(), expected);
    assert.equal(await page.evaluate(() => WriterState.DOCS.some((d) => d.draft && d.items[0]?.text === "Retain this private wording.")), true);
    await context.unroute("**/catalog/reviews");
    // A no-click reload is the normal control and preserves the same private draft.
    await page.reload();
    await page.waitForFunction(() => WriterState.WRITER_READY === true);
    assert.deepEqual(await retained(), expected);
    // A read failure must be visible and must not be mistaken for an empty database.
    await page.evaluate(() => sessionStorage.setItem("qa-storage-failure", "1"));
    await page.reload();
    await page.getByRole("heading", { name: "Saved workspace could not be restored" }).waitFor();
    assert.equal(await page.evaluate(() => saveDrafts()), false);
    assert.equal(await page.locator(".writer-navigation").count(), 0);
    await axeScreen(page, "startup-storage-failure");
    await page.evaluate(() => sessionStorage.removeItem("qa-storage-failure"));
    await Promise.all([page.waitForEvent("domcontentloaded"), page.getByRole("button", { name: "Reload and retry" }).click()]);
    await page.waitForFunction(() => WriterState.WRITER_READY === true);
    assert.deepEqual(await retained(), expected, "retry restores the original draft after storage becomes available");
    assert.deepEqual(errors, [], "storage failure and retry are handled without uncaught browser errors");
  } finally {
    release?.();
    await context.close();
  }
  return { passed: true, retainedDrafts: 1, earlySaveRefused: true, failedReadRefused: true, retryRestored: true };
};
