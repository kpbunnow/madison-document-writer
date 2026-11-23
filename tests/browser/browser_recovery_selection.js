/* Real recovery rows and authenticated helper backup reads; synthetic private drafts only. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");

module.exports = async function (browser, hostPage, OUT, axeScreen, axeThemes) {
  const context = await browser.newContext({ timezoneId: "America/Chicago", viewport: { width: 1100, height: 900 } }),
    page = await context.newPage();
  try {
    await page.goto(new URL("/", hostPage.url()).href);
    await page.waitForFunction(() => typeof WriterState !== "undefined" && WriterState.WRITER_READY === true);
    const token = await page.locator('meta[name="docwriter-token"]').getAttribute("content"),
      workspace = "c".repeat(32),
      caseId = "d".repeat(32),
      raw = JSON.stringify({
        workspace,
        case: caseId,
        backup: { format: "madison-draft-recovery", version: 1, workspace, case: caseId, extra: "OVERFLOW" },
      }).replace('"OVERFLOW"', "1e309");
    const refused = await context.request.post(new URL("/draft-backups/write", page.url()).href, {
      data: raw,
      headers: { "X-DocWriter-Token": token, "Content-Type": "application/json", Origin: new URL(page.url()).origin },
    });
    assert.equal(refused.status(), 400, "overflow must be refused before backup creation");
    assert.equal(
      await page.evaluate(
        async ({ workspace, caseId }) =>
          (await helperJSON("/draft-backups/list")).backups.some((r) => r.workspace === workspace && r.case === caseId),
        { workspace, caseId },
      ),
      false,
    );
    const copies = await page.evaluate(async () => {
      const k = {
        id: "recovery-choice",
        number: "QA-RECOVERY-CHOICE",
        address: "100 SYNTHETIC ST",
        owner: "SYNTHETIC OWNER",
        ownerAddr: ["100 TEST ROAD", "MADISON WI 53703"],
        inspectorId: "i4",
        date: recordDay(today),
        time: "09:00",
      };
      WriterState.CASES = [k];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.RECORD_ATTEMPTS = {};
      WriterState.SAVE_CHECKPOINTS = {};
      WriterState.WORK = { entry: {}, recordForms: {} };
      newDoc(k.id, "notice");
      const first = recoverySnapshot(k.id, "f".repeat(32)),
        second = structuredClone(first),
        key = first.bundle.docs[0].id + ":note";
      first.bundle.work.recordForms[key] = { text: "First copy" };
      second.bundle.work.recordForms[key] = { text: "Second copy" };
      const names = [];
      for (const backup of [first, second])
        names.push((await helperJSON("/draft-backups/write", { workspace: backup.workspace, case: backup.case, backup })).name);
      await listRecovery();
      return { first, second, key, names };
    });
    assert.equal(copies.first.at, copies.second.at, "distinct copies intentionally share their displayed timestamp");
    for (const name of copies.names) {
      const index = await page.evaluate((name) => WriterState.RECOVERY.list.findIndex((r) => r.name === name), name);
      assert.ok(index >= 0);
      await page.locator('[data-recovery-row="' + index + '"]').click();
      await page.waitForFunction((name) => WriterState.RECOVERY.selectedRow?.name === name, name);
      assert.equal(await page.locator('[data-recovery-row][aria-pressed="true"]').count(), 1);
      assert.equal(await page.locator('[data-recovery-row][aria-pressed="true"]').getAttribute("data-recovery-row"), String(index));
      await page.waitForFunction((index) => document.activeElement?.dataset.recoveryRow === String(index), index);
    }
    await page
      .locator("#recovery-import")
      .setInputFiles({ name: "recovery.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(copies.second)) });
    await page.waitForFunction(() => !!WriterState.RECOVERY.selectedRow?.imported);
    assert.equal(await page.locator('[data-recovery-row][aria-pressed="true"]').count(), 1);
    assert.equal(await page.locator('[data-recovery-row][aria-pressed="true"]').getAttribute("data-recovery-row"), "0");
    assert.equal(await page.evaluate((key) => WriterState.RECOVERY.selected.bundle.work.recordForms[key].text, copies.key), "Second copy");
    assert.deepEqual(await page.evaluate(() => WriterState.WORK.recordForms), {}, "choosing a copy must not restore it");
    await axeScreen(page, "recovery-file-selection");
    await axeThemes(page, "recovery-file-selection");
    await page.screenshot({ path: path.join(OUT, "recovery-file-selection.png") });
    const result = { passed: true, distinctCopies: 2, equalTimestamps: true, importedSourceSelected: true, overflowRefusedBeforeWrite: true };
    fs.writeFileSync(path.join(OUT, "recovery-file-selection.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await context.close();
  }
};
