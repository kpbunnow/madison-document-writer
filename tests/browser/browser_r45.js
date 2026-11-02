/* Production import UI with actual XLSX bytes and bounded synthetic lookup/shared responses. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, OUT, axeScreen, axeThemes) {
  const viewport = page.viewportSize();
  const openExcel = async () => {
    if (!(await page.locator(".import-alternative").evaluate((el) => el.open))) await page.locator(".import-alternative > summary").click();
  };
  await page.evaluate(() => {
    window.__r45Saved = {
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
      helperJSON,
      fetch: window.fetch,
      SAVE_CHECKPOINTS: WriterState.SAVE_CHECKPOINTS,
    };
  });
  try {
    await page.evaluate(() => {
      cancelCaseLookup();
      WriterState.CASES = [];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.SAVE_CHECKPOINTS = {};
      WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
      WriterState.state = { ...WriterState.state, screen: "import", acc: null, modal: null, picker: false };
      WriterState.CASEDIR = { helper: true };
      WriterState.NEEDGRANT = false;
      WriterState.HELPER = { ok: true };
      helperJSON = async (route) => (route === "/cases/list" ? { files: [] } : { ok: true });
      render();
      document.querySelectorAll("[data-message-dismiss]").forEach((b) => b.click());
    });
    await page.locator("#lookup-number").fill("CB2026-280-00045");
    await page.locator("#lookup-number").press("ArrowLeft");
    const caret = await page.locator("#lookup-number").evaluate((el) => el.selectionStart);
    await page.evaluate(() => render());
    assert.equal(await page.evaluate(() => document.activeElement.id), "lookup-number");
    assert.equal(await page.locator("#lookup-number").inputValue(), "CB2026-280-00045");
    assert.equal(await page.locator("#lookup-number").evaluate((el) => el.selectionStart), caret);
    await page.locator("#lookup-number").fill("");
    await axeScreen(page, "r45-import-start");
    await page.screenshot({ path: path.join(OUT, "r45-import-start.png"), fullPage: true });
    assert.equal(await page.locator(".import-alternative").evaluate((el) => el.open), false);
    await page.locator(".import-alternative > summary").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".import-alternative").evaluate((el) => el.open), true);
    const upload = async (name) => {
      await openExcel();
      await page.locator("#acc-pick").focus();
      await page.evaluate(() => render());
      assert.equal(await page.locator(".import-alternative").evaluate((el) => el.open), true);
      assert.equal(await page.evaluate(() => document.activeElement.id), "acc-pick");
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.locator("#acc-pick").click()]);
      await chooser.setFiles(path.join(require("path").resolve(__dirname, "../.."), "tests/fixtures/reference/r45-import-fixtures", name + ".xlsx"));
      await page.waitForFunction(() => !!WriterState.state.acc && !WriterState.LOOKUP_BUSY);
    };
    await upload("multiple");
    assert.equal(await page.locator("[data-accsel]").count(), 2);
    assert.equal(await page.evaluate(() => WriterState.state.acc.sel), null);
    assert.equal(await page.locator("#acc-go").isDisabled(), true);
    await axeScreen(page, "r45-multiple-completed");
    await axeThemes(page, "r45-multiple-completed");
    await page.screenshot({ path: path.join(OUT, "r45-multiple-completed.png"), fullPage: true });
    await page.locator("[data-accsel]").first().focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.accsel), "0");
    assert.equal(await page.locator("#acc-go").isDisabled(), false);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await axeScreen(page, "r45-import-phone");
    await page.screenshot({ path: path.join(OUT, "r45-import-phone.png"), fullPage: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.locator("#acc-go").click();
    await page.waitForFunction(() => WriterState.state.screen === "write");
    const draft = await page.evaluate(() => ({
      id: WriterState.state.docId,
      caseId: doc(WriterState.state.docId).caseId,
      time: kase(doc(WriterState.state.docId).caseId).time,
    }));
    assert.equal(draft.time, "");
    await page.locator(".writer-navigation [data-nav=cases]").click();
    await page.waitForFunction(() => WriterState.state.screen === "cases");
    await page.locator(".workspace-start [data-nav=import]").click();
    await openExcel();
    await upload("multiple");
    assert.equal(await page.locator("[data-import-workspace]").innerText(), "Continue existing case");
    await axeScreen(page, "r45-existing-draft");
    await page.screenshot({ path: path.join(OUT, "r45-existing-draft.png"), fullPage: true });
    await page.locator("[data-import-workspace]").click();
    await page.waitForFunction((id) => WriterState.state.screen === "write" && WriterState.state.docId === id, draft.id);
    assert.equal(await page.evaluate(() => WriterState.DOCS.length), 1);
    for (const name of ["scheduled-only", "assist-only", "pending-only"]) {
      await page.locator(".writer-navigation [data-nav=cases]").click();
      await page.waitForFunction(() => WriterState.state.screen === "cases");
      await page.locator(".workspace-start [data-nav=import]").click();
      await page.locator("#acc-cancel").click();
      await openExcel();
      await upload(name);
      assert.match(await page.locator(".acc").innerText(), new RegExp(name.split("-")[0], "i"));
      assert.equal(await page.locator("[data-accsel]").count(), 0);
      await axeScreen(page, "r45-" + name);
      await page.screenshot({ path: path.join(OUT, "r45-" + name + ".png"), fullPage: true });
    }
    await page.locator("#acc-cancel").click();
    await openExcel();
    await upload("snow");
    await page.evaluate(() => {
      WriterState.CASES = [];
      WriterState.DOCS = [];
      WriterState.EVENTS = {};
      render();
    });
    await page.locator("#acc-go").click();
    await page.waitForFunction(() => WriterState.state.screen === "write" && snow.is(doc(WriterState.state.docId)));
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).inspTime), "");
    await axeScreen(page, "r45-snow-blank-time");
    // Fetch ignores abort deliberately to prove result-generation protection.
    await page.locator(".writer-navigation [data-nav=cases]").click();
    await page.waitForFunction(() => WriterState.state.screen === "cases");
    await page.locator(".workspace-start [data-nav=import]").click();
    await page.evaluate(() => {
      window.fetch = async () => await new Promise((r) => (window.__r45Lookup = r));
    });
    await page.locator("#lookup-number").fill("CB2026-280-00046");
    await page.locator("#lookup-form").getByRole("button", { name: "Find Case Inspections", exact: true }).click();
    await page.waitForFunction(() => typeof window.__r45Lookup === "function");
    await page.locator("#lookup-cancel").click();
    await page.locator("[data-nav=cases]").first().click();
    await page.evaluate(() =>
      window.__r45Lookup({ ok: true, json: async () => ({ ok: true, caseNumber: "CB2026-280-00046", source: { kind: "sql" }, rows: [] }) }),
    );
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => WriterState.state.screen), "cases");
    assert.equal(await page.evaluate(() => WriterState.CASES.length), 1);
    const result = {
      passed: true,
      checks: [
        "prominent direct lookup and compact Excel alternative",
        "actual XLSX eligible choice with no arbitrary default",
        "keyboard choice and phone overflow",
        "retained draft opens directly through preflight",
        "Scheduled Assist and Pending explanations",
        "snow import and blank time retained",
        "cancelled late SQL response cannot navigate",
      ],
      nativeCitySQL: false,
    };
    fs.writeFileSync(path.join(OUT, "r45-import-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await page.evaluate(async () => {
      cancelCaseLookup();
      if (!window.__r45Saved) return;
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
        helperJSON,
        SAVE_CHECKPOINTS: WriterState.SAVE_CHECKPOINTS,
      } = window.__r45Saved);
      window.fetch = window.__r45Saved.fetch;
      delete window.__r45Saved;
      delete window.__r45Lookup;
      render();
      await saveDrafts();
    });
    await page.setViewportSize(viewport);
  }
};
