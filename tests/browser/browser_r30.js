/* Production Chromium + real loopback helper; all records are synthetic. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, out, axeScreen) {
  const results = [];
  async function create(number, ord, owner) {
    return page.evaluate(
      async ({ number, ord, owner }) => {
        WriterState.state.modal = null;
        WriterState.state.picker = false;
        const id = "case-" + number,
          stamp = recordDay(today);
        WriterState.CASES.push({
          id,
          number,
          address: "3100 SYNTHETIC R30 STREET",
          parcel: "070822219103",
          owner,
          ownerAddr: ["3100 SYNTHETIC R30 ST", "MADISON WI 53703"],
          inspectorId: "i4",
          date: addDays(stamp, -2),
          time: "10:15",
          historic: false,
        });
        newDoc(id, "notice");
        const d = doc(WriterState.state.docId);
        // Retain this historical authoring-11 pricing/print scenario; R59 tests current-version preservation.
        d.authoringVersion = 11;
        d.items = [
          {
            id: uid("x"),
            no: "1",
            sections: [ord],
            title: ord === "28.202(3)(e)" ? "Unpermitted Change In Occupancy Use" : "Synthetic rental registration violation",
            text: "Correct the documented synthetic violation.",
            cite: true,
            due: addDays(stamp, 21),
            done: false,
          },
        ];
        initialCitations.prepare(d);
        if (!(await citationPricing.loadShared(d, true))) throw new Error("R30 shared history unavailable");
        render();
        return { noticeId: d.id, citationId: d.initialCitationId, tier: Object.values(d.cits)[0]?.tier, amount: Object.values(d.cits)[0]?.amount };
      },
      { number, ord, owner },
    );
  }
  async function issue(expected, ord, label, manual = false) {
    const pricing = page.locator("[data-review-details=pricing]:not([open]) summary");
    if (await pricing.count()) await pricing.click();
    assert.equal(await page.getByLabel("Base deposit for item 1", { exact: true }).getAttribute("readonly"), manual ? null : "");
    if (!manual) assert.equal(await page.getByLabel("Computed offense tier for item 1", { exact: true }).getAttribute("readonly"), "");
    assert.ok((await page.locator("[data-deposit-schedule]").innerText()).includes("Counted citations:"));
    await axeScreen(page, label + "-review");
    assert.deepEqual(await page.evaluate(() => blockers(doc(WriterState.state.docId))), []);
    const ids = await page.evaluate(() => ({
      noticeId: doc(WriterState.state.docId).id,
      citationId: doc(WriterState.state.docId).initialCitationId,
    }));
    await page.locator("#btn-final").click();
    await page.locator("#fin-go").click();
    await page.waitForFunction((id) => doc(id) && !doc(id).draft && !!doc(id).filedAt, ids.citationId);
    const evidence = await page.evaluate((id) => {
      const d = doc(id),
        c = Object.values(d.cits)[0];
      return { version: d.authoringVersion, cit: c, html: printJob(d).html, group: d.issuanceGroup, notice: doc(d.fromDocId)?.issuanceGroup };
    }, ids.citationId);
    assert.equal(evidence.version, 11);
    assert.equal(evidence.cit.ord, ord);
    assert.equal(evidence.cit.amount, expected);
    assert.deepEqual(evidence.group, evidence.notice);
    const print = await browser.newPage();
    await print.setContent(evidence.html, { waitUntil: "load" });
    await print.evaluate(() => document.fonts.ready);
    await print.emulateMedia({ media: "print" });
    const geometry = await print
      .locator(".sheet,.cit")
      .evaluateAll((els) => els.map((el) => ({ height: el.getBoundingClientRect().height, overflow: el.scrollHeight > el.clientHeight + 2 })));
    // The authoring-11 initial letter's closing language lands on one or two cover pages depending on the
    // PC's fonts (R51 WP3 rule: assert pagination properties, not a font-dependent page count).
    const coverPages = await print.locator(".sheet").count();
    assert.ok(coverPages === 1 || coverPages === 2, "cover pages " + coverPages);
    assert.equal(await print.locator(".cit").count(), 4, "four court copies");
    assert.equal(geometry.length, coverPages + 4);
    assert.equal(await print.locator(".sheet .n-notes").count(), 1);
    assert.ok(
      geometry.every((g) => g.height <= 1058 && !g.overflow),
      label + " print overflow: " + JSON.stringify(geometry),
    );
    assert.equal(await print.locator(".cit .amt").count(), 4);
    assert.deepEqual(
      await print.locator(".cit .amt").allTextContents(),
      Array(4).fill("$" + Number(expected).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
    );
    assert.equal(await print.locator(".cit-assessments").count(), 4);
    if (["3236.00", "1966.00"].includes(expected))
      for (const fees of await print.locator(".cit-assessments").allTextContents())
        assert.ok(fees.includes(expected === "3236.00" ? "Jail $25.00" : "Jail $15.00"));
    await print.pdf({ path: path.join(out, label + ".pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
    assert.equal(
      (fs.readFileSync(path.join(out, label + ".pdf"), "latin1").match(/\/Type\s*\/Page[^s]/g) || []).length,
      coverPages + 4,
      "cover pages plus four court copies, with no blank page",
    );
    fs.writeFileSync(path.join(out, label + ".html"), evidence.html);
    await print.screenshot({ path: path.join(out, label + ".png"), fullPage: true });
    await print.close();
    results.push({
      name: label,
      passed: true,
      authoringVersion: 11,
      amount: expected,
      tier: evidence.cit.tier,
      counted: evidence.cit.countedOffenses,
      documentId: ids.citationId,
      fourCopies: true,
      realHelper: true,
    });
  }
  const occupancy = await create("QA-R30-OCCUPANCY", "28.202(3)(e)", "SYNTHETIC R30 OCCUPANCY OWNER");
  assert.equal(occupancy.amount, "323.00");
  await issue("323.00", "28.202(3)(e)", "r30-occupancy");
  for (const [n, expected] of [
    [1, "701.00"],
    [2, "1331.00"],
    [3, "3236.00"],
  ]) {
    const prepared = await create("QA-R30-RENTAL-" + n, "9.25(4)", "SYNTHETIC R30 RENTAL OWNER");
    assert.equal(prepared.amount, expected);
    assert.equal(prepared.tier, n + (n === 1 ? "st" : n === 2 ? "nd" : "rd"));
    await issue(expected, "9.25(4)", "r30-rental-" + n);
  }
  await create("QA-R30-MANUAL", "SPS321.125", "SYNTHETIC R30 MANUAL OWNER");
  await page.locator("[data-deposit-request]").waitFor();
  await page.locator("[data-deposit-form] [name=base]").fill("1500");
  await page.locator("[data-deposit-form] [name=depositSource]").fill("Synthetic approved manual base instruction.");
  await page.getByRole("button", { name: "Complete charge", exact: true }).click();
  await issue("1966.00", "SPS321.125", "r30-manual-base", true);
  fs.writeFileSync(path.join(out, "r30-results.json"), JSON.stringify({ passed: true, results }, null, 2));
  return results;
};
