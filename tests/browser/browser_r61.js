/* New R61 histories and Reasons-only output in real Chromium. Synthetic only. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path");
const { execFileSync } = require("child_process");
module.exports = async function (browser, hostPage, OUT, axeScreen, work, base) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1100 } });
  const page = await context.newPage(),
    print = await context.newPage();
  try {
    await page.goto(new URL("/", hostPage.url()).href);
    await page.waitForFunction(() => typeof WriterState !== "undefined");
    await page.evaluate(() => {
      WriterState.CASES = [
        {
          id: "k1",
          number: "QA-R61",
          address: "100 SYNTHETIC AVENUE",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["100 TEST ROAD", "MADISON WI 53703"],
          inspectorId: INSPECTORS[0].id,
          date: "2026-03-01",
          time: "09:00",
          emails: [],
        },
      ];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.CASEDIR = null;
      WriterState.NEEDGRANT = false;
      newDoc("k1", "notice");
      const d = doc(WriterState.state.docId);
      d.type = "compliance";
      d.items = Array.from({ length: 3 }, (_, n) => ({
        id: "item-" + n,
        no: String(n + 1),
        text: "Repair the synthetic condition.",
        sections: ["27.05(2)(c)"],
        abate: n === 0,
        done: true,
        doneOn: "2026-03-14",
        hist: [
          { on: "2026-03-01", oc: "initial" },
          { on: "2026-03-09", oc: "none", note: "Observation retained for item " + n },
          { on: "2026-03-14", oc: "corrected", note: "Repair verified for item " + n },
        ],
      }));
      render();
    });
    await axeScreen(page, "r61-compliance-history");
    assert.deepEqual(await page.locator("td.c-ab").allTextContents(), ["Yes", "No", "No"]);
    const job = await page.evaluate(() => printJob(doc(WriterState.state.docId)));
    await print.setContent(job.html);
    await print.emulateMedia({ media: "print" });
    const rows = await print.locator(".visit-list").allTextContents();
    assert.equal(rows.length, 3);
    for (const text of rows) {
      assert.equal(text.split("03/14/2026").length - 1, 1, "correction date appears once");
      assert.match(text, /CORRECTED/);
      assert.ok(!text.includes("Completed"));
      assert.match(text, /Days Outstanding: 13/);
    }
    const compliancePath = path.join(OUT, "r61-compliance-history.pdf");
    await print.pdf({ path: compliancePath, format: "Letter", printBackground: true, preferCSSPageSize: true });
    const pdfText = execFileSync("pdftotext", [compliancePath, "-"], { encoding: "utf8" }).replace(/\s+/g, " ");
    for (let n = 0; n < 3; n++) assert.ok(pdfText.includes("Repair verified for item " + n));
    const longJob = await page.evaluate(() => {
      const d = doc(WriterState.state.docId);
      d.items = d.items.slice(0, 1);
      d.items[0].hist[1].note = Array.from({ length: 450 }, (_, n) => "finding-" + n).join(" ");
      return printJob(d);
    });
    await print.setContent(longJob.html);
    assert.ok((await print.locator(".sheet").count()) > 1);
    const notes = await print.locator(".visit-list em").allTextContents();
    assert.deepEqual(
      notes
        .filter((t) => t.startsWith("Note: "))
        .map((t) => t.slice(6))
        .join("")
        .match(/finding-\d+/g),
      Array.from({ length: 450 }, (_, n) => "finding-" + n),
    );
    for (const overflow of await print
      .locator(".sheet")
      .evaluateAll((es) => es.map((e) => e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2)))
      assert.equal(overflow, false);
    const best = await page.evaluate(() => {
      const d = doc(WriterState.state.docId);
      d.type = "bestInterestExtension";
      d.special = {
        affected: ["1"],
        originalDues: { 1: "2026-03-01" },
        reason: "Additional time permits the documented repair plan.",
        noSafety: true,
      };
      d.items[0].done = false;
      d.items[0].doneOn = "";
      d.items[0].hist = null;
      d.items[0].due = "2026-11-30";
      render();
      return printJob(d);
    });
    await axeScreen(page, "r61-best-interest-reasons");
    assert.equal(await page.locator("#r26-details [data-special]").count(), 2);
    assert.equal(await page.getByLabel("Reasons for Additional Time", { exact: true }).count(), 1);
    await print.setContent(best.html);
    assert.equal(await print.locator(".extension-signer,.blank").count(), 0);
    const bestText = await print.locator("body").innerText();
    assert.ok(!bestText.includes("Unlisted items retain"));
    assert.ok(!bestText.includes("◯"));
    assert.ok(bestText.includes("Additional time permits the documented repair plan."));
    const bestPath = path.join(OUT, "r61-best-interest.pdf");
    await print.pdf({ path: bestPath, format: "Letter", printBackground: true, preferCSSPageSize: true });
    assert.ok(!execFileSync("pdftotext", [bestPath, "-"], { encoding: "utf8" }).includes("◯"));
    await page.screenshot({ path: path.join(OUT, "r61-best-interest-editor.png"), fullPage: true });
    fs.writeFileSync(path.join(OUT, "r61-best-interest.html"), best.html);
    // APIRequestContext bypasses the browser harness's mocked delivery routes.
    // The helper's test-only renderer receives the actual Chromium bytes for
    // this exact HTML; coordination, filing, receipts and retrieval are real HTTP.
    const packets = JSON.parse(fs.readFileSync(path.join(OUT, "r33-packet-jobs.json"), "utf8"));
    const previous = JSON.parse(fs.readFileSync(path.join(OUT, "r40-results.json"), "utf8")).realChromiumPdf;
    const headers = { "X-DocWriter-Token": await hostPage.locator("meta[name=docwriter-token]").getAttribute("content") };
    const receipts = [];
    for (const label of ["r33-snow-first", "r33-admin-override", "r33-snow-corrected"]) {
      const packet = packets.find((job) => job.label === label);
      assert.ok(packet, label + " packet proof exists");
      let receipt;
      if (previous.documentId === packet.operation.docId) {
        receipt = { name: previous.filename, sha256: previous.sha256 };
      } else {
        const raw = fs.readFileSync(packet.pdfPath);
        fs.writeFileSync(path.join(work, "__qa_pdf_original.pdf"), raw);
        const tag = packet.operation.docId.replace(/[^A-Za-z0-9]/g, "").slice(-8);
        const data = { filename: "R61 packet proof - " + tag + ".pdf", html: packet.html, operation: packet.operation };
        const first = await hostPage.request.post(base + "/save-pdf", { data, headers, timeout: 120000 });
        receipt = await first.json();
        assert.equal(first.status(), 200, JSON.stringify(receipt));
        assert.deepEqual(fs.readFileSync(receipt.path), raw, "helper files the actual rendered packet");
        const modified = fs.statSync(receipt.path).mtimeMs;
        const second = await hostPage.request.post(base + "/save-pdf", { data, headers, timeout: 120000 });
        const retry = await second.json();
        assert.equal(second.status(), 200, JSON.stringify(retry));
        assert.equal(retry.sha256, receipt.sha256);
        assert.equal(fs.statSync(receipt.path).mtimeMs, modified, "retry never replaces the original");
      }
      const identity = { filename: receipt.name, sha256: receipt.sha256, docId: packet.operation.docId };
      const read = async () => {
        const response = await hostPage.request.post(base + "/artifact/read", { data: identity, headers });
        assert.equal(response.status(), 200);
        return response.json();
      };
      const first = await read(),
        second = await read();
      assert.equal(first.pdf, second.pdf, "repeat distribution retains exact original bytes");
      const bytes = Buffer.from(first.pdf, "base64");
      assert.equal(require("crypto").createHash("sha256").update(bytes).digest("hex"), receipt.sha256);
      const retained = path.join(OUT, "r61-" + label + "-filed-original.pdf");
      fs.writeFileSync(retained, bytes);
      const text = execFileSync("pdftotext", [retained, "-"], { encoding: "utf8" });
      for (const copy of ["COURT COPY", "AGENCY COPY", "INSPECTOR COPY", "DEFENDANT'S COPY"])
        assert.equal(text.split(copy).length - 1, 1, label + " filed original contains " + copy);
      receipts.push({ label, sha256: receipt.sha256, bytes: bytes.length, copies: 4, identicalRetrieval: true });
    }
    return {
      passed: true,
      complianceItems: 3,
      retainedLongNoteWords: 450,
      bestInterestSigner: false,
      actualHttpReceiptPackets: receipts,
      helperRenderer: "test-only fixture using actual Chromium PDF bytes",
      nativeOutlook: false,
    };
  } finally {
    await context.close();
  }
};
