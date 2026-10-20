/* A browser workflow must finish; a stalled promise cannot silently hang the gate. */
const timings = [];
async function runSuite(name, body, timeoutMs = 150000) {
  const started = performance.now();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(body),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(name + " exceeded " + timeoutMs + " ms")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    timings.push({ suite: name, elapsedMs: Math.round(performance.now() - started), limitMs: timeoutMs });
  }
}
module.exports = { runSuite, timings };
