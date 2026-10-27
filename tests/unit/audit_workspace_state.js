/* Scoped workspace access remains live and never initializes the application. */
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: 'export {WriterState} from "./app/modules/state.js"; export {workspaceState} from "./app/modules/workspace_state.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { WriterState, workspaceState } = box.exports;
  const keys =
    "CASES DOCS REINSP EVENTS PENDING DIRTY CASEDIR DIRNAME NEEDGRANT LASTINDEX LASTWRITE WORKFLOW_PREFS SAVE_CHECKPOINTS PREFLIGHT_CONFLICT PREFLIGHT_NOTICE PREFLIGHT_SEQ seq IDBCONN TIMELINE_CASE TIMELINE_FILTER ARTIFACT_IDENTITY ARTIFACT_LOCATIONS ARTIFACT_SEQ ARTIFACT_VERIFY OUTBOX_FILES".split(
      " ",
    );
  assert.deepEqual(WriterState, {}, "importing a state boundary must not initialize or read workspace fields");
  assert.deepEqual(Object.keys(workspaceState).sort(), [...keys].sort());
  assert.equal(Object.isFrozen(workspaceState), true);
  for (const key of keys) {
    assert.equal(workspaceState[key], undefined, "absent backing fields stay absent");
    assert.equal(Object.hasOwn(WriterState, key), false);
    const original = [],
      replacement = [];
    WriterState[key] = original;
    assert.equal(workspaceState[key], original);
    WriterState[key] = replacement;
    assert.equal(workspaceState[key], replacement, "restoration must replace the observed reference");
    workspaceState[key] = original;
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
    assert.equal(workspaceState[key], original);
    assert.equal(reads, 1);
    workspaceState[key] = replacement;
    assert.equal(writes, 1);
    assert.equal(value, replacement);
    delete WriterState[key];
  }
  assert.deepEqual(WriterState, {});
  console.log("PASS 25-field live workspace boundary, replacement identity, absent values and accessor timing");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
