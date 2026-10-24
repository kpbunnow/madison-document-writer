/* Production phase-six UI. Synthetic records; storage uses real browser IndexedDB. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, OUT, axeScreen, axeThemes) {
  const viewport = page.viewportSize();
  await page.evaluate(async () => {
    await saveDrafts();
    window.__r46Saved = {
      CASES: WriterState.CASES,
      DOCS: WriterState.DOCS,
      REINSP: WriterState.REINSP,
      EVENTS: WriterState.EVENTS,
      PENDING: WriterState.PENDING,
      WORK: WriterState.WORK,
      state: WriterState.state,
      CASEDIR: WriterState.CASEDIR,
      NEEDGRANT: WriterState.NEEDGRANT,
      HELPER: WriterState.HELPER,
      SAVE_CHECKPOINTS: WriterState.SAVE_CHECKPOINTS,
      LOCAL_SAVE: WriterState.LOCAL_SAVE,
    };
  });
  let restoreContext;
  try {
    await page.evaluate(() => {
      document.querySelectorAll("[data-message-dismiss]").forEach((b) => b.click());
      WriterState.CASES = [
        {
          id: "r46-synthetic",
          number: "QA-R46-INSPECTION",
          address: "4600 SYNTHETIC LANE",
          parcel: "070822219105",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["4600 SYNTHETIC LANE", "MADISON WI 53703"],
          inspectorId: "i4",
          date: addDays(recordDay(today), -30),
          time: "09:00",
          emails: [],
        },
      ];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.WORK = { entry: {}, recordForms: {} };
      WriterState.SAVE_CHECKPOINTS = {};
      WriterState.CASEDIR = null;
      WriterState.NEEDGRANT = false;
      WriterState.HELPER = null;
      WriterState.state = { ...WriterState.state, modal: null, picker: false, publicationBusy: null };
      clearWalk();
      newDoc(WriterState.CASES[0].id, "notice");
      const n = doc(WriterState.state.docId);
      n.items = Array.from({ length: 6 }, (_, i) => ({
        id: "r46-item-" + i,
        no: String(i + 1),
        rootItemId: "r46-root-" + i,
        title: ["Exterior wall", "North entry", "Stair rail", "Interior access", "Previously cleared", "Entered in error"][i],
        text: "Inspect and repair the synthetic condition for item " + (i + 1) + ".",
        sections: ["27.05(2)(c)"],
        due: addDays(recordDay(today), -7),
        done: i === 4,
        doneOn: i === 4 ? addDays(recordDay(today), -10) : "",
        withdrawn: i === 5,
        withdrawalReason: i === 5 ? "Synthetic recording error." : "",
      }));
      const snap = clone(n);
      delete snap.draft;
      snap.status = "Final";
      snap.frozen = freezeSources(n);
      appendEvent(n.caseId, "notice.issued", { docId: n.id, snapshot: snap, expectedHead: recordHead(n.caseId) }, null, "i4");
      WriterState.DOCS = WriterState.DOCS.filter((d) => d.id !== n.id);
      project();
      startReinspection(WriterState.CASES[0].id);
      reinsp(WriterState.state.reinspId).time = "10:15";
      render();
    });
    assert.match(await page.locator(".ri-progress").innerText(), /1 of 5 active items/);
    assert.match(await page.locator(".ri-progress").innerText(), /1 withdrawn/);
    await axeScreen(page, "r46-review-all");
    await axeThemes(page, "r46-review-all");
    await page.screenshot({ path: path.join(OUT, "r46-review-all.png"), fullPage: true });
    await page.locator('[data-riwalk="on"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".ri-item:visible").count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.item), "r46-item-0");
    await axeScreen(page, "r46-current-item");
    await axeThemes(page, "r46-current-item");
    await page.screenshot({ path: path.join(OUT, "r46-current-item.png"), fullPage: true });
    await page.locator(".ri-checks > summary").click();
    const thirdCheck = page.locator(".ri-checks .check-link").filter({ hasText: "Item 3 outcome" });
    await thirdCheck.focus();
    await page.evaluate(() => render());
    assert.equal(await page.locator(".ri-checks").evaluate((el) => el.open), true);
    assert.equal(await thirdCheck.evaluate((el) => document.activeElement === el), true);
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => WriterState.state.riWalk), false);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.item), "r46-item-2");
    assert.equal(await page.locator(".ri-item:visible").count(), 6);
    await axeScreen(page, "r46-inspection-check-focus");
    await page.locator('[data-riwalk="on"]').click();
    await page.keyboard.press("2");
    assert.equal(await page.evaluate(() => reinsp(WriterState.state.reinspId).results["r46-item-0"].oc), "progress");
    await page.locator('[data-setoc="corrected"][data-item="r46-item-1"]').click();
    await page.locator("[data-riwalk-undo]").click();
    assert.equal(await page.evaluate(() => reinsp(WriterState.state.reinspId).results["r46-item-1"]), undefined);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.item), "r46-item-1");
    await page.keyboard.press("1");
    await page.keyboard.press("3");
    await page.locator("#ri-walk-mode").selectOption("details");
    await page.locator('[data-setoc="noaccess"][data-item="r46-item-3"]').click();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.ridate), "r46-item-3");
    await page.locator('[data-rinote="r46-item-3"]').fill("SYNTHETIC access attempt: called owner; locked north unit could not be inspected.");
    assert.equal(await page.evaluate(() => WriterState.state.riWalkItem), "r46-item-3");
    await page.locator("[data-riwalk-next]").click();
    assert.match(await page.locator(".ri-walk-panel").innerText(), /All items have a result/);
    assert.equal(await page.locator(".ri-item:visible").count(), 6);
    await page.locator('[data-riwalk="off"]').click();
    await page.locator('[data-action-group="enforcement"]').check();
    assert.equal(await page.locator("[data-action-type]:disabled").count(), 0);
    assert.equal(await page.locator('[data-action-type="citation"]').count(), 0);
    assert.match(await page.locator(".r26-chooser").innerText(), /Additional scoped documents/);
    await page.locator(".r26-chooser details summary").click();
    assert.match(await page.locator(".r26-chooser details").innerText(), /Select the outstanding items to cite/);
    await axeScreen(page, "r46-actions-and-reasons");
    await axeThemes(page, "r46-actions-and-reasons");
    await page.screenshot({ path: path.join(OUT, "r46-actions-and-reasons.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await axeScreen(page, "r46-review-phone");
    await page.screenshot({ path: path.join(OUT, "r46-review-phone.png"), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.locator('[data-action-type="referral"]').check();
    await page.locator("[data-create-action]").click();
    await page.waitForFunction(() => WriterState.state.screen === "write");
    const draft = await page.evaluate(() => ({ id: WriterState.state.docId, visit: doc(WriterState.state.docId).fromReinspId }));
    await page.locator("#btn-editvisit").click();
    assert.equal(await page.evaluate(() => reinsp(WriterState.state.reinspId).previousDraft.id), draft.id);
    await page.locator("#btn-previousdraft").click();
    assert.equal(await page.evaluate(() => WriterState.state.docId), draft.id);
    await page.locator("#btn-editvisit").click();
    // A real fresh profile restores the saved bundle, reloads, and resumes the same worksheet.
    const bundle = await page.evaluate(async () => {
      await saveDrafts();
      return await idbGet("drafts");
    });
    restoreContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, timezoneId: "America/Chicago" });
    const restored = await restoreContext.newPage();
    await restored.goto(page.url());
    await restored.waitForFunction(() => typeof WriterState.state !== "undefined" && WriterState.WRITER_READY === true);
    await restored.evaluate(async (b) => {
      await idbSet("drafts", b);
    }, bundle);
    await restored.reload();
    await restored.waitForFunction(() => WriterState.WRITER_READY === true && WriterState.REINSP.some((r) => r.caseId === "r46-synthetic"));
    await restored.evaluate(() => startReinspection("r46-synthetic"));
    assert.equal(
      await restored.locator('[data-rinote="r46-item-3"]').inputValue(),
      "SYNTHETIC access attempt: called owner; locked north unit could not be inspected.",
    );
    assert.equal(await restored.evaluate(() => reinsp(WriterState.state.reinspId).id), draft.visit);
    await axeScreen(restored, "r46-restored-worksheet");
    await restored.locator('[data-riwalk="on"]').tap();
    await restored.locator("[data-riwalk-prev]").tap();
    await restored.locator('[data-setoc="none"][data-item="r46-item-3"]').tap();
    assert.equal(await restored.evaluate(() => reinsp(WriterState.state.reinspId).results["r46-item-3"].oc), "none");
    await restored.locator("[data-riwalk-undo]").tap();
    assert.equal(await restored.evaluate(() => reinsp(WriterState.state.reinspId).results["r46-item-3"].oc), "noaccess");
    await axeScreen(restored, "r46-touch-outcome-and-undo");
    await restored.screenshot({ path: path.join(OUT, "r46-touch-outcome-and-undo.png"), fullPage: true });
    await restoreContext.close();
    restoreContext = null;
    // Switch contexts with a stale Undo token: no outcome or focus may cross case identity.
    await page.evaluate(() => {
      window.__r46Visit = WriterState.state.reinspId;
      const a = reinsp(WriterState.state.reinspId);
      WriterState.state.riWalkUndo = { context: walkIdentity(a), itemId: "r46-item-0", before: null, after: clone(a.results["r46-item-0"]) };
      const b = { ...clone(a), id: "r46-other-visit", caseId: "r46-other", sourceDocId: "r46-other-source", results: {} };
      WriterState.CASES.push({ ...clone(WriterState.CASES[0]), id: b.caseId, number: "QA-R46-OTHER" });
      WriterState.DOCS.push({
        ...clone(doc(a.sourceDocId)),
        id: b.sourceDocId,
        caseId: b.caseId,
        items: [{ ...clone(doc(a.sourceDocId).items[0]), id: "r46-other-item" }],
      });
      WriterState.REINSP.push(b);
      WriterState.state.reinspId = b.id;
      WriterState.state.riWalk = true;
      WriterState.state.riWalkContext = walkIdentity(a);
    });
    assert.equal(await page.evaluate(() => undoWalkOutcome()), false);
    assert.deepEqual(await page.evaluate(() => reinsp(WriterState.state.reinspId).results), {});
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.item === "r46-other-item"), false);
    await page.evaluate(() => {
      WriterState.state.reinspId = window.__r46Visit;
      WriterState.state.screen = "reinspect";
      clearWalk();
      render();
      if (WriterState.draftTimer) {
        clearTimeout(WriterState.draftTimer);
        WriterState.draftTimer = null;
      }
      window.__r46Set = idbSet;
      idbSet = async (key, value) => {
        if (key === "drafts") await new Promise((resolve) => (window.__r46Release = resolve));
        return window.__r46Set(key, value);
      };
      window.__r46Saving = saveDrafts();
    });
    await page.waitForFunction(() => typeof window.__r46Release === "function");
    assert.match(await page.locator("#save-status").first().innerText(), /Saving on this device/);
    await axeScreen(page, "r46-pending-device-save");
    await page.screenshot({ path: path.join(OUT, "r46-pending-device-save.png"), fullPage: true });
    // Existing full-browser R26 workflow verifies actual helper publication of compatible documents on one visit.
    const result = {
      passed: true,
      checks: [
        "one visible current item with progress and review all",
        "keyboard pointer and touch outcomes and Undo",
        "no-access contextual details",
        "carried compliance and withdrawn identity",
        "eligible primary and supplemental groups with reasons on demand",
        "phone overflow and themes",
        "document return and retained draft",
        "real IndexedDB fresh profile reload",
        "cross-case stale Undo isolation",
        "truthful pending device save",
      ],
      supplementalPublication: "Real helper publication and single-visit count also verified by browser_r26.js",
    };
    fs.writeFileSync(path.join(OUT, "r46-reinspection-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    if (restoreContext) await restoreContext.close();
    await page.evaluate(async () => {
      if (window.__r46Release) {
        idbSet = window.__r46Set;
        window.__r46Release();
        await window.__r46Saving;
        delete window.__r46Set;
        delete window.__r46Release;
        delete window.__r46Saving;
      }
      if (!window.__r46Saved) return;
      ({
        CASES: WriterState.CASES,
        DOCS: WriterState.DOCS,
        REINSP: WriterState.REINSP,
        EVENTS: WriterState.EVENTS,
        PENDING: WriterState.PENDING,
        WORK: WriterState.WORK,
        state: WriterState.state,
        CASEDIR: WriterState.CASEDIR,
        NEEDGRANT: WriterState.NEEDGRANT,
        HELPER: WriterState.HELPER,
        SAVE_CHECKPOINTS: WriterState.SAVE_CHECKPOINTS,
        LOCAL_SAVE: WriterState.LOCAL_SAVE,
      } = window.__r46Saved);
      delete window.__r46Saved;
      delete window.__r46Visit;
      render();
      await saveDrafts();
    });
    await page.setViewportSize(viewport);
  }
};
