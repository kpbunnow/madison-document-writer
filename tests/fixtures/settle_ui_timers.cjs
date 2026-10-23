/* Consolidation Phase 2 (T1): test-owned teardown for suites whose completed work leaves only the application's
   long UI timers pending (15-second warnings, 7-second progress, the Reports handoff notice). Without it Node waits
   for those timers in real time before exiting.

   Require this before evaluating the bundle; it records the timers created afterwards. Pass the suite's completion
   (the value its eval returns; a promise for an async suite) to settle(). After completion settles, the event loop
   runs normally until only timers of a second or longer remain; those are then run one at a time, earliest due
   first, instead of being waited for. Every callback still runs exactly once and its errors propagate (an uncaught
   error or rejection still fails the suite), so this never discards work: it removes the idle wait only. Production
   timer durations are unchanged. Finally the test window is closed. */
"use strict";
const LONG_MS = 1000;
const native = {
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout,
  setInterval: global.setInterval,
  clearInterval: global.clearInterval,
  setImmediate: global.setImmediate,
};
const pending = new Map();
global.setTimeout = function (fn, ms, ...args) {
  const delay = Number(ms) || 0;
  const handle = native.setTimeout(
    function () {
      pending.delete(handle);
      return fn.apply(this, arguments);
    },
    delay,
    ...args,
  );
  pending.set(handle, { fn, args, delay, due: Date.now() + delay, interval: false });
  return handle;
};
global.clearTimeout = function (handle) {
  pending.delete(handle);
  return native.clearTimeout(handle);
};
global.setInterval = function (fn, ms, ...args) {
  const delay = Number(ms) || 0;
  const handle = native.setInterval(fn, delay, ...args);
  pending.set(handle, { fn, args, delay, due: Date.now() + delay, interval: true });
  return handle;
};
global.clearInterval = function (handle) {
  pending.delete(handle);
  return native.clearInterval(handle);
};

async function drain() {
  for (let round = 0; round < 10000; round++) {
    await new Promise((resolve) => native.setImmediate(resolve));
    // Unreferenced timers never keep the process alive, so they are neither waited for nor run.
    const live = [...pending.entries()].filter(([handle]) => !handle.hasRef || handle.hasRef());
    if (!live.length) return;
    if (live.some(([, timer]) => timer.interval))
      throw new Error("A referenced interval is still running after the suite completed; stop it explicitly.");
    if (live.some(([, timer]) => timer.delay < LONG_MS)) {
      // Short timers are ordinary pending work: let them fire on their own.
      await new Promise((resolve) => native.setTimeout(resolve, 10));
      continue;
    }
    const [handle, timer] = live.sort((a, b) => a[1].due - b[1].due)[0];
    native.clearTimeout(handle);
    pending.delete(handle);
    timer.fn.apply(globalThis, timer.args);
  }
  throw new Error("Long UI timers did not settle after the suite completed.");
}

/* completion: the suite's eval result. A rejection is not handled here, so it still fails the suite. */
function settle(completion, window) {
  return Promise.resolve(completion)
    .then(drain)
    .then(() => window?.close?.());
}

module.exports = { settle };
