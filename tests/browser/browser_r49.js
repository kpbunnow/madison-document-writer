/* R49 deployable instructions and real independent helper HTTP reads. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, hostPage, OUT, axeScreen, axeThemes) {
  const base = new URL("/", hostPage.url()).href,
    context = await browser.newContext({ timezoneId: "America/Chicago", viewport: { width: 1366, height: 900 } }),
    page = await context.newPage();
  try {
    // APIRequestContext bypasses browser routing fixtures and calls the actual helper.
    const token = await hostPage.locator("meta[name=docwriter-token]").getAttribute("content");
    const auth = { headers: { "X-DocWriter-Token": token } };
    const reads = await Promise.all([context.request.get(base + "reporting/index", auth), context.request.get(base + "reporting/index", auth)]);
    const values = await Promise.all(
      reads.map(async (r) => {
        assert.equal(r.ok(), true);
        const v = await r.json();
        assert.equal(v.ok, true);
        delete v.readAt;
        return v;
      }),
    );
    assert.deepEqual(values[0], values[1]);
    assert.ok(values[0].summaries.length > 0, "real case projections available");
    await page.goto(base);
    await page.waitForFunction(() => typeof WriterState.HELPER !== "undefined" && WriterState.HELPER);
    await page.locator('[data-nav="tools"]').click();
    assert.equal(await page.locator(".writer-navigation .rail-item").count(), 4);
    const link = page.getByRole("link", { name: "Open program manual (new tab)", exact: true });
    assert.equal(await link.getAttribute("href"), "PROGRAM-MANUAL.html");
    const manual = await Promise.all([page.waitForEvent("popup"), link.click()]);
    const doc = manual[0];
    await doc.waitForLoadState();
    await axeScreen(doc, "r49-program-manual");
    assert.match(await doc.locator("h1").innerText(), /Program instruction manual/);
    const contents = doc.locator('nav[aria-label="Manual contents"]');
    assert.equal(await contents.locator("a").count(), 22);
    assert.equal(await doc.locator('nav[aria-label="Manual navigation"] a:visible').count(), 2);
    await doc.locator(".skip").focus();
    assert.ok(
      await doc.locator(".skip").evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === el;
      }),
      "focused skip link remains above the sticky navigation",
    );
    await doc.bringToFront();
    const search = doc.locator("#manual-search-input"),
      clear = doc.locator("#manual-search-clear");
    assert.equal(await clear.isVisible(), false);
    await search.fill("ticket");
    await doc.waitForFunction(() => [...document.querySelectorAll("#manual-search-results mark")].some((m) => /citation/i.test(m.textContent)));
    const firstResult = doc.locator("#manual-search-results a").first(),
      target = (await firstResult.getAttribute("href")).slice(1);
    await firstResult.click();
    await doc.waitForFunction((id) => document.activeElement.id === id, target);
    await doc.locator("[data-manual-search-link]").click();
    assert.equal(await search.inputValue(), "ticket", "returning to search retains the query");
    await clear.click();
    assert.equal(await search.inputValue(), "");
    assert.equal(await doc.locator("#manual-search-results li").count(), 0);
    assert.equal(await search.evaluate((el) => document.activeElement === el), true);
    await doc.getByRole("link", { name: "Contents", exact: true }).click();
    await contents.locator("a").nth(3).focus();
    await Promise.all([doc.waitForURL(/#chapter-4$/, { timeout: 5000 }), doc.keyboard.press("Enter")]);
    assert.match(doc.url(), /#chapter-4/);
    for (const width of [390, 320]) {
      await doc.setViewportSize({ width, height: 844 });
      assert.equal(await doc.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "manual reflow " + width);
      await axeScreen(doc, "r49-manual-" + width);
      await doc.locator("[data-manual-search-link]").click();
      assert.ok(
        await search.evaluate((el) => el.getBoundingClientRect().top >= document.querySelector(".manual-tools").getBoundingClientRect().bottom),
        "sticky navigation does not obscure search",
      );
    }
    await doc.setViewportSize({ width: 816, height: 1056 });
    await doc.emulateMedia({ media: "print" });
    await doc.evaluate(() =>
      Promise.all(
        [...document.images].map((img) => {
          img.loading = "eager";
          return img.decode();
        }),
      ),
    );
    assert.ok(
      await doc
        .locator("figure img:visible")
        .evaluateAll((images) => images.length > 0 && images.every((img) => img.getBoundingClientRect().height <= 674)),
      "all manual figures fit the printed page vertically",
    );
    await doc.locator("#figure-mobile-editor").screenshot({ path: path.join(OUT, "r49-manual-portrait-print.png") });
    await doc.emulateMedia({ media: "screen" });
    const pdf = await context.request.get(base + "Program_Instruction_Manual.pdf");
    assert.equal(pdf.ok(), true);
    assert.equal((await pdf.body()).subarray(0, 5).toString(), "%PDF-");
    assert.equal((await context.request.get(base + "server.py", auth)).status(), 404, "instruction allowlist does not expose helper source");
    await doc.screenshot({ path: path.join(OUT, "r49-manual-phone.png"), fullPage: false });
    await doc.close();
    await page.setViewportSize({ width: 320, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await axeScreen(page, "r49-tools-320");
    await page.setViewportSize({ width: 1366, height: 900 });
    await axeThemes(page, "r49-tools-manual-links");
    const result = {
      passed: true,
      realConcurrentHttpRequests: 2,
      realVerifiedSummaries: values[0].summaries.length,
      manualChapters: 22,
      manualPdfServed: true,
      reflowWidths: [390, 320],
      fourDestinations: true,
    };
    fs.writeFileSync(path.join(OUT, "r49-production-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await context.close();
  }
};
