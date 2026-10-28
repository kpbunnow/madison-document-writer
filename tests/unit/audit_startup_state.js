/* Scoped startup access remains live and never initializes the application. */
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: 'export {WriterState} from "./app/modules/state.js"; export {startupState} from "./app/modules/startup_state.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { WriterState, startupState } = box.exports;
  const keys =
    "STARTUP_STATUS STARTUP_ERROR WRITER_READY WRITER_ACCESS WRITER_CHANNEL releaseWriterReady releaseWorkspaceLock WORKSPACE_RESTORED HELPER HANDOFF_SEQ RETURN_ACK REPORT_RETURN".split(
      " ",
    );
  assert.deepEqual(WriterState, {}, "importing a state boundary must not initialize or read startup fields");
  assert.deepEqual(Object.keys(startupState).sort(), [...keys].sort());
  assert.equal(Object.isFrozen(startupState), true);
  for (const key of keys) {
    assert.equal(startupState[key], undefined, "absent backing fields stay absent");
    assert.equal(Object.hasOwn(WriterState, key), false);
    const original = [],
      replacement = [];
    WriterState[key] = original;
    assert.equal(startupState[key], original);
    WriterState[key] = replacement;
    assert.equal(startupState[key], replacement, "restoration must replace the observed reference");
    startupState[key] = original;
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
    assert.equal(startupState[key], original);
    assert.equal(reads, 1);
    startupState[key] = replacement;
    assert.equal(writes, 1);
    assert.equal(value, replacement);
    delete WriterState[key];
  }
  assert.deepEqual(WriterState, {});
  console.log("PASS 12-field live startup boundary, replacement identity, absent values and accessor timing");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
