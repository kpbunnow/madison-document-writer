/* R60 real dialog keyboard behavior, address flow, referral pagination and complete citation PDFs. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path");
const { execFileSync } = require("child_process");
module.exports = async function (browser, hostPage, OUT, axeScreen) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1100 }, timezoneId: "America/Chicago" });
  const page = await context.newPage(),
    printPage = await context.newPage();
  try {
    await page.goto(new URL("/", hostPage.url()).href);
    await page.waitForFunction(() => typeof WriterState !== "undefined");
    await page.evaluate(() => {
      WriterState.CASES = [
        {
          id: "k1",
          number: "QA-R60",
          address: "100 SYNTHETIC AVENUE",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["100 TEST ROAD", "Madison, WI 53703"],
          ownerCity: "Madison, WI 53703",
          inspectorId: INSPECTORS[0].id,
          date: "2026-03-07",
          time: "09:00",
          parcel: "070822219105",
          emails: [],
        },
      ];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.CASEDIR = null;
      WriterState.NEEDGRANT = false;
      WriterState.state.screen = "cases";
      render();
    });
    assert.equal(await page.locator('.writer-navigation [data-nav="import"]').count(), 0);
    await axeScreen(page, "r60-workspace-start");
    await page.evaluate(() => {
      newDoc("k1", "notice");
      const d = doc(WriterState.state.docId);
      d.items = [{ id: "a", no: "1", title: "Wall", text: "Repair ( ) on the wall.", sections: ["27.05(2)(c)"], due: "2026-11-30" }];
      render();
    });
    await page.locator(".blank-edit").focus();
    await page.keyboard.press("Enter");
    await page.locator("#corrective-detail").fill("the damaged surface");
    await axeScreen(page, "r60-corrective-detail-dialog");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#utility-dialog").count(), 0);
    assert.equal(await page.locator(".blank-edit").evaluate((el) => el === document.activeElement), true);
    await page.keyboard.press("Enter");
    await page.locator("#corrective-detail").fill("the damaged surface");
    await page.locator("#corrective-detail-form button").click();
    assert.equal(await page.locator('[data-field="text"]').innerText(), "Repair the damaged surface on the wall.");
    await page.evaluate(() => {
      const d = doc(WriterState.state.docId);
      d.type = "referralUpdate";
      d.authoringVersion = 14;
      d.items[0].hist = [
        { on: "2026-03-07", oc: "initial" },
        { on: "2026-03-09", oc: "still" },
        { on: "2026-03-14", oc: "corrected" },
      ];
      d.items[0].done = true;
      d.items[0].doneOn = "2026-03-14";
      render();
    });
    for (const zoom of [1, 1.25, 1.5, 2]) {
      await page.evaluate((zoom) => (document.body.style.zoom = zoom), zoom);
      const geometry = await page
        .locator(".sheet:not(.cont)")
        .first()
        .evaluate((el) => {
          const h = el.querySelector(".n-head").getBoundingClientRect(),
            a = el.querySelector(".n-owner").getBoundingClientRect();
          return { head: h.bottom, address: a.top };
        });
      assert.ok(geometry.address >= geometry.head + 4, "address clears header at zoom " + zoom + ": " + JSON.stringify(geometry));
    }
    await page.evaluate(() => (document.body.style.zoom = ""));
    await axeScreen(page, "r60-referral-history-editor");
    // One long item history must remain a valid printable table, including corrected history and duration.
    const historyJob = await page.evaluate(() => {
      const d = doc(WriterState.state.docId);
      d.items = Array.from({ length: 12 }, (_, n) => ({ ...clone(d.items[0]), id: "history-" + n, no: String(n + 1) }));
      return printJob(d);
    });
    await printPage.setContent(historyJob.html);
    await printPage.emulateMedia({ media: "print" });
    assert.equal(await printPage.locator(".c-due").filter({ hasText: "Days Outstanding: 7" }).count(), 12);
    for (const clipped of await printPage
      .locator(".sheet")
      .evaluateAll((els) => els.map((el) => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)))
      assert.equal(clipped, false);
    const longJob = await page.evaluate(() => {
      const d = doc(WriterState.state.docId);
      const it = clone(d.items[0]);
      it.id = "long-history";
      it.done = false;
      it.doneOn = "";
      it.hist = Array.from({ length: 45 }, (_, n) => ({
        on: addDays("2026-03-01", n),
        oc: n ? "none" : "initial",
        note: "Synthetic observation " + (n + 1),
      }));
      d.items = [it];
      return printJob(d);
    });
    await printPage.setContent(longJob.html);
    assert.ok((await printPage.locator(".sheet").count()) > 1, "one long item history continues onto another page");
    const longText = await printPage.locator("body").innerText();
    for (let n = 1; n <= 45; n++) assert.ok(longText.includes("Synthetic observation " + n), "retained observation " + n);
    assert.match(longText, /Days Outstanding: 44/);
    for (const clipped of await printPage
      .locator(".sheet")
      .evaluateAll((els) => els.map((el) => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)))
      assert.equal(clipped, false, "long history stays inside each page");
    // Initial and reinspection final packet paths must both retain four distinct approved copies per charge.
    const packets = [];
    for (const reinspection of [false, true])
      for (const charges of [1, 2]) {
        const job = await page.evaluate(
          ({ reinspection, charges }) => {
            WriterState.DOCS = [];
            WriterState.REINSP = [];
            newDoc("k1", "notice");
            const d = doc(WriterState.state.docId);
            d.type = "citation";
            if (reinspection) d.fromReinspId = "qa-visit";
            else d.issuanceGroup = { id: "qa-group", noticeId: "qa-notice", citationId: d.id };
            d.items = Array.from({ length: charges }, (_, n) => ({
              id: "charge-" + n,
              no: String(n + 1),
              title: "Wall",
              text: "Repair wall.",
              sections: ["27.05(2)(c)"],
              cite: true,
            }));
            d.cits = {};
            for (const it of d.items) {
              d.cits[it.id] = {
                num: "B9000000000" + it.no,
                ord: "27.05(2)(c)",
                desc: "SYNTHETIC WALL",
                issued: "2026-10-22",
                courtDate: "2026-12-08",
                courtTime: "08:30",
                comment: "Synthetic inspection narrative.",
                depositMode: "schedule",
              };
              applyDeposit(d, it.id, "27.05(2)(c)");
            }
            d.draft = false;
            d.status = "Final";
            d.frozen = freezeSources(d);
            render();
            return printJob(d);
          },
          { reinspection, charges },
        );
        await printPage.setContent(job.html);
        await printPage.emulateMedia({ media: "print" });
        const faces = await printPage.locator(".cit").allTextContents();
        assert.equal(faces.length, charges * 4);
        for (let n = 0; n < charges; n++) {
          assert.match(faces[n * 4], /COURT COPY/);
          assert.match(faces[n * 4 + 1], /AGENCY COPY/);
          assert.match(faces[n * 4 + 2], /INSPECTOR COPY/);
          assert.match(faces[n * 4 + 3], /DEFENDANT'S COPY/);
          assert.match(faces[n * 4 + 1], /AGENCY RECORD/);
          assert.match(faces[n * 4 + 2], /INSPECTOR RECORD/);
          assert.match(faces[n * 4 + 3], /IF YOU WANT TO PLEAD NOT GUILTY/);
        }
        const pdf = path.join(OUT, "r60-" + (reinspection ? "reinspection" : "initial") + "-" + charges + ".pdf");
        await printPage.pdf({ path: pdf, format: "Letter", printBackground: true, preferCSSPageSize: true });
        const text = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" });
        for (const label of ["COURT COPY", "AGENCY COPY", "INSPECTOR COPY", "DEFENDANT'S COPY"])
          assert.equal(text.split(label).length - 1, charges, "PDF includes " + label);
        packets.push({ reinspection, charges, copies: faces.length });
      }
    await page.locator("[data-citation-copies]").click();
    assert.equal(await page.locator(".document-workspace .cit:visible").count(), 8);
    assert.equal(await page.locator("[data-citation-copies]").getAttribute("aria-expanded"), "true");
    const results = { passed: true, packets, addressZooms: [1, 1.25, 1.5, 2], historyItems: 12 };
    fs.writeFileSync(path.join(OUT, "r60-production-results.json"), JSON.stringify(results, null, 2));
    return results;
  } finally {
    await context.close();
  }
};
