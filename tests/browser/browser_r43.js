/* Production R43 charge cards; synthetic state is restored after the test. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, OUT, axeScreen, axeThemes) {
  const viewport = page.viewportSize();
  await page.evaluate(() => {
    window.__r43Saved = {
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
  const layouts = [];
  try {
    await page.evaluate(() => {
      WriterState.HELPER = null;
      WriterState.CASEDIR = null;
      WriterState.NEEDGRANT = false;
      WriterState.CASES = [
        {
          id: "r43-case",
          number: "QA-R43-REVIEW",
          address: "4300 SYNTHETIC LANE",
          parcel: "070822219105",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["4300 SYNTHETIC LANE", "MADISON WI 53703"],
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
      d.items = ["27.05(2)(c)", "29.40(4)(b)", "SPS321.125", "SPS999.99", "23.45"].map((ord, n) => ({
        id: "r43-" + n,
        no: String(n + 1),
        title: [
          "Exterior wall maintenance",
          "Building tune-up",
          "Approved manual basis needed",
          "Additional incomplete charge",
          "Mandatory appearance",
        ][n],
        text: "Correct the observed condition.",
        sections: [ord],
        cite: true,
        due: addDays(recordDay(today), 21),
      }));
      initialCitations.prepare(d);
      render();
      document.querySelectorAll("[data-message-dismiss]").forEach((b) => b.click());
    });
    assert.equal(await page.locator("#r31-deposit-dialog").count(), 0);
    assert.equal(await page.locator("[data-charge]").count(), 5);
    assert.equal(await page.locator("[data-deposit-request]").count(), 3);
    assert.equal(await page.locator('[data-charge="r43-4"] .charge-result strong').innerText(), "Mandatory appearance");
    for (const size of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.locator("#citation-review").scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await axeScreen(page, "r43-charge-review-" + size.width);
      await page.screenshot({ path: path.join(OUT, "r43-review-" + size.width + ".png"), fullPage: true });
      layouts.push({
        viewport: size,
        automaticVisibleInputs: await page.locator('[data-charge="r43-0"] input:visible,[data-charge="r43-0"] select:visible').count(),
        card: await page.locator('[data-charge="r43-0"]').boundingBox(),
      });
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await axeThemes(page, "r43-charge-review");
    const measured = page.locator('[data-deposit-form="r43-1"]');
    await measured.locator("[name=measure-area]").fill("200000");
    await measured.locator("[name=measure-days]").fill("400");
    await measured.getByRole("button", { name: "Complete charge", exact: true }).click();
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).cits["r43-1"].amount), "12761.00");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.charge), "r43-1");
    assert.equal(await page.locator("[data-deposit-request]").count(), 2);
    assert.equal(await page.locator("#r31-deposit-dialog").count(), 0);
    const manual = page.locator('[data-deposit-form="r43-2"]');
    await manual.locator("[name=depositMode]").selectOption("total");
    assert.equal(await manual.locator("[name=base]").isVisible(), false);
    await manual.locator("[name=amount]").fill("245.67");
    await manual.locator("[name=depositSource]").fill("short");
    await page.evaluate(async () => {
      await saveDrafts();
    });
    const persisted = await page.evaluate(async () => {
      const saved = await idbGet("drafts");
      return saved.docs.find((d) => d.id === WriterState.state.docId).depositRequests["r43-2"];
    });
    assert.equal(persisted.amount, "245.67");
    assert.equal(persisted.depositSource, "short");
    await page.evaluate(() => render());
    assert.equal(await manual.locator("[name=amount]").inputValue(), "245.67");
    assert.equal(await manual.locator("[name=depositSource]").inputValue(), "short");
    await manual.locator("[name=depositSource]").fill("Synthetic court approved total, including assessments.");
    await manual.getByRole("button", { name: "Complete charge", exact: true }).click();
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).cits["r43-2"].amount), "245.67");
    const charge = page.locator('[data-charge="r43-2"]');
    await charge.locator("[data-review-details=charge] summary").focus();
    await page.keyboard.press("Enter");
    const ord = charge.locator('[data-review-cit$="|ord"]');
    await ord.fill("");
    await ord.pressSequentially("SPS 321.125");
    assert.equal(await ord.evaluate((el) => el === document.activeElement), true);
    await page.locator("#citation-review h2").click();
    assert.equal(
      await page.evaluate(() => doc(WriterState.state.docId).cits["r43-2"].depositSource),
      "Synthetic court approved total, including assessments.",
    );
    assert.equal(await charge.locator("[data-review-details=charge]").evaluate((el) => el.open), true);
    await axeScreen(page, "r43-completed-and-held-charges");
    assert.equal(await page.locator("#btn-final").innerText(), "Review held draft");
    assert.equal(await page.locator("[data-editor-preview]").isDisabled(), true);
    assert.equal(await page.locator('[data-charge="r43-4"] [data-deposit-request]').count(), 0);
    await page.evaluate(() => {
      const d = doc(WriterState.state.docId);
      d.draft = false;
      d.status = "Final";
      render();
    });
    await page.locator(".editor-more summary").click();
    await page.locator("#btn-savecase").focus();
    await page.evaluate(() => render());
    assert.equal(await page.locator(".editor-more").evaluate((el) => el.open), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "btn-savecase");
    await page.locator(".editor-more summary").focus();
    await page.evaluate(() => render());
    assert.equal(await page.locator(".editor-more summary").evaluate((el) => el === document.activeElement), true);
    await axeScreen(page, "r43-document-actions-retained");
    const result = {
      passed: true,
      layouts,
      checks: [
        "five mixed charge cards",
        "no automatic completion dialog",
        "inline measured and approved-total paths",
        "invalid partial approval persisted to IndexedDB",
        "remaining incomplete charge preserved",
        "completion focus retained",
        "equivalent ordinance preserves approval",
        "mandatory wording hold distinct from deposit",
        "keyboard disclosures and all themes",
        "late filing refresh retains document actions and focus",
      ],
      nativeCityAcceptance: false,
    };
    fs.writeFileSync(path.join(OUT, "r43-review-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await page.evaluate(async () => {
      if (!window.__r43Saved) return;
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
      } = window.__r43Saved);
      delete window.__r43Saved;
      render();
      await saveDrafts();
    });
    await page.setViewportSize(viewport);
  }
};
