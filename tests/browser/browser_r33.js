/* R33 production UI, synthetic records, real loopback helper and Chromium PDFs. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  crypto = require("crypto");
const { execFileSync } = require("child_process");
module.exports = async function (browser, page, out, axeScreen, work, base) {
  const results = [],
    packetJobs = [],
    hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
  async function printCopy(label, id, amount) {
    // The shared browser harness mocks delivery here. Verify its byte binding;
    // R61 separately files these real Chromium packets through actual HTTP receipts.
    const retained = await page.evaluate(async (id) => {
      const d = doc(id),
        request = { ...d.filedArtifact, docId: id };
      return {
        first: await helperJSON("/artifact/read", request),
        second: await helperJSON("/artifact/read", request),
        sha256: d.filedArtifact.sha256,
      };
    }, id);
    const original = Buffer.from(retained.first.pdf, "base64");
    assert.equal(hash(original), retained.sha256, "filed original matches its receipt");
    assert.equal(retained.second.pdf, retained.first.pdf, "repeat distribution retrieves identical original bytes");
    const data = await page.evaluate(async (id) => {
      const d = doc(id),
        snapshot = eventsFor(d.caseId).find((e) => e.payload?.snapshot?.id === id).payload.snapshot;
      return {
        html: printJob(d).html,
        snapshot: clone(d),
        name: caseFileName(kase(d.caseId)),
        operation: { docId: id, caseId: d.caseId, caseNumber: kase(d.caseId).number, version: await recordIntegrity.sourceHash(snapshot) },
      };
    }, id);
    fs.writeFileSync(path.join(out, label + ".html"), data.html);
    const print = await browser.newPage();
    await print.setContent(data.html, { waitUntil: "load" });
    await print.evaluate(() => document.fonts.ready);
    await print.emulateMedia({ media: "print" });
    assert.equal(await print.locator(".cit").count(), 4);
    if (amount)
      assert.deepEqual(
        await print.locator(".cit .amt").allTextContents(),
        Array(4).fill("$" + Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
      );
    if (data.snapshot.caseType === "snow-10.28")
      assert.deepEqual(
        await print.locator('.cit-cmt [data-cit$="|comment"]').allTextContents(),
        Array(data.snapshot.authoringVersion >= 10 ? 3 : 4).fill(Object.values(data.snapshot.cits)[0].comment),
      );
    const geometry = await print
      .locator(".sheet,.cit")
      .evaluateAll((els) => els.map((el) => ({ height: el.getBoundingClientRect().height, overflow: el.scrollHeight > el.clientHeight + 2 })));
    assert.ok(
      geometry.every((g) => g.height <= 1058 && !g.overflow),
      label + " geometry " + JSON.stringify(geometry),
    );
    await print.pdf({ path: path.join(out, label + ".pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
    const actualText = execFileSync("pdftotext", [path.join(out, label + ".pdf"), "-"], { encoding: "utf8" });
    for (const copy of ["COURT COPY", "AGENCY COPY", "INSPECTOR COPY", "DEFENDANT'S COPY"])
      assert.equal(actualText.split(copy).length - 1, 1, label + " Chromium PDF contains " + copy);
    packetJobs.push({ label, html: data.html, operation: data.operation, pdfPath: path.join(out, label + ".pdf") });
    fs.writeFileSync(path.join(out, "r33-packet-jobs.json"), JSON.stringify(packetJobs));
    fs.writeFileSync(path.join(out, label + ".html"), data.html);
    await print.close();
    return data;
  }
  async function issue(label, amount) {
    await page.waitForFunction(() => blockers(doc(WriterState.state.docId)).length === 0);
    const id = await page.evaluate(() => doc(WriterState.state.docId).id);
    await axeScreen(page, label + "-review");
    await page.locator("#btn-final").click();
    await page.locator("#fin-go").click();
    await page.waitForFunction((id) => doc(id) && !doc(id).draft && !!doc(id).filedAt, id);
    const data = await printCopy(label, id, amount);
    results.push({ name: label, passed: true, amount, documentId: id, htmlSha256: hash(data.html), realHelper: true });
    return data;
  }
  async function createSnow(number, parcel, date, time, chosen = false) {
    return page.evaluate(
      ({ number, parcel, date, time, chosen }) => {
        WriterState.state.modal = null;
        WriterState.state.picker = false;
        const id = "case-" + number;
        WriterState.CASES.push({
          id,
          number,
          address: "3300 SYNTHETIC SNOW ST",
          parcel,
          owner: "SYNTHETIC " + number,
          ownerAddr: ["3300 SYNTHETIC SNOW ST", "MADISON WI 53703"],
          inspectorId: "i4",
          date,
          time,
          caseType: chosen ? "snow-10.28" : "",
          historic: false,
        });
        newDoc(id, "notice");
        return {
          id: doc(WriterState.state.docId).id,
          caseId: id,
          ci: LIBRARY.findIndex((x) => x.code === "ENF_PM_PROPMAINT"),
          gi: LIBRARY.find((x) => x.code === "ENF_PM_PROPMAINT").groups.findIndex((x) => x.code === "SNOW"),
        };
      },
      { number, parcel, date, time, chosen },
    );
  }
  const stamp = await page.evaluate(() => recordDay(today)),
    past = await page.evaluate(() => addDays(recordDay(today), -2));
  const first = await createSnow("QA-R33-SNOW-FIRST", "070822219180", stamp, "11:46");
  await page.locator("#btn-add-top").click();
  await page.locator("#pk-status").selectOption("usable");
  await page.locator('[data-grp="' + first.ci + ":" + first.gi + '"]').click();
  await page.locator('[data-pick="' + first.ci + ":" + first.gi + ':1"]').click();
  await page.getByRole("button", { name: "Done adding", exact: true }).click();
  assert.equal(await page.locator('[aria-label="Assign due dates"]').count(), 0);
  assert.equal(await page.locator(".snow-action").innerText(), "Action: Snow citation");
  await page.locator('[data-snow="snowfallDate"]').fill(past);
  await page.locator('[data-snow="inches"]').fill("0.8");
  await page.locator('[data-snow="condition"]').selectOption("snow covered");
  await page.locator('[data-snow="photographed"]').check();
  assert.equal(await page.evaluate(() => Object.values(doc(WriterState.state.docId).cits)[0].amount), "134.00");
  assert.equal(await page.getByLabel("Base deposit for item 1", { exact: true }).getAttribute("readonly"), "");
  await page.evaluate(() => {
    const d = doc(WriterState.state.docId);
    d.snow.snowfallDate = addDays(d.inspDate, -1);
    snow.prepare(d);
  });
  assert.ok(await page.evaluate(() => blockers(doc(WriterState.state.docId)).some((x) => x.t.includes("until noon"))));
  await page.evaluate((past) => {
    const d = doc(WriterState.state.docId);
    d.snow.snowfallDate = past;
    snow.prepare(d);
    render();
  }, past);
  const issued = await issue("r33-snow-first", "134.00");
  assert.equal(issued.snapshot.items[0].due, null);
  assert.equal(issued.snapshot.items[0].dueExempt, "snow-10.28");
  assert.ok(issued.html.includes("$134.00") && issued.html.includes("$197.00"));
  assert.ok(!/reinspection|Issue a citation; or|City Attorney|Due Date/i.test(issued.snapshot.frozen.body));
  assert.equal((issued.html.match(/RM#203,/g) || []).length, 4);
  assert.equal((issued.html.match(/Building Inspection Case Number/g) || []).length, 4);
  const status = await page.evaluate((id) => ({ state: caseState(kase(id)), file: caseFile(id), summary: summarize(caseFile(id)) }), first.caseId);
  assert.equal(status.state.closed, true);
  assert.equal(status.state.label, "Cited – snow");
  assert.equal(status.file.events.filter((x) => x.type === "notice.issued" || x.type === "reinspection.recorded").length, 0);
  assert.equal(status.summary.snowInspections.length, 1);
  // R35: one snow case tracks the property through the season; a filed snow case accepts a later unused inspection without a reinspection event.
  const continued = await page.evaluate(
    async ({ caseId, stamp }) => {
      const k = kase(caseId),
        row = {
          i: 0,
          type: "Reinspection",
          typeKey: "reinspection",
          date: stamp,
          time: "12:16",
          status: "Citation",
          rule: accelaImport.statusRule("Reinspection", "Citation"),
          inspectorName: insp(k.inspectorId).name,
          inspectorId: k.inspectorId,
          selectable: true,
          warn: [],
        };
      const acc = {
        cases: [
          {
            number: k.number,
            raw: {
              address: k.address,
              parcel: k.parcel,
              owner: k.owner,
              ownerAddr: k.ownerAddr.join("\n"),
              description: "",
              historic: "",
              landmark: "",
            },
            rows: [row],
            conflicts: [],
          },
        ],
        caseIx: 0,
        sel: 0,
      };
      const p = accelaImport.baseLookupPlan(acc);
      if (p.blockers.length) throw new Error(p.blockers.join("; "));
      WriterState.state.acc = acc;
      accelaImport.baseLookupAccept();
      const d = doc(WriterState.state.docId),
        result = { next: p.next, type: d.type, date: d.inspDate, time: d.inspTime, hasVisit: !!d.fromReinspId };
      await discardDraft(d.id);
      return result;
    },
    { caseId: first.caseId, stamp },
  );
  assert.deepEqual(continued, { next: "snow", type: "citation", date: stamp, time: "12:16", hasVisit: false });
  results.push({ name: "r33-next-snow-inspection-import", passed: true });
  // New inspection, same season and property, different respondent: count across files.
  const second = await createSnow("QA-R33-SNOW-SECOND", "070822219180", stamp, "12:46", true);
  await page.locator('[data-snow="snowfallDate"]').fill(past);
  await page.locator('[data-snow="inches"]').fill("1");
  await page.locator('[data-snow="condition"]').selectOption("ice covered");
  await page.locator('[data-snow="photographed"]').check();
  await page.locator('[data-snow="cornerNotCleared"]').check();
  await page.locator("[data-refresh-citation-history]").click();
  await page.waitForFunction(() => Object.values(doc(WriterState.state.docId).cits)[0].amount === "197.00");
  await page.locator("[data-review-details=pricing] summary").click();
  await page.waitForFunction(() =>
    document.querySelector("[data-deposit-schedule]")?.textContent.includes("Prior citation at this property was issued to a different owner"),
  );
  assert.ok((await page.locator("[data-deposit-schedule]").innerText()).includes("Prior citation at this property was issued to a different owner"));
  await issue("r33-snow-later-owner", "197.00");
  // Reproduce supplied January facts with synthetic address fields; historical rates come from the policy date.
  const old = await createSnow("QA-R33-SNOW-JANUARY", "070822219181", "2026-01-05", "11:46", true);
  await page.evaluate(() => {
    const d = doc(WriterState.state.docId);
    d.mailed = "2026-01-05";
    Object.values(d.cits)[0].issued = d.mailed;
    d.snow = { snowfallDate: "2026-01-01", inches: 0.8, condition: "snow covered", photographed: true, cornerNotCleared: false };
    citationPricing.refresh(d);
    render();
  });
  const historical = await issue("r33-snow-january-example", "124.00");
  assert.ok(historical.html.includes("$124.00") && historical.html.includes("$187.00"));
  assert.equal(
    Object.values(historical.snapshot.cits)[0].comment,
    "On 01/01/2026, 0.8 inches of snow fell. Inspection found the public sidewalk snow covered.",
  );
  // Tools-only administration modifies a determined deposit, with a persisted helper receipt.
  const adminId = await page.evaluate((stamp) => {
    WriterState.state.modal = null;
    const id = "case-QA-R33-OVERRIDE";
    WriterState.CASES.push({
      id,
      number: "QA-R33-OVERRIDE",
      address: "3301 SYNTHETIC ST",
      parcel: "070822219182",
      owner: "SYNTHETIC ADMIN OWNER",
      ownerAddr: ["3301 SYNTHETIC ST", "MADISON WI 53703"],
      inspectorId: "i4",
      date: stamp,
      time: "13:00",
    });
    newDoc(id, "notice");
    const d = doc(WriterState.state.docId);
    d.items = [
      {
        id: "r33-admin-item",
        no: "1",
        sections: ["27.05(2)(b)"],
        title: "Noxious weeds",
        text: "Remove the synthetic weeds.",
        due: addDays(stamp, 21),
        cite: true,
      },
    ];
    initialCitations.prepare(d);
    render();
    return d.id;
  }, stamp);
  await page.waitForFunction(() => !citationPricing.historyFault(doc(WriterState.state.docId)));
  assert.equal(await page.locator("[data-admin-deposit]").count(), 0);
  await page.locator('[data-nav="tools"]').first().click();
  // Specialist tools are grouped in the collapsed Administrator tools section; access checks are unchanged.
  assert.equal(await page.locator("[data-tools-admin]").evaluate((el) => el.open), false);
  await page.locator("[data-tools-admin] > summary").click();
  await page.locator("[data-admin-deposit]").click();
  const form = page.locator("#admin-deposit-form");
  await form.waitFor();
  await axeScreen(page, "r33-admin-override-dialog");
  const option = await form.locator("[name=target] option").evaluateAll((els) => els.find((x) => x.textContent.includes("QA-R33-OVERRIDE")).value);
  await form.locator("[name=target]").selectOption(option);
  await form.locator("[name=amount]").fill("245.67");
  await form.locator("[name=administrator]").fill("Synthetic Administrator");
  await form.locator("[name=reason]").fill("Court-approved exceptional deposit for synthetic regression testing.");
  await form.locator("[name=sourceReference]").fill("Synthetic court order QA-R33");
  await form.locator("[name=confirmed]").check();
  await form.getByRole("button", { name: "Record administrator override", exact: true }).click();
  await page.waitForFunction(() => !document.getElementById("utility-dialog")?.open);
  await page.evaluate((id) => {
    WriterState.state.docId = id;
    WriterState.state.screen = "write";
    render();
  }, adminId);
  assert.equal(await page.getByLabel("Approved total for item 1", { exact: true }).getAttribute("readonly"), "");
  await page.waitForFunction(() => blockers(doc(WriterState.state.docId)).length === 0);
  const adminCitation = await page.evaluate(() => doc(WriterState.state.docId).initialCitationId);
  await page.locator("#btn-final").click();
  await page.locator("#fin-go").click();
  await page.waitForFunction((id) => doc(id) && !doc(id).draft && doc(id).filedAt, adminCitation);
  const approved = await printCopy("r33-admin-override", adminCitation, "245.67");
  assert.equal(Object.values(approved.snapshot.cits)[0].overrideBasis.administrator, "Synthetic Administrator");
  results.push({ name: "r33-administrative-deposit", passed: true, amount: "245.67", receiptValidated: true });
  // The admin's seasonal edit affects new drafts; issued HTML remains exact.
  await page.locator('[data-nav="tools"]').first().click();
  await page.locator("[data-tools-admin] > summary").click();
  await page.locator("[data-admin-snow-letter]").click();
  const seasonal = page.locator("#admin-snow-letter-form");
  await seasonal.waitFor();
  await axeScreen(page, "r33-admin-seasonal-dialog");
  await seasonal.locator("[name=season]").fill("2026–27");
  await seasonal.locator("[name=reviewedOn]").fill(stamp);
  await seasonal.locator("[name=closing]").fill("Synthetic administrator-reviewed community assistance line.");
  await seasonal.locator("[name=administrator]").fill("Synthetic Administrator");
  await seasonal.locator("[name=reason]").fill("Annual verification of the synthetic seasonal sand-site information.");
  await seasonal.locator("[name=sourceReference]").fill("Synthetic annual review QA-R33");
  await seasonal.locator("[name=confirmed]").check();
  await seasonal.getByRole("button", { name: "Save reviewed seasonal content", exact: true }).click();
  await page.waitForFunction(() => !document.getElementById("utility-dialog")?.open);
  assert.equal(await page.evaluate((id) => printJob(doc(id)).html, first.id), issued.html);
  assert.equal(await page.evaluate((id) => printJob(doc(id)).html, old.id), historical.html);
  const fresh = await createSnow("QA-R33-SNOW-REVIEWED", "070822219183", stamp, "14:00", true);
  assert.ok(
    await page.evaluate(() => snow.body(doc(WriterState.state.docId)).includes("Synthetic administrator-reviewed community assistance line.")),
  );
  results.push({ name: "r33-seasonal-content-freezing", passed: true, issuedSha256: hash(issued.html), newDraft: fresh.id });
  const reports = await page.context().newPage();
  await reports.goto(base + "/madison-reports.html");
  await reports.waitForFunction(() => typeof ReportsState.S !== "undefined" && ReportsState.S.phase === "ready");
  await reports.locator("#report-menu").evaluate((el) => (el.open = true));
  await reports.locator("[data-screen=overriddenDeposits]").click();
  await axeScreen(reports, "r33-overridden-deposits");
  assert.ok((await reports.locator("body").innerText()).includes("Synthetic Administrator"));
  assert.ok((await reports.locator("body").innerText()).includes("245.67"));
  const model = await reports.evaluate(() => ({
    snow: ReportsState.S.M.counted.filter((x) => x.caseType === "snow-10.28").length,
    days: reportById("daysToCompliance")
      .run(ReportsState.S.M, ReportsState.S.F)
      .points.map((x) => x.caseType),
    overrides: reportById("overriddenDeposits").run(ReportsState.S.M, ReportsState.S.F).rows.length,
    citationCount: reportById("citations").run(ReportsState.S.M, { ...ReportsState.S.F, ord: "10.28" }).total[1].n,
    closed: reportById("allCases").run(ReportsState.S.M, ReportsState.S.F).total[3].n,
    snowCases: ReportsState.S.M.counted
      .filter((x) => x.caseType === "snow-10.28")
      .map((x) => ({ number: x.number, status: x.status, closedOn: x.closedOn, eventCount: x.summary.eventCount })),
  }));
  assert.equal(model.snow, 3);
  assert.ok(!model.days.includes("snow-10.28"));
  assert.equal(model.overrides, 1);
  assert.equal(model.citationCount, 3);
  assert.ok(model.closed >= 3, JSON.stringify(model));
  await reports.close();
  results.push({ name: "r33-snow-and-override-reporting", passed: true, ...model });
  // The existing citation correction path retains money and the old seasonal body.
  await page.evaluate((id) => {
    WriterState.state.docId = id;
    WriterState.state.screen = "write";
    render();
  }, old.id);
  await page.locator(".editor-more summary").click();
  await page.locator("#btn-correct").click();
  await page.evaluate(async () => {
    await citationPricing.loadShared(doc(WriterState.state.docId), true);
  });
  await page.locator("#correction-reason").fill("Correct the synthetic recorded snowfall amount after source review.");
  await page.locator("#correction-external").fill("Synthetic division amendment reference QA-R33-SNOW");
  await page.locator("[data-snow=inches]").fill("1.1");
  await page.waitForFunction(() => blockers(doc(WriterState.state.docId)).length === 0);
  const correctedId = await page.evaluate(() => doc(WriterState.state.docId).id);
  await page.locator("#btn-final").click();
  await page.locator("#correction-reviewed").check();
  await page.locator("#fin-go").click();
  await page.waitForFunction((id) => doc(id) && !doc(id).draft && doc(id).filedAt, correctedId);
  const correction = await printCopy("r33-snow-corrected", correctedId, "124.00");
  assert.equal(correction.snapshot.snow.inches, 1.1);
  assert.deepEqual(await page.evaluate(() => blockers(doc(WriterState.state.docId))), []);
  assert.equal(correction.snapshot.frozen.snowLetter.season, "2025–26");
  assert.equal(Object.values(correction.snapshot.cits)[0].num, Object.values(historical.snapshot.cits)[0].num);
  results.push({ name: "r33-snow-correction", passed: true, retainedAmount: "124.00", retainedSeason: "2025–26" });
  fs.writeFileSync(path.join(out, "r33-results.json"), JSON.stringify({ passed: true, results }, null, 2));
  return results;
};
