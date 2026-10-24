/* Exact authored content plus font-independent pagination checks against verified R49. */
const fs = require("fs"),
  path = require("path"),
  http = require("http"),
  assert = require("assert/strict"),
  crypto = require("crypto");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../..");
function validatePacket(layout) {
  if (layout.citation) assert.equal(layout.copies, 4, "four complete court copies");
  assert.ok(layout.geometry.length, "packet has pages");
  for (const page of layout.geometry) {
    assert.ok(page.height <= 1058, "no sheet taller than a page");
    assert.equal(page.overflow, false, "no overflowing content");
    assert.equal(page.clipped, false, "no clipped content");
    assert.equal(page.orphan, false, "no orphaned continuation content");
    assert.equal(page.continuation, true, "continuation header retained");
  }
}
(async () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/reference/R51-authored-print-golden.json"), "utf8"));
  const frozen = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/reference/R49-print-golden.json"), "utf8"));
  const runtime = path.join(process.env.DW_PRODUCTION_DIR || path.join(root, "build/dist"), "madison-document-writer.html");
  require("../fixtures/built_bundle.cjs").assertProductionPage(runtime);
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", req.url === "/" ? "text/html" : "application/json");
    res.end(req.url === "/" ? fs.readFileSync(runtime) : '{"ok":false}');
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.DW_BROWSER, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    const page = await browser.newPage({ timezoneId: "America/Chicago" });
    page.setDefaultTimeout(20000);
    await page.goto("http://127.0.0.1:" + server.address().port + "/");
    await page.waitForFunction(() => typeof WriterState.state !== "undefined");
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(fs.readFileSync(path.join(root, "tests/fixtures/reference/r51-print-fixture-payload.js"), "utf8"));
    const checks = [],
      metrics = [];
    for (const metric of ["native", "compact", "expanded"]) {
      const actual = await page.evaluate((metric) => fixedPrintFixtures(metric), metric);
      assert.equal(actual.styles, frozen.styles, "immutable approved stylesheet");
      assert.equal(actual.styles, baseline.styles, "retained baseline stylesheet");
      assert.equal(actual.results.length, 69);
      for (let n = 0; n < actual.results.length; n++) {
        const item = actual.results[n],
          expected = baseline.results[n];
        assert.equal(item.type, expected.type);
        assert.equal(item.authoringVersion, expected.authoringVersion);
        assert.equal(item.snow, expected.snow);
        // Date-input limits (min/max) are computed from today's date; every other byte, including field values, must match exactly.
        const dayRelative = (html) => String(html).replace(/\b(min|max)="\d{4}-\d{2}-\d{2}"/g, '$1="TODAY-RELATIVE"');
        assert.equal(dayRelative(item.authored), dayRelative(expected.authored), "exact authored body before pagination");
        assert.equal(item.copies, expected.copies, "court-copy count");
        assert.deepEqual(item.layout.courtHTML, expected.layout.courtHTML, "exact content of every court copy");
        assert.deepEqual(item.layout.coverParagraphs, expected.layout.coverParagraphs, "all snow-cover paragraphs preserved");
        assert.deepEqual(item.layout.coverRows, expected.layout.coverRows, "all snow-cover table rows preserved");
        assert.deepEqual(item.layout.coverNotes, expected.layout.coverNotes, "complete language-access content preserved");
        validatePacket(item.layout);
        if (!item.snow) {
          assert.equal(item.sheets, frozen.results[n].sheets, "deterministic page breaks");
          assert.equal(item.body, frozen.results[n].body, "deterministic frozen print body");
        }
        if (item.snow && item.authoringVersion === 9) metrics.push({ metric, covers: item.layout.covers });
        if (metric === "native")
          checks.push({
            type: item.type,
            authoringVersion: item.authoringVersion,
            snow: item.snow,
            exactAuthored: true,
            sha256: crypto.createHash("sha256").update(item.authored).digest("hex"),
            pages: item.layout.geometry.length,
          });
      }
    }
    assert.equal(metrics.find((x) => x.metric === "compact").covers, 1, "compact host font metrics produce one snow cover");
    assert.equal(metrics.find((x) => x.metric === "expanded").covers, 2, "expanded host font metrics produce two snow covers");
    for (const damage of ["missing-copy", "overflow", "clipping"]) {
      const layout = await page.evaluate((damage) => {
        const doc = new DOMParser().parseFromString(window.__r51LastSnow, "text/html");
        if (damage === "missing-copy") doc.querySelector(".cit").remove();
        if (damage === "overflow") {
          const block = doc.createElement("div");
          block.style.height = "1200px";
          block.textContent = "REAL OVERFLOW";
          doc.querySelector(".sheet").append(block);
        }
        if (damage === "clipping")
          doc.querySelector(".sheet .n-head").setAttribute("style", "height:1px!important;min-height:0!important;overflow:hidden!important");
        return inspectPrintPacket("<!doctype html>" + doc.documentElement.outerHTML, true);
      }, damage);
      assert.throws(() => validatePacket(layout), undefined, "actual DOM defect must be detected: " + damage);
    }
    const dir = path.join(root, "build/test-results");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "r50-print-compatibility.json"),
      JSON.stringify(
        {
          passed: true,
          baselineZipSha256: frozen.baselineZipSha256,
          baselineRuntimeSha256: baseline.baselineRuntimeSha256,
          checks,
          metrics,
          negativeChecks: ["missing-copy", "overflow", "clipping"],
        },
        null,
        2,
      ) + "\n",
    );
    console.log("PASS 69 exact authored variants; one/two-page snow covers; real overflow, clipping and missing-copy mutations detected");
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
