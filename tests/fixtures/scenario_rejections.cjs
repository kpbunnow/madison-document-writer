/* Add rejected continuation evidence without changing a scenario's original observations. */
let active = false;
async function observeRejections(run) {
  if (active) throw new Error("Scenario rejection observation must be serial");
  active = true;
  const rejections = [],
    rejected = (error) => rejections.push([error?.name ?? typeof error, error?.message ?? String(error)]);
  process.on("unhandledRejection", rejected);
  try {
    const result = await run();
    // Node reports rejected continuations after draining microtasks, before this check-phase callback.
    await new Promise(setImmediate);
    return JSON.stringify({ ...JSON.parse(result), rejections });
  } finally {
    process.removeListener("unhandledRejection", rejected);
    active = false;
  }
}
module.exports = { observeRejections };
