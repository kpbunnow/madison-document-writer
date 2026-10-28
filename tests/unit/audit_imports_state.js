/* Scoped imports access remains live and never initializes the application. */
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: 'export {WriterState} from "./app/modules/state.js"; export {importsState} from "./app/modules/imports_state.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { WriterState, importsState } = box.exports;
  const keys = "ACC_SELECTION_SERIAL LOOKUP_BUSY LOOKUP_CONTROLLER LOOKUP_ERROR LOOKUP_SERIAL".split(" ");
  assert.deepEqual(WriterState, {}, "importing a state boundary must not initialize or read imports fields");
  assert.deepEqual(Object.keys(importsState).sort(), [...keys].sort());
  assert.equal(Object.isFrozen(importsState), true);
  for (const key of keys) {
    assert.equal(importsState[key], undefined, "absent backing fields stay absent");
    assert.equal(Object.hasOwn(WriterState, key), false);
    const original = [],
      replacement = [];
    WriterState[key] = original;
    assert.equal(importsState[key], original);
    WriterState[key] = replacement;
    assert.equal(importsState[key], replacement, "restoration must replace the observed reference");
    importsState[key] = original;
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
    assert.equal(importsState[key], original);
    assert.equal(reads, 1);
    importsState[key] = replacement;
    assert.equal(writes, 1);
    assert.equal(value, replacement);
    delete WriterState[key];
  }
  assert.deepEqual(WriterState, {});
  console.log("PASS 5-field live imports boundary, replacement identity, absent values and accessor timing");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
