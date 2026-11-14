/* Matched synthetic production workloads. Run serially with two production HTML paths and an output JSON path.
   Diagnostic only: never gate/release evidence and no City/SQL/SMB/Outlook acceptance claim. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { chromium } = require("playwright");
const { readProfileInputs, pairedPageServer } = require("./profile_support.cjs");
const { pages, output, sha, harnessSha256, supportSha256, verifySources } = readProfileInputs(process.argv.slice(2), __filename);
(async () => {
  const server = pairedPageServer(pages);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let browser;
  const checks = [];
  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    for (let round = 0; round < 4; round++)
      for (const index of round % 2 ? [1, 0] : [0, 1]) {
        const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, timezoneId: "America/Chicago" }),
          page = await context.newPage();
        await page.goto("http://127.0.0.1:" + server.address().port + "/" + (index ? "after" : "before"));
        await page.waitForFunction(() => WriterState.WRITER_READY === true);
        const result = await page.evaluate(async () => {
          WriterState.CASES = [
            {
              id: "profile-case",
              number: "CB2026-100-00001",
              address: "100 SYNTHETIC ST",
              owner: "SYNTHETIC OWNER",
              ownerAddr: ["400 EXAMPLE ST", "MADISON WI 53703"],
              inspectorId: "i4",
              parcel: "070822219101",
              date: "2026-01-02",
              time: "09:00",
            },
          ];
          WriterState.DOCS = [];
          WriterState.REINSP = [];
          WriterState.EVENTS = {};
          WriterState.PENDING = [];
          WriterState.RECORD_ATTEMPTS = {};
          newDoc("profile-case", "notice");
          const d = doc(WriterState.state.docId);
          d.id = "profile-document";
          WriterState.state.docId = d.id;
          d.items = Array.from({ length: 30 }, (_, i) => ({
            id: "item-" + i,
            no: i + 1,
            title: "Repair",
            text: "Repair the synthetic porch railing for item " + i + ".",
            sections: ["27.05(2)(c)"],
            due: "2027-01-05",
            done: false,
            withdrawn: false,
          }));
          render();
          await document.fonts.ready;
          const digest = async (text) =>
            [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
              .map((x) => x.toString(16).padStart(2, "0"))
              .join("");
          const input = await digest(JSON.stringify(d));
          const original = paginate;
          let paginations = 0;
          paginate = (...a) => {
            paginations++;
            return original(...a);
          };
          const started = performance.now();
          for (let n = 0; n < 120; n++) {
            if (n % 6 === 0) d.items[0].text = "Synthetic edit " + n + ". Repair the porch railing.";
            refreshSheet();
          }
          const elapsedMs = performance.now() - started;
          paginate = original;
          return {
            elapsedMs,
            paginations,
            refreshes: 120,
            edits: 20,
            input,
            output: await digest(documentHTML(d)),
            model: await digest(JSON.stringify(d)),
            pages: document.querySelectorAll(".desk .sheet").length,
          };
        });
        checks.push({ round, label: index ? "after" : "before", ...result });
        await context.close();
      }
    for (let n = 0; n < 4; n++) {
      const a = checks.find((x) => x.round === n && x.label === "before"),
        b = checks.find((x) => x.round === n && x.label === "after");
      for (const k of ["input", "output", "model", "pages", "edits", "refreshes"]) assert.equal(a[k], b[k], k + " mismatch");
      assert.equal(a.paginations, 120);
      assert.equal(b.paginations, 20);
    }
    const median = (label) => {
      const a = checks
        .filter((x) => x.label === label)
        .map((x) => x.elapsedMs)
        .sort((a, b) => a - b);
      return (a[1] + a[2]) / 2;
    };
    const result = {
      diagnostic: true,
      passed: true,
      browser: browser.version(),
      runtimeHashes: { before: sha(pages[0]), after: sha(pages[1]) },
      harnessSha256,
      supportSha256,
      workload: "30-item notice; 120 refreshes including 20 edits; four alternating paired rounds",
      beforeMedianMs: median("before"),
      afterMedianMs: median("after"),
      checks,
    };
    verifySources();
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
