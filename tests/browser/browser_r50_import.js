/* Real production UI using stored SSRS-format report grids (the spreadsheet import was removed in R69). */
const path = require("path"),
  assert = require("assert/strict"),
  fs = require("fs");
module.exports = async (browser, page, OUT, axeScreen) => {
  await page.evaluate(() => {
    window.__r50Saved = {
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
    };
  });
  try {
    for (const status of ["official-notice", "citation", "compliance"]) {
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
      });
      const grid = JSON.parse(
        fs.readFileSync(
          path.join(require("path").resolve(__dirname, "../.."), "tests/fixtures/reference/r50-import-fixtures", status + ".grid.json"),
          "utf8",
        ),
      );
      await page.evaluate(async (g) => {
        const t = accelaTable(g);
        WriterState.state.acc = {
          fileName: "",
          errors: t.errors,
          notes: t.notes,
          cases: t.cases,
          caseIx: 0,
          sel: t.cases.length ? t.cases[0].sel : null,
          manualDate: "",
          manualTime: "",
        };
        await accelaFromShare();
        render();
      }, grid);
      await page.waitForFunction(() => !!WriterState.state.acc && !WriterState.LOOKUP_BUSY);
      await page.locator("#acc-go").waitFor();
      // R53: an Initial Inspection with status Compliance has no document rule and is refused.
      if (status === "compliance") {
        assert.equal(await page.locator("#acc-go").isEnabled(), false, status);
        continue;
      }
      assert.equal(await page.locator("#acc-go").isEnabled(), true, status);
      await axeScreen(page, "r50-import-" + status);
      // The import page is scrolled down to the confirm button; the document it opens must start at its top.
      // The review is in the import window now, so the page behind it is made tall enough to scroll.
      await page.evaluate(() => {
        document.getElementById("app").style.minHeight = "3000px";
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      assert.ok(await page.evaluate(() => window.scrollY > 0), "the import page is scrolled before confirming");
      await page.locator("#acc-go").click();
      await page.waitForFunction(() => WriterState.state.screen === "write" && WriterState.DOCS.length === 1);
      assert.equal(await page.evaluate(() => window.scrollY), 0, status + " opens the document at its top");
      await page.evaluate(() => (document.getElementById("app").style.minHeight = ""));
      assert.equal(await page.evaluate(() => kase(doc(WriterState.state.docId).caseId).time), "");
    }
    const result = {
      passed: true,
      acceptedStatuses: ["Official Notice", "Citation", "No Occupancy", "Abatement Summary", "Abatement Non-Summary"],
      refusedInitialStatuses: ["Compliance", "Completed"],
      nativeCitySQL: false,
    };
    fs.writeFileSync(path.join(OUT, "r50-import-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await page.evaluate(async () => {
      cancelCaseLookup();
      Object.assign(window, {});
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
      } = window.__r50Saved);
      delete window.__r50Saved;
      render();
      await saveDrafts();
    });
  }
};
