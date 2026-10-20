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
const { runSuite, timings: suiteTimings } = require("../../tools/browser_suite.cjs");
const ROOT = require("path").resolve(__dirname, "../.."),
  OUT = path.resolve(process.env.DW_QA_OUTPUT || path.join(ROOT, "browser-results"));
fs.mkdirSync(OUT, { recursive: true });
for (const name of ["browser-results.json", "lookup-results.json"]) fs.rmSync(path.join(OUT, name), { force: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "madison-browser-"));
let server, browser, auditPage, coreTimer;
const coreStarted = performance.now();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const axeResults = [];
async function axeScreen(page, screen) {
  // Audit the active tab: background tabs can stall animation frames and actionability checks.
  await page.bringToFront();
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
  coreTimer = setTimeout(() => {
    console.error("FAIL core browser workflow exceeded 150000 ms");
    if (server) server.kill();
    Promise.resolve(browser?.close()).finally(() => process.exit(124));
  }, 150000);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "build/generated/runtime-manifest.json"), "utf8"));
  for (const [name, source] of Object.entries(manifest.deploy)) {
    if (name.includes("/") || name.endsWith(".bat")) continue;
    fs.copyFileSync(path.join(ROOT, source), path.join(work, name));
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
  // Native Windows Chrome/Outlook delivery remains a fixture. R40 feeds an
  // actual browser-rendered PDF through the real HTTP operation/filing code.
  fs.writeFileSync(
    path.join(work, "qa-helper.py"),
    "import server\nfrom pathlib import Path\ndef renderer(html,target):\n    co" +
      "unt=server.HERE/'__qa_render_count.txt'\n    count.write_text(str(int(cou" +
      "nt.read_text())+1) if count.exists() else '1')\n    Path(target).write_by" +
      "tes((server.HERE/'__qa_pdf_original.pdf').read_bytes())\n    return str(t" +
      "arget)\nserver.make_pdf=renderer\nwith server.Server(('127.0.0.1',server.P" +
      "ORT),server.Handler) as http:\n    server.start_session(server.HERE)\n    " +
      "http.serve_forever()\n",
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
  const cspViolations = [];
  const privateSession = JSON.parse(fs.readFileSync(path.join(work, ".helper-session.json"), "utf8"));
  const plainNewContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const context = await plainNewContext(options);
    await context.addInitScript((master) => {
      try {
        localStorage.setItem("madison-helper-bootstrap", master);
      } catch (e) {}
    }, privateSession.bootstrap);
    await context.exposeBinding("__qaCspViolation", (_, event) => cspViolations.push(event));
    await context.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (event) =>
        window.__qaCspViolation({ directive: event.effectiveDirective, blocked: event.blockedURI, source: event.sourceFile }),
      ),
    );
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
  assert.equal(await page.locator("h1").textContent(), "Your workspace");
  assert.equal((await page.locator(".rail nav .rail-item").nth(0).innerText()).trim(), "Import inspection");
  assert.equal((await page.locator(".rail nav .rail-item").nth(1).innerText()).trim().split("\n")[0], "Workspace");
  await axeScreen(page, "workspace-empty");
  await page.screenshot({ path: path.join(OUT, "workspace-empty.png"), fullPage: true });
  for (const theme of ["dark", "high", "light"]) {
    await page.evaluate((value) => A11Y.setTheme(value), theme);
    await axeScreen(page, "workspace-" + theme);
  }
  await page.locator('.writer-navigation [data-nav="tools"]').click();
  await page.getByRole("heading", { name: "Tools & settings", exact: true }).waitFor();
  assert.equal(await page.locator(".writer-navigation .rail-item").count(), 5);
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("h1")), true);
  for (const selector of [
    "[data-global-search]",
    "[data-reminders]",
    "[data-batch-due]",
    "[data-openfile]",
    ".tool-action[data-sync-safety]",
    "[data-a11y-history]",
    "[data-a11y-help]",
    "[data-a11y-theme]",
  ])
    assert.equal(await page.locator(selector).count(), 1, selector + " available in Tools");
  await axeScreen(page, "tools-settings");
  await axeThemes(page, "tools-settings");
  await page.locator("[data-a11y-theme]").selectOption("dark");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  await page.locator("[data-a11y-theme]").selectOption("light");
  await page.screenshot({ path: path.join(OUT, "tools-settings.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(
    await page.locator(".writer-navigation .rail-item").evaluateAll((els) =>
      els.every((el) => {
        const b = el.getBoundingClientRect();
        return b.x >= 0 && b.right <= innerWidth && b.height >= 44;
      }),
    ),
    true,
  );
  await axeScreen(page, "tools-settings-mobile");
  await page.screenshot({ path: path.join(OUT, "tools-settings-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator("[data-a11y-history]").click();
  await axeScreen(page, "tools-message-history");
  await page.keyboard.press("Escape");
  await page.locator("[data-a11y-help]").click();
  await axeScreen(page, "shortcut-help");
  await page.keyboard.press("Escape");
  await page.locator('[data-nav="library"]').click();
  await axeScreen(page, "order-language");
  await axeThemes(page, "order-language");
  await page.locator('[data-nav="cases"]').click();
  await page.getByRole("heading", { name: "Your workspace", exact: true }).waitFor();
  await page.locator("h1").focus();
  await page.keyboard.press("?");
  await page.locator("#utility-dialog").waitFor();
  await page.keyboard.press("Escape");
  // A second writer must not overwrite local IndexedDB data.
  const second = await context.newPage();
  await second.goto(base + "/");
  await second.getByText("Document Writer is already open", { exact: true }).waitFor();
  assert.equal(await second.evaluate(() => WriterState.WRITER_ACCESS), false);
  await second.close();
  await page.locator('[data-nav="import"]').first().click();
  await page.getByRole("heading", { name: "Import Inspection Result", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Import Inspection Result", exact: true }).waitFor();
  assert.equal(await page.locator("h1").textContent(), "Import Inspection Result");
  assert.equal(await page.locator("#m-go,#imp-go,#imp-csv").count(), 0, "Manual and CSV entry options stay removed");
  assert.equal(await page.locator("text=Check what will be imported").count(), 0, "Import preview section stays removed");
  await axeScreen(page, "import-inspection");
  await page.screenshot({ path: path.join(OUT, "import-inspection.png"), fullPage: true });
  await page.evaluate(() => {
    const id = "qa-001";
    WriterState.CASES.push({
      id,
      number: "QA-001",
      address: "101 EXAMPLE LANE",
      parcel: "070822219103",
      owner: "TEST PROPERTY OWNER",
      ownerAddr: ["101 EXAMPLE LANE", "MADISON WI 53703"],
      inspectorId: "i4",
      date: recordDay(today),
      time: "09:00",
      emails: [{ addr: "qa-recipient@example.invalid", kind: "Property Owner", on: true }],
      historic: false,
      landmark: "",
    });
    newDoc(id, "notice");
  });
  await page.locator("#btn-add-top").click();
  await page.locator("#pk-status").selectOption("usable");
  const picks = await page.evaluate(() =>
    allItems()
      .filter((i) => i.s.length && i.p !== "draft" && !countBlanks(i.a))
      .slice(0, 2)
      .map((i) => i.ci + ":" + i.gi + ":" + i.o),
  );
  for (const [n, pick] of picks.entries()) {
    const [ci, gi] = pick.split(":");
    await page.locator('[data-grp="' + ci + ":" + gi + '"]').click();
    await page.locator('[data-pick="' + pick + '"]').click();
    await page.waitForFunction((count) => doc(WriterState.state.docId).items.length === count, n + 1);
  }
  assert.equal(await page.evaluate(() => doc(WriterState.state.docId).items.length), 2);
  // Clicking a selected item removes it, with no duplicates on reselect.
  await page.locator('[data-pick="' + picks[1] + '"]').click();
  await page.waitForFunction(() => doc(WriterState.state.docId).items.length === 1);
  assert.equal(await page.evaluate(() => doc(WriterState.state.docId).items.length), 1);
  await page.locator('[data-pick="' + picks[1] + '"]').click();
  await page.waitForFunction(() => doc(WriterState.state.docId).items.length === 2);
  assert.equal(await page.evaluate(() => doc(WriterState.state.docId).items.length), 2);
  assert.equal(await page.evaluate(() => doc(WriterState.state.docId).items.every((i) => i.due === "")), true);

  await axeScreen(page, "picker");
  await page.screenshot({ path: path.join(OUT, "picker.png"), fullPage: true });
  await page.getByRole("button", { name: "Done adding" }).click();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page
      .locator(".desk")
      .evaluate((el) => !!(el.compareDocumentPosition(document.querySelector('[aria-label="Assign due dates"]')) & Node.DOCUMENT_POSITION_FOLLOWING)),
    true,
    "Due date assignment sits below the document",
  );
  assert.equal(
    await page.evaluate(() => {
      const x = document.createElement("span");
      x.className = "blank";
      document.body.appendChild(x);
      const c = getComputedStyle(x),
        ok = c.borderRadius === "50%" && parseFloat(c.width) > parseFloat(c.height);
      x.remove();
      return ok;
    }),
    true,
    "Fill-in markers render as outlined bubbles",
  );
  assert.equal(
    await page
      .locator(".n-head")
      .first()
      .evaluate((el) => el.scrollHeight > el.clientHeight + 2),
    false,
    "Editable notice header must fit",
  );
  assert.equal(
    await page
      .locator(".n-head")
      .first()
      .evaluate((el) => {
        const row = el.querySelector("dl dd:last-child");
        return !row || row.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom + 2;
      }),
    true,
    "Letterhead last row remains inside header",
  );
  assert.equal(await page.evaluate(() => document.compatMode), "CSS1Compat");
  await page.evaluate(() => {
    doc(WriterState.state.docId).items[0].text = "Repair ( ) on the wall.";
    render();
  });
  assert.equal(await page.locator('[data-field="text"] .blank-edit').count(), 1, "Document editor displays a fill-in bubble");
  await page.locator("#btn-final").click();
  await page.locator(".modal .check").filter({ hasText: "unfilled bubble" }).getByRole("button", { name: "Item 1", exact: true }).click();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.field), "text", "Review check focuses the precise corrective-action field");
  assert.equal(await page.locator('[data-field="text"]').first().getAttribute("aria-invalid"), "true");
  await page.locator("#btn-checks").click();
  await axeScreen(page, "actionable-checks");
  await page.screenshot({ path: path.join(OUT, "actionable-checks.png"), fullPage: true });
  const savedParcel = await page.evaluate(() => docCase(doc(WriterState.state.docId)).parcel);
  await page.evaluate(() => {
    docCase(doc(WriterState.state.docId)).parcel = "";
    render();
  });
  await page.locator("#btn-final").click();
  await page.locator(".modal .check").filter({ hasText: "No parcel number" }).getByRole("button", { name: "Parcel number" }).click();
  assert.equal(await page.evaluate(() => document.activeElement.dataset.case), "parcel");
  assert.equal(await page.locator(".case-check-fields").getAttribute("open"), "");
  await page.locator('[data-case="parcel"]').fill(savedParcel);
  assert.equal(await page.locator('[data-case="parcel"]').getAttribute("aria-invalid"), null, "Correcting the parcel removes its highlight");

  await page
    .locator('[data-field="text"]')
    .first()
    .evaluate((el) => {
      el.append(document.createTextNode(" Keep existing finish."));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  assert.equal(await page.evaluate(() => countBlanks(doc(WriterState.state.docId).items[0].text)), 1, "Adjacent edits preserve the missing detail");
  await page.evaluate(() => document.querySelectorAll("[data-message-dismiss]").forEach((el) => el.click()));
  await page
    .locator('[data-field="text"]')
    .first()
    .locator("..")
    .screenshot({ path: path.join(OUT, "fill-in-bubble.png") });
  page.once("dialog", (dialog) => dialog.accept("the damaged masonry"));
  await page.locator(".blank-edit").click();
  assert.equal(
    await page.evaluate(() => doc(WriterState.state.docId).items[0].text),
    "Repair the damaged masonry on the wall. Keep existing finish.",
  );
  await page.locator("#btn-save").click();
  await page.waitForFunction(() => WriterState.state.screen === "cases");
  await page.reload();
  await page.waitForFunction(() => WriterState.CASES.length > 0);
  await page.getByRole("button", { name: "Continue document", exact: true }).click();
  await page.waitForFunction(() => WriterState.state.screen === "write" && !!doc(WriterState.state.docId));
  assert.equal(
    await page.evaluate(() => doc(WriterState.state.docId).items[0].text),
    "Repair the damaged masonry on the wall. Keep existing finish.",
    "Bubble entry survives reload",
  );
  const manualDue = await page.evaluate(() => addDays(recordDay(today), 21));
  await page.locator('[data-due-all="1"]').click();
  await page.locator("#bulk-due").fill(manualDue);
  await page.locator("#btn-bulkdue").click();
  await axeScreen(page, "editor");
  await axeThemes(page, "editor");
  await page.screenshot({ path: path.join(OUT, "editor.png"), fullPage: true });
  await page.waitForFunction(() => doc(WriterState.state.docId) && blockers(doc(WriterState.state.docId)).length === 0);
  // R27: reproduce the formerly unresolvable Landmark check and issue via the real helper.
  await page.evaluate(() => {
    kase(doc(WriterState.state.docId).caseId).landmark = "SYNTHETIC LANDMARK";
    doc(WriterState.state.docId).items[0].text += " Repair the exterior siding.";
    render();
  });
  assert.equal(
    await page.evaluate(() => blockers(doc(WriterState.state.docId)).some((c) => /Landmark paragraph/.test(c.t))),
    false,
    "Missing Landmark wording does not block the notice",
  );
  assert.equal(
    await page.evaluate(() => docBlocks(doc(WriterState.state.docId)).some((b) => b.key === "LANDMARK")),
    false,
    "No empty Landmark section is rendered",
  );
  await page.locator("#btn-final").click();
  await axeScreen(page, "review");
  await page.screenshot({ path: path.join(OUT, "review.png"), fullPage: true });
  await page.locator("#fin-go").click();
  await page.waitForFunction(
    () =>
      WriterState.LASTWRITE &&
      WriterState.LASTWRITE.ok &&
      WriterState.LASTINDEX &&
      WriterState.LASTINDEX.ok &&
      eventsFor(WriterState.CASES[0].id).some((e) => e.type === "document.filed"),
  );
  assert.equal(jobs.length, 1);
  assert.equal(await page.evaluate(() => WriterState.PENDING.length), 0);
  const caseFiles = fs.readdirSync(path.join(work, "Case JSON Files")).filter((n) => n.endsWith(".json"));
  assert.equal(caseFiles.length, 1);
  assert.equal(fs.readdirSync(path.join(work, "Case JSON Files", "Reporting Index")).length, 1);
  // Correct through the real UI and helper, including a lost HTTP response.
  const originalId = await page.evaluate(() => sourceDocFor(WriterState.CASES[0].id).id);
  const originalEvent = await page.evaluate(
    (id) => JSON.stringify(eventsFor(WriterState.CASES[0].id).find((e) => (e.payload.snapshot || {}).id === id)),
    originalId,
  );
  await page.locator(".editor-more summary").click();
  await page.evaluate(() => render());
  assert.equal(await page.locator(".editor-more").evaluate((el) => el.open), true, "A late filing repaint retains the opened document actions");
  await page.locator("#btn-correct").click();
  await page.locator("#correction-reason").fill("Correct the transcribed location and the owner spelling.");
  await page.locator('[data-field="text"]').first().fill("Repair the west exterior wall.");
  await page.locator('[data-case="ownerBlock"]').fill("CORRECTED TEST PROPERTY OWNER\n101 EXAMPLE LANE\nMADISON WI 53703");
  assert.equal(
    await page.evaluate(() => kase(WriterState.CASES[0].id).owner),
    "TEST PROPERTY OWNER",
    "Case remains unchanged while correction is a draft",
  );
  assert.equal(await page.locator("#correction-case").count(), 0, "Case detail propagation is automatic");
  assert.equal(
    await page.locator(".desk .cc-mail").getByText("qa-recipient@example.invalid").count(),
    1,
    "Email recipients are visible on the correction draft",
  );
  await page.locator("#btn-final").first().click();
  assert.equal(await page.locator(".change-table").last().getByText("Repair the west exterior wall.", { exact: true }).count(), 1);
  assert.equal(
    await page.locator(".modal-h").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom < innerHeight;
    }),
    true,
    "Review heading remains visible",
  );
  assert.equal(
    await page.locator(".modal-f").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    }),
    true,
    "Review actions remain visible",
  );
  await axeScreen(page, "correction-review");
  await page.screenshot({ path: path.join(OUT, "correction-review.png"), fullPage: true });
  await page.locator("[data-finsend]").check();
  await page.locator("#correction-reviewed").check();
  let dropCorrectionResponse = true;
  await context.route("**/cases/save", async (route) => {
    const body = route.request().postDataJSON();
    if (dropCorrectionResponse && body.file.events.some((e) => e.type === "correction.issued")) {
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      dropCorrectionResponse = false;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.locator("#fin-go").click();
  await page.locator("#btn-retrycorrection").waitFor();
  assert.equal(await page.evaluate((id) => isEffective(doc(id)), originalId), true); // Original projection awaits acknowledgement.
  const pending = await page.evaluate(() => doc(WriterState.state.docId).pendingAmendment.id);
  await page.locator("#btn-retrycorrection").click();
  await page.waitForFunction(() => sourceDocFor(WriterState.CASES[0].id).revision && !!doc(WriterState.state.docId).filedAt);
  assert.equal(await page.evaluate(() => eventsFor(WriterState.CASES[0].id).filter((e) => e.type === "correction.issued").length), 1);
  assert.equal(await page.evaluate((id) => eventsFor(WriterState.CASES[0].id).find((e) => e.id === id).id, pending), pending);
  assert.equal(
    await page.evaluate((id) => JSON.stringify(eventsFor(WriterState.CASES[0].id).find((e) => (e.payload.snapshot || {}).id === id)), originalId),
    originalEvent,
  );
  assert.equal(await page.evaluate(() => kase(WriterState.CASES[0].id).owner), "CORRECTED TEST PROPERTY OWNER");
  assert.equal(
    await page.evaluate(() => doc(WriterState.state.docId).emailedTo.some((e) => e.addr === "qa-recipient@example.invalid")),
    true,
    "Selected email recipient is stored on the corrected document",
  );
  assert.equal(
    mailJobs.some((x) => x.to === "qa-recipient@example.invalid"),
    true,
    "Correction opens an email draft for its selected recipient",
  );
  assert.equal(await page.evaluate(() => reinspFor(WriterState.CASES[0].id).length), 0);
  assert.equal(
    await page
      .locator(".revision-print")
      .first()
      .textContent()
      .then((t) => t.includes("CORRECTED DOCUMENT")),
    true,
  );
  await axeScreen(page, "correction-issued");
  await page.screenshot({ path: path.join(OUT, "correction-issued.png"), fullPage: true });
  assert.equal(await page.locator("#btn-reconcile").count(), 0, "Correction does not show a separate follow-through prompt");
  await page.locator('[data-nav="cases"]').first().click();
  await page.locator("#case-filter").selectOption("all");
  await axeScreen(page, "workspace-filled");
  await page.screenshot({ path: path.join(OUT, "workspace-filled.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await axeScreen(page, "mobile");
  await page.screenshot({ path: path.join(OUT, "mobile.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(
    await page
      .locator("[data-reinsp]")
      .first()
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth;
      }),
    true,
    "Next case action fits the mobile viewport",
  );
  const mobileJob = await page.evaluate(() => printJob(sourceDocFor(WriterState.CASES[0].id)));
  await page.setViewportSize({ width: 1440, height: 1050 });
  const desktopJob = await page.evaluate(() => printJob(sourceDocFor(WriterState.CASES[0].id)));
  assert.equal(mobileJob.html, desktopJob.html, "PDF HTML must not depend on viewport size");
  // Build all document types from one real issued notice, using synthetic data.
  const fixtureSource = fs.readFileSync(path.join(ROOT, "app/modules/test_fixtures.js"), "utf8"),
    fixtureTS = require("typescript"),
    fixtureAST = fixtureTS.createSourceFile("test_fixtures.js", fixtureSource, fixtureTS.ScriptTarget.Latest, true, fixtureTS.ScriptKind.JS);
  const fixtureBindings = [];
  for (const statement of fixtureAST.statements) {
    if (!fixtureTS.isImportDeclaration(statement)) continue;
    const named = statement.importClause?.namedBindings;
    if (named && fixtureTS.isNamedImports(named))
      for (const item of named.elements) {
        const original = item.propertyName?.text || item.name.text;
        if (original !== item.name.text) fixtureBindings.push("const " + item.name.text + "=" + original + ";");
      }
  }
  const fixtureFunction = fixtureAST.statements.find(
    (statement) => fixtureTS.isFunctionDeclaration(statement) && statement.name?.text === "initTestFixtures",
  );
  assert.ok(fixtureFunction, "Explicit layout fixture owner");
  const layoutFixtures =
    fixtureBindings.join("\n") +
    "\n" +
    fixtureFunction.getText(fixtureAST).replace(/^export\s+function\s+initTestFixtures\b/, "function initLayoutFixtures");
  await page.evaluate("(()=>{" + layoutFixtures + "\nwindow.DW_LAYOUT_FIXTURES=initLayoutFixtures();})()");
  const variants = await page.evaluate(() => {
    const source = sourceDocFor(WriterState.CASES[0].id),
      result = [{ type: "notice", ...printJob(source) }];
    const sourceState = { DOCS: clone(WriterState.DOCS), REINSP: clone(WriterState.REINSP), EVENTS: clone(WriterState.EVENTS) };
    for (const type of ["extension", "citation", "referral", "referralUpdate", "compliance"]) {
      WriterState.DOCS = clone(sourceState.DOCS);
      WriterState.REINSP = clone(sourceState.REINSP);
      WriterState.EVENTS = clone(sourceState.EVENTS);
      if (type === "referralUpdate") {
        startReinspection(source.caseId);
        const earlier = reinsp(WriterState.state.reinspId);
        earlier.inspectorId = "i2";
        earlier.time = "10:00";
        source.items.forEach((i) => (earlier.results[i.id] = { oc: "none", on: earlier.date, note: "Initial referral inspection." }));
        docFromReinspection(earlier, "referral");
        window.DW_LAYOUT_FIXTURES.issueDocument(doc(WriterState.state.docId));
      }
      const current = sourceDocFor(source.caseId);
      startReinspection(source.caseId);
      const r = reinsp(WriterState.state.reinspId);
      r.inspectorId = "i2";
      r.time = "10:00";
      current.items.forEach(
        (it, n) =>
          (r.results[it.id] = {
            oc: type === "compliance" ? "corrected" : n === 0 ? "progress" : "corrected",
            on: recordDay(today),
            due: window.DW_LAYOUT_FIXTURES.futureDue(recordDay(today), 21),
            note: "Synthetic inspection notes for layout verification.",
            cite: type === "citation" && n === 0,
          }),
      );
      docFromReinspection(r, type);
      const d = doc(WriterState.state.docId);
      if (d.type !== type) throw new Error("Layout fixture could not create " + type + ": " + worksheetFaults(r, type).join("; "));
      window.DW_LAYOUT_FIXTURES.issueDocument(d);
      result.push({ type, signer: docInsp(doc(d.id)).name, ...printJob(doc(d.id)) });
      if (type === "citation") {
        const revised = clone(doc(d.id));
        revised.id = "corrected_citation_layout";
        revised.revision = {
          number: 1,
          rootId: d.id,
          targetId: d.id,
          originalIssued: d.mailed,
          reason: "Synthetic correction to confirm every court copy carries its revision identity.",
        };
        result.push({ type: "corrected-citation", signer: docInsp(revised).name, ...printJob(revised) });
      }
    }
    WriterState.DOCS = clone(sourceState.DOCS);
    WriterState.REINSP = clone(sourceState.REINSP);
    WriterState.EVENTS = clone(sourceState.EVENTS);
    const long = clone(source);
    long.id = "layout-long";
    long.draft = true;
    delete long.frozen;
    long.items = Array.from({ length: 20 }, (_, n) => ({
      ...clone(source.items[n % source.items.length]),
      id: "long" + n,
      no: String(n + 1),
      text: "Layout test item " + (n + 1) + ". " + source.items[n % source.items.length].text,
    }));
    result.push({ type: "long-notice", ...printJob(long) });
    return result;
  });
  const printPage = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
  const pdfResults = [];
  for (const job of variants) {
    fs.writeFileSync(path.join(OUT, job.type + ".html"), job.html);
    await printPage.setContent(job.html, { waitUntil: "load" });
    await printPage.evaluate(() => document.fonts.ready);
    await printPage.emulateMedia({ media: "print" });
    const geometry = await printPage.evaluate(() =>
      [...document.querySelectorAll(".sheet,.cit")].map((el) => ({
        kind: el.className,
        height: el.getBoundingClientRect().height,
        overflow: el.scrollHeight > el.clientHeight + 2,
      })),
    );
    assert.equal(
      geometry.some((p) => p.overflow),
      false,
      job.type + " page overflow",
    );
    const headers = await printPage.locator(".n-head").evaluateAll((els) =>
      els.map((el) => {
        const row = el.querySelector("dl dd:last-child");
        return !row || row.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom + 2;
      }),
    );
    assert.equal(headers.every(Boolean), true, job.type + " PDF letterhead last row clipped");
    if (job.type === "corrected-citation")
      assert.equal(
        await printPage.locator(".cit-foot").evaluateAll((els) => els.length === 4 && els.every((el) => el.textContent.includes("Corrected rev. 1"))),
        true,
        "Every amended court copy has a revision marker",
      );
    if (job.signer) assert.equal(await printPage.locator(".n-insp-name").first().textContent(), job.signer, job.type + " printed signer");
    assert.equal(
      await printPage.locator(".n-title").evaluateAll((els) => els.some((el) => el.scrollWidth > el.clientWidth + 2)),
      false,
      job.type + " title clipped",
    );
    await printPage.pdf({ path: path.join(OUT, job.type + ".pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
    pdfResults.push({ type: job.type, geometry });
  }
  await printPage.close();
  // Reports receives recorded GIS responses; the reporting index is real.
  const features = { type: "FeatureCollection", features: [] };
  await context.route("**/reporting/parcels", (route) =>
    route.fulfill({
      json: {
        ok: true,
        parcels: { "070822219103": { history: [{ at: "2026-09-19T00:00:00Z", lat: 43.07, lon: -89.4, alder: 4, building: 1 }] } },
        missing: [],
      },
    }),
  );
  await context.route("**/reporting/areas", (route) => route.fulfill({ json: { ok: true, districts: features, zips: null, notes: [] } }));
  const reports = await context.newPage();
  await reports.goto(base + "/madison-reports.html");
  await reports.waitForFunction(() => ReportsState.S.phase === "ready");
  assert.equal(await reports.locator(".rail-logo").evaluate((img) => img.complete && img.naturalWidth > 0), true, "Report logo must load");
  await axeScreen(reports, "reports");
  await axeThemes(reports, "reports");
  await reports.screenshot({ path: path.join(OUT, "reports.png"), fullPage: true });
  const reportCounts = await reports.evaluate(() => {
    const counts = {};
    for (const report of REPORTS) {
      ReportsState.S.screen = report.id;
      render();
      counts[report.id] = document.querySelectorAll(".rep tbody tr").length;
    }
    return counts;
  });
  for (const screen of [...(await reports.evaluate(() => REPORTS.map((r) => r.id))), "property", "owner", "data"]) {
    await reports.locator("#report-menu").evaluate((el) => (el.open = true));
    await reports.locator('.rail [data-screen="' + screen + '"]').click();
    await axeScreen(reports, "reports-" + screen);
  }
  await reports.locator('.rail [data-screen="openCases"]').click();
  await reports.locator("#report-exports").evaluate((el) => (el.open = true));
  const download = await Promise.all([reports.waitForEvent("download"), reports.locator('[data-act="export"]').click()]);
  await download[0].saveAs(path.join(OUT, "reports.xlsx"));
  // Complete a real case through interruptions, review, retry, and closure.
  await page.bringToFront();
  await page.evaluate(() => {
    WriterState.state.screen = "cases";
    WriterState.state.modal = null;
    render();
  });
  await page.locator("[data-reinsp]").first().click();
  await page.waitForFunction(() => WriterState.state.screen === "reinspect" && !!reinsp(WriterState.state.reinspId));
  await page.locator("#ri-time").fill("10:00");
  let items = await page.evaluate(() => doc(reinsp(WriterState.state.reinspId).sourceDocId).items.map((i) => i.id));
  await page.locator('[data-setoc="progress"][data-item="' + items[0] + '"]').click();
  await page.locator('[data-rinote="' + items[0] + '"]').fill("Partial inspection note retained through reload.");
  await page.locator("#btn-risave").click();
  await page.getByRole("button", { name: "Continue reinspection", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Continue reinspection", exact: true }).click();
  await page.waitForFunction(() => WriterState.state.screen === "reinspect" && !!reinsp(WriterState.state.reinspId));
  await page.locator("#ri-time").fill("10:00");
  assert.equal(await page.locator('[data-rinote="' + items[0] + '"]').inputValue(), "Partial inspection note retained through reload.");
  assert.equal(await page.evaluate(() => unchecked(reinsp(WriterState.state.reinspId)).length), 1);
  await axeScreen(page, "inspection-resumed");
  await page.screenshot({ path: path.join(OUT, "inspection-resumed.png"), fullPage: true });
  await page.locator('[data-setoc="corrected"][data-item="' + items[1] + '"]').click();
  assert.equal(await page.locator("#bulk-due").count(), 1, "R53: bulk due assignment is available on an open reinspection worksheet");
  await page.locator('[data-ridue="' + items[0] + '"]').fill(manualDue);
  assert.equal(
    await page
      .locator("[data-ridate]")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width <= 180),
    true,
    "Result date uses compact width",
  );
  assert.equal(
    await page
      .locator("[data-ridue]")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width <= 180),
    true,
    "New due date uses compact width",
  );
  await axeScreen(page, "reinspection-compact");
  await axeThemes(page, "reinspection-compact");
  await page.screenshot({ path: path.join(OUT, "reinspection-compact.png"), fullPage: true });

  await page.locator('[data-action-group="time"]').check();
  await page.locator('[data-action-type="extension"]').check();
  await page.locator("[data-create-action]").click();
  await page.locator('[data-field="text"]').first().focus();
  assert.equal(
    await page.evaluate(() => {
      const active = document.activeElement;
      render();
      return active.isConnected && document.activeElement === active;
    }),
    true,
    "a passive redraw must leave the active editing field attached",
  );
  await page.locator('[data-field="text"]').first().fill("Retained editing before the follow-up was issued.");
  await page.locator("#btn-editvisit").click();
  await page.locator("#btn-previousdraft").click();
  assert.equal(await page.locator('[data-field="text"]').first().textContent(), "Retained editing before the follow-up was issued.");
  let dropPublication = true;
  await context.route("**/cases/save", async (route) => {
    const body = route.request().postDataJSON();
    if (dropPublication && body.idempotencyEvent && body.file.events.some((e) => e.id === body.idempotencyEvent && e.type === "extension.issued")) {
      const response = await route.fetch();
      assert.equal(response.status(), 200);
      dropPublication = false;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.locator("#btn-final").click();
  await page.locator("#fin-go").click();
  await page.locator("#btn-retrypublish").waitFor();
  assert.equal(await page.evaluate(() => doc(WriterState.state.docId).draft && reinsp(doc(WriterState.state.docId).fromReinspId).draft), true);
  await axeScreen(page, "issuance-recovery");
  await page.screenshot({ path: path.join(OUT, "issuance-recovery.png"), fullPage: true });
  // A backup restores the exact pending transaction in an empty profile, without issuing.
  await page.locator("#btn-save").click();
  await page.locator('.writer-navigation [data-nav="tools"]').click();
  await page.locator(".tool-action[data-sync-safety]").click();
  await page.locator("[data-saved-detail=recovery] > summary").click();
  await page.locator("#btn-workbackup").waitFor();
  const backupEvent = await Promise.all([page.waitForEvent("download"), page.locator("#btn-workbackup").click()]);
  const backupPath = path.join(OUT, "workspace-backup.json");
  await backupEvent[0].saveAs(backupPath);
  await page.locator("[data-utility-close]").click();
  await page.locator("#utility-dialog").waitFor({ state: "detached" });
  const restoreContext = await browser.newContext({ timezoneId: "America/Chicago" }),
    restorePage = await restoreContext.newPage();
  await restorePage.goto(base + "/");
  await restorePage.waitForFunction(() => typeof WriterState.CASEDIR !== "undefined" && WriterState.CASEDIR);
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  await restorePage.evaluate((value) => restoreWorkspaceBackup(value), backup);
  assert.equal(await restorePage.evaluate(() => WriterState.DOCS.filter((d) => d.draft && d.pendingAmendment).length), 1);
  assert.equal(await restorePage.evaluate(() => WriterState.DOCS.filter((d) => !d.draft && d.type === "extension").length), 0);
  await restorePage.reload();
  await restorePage.waitForFunction(() => WriterState.DOCS.some((d) => d.draft && d.pendingAmendment));
  await restoreContext.close();
  await page.bringToFront();
  await page.locator('.writer-navigation [data-nav="cases"]').click();
  await page.getByRole("button", { name: "Confirm document save", exact: true }).click();
  await page.waitForFunction(() => WriterState.state.modal === "shared-change" || WriterState.state.screen === "write");
  if (await page.locator("[data-shared-local]").count()) await page.locator("[data-shared-local]").click();
  await page.waitForFunction(() => WriterState.state.screen === "write" && !!doc(WriterState.state.docId));
  await page.locator("#btn-retrypublish").click();
  await page.waitForFunction(() => !!doc(WriterState.state.docId).filedAt && doc(WriterState.state.docId).type === "extension");
  assert.equal(await page.evaluate(() => reinspFor(WriterState.CASES[0].id).length), 1);
  assert.equal(await page.evaluate(() => eventsFor(WriterState.CASES[0].id).filter((e) => e.type === "extension.issued").length), 1);
  await page.locator("#btn-recordnote").click();
  await page.locator("#record-action-text").fill("A partial record note survives save and continue.");
  await page.locator("#btn-savework").click();
  await page.locator("[data-worknote]").waitFor();
  await page.reload();
  await page.locator("[data-worknote]").click();
  assert.equal(await page.locator("#record-action-text").inputValue(), "A partial record note survives save and continue.");
  await page.locator("#record-action-go").click();
  await page.waitForFunction(() => doc(WriterState.state.docId).annotations?.length === 1 && !WriterState.state.modal);
  assert.equal(await page.evaluate(() => Object.keys(WriterState.WORK.recordForms).length), 0);
  await page.locator('[data-nav="cases"]').first().click();
  await page.locator("#case-filter").selectOption("all");
  await page.locator("[data-reinsp]").first().click();
  await page.waitForFunction(() => WriterState.state.screen === "reinspect" && !!reinsp(WriterState.state.reinspId));
  await page.locator("#ri-time").fill("10:00");
  await page.locator('[data-setoc="corrected"]:not([disabled])').click();
  await page.locator('[data-action-group="compliance"]').check();
  await page.locator('[data-action-type="compliance"]').check();
  await page.locator("[data-create-action]").click();
  assert.equal(await page.evaluate(() => caseState(WriterState.CASES[0]).closed), false, "A compliance draft does not close the case");
  await page.locator("#btn-final").click();
  await page.locator("#fin-go").click();
  await page.waitForFunction(() => caseState(WriterState.CASES[0]).closed && doc(WriterState.state.docId).filedAt);
  const complete = await page.evaluate(() => summarize(caseFile(WriterState.CASES[0].id)));
  assert.equal(complete.case.status, "Closed");
  assert.equal(complete.visits.length, 2);
  assert.equal(complete.documents.length, 4);
  assert.equal(
    complete.violations.every((i) => i.done),
    true,
  );
  await page.locator('[data-nav="cases"]').first().click();
  assert.equal(await page.locator("[data-reinsp]").count(), 0);
  await axeScreen(page, "case-completed");
  await page.screenshot({ path: path.join(OUT, "case-completed.png"), fullPage: true });
  await page.reload();
  await page.waitForFunction(() => WriterState.CASES.length === 1 && caseState(WriterState.CASES[0]).closed);
  // R4: resolve a missing deposit through the actual UI, save/resume, issue and correct it.
  await page.locator('[data-nav="import"]').first().click();
  await page.getByRole("heading", { name: "Import Inspection Result", exact: true }).waitFor();
  await page.evaluate(() => {
    const id = "qa-cit-002";
    WriterState.CASES.push({
      id,
      number: "QA-CIT-002",
      address: "202 EXAMPLE LANE",
      parcel: "070822219103",
      owner: "CITATION TEST OWNER",
      ownerAddr: ["202 EXAMPLE LANE", "MADISON WI 53703"],
      inspectorId: "i4",
      date: recordDay(today),
      time: "10:15",
      historic: false,
      landmark: "",
    });
    newDoc(id, "notice");
  });
  await page.locator("#btn-add-top").click();
  await page.locator("#pk-status").selectOption("usable");
  const [pci, pgi] = picks[0].split(":");
  await page.locator('[data-grp="' + pci + ":" + pgi + '"]').click();
  await page.locator('[data-pick="' + picks[0] + '"]').click();
  await page.getByRole("button", { name: "Done adding" }).click();
  await page.locator('[data-field="sections"]').first().fill("SPS 999.99");
  await page.locator("[data-notecite]").check();
  await page.locator("[data-deposit-request]").waitFor();
  assert.equal(await page.evaluate(() => Object.keys(doc(WriterState.state.docId).cits).length), 0);
  await axeScreen(page, "required-deposit-step");
  await page.locator("#citation-review h2").click();
  await page.locator('[data-due-all="1"]').click();
  await page.locator("#bulk-due").fill(manualDue);
  await page.locator("#btn-bulkdue").click();
  await page.locator("#btn-final").click();
  assert.equal(await page.locator("#fin-go").isDisabled(), true, "Incomplete initial citation blocks the Official Notice");
  assert.equal(await page.evaluate(() => eventsFor(doc(WriterState.state.docId).caseId).some((e) => e.type === "notice.issued")), false);
  await page.locator('[data-close="modal"]').click();
  const noticeDraftId = await page.evaluate(() => doc(WriterState.state.docId).id);
  assert.equal(await page.evaluate(() => blockers(doc(WriterState.state.docId)).some((x) => x.t.includes("deposit"))), true);
  await page.evaluate(() => depositStep.openNext(doc(WriterState.state.docId)));
  await page.locator('[data-deposit-form] [name="depositMode"]').selectOption("total");
  await page.locator('[data-deposit-form] [name="amount"]').fill("245.67");
  await page.locator('[data-deposit-form] [name="depositSource"]').fill("Synthetic court approval QA-002; total includes assessments.");
  await page.getByRole("button", { name: "Complete charge", exact: true }).click();
  const citId = await page.evaluate(() => doc(WriterState.state.docId).initialCitationId);
  assert.equal(
    await page.evaluate(() => Object.values(doc(WriterState.state.docId).cits)[0].depositSource),
    "Synthetic court approval QA-002; total includes assessments.",
  );
  await page.waitForFunction(() => doc(WriterState.state.docId) && blockers(doc(WriterState.state.docId)).length === 0);
  await page.evaluate(() => document.querySelectorAll("[data-message-dismiss]").forEach((el) => el.click()));
  await axeScreen(page, "citation-review");
  await axeThemes(page, "citation-review");
  await page.screenshot({ path: path.join(OUT, "citation-review.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await axeScreen(page, "citation-mobile");
  await page.screenshot({ path: path.join(OUT, "citation-mobile.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator("#citation-review #btn-savework").click();
  await page.reload();
  await page.waitForFunction((id) => !!doc(id), noticeDraftId);
  await page.getByRole("button", { name: "Continue document", exact: true }).click();
  await page.waitForFunction(() => WriterState.state.screen === "write" && !!doc(WriterState.state.docId));
  assert.equal(await page.getByLabel("Approved total for item 1", { exact: true }).inputValue(), "245.67");
  await page.locator("[data-review-details=charge] summary").click();
  await page.locator("[data-review-details=pricing] summary").click();
  await page.getByLabel("Ordinance for item 1", { exact: true }).focus();
  await page.locator("#citation-review h2").click();
  assert.equal(
    await page.getByLabel("Approved total for item 1", { exact: true }).inputValue(),
    "245.67",
    "Unchanged ordinance blur preserves manual deposit",
  );
  await page.getByLabel("Violation description for item 1", { exact: true }).fill("CUSTOM INITIAL INSPECTION CHARGE");
  await page.getByLabel("Ordinance for item 1", { exact: true }).fill("MGO 27.05 (2) (c)");
  await page.locator("#citation-review h2").click();
  assert.equal(await page.getByLabel("Deposit method for item 1", { exact: true }).inputValue(), "schedule");
  assert.equal(await page.getByLabel("Base deposit for item 1", { exact: true }).inputValue(), "100");
  assert.equal(await page.getByLabel("Violation description for item 1", { exact: true }).inputValue(), "CUSTOM INITIAL INSPECTION CHARGE");
  assert.equal(
    await page
      .getByLabel("Deposit method for item 1", { exact: true })
      .locator("option[value=total]")
      .evaluate((option) => option.disabled),
    true,
    "Determined charges block manual amount overrides",
  );
  assert.equal(await page.getByLabel("Base deposit for item 1", { exact: true }).getAttribute("readonly"), "");
  await page.getByLabel("Ordinance for item 1", { exact: true }).fill("SPS 321.125");
  await page.locator("#citation-review h2").click();
  await page.getByLabel("Deposit method for item 1", { exact: true }).selectOption("total");
  await page.getByLabel("Approved total for item 1", { exact: true }).fill("245.67");
  await page.getByLabel("Approved source / reason for item 1", { exact: true }).fill("Synthetic court approval QA-002; total includes assessments.");
  await page.locator("#citation-review h2").click();
  await page.locator("[data-review-details=charge]").evaluate((el) => {
    el.open = true;
  });
  const typedOrd = page.getByLabel("Ordinance for item 1", { exact: true });
  await typedOrd.fill("");
  await typedOrd.pressSequentially("SPS 321.125");
  await page.locator("#citation-review h2").click();
  assert.equal(await page.getByLabel("Deposit method for item 1", { exact: true }).inputValue(), "total");
  assert.equal(await page.getByLabel("Approved total for item 1", { exact: true }).inputValue(), "245.67");
  assert.equal(
    await page.getByLabel("Approved source / reason for item 1", { exact: true }).inputValue(),
    "Synthetic court approval QA-002; total includes assessments.",
  );
  // Failed device persistence keeps the editor open and offers a direct backup.
  await page.evaluate(() => {
    window.__qaSavedSave = saveDrafts;
    saveDrafts = async () => false;
  });
  await page.locator('.writer-navigation [data-nav="tools"]').click();
  await page.locator("#navigation-save-failure").waitFor();
  assert.equal(await page.evaluate(() => WriterState.state.screen), "write");
  assert.equal(await page.locator(".writer-navigation .rail-item").count(), 5);
  await axeScreen(page, "navigation-save-failure");
  await axeThemes(page, "navigation-save-failure");
  const emergencyBackup = await Promise.all([page.waitForEvent("download"), page.locator("[data-workbackup]").click()]);
  const emergencyPath = path.join(OUT, "failed-device-workspace-backup.json");
  await emergencyBackup[0].saveAs(emergencyPath);
  const emergencyData = JSON.parse(fs.readFileSync(emergencyPath, "utf8"));
  assert.equal(
    emergencyData.bundle.docs.find((d) => d.id === noticeDraftId).cits[
      Object.keys(emergencyData.bundle.docs.find((d) => d.id === noticeDraftId).cits)[0]
    ].amount,
    "245.67",
  );
  await page.evaluate(() => {
    saveDrafts = window.__qaSavedSave;
    delete window.__qaSavedSave;
  });
  await page.locator('.writer-navigation [data-nav="tools"]').click();
  await page.getByRole("heading", { name: "Tools & settings", exact: true }).waitFor();
  assert.equal(await page.locator("#navigation-save-failure").count(), 0);
  await page.locator('.writer-navigation [data-nav="cases"]').click();
  await page.getByRole("button", { name: "Continue document", exact: true }).first().click();
  await page.waitForFunction(() => WriterState.state.screen === "write");
  const previewText = await page.locator(".initial-citation-previews").textContent();
  assert.ok(previewText.includes("CUSTOM INITIAL INSPECTION CHARGE"));
  assert.ok(previewText.includes("245.67"));
  assert.ok(previewText.includes("SPS 321.125"));
  await page.locator('[data-field="sections"]').first().fill("SPS 321.125");
  await page.locator("#citation-review h2").click();
  await page.locator("#initial-citation-replaces").waitFor();
  await page.locator("#btn-final").click();
  assert.equal((await page.locator("#fin-go").textContent()).trim(), "Issue citation");
  await page.locator("#fin-go").click();
  await page.waitForFunction((id) => doc(id) && !doc(id).draft && !!doc(id).filedAt, citId);
  // R35: the initial citation replaces the Official Notice. The notice snapshot is the case's deadline record only: never filed or mailed.
  const replaced = await page.evaluate(
    ([n, c]) => ({
      filed: !!doc(n).filedAt,
      delivered: deliveredByCitation(doc(n)),
      effective: effectiveFiled(doc(n)),
      replacing: initialOrderCitation(doc(c)),
      panel: filingPanel(doc(n)),
    }),
    [noticeDraftId, citId],
  );
  assert.deepEqual(
    { filed: replaced.filed, delivered: replaced.delivered, effective: replaced.effective, replacing: replaced.replacing },
    { filed: false, delivered: true, effective: true, replacing: true },
  );
  assert.ok(replaced.panel.includes("Delivered within the citation"));
  const coverText = await page.evaluate((id) => {
    const t = document.createElement("div");
    t.innerHTML = printJob(doc(id)).html;
    return t.textContent.replace(/\s+/g, " ");
  }, citId);
  for (const phrase of [
    "To appeal this order, you must contact us in writing within 15 days",
    "may be subject to rent abatement",
    "You must comply with this order on a continuous basis",
    "We are issuing a citation for the documented violation.",
    "Complete the corrections listed below by the due dates shown.",
    "fee of $75.00 be charged for reinspections",
    "If you need an interpreter",
  ])
    assert.ok(coverText.includes(phrase), "initial citation cover lacks: " + phrase);
  assert.ok(!coverText.includes("remain those in the Official Notice"));
  assert.ok(!coverText.includes("If you complete the work by the due date, you may avoid"));
  for (const [id, filename] of [[citId, "initial-citation-replacing-notice.pdf"]]) {
    const job = await page.evaluate((id) => printJob(doc(id)), id),
      pdfPage = await browser.newPage();
    await pdfPage.setContent(job.html, { waitUntil: "load" });
    await pdfPage.pdf({ path: path.join(OUT, filename), format: "Letter", printBackground: true, preferCSSPageSize: true });
    await pdfPage.close();
  }
  const citOriginal = await page.evaluate((id) => JSON.stringify(eventsFor(doc(id).caseId).find((e) => e.payload?.snapshot?.id === id)), citId);
  const number = await page.evaluate((id) => Object.values(doc(id).cits)[0].num, citId);
  assert.equal(
    await page.evaluate((id) => eventsFor(doc(id).caseId).filter((e) => e.type === "notice.issued" || e.type === "citation.issued").length, citId),
    2,
  );
  assert.equal(await page.evaluate((id) => reinspFor(doc(id).caseId).length, citId), 0);
  await page.locator(".editor-more summary").click();
  await page.locator("#btn-correct").click();
  await page.waitForFunction(() => !!doc(WriterState.state.docId)?.correction);
  await page.evaluate(async () => {
    await citationPricing.loadShared(doc(WriterState.state.docId), true);
    await saveDrafts();
  });
  await page.locator("#correction-reason").fill("Correct the approved total transcribed from the court instruction.");
  await page.waitForFunction(
    () => doc(WriterState.state.docId).correction.reason === "Correct the approved total transcribed from the court instruction.",
  );
  await page.locator("#correction-external").fill("Synthetic QA court instruction QA-002-C authorizes this correction.");
  await page.locator("[data-review-details=charge] summary").click();
  await page.locator("[data-review-details=pricing] summary").click();
  await page.getByLabel("Ordinance for item 1", { exact: true }).fill("SPS 999.98");
  await page.locator("#citation-review h2").click();
  await page
    .getByLabel("Different charge — approved source / confirmation for item 1", { exact: true })
    .fill("Synthetic court approval of changed charge QA-002-C.");
  await page.getByLabel("Deposit method for item 1", { exact: true }).selectOption("total");
  await page.getByLabel("Approved source / reason for item 1", { exact: true }).fill("Synthetic court approval QA-002-C includes all assessments.");
  await page.getByLabel("Approved total for item 1", { exact: true }).fill("250.00");
  await page.locator("#citation-review h2").click();
  await page.locator("#btn-final").click();
  await page.locator("#correction-reviewed").check();
  await page.locator("#fin-go").click();
  await page.waitForFunction(
    () => doc(WriterState.state.docId)?.revision && doc(WriterState.state.docId)?.type === "citation" && !!doc(WriterState.state.docId).filedAt,
  );
  assert.equal(await page.evaluate(() => Object.values(doc(WriterState.state.docId).cits)[0].num), number);
  assert.equal(
    await page.evaluate((id) => JSON.stringify(eventsFor(doc(id).caseId).find((e) => e.payload?.snapshot?.id === id)), citId),
    citOriginal,
  );
  const citationSummary = await page.evaluate(() => summarize(caseFile(doc(WriterState.state.docId).caseId)));
  assert.equal(citationSummary.citations.length, 1);
  assert.equal(citationSummary.citations[0].amount, 250);
  const manualJob = await page.evaluate(() => printJob(doc(WriterState.state.docId)));
  const manualPage = await browser.newPage();
  await manualPage.setContent(manualJob.html, { waitUntil: "load" });
  await manualPage.pdf({ path: path.join(OUT, "manual-deposit-citation.pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
  await manualPage.close();
  // Direct lookup: SQL responses are fixtures; shared records and IndexedDB are real.
  await page.locator('[data-nav="import"]').first().click();
  await page.getByRole("heading", { name: "Import Inspection Result", exact: true }).waitFor();
  const sqlNumber = "CB2026-241-90001";
  const sqlRow = {
    CaseNumber: sqlNumber,
    SiteAddress: "901 LOOKUP TEST ST, MADISON WI 53703",
    ParcelNumber: "070913125237",
    OwnerName: "LOOKUP TEST OWNER",
    OwnerAddress: "901 LOOKUP TEST ST\nMADISON WI 53703",
    CaseDescription: "Lookup test",
    HistoricDistrict: "No",
    HistoricDistrictName: "",
    IndividualLandmark: "No",
    Landmark: "",
    InspectionDate: "2026-09-18T00:00:00",
    InspectionType: "Initial Inspection",
    InspectionStatus: "Official Notice",
    InspectionTime: "09:05:00",
    InspectorName: "KARIME GRAJALES-PATTON",
  };
  let lookupRows = [sqlRow],
    lookupError = "";
  await context.route("**/case-lookup", async (route) => {
    assert.equal(route.request().postDataJSON().caseNumber, sqlNumber);
    await route.fulfill({
      status: lookupError ? 503 : 200,
      json: lookupError
        ? { ok: false, error: lookupError }
        : {
            ok: true,
            caseNumber: sqlNumber,
            rows: lookupRows,
            source: { kind: "sql", server: "fixture", database: "Synthetic", retrievedAt: new Date().toISOString(), querySha256: "fixture" },
          },
    });
  });
  await page.locator("#lookup-number").fill(sqlNumber);
  await axeScreen(page, "case-lookup");
  await page.screenshot({ path: path.join(OUT, "case-lookup.png"), fullPage: true });
  await page.locator("#lookup-form").getByRole("button", { name: "Find case", exact: true }).click();
  await page.waitForFunction((n) => WriterState.CASES.some((k) => k.number === n) && WriterState.state.screen === "write", sqlNumber);
  assert.equal(await page.evaluate((n) => WriterState.CASES.filter((k) => k.number === n).length, sqlNumber), 1);
  const lookupId = await page.evaluate((n) => WriterState.CASES.find((k) => k.number === n).id, sqlNumber);
  assert.equal(await page.evaluate((id) => docsFor(id).filter((d) => d.draft).length, lookupId), 1);
  await page.locator('[data-nav="import"]').first().click();
  await page.getByRole("heading", { name: "Import Inspection Result", exact: true }).waitFor();
  lookupRows = [
    sqlRow,
    { ...sqlRow, InspectionDate: "2026-09-19T00:00:00", InspectionType: "Reinspection", InspectionStatus: "Extension Processing" },
  ];
  await page.locator("#lookup-number").fill(sqlNumber);
  await page.locator("#lookup-form").getByRole("button", { name: "Find case", exact: true }).click();
  await page.waitForFunction(() => WriterState.state.acc?.source?.kind === "sql" && !WriterState.LOOKUP_BUSY);
  assert.equal(await page.evaluate(() => WriterState.state.acc.sel), null);
  await page.locator("#btn-savework").click();
  await page.reload();
  await page.getByRole("button", { name: "Review import" }).click();
  assert.equal(await page.locator("#lookup-number").inputValue(), sqlNumber);
  assert.equal(await page.evaluate(() => WriterState.state.acc.source.database), "Synthetic");
  await axeScreen(page, "lookup-resumed");
  await page.screenshot({ path: path.join(OUT, "lookup-resumed.png"), fullPage: true });
  lookupError = "Synthetic connection failure; retry is available.";
  await page.locator("#lookup-form").getByRole("button", { name: "Find case", exact: true }).click();
  await page.getByText(lookupError, { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => WriterState.state.acc.cases[0].rows.length), 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await axeScreen(page, "lookup-mobile");
  await page.screenshot({ path: path.join(OUT, "lookup-mobile.png"), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 1440, height: 1050 });

  // R13 duplicate routing and newest issued source, through real UI and helper.
  lookupError = "";
  lookupRows = [sqlRow];
  await page.locator("#lookup-form").getByRole("button", { name: "Find case", exact: true }).click();
  await page.waitForFunction(() => WriterState.state.acc?.sel !== null && !WriterState.LOOKUP_BUSY);
  // R53: searching the same inspection again is either refused as already used or, while its draft is unissued,
  // a refresh of that draft; it can never create a second draft.
  assert.equal(
    await page.evaluate(() => {
      const plan = accelaPlan(WriterState.state.acc);
      return !!plan.refresh || !!plan.used || plan.blockers.length > 0;
    }),
    true,
  );
  await page.getByRole("button", { name: "Continue existing case", exact: true }).click();
  await page.waitForFunction(() => WriterState.state.screen === "write" && !!doc(WriterState.state.docId));
  await page.evaluate(() => {
    const d = doc(WriterState.state.docId);
    d.items = [
      {
        id: uid("x"),
        no: "1",
        title: "Wall repair",
        sections: ["27.05(2)(c)"],
        text: "Repair the damaged wall.",
        prov: "notice",
        due: addDays(recordDay(today), 21),
      },
    ];
    render();
  });
  await page.locator("#btn-final").click();
  await page.locator("#fin-go").click();
  await page.waitForFunction((id) => !!sourceDocFor(id) && !draftDocFor(id), lookupId);
  const importedNotice = await page.evaluate((id) => sourceDocFor(id).id, lookupId);
  await page.waitForFunction(() => !WriterState.AMENDMENT_BUSY && !WriterState.LOOKUP_BUSY && !WriterState.LOCAL_SAVE.saving);
  await page.locator('[data-nav="import"]').first().click();
  await page.getByRole("heading", { name: "Import Inspection Result", exact: true }).waitFor();
  await page.locator("#lookup-number").fill(sqlNumber);
  await page.locator("#lookup-form").getByRole("button", { name: "Find case", exact: true }).click();
  await page.waitForFunction(() => !!WriterState.state.acc && !WriterState.LOOKUP_BUSY);
  assert.equal(await page.locator("#acc-go").isDisabled(), true);
  await axeScreen(page, "duplicate-inspection");
  await page.screenshot({ path: path.join(OUT, "duplicate-inspection.png"), fullPage: true });
  lookupRows = [
    {
      ...sqlRow,
      InspectionType: "Reinspection",
      InspectionStatus: "Extension Processing",
      InspectionDate: "2026-09-19T00:00:00",
      InspectionTime: "14:30:00",
    },
  ];
  await page.locator("#lookup-form").getByRole("button", { name: "Find case", exact: true }).click();
  await page.waitForFunction(() => WriterState.state.acc?.cases[0].rows[0].typeKey === "reinspection" && !WriterState.LOOKUP_BUSY);
  await page.locator("#acc-go").click();
  await page.waitForFunction(() => WriterState.state.screen === "reinspect");
  assert.equal(await page.locator("#ri-date").inputValue(), "2026-09-19");
  assert.equal(await page.locator("#ri-time").inputValue(), "14:30");
  assert.equal(await page.evaluate(() => reinsp(WriterState.state.reinspId).sourceDocId), importedNotice);
  await page.locator(".ri-checks > summary").click();
  await page.locator(".check-link").filter({ hasText: "outcome" }).first().click();
  assert.equal(await page.evaluate(() => !!document.activeElement.dataset.setoc), true);
  await page.locator('[data-setoc="progress"]').first().click();
  await page.locator("[data-ridue]").fill(manualDue);
  // R53: the imported Extension Processing status offers the extension choices directly (no group step).
  await page.locator('[data-action-type="extension"]').check();
  await page.locator("[data-create-action]").click();
  assert.equal(await page.locator("#bulk-due").count(), 0);
  await page.locator("#btn-final").click();
  await page.locator("#fin-go").click();
  await page.waitForFunction((id) => sourceDocFor(id)?.type === "extension" && !draftDocFor(id), lookupId);
  const importedExtension = await page.evaluate((id) => sourceDocFor(id).id, lookupId);
  await page.waitForFunction(() => !WriterState.AMENDMENT_BUSY && !WriterState.LOOKUP_BUSY && !WriterState.LOCAL_SAVE.saving);
  await page.locator('[data-nav="import"]').first().click();
  await page.getByRole("heading", { name: "Import Inspection Result", exact: true }).waitFor();
  await page.locator("#lookup-number").fill(sqlNumber);
  await page.locator("#lookup-form").getByRole("button", { name: "Find case", exact: true }).click();
  await page.waitForFunction(() => !!WriterState.state.acc && !WriterState.LOOKUP_BUSY);
  assert.equal(await page.locator("#acc-go").isDisabled(), true, "Issued reinspection cannot be reused");
  lookupRows = [{ ...lookupRows[0], InspectionDate: "2026-09-20T00:00:00", InspectionTime: "11:15:00" }];
  await page.locator("#lookup-form").getByRole("button", { name: "Find case", exact: true }).click();
  await page.waitForFunction(() => WriterState.state.acc?.cases[0].rows[0].date === "2026-09-20" && !WriterState.LOOKUP_BUSY);
  await page.locator("#acc-go").click();
  await page.waitForFunction(() => WriterState.state.screen === "reinspect");
  assert.equal(
    await page.evaluate(() => reinsp(WriterState.state.reinspId).sourceDocId),
    importedExtension,
    "New import uses the last issued document",
  );
  assert.equal(await page.locator("#ri-time").inputValue(), "11:15");
  await axeScreen(page, "imported-reinspection");
  await page.screenshot({ path: path.join(OUT, "imported-reinspection.png"), fullPage: true });
  // Needs-attention queue: visible due-soon and filing actions remain easy to scan.
  await page.evaluate((hash) => {
    const id = "qa-needs-attention";
    WriterState.CASES.push({
      id,
      number: "CB2026-241-90002",
      address: "902 QUEUE TEST ST",
      owner: "QUEUE TEST OWNER",
      parcel: "070913125237",
      inspectorId: INSPECTORS[0].id,
      date: recordDay(today),
      time: "09:00",
    });
    WriterState.DOCS.push({
      id: "qa-needs-attention-doc",
      caseId: id,
      type: "notice",
      created: recordDay(today),
      mailed: recordDay(today),
      status: "Final",
      draft: false,
      filedAt: nowISO(),
      filedArtifact: { filename: "queue-verified.pdf", sha256: hash },
      items: [{ id: "qa-item", no: "1", done: false, withdrawn: false, due: addDays(recordDay(today), 3), text: "Repair test item." }],
      cits: {},
    });
    WriterState.ARTIFACT_LOCATIONS["qa-needs-attention-doc"] = ["shared"];
    WriterState.state.acc = {
      fileName: "Queue review fixture",
      caseIx: 0,
      cases: [{ number: "CB2026-241-90003", address: "903 QUEUE TEST ST" }],
      source: { kind: "sql" },
    };
    WriterState.WORK.acc = clone(WriterState.state.acc);
    WriterState.state.screen = "cases";
    WriterState.state.caseFilter = "attention";
    WriterState.state.caseQ = "";
    WriterState.state.caseInspector = "";
    render();
  }, artifactHash);
  await page.getByRole("heading", { name: "Needs attention" }).waitFor();
  assert.equal(await page.getByText("Import awaiting review", { exact: true }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "Review import" }).count(), 1);
  assert.equal(await page.getByText("CB2026-241-90002", { exact: true }).count(), 1);
  assert.equal(await page.getByRole("button", { name: "Start reinspection" }).count(), 1);
  await axeScreen(page, "needs-attention");
  await page.screenshot({ path: path.join(OUT, "needs-attention.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await axeScreen(page, "needs-attention-mobile");
  await page.screenshot({ path: path.join(OUT, "needs-attention-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  fs.writeFileSync(
    path.join(OUT, "lookup-results.json"),
    JSON.stringify(
      {
        passed: true,
        sql: "fixture; Windows/SQL not contacted",
        checks: [
          "single search creates exactly one notice draft",
          "ambiguous inspections require review",
          "lookup input and review survive IndexedDB reload",
          "connection error preserves review",
          "mobile form has no horizontal page overflow",
        ],
      },
      null,
      2,
    ),
  );
  // R24 safety centre, health and reviewed three-way case fields.
  await page.locator('.writer-navigation [data-nav="tools"]').click();
  await page.locator(".tool-action[data-sync-safety]").click();
  await axeScreen(page, "sync-safety");
  await page.locator("[data-utility-close]").click();
  await page.locator(".tool-action[data-sync-safety]").click();
  await page.locator("[data-saved-detail=diagnostics] summary").click();
  await page.locator("[data-setup-health]").first().click();
  await page.locator("[data-health-probe]").click();
  await axeScreen(page, "setup-health");
  await axeThemes(page, "setup-health");
  assert.equal(
    await page
      .locator("#it-diagnostics")
      .inputValue()
      .then((text) => text.includes("caseNumber")),
    false,
  );
  assert.equal(await page.locator("tr").filter({ hasText: "Program/helper versions" }).locator("td").textContent(), "Match");
  await page.keyboard.press("Escape");
  const mergeBase = {
    id: "qa-resolve",
    number: "QA-RESOLVE",
    address: "BASE ROAD",
    owner: "BASE OWNER",
    parcel: "BASE PARCEL",
    inspectorId: "i4",
    date: "2026-09-18",
    time: "09:00",
    emails: [],
  };
  const mergeShared = {
    format: "madison-case-file",
    schema: 3,
    case: { ...mergeBase, owner: "SHARED OWNER", address: "SHARED ROAD" },
    events: [],
    inspectors: [],
  };
  fs.writeFileSync(path.join(work, "Case JSON Files", "SHARED ROAD - QA-RESOLVE.json"), JSON.stringify(mergeShared));
  await page.evaluate((base) => {
    WriterState.CASES.push({ ...base, owner: "LOCAL OWNER", parcel: "LOCAL PARCEL" });
    WriterState.SAVE_CHECKPOINTS[base.id] = { case: base, events: [] };
    WriterState.state.screen = "cases";
    WriterState.state.caseQ = "";
    WriterState.state.modal = null;
    render();
    return preflightCase(base.id, "reviewed merge", () => {});
  }, mergeBase);
  await page.locator("[data-conflict-choice]").selectOption("merge");
  await page.locator("[data-conflict-value]").fill("REVIEWED OWNER");
  await axeScreen(page, "conflict-review");
  await page.locator("[data-conflict-apply]").click();
  await page.waitForFunction(() => !WriterState.RESOLUTION_BUSY && !WriterState.PREFLIGHT_CONFLICT && kase("qa-resolve").owner === "REVIEWED OWNER");
  await page.waitForFunction(() => WriterState.LASTWRITE?.ok && WriterState.LASTWRITE.name.includes("QA-RESOLVE"));
  const resolved = JSON.parse(fs.readFileSync(path.join(work, "Case JSON Files", "SHARED ROAD - QA-RESOLVE.json")));
  assert.equal(resolved.case.owner, "REVIEWED OWNER");
  assert.equal(resolved.case.address, "SHARED ROAD");
  assert.equal(resolved.case.parcel, "LOCAL PARCEL");
  assert.deepEqual(resolved.events, []);
  const lockDir = path.join(work, "Case JSON Files", ".locks");
  fs.mkdirSync(lockDir, { recursive: true });
  const lockName = require("crypto").createHash("sha256").update("case:qa-resolve").digest("hex") + ".lock";
  fs.writeFileSync(path.join(lockDir, lockName), JSON.stringify({ host: "QA stopped workstation", pid: 999999, at: Date.now() / 1000 - 3600 }));
  await page.locator('.writer-navigation [data-nav="tools"]').click();
  await page.locator(".tool-action[data-sync-safety]").click();
  await page.locator("[data-saved-detail=diagnostics] summary").click();
  page.once("dialog", (dialog) => dialog.accept("QA-RESOLVE"));
  await page.locator("[data-lock-inspect]").click();
  await page.locator("#lock-release-form").waitFor();
  await axeScreen(page, "lock-assistant");
  await page.locator("[name=administrator]").fill("QA Administrator");
  await page.locator("[name=reason]").fill("Verified stopped workstation and no active save before release");
  await page.locator("[name=confirmed]").check();
  await page.getByRole("button", { name: "Release verified lock with audit note" }).click();
  await page.getByText("No lock is present for this case.", { exact: true }).waitFor();
  assert.equal(fs.existsSync(path.join(lockDir, lockName)), false);
  assert.equal(fs.readdirSync(path.join(work, "Case JSON Files", "_lock-administration")).filter((n) => n.endsWith(".json")).length, 1);
  await page.keyboard.press("Escape");
  // R24 global shared search, reminders, timeline and draft-only batch actions.
  await page.locator("[data-global-search]").click();
  await page.locator("#global-search-form [name=query]").fill("REVIEWED OWNER");
  await page.locator("#global-search-form button[type=submit]").click();
  await page.locator('[data-global-open="QA-RESOLVE"]').waitFor();
  await axeScreen(page, "global-search");
  await axeThemes(page, "global-search");
  await page.locator('[data-global-open="QA-RESOLVE"]').click();
  await page.waitForFunction(() => WriterState.state.caseQ === "QA-RESOLVE");
  await page.evaluate(() => {
    WriterState.state.caseQ = "QA-001";
    WriterState.state.caseFilter = "all";
    WriterState.state.screen = "cases";
    render();
  });
  await page.locator(".case-table details summary").first().click();
  const timelineBefore = await page.evaluate(() => JSON.stringify(eventsFor("qa-001")));
  await page.locator('[data-timeline="qa-001"]').click();
  await page.locator("#timeline-filter").selectOption("issued");
  await axeScreen(page, "case-timeline");
  const timelineCSV = await Promise.all([page.waitForEvent("download"), page.locator("[data-timeline-csv]").click()]);
  await timelineCSV[0].saveAs(path.join(OUT, "timeline.csv"));
  assert.equal(await page.evaluate(() => JSON.stringify(eventsFor("qa-001"))), timelineBefore);
  await page.keyboard.press("Escape");
  let reminderJobs = [];
  await context.route("**/email/reminder", async (route) => {
    reminderJobs.push(route.request().postDataJSON());
    await route.fulfill({ json: { ok: true } });
  });
  await page.locator('.writer-navigation [data-nav="tools"]').click();
  await page.locator("[data-reminders]").click();
  await page.locator("#reminder-settings [name=enabled]").check();
  await page.locator("#reminder-settings [name=days]").fill("30");
  await axeScreen(page, "reminder-settings");
  await page.locator("#reminder-settings button[type=submit]").click();
  await page.locator('[data-nav="cases"]').first().click();
  await page.locator("[data-reminder-draft]").first().waitFor();
  assert.equal(reminderJobs.length, 0);
  await page.locator("[data-reminder-draft]").first().click();
  await page.locator("#reminder-email [name=to]").fill("qa-reminder@example.invalid");
  await axeScreen(page, "reminder-draft");
  await page.locator("#reminder-email button[type=submit]").click();
  await page.waitForFunction(() => document.querySelector("#reminder-email button[type=submit]")?.disabled === false);
  assert.equal(reminderJobs.length, 1);
  await page.keyboard.press("Escape");
  const batchIds = await page.evaluate(() => {
    const ids = [];
    for (let n = 1; n <= 2; n++) {
      const cid = "qa-batch-" + n;
      WriterState.CASES.push({
        id: cid,
        number: "QA-BATCH-" + n,
        address: n + " BATCH ROAD",
        owner: "BATCH OWNER",
        date: recordDay(today),
        time: "09:00",
        inspectorId: "i4",
      });
      newDoc(cid, "notice");
      const d = doc(WriterState.state.docId);
      d.items = [{ id: "batch-item-" + n, no: "1", title: "Batch test", text: "Repair test item.", due: "", sections: ["27.05(2)(c)"] }];
      ids.push(d.id);
    }
    render();
    return ids;
  });
  const batchBefore = await page.evaluate(() => JSON.stringify(WriterState.EVENTS));
  await page.locator('.writer-navigation [data-nav="tools"]').click();
  await page.locator("[data-batch-due]").click();
  for (const id of batchIds) await page.locator('[data-batch-doc="' + id + '"]').check();
  await page.locator("#batch-due-form [name=due]").fill(manualDue);
  await axeScreen(page, "batch-due-dates");
  await page.locator("#batch-due-form button[type=submit]").click();
  await page.waitForFunction(({ ids, date }) => ids.every((id) => doc(id).items[0].due === date), { ids: batchIds, date: manualDue });
  assert.equal(await page.evaluate(() => JSON.stringify(WriterState.EVENTS)), batchBefore);
  // File selected existing PDF bytes through the real helper; retain unselected PDF.
  const sharedPDFs = path.join(work, "shared-program");
  fs.mkdirSync(sharedPDFs, { recursive: true });
  fs.writeFileSync(path.join(work, "share.txt"), sharedPDFs);
  const localPDFs = path.join(work, "Documents To Be Mailed And Recorded");
  fs.mkdirSync(localPDFs, { recursive: true });
  const pdfBytes = fs.readFileSync(path.join(OUT, "notice.pdf"));
  fs.writeFileSync(path.join(localPDFs, "selected.pdf"), pdfBytes);
  fs.writeFileSync(path.join(localPDFs, "retained.pdf"), pdfBytes);
  await page.locator(".tool-action[data-sync-safety]").click();
  await page.locator("[data-outbox]").click();
  await page.locator("#outbox-form [name=pdf]").first().check();
  await axeScreen(page, "pdf-outbox");
  await page.evaluate(() => {
    window.__qaOpen = window.open;
    window.__qaPrintWindows = [];
    window.open = () => {
      const viewer = { closed: false, focus() {}, print() {}, addEventListener() {}, close() {}, location: { href: "" } };
      window.__qaPrintWindows.push(viewer);
      return viewer;
    };
  });
  await page.locator("[data-outbox-print]").click();
  await page.waitForFunction(() => window.__qaPrintWindows[0]?.location.href.startsWith("blob:"));
  await page.evaluate(() => {
    window.open = window.__qaOpen;
  });
  // Select a known name after verifying the native viewer handoff.
  await page.locator("#outbox-form [name=pdf]:checked").uncheck();
  const selectedIndex = await page.evaluate(() => WriterState.OUTBOX_FILES.findIndex((x) => x.name === "selected.pdf"));
  await page.locator('#outbox-form [name=pdf][value="' + selectedIndex + '"]').check();
  await page.locator("#outbox-form button[type=submit]").click();
  await page.waitForFunction(() => WriterState.OUTBOX_FILES.length === 1 && WriterState.OUTBOX_FILES[0].name === "retained.pdf");
  assert.deepEqual(fs.readFileSync(path.join(sharedPDFs, "Documents To Be Mailed And Recorded", "selected.pdf")), pdfBytes);
  assert.equal(fs.existsSync(path.join(localPDFs, "retained.pdf")), true);
  assert.equal(await page.evaluate(() => WriterState.HELPER.outbox), 1, "Outbox presentation uses the refreshed retained-file count");
  await page.keyboard.press("Escape");
  // Per-report CSV and shared settings are read-only against case history.
  await reports.evaluate(() => {
    ReportsState.S.F.from = "2020-01-01";
    ReportsState.S.F.to = TODAY;
    ReportsState.S.F.asOf = TODAY;
    ReportsState.S.screen = "allCases";
    ReportsState.S.view = "table";
    render();
  });
  for (const report of await reports.evaluate(() => REPORTS.map((r) => r.id))) {
    await reports.locator("#report-menu").evaluate((el) => (el.open = true));
    await reports.locator('.rail [data-screen="' + report + '"]').click();
    await reports.locator("#report-exports").evaluate((el) => (el.open = true));
    const csv = await Promise.all([reports.waitForEvent("download"), reports.locator("[data-report-csv]").click()]);
    await csv[0].saveAs(path.join(OUT, report + ".csv"));
    await axeScreen(reports, "csv-" + report);
  }
  await reports.locator('.rail [data-screen="allCases"]').click();
  if (await reports.locator('[data-report-sort="0"]').count()) await reports.locator('[data-report-sort="0"]').click();
  assert.equal(await reports.locator("th[aria-sort=ascending]").count(), 1);
  await reports.locator("#report-views").evaluate((el) => (el.open = true));
  reports.once("dialog", (dialog) => dialog.accept("QA shared report view"));
  await reports.locator("[data-share-report-view]").click();
  await reports.waitForFunction(() =>
    JSON.parse(localStorage.getItem("madison-message-history-v1") || "[]").some((m) => m.text.includes("QA shared report view")),
  );
  await reports.locator("[data-shared-report-views]").click();
  await axeScreen(reports, "shared-report-views");
  await reports.locator("[data-load-shared-view]").first().click();
  assert.equal(await reports.evaluate(() => ReportsState.S.screen), "allCases");
  assert.equal(fs.readdirSync(path.join(work, "Case JSON Files", "Reporting Index", "Views")).filter((n) => n.endsWith(".json")).length, 1);
  assert.equal(await reports.evaluate(() => humanCorrectionValue({ before: ["First", "Second"], flag: true })), "before: First; Second; flag: Yes");
  // R25: legacy shared identity survives actual production Writer handoff/save.
  const legacyDay = await page.evaluate(() => recordDay(today));
  for (const [index, number] of ["CB_2026_01", "CB 2026 01", "12"].entries()) {
    const file = {
      format: "madison-case-file",
      schema: 3,
      case: { id: "qa-legacy-" + index, number, address: "LEGACY ROAD", owner: "ORIGINAL OWNER", date: legacyDay, time: "09:00", inspectorId: "i4" },
      events: [],
      inspectors: [],
    };
    const name = "LEGACY ROAD - " + number + ".json";
    fs.writeFileSync(path.join(work, "Case JSON Files", name), JSON.stringify(file));
    await page.evaluate(async (number) => {
      await writerOpenReportedCase({ number });
      const k = WriterState.CASES.find((k) => k.number === number);
      k.owner = "REVIEWED LEGACY OWNER";
      if (!(await saveCaseFile(k.id))) throw new Error("Legacy save failed: " + WriterState.LASTWRITE?.why);
    }, number);
    const saved = JSON.parse(fs.readFileSync(path.join(work, "Case JSON Files", name)));
    assert.equal(saved.case.number, number);
    assert.equal(saved.case.owner, "REVIEWED LEGACY OWNER");
    assert.deepEqual(saved.events, []);
    await axeScreen(page, "legacy-case-" + index);
  }
  await page.evaluate(() => {
    WriterState.CASES.push({ id: "qa-blank-number", number: "", address: "UNSAVED ROAD", owner: "UNSAVED OWNER" });
    WriterState.PENDING.push({ cid: "qa-unrelated", name: "OTHER ROAD - QA-OTHER.json", body: "{}" });
    WriterState.state.caseQ = "";
    WriterState.state.screen = "cases";
    render();
    if (caseState(kase("qa-blank-number")).label !== "Case number needs correction") throw new Error("Missing invalid-number state");
  });
  await axeScreen(page, "blank-number-with-unrelated-queue");
  // The Reports workflow is complete. Release its live timers before the later
  // isolated presentation benchmarks, as closing Reports does in normal use.
  await reports.close();
  clearTimeout(coreTimer);
  suiteTimings.push({ suite: "core-browser-workflow", elapsedMs: Math.round(performance.now() - coreStarted), limitMs: 150000 });
  const r26Results = await runSuite("browser_r26.js", () => require("./browser_r26.js")(browser, page, context, OUT, axeScreen));
  const r30Results = await runSuite("browser_r30.js", () => require("./browser_r30.js")(browser, page, OUT, axeScreen));
  const r33Results = await runSuite("browser_r33.js", () => require("./browser_r33.js")(browser, page, OUT, axeScreen, work, base));
  const r34Results = await runSuite("browser_r34.js", () => require("./browser_r34.js")(browser, page, OUT, axeScreen));
  const r32Results = await runSuite("browser_r32.js", () => require("./browser_r32.js")(browser, page, OUT, axeScreen, work, base));
  const r31Results = await runSuite("browser_r31.js", () => require("./browser_r31.js")(browser, page, OUT, axeScreen, work, base));
  const r40Results = await runSuite("browser_r40.js", () => require("./browser_r40.js")(browser, page, OUT, axeScreen, work, base));
  const r41Results = await runSuite("browser_r41.js", () => require("./browser_r41.js")(browser, page, OUT, axeScreen, axeThemes));
  const r42Results = await runSuite("browser_r42.js", () => require("./browser_r42.js")(browser, page, OUT, axeScreen, axeThemes));
  const r43Results = await runSuite("browser_r43.js", () => require("./browser_r43.js")(browser, page, OUT, axeScreen, axeThemes));
  const r45Results = await runSuite("browser_r45.js", () => require("./browser_r45.js")(browser, page, OUT, axeScreen, axeThemes));
  const r46Results = await runSuite("browser_r46.js", () => require("./browser_r46.js")(browser, page, OUT, axeScreen, axeThemes));
  const r48Results = await runSuite("browser_r48.js", () => require("./browser_r48.js")(browser, page, OUT, axeScreen, axeThemes));
  const r47Results = await runSuite("browser_r47.js", () => require("./browser_r47.js")(browser, page, OUT, axeScreen, axeThemes));
  const r50ImportResults = await runSuite("browser_r50_import.js", () => require("./browser_r50_import.js")(browser, page, OUT, axeScreen));
  const r49Results = await runSuite("browser_r49.js", () => require("./browser_r49.js")(browser, page, OUT, axeScreen, axeThemes));
  const r44Results = await runSuite("browser_r44.js", () => require("./browser_r44.js")(browser, page, OUT, axeScreen, axeThemes));
  const r54Results = await runSuite("browser_r54.js", () => require("./browser_r54.js")(browser, page, OUT, axeScreen));
  assert.deepEqual(errors, []);
  assert.deepEqual(cspViolations, [], "Both applications operate without CSP violations");
  assert.equal(
    axeResults.every((x) => !x.violations.length),
    true,
    "All axe screens must pass",
  );
  await page.clock.install();
  await page.evaluate(() => A11Y.notify("QA success timing", { severity: "success", duration: 6000 }));
  const timedMessage = page.locator("[data-message]").filter({ hasText: "QA success timing" });
  await timedMessage.hover();
  await page.clock.fastForward(6001);
  assert.equal(await timedMessage.count(), 1, "success remains while hovered");
  await timedMessage.locator("button").focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(6001);
  assert.equal(await timedMessage.count(), 1, "success remains while focused");
  await page.locator('.writer-navigation [data-nav="tools"]').focus();
  await page.clock.fastForward(6001);
  assert.equal(await timedMessage.count(), 0, "success hides after resumed duration");
  fs.writeFileSync(
    path.join(OUT, "browser-results.json"),
    JSON.stringify(
      {
        passed: true,
        productionBuild: true,
        release: fs.readFileSync(path.join(ROOT, "build/generated/RELEASE"), "utf8").trim(),
        runtimeHashes,
        suiteTimings,
        axe: axeResults,
        pdfDelivery: "mocked; layout rendered by real Chromium",
        pdfResults,
        r50ImportResults,
        cspViolations,
        r49Results,
        r48Results,
        r47Results,
        r46Results,
        r45Results,
        r44Results,
        r54Results,
        r43Results,
        r42Results,
        r41Results,
        r40Results,
        r26Results,
        r30Results,
        r31Results,
        r32Results,
        r33Results,
        r34Results,
        reportCounts,
        checks: [
          "five-destination Writer rail and grouped Tools controls",
          "failed navigation retains editor and downloads approved fields in backup",
          "equivalent ordinance typing preserves approved deposit",
          "dynamic helper health version match",
          "clickable review checks focus exact fields and open collapsed details",
          "field highlights clear on correction",
          "duplicate initial and reinspection imports blocked",
          "new import uses latest issued follow-up and loads date/time",
          "bulk assignment only on new notices",
          "compact reinspection date controls",
          "selection toggle removes and reselects without duplicates",
          "due dates follow the document in a compact panel",
          "fill-in blanks render as outlined bubbles",
          "manual grouped deadlines",
          "missing deposit resolved with approved total",
          "citation deposit save and reload",
          "real citation issuance and linked deposit correction",
          "one citation in reports after correction",
          "SSRS import surface contains only the intended entry paths",
          "Needs attention combines due-soon cases and imports with clear next actions",
          "Needs attention queue fits a narrow mobile viewport",
          "partial inspection save and reload",
          "return to worksheet and recover edited draft",
          "atomic visit and follow-up with lost response",
          "pending workspace backup restored in a fresh profile",
          "partial record note save and reload",
          "compliance closes only after confirmed save",
          "complete record and reporting after reload",
          "correction UI + before/after review",
          "lost save response and idempotent real-helper retry",
          "original snapshot preserved",
          "case detail update automatically reaches future documents and reports",
          "correction email recipient carry-forward",
          "correction does not show a separate follow-through prompt",
          "new-case flow",
          "multi-add picker",
          "issue + real shared case and summary",
          "duplicate writer tab guard",
          "local workspace restored",
          "mobile overflow",
          "viewport-independent print HTML",
          "six document types",
          "corrected citation copies",
          "long notice",
          "ten reports including document actions",
          "Excel download",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(OUT, "environment.json"),
    JSON.stringify(
      {
        platform: process.platform,
        node: process.version,
        chromium: browser.version(),
        chromiumExecutable: options.executablePath || "Playwright default",
        windowsSmb: false,
        citySql: false,
        outlook: false,
        nativePdfRenderer: false,
        pdfOperationRenderer: "browser PDF bytes through a test-only renderer fixture",
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(OUT, "helper.log"), helperLog);
  console.log("PASS browser flows, shared case saving, reports, and PDF generation. Outputs: " + OUT);
})()
  .catch(async (e) => {
    console.error(e);
    if (auditPage) {
      try {
        await auditPage.screenshot({ path: path.join(OUT, "failure.png"), fullPage: true });
        console.error(
          await auditPage.evaluate(() => ({
            screen: WriterState.state.screen,
            filter: WriterState.state.caseFilter,
            modal: WriterState.state.modal,
            currentDoc: doc(WriterState.state.docId),
            blockers: doc(WriterState.state.docId) ? blockers(doc(WriterState.state.docId)) : [],
            recordForms: WriterState.WORK.recordForms,
            recordAttempts: WriterState.RECORD_ATTEMPTS,
            amendmentError: WriterState.state.amendmentError,
            recentEvents: eventsFor(doc(WriterState.state.docId)?.caseId).slice(-5),
            pending: WriterState.PENDING.map((p) => p.name),
            cases: WriterState.CASES.map((k) => ({ number: k.number, state: caseState(k) })),
          })),
        );
      } catch (err) {}
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    clearTimeout(coreTimer);
    if (browser) await browser.close();
    if (server) server.kill();
    fs.rmSync(work, { recursive: true, force: true });
  });
