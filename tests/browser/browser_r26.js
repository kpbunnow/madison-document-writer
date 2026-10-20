/* Called by the production Chromium audit; synthetic records and review evidence only. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, context, out, axeScreen) {
  const results = [],
    jobs = [],
    day = await page.evaluate(() => recordDay(today));
  let serial = 0;
  const review = {
    scope: "building",
    reviewer: "SYNTHETIC QA REVIEWER",
    reviewRef: "SYNTHETIC QA ONLY — current-code and wording fixture; not division approval",
    codeSource: "https://example.invalid/synthetic-qa-code",
    codeRevision: "SYNTHETIC QA code revision and amendment review",
    reviewDateLegal: day,
    reviewed: true,
    authority: "27.05(3)(b)4",
    signerName: "SYNTHETIC AUTHORIZED SIGNER",
    signerTitle: "Director of Building Inspection (QA sample)",
    delegation: "SYNTHETIC QA authority / delegation record",
  };
  async function fresh(primary = false, count = 2) {
    serial++;
    return page.evaluate(
      async ({ n, primary, count }) => {
        WriterState.state.modal = null;
        WriterState.state.picker = false;
        const id = "qa-r26-" + n,
          stamp = recordDay(today);
        WriterState.CASES.push({
          id,
          number: "QA-R26-" + String(n).padStart(3, "0"),
          address: 1200 + n + " EXAMPLE AVENUE",
          parcel: "070822219103",
          owner: "SYNTHETIC NORTHSIDE COMMUNITY PROPERTY HOLDINGS",
          ownerAddr: ["C/O SYNTHETIC PROPERTY MANAGER", "2500 EXAMPLE AVENUE, SUITE 410", "MADISON WI 53703"],
          inspectorId: "i4",
          date: addDays(stamp, -45),
          time: "10:15",
          emails: [{ addr: "qa-r26-" + n + "@example.invalid", kind: "Property Owner", on: n % 2 === 0 }],
          ccList: [{ name: "SYNTHETIC PROPERTY MANAGER", addr: "2500 EXAMPLE AVENUE, SUITE 410", city: "MADISON WI 53703" }],
        });
        newDoc(id, "notice");
        let d = doc(WriterState.state.docId);
        if (primary) {
          d.items = Array.from({ length: count }, (_, n) => ({
            id: uid("x"),
            no: String(n + 1),
            sections: ["27.05(2)(c)"],
            title: "Interior repair " + (n + 1),
            text: "Repair the damaged interior finish at location " + (n + 1) + ". Maintain safe access while completing the work.",
            due: addDays(stamp, 14),
            done: false,
            doneOn: "",
          }));
          if (!(await publishDocument(d))) throw new Error("QA initial publication failed: " + WriterState.state.amendmentError);
          startReinspection(id);
          const r = reinsp(WriterState.state.reinspId);
          r.time = "11:25";
          doc(d.id).items.forEach(
            (i) => (r.results[i.id] = { oc: "progress", on: r.date, due: addDays(stamp, 35), note: "Verified synthetic observation.", cite: false }),
          );
          render();
          return { cid: id, rid: r.id };
        }
        return { cid: id };
      },
      { n: serial, primary, count },
    );
  }
  async function choose(type, group) {
    await page.locator('[data-action-group="' + group + '"]').check();
    await page.locator('[data-action-type="' + type + '"]').check();
    await page.locator("[data-create-action]").click();
  }
  async function facts(extra) {
    await page.evaluate(
      ({ review, extra, day }) => {
        const d = doc(WriterState.state.docId);
        const authority =
          extra.authority ||
          (["summaryAbatement", "nonSummaryAbatement"].includes(d.type)
            ? {
                junk: "27.05(3)(b)4",
                sidewalk: "27.05(3)(b)1",
                tree: "27.05(3)(b)3",
                secure: "27.085(2)(a)",
                custom: "SYNTHETIC reviewed custom authority",
              }[extra.variant || d.special.variant]
            : d.type === "noOccupancy"
              ? "27.08"
              : "SYNTHETIC reviewed division extension authority");
        d.special = { ...d.special, ...review, ...extra, authority };
        d.mailed = day;
        render();
      },
      { review, extra, day },
    );
  }
  async function issue(name) {
    if (await page.locator('[data-special="reviewed"]').count()) {
      if (!(await page.locator('[data-special="reviewed"]').isVisible())) await page.locator("#r26-details summary").click();
      await page.locator('[data-special="reviewed"]').check();
    }
    const blocked = await page.evaluate(() => blockers(doc(WriterState.state.docId)));
    assert.deepEqual(blocked, [], name + ": " + JSON.stringify(blocked));
    await page.locator("#btn-final").click();
    await page.locator("#fin-go").click();
    await page.waitForFunction(() => doc(WriterState.state.docId) && !doc(WriterState.state.docId).draft && !!doc(WriterState.state.docId).filedAt);
    await page.evaluate(() => saveDrafts());
    const job = await page.evaluate(() => ({
      id: WriterState.state.docId,
      type: doc(WriterState.state.docId).type,
      emailCount: (doc(WriterState.state.docId).emailedTo || []).length,
      body: doc(WriterState.state.docId).frozen.body,
      ...printJob(doc(WriterState.state.docId)),
    }));
    jobs.push({ ...job, name });
    return job.id;
  }
  // Shared inspected visit, explicit selection, keyboard focus, save/resume and continuing restriction.
  const linked = await fresh(true);
  assert.equal(await page.locator("[data-action-group]:checked").count(), 0, "No enforcement selection is inferred");
  await page.locator('[data-action-group="time"]').focus();
  await page.keyboard.press("Space");
  assert.equal(
    await page.locator('[data-action-group="time"]').evaluate((el) => el === document.activeElement),
    true,
    "Native radio retains focus after reveal",
  );
  await page.locator('[data-action-group="occupancy"]').check();
  await page.locator('[data-action-type="noOccupancy"]').check();
  await axeScreen(page, "r26-next-action");
  await page.setViewportSize({ width: 390, height: 844 });
  await axeScreen(page, "r26-next-action-mobile");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 720, height: 900 });
  await axeScreen(page, "r26-next-action-reflow");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.locator("[data-create-action]").click();
  assert.ok((await page.evaluate(() => blockers(doc(WriterState.state.docId)))).length > 0, "Review is required");
  await page.locator('[data-special="scope"]').selectOption("building");
  await page.locator('[data-special="mode"]').selectOption("restrict");
  await page.locator('[data-special="posting"]').selectOption("posted");
  await facts({
    mode: "restrict",
    posting: "posted",
    postedDate: day,
    effective: day,
    findings: "Unsafe habitation due to damaged electrical equipment in the sleeping area.",
    releaseConditions: "Correct the cited hazards; obtain reinspection, placard removal and written permission.",
  });
  const draftId = await page.evaluate(() => WriterState.state.docId);
  await page.locator("#btn-save").click();
  await page.waitForFunction(() => WriterState.state.screen === "cases" && WriterState.LOCAL_SAVE.ok && !WriterState.LOCAL_SAVE.saving);
  await page.reload();
  await page.waitForFunction((id) => !!doc(id) && doc(id).draft, draftId);
  await page.locator("#case-search").fill("QA-R26-001");
  await page.locator("#case-inspector").selectOption("");
  await page
    .locator('[data-open="' + draftId + '"].btn')
    .first()
    .click();
  assert.equal(
    await page.locator('[data-special="findings"]').inputValue(),
    "Unsafe habitation due to damaged electrical equipment in the sleeping area.",
  );
  await axeScreen(page, "r26-no-occupancy-details");
  for (const theme of ["high", "dark"]) {
    await page.evaluate((value) => A11Y.setTheme(value), theme);
    await axeScreen(page, "r26-no-occupancy-" + theme);
  }
  await page.evaluate(() => A11Y.setTheme("light"));
  await page.screenshot({ path: path.join(out, "r26-no-occupancy-details.png"), fullPage: true });
  const restriction = await issue("no-occupancy-building");
  await page.locator("[data-another-action]").click();
  await choose("summaryAbatement", "enforcement");
  await facts({
    variant: "secure",
    findings: "The north basement opening is unsecured and permits entry.",
    work: "Secure the north basement opening using the approved method.",
    summaryBasis: "Documented immediate danger of entry at the opening.",
    securingConditions: "Secure all described openings; remove animals and hazardous materials under the reviewed procedure.",
    boarding: true,
    boardingRef: "SYNTHETIC prior written Director approval QA-SECURE",
  });
  await issue("summary-abatement-secure");
  assert.equal(await page.evaluate((cid) => reinspFor(cid).length, linked.cid), 1);
  await page.locator("[data-another-action]").click();
  await choose("extension", "time");
  await issue("shared-inspection-extension");
  assert.equal(await page.evaluate((cid) => summarize(caseFile(cid)).visits.length, linked.cid), 1);
  await page.evaluate((cid) => {
    startReinspection(cid);
    const r = reinsp(WriterState.state.reinspId);
    r.time = "12:05";
    doc(r.sourceDocId).items.forEach((i) => (r.results[i.id] = { oc: "corrected", on: r.date, note: "QA corrections verified." }));
    render();
  }, linked.cid);
  await choose("compliance", "compliance");
  await issue("restricted-case-compliance");
  assert.equal(await page.evaluate((cid) => caseState(kase(cid)).closed, linked.cid), false, "Compliance does not release occupancy");
  await page.locator("[data-case-action]").click();
  assert.equal(await page.locator("[data-case-action-group]:checked").count(), 0);
  await page.locator('[data-case-action-group="occupancy"]').check();
  await page.locator('[data-case-action-type="noOccupancy"]').check();
  await page.locator("[data-create-case-action]").click();
  await facts({
    mode: "release",
    releases: restriction,
    effective: day,
    releaseInspection: day,
    releaseFacts: "SYNTHETIC release reinspection verifies every condition under QA-RELEASE.",
    placardRemoved: true,
    removalDate: day,
    releaseFormRef: "SYNTHETIC approved written release form / procedure",
    releaseVisitId: await page.evaluate((cid) => reinspFor(cid).at(-1).id, linked.cid),
  });
  await issue("no-occupancy-release");
  assert.equal(await page.evaluate((cid) => activeRestrictions(docsFor(cid)).length, linked.cid), 0);
  results.push({
    check: "compatible orders and primary letter share one visit; compliance keeps restriction; explicit reviewed release",
    passed: true,
  });
  // Initial emergency paths use the existing imported facts and no invented notice/visit.
  for (const [type, variants] of [
    ["summaryAbatement", ["junk", "sidewalk", "tree", "custom"]],
    ["nonSummaryAbatement", ["junk", "sidewalk", "tree", "custom"]],
  ])
    for (const variant of variants) {
      const record = await fresh(false);
      await page.locator(".editor-initial-options summary").click();
      await page.locator("[data-initial-action]").selectOption(type);
      await page.locator('[data-special="variant"]').selectOption(variant);
      const condition =
        variant === "sidewalk"
          ? "Tree and shrub branches obstruct the public sidewalk at the east frontage."
          : variant === "tree"
            ? "A dead tree presents a documented hazard at the west frontage."
            : variant === "custom"
              ? "A specifically reviewed nuisance exists at the south service area."
              : "Junk, trash and debris accumulate at the north service entrance.";
      await facts({
        variant,
        findings: condition,
        work:
          variant === "tree"
            ? "Remove the assessed tree."
            : variant === "sidewalk"
              ? "Remove the assessed obstruction and provide the reviewed required clearance."
              : "Remove the specifically identified nuisance.",
        summaryBasis: "SYNTHETIC factual immediate danger reviewed in QA record.",
        orderDue: await page.evaluate(() => addDays(recordDay(today), 10)),
        servicePlan: "SYNTHETIC approved service / publication plan; not completed service.",
        remedyReviewed: true,
        forestryRef: "SYNTHETIC forestry assessment QA-TREE",
        removeTree: variant === "tree",
        customReviewRef: "SYNTHETIC custom ordinance and wording approval QA-CUSTOM",
      });
      if (type === "nonSummaryAbatement")
        assert.ok(
          await page
            .locator(".desk")
            .innerText()
            .then((t) => t.includes("thirty (30) days of service or publication")),
        );
      assert.equal(await page.locator(".desk").getByText("No items yet — add the first violation below.").count(), 0);
      if (variant === "junk") await axeScreen(page, "r26-" + type + "-details");
      const name = (type === "summaryAbatement" ? "summary" : "non-summary") + "-abatement-" + variant;
      const id = await issue(name);
      assert.equal(await page.evaluate((cid) => reinspFor(cid).length, record.cid), 0, "No fabricated inspection or dummy notice");
      if (type === "nonSummaryAbatement" && variant === "junk") {
        await page.locator('[data-service-field="method"]').selectOption("service");
        await page.locator('[data-service-field="date"]').fill(day);
        await page.locator('[data-service-field="reference"]').fill("SYNTHETIC completed service record QA-SERVICE-001");
        assert.equal(
          await page.evaluate((id) => WriterState.WORK.recordForms["service:" + id]?.reference, id),
          "SYNTHETIC completed service record QA-SERVICE-001",
          "Service evidence must retain typed text before saving",
        );
        await page.locator("[data-save-service]").click();
        await page.waitForFunction((id) => doc(id).serviceRecords?.length === 1, id);
        assert.equal(await page.evaluate((cid) => eventsFor(cid).filter((e) => e.type === "nonSummaryAbatement.issued").length, record.cid), 1);
        await axeScreen(page, "r26-service-evidence");
      }
    }
  await fresh(false);
  await page.locator(".editor-initial-options summary").click();
  await page.locator("[data-initial-action]").selectOption("noOccupancy");
  await facts({
    mode: "restrict",
    scope: "unit",
    unit: "Apartment 204-B (east second floor)",
    posting: "pending",
    prePostingRef: "SYNTHETIC approved pre-posting wording",
    effective: day,
    findings: "Unsafe conditions in the identified apartment only.",
    releaseConditions: "Complete the reviewed repairs and obtain written reoccupation permission.",
    authority: "27.08",
  });
  await issue("no-occupancy-apartment");
  for (const [type, scopes] of [
    ["bestInterestExtension", ["building"]],
    ["vacancyExtension", ["building", "unit"]],
  ])
    for (const scope of scopes) {
      await fresh(true);
      await choose(type, "time");
      await facts({
        scope,
        unit: "Apartment 3-C",
        affected: ["1"],
        noSafety: true,
        safetyBasis: "Reviewer confirms these are nonurgent interior repair items; security and safety obligations are excluded.",
        noticeRef: "SYNTHETIC original Official Notice reference",
        reason: "An approved contractor repair plan benefits the City and property owner.",
        intentions: "Owner has scheduled completion by the new deadline.",
        supervisor: "SYNTHETIC SUPERVISOR",
        stage: "administrative",
        requestRef: "SYNTHETIC vacancy extension request",
        vacancyFacts: "The identified scope was verified vacant at the recorded inspection.",
        conditions: "Remain vacant; maintain security, exterior and applicable common areas; request reinspection before occupancy.",
        reviewDate: await page.evaluate(() => addDays(recordDay(today), 42)),
        deadlineMode: "dated",
        expiryMode: "fixed",
        expiryDate: await page.evaluate(() => addDays(recordDay(today), 49)),
        expiryPolicyRef: "SYNTHETIC reviewed expiration / review policy",
        transferClause:
          "SYNTHETIC reviewed transfer clause: contact Building Inspection before a" +
          " sale or transfer to review violations and case responsibility.",
      });
      await page.locator('[data-special-due="1"]').fill(await page.evaluate(() => addDays(recordDay(today), 35)));
      await axeScreen(page, "r26-" + type + "-" + scope);
      await issue((type === "bestInterestExtension" ? "best-interest-extension" : "vacancy-extension") + "-" + scope);
    }
  // A long narrative and a long list use the same measured continuation furniture.
  await fresh(true, 20);
  await choose("bestInterestExtension", "time");
  await facts({
    scope: "building",
    affected: Array.from({ length: 20 }, (_, n) => String(n + 1)),
    noSafety: true,
    safetyBasis: "SYNTHETIC reviewer excludes all safety and urgent items.",
    noticeRef: "SYNTHETIC original notice",
    reason: "The approved plan provides clear staging and contractor accountability. ".repeat(50),
    intentions: "Staged repairs will be completed.",
    supervisor: "SYNTHETIC SUPERVISOR",
    stage: "administrative",
  });
  await page.evaluate(() => {
    doc(WriterState.state.docId).items.forEach((i) => (i.due = addDays(recordDay(today), 35)));
    render();
  });
  await issue("best-interest-extension-long");
  const print = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
  for (const job of jobs) {
    fs.writeFileSync(path.join(out, job.name + ".html"), job.html);
    await print.setContent(job.html, { waitUntil: "load" });
    await print.evaluate(() => document.fonts.ready);
    await print.emulateMedia({ media: "print" });
    const header = await print.locator(".n-head").evaluateAll((els) =>
      els.map((el) => ({
        overflow: el.scrollHeight > el.clientHeight + 2,
        bottom: el.getBoundingClientRect().bottom,
        ownerTop: el.closest(".sheet").querySelector(".n-owner").getBoundingClientRect().top,
      })),
    );
    assert.ok(
      header.every((h) => !h.overflow && h.bottom <= h.ownerTop),
      job.name + " header or owner-window overlap",
    );
    const geometry = await print.evaluate(() =>
      [...document.querySelectorAll(".sheet")].map((el) => ({
        height: el.getBoundingClientRect().height,
        overflow: el.scrollHeight > el.clientHeight + 2,
      })),
    );
    assert.equal(
      geometry.some((g) => g.overflow || g.height > 1058),
      false,
      job.name + " overflow",
    );
    assert.equal(
      await print.locator(".n-title").evaluateAll((els) => els.some((e) => e.scrollWidth > e.clientWidth + 2)),
      false,
      job.name + " clipped title",
    );
    if (await print.locator(".r26-narrative").count()) {
      const words = await print.evaluate((body) => {
        const expected = new DOMParser().parseFromString(body, "text/html");
        const clean = (s) => s.replace(/\s+/g, " ").trim();
        return {
          expected: [...expected.querySelectorAll("p")].map((p) => clean(p.textContent)),
          actual: [...document.querySelectorAll(".r26-narrative p")].map((p) => clean(p.textContent)),
        };
      }, job.body);
      assert.deepEqual(words.actual, words.expected, job.name + " preserves every narrative paragraph");
    }
    assert.ok((await print.locator(".n-cc").count()) > 0, job.name + " preserves copies");
    assert.equal(await print.locator(".cc-mail").count(), job.emailCount ? 1 : 0, job.name + " email footer follows selected recipients");
    const text = await print.locator("body").innerText();
    if (!["shared-inspection-extension", "restricted-case-compliance"].includes(job.name)) assert.ok(text.includes("SYNTHETIC AUTHORIZED SIGNER"));
    assert.ok(!text.includes("◯"), "No missing-detail placeholder in issued sample");
    if (geometry.length > 1) assert.equal(await print.locator(".n-foot").count(), geometry.length, "Every continuation page has a footer");
    await print.pdf({ path: path.join(out, job.name + ".pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
    if (["no-occupancy-building", "non-summary-abatement-junk", "vacancy-extension-unit", "best-interest-extension-long"].includes(job.name))
      await print.screenshot({ path: path.join(out, job.name + "-print.png"), fullPage: true });
    results.push({ name: job.name, documentId: job.id, pages: geometry.length, geometry, passed: true });
  }
  await print.close();
  fs.writeFileSync(
    path.join(out, "r26-results.json"),
    JSON.stringify(
      { passed: true, issuedThroughRealHelper: true, externalPdfAndEmailDelivery: "mocked; sample PDFs rendered by real Chromium", results },
      null,
      2,
    ),
  );
  return results;
};
