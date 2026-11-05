/* Native persistent-profile crash recovery against the production page and real helper. Synthetic data only. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const crypto = require("node:crypto");
const { spawn, execFileSync } = require("node:child_process");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "../..");
const native = process.argv.includes("--require-windows");
assert.ok(native || process.argv.includes("--portable"), "Choose native Windows or explicitly labelled portable diagnostics");
if (native) assert.equal(process.platform, "win32", "Native Windows evidence requires Windows");
const OUT = path.resolve(process.env.DW_WINDOWS_OUTPUT || path.join(ROOT, "build/windows-recovery"));
fs.mkdirSync(OUT, { recursive: true });
for (const name of ["browser.json", "combined.json"]) fs.rmSync(path.join(OUT, name), { force: true });
const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "dw-browser-recovery-"));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha = (body) => crypto.createHash("sha256").update(body).digest("hex");
const runtimeHashes = Object.fromEntries(
  ["madison-document-writer.html", "madison-reports.html"].map((n) => [n, sha(fs.readFileSync(path.join(ROOT, "build/dist", n)))]),
);
const source = () =>
  JSON.parse(
    execFileSync(
      python,
      [
        "-c",
        "import sys,json;from pathlib import Path;sys.path.insert(0,'tools');from release_evidence import fingerprint,source_provenance;r=Path.cwd();i=fingerprint(r);print(json.dumps({'inputs':i,**source_provenance(r,i)}))",
      ],
      { cwd: ROOT, encoding: "utf8" },
    ),
  );
const originalSource = source();
if (native) assert.equal(originalSource.sourceClean, true, "Native recovery evidence requires a clean reviewed commit");
const report = {
  format: "madison-browser-recovery",
  version: 1,
  mode: native ? "native-windows" : "portable-not-Windows-evidence",
  passed: false,
  platform: process.platform,
  sourceCommit: originalSource.sourceCommit,
  sourceClean: originalSource.sourceClean,
  runtimeHashes,
  identity: { run: process.env.GITHUB_RUN_ID || "local", attempt: process.env.GITHUB_RUN_ATTEMPT || "1" },
  checks: [],
  limits: [
    "Synthetic isolated profiles and helper",
    "Forced process death, not physical power loss",
    "SQL, Outlook, City GIS and City acceptance not exercised",
  ],
};
let combined,
  helper,
  context,
  base,
  offline = true,
  failRead = false;
const profile = path.join(work, "chromium-profile");
const privateSession = path.join(work, "profile", "MadisonDocWriter", ".helper-session.json");
const check = (scenario) => report.checks.push({ scenario, passed: true });
async function stopHelper() {
  if (!helper || helper.exitCode !== null) return;
  const stopped = new Promise((resolve) => helper.once("exit", resolve));
  helper.kill("SIGKILL");
  await stopped;
}
async function startHelper(port) {
  helper = spawn(python, ["-u", path.join(work, "recovery-server.py")], {
    cwd: work,
    env: {
      ...process.env,
      LOCALAPPDATA: path.join(work, "profile"),
      DW_CASE_DIR: path.join(work, "Case JSON Files"),
      DW_PORT: String(port),
      DW_OPEN_BROWSER: "0",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let errors = "";
  helper.stderr.on("data", (b) => {
    errors += b;
  });
  for (let n = 0; n < 200; n++) {
    if (helper.exitCode !== null) throw new Error("Synthetic helper failed: " + errors);
    try {
      if ((await fetch(base + "/dw-status")).ok && fs.existsSync(privateSession)) return;
    } catch {}
    await delay(100);
  }
  throw new Error("Synthetic helper did not become ready");
}
async function open(profilePath = profile) {
  context = await chromium.launchPersistentContext(profilePath, {
    headless: true,
    timezoneId: "America/Chicago",
    viewport: { width: 1400, height: 1000 },
    ...(process.env.DW_BROWSER ? { executablePath: process.env.DW_BROWSER } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const session = JSON.parse(fs.readFileSync(privateSession, "utf8"));
  await context.addInitScript(
    ({ bootstrap, badRead }) => {
      if (location.protocol !== "http:") return;
      localStorage.setItem("madison-helper-bootstrap", bootstrap);
      if (badRead)
        indexedDB.open = () => {
          throw new DOMException("Synthetic required-read failure", "UnknownError");
        };
    },
    { bootstrap: session.bootstrap, badRead: failRead },
  );
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname === "/dw-status") {
      const response = await route.fetch();
      return route.fulfill({ json: { ...(await response.json()), caseLookup: false } }); // SQL is City acceptance, not this test.
    }
    if (url.pathname.startsWith("/inspector-cases/")) return route.abort();
    if (offline && url.pathname.startsWith("/cases/"))
      return route.fulfill({ status: 503, json: { ok: false, error: "Synthetic unavailable shared folder" } });
    return route.continue();
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(base + "/");
  if (!failRead) await page.waitForFunction(() => typeof WriterState !== "undefined" && WriterState.WRITER_READY === true);
  return page;
}
async function crashBrowser() {
  const client = await context.browser().newBrowserCDPSession();
  const { processInfo } = await client.send("SystemInfo.getProcessInfo");
  const pid = processInfo.find((p) => p.type === "browser")?.id;
  assert.ok(Number.isInteger(pid) && pid > 0, "Identify the actual Chromium process before terminating it");
  const closed = context.waitForEvent("close");
  if (process.platform === "win32") execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  else process.kill(pid, "SIGKILL");
  await closed;
  context = null;
}
async function snapshot(page) {
  return page.evaluate(async () => {
    const b = await idbGet("drafts", true),
      pending = await idbGet("pending", true);
    const d = b.docs.find((d) => d.caseId === "win-private");
    return {
      text: d?.items[0]?.text,
      note: b.work.recordForms?.[d?.id + ":recordnote"]?.text,
      entry: b.work.entry["lookup-number"],
      walk: b.work.walk,
      pending: (pending || []).map((p) => ({ name: p.name, body: p.body })),
    };
  });
}
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "build/generated/runtime-manifest.json"), "utf8"));
  for (const [name, input] of Object.entries(manifest.deploy)) {
    const target = path.join(work, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(ROOT, input), target);
  }
  fs.cpSync(path.join(ROOT, "helper/vendor"), path.join(work, "vendor"), { recursive: true });
  fs.writeFileSync(
    path.join(work, "recovery-server.py"),
    "import runpy,subprocess,sys\ntry:\n    runpy.run_path('server.py', run_name='__main__')\nexcept subprocess.CalledProcessError as error:\n    sys.stderr.buffer.write(error.stderr or b'')\n    raise\n",
  );
  fs.mkdirSync(path.join(work, "Case JSON Files"));
  const fixtureFile = path.join(work, "fixture.json");
  execFileSync(python, [path.join(ROOT, "tests/windows/interruption_recovery.py"), "--fixture-output", fixtureFile], { cwd: ROOT, stdio: "pipe" });
  const issued = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
  const sharedName = "101 TEST LANE - QA-LIFE.json";
  fs.writeFileSync(path.join(work, "Case JSON Files", sharedName), JSON.stringify(issued));
  const port = await new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
  });
  base = "http://127.0.0.1:" + port;
  await startHelper(port);
  let page = await open();
  await page.evaluate(
    async ({ queued, name }) => {
      WriterState.CASES = [
        {
          id: "win-private",
          number: "QA-WIN-PRIVATE",
          address: "100 SYNTHETIC AVENUE",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["100 TEST ROAD", "Madison, WI 53703"],
          inspectorId: INSPECTORS[0].id,
          date: "2026-03-07",
          time: "09:00",
          emails: [],
        },
      ];
      newDoc("win-private", "notice");
      const d = doc(WriterState.state.docId);
      d.items = [
        { id: "private-item", no: "1", title: "Synthetic wall", text: "Retain Jos\u00e9 \u2014 private wording.", sections: ["27.05(2)(c)"] },
      ];
      WriterState.WORK.recordForms[d.id + ":recordnote"] = { text: "Synthetic unfinished record note", external: "" };
      WriterState.WORK.entry["lookup-number"] = "QA-RETAIN-IMPORT";
      WriterState.WORK.walk = { context: "win-private|synthetic-visit|" + d.id, item: "private-item" };
      if (!(await saveDrafts())) throw new Error("Initial device save was not acknowledged");
      if (!(await queuePending(name, queued, ""))) throw new Error("Initial queue save was not acknowledged");
    },
    { queued: JSON.stringify(issued), name: sharedName },
  );
  const expected = await snapshot(page);
  assert.equal(expected.text, "Retain Jos\u00e9 \u2014 private wording.");
  assert.equal(expected.pending.length, 1);
  await crashBrowser();
  page = await open();
  assert.deepEqual(await snapshot(page), expected);
  check("committed-draft-notes-import-walk-and-held-save-survive-browser-termination");

  // Keep a real IndexedDB write transaction alive after its put succeeds, then kill Chromium before commit/ack.
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = put.call(this, value, key);
      if (key === "drafts") {
        const store = this;
        request.addEventListener("success", () => {
          window.__recoveryTransactionOpen = true;
          const keep = () => store.get("__synthetic_keepalive").addEventListener("success", keep);
          keep();
        });
      }
      return request;
    };
    WriterState.DOCS.find((d) => d.caseId === "win-private").items[0].text = "UNCOMMITTED synthetic replacement";
    window.__interruptedSave = saveDrafts();
  });
  await page.waitForFunction(() => window.__recoveryTransactionOpen === true);
  await crashBrowser();
  page = await open();
  assert.deepEqual(await snapshot(page), expected, "Uncommitted real IndexedDB transaction must roll back after forced process death");
  check("uncommitted-IndexedDB-write-rolls-back-after-browser-termination");

  await crashBrowser();
  await stopHelper();
  await startHelper(port);
  page = await open();
  await page.getByRole("heading", { name: "Document Writer was not exited last time" }).waitFor();
  assert.deepEqual(await snapshot(page), expected, "Helper restart must not silently clear unfinished work");
  assert.equal(await page.locator('[name="clearUnfinished"]').isChecked(), false);
  await page.locator("#utility-dialog [data-utility-close]").click();
  check("browser-and-helper-restart-retains-work-until-explicit-clear-confirmation");

  const refused = await page.evaluate(async () => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const result = put.call(this, value, key);
      if (key === "drafts") this.transaction.abort();
      return result;
    };
    WriterState.DOCS.find((d) => d.caseId === "win-private").items[0].text = "Retried synthetic wording";
    try {
      return await saveDrafts();
    } finally {
      IDBObjectStore.prototype.put = put;
    }
  });
  assert.equal(refused, false, "Actual IndexedDB abort cannot acknowledge a save");
  assert.deepEqual(await snapshot(page), expected);
  assert.equal(await page.evaluate(() => saveDrafts()), true);
  expected.text = "Retried synthetic wording";
  assert.deepEqual(await snapshot(page), expected);
  check("actual-IndexedDB-abort-preserves-prior-bytes-and-retry-commits");

  await crashBrowser();
  failRead = true;
  page = await open();
  await page.getByRole("heading", { name: "Saved workspace could not be restored" }).waitFor();
  assert.equal(await page.evaluate(() => saveDrafts()), false);
  assert.equal(await page.locator(".writer-navigation").count(), 0);
  await crashBrowser();
  failRead = false;
  page = await open();
  assert.deepEqual(await snapshot(page), expected);
  check("failed-required-read-blocks-editing-and-restart-restores-original-work");

  offline = false;
  assert.equal(await page.evaluate(() => flushPending()), 1, "Real helper confirms held save before removal");
  expected.pending = [];
  assert.deepEqual(await snapshot(page), expected);
  const shared = JSON.parse(fs.readFileSync(path.join(work, "Case JSON Files", sharedName), "utf8"));
  assert.deepEqual(shared.events, issued.events, "Retried held save must not duplicate or alter issued history");
  check("held-save-reconnects-to-real-helper-without-duplicate-issuance");

  const downloadReady = page.waitForEvent("download");
  await page.evaluate(() => downloadWorkspace());
  const download = await downloadReady;
  const backup = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  assert.equal(backup.format, "madison-workspace-backup");
  assert.equal(backup.version, 2);
  await context.close();
  context = null;
  const restoredProfile = path.join(work, "restored-profile");
  page = await open(restoredProfile);
  assert.equal(await page.evaluate((value) => restoreWorkspaceBackup(value), backup), true);
  assert.deepEqual(await snapshot(page), expected);
  await crashBrowser();
  page = await open(restoredProfile);
  assert.deepEqual(await snapshot(page), expected, "Downloaded backup must remain restored after another process death");
  check("downloaded-workspace-backup-restores-and-survives-subsequent-crash");
  report.browserVersion = context.browser().version();
  report.playwright = require("playwright/package.json").version;
  assert.deepEqual(source(), originalSource, "Source/runtime changed during native browser recovery tests");
  report.passed = true;
  if (native) {
    const filesystem = JSON.parse(fs.readFileSync(path.join(OUT, "filesystem.json"), "utf8"));
    const expectedCases = [
      "forced-install-journal",
      "forced-install-file:1",
      "forced-install-file:3",
      "forced-install-commit",
      "native-NTFS-delete-sharing-refusal-and-retry",
      "native-live-PID-protection-token-refusal-and-orphan-recovery",
      ...["new-intent", "intent", "after-case", "registry", "before-case", "append-after-case", "SMB-disconnect-before-publish"].map(
        (s) => "forced-case-" + s,
      ),
    ];
    assert.equal(filesystem.mode, "native-windows");
    assert.equal(filesystem.osName, "nt");
    assert.equal(filesystem.filesystem, "NTFS");
    assert.equal(filesystem.passed, true);
    assert.deepEqual(filesystem.checks.map((c) => c.scenario).sort(), expectedCases.sort());
    assert.ok(filesystem.checks.every((c) => c.passed === true));
    assert.equal(report.checks.length, 7);
    assert.equal(filesystem.sourceCommit, report.sourceCommit);
    assert.equal(filesystem.sourceClean, true);
    assert.deepEqual(filesystem.sourceFiles, originalSource.inputs);
    assert.deepEqual(filesystem.runtimeHashes, runtimeHashes);
    assert.deepEqual(filesystem.identity, report.identity);
    combined = {
      passed: true,
      mode: "native-windows",
      sourceCommit: report.sourceCommit,
      identity: report.identity,
      runtimeHashes,
      filesystemChecks: 13,
      browserChecks: 7,
      filesystemPlatform: filesystem.platform,
      browserVersion: report.browserVersion,
      python: filesystem.python,
      playwright: report.playwright,
      limits: report.limits,
    };
  }
})()
  .catch((error) => {
    report.passed = false;
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await context?.close();
      await stopHelper();
      fs.rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch (error) {
      report.passed = false;
      process.exitCode = 1;
      console.error("Recovery test cleanup failed:", error);
    } finally {
      fs.writeFileSync(path.join(OUT, "browser.json"), JSON.stringify(report, null, 2));
      if (report.passed && combined) fs.writeFileSync(path.join(OUT, "combined.json"), JSON.stringify(combined, null, 2));
    }
  });
