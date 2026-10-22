/* Production phase seven. Synthetic reviews use only the temporary real helper. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, hostPage, OUT, axeScreen, axeThemes) {
  const context = await browser.newContext({ timezoneId: "America/Chicago", viewport: { width: 1366, height: 900 } }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let restored;
  const themes = async (label) => {
    await axeScreen(page, label);
    await axeThemes(page, label);
  };
  const field = (name) => page.locator('[data-catalog-field="' + name + '"]');
  const mode = async (value) => {
    await page.locator('[data-language-mode="' + value + '"]').click();
    await page.getByRole("heading", { name: value === "admin" ? "Review catalog" : "Browse language", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("h1")), true);
  };
  try {
    await page.goto(new URL("/", hostPage.url()).href);
    await page.waitForFunction(() => typeof WriterState.state !== "undefined" && IDB_OK && WriterState.CATALOG_VERIFIED);
    await page.waitForTimeout(200);
    const entry = await page.evaluate(() => {
      const i = allItems().find((i) => i.catalogId === "EXT15"),
        old = allItems().find((i) => i.p !== "draft" && i.s.includes("27.05(2)(c)"));
      return {
        key: catalogKey(i),
        pick: i.ci + ":" + i.gi + ":" + i.o,
        title: i.t,
        wording: i.a,
        ordinances: i.s.join("; "),
        replaces: catalogKey(old),
      };
    });
    await page.locator('[data-nav="library"]').click();
    assert.equal(await page.locator("#lib-status").inputValue(), "approved");
    assert.equal(await page.locator("[data-catalog-save]").count(), 0);
    await mode("admin");
    await page.locator("#catalog-filter").fill("EXT15");
    await page.locator("[data-catalog-open]").first().click();
    await field("reviewer").fill("SYNTHETIC R47 QA");
    await field("source").fill("Automated fixture only; no division approval is claimed.");
    await field("wording").fill(entry.wording);
    await field("ordinances").fill(entry.ordinances);
    await field("replaces").selectOption(entry.replaces);
    let release;
    await context.route("**/catalog/review", async (route) => {
      const response = await route.fetch();
      await new Promise((r) => (release = r));
      await route.fulfill({ response });
    });
    page.once("dialog", (d) => d.accept());
    await page.locator('[data-catalog-status="approved"]').click();
    for (let n = 0; n < 100 && !release; n++) await page.waitForTimeout(20);
    assert.ok(release, "Real review POST reached the helper");
    await field("source").fill("LATER UNSUBMITTED AUTHORITY NOTE");
    release();
    await page.waitForFunction(() => Object.values(WriterState.CATALOG_FORMS).some((f) => f.error?.includes("later edits")));
    assert.equal(await field("source").inputValue(), "LATER UNSUBMITTED AUTHORITY NOTE");
    await context.unroute("**/catalog/review");
    await themes("r47-admin-review");
    await page.screenshot({ path: path.join(OUT, "r47-admin-review.png"), fullPage: true });
    await mode("browse");
    await page.locator("#lib-filter").fill("garbage");
    assert.equal(await page.locator(".language-row").count(), 1);
    assert.equal(await page.locator("[data-catalog-save]").count(), 0);
    assert.match(await page.locator(".language-row").innerText(), /Approved/i);
    const search = page.locator("#lib-filter");
    await search.evaluate((el) => el.setSelectionRange(3, 3));
    await page.evaluate(() => refreshCatalog());
    assert.equal(await search.evaluate((el) => document.activeElement === el && el.selectionStart === 3), true);
    for (const q of ["rubbish", "27.05(2)(c)", "exterior trash"]) {
      await search.fill(q);
      assert.equal(await page.locator(".language-row").count(), 1);
    }
    await search.fill("trash");
    await page.locator(".language-details>summary").click();
    await page.locator(".language-details>summary").focus();
    await page.evaluate(() => refreshCatalog());
    assert.equal(await page.locator(".language-details").evaluate((el) => el.open), true);
    assert.equal(await page.locator(".language-details>summary").evaluate((el) => document.activeElement === el), true);
    await page.locator("[data-language-refresh]").focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-language-refresh")), true);
    await themes("r47-language-discovery");
    await page.screenshot({ path: path.join(OUT, "r47-language-discovery.png"), fullPage: true });
    await page.locator("#lib-status").selectOption("all");
    await search.fill("");
    await themes("r47-all-language");
    const replacement = page
      .locator(".language-row")
      .filter({ has: page.locator("[data-language-replacement]") })
      .first();
    await replacement.locator(".language-details>summary").click();
    assert.match(await replacement.innerText(), new RegExp(entry.title));
    await replacement.locator("[data-language-replacement]").click();
    assert.equal(await page.locator("#lib-status").inputValue(), "approved");
    assert.equal(await page.locator(".language-row").count(), 1);
    await page.evaluate(() => {
      WriterState.CASES = [
        {
          id: "r47-case",
          number: "QA-R47-LANGUAGE",
          address: "4700 SYNTHETIC LANE",
          parcel: "070822219105",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["4700 SYNTHETIC LANE", "MADISON WI 53703"],
          inspectorId: "i4",
          date: recordDay(today),
          time: "09:00",
          emails: [],
        },
      ];
      WriterState.DOCS = [];
      WriterState.EVENTS = {};
      WriterState.REINSP = [];
      WriterState.PENDING = [];
      WriterState.CASEDIR = null;
      WriterState.NEEDGRANT = false;
      WriterState.WORK = { entry: {}, recordForms: {} };
      newDoc("r47-case", "notice");
    });
    await page.locator("#btn-add-top").click();
    assert.equal(await page.locator("#pk-status").inputValue(), "approved");
    await page.locator("#pk-q").fill("garbage");
    await page.locator('[data-pick="' + entry.pick + '"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => doc(WriterState.state.docId).items.length === 1);
    assert.equal(await page.locator("[data-pick][aria-pressed=true]").count(), 1);
    assert.match(await page.locator("[data-language-selected]").innerText(), /^1 selected from library · 1 item/);
    await page.getByRole("button", { name: "Done adding", exact: true }).click();
    await page.locator('[data-field="text"]').first().fill("PRIVATE NORTH WALL REPAIR");
    await page.locator('[data-field="sections"]').first().fill("PRIVATE 77");
    const due = await page.evaluate(() => addDays(recordDay(today), 25));
    await page.locator('[data-field="due"]').fill(due);
    const privateItem = await page.evaluate(() => clone(doc(WriterState.state.docId).items[0]));
    await page.locator("#btn-add-top").click();
    await page.locator("#pk-q").fill("garbage");
    assert.match(await page.locator(".language-preview").innerText(), /PRIVATE NORTH WALL/);
    await page.locator('[data-pick="' + entry.pick + '"]').click();
    await page.waitForFunction(() => doc(WriterState.state.docId).items.length === 0);
    await page.locator('[data-pick="' + entry.pick + '"]').click();
    await page.waitForFunction(() => doc(WriterState.state.docId).items.length === 1);
    assert.deepEqual(await page.evaluate(() => doc(WriterState.state.docId).items[0]), privateItem);
    await page.locator("#pk-status").focus();
    await page.locator("#pk-status").selectOption("selected");
    await page.evaluate(() => refreshCatalog());
    assert.equal(await page.evaluate(() => document.activeElement.id), "pk-status");
    assert.match(await page.locator(".pane-h").innerText(), /1 matching entries/i);
    await page.evaluate(() => document.querySelectorAll("[data-message-dismiss]").forEach((b) => b.click()));
    await themes("r47-selected-picker");
    await page.screenshot({ path: path.join(OUT, "r47-selected-picker.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await axeScreen(page, "r47-picker-phone");
    await page.screenshot({ path: path.join(OUT, "r47-picker-phone.png") });
    await page.getByRole("button", { name: "Done adding", exact: true }).click();
    const bundle = await page.evaluate(async () => {
      await saveDrafts();
      return idbGet("drafts");
    });
    restored = await browser.newContext({ timezoneId: "America/Chicago", viewport: { width: 390, height: 844 }, hasTouch: true });
    const touch = await restored.newPage();
    await touch.goto(page.url());
    await touch.waitForFunction(() => typeof WriterState.state !== "undefined" && IDB_OK);
    await touch.evaluate(async (b) => idbSet("drafts", b), bundle);
    await touch.reload();
    await touch.waitForFunction(() => WriterState.DOCS.some((d) => d.caseId === "r47-case"));
    await touch.evaluate(() => {
      WriterState.state.docId = WriterState.DOCS.find((d) => d.caseId === "r47-case").id;
      WriterState.state.screen = "write";
      render();
    });
    await touch.locator("#btn-add-top").tap();
    await touch.locator("#pk-status").selectOption("selected");
    assert.deepEqual(await touch.evaluate(() => doc(WriterState.state.docId).items[0]), privateItem);
    await touch.locator('[data-pick="' + entry.pick + '"]').tap();
    await touch.waitForFunction(() => doc(WriterState.state.docId).items.length === 0);
    await touch.locator("#pk-status").selectOption("approved");
    await touch.locator("#pk-q").fill("garbage");
    await touch.locator('[data-pick="' + entry.pick + '"]').tap();
    await touch.waitForFunction(() => doc(WriterState.state.docId).items.length === 1);
    assert.deepEqual(await touch.evaluate(() => doc(WriterState.state.docId).items[0]), privateItem);
    await axeScreen(touch, "r47-restored-touch-selection");
    await restored.close();
    restored = null;
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.evaluate(async (entry) => {
      const r = catalogReview(entry.key);
      window.__r47Issued = clone(doc(WriterState.state.docId));
      window.__r47Issued.id = "r47-frozen";
      window.__r47Issued.draft = false;
      window.__r47Issued.status = "Final";
      window.__r47Issued.frozen = freezeSources(window.__r47Issued);
      window.__r47FrozenBefore = JSON.stringify(window.__r47Issued);
      window.__r47PrintBefore = docBody(window.__r47Issued);
      await helperJSON("/catalog/review", {
        key: entry.key,
        status: "approved",
        expectedVersion: r.version,
        reviewer: "SYNTHETIC R47 QA",
        source: "Synthetic version-change fixture only",
        wording: "SECOND SYNTHETIC CATALOG VERSION",
        ordinances: ["27.05(2)(c)"],
        replaces: entry.replaces,
      });
      await refreshCatalog();
      render();
    }, entry);
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).items[0].text), "PRIVATE NORTH WALL REPAIR");
    assert.equal(await page.evaluate(() => catalogDraftBlocked(doc(WriterState.state.docId).items[0])), true);
    assert.equal(
      await page.evaluate(
        () => JSON.stringify(window.__r47Issued) === window.__r47FrozenBefore && docBody(window.__r47Issued) === window.__r47PrintBefore,
      ),
      true,
    );
    page.once("dialog", (d) => d.accept());
    await page.locator("[data-adopt-catalog]").click();
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).items[0].text), "SECOND SYNTHETIC CATALOG VERSION");
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).items[0].id), privateItem.id);
    await page.locator("#btn-add-top").click();
    await page.locator("#pk-q").fill("EXT15");
    await page.locator("#pk-status").selectOption("approved");
    let releaseRead;
    await context.route("**/catalog/reviews", async (route) => {
      await new Promise((r) => (releaseRead = r));
      await route.continue();
    });
    await page.locator('[data-pick="' + entry.pick + '"]').click();
    for (let n = 0; n < 100 && !releaseRead; n++) await page.waitForTimeout(20);
    assert.ok(releaseRead);
    const prior = await page.evaluate(() => {
      const id = WriterState.state.docId;
      WriterState.CASES.push({ ...clone(WriterState.CASES[0]), id: "r47-other", number: "QA-R47-OTHER" });
      WriterState.state.picker = false;
      newDoc("r47-other", "notice");
      return id;
    });
    releaseRead();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate((id) => doc(id).items.length, prior), 1);
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).items.length), 0);
    await context.unroute("**/catalog/reviews");
    await page.locator('[data-nav="library"]').click();
    await mode("admin");
    await page.locator("#catalog-filter").fill("EXT15");
    await page.locator("#catalog-status").selectOption("all");
    await page.locator("[data-catalog-open]").first().click();
    assert.equal(await field("source").inputValue(), "LATER UNSUBMITTED AUTHORITY NOTE");
    page.once("dialog", (d) => d.accept());
    await page.locator("[data-catalog-rebase]").click();
    await context.route("**/catalog/review", (route) => route.abort());
    page.once("dialog", (d) => d.accept());
    await page.locator('[data-catalog-status="approved"]').click();
    await page.getByText(/Review save was not confirmed:/).waitFor();
    assert.equal(await field("source").inputValue(), "LATER UNSUBMITTED AUTHORITY NOTE");
    await context.unroute("**/catalog/review");
    page.once("dialog", (d) => d.accept());
    await page.locator('[data-catalog-status="retired"]').click();
    await page.waitForFunction((key) => catalogStatus(catalogItem(key)).code === "retired", entry.key);
    await themes("r47-retired-review");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await axeScreen(page, "r47-admin-phone");
    await page.screenshot({ path: path.join(OUT, "r47-admin-phone.png"), fullPage: true });
    await mode("browse");
    await context.route("**/catalog/reviews", (route) => route.abort());
    await page.locator("[data-language-refresh]").click();
    await page.getByRole("alert").filter({ hasText: "Review refresh unavailable:" }).waitFor();
    assert.equal(await page.evaluate((key) => catalogStatus(catalogItem(key)).code, entry.key), "retired");
    assert.equal(
      await page.evaluate(() =>
        allItems()
          .filter((i) => i.p === "draft" && !catalogReview(catalogKey(i)))
          .some((i) => catalogVisible(i, "approved")),
      ),
      false,
    );
    await axeScreen(page, "r47-unavailable-review-status");
    await page.screenshot({ path: path.join(OUT, "r47-unavailable-review-status.png"), fullPage: true });
    assert.deepEqual(errors, []);
    const result = {
      passed: true,
      checks: [
        "Approved-only defaults and explicit standard scope",
        "ordinary synonym and ordinance queries",
        "dedicated administration real-helper immutable approval",
        "later edits retained after delayed acknowledgement",
        "unique selection and counts",
        "private edit retention and fresh-profile IndexedDB touch recovery",
        "explicit version adoption",
        "frozen issued facts",
        "replacement discovery and retirement",
        "caret control and disclosure continuity",
        "delayed pick isolated by document",
        "uncertain write and unavailable review status",
        "themes and phone layout",
      ],
    };
    fs.writeFileSync(path.join(OUT, "r47-language-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    if (restored) await restored.close();
    await context.close();
  }
};
