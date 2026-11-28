/* Rejection evidence is scoped, serial and cleaned up; no global rejection suppression survives. */
const assert = require("node:assert/strict"),
  { observeRejections } = require("../fixtures/scenario_rejections.cjs");
(async () => {
  const before = process.listenerCount("unhandledRejection");
  const clean = JSON.parse(await observeRejections(() => JSON.stringify({ calls: ["original"], error: ["Error", "synchronous"] })));
  assert.deepEqual(clean, { calls: ["original"], error: ["Error", "synchronous"], rejections: [] });
  const rejected = JSON.parse(
    await observeRejections(() => {
      Promise.resolve().then(() => {
        throw new TypeError("unexpected finalizer");
      });
      Promise.reject("non-Error refusal");
      Promise.reject(Error("handled refusal")).catch(() => {});
      return JSON.stringify({ calls: ["original"] });
    }),
  );
  assert.deepEqual(rejected, {
    calls: ["original"],
    rejections: [
      ["string", "non-Error refusal"],
      ["TypeError", "unexpected finalizer"],
    ],
  });
  assert.notDeepEqual(rejected, clean, "a changed rejection cannot compare equal to the original observations");
  assert.deepEqual(JSON.parse(await observeRejections(() => "{}")), { rejections: [] }, "later scenarios start empty");
  await assert.rejects(
    observeRejections(() => {
      throw Error("synchronous refusal");
    }),
    /synchronous refusal/,
  );
  await assert.rejects(
    observeRejections(async () => {
      throw Error("awaited refusal");
    }),
    /awaited refusal/,
  );
  await assert.rejects(
    observeRejections(() => "not JSON"),
    SyntaxError,
  );
  let release;
  const held = observeRejections(
    () =>
      new Promise((resolve) => {
        release = () => resolve("{}");
      }),
  );
  await assert.rejects(
    observeRejections(() => "{}"),
    /must be serial/,
  );
  release();
  await held;
  assert.equal(process.listenerCount("unhandledRejection"), before, "all outcomes remove the temporary listener");
  console.log("PASS scenario rejection evidence: continuations, handled/non-Error refusals, isolation, serialization and cleanup");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
