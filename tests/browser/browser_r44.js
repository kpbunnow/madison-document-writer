/* Production saved-work panel: mixed healthy and degraded work, without replacing reliability owners. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, OUT, axeScreen, axeThemes) {
  const viewport = page.viewportSize();
  await page.evaluate(() => {
    window.__r44Saved = {
      CASES: WriterState.CASES,
      DOCS: WriterState.DOCS,
      REINSP: WriterState.REINSP,
      EVENTS: WriterState.EVENTS,
      PENDING: WriterState.PENDING,
      RECORD_ATTEMPTS: WriterState.RECORD_ATTEMPTS,
      SAVE_CHECKPOINTS: WriterState.SAVE_CHECKPOINTS,
      WORK: WriterState.WORK,
      state: WriterState.state,
      HELPER: WriterState.HELPER,
      CASEDIR: WriterState.CASEDIR,
      NEEDGRANT: WriterState.NEEDGRANT,
      LOCAL_SAVE: WriterState.LOCAL_SAVE,
      RECOVERY: WriterState.RECOVERY,
      PREFLIGHT_CONFLICT: WriterState.PREFLIGHT_CONFLICT,
      helperJSON,
      idbSet,
    };
  });
  try {
    await page.evaluate(async () => {
      WriterState.CASES = [
        {
          id: "r44-local",
          number: "QA-R44-LOCAL",
          address: "4400 SYNTHETIC LANE",
          owner: "SYNTHETIC OWNER",
          date: recordDay(today),
          time: "09:00",
          inspectorId: "i4",
        },
        {
          id: "r44-pending",
          number: "QA-R44-CONFIRM",
          address: "4401 SYNTHETIC LANE",
          owner: "SYNTHETIC OWNER",
          date: recordDay(today),
          time: "09:00",
          inspectorId: "i4",
        },
      ];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.RECORD_ATTEMPTS = {};
      WriterState.SAVE_CHECKPOINTS = {};
      WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
      WriterState.state = { ...WriterState.state, screen: "tools", modal: null, picker: false, publicationBusy: null };
      WriterState.HELPER = { ok: true };
      WriterState.CASEDIR = { helper: true };
      WriterState.NEEDGRANT = false;
      helperJSON = async (route) => {
        if (route === "/dw-status") return { ok: true, caseReachable: true, outbox: 0 };
        if (route === "/outbox/list") return { files: [] };
        throw Error("Synthetic unavailable operation");
      };
      newDoc("r44-local", "notice");
      await saveDrafts();
      newDoc("r44-pending", "notice");
      await saveDrafts();
      const d = doc(WriterState.state.docId);
      d.pendingAmendment = { id: "r44-retained-request", type: "document.issued", payload: { docId: d.id } };
      WriterState.state.screen = "tools";
      render();
      document.querySelectorAll("[data-message-dismiss]").forEach((b) => b.click());
    });
    assert.equal(await page.locator(".tools-section [data-outbox]").count(), 0);
    await page.locator(".tool-action[data-sync-safety]").click();
    await page.locator("[data-saved-work-panel]").waitFor();
    assert.equal(await page.locator('[data-safety-case="r44-pending"]').getAttribute("data-safety-action"), "pending");
    assert.equal(await page.locator('[data-safety-case="r44-local"]').getAttribute("data-safety-action"), "document");
    await axeScreen(page, "r44-saved-work");
    await axeThemes(page, "r44-saved-work");
    await page.screenshot({ path: path.join(OUT, "r44-saved-work.png"), fullPage: true });
    await page.locator("[data-saved-detail=recovery] > summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#btn-recovery").isVisible(), true);
    await axeScreen(page, "r44-backups-recovery");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await axeScreen(page, "r44-saved-work-phone");
    await page.screenshot({ path: path.join(OUT, "r44-saved-work-phone.png"), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.locator("[data-utility-close]").click();
    await page.evaluate(() => {
      WriterState.LOCAL_SAVE = { ok: false, at: "", saving: false };
      WriterState.PENDING = [{ cid: "outside-loaded-cases", name: "QA-R44-QUEUED.json", body: "{}" }];
      WriterState.CASEDIR = null;
      helperJSON = async () => {
        throw Error("Synthetic share unavailable");
      };
      render();
    });
    await page.locator(".tool-action[data-sync-safety]").click();
    await page.locator("[data-safety-local]").waitFor();
    assert.match(await page.locator("[data-device-save]").innerText(), /Not saved/);
    assert.match(await page.locator("[data-saved-work-panel]").innerText(), /Outbox count not checked/);
    assert.equal(await page.locator('[data-safety-case="r44-pending"]').getAttribute("data-safety-action"), "pending");
    await page.locator("[data-saved-detail=queued] summary").click();
    await page.locator("[data-saved-detail=diagnostics] summary").click();
    await axeScreen(page, "r44-storage-failure-offline-queue");
    await axeThemes(page, "r44-storage-failure-offline-queue");
    // Device-save failure does not mutate the retained issuance identity.
    const retained = await page.evaluate(() => JSON.stringify(docsFor("r44-pending")[0].pendingAmendment));
    await page.evaluate(() => {
      idbSet = async () => true;
    });
    await page.locator("[data-safety-local]").click();
    await page.waitForFunction(() => WriterState.LOCAL_SAVE.ok && !WriterState.LOCAL_SAVE.saving);
    assert.equal(await page.evaluate(() => JSON.stringify(docsFor("r44-pending")[0].pendingAmendment)), retained);
    assert.match(await page.locator("[data-device-save]").innerText(), /Saved on this device/);
    // The saved-work pane must not overwrite a newer task after a slow health read.
    await page.evaluate(() => {
      helperJSON = async () => await new Promise((resolve) => (window.__r44Health = resolve));
      window.__r44Show = showSafety();
    });
    await page.locator("[data-saved-detail=recovery] > summary").click();
    await page.locator("#btn-recovery").focus();
    await page.evaluate(async () => {
      window.__r44Health({ ok: true, caseReachable: false, outbox: 0 });
      await window.__r44Show;
    });
    assert.equal(await page.locator("[data-saved-detail=recovery]").evaluate((el) => el.open), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "btn-recovery");
    await page.evaluate(() => {
      WriterState.RECOVERY = { ...WriterState.RECOVERY, at: nowISO(), error: "" };
      window.__r44Show = showSafety();
    });
    await page.locator("[data-saved-detail=recovery] > summary").click();
    await page.locator("[data-saved-detail=automatic-backup] > summary").focus();
    await page.keyboard.press("Enter");
    await page.evaluate(async () => {
      window.__r44Health({ ok: true, caseReachable: false, outbox: 0 });
      await window.__r44Show;
    });
    assert.equal(await page.locator("[data-saved-detail=automatic-backup]").evaluate((el) => el.open), true);
    assert.equal(await page.locator("[data-saved-detail=automatic-backup] > summary").evaluate((el) => el === document.activeElement), true);
    await axeScreen(page, "r44-late-health-disclosure-focus");
    await page.locator("[data-utility-close]").click();
    await page.evaluate(async () => {
      helperJSON = async (route) =>
        route === "/dw-status" ? { ok: true, caseReachable: true, outbox: 0 } : route === "/outbox/list" ? { files: [] } : {};
      await showSafety();
    });
    await page.locator("[data-outbox]").click();
    await page.locator("#outbox-form").waitFor();
    await page.evaluate(() => toast("Synthetic PDF conflict. Original retained in the outbox.", { severity: "error" }));
    await page.waitForTimeout(30);
    assert.equal(await page.locator("#utility-dialog [role=alert]").filter({ hasText: "Synthetic PDF conflict" }).count(), 1);
    assert.equal(await page.locator("#toast [data-message]").filter({ hasText: "Synthetic PDF conflict" }).count(), 0);
    await axeScreen(page, "r44-empty-outbox");
    await page.locator("[data-sync-safety]").last().click();
    await page.locator("[data-saved-work-panel]").waitFor();
    // Existing storage dialog is reached without leaving a native modal above it.
    await page.locator("[data-saved-detail=diagnostics] summary").click();
    await page.locator("#btn-storage").click();
    await page.locator("#utility-dialog").waitFor({ state: "detached" });
    assert.equal(await page.locator("#utility-dialog").count(), 0);
    assert.equal(await page.locator("#overlay [role=dialog]").count(), 1);
    await axeScreen(page, "r44-storage-diagnostics");
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      A11Y.notify("Synthetic R44 persistent warning", { severity: "warning" });
      A11Y.notify("Synthetic R44 persistent warning", { severity: "warning" });
    });
    await page.waitForTimeout(30);
    assert.equal(await page.locator("[data-message]").filter({ hasText: "Synthetic R44 persistent warning" }).count(), 1);
    const result = {
      passed: true,
      checks: [
        "one saved-work Tools entry",
        "device/shared/PDF states separate",
        "uncertain save original identity preserved",
        "offline queued files discoverable",
        "outbox unknown differs from empty",
        "storage failure backup and retry",
        "late health preserves keyboard focus and disclosure",
        "mobile and all themes",
        "diagnostics do not stack dialogs",
        "persistent warnings deduplicated",
      ],
      nativeCityAcceptance: false,
    };
    fs.writeFileSync(path.join(OUT, "r44-saved-work-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await page.evaluate(async () => {
      document.getElementById("utility-dialog")?.close();
      if (!window.__r44Saved) return;
      ({
        CASES: WriterState.CASES,
        DOCS: WriterState.DOCS,
        REINSP: WriterState.REINSP,
        EVENTS: WriterState.EVENTS,
        PENDING: WriterState.PENDING,
        RECORD_ATTEMPTS: WriterState.RECORD_ATTEMPTS,
        SAVE_CHECKPOINTS: WriterState.SAVE_CHECKPOINTS,
        WORK: WriterState.WORK,
        state: WriterState.state,
        HELPER: WriterState.HELPER,
        CASEDIR: WriterState.CASEDIR,
        NEEDGRANT: WriterState.NEEDGRANT,
        LOCAL_SAVE: WriterState.LOCAL_SAVE,
        RECOVERY: WriterState.RECOVERY,
        PREFLIGHT_CONFLICT: WriterState.PREFLIGHT_CONFLICT,
        helperJSON,
        idbSet,
      } = window.__r44Saved);
      delete window.__r44Saved;
      delete window.__r44Health;
      delete window.__r44Show;
      render();
      await saveDrafts();
    });
    await page.setViewportSize(viewport);
  }
};
