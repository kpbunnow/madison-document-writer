const fs = require("fs"),
  path = require("path"),
  http = require("http");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../..");
(async () => {
  const runtime = path.join(process.env.DW_PRODUCTION_DIR || path.join(root, "build/dist"), "madison-document-writer.html");
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/" ? "text/html" : "application/json");
    res.end(req.url === "/" ? fs.readFileSync(runtime) : '{"ok":false}');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.DW_BROWSER, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const host = await browser.newPage();
    await host.goto("http://127.0.0.1:" + server.address().port + "/");
    const out = path.join(root, "build/test-results/r54-print");
    fs.mkdirSync(out, { recursive: true });
    await require("../browser/browser_r54.js")(browser, host, out, async (page) => {
      await page.evaluate(fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"));
      const r = await page.evaluate(() =>
        axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }),
      );
      require("assert/strict").deepEqual(r.violations, []);
    });
    console.log("PASS R54 real Chromium extension layouts and PDF geometry");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
