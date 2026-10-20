/* R32 is exercised through the actual browser and locked loopback helper. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, out, axeScreen, work, base) {
  const results = [];
  async function prepare(number, ordinance, title) {
    await page.evaluate(
      ({ number, ordinance, title }) => {
        WriterState.state.modal = null;
        WriterState.state.picker = false;
        const id = "case-" + number,
          stamp = recordDay(today);
        WriterState.CASES.push({
          id,
          number,
          address: "3200 SYNTHETIC STREET",
          parcel: "070822219105",
          owner: "SYNTHETIC " + number,
          ownerAddr: ["3200 SYNTHETIC ST", "MADISON WI 53703"],
          inspectorId: "i4",
          date: addDays(stamp, -2),
          time: "09:15",
          historic: false,
        });
        newDoc(id, "notice");
        const d = doc(WriterState.state.docId);
        d.items = [
          {
            id: "r32-item",
            no: "1",
            sections: [ordinance],
            title,
            text: "Correct the synthetic test condition.",
            cite: false,
            due: addDays(stamp, 21),
            done: false,
          },
        ];
        render();
      },
      { number, ordinance, title },
    );
    await page.locator("[data-notecite]").check();
  }
  async function issue(label, total) {
    await page.waitForFunction(() => blockers(doc(WriterState.state.docId)).length === 0);
    await axeScreen(page, label + "-review");
    const ids = await page.evaluate(() => ({ notice: doc(WriterState.state.docId).id, citation: doc(WriterState.state.docId).initialCitationId }));
    await page.locator("#btn-final").click();
    await page.locator("#fin-go").click();
    await page.waitForFunction((id) => doc(id) && !doc(id).draft && !!doc(id).filedAt, ids.citation);
    const e = await page.evaluate((id) => {
      const d = doc(id);
      return { c: Object.values(d.cits)[0], html: printJob(d).html, name: caseFileName(kase(d.caseId)) };
    }, ids.citation);
    assert.equal(e.c.amount, total);
    const print = await browser.newPage();
    await print.setContent(e.html, { waitUntil: "load" });
    await print.evaluate(() => document.fonts.ready);
    await print.emulateMedia({ media: "print" });
    assert.equal(await print.locator(".cit").count(), 4);
    assert.ok(await print.locator(".amt").evaluateAll((els) => els.every((x) => x.scrollWidth <= x.clientWidth + 1)));
    await print.pdf({ path: path.join(out, label + ".pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(path.join(out, label + ".html"), e.html);
    await print.close();
    results.push({ name: label, amount: total, measurements: e.c.measurements, mandatory: !!e.c.mandatoryAppearance });
    return e;
  }
  await prepare("QA-R32-AUTOMATIC", "27.05(2)(b)", "Noxious weeds");
  assert.equal(await page.locator("[data-deposit-request]").count(), 0);
  assert.equal(await page.evaluate(() => Object.values(doc(WriterState.state.docId).cits)[0].amount), "197.00");
  const automatic = await issue("r32-automatic-weeds", "197.00");
  await prepare("QA-R32-MEASURED", "29.40(4)(b)", "Building tune-up noncompliance");
  await page.locator("[data-deposit-request]").waitFor();
  assert.equal(await page.locator("[data-deposit-form] [name=base]").count(), 0);
  await page.locator("[name=measure-area]").fill("200000");
  await page.locator("[name=measure-days]").fill("400");
  await axeScreen(page, "r32-measurement-dialog");
  await page.getByRole("button", { name: "Complete charge", exact: true }).click();
  await issue("r32-building-duration", "12761.00");
  await prepare("QA-R32-MANDATORY", "23.45", "Synthetic mandatory-appearance charge");
  await page.waitForFunction(() => blockers(doc(WriterState.state.docId)).some((c) => c.t.includes("division-approved defendant instructions")));
  assert.equal(await page.evaluate(() => Object.values(doc(WriterState.state.docId).cits)[0].mandatoryAppearance), true);
  assert.equal(
    await page.evaluate(
      () =>
        workspaceTasks([{ k: kase(doc(WriterState.state.docId).caseId), st: caseState(kase(doc(WriterState.state.docId).caseId)) }]).find(
          (t) => t.key === "deposit",
        ).count,
    ),
    0,
  );
  assert.ok(!(await page.locator(".cit-inst").count()), "blocked preview does not print generic defendant instructions");
  await axeScreen(page, "r40-mandatory-appearance-hold");
  await page.screenshot({ path: path.join(out, "r40-mandatory-appearance-hold.png"), fullPage: true });
  results.push({ name: "r40-mandatory-appearance-hold", issuanceBlocked: true, draftRetained: true, depositTask: 0 });
  const location = path.join(work, "Case JSON Files", automatic.name),
    prior = fs.readFileSync(location);
  const bad = JSON.parse(prior);
  delete bad.integrity;
  bad.schema = 4;
  bad.events[0].payload.snapshot.items[0].text = "Changed order text";
  fs.writeFileSync(location, JSON.stringify(bad));
  try {
    const status = await page.evaluate(async (name) => {
      const r = await helperJSON("/cases/open?name=" + encodeURIComponent(name));
      loadCaseFile(JSON.stringify(r.file));
      const id = WriterState.CASES.find((k) => k.number === "QA-R32-AUTOMATIC").id;
      WriterState.state.screen = "cases";
      WriterState.state.caseId = id;
      WriterState.state.docId = docsFor(id).find((d) => d.type === "citation").id;
      render();
      return r.integrity;
    }, automatic.name);
    assert.equal(status.valid, false);
    assert.equal(status.state, "downgraded");
    assert.equal(await page.evaluate(() => isLocked(doc(WriterState.state.docId))), true);
    await axeScreen(page, "r32-downgrade-readonly");
  } finally {
    fs.writeFileSync(location, prior);
    await page.evaluate(async (name) => helperJSON("/cases/open?name=" + encodeURIComponent(name)), automatic.name);
  }
  const reports = await browser.newPage();
  await reports.goto(base + "/madison-reports.html");
  await reports.waitForFunction(() => typeof ReportsState.S !== "undefined" && ReportsState.S.phase === "ready");
  await reports.getByRole("button", { name: "Deposit schedule", exact: true }).click();
  assert.match(await reports.locator("body").innerText(), /Base deposits below exclude assessments.*calculated/s);
  assert.equal(await reports.locator(".rep tbody tr").count(), 40, "Schedule rendering is bounded without changing the full policy");
  assert.equal((await reports.locator(".rep tbody").innerText()).includes('\"kind\"'), false, "Raw rule objects stay in technical disclosures");
  await axeScreen(reports, "r32-schedule-classifications");
  await reports.close();
  fs.writeFileSync(path.join(out, "r32-results.json"), JSON.stringify({ passed: true, results }, null, 2));
  return results;
};
