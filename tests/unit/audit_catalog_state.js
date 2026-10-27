/* Scoped catalog access remains live and never initializes the application. */
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: 'export {WriterState} from "./app/modules/state.js"; export {catalogState} from "./app/modules/catalog_state.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { WriterState, catalogState } = box.exports;
  const keys = "CATALOG_AT CATALOG_ERROR CATALOG_EVENTS CATALOG_FORMS CATALOG_FROM_CACHE CATALOG_VERIFIED".split(" ");
  assert.deepEqual(WriterState, {}, "importing a state boundary must not initialize or read catalog fields");
  assert.deepEqual(Object.keys(catalogState).sort(), [...keys].sort());
  assert.equal(Object.isFrozen(catalogState), true);
  for (const key of keys) {
    assert.equal(catalogState[key], undefined, "absent backing fields stay absent");
    assert.equal(Object.hasOwn(WriterState, key), false);
    const original = [],
      replacement = [];
    WriterState[key] = original;
    assert.equal(catalogState[key], original);
    WriterState[key] = replacement;
    assert.equal(catalogState[key], replacement, "restoration must replace the observed reference");
    catalogState[key] = original;
    assert.equal(WriterState[key], original, "writes must reach the existing root store");
    let reads = 0,
      writes = 0,
      value = original;
    Object.defineProperty(WriterState, key, {
      configurable: true,
      get() {
        reads++;
        return value;
      },
      set(next) {
        writes++;
        value = next;
      },
    });
    assert.equal(reads, 0);
    assert.equal(catalogState[key], original);
    assert.equal(reads, 1);
    catalogState[key] = replacement;
    assert.equal(writes, 1);
    assert.equal(value, replacement);
    delete WriterState[key];
  }
  assert.deepEqual(WriterState, {});
  console.log("PASS 6-field live catalog boundary, replacement identity, absent values and accessor timing");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
