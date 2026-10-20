const assert = require("assert/strict");
const fs = require("fs"),
  path = require("path"),
  { JSDOM } = require("jsdom");
module.exports = function (code, stem = "app") {
  const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
    url: "http://127.0.0.1:8777/",
    pretendToBeVisual: true,
  });
  Object.assign(global, {
    window: dom.window,
    location: dom.window.location,
    document: dom.window.document,
    DOMParser: dom.window.DOMParser,
    confirm: () => true,
    getSelection: () => dom.window.getSelection(),
  });
  dom.window.scrollTo = () => {};
  const html = fs.readFileSync(
      path.join(require("path").resolve(__dirname, "../.."), "build/dist", stem === "app" ? "madison-document-writer.html" : "madison-reports.html"),
      "utf8",
    ),
    payload = Buffer.from(/var B="([A-Za-z0-9+\/=]+)"/.exec(html)[1], "base64").toString();
  eval(
    payload +
      "\n(async()=>{await new Promise(r=>setTimeout(r,40));" +
      code +
      "\n})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});",
  );
};
