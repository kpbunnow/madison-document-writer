/* Real Chromium UI/PDF layout audit. City GIS and the Windows PDF/Outlook
   handoff are fixtures; case persistence uses the real Python HTTP helper.
   Run: npm ci; npx playwright install chromium; node audit_browser.js
   Optional: DW_BROWSER, DW_QA_OUTPUT. No production records are used. */
const fs = require("fs"),
  path = require("path"),
  os = require("os"),
  assert = require("assert/strict");
const { spawn } = require("child_process");
const { chromium } = require("playwright");
const ROOT = require("path").resolve(__dirname, "../.."),
  OUT = path.resolve(process.env.DW_QA_OUTPUT || path.join(ROOT, "browser-results"));
fs.mkdirSync(OUT, { recursive: true });
for (const name of ["browser-results.json", "lookup-results.json"]) fs.rmSync(path.join(OUT, name), { force: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "madison-browser-"));
let server, browser, auditPage;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const axeResults = [];
async function axeScreen(page, screen) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.evaluate(fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"));
  const result = await page.evaluate(async () =>
    axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }),
  );
  const report = {
    screen,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
    passes: result.passes.length,
    incomplete: result.incomplete.map((v) => v.id),
  };
  axeResults.push(report);
  fs.writeFileSync(
    path.join(OUT, "axe-results.json"),
    JSON.stringify({ passed: axeResults.every((x) => !x.violations.length), checks: axeResults }, null, 2),
  );
  if (!process.env.DW_COLLECT_AXE) assert.equal(report.violations.length, 0, screen + " axe violations: " + JSON.stringify(report.violations));
}
async function axeThemes(page, screen) {
  for (const theme of ["dark", "high"]) {
    await page.evaluate((value) => A11Y.setTheme(value), theme);
    await axeScreen(page, screen + "-" + theme);
  }
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.evaluate(() => A11Y.setTheme("system"));
  await axeScreen(page, screen + "-system-dark");
  assert.equal(
    await page.evaluate(() => getComputedStyle(document.querySelector("button")).transitionDuration),
    "0s",
    "reduced motion removes transitions",
  );
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.evaluate(() => A11Y.setTheme("light"));
}
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "build/generated/runtime-manifest.json"), "utf8"));
  for (const [name, source] of Object.entries(manifest.deploy)) {
    if (!name.includes("/") && !name.endsWith(".bat")) fs.copyFileSync(path.join(ROOT, source), path.join(work, name));
  }
  fs.cpSync(path.join(ROOT, "helper/vendor"), path.join(work, "vendor"), { recursive: true, filter: (p) => !p.includes("__pycache__") });
  const runtimeHashes = Object.fromEntries(
    ["madison-document-writer.html", "madison-reports.html"].map((name) => [
      name,
      require("crypto")
        .createHash("sha256")
        .update(fs.readFileSync(path.join(work, name)))
        .digest("hex"),
    ]),
  );
  fs.mkdirSync(path.join(work, "Case JSON Files"));
  const port = await new Promise((resolve) => {
    const socket = require("net").createServer();
    socket.listen(0, "127.0.0.1", () => {
      const p = socket.address().port;
      socket.close(() => resolve(p));
    });
  });
  const base = "http://127.0.0.1:" + port;
  fs.writeFileSync(
    path.join(work, "qa-helper.py"),
    "import server\nwith server.Server(('127.0.0.1',server.PORT),server.Handle" +
      "r) as http:\n    server.start_session(server.HERE)\n    http.serve_forever" +
      "()\n",
  );
  server = spawn(process.env.PYTHON || "python3", ["-u", path.join(work, "qa-helper.py")], {
    cwd: work,
    env: { ...process.env, DW_PORT: String(port), DW_OPEN_BROWSER: "0", DW_CASE_DIR: path.join(work, "Case JSON Files") },
  });
  let helperLog = "";
  server.stdout.on("data", (b) => (helperLog += b));
  server.stderr.on("data", (b) => (helperLog += b));
  for (let n = 0; n < 50; n++) {
    try {
      const r = await fetch(base + "/dw-status");
      if (r.ok) break;
    } catch (e) {}
    await delay(100);
  }
  const options = { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] };
  if (process.env.DW_BROWSER) options.executablePath = process.env.DW_BROWSER;
  browser = await chromium.launch(options);
  const privateSession = JSON.parse(fs.readFileSync(path.join(work, ".helper-session.json"), "utf8"));
  const plainNewContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const context = await plainNewContext(options);
    await context.addInitScript((master) => {
      try {
        localStorage.setItem("madison-helper-bootstrap", master);
      } catch (e) {}
    }, privateSession.bootstrap);
    return context;
  };
  const context = await browser.newContext({ timezoneId: "America/Chicago", viewport: { width: 1440, height: 1050 } });
  const errors = [];
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  const jobs = [],
    mailJobs = [];
  await context.route("**/dw-status", async (route) => {
    const result = await route.fetch();
    const data = await result.json();
    data.chrome = true;
    await route.fulfill({ json: data });
  });
  const artifactBytes = Buffer.from("%PDF-1.4\nSynthetic browser-audit attachment\n");
  const artifactHash = require("crypto").createHash("sha256").update(artifactBytes).digest("hex");
  await context.route("**/artifact/status", async (route) => {
    const data = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, items: data.items.map((x) => ({ ...x, locations: x.sha256 === artifactHash ? ["shared"] : [] })) } });
  });
  await context.route("**/save-pdf", async (route) => {
    const job = route.request().postDataJSON();
    jobs.push(job);
    await route.fulfill({ json: { ok: true, name: job.filename, path: "TEST-ONLY/" + job.filename, sha256: artifactHash } });
  });
  await context.route("**/artifact/read", async (route) => {
    const identity = route.request().postDataJSON();
    await route.fulfill({
      json:
        identity.sha256 === artifactHash
          ? { ok: true, pdf: artifactBytes.toString("base64"), sha256: artifactHash }
          : { ok: false, error: "Mismatched audit artifact" },
    });
  });
  await context.route("**/email", async (route) => {
    mailJobs.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true, name: "Synthetic QA mail draft", via: "outlook" } });
  });
  const page = await context.newPage();
  auditPage = page;
  await page.goto(base + "/");
  await page.waitForFunction(() => typeof WriterState.HELPER !== "undefined" && WriterState.HELPER);
  await context.route("**/reporting/parcels", (r) => r.fulfill({ json: { ok: true, parcels: {}, missing: [] } }));
  await context.route("**/reporting/areas", (r) =>
    r.fulfill({ json: { ok: true, districts: { type: "FeatureCollection", features: [] }, zips: null, notes: [] } }),
  );
  const r33 = await require("./browser_r33.js")(browser, page, OUT, axeScreen, work, base);
  fs.writeFileSync(path.join(OUT, "focus-results.json"), JSON.stringify({ passed: true, runtimeHashes, r33 }, null, 2));
  console.log("PASS R33 focused browser");
})()
  .catch(async (e) => {
    console.error(e);
    try {
      console.error(
        await auditPage.evaluate(() => ({
          blockers: blockers(doc(WriterState.state.docId)),
          screen: WriterState.state.screen,
          modal: WriterState.state.modal,
          amendmentError: WriterState.state.amendmentError,
        })),
      );
    } catch (ignore) {}
    process.exitCode = 1;
  })
  .finally(async () => {
    if (browser) await browser.close();
    if (server) server.kill();
    fs.rmSync(work, { recursive: true, force: true });
  });
