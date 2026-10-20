const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  { JSDOM } = require("jsdom"),
  esbuild = require("esbuild");
const code = esbuild.buildSync({
  entryPoints: [path.join(require("path").resolve(__dirname, "../.."), "app/modules/contracts.js")],
  bundle: true,
  format: "cjs",
  write: false,
}).outputFiles[0].text;
const moduleBox = { exports: {} };
new Function("module", "exports", code)(moduleBox, moduleBox.exports);
const { makeEvent: eventFactory, caseStoreRequest: storeRequestFactory } = moduleBox.exports;
assert.deepEqual(eventFactory("id", "time", "inspector", "notice.issued", { a: 1 }), {
  id: "id",
  at: "time",
  by: "inspector",
  type: "notice.issued",
  payload: { a: 1 },
});
const request = { name: "case.json", file: {}, baseRevision: "r", baseCase: null };
assert.equal(storeRequestFactory(request), request);
const html = fs.readFileSync(path.join(process.env.DW_PRODUCTION_DIR, "madison-document-writer.html"), "utf8");
const payload = Buffer.from(/var B="([A-Za-z0-9+/=]+)"/.exec(html)[1], "base64").toString();
assert.ok(!payload.includes("function issueDocument("));
require("acorn").parse(payload, { ecmaVersion: 2022, sourceType: "script" });
const dom = new JSDOM(html, { url: "http://127.0.0.1:8777", pretendToBeVisual: true });
global.window = dom.window;
global.document = window.document;
global.localStorage = window.localStorage;
globalThis.MADISON_TEST_DATA = true;
global.getSelection = () => window.getSelection();
global.setTimeout = () => 1;
global.clearTimeout = () => {};
global.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
window.scrollTo = () => {};
eval(
  payload +
    ("\nassert.equal(WriterState.CASES.length,0);assert.equal(typeof issueDocum" +
      'ent,"undefined");assert.equal(typeof reissueDocument,"undefined");assert' +
      '.equal(typeof futureDue,"undefined");'),
);
console.log("PASS exact event/store contracts and fixture-free production");
process.exit(0);
