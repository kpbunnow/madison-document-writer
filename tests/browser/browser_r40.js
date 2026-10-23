/* Additional R40 production-browser checks. All records are synthetic. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, out, axeScreen, work, base) {
  // Real HTTP filing of a browser-rendered PDF through a test-only renderer fixture.
  // Abort the first response after the real helper has durably filed the PDF.
  const receiptData = await page.evaluate(async () => {
    const d = WriterState.DOCS.find(
      (d) => !d.draft && !d.void && !d.superseded && d.type === "citation" && !Object.values(d.cits || {}).some((c) => c.mandatoryAppearance),
    );
    const snapshot = eventsFor(d.caseId).find((e) => e.payload?.snapshot?.id === d.id).payload.snapshot;
    const tag = d.id.replace(/[^A-Za-z0-9]/g, "").slice(-8);
    return {
      html: printJob(d).html,
      filename: "R40 real retry - " + tag + ".pdf",
      operation: { docId: d.id, caseId: d.caseId, caseNumber: kase(d.caseId).number, version: await recordIntegrity.sourceHash(snapshot) },
    };
  });
  const print = await browser.newPage();
  await print.setContent(receiptData.html, { waitUntil: "load" });
  await print.emulateMedia({ media: "print" });
  await print.evaluate(() => document.fonts.ready);
  const rendered = await print.pdf({ format: "Letter", printBackground: true, preferCSSPageSize: true });
  await print.close();
  fs.writeFileSync(path.join(work, "__qa_pdf_original.pdf"), rendered);
  let original;
  const lose = async (route) => {
    const response = await route.fetch({ timeout: 120000 });
    original = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(original));
    await route.abort("failed");
  };
  await page.route("**/save-pdf", lose);
  const lost = await page.evaluate(async (data) => {
    try {
      await fetch("/save-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-DocWriter-Token": document.querySelector("meta[name=docwriter-token]").content },
        body: JSON.stringify(data),
      });
      return false;
    } catch (error) {
      return true;
    }
  }, receiptData);
  await page.unroute("**/save-pdf", lose);
  assert.equal(lost, true);
  assert.equal(original.ok, true);
  const raw = fs.readFileSync(original.path),
    mtime = fs.statSync(original.path).mtimeMs;
  const response = await page.request.post(base + "/save-pdf", {
    data: receiptData,
    timeout: 120000,
    headers: { "X-DocWriter-Token": await page.locator("meta[name=docwriter-token]").getAttribute("content") },
  });
  const retried = await response.json();
  assert.equal(response.status(), 200, JSON.stringify(retried));
  assert.equal(retried.sha256, original.sha256);
  assert.equal(fs.statSync(original.path).mtimeMs, mtime);
  assert.deepEqual(fs.readFileSync(retried.path), raw);
  assert.equal(fs.readFileSync(path.join(work, "__qa_render_count.txt"), "utf8"), "1", "exact retry never invokes the renderer twice");
  fs.writeFileSync(path.join(out, "r40-retry-original.pdf"), raw);
  const details = await page.evaluate(() => {
    WriterState.state.modal = null;
    WriterState.state.picker = false;
    WriterState.state.screen = "cases";
    WriterState.state.caseQ = "";
    WriterState.state.caseFilter = "all";
    const k = WriterState.CASES.find((k) => docsFor(k.id).some((d) => deliveredByCitation(d))),
      d = k && docsFor(k.id).find((d) => deliveredByCitation(d));
    if (!d) throw Error("Expected delivered internal notice from real publication");
    const tasks = workspaceTasks([{ k, st: caseState(k) }]);
    if (
      tasks.find((t) => t.key === "filing").items.some((x) => x.action.includes(d.id)) ||
      tasks.find((t) => t.key === "artifacts").items.some((x) => x.action.includes(d.id))
    )
      throw Error("Internal notice produced an independent PDF task");
    render();
    return { internalNoticeId: d.id, state: pdfTransferState(d), taskCount: tasks.find((t) => t.key === "artifacts").count };
  });
  await axeScreen(page, "r40-workspace-task-status");
  await page.screenshot({ path: path.join(out, "r40-workspace-task-status.png"), fullPage: true });
  // Drive the actual administration UI against an orphan global lock.
  const lockDir = path.join(work, "Case JSON Files", ".locks");
  fs.mkdirSync(lockDir, { recursive: true });
  const lockName = require("crypto").createHash("sha256").update("lock-administration").digest("hex") + ".lock";
  fs.writeFileSync(
    path.join(lockDir, lockName),
    JSON.stringify({ host: "Synthetic stopped remote helper", pid: 999999, at: Date.now() / 1000 - 3600, owner: "r40-orphan" }),
  );
  await page.locator('.writer-navigation [data-nav="tools"]').click();
  await page.locator(".tool-action[data-sync-safety]").click();
  await page.locator("[data-saved-detail=diagnostics] summary").click();
  page.once("dialog", (dialog) => dialog.accept("QA-R40-UNRELATED"));
  await page.locator("[data-lock-inspect]").click();
  await page.locator("#lock-release-form").waitFor();
  assert.ok((await page.locator("#utility-dialog").innerText()).includes("Shared lock administration"));
  await axeScreen(page, "r40-global-lock-recovery");
  await page.screenshot({ path: path.join(out, "r40-global-lock-recovery.png"), fullPage: true });
  await page.locator("[name=administrator]").fill("Synthetic R40 Administrator");
  await page.locator("[name=reason]").fill("Verified the owning remote helper was stopped before the recovery test.");
  await page.locator("[name=confirmed]").check();
  await page.getByRole("button", { name: "Release verified lock with audit note" }).click();
  await page.getByText("No lock is present for this case.", { exact: true }).waitFor();
  assert.equal(fs.existsSync(path.join(lockDir, lockName)), false);
  await page.keyboard.press("Escape");
  const result = {
    passed: true,
    internalNotice: details,
    globalRecovery: true,
    realChromiumPdf: {
      documentId: receiptData.operation.docId,
      filename: receiptData.filename,
      bytes: raw.length,
      sha256: original.sha256,
      lostResponse: true,
      identicalRetry: true,
      fileUnchanged: true,
      rendererCalls: 1,
      helperRenderer: "test-only fixture using actual browser PDF bytes",
    },
    nativeHandoff: "Windows native renderer and Outlook not tested",
  };
  fs.writeFileSync(path.join(out, "r40-results.json"), JSON.stringify(result, null, 2));
  return result;
};
