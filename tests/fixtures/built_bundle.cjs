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

module.exports = { builtPage, bundleSource };
