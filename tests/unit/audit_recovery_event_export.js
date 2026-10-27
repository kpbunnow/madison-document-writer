/* Recovery export remains a synchronous event action with the stable stored filename. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: 'export {createRecoveryEvents} from "./app/modules/recovery_events.js";export {WriterState} from "./app/modules/state.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createRecoveryEvents, WriterState } = box.exports;
  let listener,
    calls = [];
  createRecoveryEvents({ publication: { downloadFile: (...args) => calls.push(args) } }).registerRecoveryActions({
    addEventListener: (_type, fn) => {
      listener = fn;
    },
  });
  for (const number of ["CB2026-100-00001", 'QA <&> "test"', 0, null]) {
    const selected = { number, workspace: { version: 2 }, case: { id: "synthetic" } };
    WriterState.RECOVERY = { selected };
    calls = [];
    const button = { dataset: {}, hasAttribute: (name) => name === "data-recovery-export" };
    assert.equal(listener({ target: { closest: () => button } }), undefined);
    assert.deepEqual(calls, [["Madison-recovery-" + number + ".json", JSON.stringify(selected, null, 2)]]);
    assert.equal(WriterState.RECOVERY.selected, selected);
  }
  console.log("PASS synchronous recovery export filename, bytes and selected identity");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
