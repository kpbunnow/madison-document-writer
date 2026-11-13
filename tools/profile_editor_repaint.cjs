/* Matched editor repaint workload (diagnostic only, never gate or release evidence; no City/Windows claim).
   Usage: node tools/profile_editor_repaint.cjs <before.html> <after.html> <output.json>
   A 60-item Official Notice draft; each round alternates the two production pages and measures sheet refreshes, full
   renders and keep-renders, with model edits interleaved. Output digests, page counts and page text must match. */
const fs = require("fs"),
  http = require("http"),
  path = require("path"),
  crypto = require("crypto"),
  assert = require("assert/strict"),
  { chromium } = require("playwright");
const { assertProductionPage } = require("../tests/fixtures/built_bundle.cjs");
const [before, after, output] = process.argv.slice(2);
assert.ok(before && after && output, "before.html after.html output.json required");
const pages = [before, after].map((p) => assertProductionPage(path.resolve(p))),
  sha = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function workload() {
  const digest = async (text) =>
    [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((x) => x.toString(16).padStart(2, "0")).join("");
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
  Object.assign(WriterState, { DOCS: [], REINSP: [], EVENTS: {}, PENDING: [], RECORD_ATTEMPTS: {} });
  newDoc("profile-case", "notice");
  const d = doc(WriterState.state.docId);
  d.id = "profile-document";
  WriterState.state.docId = d.id;
  d.items = Array.from({ length: 60 }, (_, i) => ({
    id: "item-" + i,
    no: i + 1,
    title: "Repair " + i,
    group: i < 30 ? "Exterior" : "Interior",
    text: "Repair the synthetic porch railing ( ) for item " + i + ".",
    sections: ["27.05(2)(c)"],
    due: "2027-01-05",
    done: false,
    withdrawn: false,
  }));
  WriterState.state.screen = "write";
  render();
  await document.fonts.ready;
  const original = paginate;
  let paginations = 0;
  paginate = (...a) => {
    paginations++;
    return original(...a);
  };
  const timed = (count, step) => {
    const started = performance.now();
    for (let n = 0; n < count; n++) step(n);
    return performance.now() - started;
  };
  const edit = (n) => (d.items[0].text = "Synthetic edit " + n + ". Repair the porch railing ( ).");
  const refreshMs = timed(60, (n) => {
      if (n % 6 === 0) edit(n);
      refreshSheet();
    }),
    renderMs = timed(30, (n) => {
      if (n % 6 === 0) edit(100 + n);
      render();
    }),
    keepMs = timed(30, (n) => {
      if (n % 6 === 0) edit(200 + n);
      renderKeep();
    });
  paginate = original;
  const sheets = [...document.querySelectorAll(".desk .sheet")];
  return {
    refreshMs,
    renderMs,
    keepMs,
    paginations,
    output: await digest(documentHTML(d)),
    model: await digest(JSON.stringify(d)),
    pages: sheets.length,
    pageText: await digest(sheets.map((s) => s.textContent).join("\f")),
  };
}

(async () => {
  const server = http.createServer((req, res) => {
    const i = req.url === "/before" ? 0 : req.url === "/after" ? 1 : -1;
    res.writeHead(i < 0 ? 404 : 200, { "Content-Type": i < 0 ? "application/json" : "text/html" });
    res.end(i < 0 ? "{}" : pages[i]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let browser;
  const checks = [];
  try {
    browser = await chromium.launch({
      executablePath: process.env.DW_BROWSER || undefined,
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    for (let round = 0; round < 4; round++)
      for (const index of round % 2 ? [1, 0] : [0, 1]) {
        const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, timezoneId: "America/Chicago" }),
          page = await context.newPage();
        await page.goto("http://127.0.0.1:" + server.address().port + "/" + (index ? "after" : "before"));
        await page.waitForFunction(() => WriterState.WRITER_READY === true);
        checks.push({ round, label: index ? "after" : "before", ...(await page.evaluate(workload)) });
        await context.close();
      }
    for (let n = 0; n < 4; n++) {
      const a = checks.find((x) => x.round === n && x.label === "before"),
        b = checks.find((x) => x.round === n && x.label === "after");
      for (const k of ["output", "model", "pages", "pageText"]) assert.equal(a[k], b[k], k + " mismatch in round " + n);
    }
    const median = (label, key) => {
      const values = checks
        .filter((x) => x.label === label)
        .map((x) => x[key])
        .sort((p, q) => p - q);
      return +((values[1] + values[2]) / 2).toFixed(1);
    };
    const summary = Object.fromEntries(
      ["refreshMs", "renderMs", "keepMs", "paginations"].map((key) => [key, { before: median("before", key), after: median("after", key) }]),
    );
    const result = {
      diagnostic: true,
      passed: true,
      browser: browser.version(),
      runtimeHashes: { before: sha(pages[0]), after: sha(pages[1]) },
      harnessSha256: sha(fs.readFileSync(__filename)),
      workload: "60-item notice; 60 sheet refreshes, 30 renders and 30 keep-renders, each with an edit every sixth step; four alternating rounds",
      summary,
      checks,
    };
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
    console.log(JSON.stringify({ browser: result.browser, summary }, null, 2));
  } finally {
    await browser?.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
