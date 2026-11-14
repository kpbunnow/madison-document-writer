/* Shared setup for the two matched production profilers. Diagnostics only, never release evidence. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  crypto = require("node:crypto");
const { assertProductionPage } = require("../tests/fixtures/built_bundle.cjs");
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
function readProfileInputs(argv, harness) {
  const [before, after, output] = argv;
  assert.ok(before && after && output, "before.html after.html output.json required");
  const pages = [before, after].map((p) => assertProductionPage(path.resolve(p)));
  const sources = { [path.resolve(harness)]: sha(fs.readFileSync(harness)), [__filename]: sha(fs.readFileSync(__filename)) };
  const verifySources = () => {
    for (const [file, digest] of Object.entries(sources))
      assert.equal(sha(fs.readFileSync(file)), digest, "Profiler source changed during the workload: " + file);
  };
  return { pages, output, sha, harnessSha256: sources[path.resolve(harness)], supportSha256: sources[__filename], verifySources };
}
function pairedPageServer(pages) {
  return http.createServer((req, res) => {
    const i = req.url === "/before" ? 0 : req.url === "/after" ? 1 : -1;
    res.writeHead(i < 0 ? 404 : 200, { "Content-Type": i < 0 ? "application/json" : "text/html" });
    res.end(i < 0 ? "{}" : pages[i]);
  });
}
module.exports = { readProfileInputs, pairedPageServer };
