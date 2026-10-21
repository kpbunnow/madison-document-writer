/* Production browser, loopback helper and synthetic records only. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, out, axeScreen, work, base) {
  await page.evaluate(() => {
    WriterState.state.modal = null;
    WriterState.state.picker = false;
    const id = "case-QA-R31-NEVER-BLANK",
      stamp = recordDay(today);
    WriterState.CASES.push({
      id,
      number: "QA-R31-NEVER-BLANK",
      address: "6411 SYNTHETIC R31 ST",
      parcel: "070822219104",
      owner: "EXACT ACCELA SYNTHETIC OWNER",
      ownerAddr: ["123 East Main Street #4", "MADISON WI 53703"],
      inspectorId: "i4",
      date: addDays(stamp, -2),
      time: "09:15",
      historic: false,
    });
    newDoc(id, "notice");
    const d = doc(WriterState.state.docId);
    // Items can be cited only when the imported Accela status is Citation.
    d.importRule = { kind: "initial", doc: "notice", cite: true, label: "Citation", status: "Citation" };
    d.items = [
      {
        id: "r31-item",
        no: "1",
        sections: ["SPS321.125"],
        title: "Synthetic required deposit",
        text: "Correct the synthetic test condition.",
        cite: false,
        due: addDays(stamp, 21),
        done: false,
      },
    ];
    render();
  });
  await page.locator("[data-notecite]").check();
  await page.locator("[data-deposit-request]").waitFor();
  assert.equal(await page.evaluate(() => Object.keys(doc(WriterState.state.docId).cits).length), 0);
  await axeScreen(page, "r31-required-deposit");
  await page.screenshot({ path: path.join(out, "r31-required-deposit.png"), fullPage: true });
  await page.locator('[data-deposit-form] [name="base"]').fill("5000");
  await page.locator('[data-deposit-form] [name="depositSource"]').fill("Synthetic court approval R31 QA: approved base deposit.");
  await page.getByRole("button", { name: "Complete charge", exact: true }).click();
  assert.equal(await page.evaluate(() => Object.values(doc(WriterState.state.docId).cits)[0].amount), "6411.00");
  // The document has no owner address preview; the respondent key uses the address as imported.
  assert.equal(await page.locator('[data-parse-address="owner|0"]').count(), 0);
  assert.deepEqual(await page.evaluate(() => kase(doc(WriterState.state.docId).caseId).ownerAddr), ["123 East Main Street #4", "MADISON WI 53703"]);
  assert.equal(await page.evaluate(() => kase(doc(WriterState.state.docId).caseId).owner), "EXACT ACCELA SYNTHETIC OWNER");
  assert.equal(await page.evaluate(() => respondentKey(kase(doc(WriterState.state.docId).caseId))), "123 E MAIN ST UNIT 4|53703");
  // Copy recipients keep the standardized-address preview, opened from the single Recipients button.
  await page.evaluate(() => {
    kase(doc(WriterState.state.docId).caseId).ccList = [
      { name: "SYNTHETIC COPY RECIPIENT", addr: "123 East Main Street #4", city: "MADISON WI 53703" },
    ];
    render();
  });
  await page.locator(".editor-sections #btn-cc").click();
  await page.locator('[data-parse-address="copy|0"]').click();
  await page.locator("#utility-dialog").waitFor();
  await axeScreen(page, "r31-address-preview");
  await page.getByRole("button", { name: /Accept standardized address/i }).click();
  assert.equal(await page.evaluate(() => kase(doc(WriterState.state.docId).caseId).ccList[0].addressParsed.accepted), true);
  await page.evaluate(() => {
    WriterState.state.modal = null;
    render();
  });
  await page.waitForFunction(() => blockers(doc(WriterState.state.docId)).length === 0);
  const ids = await page.evaluate(() => ({ noticeId: doc(WriterState.state.docId).id, citationId: doc(WriterState.state.docId).initialCitationId }));
  await page.locator("#btn-final").click();
  await page.locator("#fin-go").click();
  await page.waitForFunction((id) => doc(id) && !doc(id).draft && !!doc(id).filedAt, ids.citationId);
  const evidence = await page.evaluate((id) => {
    const d = doc(id),
      c = Object.values(d.cits)[0];
    return {
      version: d.authoringVersion,
      c,
      html: printJob(d).html,
      group: d.issuanceGroup,
      noticeGroup: doc(d.fromDocId).issuanceGroup,
      filename: caseFileName(kase(d.caseId)),
    };
  }, ids.citationId);
  assert.equal(evidence.version, 11);
  assert.equal(evidence.c.amount, "6411.00");
  assert.match(evidence.c.policyVersionHash, /^[0-9a-f]{64}$/);
  assert.equal(evidence.c.pricedOn, evidence.c.issued);
  assert.deepEqual(evidence.group, evidence.noticeGroup);
  const print = await browser.newPage();
  await print.setContent(evidence.html, { waitUntil: "load" });
  await print.evaluate(() => document.fonts.ready);
  await print.emulateMedia({ media: "print" });
  assert.deepEqual(await print.locator(".cit .amt").allTextContents(), Array(4).fill("$6,411.00"));
  fs.writeFileSync(path.join(out, "r31-print.html"), evidence.html);
  const amounts = await print.locator(".cit .amt").evaluateAll((els) =>
    els.map((el) => ({
      font: parseFloat(getComputedStyle(el).fontSize),
      whiteSpace: getComputedStyle(el).whiteSpace,
      fits: el.scrollWidth <= el.clientWidth + 1,
      width: el.clientWidth,
      scrollWidth: el.scrollWidth,
      columns: getComputedStyle(el.closest(".cit-bar")).gridTemplateColumns,
      faceClass: el.closest(".cit").className,
    })),
  );
  assert.ok(
    amounts.every((x) => x.font >= 16 && x.whiteSpace === "nowrap" && x.fits),
    JSON.stringify(amounts),
  );
  const geometry = await print
    .locator(".sheet,.cit")
    .evaluateAll((els) => els.map((el) => ({ height: el.getBoundingClientRect().height, overflow: el.scrollHeight > el.clientHeight + 2 })));
  assert.ok(
    geometry.every((x) => x.height <= 1058 && !x.overflow),
    JSON.stringify(geometry),
  );
  await print
    .locator(".cit")
    .first()
    .screenshot({ path: path.join(out, "r31-dollar-face.png") });
  await print.pdf({ path: path.join(out, "r31-dollar-citation.pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
  await print.close();
  const filePath = path.join(work, "Case JSON Files", evidence.filename),
    original = fs.readFileSync(filePath),
    record = JSON.parse(original);
  assert.equal(record.schema, 5);
  assert.ok(record.integrity.entries.length >= 2);
  const issued = record.events.find((e) => e.type === "citation.issued");
  Object.values(issued.payload.snapshot.cits)[0].amount = "0";
  fs.writeFileSync(filePath, JSON.stringify(record));
  try {
    const status = await page.evaluate(async (name) => {
      const r = await helperJSON("/cases/open?name=" + encodeURIComponent(name));
      loadCaseFile(JSON.stringify(r.file));
      WriterState.state.screen = "write";
      render();
      return r.integrity;
    }, evidence.filename);
    assert.equal(status.valid, false);
    await page.getByText("This record was changed outside the program", { exact: true }).waitFor();
    assert.equal(await page.evaluate((id) => isLocked(doc(id)), ids.citationId), true);
    await axeScreen(page, "r31-tamper-readonly");
  } finally {
    fs.writeFileSync(filePath, original);
    await page.evaluate(async (name) => {
      const r = await helperJSON("/cases/open?name=" + encodeURIComponent(name));
      loadCaseFile(JSON.stringify(r.file));
      render();
    }, evidence.filename);
  }
  const reports = await browser.newPage();
  await reports.goto(base + "/madison-reports.html");
  await reports.waitForFunction(() => typeof ReportsState.S !== "undefined" && ReportsState.S.phase === "ready");
  await reports.getByRole("button", { name: "Deposit schedule", exact: true }).click();
  await reports.locator("#deposit-policy>summary").click();
  await reports.locator("#deposit-schedule-date").fill("2026-07-15");
  await reports.locator("#deposit-schedule-date").dispatchEvent("change");
  assert.match(await reports.locator("body").innerText(), /\$38\.00/);
  await reports.locator("#deposit-schedule-date").fill("2026-08-01");
  await reports.locator("#deposit-schedule-date").dispatchEvent("change");
  assert.match(await reports.locator("body").innerText(), /\$48\.00/);
  await axeScreen(reports, "r31-dated-schedule");
  await reports.close();
  const result = {
    passed: true,
    requiredStep: true,
    noBlankCitation: true,
    atomicPair: true,
    fourCopies: "$6,411.00",
    amounts,
    schema: 5,
    tamperReadOnly: true,
    addressPreviewAccepted: true,
    datedSchedule: true,
    actualWindowsExecution: false,
  };
  fs.writeFileSync(path.join(out, "r31-results.json"), JSON.stringify(result, null, 2));
  return result;
};
