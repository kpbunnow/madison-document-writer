/* R48 production Reports. Synthetic summaries isolate presentation; earlier suites use real shared records. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, hostPage, OUT, axeScreen, axeThemes) {
  const context = await browser.newContext({ timezoneId: "America/Chicago", viewport: { width: 1366, height: 900 } }),
    page = await context.newPage(),
    errors = [],
    timings = [];
  let count = 600;
  page.on("pageerror", (e) => errors.push(e.message));
  const summary = (n, old = false) => ({
    format: "madison-case-summary",
    summaryVersion: old ? 5 : 6,
    case: {
      number: "QA-R48-" + n,
      address: n + " SYNTHETIC ST",
      parcel: "",
      zip: n % 2 ? "53703" : "53704",
      opened: "2026-01-02",
      noticeIssued: "2026-01-03",
      status: "Notice",
      inspector: "Inspector " + (n % 8),
      owner: "SYNTHETIC OWNER",
      ownerAddr: ["400 TEST ST", "MADISON WI 53703"],
    },
    violations: [{ no: "1", title: "Exterior wall", sections: ["27.05(2)(c)"], type: "qa-wall", typeLabel: "Exterior", done: false }],
    citations: [],
    referrals: [],
    visits: [],
    documents: [],
    integrity: { valid: true, label: "Synthetic valid proof" },
  });
  const index = () => ({
    ok: true,
    caseDir: "QA ONLY",
    readAt: "2026-10-16T10:30:00",
    summaries: Array.from({ length: count }, (_, n) => summary(n)).concat([summary("OLD", true)]),
    missing: ["QA-MISSING.json"],
    stale: ["QA-MISMATCH.json"],
    unreadable: ["QA-DUPLICATE.json (duplicate summary; excluded from totals)"],
  });
  await context.route("**/reporting/index", (r) => r.fulfill({ json: index() }));
  await context.route("**/reporting/parcels", (r) => r.fulfill({ json: { ok: true, parcels: {}, missing: [] } }));
  await context.route("**/reporting/areas", (r) =>
    r.fulfill({ json: { ok: true, notes: ["Synthetic outlines unavailable"], districts: null, zips: null } }),
  );
  await context.route("https://maps.cityofmadison.com/**", (r) => r.abort());
  const themes = async (label) => {
    await axeScreen(page, label);
    await axeThemes(page, label);
  };
  const screen = async (id) => {
    if (!(await page.locator('.rail [data-screen="' + id + '"]').isVisible())) await page.locator("#report-menu>summary").click();
    await page.locator('.rail [data-screen="' + id + '"]').click();
  };
  try {
    await page.goto(new URL("/madison-reports.html", hostPage.url()).href);
    await page.waitForFunction(() => typeof ReportsState.S !== "undefined" && ReportsState.S.phase === "ready");
    assert.equal(await page.evaluate(() => ReportsState.S.M.counted.length), 600);
    assert.equal(await page.evaluate(() => ReportsState.S.M.byNo["QA-R48-OLD"]), undefined);
    assert.equal(await page.locator("#report-menu").evaluate((el) => el.open), false);
    assert.equal(await page.locator("#report-more-filters").evaluate((el) => el.open), false);
    assert.equal(await page.locator("[data-act=clearFilters]").count(), 1);
    await themes("r48-common-reports");
    await page.screenshot({ path: path.join(OUT, "r48-common-reports.png"), fullPage: true });
    await page.locator("#report-menu>summary").focus();
    await page.keyboard.press("Enter");
    await themes("r48-more-reports");
    await screen("byInspector");
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("h1")), true);
    await page.locator("#f-inspector").focus();
    await page.locator("#f-inspector").selectOption("Inspector 1");
    assert.equal(await page.evaluate(() => document.activeElement.id), "f-inspector");
    assert.match(await page.locator(".applied-filters").innerText(), /Inspector 1/);
    await page.locator("#report-more-filters>summary").click();
    await page.locator("#f-status").focus();
    await page.locator("#f-status").selectOption("open");
    assert.equal(await page.locator("#report-more-filters").evaluate((el) => el.open), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "f-status");
    await themes("r48-applied-filters");
    await page.screenshot({ path: path.join(OUT, "r48-applied-filters.png"), fullPage: true });
    await page.locator("[data-act=clearFilters]").click();
    assert.equal(await page.locator("#f-inspector").inputValue(), "");
    assert.equal(await page.locator("#f-status").inputValue(), "");
    await page.locator('[data-report-sort="0"]').click();
    await page.locator('[data-report-sort="0"]').click();
    const expected = await page.evaluate(() => reportsServices.currentReportRows());
    assert.ok(expected.length > 3);
    const normalized = await page.evaluate(() =>
      reportsScreens
        .exportSheets()
        .find((s) => s.name === ReportsState.S.rep.r.n + " " + ReportsState.S.rep.r.label)
        .rows.map((r) => r.map((x) => (x && typeof x === "object" ? (x.f ?? x.m ?? x.d ?? "") : (x ?? "")))),
    );
    assert.deepEqual(normalized, expected);
    await page.locator("#report-exports>summary").click();
    const csv = await Promise.all([page.waitForEvent("download"), page.locator("[data-report-csv]").click()]);
    await csv[0].saveAs(path.join(OUT, "r48-filtered-sort.csv"));
    const csvText = fs.readFileSync(path.join(OUT, "r48-filtered-sort.csv"), "utf8");
    assert.ok(csvText.indexOf("Inspector 7") < csvText.indexOf("Inspector 0"), "descending row order in actual CSV");
    const wb = await Promise.all([page.waitForEvent("download"), page.locator("[data-act=export]").click()]);
    await wb[0].saveAs(path.join(OUT, "r48-filtered-sort.xlsx"));
    await page.emulateMedia({ media: "print" });
    const printRows = await page.locator(".rep tbody tr").allTextContents();
    assert.ok(printRows[0].includes("Inspector 7"));
    await page.pdf({ path: path.join(OUT, "r48-report.pdf"), format: "Letter", printBackground: true });
    await page.emulateMedia({ media: "screen" });
    await page.locator("#report-views>summary").click();
    page.once("dialog", (d) => d.accept("R48 descending local"));
    await page.locator("[data-act=saveView]").click();
    const saved = await page.evaluate(() => ReportsState.S.savedId);
    await page.locator('[data-report-sort="0"]').click();
    await page.locator("#saved-view").selectOption(saved);
    assert.equal(await page.evaluate(() => ReportsState.S.tableSort.dir), -1);
    await axeScreen(page, "r48-saved-view");
    await page.locator("[data-view=map]").click();
    await page.locator(".map-table-alternative>summary").click();
    assert.equal(await page.locator(".map-table-alternative .rep").count(), 1);
    await axeScreen(page, "r48-map-table-alternative");
    await page.locator("[data-view=table]").click();
    await screen("data");
    await themes("r48-coverage-actions");
    assert.equal(await page.locator("#report-proof").evaluate((el) => el.open), false);
    await page.locator("#report-proof>summary").click();
    assert.match(await page.locator("#report-proof").innerText(), /QA-MISMATCH/);
    assert.match(await page.locator("#report-proof").innerText(), /QA-DUPLICATE/);
    assert.match(await page.locator("#report-proof").innerText(), /earlier summary format/);
    await page.locator("#report-definitions>summary").click();
    await axeScreen(page, "r48-proof-details");
    await page.screenshot({ path: path.join(OUT, "r48-coverage-details.png"), fullPage: true });
    await screen("deposit");
    await page.locator("#deposit-schedule-date").fill("2026-10-16");
    await themes("r48-deposit-rules");
    assert.equal(await page.locator("#deposit-policy").evaluate((el) => el.open), false);
    assert.match(await page.locator(".rep tbody").innerText(), /per whole inch/);
    assert.equal((await page.locator(".rep tbody").innerText()).includes('"kind"'), false);
    await page.screenshot({ path: path.join(OUT, "r48-deposit-rules.png") });
    await page.locator("[data-schedule-page=next]").click();
    assert.match(await page.locator("#deposit-matches").innerText(), /showing 41/);
    await page.locator("#deposit-schedule-search").fill("10.05(11)");
    assert.match(await page.locator(".rep tbody").innerText(), /Tree Protection/);
    assert.equal(await page.evaluate(() => document.activeElement.id), "deposit-schedule-search");
    await page.locator("#deposit-schedule-search").fill("");
    await page.setViewportSize({ width: 390, height: 844 });
    await axeScreen(page, "r48-deposit-phone");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await screen("allCases");
    await axeScreen(page, "r48-reports-phone");
    await page.screenshot({ path: path.join(OUT, "r48-reports-phone.png"), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.setViewportSize({ width: 1366, height: 900 });
    // Real overlapping HTTP reads demonstrate why the generation guard is required.
    let release,
      seen = false;
    await context.unroute("**/reporting/index");
    await context.route("**/reporting/index", async (route) => {
      if (!seen) {
        seen = true;
        const first = index();
        first.readAt = "OLDER-HELD";
        await new Promise((r) => (release = r));
        try {
          await route.fulfill({ json: first });
        } catch (e) {}
        return;
      }
      const next = index();
      next.readAt = "LATEST";
      await route.fulfill({ json: next });
    });
    await page.evaluate(() => {
      window.__firstRefresh = loadAll(false);
    });
    for (let n = 0; n < 100 && !release; n++) await page.waitForTimeout(10);
    assert.ok(release);
    await page.evaluate(() => loadAll(false));
    release();
    await page.evaluate(() => window.__firstRefresh);
    assert.equal(await page.evaluate(() => ReportsState.S.raw.readAt), "LATEST");
    await context.unroute("**/reporting/index");
    await context.route("**/reporting/index", (r) => r.fulfill({ json: index() }));
    await page.bringToFront();
    for (const n of [600, 3000]) {
      count = n;
      await page.evaluate(() => loadAll(false));
      const values = await page.evaluate(async () => {
        const values = [];
        for (let n = 0; n < 10; n++) {
          const start = performance.now();
          ReportsState.S.screen = n % 2 ? "byInspector" : "openCases";
          render();
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          values.push(performance.now() - start);
        }
        return values;
      });
      console.log("Reports transition milliseconds:", n, JSON.stringify(values));
      assert.ok(Math.max(...values) < 2000, "already-loaded local transition target");
      timings.push({
        cases: n,
        fixture: "already loaded synthetic verified-shape summaries; local Chromium, no SMB timing",
        milliseconds: values.map((x) => Math.round(x * 100) / 100),
        maximumMilliseconds: Math.max(...values),
      });
    }
    assert.deepEqual(errors, []);
    const result = {
      passed: true,
      acceptance: [
        "grouped navigation and exports",
        "basic and advanced filters, chips, reset",
        "screen/CSV/workbook/print stable sort",
        "local saved sort and relative/filter preferences",
        "exact exclusion categories and action",
        "proof and definitions disclosures",
        "human deposit rules",
        "map table alternative",
        "keyboard focus, themes, phone",
        "overlapping refresh guard",
        "600/3000 local transitions",
      ],
      timings,
      errors,
    };
    fs.writeFileSync(path.join(OUT, "r48-reports-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await context.close();
  }
};
