/* Real production page, real helper restart, no global default auth headers. */
const fs = require("fs"),
  path = require("path"),
  os = require("os"),
  assert = require("assert/strict"),
  { spawn } = require("child_process");
const { chromium } = require("playwright");
const root = require("path").resolve(__dirname, "../.."),
  work = fs.mkdtempSync(path.join(os.tmpdir(), "madison-session-"));
let browser, helper;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "build/generated/runtime-manifest.json"), "utf8"));
  for (const [name, source] of Object.entries(manifest.deploy)) {
    if (name.includes("/") || name.endsWith(".bat")) continue;
    const runtime =
      process.env.DW_PRODUCTION_DIR && ["madison-document-writer.html", "madison-reports.html"].includes(name)
        ? path.join(process.env.DW_PRODUCTION_DIR, name)
        : path.join(root, source);
    fs.copyFileSync(runtime, path.join(work, name));
  }
  fs.cpSync(path.join(root, "helper/vendor"), path.join(work, "vendor"), { recursive: true, filter: (p) => !p.includes("__pycache__") });
  fs.mkdirSync(path.join(work, "Case JSON Files"));
  fs.writeFileSync(
    path.join(work, "qa-session.py"),
    "import server\nwith server.Server(('127.0.0.1',server.PORT),server.Handle" +
      "r) as http:\n    server.start_session(server.HERE)\n    http.serve_forever" +
      "()\n",
  );
  const port = await new Promise((resolve) => {
    const socket = require("net").createServer();
    socket.listen(0, "127.0.0.1", () => {
      const p = socket.address().port;
      socket.close(() => resolve(p));
    });
  });
  const base = "http://127.0.0.1:" + port;
  async function start() {
    helper = spawn(process.env.PYTHON || "python3", ["-u", path.join(work, "qa-session.py")], {
      cwd: work,
      env: { ...process.env, DW_PORT: String(port), DW_OPEN_BROWSER: "0", DW_CASE_DIR: path.join(work, "Case JSON Files") },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let log = "";
    helper.stderr.on("data", (b) => (log += b));
    for (let i = 0; i < 100; i++) {
      if (helper.exitCode !== null) throw Error(log);
      try {
        if ((await fetch(base + "/dw-status")).ok) return;
      } catch (e) {}
      await delay(50);
    }
    throw Error("Helper did not start: " + log);
  }
  async function stop() {
    const child = helper;
    await new Promise((resolve) => {
      child.once("exit", resolve);
      child.kill();
    });
    helper = null;
  }
  await start();
  const first = JSON.parse(fs.readFileSync(path.join(work, ".helper-session.json"), "utf8"));
  assert.equal((await fetch(base + "/cases/list")).status, 403);
  assert.ok(!(await (await fetch(base + "/")).text()).includes(first.token));
  browser = await chromium.launch({ headless: true, executablePath: process.env.DW_BROWSER, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/#session=" + first.token);
  await page.waitForFunction(() => typeof WriterState.HELPER !== "undefined" && WriterState.HELPER?.ok);
  assert.equal(await page.evaluate(() => location.hash), "");
  assert.equal(await page.locator("meta[name=docwriter-token]").getAttribute("content"), first.token);
  await page.evaluate(async () => {
    WriterState.CASES.push({ id: "r50-kept", number: "QA-R50-SESSION", address: "100 SYNTHETIC STREET", owner: "SYNTHETIC OWNER" });
    await saveDrafts();
  });
  await stop();
  await start();
  const next = JSON.parse(fs.readFileSync(path.join(work, ".helper-session.json"), "utf8"));
  assert.notEqual(next.token, first.token);
  assert.equal(next.bootstrap, first.bootstrap);
  assert.equal((await fetch(base + "/cases/list", { headers: { "X-DocWriter-Token": first.token } })).status, 403);
  await page.reload();
  await page.waitForFunction(
    () => typeof WriterState.HELPER !== "undefined" && WriterState.HELPER?.ok && WriterState.CASES.some((k) => k.id === "r50-kept"),
  );
  assert.equal(await page.locator("meta[name=docwriter-token]").getAttribute("content"), next.token);
  assert.equal(
    await page.evaluate(async () => {
      const r = await helperJSON("/cases/list");
      return r.ok;
    }),
    true,
  );
  const stranger = await browser.newContext();
  const publicPage = await stranger.newPage();
  await publicPage.goto(base + "/");
  await publicPage.getByText("Open Document Writer from the installed desktop shortcut.", { exact: true }).waitFor();
  assert.equal(await publicPage.locator("meta[name=docwriter-token]").getAttribute("content"), "");
  await stranger.close();
  assert.deepEqual(errors, []);
  console.log("PASS real browser token bootstrap, restart refusal, reload recovery and retained device work");
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (helper) helper.kill();
    fs.rmSync(work, { recursive: true, force: true });
  });
