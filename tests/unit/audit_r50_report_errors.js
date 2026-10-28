/* Public Reports service and presentation seams preserve the original parse/fallback assertions. */
const assert = require("assert/strict"),
  path = require("path"),
  esbuild = require("esbuild");
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents:
        'export {createReportsServices} from "./app/modules/reports_services.js";export {orderedRows} from "./app/modules/report_presentation.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
    define: { __TEST_BUILD__: "false" },
  });
  const box = { exports: {} };
  const document = { querySelector: () => ({ content: "SYNTHETIC-TOKEN" }) };
  const fetch = async () => ({
    status: 502,
    ok: false,
    json: async () => {
      throw new SyntaxError("bad response");
    },
  });
  new Function("document", "fetch", "module", "exports", compiled.outputFiles[0].text)(document, fetch, box, box.exports);
  const { createReportsServices, orderedRows } = box.exports;
  const { getJSON } = createReportsServices(new Proxy({}, { get: (_, key) => assert.fail("premature service " + String(key)) }));
  await assert.rejects(getJSON("/reporting/index"), /502.*readable|readable.*502/);
  const a = { cells: ["a"] },
    b = { cells: ["b"] };
  let notice = "";
  const old = String.prototype.localeCompare;
  String.prototype.localeCompare = function () {
    throw Error("forced comparator failure");
  };
  try {
    assert.deepEqual(
      orderedRows({ rows: [b, a] }, { ci: 0, dir: 1 }, (message) => (notice = message)).map((x) => x.row),
      [b, a],
    );
  } finally {
    String.prototype.localeCompare = old;
  }
  assert.ok(/default order/i.test(notice));
  console.log("PASS report parse status and explicit default-order fallback");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
