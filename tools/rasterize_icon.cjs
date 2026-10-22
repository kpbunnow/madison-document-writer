/* Rasterize SVG icon variants with the pinned Playwright Chromium (or DW_BROWSER).
   Input (stdin): JSON [{ size, svg }]. Output (stdout): JSON [{ size, png }] with base64 PNG bytes.
   Called by tools/build_icon.py; the ICO container is written in Python. */
const { chromium } = require("playwright");

async function rasterize(jobs) {
  const browser = await chromium.launch({
    executablePath: process.env.DW_BROWSER,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--font-render-hinting=none"],
  });
  try {
    const results = [];
    for (const job of jobs) {
      const page = await browser.newPage({ viewport: { width: job.size, height: job.size }, deviceScaleFactor: 1 });
      await page.setContent(
        "<!doctype html><html><head><style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style></head><body>" +
          job.svg +
          "</body></html>",
      );
      const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: job.size, height: job.size } });
      results.push({ size: job.size, png: png.toString("base64") });
      await page.close();
    }
    return { browser: browser.version(), results };
  } finally {
    await browser.close();
  }
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  rasterize(JSON.parse(input))
    .then((value) => process.stdout.write(JSON.stringify(value)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
});
