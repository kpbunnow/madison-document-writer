const assert = require("assert/strict");
const { JSDOM } = require("jsdom"),
  { builtPage, bundleSource } = require("./built_bundle.cjs");
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
  const payload = bundleSource(builtPage(stem));
  eval(
    payload +
      "\n(async()=>{await new Promise(r=>setTimeout(r,40));" +
      code +
      "\n})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});",
  );
};
