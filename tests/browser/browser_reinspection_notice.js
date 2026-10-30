/* Reinspection Notice in real Chromium with the real helper. Synthetic only. A Reinspection or No Fee Reinspection
   result opens a worksheet whose document is the Reinspection Notice: header, approved paragraph, corrected items
   ruled through with their confirmation date, every due date printed as assigned and not editable, helper refusal of
   any changed due date, and the issued case recording the Reinspection status that the helper's own projection of
   the case file agrees with. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path");
module.exports = async function (browser, page, OUT, axeScreen, work) {
  const print = await page.context().newPage();
  try {
    const setup = await page.evaluate(async () => {
      WriterState.state.modal = null;
      WriterState.state.picker = false;
      const id = "qa-rn-1",
        stamp = recordDay(today);
      WriterState.CASES.push({
        id,
        number: "QA-RN-001",
        address: "1500 EXAMPLE AVENUE",
        parcel: "070822219103",
        owner: "SYNTHETIC OWNER",
        ownerAddr: ["C/O SYNTHETIC MANAGER", "2500 EXAMPLE AVENUE", "MADISON WI 53703"],
        inspectorId: "i4",
        date: addDays(stamp, -45),
        time: "10:15",
        emails: [],
      });
      newDoc(id, "notice");
      const notice = doc(WriterState.state.docId);
      const dues = [addDays(stamp, 14), addDays(stamp, 21), addDays(stamp, 30)];
      notice.items = dues.map((due, n) => ({
        id: uid("x"),
        no: String(n + 1),
        sections: ["27.05(2)(c)"],
        title: "Interior repair " + (n + 1),
        text: "Repair the damaged interior finish at location " + (n + 1) + ".",
        due,
        done: false,
        doneOn: "",
      }));
      if (!(await publishDocument(notice))) throw new Error("QA initial publication failed: " + WriterState.state.amendmentError);
      startReinspection(id);
      const r = reinsp(WriterState.state.reinspId);
      r.time = "11:25";
      const outcomes = ["corrected", "progress", "none"];
      doc(notice.id).items.forEach(
        (i, n) => (r.results[i.id] = { oc: outcomes[n], on: r.date, note: n ? "Synthetic observation." : "", cite: false }),
      );
      // What importing a Reinspection result records on the worksheet.
      const rule = { ...accelaImport.statusRule("Reinspection", "No Fee Reinspection"), status: "No Fee Reinspection" };
      r.importRule = rule;
      r.followupIntent = rule.doc;
      render();
      return { id, rid: r.id, rule, dues, noticeId: notice.id, hiddenOther: accelaImport.hiddenImportRow("Initial Inspection", "Reinspection") };
    });
    assert.equal(setup.rule.doc, "reinspectionNotice");
    assert.equal(setup.rule.label, "Reinspection Notice");
    assert.equal(setup.hiddenOther, "notDone", "the result stays hidden on other inspection types");

    // The worksheet offers exactly the status-driven document; no extension chooser, no due-date entry.
    const chooser = page.locator(".r26-chooser");
    assert.match(await chooser.innerText(), /No Fee Reinspection/);
    assert.match(await chooser.innerText(), /Reinspection Notice/);
    assert.equal(await chooser.locator("[data-action-type]").count(), 0, "a single document, so no choice");
    await axeScreen(page, "reinspection-notice-worksheet");
    await page.locator("[data-create-action]").click();
    await page.waitForFunction(() => WriterState.state.screen === "write");

    // The document: header, approved paragraph, ruled-through item and fixed due dates.
    const created = await page.evaluate(() => {
      const d = doc(WriterState.state.docId);
      return {
        type: d.type,
        authoringVersion: d.authoringVersion,
        dues: d.items.map((i) => i.due),
        done: d.items.map((i) => i.done),
        doneOn: d.items.map((i) => i.doneOn),
      };
    });
    assert.equal(created.type, "reinspectionNotice");
    assert.deepEqual(created.dues, setup.dues, "every due date stays as assigned, including the corrected item's");
    assert.deepEqual(created.done, [true, false, false]);
    const heading = await page
      .locator(".n-head, .notice-head, .pfx")
      .first()
      .evaluate((e) => e.closest("div, h1, h2")?.textContent || e.textContent);
    assert.match(heading.replace(/\s+/g, " "), /REINSPECTION - Building Inspection Official Notice/i);
    const body = (await page.locator(".n-body").innerText()).replace(/\s+/g, " ");
    assert.match(
      body,
      /^A reinspection found that the work on one or more items is incomplete\. Below is an updated list of items that need further work\. The due dates assigned remain unchanged\. If you have questions, contact the inspector as soon as possible\./,
    );
    assert.match(
      body,
      /If you complete the work by the due date, you may avoid: A \$75 reinspection fee; A citation; Having this case sent to the City Attorney.s Office for legal action\./,
    );
    assert.match(body, /The inspectors may charge a reinspection fee even if they grant an extension\./);
    assert.match(body, /you must call your inspector before the listed due date\.$/);
    const ruled = (await page.locator(".n-ruled").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
    assert.deepEqual(ruled, [
      "Items already corrected are listed below ruled through, with the date we confirmed them. The remaining items are still outstanding.",
    ]);
    assert.equal(await page.locator("table.notice input.due-in, table.notice input[data-field=due]").count(), 0, "due dates are not inputs");
    const rows = await page
      .locator("table.notice tbody tr[data-row]")
      .evaluateAll((trs) =>
        trs.map((tr) => ({ done: tr.classList.contains("done"), due: tr.querySelector(".c-due").innerText.replace(/\s+/g, " ").trim() })),
      );
    assert.equal(rows[0].done, true);
    assert.match(rows[0].due, /^Corrected /);
    assert.equal(rows[1].done, false);
    assert.equal(rows[2].done, false);
    assert.equal(await page.evaluate(() => fmtDate(doc(WriterState.state.docId).items[1].due)), rows[1].due, "the assigned date prints as it stands");
    await axeScreen(page, "reinspection-notice-editor");

    // Printed copy: the same wording, no input controls, and past due dates print unchanged.
    const printed = await page.evaluate(() => {
      const d = clone(doc(WriterState.state.docId));
      d.items[1].due = addDays(recordDay(today), -9);
      return { html: printJob(d).html, past: fmtDate(d.items[1].due) };
    });
    await print.setContent(printed.html);
    await print.emulateMedia({ media: "print" });
    const text = (await print.locator("body").innerText()).replace(/\s+/g, " ");
    assert.match(text, /REINSPECTION - Building Inspection Official Notice/i);
    assert.ok(text.includes("A reinspection found that the work on one or more items is incomplete."));
    assert.ok(text.includes(printed.past), "a past due date prints as assigned");
    assert.equal(await print.locator("input").count(), 0);
    await print.pdf({ path: path.join(OUT, "reinspection-notice.pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });

    // An edited due date is ignored in the editor and refused by the helper if one is forced into the document.
    await page.evaluate(() => {
      const d = doc(WriterState.state.docId),
        input = document.createElement("input");
      input.dataset.field = "due";
      input.dataset.id = d.items[1].id;
      input.value = addDays(recordDay(today), 90);
      document.body.appendChild(input);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.remove();
    });
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).items[1].due), setup.dues[1], "the editor does not change a due date");
    const refused = await page.evaluate(async () => {
      const d = doc(WriterState.state.docId),
        kept = d.items[1].due;
      d.items[1].due = addDays(kept, 7);
      const ok = await publishDocument(d);
      const error = String(WriterState.state.amendmentError || "");
      d.items[1].due = kept;
      return { ok, error };
    });
    assert.equal(refused.ok, false, "a changed due date is not issued");
    assert.match(refused.error, /due date/i);

    // Issued for real: the helper accepts it, the case records the Reinspection status, and its own projection of
    // the case file agrees with the summary the Writer wrote.
    const issued = await page.evaluate(async () => {
      const d = doc(WriterState.state.docId);
      const ok = await publishDocument(d);
      return { ok, error: String(WriterState.state.amendmentError || ""), id: d.id };
    });
    assert.equal(issued.ok, true, "the Reinspection Notice issues: " + issued.error);
    const file = fs.readdirSync(path.join(work, "Case JSON Files")).find((n) => /QA-RN-001\.json$/.test(n));
    assert.ok(file, "case file saved");
    const record = JSON.parse(fs.readFileSync(path.join(work, "Case JSON Files", file), "utf8"));
    const event = record.events.find((e) => e.type === "reinspectionNotice.issued");
    assert.ok(event, "reinspectionNotice.issued is recorded");
    assert.deepEqual(
      event.payload.snapshot.items.map((i) => i.due),
      setup.dues,
    );
    assert.equal(event.payload.snapshot.type, "reinspectionNotice");
    const summaryFile = path.join(
      work,
      "Case JSON Files",
      "Reporting Index",
      fs.readdirSync(path.join(work, "Case JSON Files", "Reporting Index")).find((n) => /QA-RN-001/.test(n)),
    );
    const summary = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
    assert.equal(summary.case.status, "Reinspection");
    assert.ok(summary.documents.some((d) => d.type === "reinspectionNotice" && d.label === "Reinspection Notice"));
    assert.equal(await page.evaluate(() => caseState(kase("qa-rn-1")).label), "Reinspection", "Workspace shows the Reinspection status");
    return { passed: true, header: true, approvedParagraph: true, fixedDueDates: true, helperRefusesChangedDue: true, status: "Reinspection" };
  } finally {
    await print.close();
  }
};
