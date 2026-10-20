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
    const result = { passed: true, checks: results };
    fs.writeFileSync(path.join(OUT, "r54-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await context.close();
  }
};
