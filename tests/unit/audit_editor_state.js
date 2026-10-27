/* Scoped editor access remains live and never initializes the application. */
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: 'export {WriterState} from "./app/modules/state.js"; export {editorState} from "./app/modules/editor_state.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { WriterState, editorState } = box.exports;
  const keys =
    "state WORK LOCAL_SAVE draftTimer RECORD_ATTEMPTS AMENDMENT_BUSY FILING_ACTIVE undoFn WORK_PATCH LOCAL_CHANGED LOCAL_SAVE_CHAIN dragging groupOld RESOLUTION_BUSY SAFETY_HEALTH SAFETY_LOCK".split(
      " ",
    );
  assert.deepEqual(WriterState, {}, "importing a state boundary must not initialize or read editor fields");
  assert.deepEqual(Object.keys(editorState).sort(), [...keys].sort());
  assert.equal(Object.isFrozen(editorState), true);
  for (const key of keys) {
    assert.equal(editorState[key], undefined, "absent backing fields stay absent");
    assert.equal(Object.hasOwn(WriterState, key), false);
    const original = [],
      replacement = [];
    WriterState[key] = original;
    assert.equal(editorState[key], original);
    WriterState[key] = replacement;
    assert.equal(editorState[key], replacement, "restoration must replace the observed reference");
    editorState[key] = original;
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
    assert.equal(editorState[key], original);
    assert.equal(reads, 1);
    editorState[key] = replacement;
    assert.equal(writes, 1);
    assert.equal(value, replacement);
    delete WriterState[key];
  }
  assert.deepEqual(WriterState, {});
  WriterState.state = { screen: "write", docId: "old" };
  const captured = editorState.state;
  WriterState.state = { screen: "cases", docId: "new" };
  assert.equal(captured.docId, "old", "an explicit capture must keep the original view pointer");
  assert.equal(editorState.state.docId, "new", "direct access must resolve the current view pointer");
  editorState.state = captured;
  assert.equal(WriterState.state, captured);
  console.log("PASS 16-field live editor boundary, replacement identity, absent values and accessor timing");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
