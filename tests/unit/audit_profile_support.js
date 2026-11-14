/* Shared profiler setup retains source/production guards and exact routing without launching a browser. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { readProfileInputs, pairedPageServer } = require("../../tools/profile_support.cjs");
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dw-profile-"));
  let server;
  try {
    const page = (code) => '<script>var B="' + Buffer.from(code).toString("base64") + '";</script>';
    const before = path.join(dir, "before.html"),
      after = path.join(dir, "after.html"),
      harness = path.join(dir, "runner.cjs");
    fs.writeFileSync(before, page("Open the program from the installed desktop shortcut to reconnect"));
    fs.writeFileSync(after, fs.readFileSync(before));
    fs.writeFileSync(harness, "synthetic runner");
    assert.throws(() => readProfileInputs([], harness), /required/);
    const v = readProfileInputs([before, after, path.join(dir, "result.json")], harness);
    assert.equal(v.pages[0], v.pages[1]);
    assert.equal(v.harnessSha256, v.sha("synthetic runner"));
    v.verifySources();
    server = pairedPageServer(v.pages);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    for (const [route, status, body] of [
      ["/before", 200, v.pages[0]],
      ["/after", 200, v.pages[1]],
      ["/missing", 404, "{}"],
    ]) {
      const r = await fetch("http://127.0.0.1:" + server.address().port + route);
      assert.equal(r.status, status);
      assert.equal(await r.text(), body);
    }
    fs.writeFileSync(harness, "changed");
    assert.throws(() => v.verifySources(), /source changed/);
    fs.writeFileSync(after, page("initTestFixtures"));
    assert.throws(() => readProfileInputs([before, after, "result"], harness), /test build/);
    console.log("PASS shared profiler production/source guards, paired routing and changed-harness refusal");
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
