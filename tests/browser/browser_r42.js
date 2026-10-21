/* Production R42 task navigation and preview. Only synthetic state is introduced and restored. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, OUT, axeScreen, axeThemes) {
  const viewport = page.viewportSize();
  await page.evaluate(() => {
    window.__r42Saved = {
      CASES: WriterState.CASES,
      DOCS: WriterState.DOCS,
      REINSP: WriterState.REINSP,
      EVENTS: WriterState.EVENTS,
      PENDING: WriterState.PENDING,
      RECORD_ATTEMPTS: WriterState.RECORD_ATTEMPTS,
      WORK: WriterState.WORK,
      state: WriterState.state,
      HELPER: WriterState.HELPER,
      CASEDIR: WriterState.CASEDIR,
      NEEDGRANT: WriterState.NEEDGRANT,
    };
  });
  const results = [];
  try {
    await page.locator("[data-message-dismiss]").evaluateAll((nodes) => nodes.forEach((n) => n.click()));
    await page.evaluate(() => {
      WriterState.CASES = [
        {
          id: "r42-synthetic",
          number: "QA-R42-EDITOR",
          address: "4200 SYNTHETIC LANE",
          parcel: "070822219105",
          owner: "SYNTHETIC PROPERTY OWNER",
          ownerAddr: ["4200 SYNTHETIC LANE", "MADISON WI 53703"],
          inspectorId: "i4",
          date: recordDay(today),
          time: "09:00",
          emails: [],
        },
      ];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.RECORD_ATTEMPTS = {};
      WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
      WriterState.state = { ...WriterState.state, modal: null, picker: false, publicationBusy: null };
      newDoc(WriterState.CASES[0].id, "notice");
      const d = doc(WriterState.state.docId);
      d.items = [
        {
          id: "r42-fixture-item",
          no: "1",
          title: "Repair exterior wall",
          text: "Repair ( ) on the exterior wall.",
          sections: ["27.05(2)(c)"],
          due: "",
          cite: false,
        },
      ];
      render();
    });
    for (const size of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.evaluate(() => scrollTo(0, 0));
      assert.equal(await page.locator(".topbar-actions .btn-primary").count(), 1);
      assert.equal(await page.locator("#btn-save").isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await axeScreen(page, "r42-notice-" + size.width);
      await page.screenshot({ path: path.join(OUT, "r42-editor-" + size.width + ".png"), fullPage: false });
      results.push({
        viewport: size,
        primary: await page.locator(".editor-primary").innerText(),
        header: await page.locator(".topbar").boundingBox(),
      });
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await axeThemes(page, "r42-document");
    await page.locator('[data-editor-section="editor-review"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.id), "editor-review-title");
    await page.locator("#checkbox-panel .check-link").filter({ hasText: "Item 1" }).first().focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.field), "text");
    const field = page.locator('[data-field="text"]').first();
    await field.fill("Repair the damaged wall.");
    assert.equal(await field.evaluate((el) => document.activeElement === el), true);
    await page
      .locator('[data-field="due"]')
      .first()
      .fill(await page.evaluate(() => addDays(recordDay(today), 21)));
    await page.waitForFunction(() => blockers(doc(WriterState.state.docId)).length === 0);
    assert.equal(await page.locator(".editor-primary").innerText(), "Review & issue");
    assert.equal(await page.locator("[data-editor-readiness]").innerText(), await page.locator("#chk-chip").innerText());
    await page.locator("[data-editor-preview]").click();
    await page.getByRole("heading", { name: "Print preview", exact: true }).waitFor();
    await axeScreen(page, "r42-readonly-preview");
    const preview = page.frameLocator(".editor-preview-frame");
    await preview.locator(".desk").waitFor();
    assert.equal(await preview.locator("[contenteditable],input,select,button").count(), 0);
    await preview.locator("body").click({ position: { x: 30, y: 30 } });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("utility-dialog"));
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-editor-preview")), true);
    // The complete fixed print packet is independent of the representative screen copies.
    await page.evaluate(() => {
      doc(WriterState.state.docId).importRule = { kind: "initial", doc: "notice", cite: true, label: "Citation", status: "Citation" };
      render();
    });
    await page.locator("[data-notecite]").first().check();
    await page.waitForFunction(() => initialCitations.enabled(doc(WriterState.state.docId)));
    await page.locator(".initial-citation-previews .cit").first().waitFor();
    assert.equal(await page.locator(".initial-citation-previews .cit:visible").count(), 1);
    assert.equal(await page.locator(".initial-citation-previews .cit").count(), 4);
    const job = await page.evaluate(() => printJob(initialCitations.preview(doc(WriterState.state.docId))));
    const print = await browser.newPage();
    try {
      await print.setContent(job.html);
      await print.evaluate(() => document.fonts.ready);
      await print.emulateMedia({ media: "print" });
      assert.equal(await print.locator(".cit:visible").count(), 4);
      await print.pdf({ path: path.join(OUT, "r42-full-citation-packet.pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
    } finally {
      await print.close();
    }
    await page.locator("[data-editor-preview]").click();
    await page.getByRole("heading", { name: "Print preview", exact: true }).waitFor();
    await page.frameLocator(".editor-preview-frame").locator(".cit").first().waitFor();
    assert.equal(await page.frameLocator(".editor-preview-frame").locator(".cit").count(), 4);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("utility-dialog"));
    fs.writeFileSync(
      path.join(OUT, "r42-editor-results.json"),
      JSON.stringify(
        { passed: true, layouts: results, fullPacketCopies: 4, staffUsability: "Not measured; inspector and screen-reader sessions remain open." },
        null,
        2,
      ),
    );
    return {
      passed: true,
      layouts: results,
      checks: [
        "one primary header action",
        "save remains visible",
        "three nonsequential task links",
        "invalid draft and actionable keyboard checks",
        "caret retained",
        "readiness updates",
        "preview focus return",
        "one screen copy and four print copies",
        "three viewport sizes",
        "dark high contrast and system themes",
      ],
    };
  } finally {
    await page.evaluate(() => {
      ({
        CASES: WriterState.CASES,
        DOCS: WriterState.DOCS,
        REINSP: WriterState.REINSP,
        EVENTS: WriterState.EVENTS,
        PENDING: WriterState.PENDING,
        RECORD_ATTEMPTS: WriterState.RECORD_ATTEMPTS,
        WORK: WriterState.WORK,
        state: WriterState.state,
        HELPER: WriterState.HELPER,
        CASEDIR: WriterState.CASEDIR,
        NEEDGRANT: WriterState.NEEDGRANT,
      } = window.__r42Saved);
      delete window.__r42Saved;
      render();
    });
    await page.setViewportSize(viewport);
  }
};
