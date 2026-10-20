/* R34 production UI, synthetic records, real loopback helper and Chromium layout/PDF checks for the snow cover format 10. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  crypto = require("crypto");
module.exports = async function (browser, page, out, axeScreen) {
  const results = [],
    hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
  const stamp = await page.evaluate(() => recordDay(today)),
    past = await page.evaluate(() => addDays(recordDay(today), -2));
  await page.evaluate(
    ({ stamp }) => {
      WriterState.state.modal = null;
      WriterState.state.picker = false;
      const id = "case-QA-R34-SNOW";
      WriterState.CASES.push({
        id,
        number: "QA-R34-SNOW",
        address: "3400 SYNTHETIC SNOW ST",
        parcel: "070822219190",
        owner: "SYNTHETIC QA-R34-SNOW",
        ownerAddr: ["3400 SYNTHETIC SNOW ST", "MADISON WI 53703"],
        inspectorId: "i4",
        date: stamp,
        time: "11:46",
        caseType: "snow-10.28",
        historic: false,
      });
      newDoc(id, "notice");
    },
    { stamp },
  );
  await page.locator('[data-snow="snowfallDate"]').fill(past);
  await page.waitForFunction((value) => doc(WriterState.state.docId)?.snow?.snowfallDate === value, past);
  await page.locator('[data-snow="inches"]').fill("0.8");
  await page.waitForFunction(() => Number(doc(WriterState.state.docId)?.snow?.inches) === 0.8);
  await page.locator('[data-snow="condition"]').selectOption("snow covered");
  await page.waitForFunction(() => doc(WriterState.state.docId)?.snow?.condition === "snow covered");
  await page.locator('[data-snow="photographed"]').check();
  await page.waitForFunction(() => doc(WriterState.state.docId)?.snow?.photographed === true);
  await page.locator("[data-refresh-citation-history]").click();
  await page.waitForFunction(() => Object.values(doc(WriterState.state.docId).cits)[0].amount === "134.00");
  await page.waitForFunction(() => blockers(doc(WriterState.state.docId)).length === 0);
  const id = await page.evaluate(() => doc(WriterState.state.docId).id);
  await axeScreen(page, "r34-snow-review");
  await page.locator("#btn-final").click();
  await page.locator("#fin-go").click();
  await page.waitForFunction((id) => doc(id) && !doc(id).draft && !!doc(id).filedAt, id);
  const data = await page.evaluate((id) => {
    const d = doc(id);
    return { html: printJob(d).html, snapshot: clone(d) };
  }, id);
  assert.ok(data.snapshot.authoringVersion >= 10);
  assert.equal(data.snapshot.frozen.snowCoverFormat, 10);
  fs.writeFileSync(path.join(out, "r34-snow-cover.html"), data.html);
  const print = await browser.newPage();
  await print.setContent(data.html, { waitUntil: "load" });
  await print.evaluate(() => document.fonts.ready);
  await print.emulateMedia({ media: "print" });
  const m = await print.evaluate(() => {
    const px = (v) => parseFloat(v) || 0,
      subject = document.querySelector(".snow-cover p.snow-subject"),
      style = getComputedStyle(subject),
      line = px(style.lineHeight);
    const paras = [...document.querySelectorAll(".snow-cover p.snow-para:not(.snow-closing)")].map((p) => px(getComputedStyle(p).marginBottom));
    const table = document.querySelector(".snow-cover table.snow-sites-v10"),
      sheets = [...document.querySelectorAll(".sheet")].filter((s) => !s.closest(".cit") && s.querySelector(".snow-cover,.snow-subject"));
    const bold = [...document.querySelectorAll(".snow-cover strong")].map((s) => ({
      text: s.textContent,
      weight: Number(getComputedStyle(s).fontWeight),
    }));
    const cits = [...document.querySelectorAll(".cit")],
      comments = cits.map((c) => c.querySelectorAll(".cit-cmt").length);
    const geometry = [...document.querySelectorAll(".sheet,.cit")].map((el) => ({
      height: el.getBoundingClientRect().height,
      overflow: el.scrollHeight > el.clientHeight + 2,
    }));
    return {
      line,
      paddingTop: px(style.paddingTop),
      paras,
      tableGap: document.querySelector(".snow-cover p.snow-closing").getBoundingClientRect().top - table.getBoundingClientRect().bottom,
      coverSheets: sheets.length,
      mainCovers: sheets.filter((s) => s.querySelector(".snow-cover")?.children.length).length,
      languageBlocks: document.querySelectorAll(".sheet .n-notes").length,
      continuation: document.querySelectorAll(".snow-sheet.cont").length,
      bold,
      comments,
      geometry,
      subjectGap: subject.nextElementSibling.getBoundingClientRect().top - subject.getBoundingClientRect().bottom,
    };
  });
  assert.ok(m.line > 0);
  assert.ok(Math.abs(m.paddingTop - m.line) < 0.6, "one added line above the subject " + JSON.stringify(m));
  assert.equal(m.paras.length, 3);
  assert.ok(
    m.paras.every((v) => Math.abs(v - m.line) < 0.6),
    "blank line between paragraphs " + JSON.stringify(m.paras),
  );
  assert.ok(Math.abs(m.tableGap - m.line) < 1.5, "blank line between table and closing line " + JSON.stringify({ gap: m.tableGap, line: m.line }));
  assert.ok(Math.abs(m.subjectGap - m.line) < 1.5);
  assert.deepEqual(
    m.bold.map((b) => b.text),
    [
      "Subject: Failure to Remove Snow and/or Ice from Public Sidewalk",
      "There are no warnings given for this Ordinance violation.",
      "If there is no sand, please call: Streets West: 266-4681",
      "or Streets East: 246-4532",
    ],
  );
  assert.ok(m.bold.every((b) => b.weight >= 600));
  // R39 also uses a separate language-access continuation in this Chromium
  // environment. Keep the complete snow subject/body/table/closing on one
  // sheet, and verify the required language block instead of dropping it.
  assert.equal(m.mainCovers, 1, "snow subject, body, sites and closing fit one letter page");
  // Whether the language-access block needs its own continuation page depends on the PC's fonts.
  assert.ok(m.coverSheets === 1 || m.coverSheets === 2, "cover sheets " + m.coverSheets);
  assert.equal(m.languageBlocks, 1);
  assert.equal(m.continuation, m.coverSheets - 1);
  assert.ok(
    await print
      .locator(".snow-cover")
      .allTextContents()
      .then((texts) => texts.some((text) => text.includes(data.snapshot.frozen.snowLetter.closing))),
    "approved closing retained",
  );
  assert.deepEqual(m.comments, [1, 1, 1, 0], "comment on court, agency and inspector copies only");
  assert.ok(
    m.geometry.every((g) => g.height <= 1058 && !g.overflow),
    "geometry " + JSON.stringify(m.geometry),
  );
  const pdfPath = path.join(out, "r34-snow-cover.pdf");
  await print.pdf({ path: pdfPath, format: "Letter", printBackground: true, preferCSSPageSize: true });
  await print.close();
  const pages = (fs.readFileSync(pdfPath, "latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  assert.equal(pages, m.coverSheets + 4, "snow cover, any language continuation and four copies; no blank page");
  results.push({
    name: "r34-snow-cover",
    passed: true,
    amount: "134.00",
    documentId: id,
    htmlSha256: hash(data.html),
    realHelper: true,
    coverPages: m.coverSheets,
    pdfPages: pages,
    lineHeightPx: m.line,
    comments: m.comments,
  });
  return results;
};
