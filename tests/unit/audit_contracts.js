const assert = require("assert/strict"),
  path = require("path"),
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
require("../fixtures/production_fixture_guard.cjs")()
  .then(() => {
    console.log("PASS exact event/store contracts and fixture-free production");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
