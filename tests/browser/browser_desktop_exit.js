/* Exit Document Writer in production Chromium against a real, separate helper process (server.py as the
   desktop launcher starts it), so the audit's own helper keeps running: Writer and Reports are open, a
   publication in flight refuses, Exit stops the helper (the process exits and the port closes) and both pages
   show the stopped state. Synthetic data only; the copied runtime and profile folders are temporary. */
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  assert = require("assert/strict");
const { spawn } = require("child_process");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SKIP = new Set([
  "Case JSON Files",
  "Documents To Be Mailed And Recorded",
  "Draft Backups",
  ".locks",
  "logs",
  "__pycache__",
  ".helper-session.json",
]);

async function freePort() {
  return new Promise((resolve) => {
    const socket = require("net").createServer();
    socket.listen(0, "127.0.0.1", () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

async function answers(base) {
  try {
    return (await fetch(base + "/dw-status")).ok;
  } catch (error) {
    return false;
  }
}

module.exports = async function (browser, OUT, axeScreen, work) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "madison-exit-")),
    runtime = path.join(root, "runtime"),
    profile = path.join(root, "profile");
  fs.cpSync(work, runtime, { recursive: true, filter: (p) => !SKIP.has(path.basename(p)) && !path.basename(p).startsWith("__qa") });
  fs.mkdirSync(path.join(runtime, "Case JSON Files"));
  fs.mkdirSync(profile);
  const port = await freePort(),
    base = "http://127.0.0.1:" + port;
  let log = "";
  const helper = spawn(process.env.PYTHON || "python3", ["-u", path.join(runtime, "server.py")], {
    cwd: runtime,
    env: {
      ...process.env,
      DW_PORT: String(port),
      DW_OPEN_BROWSER: "0",
      DW_CASE_DIR: path.join(runtime, "Case JSON Files"),
      LOCALAPPDATA: profile,
      PYTHONDONTWRITEBYTECODE: "1",
    },
  });
  const exited = new Promise((resolve) => helper.on("exit", (code, signal) => resolve({ code, signal })));
  helper.stdout.on("data", (b) => (log += b));
  helper.stderr.on("data", (b) => (log += b));
  let context;
  try {
    for (let n = 0; n < 100 && !(await answers(base)); n++) await delay(100);
    assert.ok(await answers(base), "the separate helper started: " + log);
    const session = JSON.parse(fs.readFileSync(path.join(profile, "MadisonDocWriter", ".helper-session.json"), "utf8"));
    context = await browser.newContext({ timezoneId: "America/Chicago", viewport: { width: 1280, height: 900 } });
    // This helper's own private bootstrap (the audit's context hook adds the audit helper's for its origin).
    await context.addInitScript((master) => {
      try {
        localStorage.setItem("madison-helper-bootstrap", master);
      } catch (error) {}
    }, session.bootstrap);
    const errors = [];
    context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
    const writer = await context.newPage();
    await writer.goto(base + "/");
    await writer.waitForFunction(() => typeof WriterState !== "undefined" && WriterState.HELPER && WriterState.WRITER_READY !== undefined);
    const reports = await context.newPage();
    await reports.goto(base + "/madison-reports.html");
    await reports.waitForFunction(() => typeof ReportsState !== "undefined" && ReportsState.S.phase && ReportsState.S.phase !== "loading");

    await writer.bringToFront();
    await writer.locator('.writer-navigation [data-nav="tools"]').click();
    await writer.getByRole("heading", { name: "Tools & settings", exact: true }).waitFor();
    // Refused while a publication is in flight in this window.
    await writer.evaluate(() => (WriterState.state.publicationBusy = "qa-exit-publication"));
    await writer.locator("[data-exit-writer]").click();
    const dialog = writer.locator("#utility-dialog");
    await dialog.getByRole("heading", { name: "Exit Document Writer" }).waitFor();
    assert.match(await dialog.locator("[data-exit-blocking]").innerText(), /A document is being issued/);
    assert.equal(await dialog.locator("[data-exit-confirm]").count(), 0);
    await axeScreen(writer, "exit-dialog-refused");
    await writer.evaluate(() => (WriterState.state.publicationBusy = null));
    await dialog.locator("[data-exit-recheck]").click();
    await dialog.locator("[data-exit-confirm]").waitFor();
    assert.equal(await dialog.locator("[data-exit-blocking]").count(), 0);
    assert.match(await dialog.innerText(), /any other open Writer or Reports windows lose their connection/);
    assert.equal((await dialog.locator("[data-utility-close]").innerText()).trim(), "Cancel");
    await axeScreen(writer, "exit-dialog");
    assert.ok(await answers(base), "the helper still runs while the dialog is open");

    await dialog.locator("[data-exit-confirm]").click();
    await writer.locator("[data-helper-stopped]").waitFor({ timeout: 15000 });
    assert.equal((await writer.locator("[data-helper-stopped] h1").innerText()).trim(), "Document Writer has stopped");
    assert.match(
      await writer.locator("[data-helper-stopped]").innerText(),
      /You can close this window\. To start again, double-click Document Writer on the desktop\./,
    );
    await reports.locator("[data-helper-stopped]").waitFor({ timeout: 10000 });
    assert.match(await reports.locator("[data-helper-stopped]").innerText(), /Reports cannot read case records until Document Writer starts again/);
    await axeScreen(writer, "exit-stopped");

    const ended = await Promise.race([exited, delay(15000).then(() => null)]);
    assert.ok(ended, "the helper process exited after Exit Document Writer: " + log);
    assert.equal(ended.code, 0, "clean exit: " + log);
    assert.equal(await answers(base), false, "the port is closed");
    assert.match(log, /Document Writer has stopped\./);
    assert.equal(log.includes(session.token), false, "the session token is never printed");
    assert.deepEqual(errors, []);
    await writer.screenshot({ path: path.join(OUT, "exit-stopped.png") });
    return { stopped: true, exitCode: ended.code, portClosed: true, reportsStopped: true, refusedDuringPublication: true };
  } finally {
    await context?.close();
    if (helper.exitCode === null && helper.signalCode === null) helper.kill(); // Test cleanup of this test's own child only.
    fs.rmSync(root, { recursive: true, force: true });
  }
};
