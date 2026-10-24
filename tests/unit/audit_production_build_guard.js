/* Consolidation Phase 4 (B4): production-only suites refuse a test bundle by inspecting the bundle itself, with one
   clear message, and accept a production bundle wherever it is supplied. Synthetic pages, plus the real pages when
   the full runner provides both builds. */
const assert = require("assert/strict"),
  fs = require("fs"),
  os = require("os"),
  path = require("path");
const { isTestBundle, assertProductionPage, productionPage, PRODUCTION_ONLY } = require("../fixtures/built_bundle.cjs");

const GUARD = 'throw new Error("Open the program from the installed desktop shortcut to reconnect. Your device work is retained.")';
const page = (source) => '<script>var B="' + Buffer.from(source).toString("base64") + '";</script>';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "madison-production-guard-"));
try {
  const cases = {
    production: [GUARD + ";render();", false],
    "test build without the reconnect guard": ["render();", true],
    "test fixtures in a guarded bundle": [GUARD + ";function initTestFixtures(){}", true],
  };
  for (const [name, [source, test]] of Object.entries(cases)) {
    assert.equal(isTestBundle(source), test, name);
    const file = path.join(dir, "madison-document-writer.html");
    fs.writeFileSync(file, page(source));
    if (test) {
      assert.throws(
        () => assertProductionPage(file),
        (e) => e.message === PRODUCTION_ONLY + " " + file + " is a test build.",
        name,
      );
      assert.throws(
        () => productionPage("app", dir),
        (e) => e.message.startsWith(PRODUCTION_ONLY),
        name + " through productionPage",
      );
    } else assert.equal(productionPage("app", dir), page(source), name);
  }
  assert.equal(
    PRODUCTION_ONLY,
    "This suite compares against the production build; run `python3 tools/build.py` without `DW_TEST_BUILD` first or set `DW_PRODUCTION_DIR`.",
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

// The full runner supplies the production copy and tests a test build in build/dist: both are classified correctly.
if (process.env.DW_PRODUCTION_DIR) {
  const root = path.resolve(__dirname, "../..");
  for (const name of ["madison-document-writer.html", "madison-reports.html"]) {
    assertProductionPage(path.join(process.env.DW_PRODUCTION_DIR, name));
    assert.throws(() => assertProductionPage(path.join(root, "build/dist", name)), /is a test build\.$/, name + " test build");
  }
  console.log("PASS real production and test pages are classified");
}
console.log("PASS production-only suites refuse a test bundle with one clear message");
