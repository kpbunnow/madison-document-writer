/* Fail once, before any suite, with the two supported browser setup options. */
const { chromium } = require("playwright");
async function checkBrowser() {
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.DW_BROWSER,
      headless: true,
      timeout: 15000,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    console.log("Usable Chromium: " + browser.version());
  } catch (error) {
    throw new Error(
      "Chromium is unavailable. Run npx playwright install chromium using this project's pinned dependencies, or set DW_BROWSER to a compatible Chromium executable for an offline machine.",
    );
  } finally {
    if (browser) await browser.close();
  }
}
module.exports = checkBrowser;
if (require.main === module)
  checkBrowser().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
