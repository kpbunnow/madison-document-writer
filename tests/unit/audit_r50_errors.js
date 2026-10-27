/* Explicit save-owner services preserve the two serialization-failure refusal assertions. */
const assert = require("assert/strict"),
  path = require("path"),
  esbuild = require("esbuild");
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents: 'export {createCaseSaveWorkflow} from "./app/modules/case_save_workflow.js";export {WriterState} from "./app/modules/state.js";',
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
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { createCaseSaveWorkflow, WriterState } = box.exports;
  let calls = 0,
    writes = 0,
    messages = [],
    merges = 0;
  const cyclic = {};
  cyclic.self = cyclic;
  WriterState.CASES = [{ id: "one", number: "QA-001", address: "100 TEST ST" }];
  WriterState.CASEDIR = { helper: true };
  WriterState.NEEDGRANT = false;
  const { saveCaseFile } = createCaseSaveWorkflow({
    caseNumberAllowed: () => true,
    caseFile: () => (++calls === 2 ? cyclic : { schema: 5 }),
    toast: (text) => messages.push(text),
    mergeSharedFile: async () => {
      merges++;
      return 0;
    },
    writeToFolder: async () => {
      writes++;
      return { ok: false };
    },
    queuePending: async () => {},
    render: () => {},
  });
  assert.equal(await saveCaseFile("one"), false);
  assert.equal(writes, 0);
  assert.ok(messages.some((x) => x.includes("The case could not be exported")));
  assert.equal(merges, 1);
  calls = 1;
  messages = [];
  assert.equal(await saveCaseFile("one"), false);
  assert.equal(writes, 0);
  assert.ok(messages.some((x) => x.includes("The case could not be exported")));
  assert.equal(merges, 1, "an initial serialization failure never reaches the shared merge");
  console.log("PASS serialization failure never writes empty or stale case bytes");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
