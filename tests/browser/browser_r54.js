/* R54 production extension layout and print geometry; synthetic cases only. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
const fixture = require("../fixtures/r54_extensions.js");
module.exports = async function (browser, hostPage, OUT, axeScreen) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1200 }, timezoneId: "America/Chicago" });
  const page = await context.newPage(),
    printPage = await context.newPage();
  const results = [];
  try {
    await page.goto(new URL("/", hostPage.url()).href);
    await page.waitForFunction(() => typeof WriterState !== "undefined");
    await page.evaluate(() => {
      WriterState.CASES = [
        {
          id: "k1",
          number: "QA-R54",
          address: "100 SYNTHETIC AVENUE",
          owner: "SYNTHETIC OWNER",
          ownerAddr: "100 TEST ROAD",
          ownerCity: "Madison, WI 53703",
          inspectorId: INSPECTORS[0].id,
          date: "2026-10-20",
          time: "10:00",
          emails: [],
        },
      ];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.CASEDIR = null;
      WriterState.NEEDGRANT = false;
    });
    const original = await page.evaluate(fixture);
    await page.evaluate(fs.readFileSync(path.join(__dirname, "../fixtures/reference/r51-print-fixture-payload.js"), "utf8"));
    for (const count of [1, 10]) {
      const packets = [];
      for (const type of ["extension", "bestInterestExtension", "vacancyExtension"]) {
        const job = await page.evaluate(
          ({ original, type, count }) => {
            const d = { ...clone(original), type, authoringVersion: 12 };
            d.emailedTo = [{ addr: "r54-qa@example.invalid", kind: "Owner" }];
            d.items = Array.from({ length: count }, (_, n) => ({ ...clone(original.items[n % 2]), id: "r54-" + n, no: String(n + 1) }));
            WriterState.DOCS = [d];
            WriterState.state.docId = d.id;
            WriterState.state.screen = "write";
            WriterState.state.modal = null;
            render();
            return printJob(d);
          },
          { original, type, count },
        );
        await axeScreen(page, "r54-" + type + "-" + count);
        const inspected = await page.evaluate((html) => inspectPrintPacket(html, false), job.html);
        for (const sheet of inspected.geometry) {
          assert.equal(sheet.clipped, false, type + ": no clipped text");
          assert.equal(sheet.continuation, true, type + ": continuation header retained");
        }
        await printPage.setContent(job.html, { waitUntil: "load" });
        await printPage.evaluate(() => document.fonts.ready);
        await printPage.emulateMedia({ media: "print" });
        const layout = await printPage.evaluate(() => ({
          pages: [...document.querySelectorAll(".sheet")].map((p) => ({
            height: p.getBoundingClientRect().height,
            overflow: p.scrollHeight > p.clientHeight + 2 || p.scrollWidth > p.clientWidth + 2,
            content: p.textContent.trim().length,
            footer: p.querySelector(".n-foot")?.textContent || "",
          })),
          body: document.body.textContent,
        }));
        for (const p of layout.pages) {
          assert.ok(p.height <= 1058, type + ": page bounds");
          assert.equal(p.overflow, false, type + ": no overflow");
          assert.ok(p.content > 20, type + ": no blank pages");
        }
        if (count === 1) assert.equal(layout.pages.length, 1, type + ": one-page fixture");
        else assert.equal(layout.pages.length, 2, type + ": two-page fixture");
        await printPage.screenshot({ path: path.join(OUT, "r54-" + type + "-" + count + ".png"), fullPage: true });
        await printPage.pdf({
          path: path.join(OUT, "r54-" + type + "-" + count + ".pdf"),
          format: "Letter",
          printBackground: true,
          preferCSSPageSize: true,
        });
        packets.push(layout.pages.map((p) => p.footer));
        results.push({ type, count, pages: layout.pages.length });
      }
      for (const packet of packets) assert.deepEqual(packet, packets[0], "exact same footer content and page numbering");
    }
    const conditional = await page.evaluate((original) => {
      const d = { ...clone(original), type: "vacancyExtension", authoringVersion: 12 };
      d.special.deadlineMode = "conditional";
      d.items[0].due = d.special.originalDues[1];
      WriterState.DOCS = [d];
      WriterState.state.docId = d.id;
      render();
      return printJob(d);
    }, original);
    assert.ok(conditional.html.includes("Conditional — see conditions above"));
    const conditionalLayout = await page.evaluate((html) => inspectPrintPacket(html, false), conditional.html);
    assert.ok(
      conditionalLayout.geometry.every((p) => !p.clipped && !p.overflow && p.continuation),
      "conditional vacancy packet is complete and unclipped",
    );
    await axeScreen(page, "r54-vacancy-conditional");
    const long = await page.evaluate((original) => {
      const d = { ...clone(original), type: "bestInterestExtension", authoringVersion: 12 };
      d.special.reason = "The approved plan provides clear staging and contractor accountability. ".repeat(50);
      d.items = Array.from({ length: 20 }, (_, n) => ({ ...clone(original.items[n % 2]), id: "r54-long-" + n, no: String(n + 1) }));
      WriterState.DOCS = [d];
      WriterState.state.docId = d.id;
      render();
      const language = document.createElement("div");
      language.innerHTML = newDocuments.specialBody(d);
      return { ...printJob(d), paragraphs: [...language.querySelectorAll("p")].map((p) => p.textContent) };
    }, original);
    const longLayout = await page.evaluate((html) => inspectPrintPacket(html, false), long.html);
    assert.ok(longLayout.geometry.length > 2, "long approved language and items continue across pages");
    assert.ok(
      longLayout.geometry.every((p) => !p.clipped && !p.overflow && p.continuation),
      "long language is paginated without clipping",
    );
    await printPage.setContent(long.html, { waitUntil: "load" });
    assert.deepEqual(
      await printPage.locator(".n-body p").allTextContents(),
      long.paragraphs,
      "every language paragraph remains unchanged and in order",
    );
    await printPage.pdf({ path: path.join(OUT, "r54-long-language.pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
    await axeScreen(page, "r54-best-interest-long-language");
    await page.evaluate((original) => {
      const d = { ...clone(original), type: "bestInterestExtension", authoringVersion: 12, draft: true };
      d.special.extendedDues = { 1: d.items[0].due };
      d.special.reviewed = true;
      WriterState.DOCS = [d];
      WriterState.state.docId = d.id;
      render();
    }, original);
    await page.bringToFront();
    // Authoring 12 keeps its affected-item fieldset; only authoring-13 drafts select affected items in the table.
    assert.equal(await page.locator('#r26-details fieldset.r26-items [data-special-item="1"]').isChecked(), true);
    assert.equal(await page.locator(".desk [data-special-item]").count(), 0);
    await page.locator('[data-field="due"][data-id="r54-open"]').fill("2026-11-27");
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).special.extendedDues[1]), "2026-11-27");
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).special.reviewed), false);
    assert.equal(await page.locator('[data-special-due="1"]').inputValue(), "2026-11-27", "deadline controls agree after a table edit");
    assert.equal(await page.locator('[data-special="reviewed"]').isChecked(), false, "renewed approval is visibly required");
    for (const type of ["bestInterestExtension", "vacancyExtension"]) {
      await page.evaluate((type) => {
        const d = doc(WriterState.state.docId);
        d.type = type;
        d.special.reviewed = true;
        d.selectionCache = { [type]: clone(d.special) };
        d.fromReinspId = "r54-edit-visit";
        WriterState.REINSP = [{ id: d.fromReinspId, actionDetails: { [type]: clone(d.special) } }];
        render();
      }, type);
      await page.locator('[data-field="text"][data-id="r54-open"]').fill("Synthetic revised printed correction.");
      const edited = await page.evaluate(() => {
        const d = doc(WriterState.state.docId);
        return {
          text: d.items[0].text,
          reviewed: d.special.reviewed,
          cached: d.selectionCache[d.type].reviewed,
          visit: WriterState.REINSP[0].actionDetails[d.type].reviewed,
        };
      });
      assert.deepEqual(edited, { text: "Synthetic revised printed correction.", reviewed: false, cached: false, visit: false });
      assert.equal(await page.locator('[data-special="reviewed"]').isChecked(), false);
    }
    // R56 #23: authoring-13 row controls (affected-item and shared-due-date checkboxes) are screen-only. Print
    // preview of an editable draft must paginate exactly like the non-editable rendering of the same facts,
    // including at the counts where a page break moves.
    const boundary = [];
    for (const type of ["bestInterestExtension", "vacancyExtension"]) {
      const runs = [];
      for (let count = 1; count <= 17; count++) {
        const run = await page.evaluate(
          ({ original, type, count }) => {
            const make = (editable) => {
              const d = { ...clone(original), type, authoringVersion: 13, id: "r56-boundary-" + type, draft: true };
              delete d.frozen;
              delete d.mailed;
              d.items = Array.from({ length: count }, (_, n) => ({
                id: "r56-row-" + n,
                no: String(n + 1),
                sections: ["27.05(2)(c)"],
                text: "Repair the synthetic wall condition.",
                group: "Exterior",
                due: "2026-12-15",
              }));
              d.special = {
                ...clone(original.special),
                deadlineMode: "dated",
                affected: d.items.map((i) => i.no),
                originalDues: Object.fromEntries(d.items.map((i) => [i.no, "2026-10-21"])),
              };
              if (!editable) d.status = "Final";
              return d;
            };
            const out = {};
            for (const mode of ["editable", "locked"]) {
              const d = make(mode === "editable");
              WriterState.DOCS = [d];
              WriterState.state.docId = d.id;
              WriterState.state.screen = "write";
              WriterState.state.modal = null;
              render();
              const onScreen = document.querySelectorAll(".desk .affected-pick [data-special-item]").length;
              const job = printJob(d);
              const printed = new DOMParser().parseFromString(job.html, "text/html");
              out[mode] = {
                onScreen,
                html: job.html,
                controls: printed.querySelectorAll(".affected-pick,.due-pick,[data-special-item],[data-due-select],input,button").length,
                pages: [...printed.querySelectorAll(".sheet")].map((sheet) =>
                  [...sheet.querySelectorAll("tbody tr:not(.grp) .c-no")].map((cell) => (cell.textContent.match(/\d+/) || [""])[0]),
                ),
              };
            }
            return out;
          },
          { original, type, count },
        );
        assert.equal(run.editable.onScreen, count, type + " " + count + ": editable draft shows a row control for every item");
        assert.equal(run.locked.onScreen, 0, type + " " + count + ": non-editable rendering has no row controls");
        assert.equal(run.editable.controls, 0, type + " " + count + ": no row controls in the printable preview");
        assert.equal(run.locked.controls, 0, type + " " + count + ": no row controls in the non-editable copy");
        assert.deepEqual(
          run.editable.pages.flat(),
          Array.from({ length: count }, (_, n) => String(n + 1)),
          type + " " + count + ": every item printed once, in order",
        );
        assert.equal(run.editable.pages.length, run.locked.pages.length, type + " " + count + ": preview page count matches the non-editable copy");
        assert.deepEqual(run.editable.pages, run.locked.pages, type + " " + count + ": preview items per page match the non-editable copy");
        runs.push({ count, pages: run.editable.pages.length, distribution: run.editable.pages.map((p) => p.length), html: run.editable.html });
      }
      // The range must cross at least one page break, or the comparison proves nothing about boundaries.
      const breaks = runs.filter((r, n) => n && r.pages > runs[n - 1].pages);
      assert.ok(breaks.length, type + ": item counts cross a page boundary");
      for (const at of breaks.flatMap((r) => [r.count - 1, r.count])) {
        const run = runs.find((r) => r.count === at);
        const layout = await page.evaluate((html) => inspectPrintPacket(html, false), run.html);
        assert.ok(
          layout.geometry.every((p) => !p.clipped && !p.overflow && p.continuation),
          type + " " + at + ": boundary packet is complete and unclipped",
        );
      }
      boundary.push({ type, boundaries: breaks.map((r) => r.count), runs: runs.map(({ html, ...r }) => r) });
    }
    results.push({ authoring13PrintPreviewBoundaries: boundary });
    const result = { passed: true, checks: results };
    fs.writeFileSync(path.join(OUT, "r54-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await context.close();
  }
};
