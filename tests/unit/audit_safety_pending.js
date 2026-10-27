/* Pending save actions dispatch synchronously and retain the existing holder/no-holder behavior. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents: 'export {createSafetyEvents} from "./app/modules/safety_events.js";export {WriterState} from "./app/modules/state.js";',
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
  new Function("document", "module", "exports", built.outputFiles[0].text)({ getElementById: () => null }, box, box.exports);
  const { createSafetyEvents, WriterState: s } = box.exports;
  let listener,
    calls = [],
    status = {};
  const api = createSafetyEvents({
    caseState: () => status,
    render: () => calls.push("render"),
    commitAmendment: (...args) => {
      calls.push(["commit", ...args]);
      return Promise.resolve();
    },
    toast: (message) => calls.push(["error", message]),
  });
  api.registerSafetyActions({ addEventListener: (type, fn) => (listener = fn) });
  const target = {
    dataset: { safetyCase: "c", safetyAction: "pending" },
    hasAttribute: () => false,
    closest() {
      return this;
    },
  };
  s.CASES = [{ id: "c" }];
  s.state = {};
  s.RECORD_ATTEMPTS = {};
  status = { pendingDoc: { id: "d" } };
  let pending = listener({ target });
  assert.deepEqual(calls, ["render"]);
  await pending;
  assert.deepEqual(s.state, { docId: "d", screen: "write" });
  calls = [];
  const holder = { cid: "c", pendingAmendment: { id: "attempt" } };
  s.RECORD_ATTEMPTS = { attempt: holder };
  status = { pendingRecord: { recordKey: "attempt" } };
  pending = listener({ target });
  assert.deepEqual(calls, [["commit", "c", holder.pendingAmendment, holder]], "the amendment dispatch occurs before any await");
  await pending;
  calls = [];
  s.RECORD_ATTEMPTS = {};
  await listener({ target });
  assert.deepEqual(calls, []);
  console.log("PASS independent pending safety actions: document, live holder and absent holder");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
