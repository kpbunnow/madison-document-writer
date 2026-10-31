/* Violator contact in real Chromium. Synthetic only. A Violator chosen on the Copies list replaces the owner as the
   main contact: the mailing address block and the citation defendant. The owner prints under CC by default and the
   per-case checkbox removes it. Only one Violator is allowed, a blank Violator is refused, and a snow removal case
   keeps the owner. */
const assert = require("assert/strict");
module.exports = async function (browser, page, OUT, axeScreen) {
  await page.evaluate(() => {
    WriterState.state.modal = null;
    WriterState.state.picker = false;
    const stamp = recordDay(today);
    WriterState.CASES.push({
      id: "qa-vio-1",
      number: "QA-VIO-001",
      address: "1500 EXAMPLE AVENUE",
      parcel: "070822219107",
      owner: "SYNTHETIC OWNER",
      ownerAddr: ["100 TEST ST", "MADISON WI 53703"],
      inspectorId: "i4",
      date: addDays(stamp, -2),
      time: "09:15",
      emails: [],
    });
    newDoc("qa-vio-1", "notice");
  });
  const printed = () =>
    page.evaluate(() => {
      const parsed = new DOMParser().parseFromString(printJob(doc(WriterState.state.docId)).html, "text/html");
      return parsed.body.textContent.replace(/\s+/g, " ").toUpperCase();
    });
  const before = await printed();
  assert.ok(before.includes("100 TEST ST"), "the owner is the main contact before a Violator is set");

  // Choose a Violator in the Recipients dialog.
  await page.locator(".editor-sections #btn-cc").click();
  await page.locator("#btn-addcc").click();
  await page.locator('[data-cc="0|name"]').fill("SYNTHETIC VIOLATOR");
  await page.locator('[data-cc="0|addr"]').fill("55 SECOND ST");
  await page.locator('[data-cc="0|city"]').fill("MADISON WI 53704");
  await page.locator('[data-cc="0|kind"]').selectOption("Violator");
  const owner = page.locator("#cc-copyowner");
  assert.equal(await owner.isChecked(), true, "the owner is copied unless the inspector unticks it");
  await axeScreen(page, "violator-recipients");

  // One Violator per case: a second Violator demotes the first to a Copy.
  await page.locator("#btn-addcc").click();
  await page.locator('[data-cc="1|name"]').fill("SECOND PERSON");
  await page.locator('[data-cc="1|addr"]').fill("7 THIRD ST");
  await page.locator('[data-cc="1|city"]').fill("MADISON WI 53705");
  await page.locator('[data-cc="1|kind"]').selectOption("Violator");
  let kinds = await page.evaluate(() => kase("qa-vio-1").ccList.map((c) => c.kind));
  assert.deepEqual(kinds, ["Copy", "Violator"]);
  await page.locator('[data-cc="0|kind"]').selectOption("Violator");
  kinds = await page.evaluate(() => kase("qa-vio-1").ccList.map((c) => c.kind));
  assert.deepEqual(kinds, ["Violator", "Copy"]);
  await page.locator("[data-close=modal]").click();

  // The mailing block and the CC list.
  let text = await printed();
  const sent = text.indexOf("SYNTHETIC VIOLATOR");
  assert.ok(sent >= 0 && text.includes("55 SECOND ST"), "the Violator is the main contact");
  assert.ok(text.includes("CC:") && text.slice(text.indexOf("CC:")).includes("SYNTHETIC OWNER"), "the owner is copied by default");
  assert.ok(text.slice(text.indexOf("CC:")).includes("SECOND PERSON"), "other copies stay copies");
  assert.ok(!text.slice(text.indexOf("CC:")).includes("SYNTHETIC VIOLATOR"), "the Violator is not repeated under CC");
  assert.equal(await page.locator("#mailing-from-violator").count(), 1, "the editor says where to change the block");

  // The checkbox removes the owner from the copies, for this case only.
  await page.locator(".editor-sections #btn-cc").click();
  await page.locator("#cc-copyowner").uncheck();
  await page.locator("[data-close=modal]").click();
  text = await printed();
  assert.ok(!text.slice(text.indexOf("CC:")).includes("SYNTHETIC OWNER"), "the owner is not copied when unticked");
  assert.equal(await page.evaluate(() => kase("qa-vio-1").copyOwner), false);

  // A Violator with no address is refused when the dialog closes.
  await page.locator(".editor-sections #btn-cc").click();
  await page.locator('[data-cc="0|addr"]').fill("");
  await page.locator("[data-close=modal]").click();
  assert.equal(await page.locator("#cc-address-error").count(), 1, "a blank Violator is refused");
  await page.locator('[data-cc="0|addr"]').fill("55 SECOND ST");
  await page.locator("[data-close=modal]").click();
  assert.equal(await page.evaluate(() => WriterState.state.modal), null);

  // The citation defendant and repeat-offense respondent are the Violator.
  const defendant = await page.evaluate(() => ({
    key: defendantKey(kase("qa-vio-1")),
    owner: respondentKey(kase("qa-vio-1")),
  }));
  assert.equal(defendant.key, "55 SECOND ST|53704");
  assert.equal(defendant.owner, "100 TEST ST|53703", "the summary and Reports keep the owner key");

  // A snow removal case keeps the owner and ignores the Violator.
  const snow = await page.evaluate(() => {
    const k = kase("qa-vio-1");
    k.caseType = "snow-10.28";
    const out = { key: defendantKey(k), active: violatorActive(k) };
    delete k.caseType;
    return out;
  });
  assert.equal(snow.key, "100 TEST ST|53703");
  assert.equal(snow.active, false);
  return { passed: true, mainContact: true, ownerCopy: true, oneViolator: true, blankRefused: true, snowKeepsOwner: true };
};
