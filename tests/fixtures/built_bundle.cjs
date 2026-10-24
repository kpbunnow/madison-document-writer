/* Read a built application page and its embedded bundle. DW_OUTPUT_DIR overrides build/dist. */
const fs = require("fs"),
  path = require("path");
const PAGES = { app: "madison-document-writer.html", reports: "madison-reports.html" };

function builtPage(stem = "app", dir = process.env.DW_OUTPUT_DIR || path.join(path.resolve(__dirname, "../.."), "build/dist")) {
  return fs.readFileSync(path.join(dir, PAGES[stem]), "utf8");
}

function bundleSource(page) {
  return Buffer.from(/var B="([A-Za-z0-9+/=]+)"/.exec(page)[1], "base64").toString();
}

/* Consolidation Phase 4 (B4): production-only suites check the bundle they were given, not only the environment
   (the full runner tests a test build in build/dist while supplying the production copy in DW_PRODUCTION_DIR). A
   production bundle keeps the desktop-shortcut reconnect guard that test builds compile out and carries no test
   fixtures. */
const PRODUCTION_ONLY =
  "This suite compares against the production build; run `python3 tools/build.py` without `DW_TEST_BUILD` first or set `DW_PRODUCTION_DIR`.";
const isTestBundle = (source) =>
  !source.includes("Open the program from the installed desktop shortcut to reconnect") || source.includes("initTestFixtures");

function assertProductionPage(file) {
  const page = fs.readFileSync(file, "utf8");
  if (isTestBundle(bundleSource(page))) throw new Error(PRODUCTION_ONLY + " " + file + " is a test build.");
  return page;
}

function productionPage(stem = "app", dir = process.env.DW_OUTPUT_DIR || path.join(path.resolve(__dirname, "../.."), "build/dist")) {
  return assertProductionPage(path.join(dir, PAGES[stem]));
}

module.exports = { builtPage, bundleSource, isTestBundle, assertProductionPage, productionPage, PRODUCTION_ONLY };
