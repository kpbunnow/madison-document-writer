/* R62 in real Chromium: greyed unavailable import results, authoring-16 notes under the violation with long-note
   pagination, and the authoring-16 Vacancy Extension editor and print. Synthetic only. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path");
const { execFileSync } = require("child_process");
module.exports = async function (browser, hostPage, OUT, axeScreen) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1100 }, timezoneId: "America/Chicago" });
  const page = await context.newPage(),
    print = await context.newPage();
  const noOverflow = async () => {
    for (const overflow of await print
      .locator(".sheet")
      .evaluateAll((es) => es.map((e) => e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2)))
      assert.equal(overflow, false, "every page keeps its content inside the sheet");
  };
  try {
    await page.goto(new URL("/", hostPage.url()).href);
    await page.waitForFunction(() => typeof WriterState !== "undefined");
    // 1. Import review: hidden rows are absent; another pair is listed greyed with its reason.
    await page.evaluate(() => {
      WriterState.CASES = [];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.CASEDIR = null;
      WriterState.NEEDGRANT = false;
      const row = {
        CaseNumber: "QA-R62-IMPORT",
        SiteAddress: "6201 SYNTHETIC LANE, MADISON WI 53703",
        ParcelNumber: "070913125237",
        OwnerName: "SYNTHETIC OWNER",
        OwnerAddress: "6201 SYNTHETIC LANE\nMADISON WI 53703",
        CaseDescription: "Complaint",
        HistoricDistrict: "No",
        HistoricDistrictName: "",
        IndividualLandmark: "No",
        Landmark: "",
        InspectionDate: "2026-09-10",
        InspectionType: "Initial Inspection",
        InspectionStatus: "Official Notice",
        InspectionTime: "09:05",
        InspectorName: INSPECTORS[0].name,
      };
      WriterState.state.screen = "import";
      WriterState.state.acc = sqlReport(
        {
          ok: true,
          rows: [
            row,
            { ...row, InspectionDate: "2026-09-11", InspectionStatus: "Compliance" },
            { ...row, InspectionDate: "2026-09-12", InspectionStatus: "Pending" },
            { ...row, InspectionDate: "2026-09-13", InspectionStatus: "No Entry" },
          ],
          caseNumber: "QA-R62-IMPORT",
          source: { kind: "sql", retrievedAt: new Date().toISOString() },
        },
        "QA-R62-IMPORT",
      );
      WriterState.state.acc.sel = WriterState.state.acc.cases[0].sel;
      render();
    });
    assert.equal(await page.locator(".import-unavailable").count(), 1);
    assert.match(await page.locator(".import-unavailable").innerText(), /Not available: Initial Inspection status "Compliance" has no document rule/);
    assert.equal(await page.locator('.import-unavailable[aria-disabled="true"] button').count(), 0);
    assert.ok(!(await page.locator(".acc").innerText()).includes("Pending"), "hidden rows are absent");
    await axeScreen(page, "r62-import-unavailable");
    await page.screenshot({ path: path.join(OUT, "r62-import-unavailable.png"), fullPage: true });

    // 2. An authoring-16 referral: notes print under the violation; a long note continues across pages, once.
    const words = Array.from({ length: 450 }, (_, n) => "finding-" + n);
    const job = await page.evaluate((words) => {
      WriterState.state.acc = null;
      WriterState.CASES = [
        {
          id: "k1",
          number: "QA-R62",
          address: "100 SYNTHETIC AVENUE",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["100 TEST ROAD", "MADISON WI 53703"],
          inspectorId: INSPECTORS[0].id,
          date: "2026-03-01",
          time: "09:00",
          emails: [],
        },
      ];
      newDoc("k1", "notice");
      const d = doc(WriterState.state.docId);
      d.type = "referral";
      d.items = [
        {
          id: "long",
          no: "1",
          text: "Repair the synthetic condition.",
          sections: ["27.05(2)(c)"],
          abate: false,
          hist: [
            { on: "2026-03-01", oc: "initial" },
            { on: "2026-03-09", oc: "none", note: words.join(" ") },
            { on: "2026-03-14", oc: "progress", note: "Second observation." },
          ],
        },
        {
          id: "done",
          no: "2",
          text: "Replace the synthetic fixture.",
          sections: ["27.05(2)(c)"],
          abate: false,
          done: true,
          doneOn: "2026-03-14",
          hist: [
            { on: "2026-03-01", oc: "initial" },
            { on: "2026-03-14", oc: "corrected", note: "Corrected-item note." },
          ],
        },
      ];
      WriterState.state.screen = "write";
      render();
      return printJob(d);
    }, words);
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).authoringVersion), 16);
    await axeScreen(page, "r62-referral-notes");
    await print.setContent(job.html);
    await print.emulateMedia({ media: "print" });
    assert.ok((await print.locator(".sheet").count()) > 1, "the long note continues onto another page");
    assert.equal(await print.locator(".visit-list em").filter({ hasText: "Note:" }).count(), 0, "no note in the history column");
    const printed = (await print.locator("[data-history-note]").allTextContents()).join(" ");
    assert.deepEqual(printed.match(/finding-\d+/g), words, "every word of the long note prints once, in order");
    assert.ok(printed.includes("Second observation.") && printed.includes("Corrected-item note."));
    assert.equal(
      await print
        .locator("tr.done [data-history-note]")
        .evaluateAll((els) => els.every((el) => getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0)),
      true,
      "the corrected item's note prints",
    );
    await noOverflow();
    const referralPdf = path.join(OUT, "r62-referral-notes.pdf");
    await print.pdf({ path: referralPdf, format: "Letter", printBackground: true, preferCSSPageSize: true });
    const pdfText = execFileSync("pdftotext", [referralPdf, "-"], { encoding: "utf8" }).replace(/\s+/g, " ");
    assert.ok(pdfText.includes("Corrected-item note.") && pdfText.includes("finding-449"));

    // 3. An authoring-16 Vacancy Extension: Scope and review date only, no due dates, no signer.
    const vacancy = await page.evaluate(() => {
      const d = doc(WriterState.state.docId);
      d.type = "vacancyExtension";
      d.items = d.items.map((i) => ({ ...i, hist: null, due: i.done ? "2026-03-01" : "" }));
      d.special = {
        affected: ["1"],
        originalDues: { 1: "2026-03-01", 2: "2026-03-01" },
        scope: "unit",
        unit: "2",
        reviewDate: addDays(recordDay(today), 14),
      };
      d.mailed = recordDay(today);
      render();
      return { job: printJob(d), blockers: blockers(d).map((b) => b.t) };
    });
    assert.ok(!vacancy.blockers.some((t) => /review inspection|scope|unit identifier|due date/.test(t)), JSON.stringify(vacancy.blockers));
    assert.deepEqual((await page.locator("#r26-details [data-special]").evaluateAll((els) => els.map((el) => el.dataset.special))).sort(), [
      "reviewDate",
      "scope",
      "unit",
    ]);
    await axeScreen(page, "r62-vacancy-extension");
    await print.setContent(vacancy.job.html);
    await print.emulateMedia({ media: "print" });
    assert.equal(await print.locator(".extension-signer").count(), 0);
    const text = await print.locator("body").innerText();
    assert.ok(text.includes("we grant an extension for the uncorrected item(s)."));
    assert.ok(!text.includes("◯"));
    await noOverflow();
    await print.pdf({ path: path.join(OUT, "r62-vacancy-extension.pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
    const results = { passed: true, longNoteWords: words.length, correctedItemNotePrinted: true, vacancySigner: false };
    fs.writeFileSync(path.join(OUT, "r62-results.json"), JSON.stringify(results, null, 2));
    return results;
  } finally {
    await context.close();
  }
};
