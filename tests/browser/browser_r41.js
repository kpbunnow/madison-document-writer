/* Production UI checks for a busy synthetic workspace. Restore all runtime state. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, OUT, axeScreen, axeThemes) {
  const viewport = page.viewportSize();
  await page.evaluate(() => {
    window.__r41Saved = {
      CASES: WriterState.CASES,
      DOCS: WriterState.DOCS,
      REINSP: WriterState.REINSP,
      EVENTS: WriterState.EVENTS,
      PENDING: WriterState.PENDING,
      RECORD_ATTEMPTS: WriterState.RECORD_ATTEMPTS,
      ARTIFACT_LOCATIONS: WriterState.ARTIFACT_LOCATIONS,
      ARTIFACT_VERIFY: WriterState.ARTIFACT_VERIFY,
      ARTIFACT_IDENTITY: WriterState.ARTIFACT_IDENTITY,
      WORK: WriterState.WORK,
      HELPER: WriterState.HELPER,
      CASEDIR: WriterState.CASEDIR,
      NEEDGRANT: WriterState.NEEDGRANT,
      state: WriterState.state,
      PREFLIGHT_CONFLICT: WriterState.PREFLIGHT_CONFLICT,
      PREFLIGHT_NOTICE: WriterState.PREFLIGHT_NOTICE,
      RECOVERY: WriterState.RECOVERY,
      WORKFLOW_PREFS: clone(WriterState.WORKFLOW_PREFS),
      proofStatus: recordIntegrity.status,
    };
  });
  const results = [];
  try {
    // Dismiss prior synthetic alerts through the supported UI; retain their history.
    // A preceding asynchronous fixture can enqueue another alert after the first paint.
    // Dismiss through the supported UI and require a quiet interval before measuring layout.
    await page.evaluate(() => {
      window.__r41QuietSince = performance.now();
    });
    await page.waitForFunction(() => {
      const buttons = [...document.querySelectorAll("[data-message-dismiss]")];
      if (buttons.length) {
        buttons.forEach((button) => button.click());
        window.__r41QuietSince = performance.now();
        return false;
      }
      return performance.now() - window.__r41QuietSince > 250;
    });
    await page.evaluate(() => {
      delete window.__r41QuietSince;
    });
    await page.evaluate(require("../fixtures/workspace_fixture.cjs"));
    await page.evaluate(() => {
      WriterState.HELPER = window.__r41Saved.HELPER;
      WriterState.CASEDIR = window.__r41Saved.CASEDIR;
      WriterState.PREFLIGHT_CONFLICT = null;
      WriterState.PREFLIGHT_NOTICE = "";
      WriterState.RECOVERY = { ...WriterState.RECOVERY, error: "", at: "2026-10-15T12:00:00Z" };
      render();
    });
    for (const size of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.evaluate(() => window.scrollTo(0, 0));
      assert.equal(await page.locator("[data-queue-view]").count(), 4);
      assert.equal(await page.locator("[data-metric]").count(), 0);
      assert.equal(await page.locator("[data-queue-case]").count(), 32);
      assert.equal(await page.locator(".queue-primary").count(), 32);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const action = await page.locator(".queue-primary").first().boundingBox(),
        row = await page.locator("[data-queue-case]").first().boundingBox();
      assert.ok(action.height >= 44);
      if (size.width > 760)
        assert.ok(action.y + action.height < size.height - 24, "First recommended action visible above desktop fold: " + JSON.stringify(action));
      await axeScreen(page, "r41-workspace-" + size.width);
      await page.screenshot({ path: path.join(OUT, "r41-workspace-" + size.width + ".png"), fullPage: false });
      results.push({ viewport: size, firstRowY: row.y, firstActionY: action.y, summaryButtons: 4, cases: 32 });
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    if (axeThemes) await axeThemes(page, "r41-workspace-busy");
    await page.locator('[data-queue-view="deadlines"]').click();
    assert.equal(await page.locator("#case-filter").inputValue(), "deadlines");
    assert.equal(await page.locator("[data-queue-case]").count(), 11);
    await page.locator("#case-search").fill("nothing matches");
    await page.getByRole("button", { name: "View all cases", exact: true }).click();
    assert.equal(await page.locator("[data-queue-case]").count(), 32);
    assert.equal(await page.locator("#case-search").inputValue(), "");
    const details = page.locator('[data-queue-case="queue-0"] details').first();
    await details.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await details.getAttribute("open"), "");
    assert.equal(await details.locator("[data-timeline]").count(), 1);
    await page.keyboard.press("Enter");
    assert.equal(await details.getAttribute("open"), null);
    // New UI action must take the user to the affected record without a save/repair.
    await page.evaluate(() => {
      recordIntegrity.status = (k) =>
        k.id === "queue-0"
          ? { valid: false, label: "Synthetic verification failure", eventId: "synthetic", expected: "abc", actual: "def" }
          : window.__r41Saved.proofStatus(k);
      render();
    });
    await page.locator('[data-queue-case="queue-0"] .queue-primary').click();
    await page.getByRole("heading", { name: "Saved work & connection", exact: true }).waitFor();
    assert.equal(await page.locator("#utility-dialog [data-safety-case]").count(), 1);
    await axeScreen(page, "r41-contextual-recovery");
    await page.locator('[data-safety-action="integrity"]').click();
    await page.getByRole("heading", { name: "Record verification details", exact: true }).waitFor();
    await axeScreen(page, "r41-verification-details");
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      WriterState.HELPER = WriterState.HELPER || { ok: true };
      WriterState.RECOVERY.error = "Synthetic automatic backup interruption";
      render();
    });
    await axeScreen(page, "r41-backup-error");
    const backupDetails = page.locator("#recovery-status details");
    await backupDetails.locator("summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await backupDetails.getAttribute("open"), "");
    await page.evaluate(() => {
      recordIntegrity.status = window.__r41Saved.proofStatus;
      WriterState.CASES = [];
      WriterState.DOCS = [];
      WriterState.PENDING = [];
      WriterState.state.caseFilter = "attention";
      render();
    });
    await axeScreen(page, "r41-empty");
    assert.equal(await page.locator("[data-queue-view]").count(), 0);
    fs.writeFileSync(
      path.join(OUT, "r41-queue-results.json"),
      JSON.stringify({ passed: true, layouts: results, staffUsabilityTiming: "Not measured; City inspector sessions remain open." }, null, 2),
    );
    return {
      passed: true,
      layouts: results,
      checks: [
        "32 mixed cases",
        "one primary action",
        "same-source counts and list",
        "single visible filter",
        "search reset",
        "keyboard details",
        "contextual verification recovery",
        "empty workspace",
        "no horizontal overflow",
      ],
    };
  } finally {
    await page.evaluate(() => {
      const s = window.__r41Saved;
      ({
        CASES: WriterState.CASES,
        DOCS: WriterState.DOCS,
        REINSP: WriterState.REINSP,
        EVENTS: WriterState.EVENTS,
        PENDING: WriterState.PENDING,
        RECORD_ATTEMPTS: WriterState.RECORD_ATTEMPTS,
        ARTIFACT_LOCATIONS: WriterState.ARTIFACT_LOCATIONS,
        ARTIFACT_VERIFY: WriterState.ARTIFACT_VERIFY,
        ARTIFACT_IDENTITY: WriterState.ARTIFACT_IDENTITY,
        WORK: WriterState.WORK,
        HELPER: WriterState.HELPER,
        CASEDIR: WriterState.CASEDIR,
        NEEDGRANT: WriterState.NEEDGRANT,
        state: WriterState.state,
        PREFLIGHT_CONFLICT: WriterState.PREFLIGHT_CONFLICT,
        PREFLIGHT_NOTICE: WriterState.PREFLIGHT_NOTICE,
        RECOVERY: WriterState.RECOVERY,
        WORKFLOW_PREFS: WriterState.WORKFLOW_PREFS,
      } = s);
      recordIntegrity.status = s.proofStatus;
      delete window.__r41Saved;
      render();
    });
    await page.setViewportSize(viewport);
  }
};
