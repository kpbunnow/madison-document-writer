/* Open cases by inspector on Import inspection in real Chromium. Synthetic only: the helper's list routes and the case
   lookup are answered by the test. The list is searchable, a case is chosen with Import, and that only fills the
   case number and starts the existing lookup. */
const assert = require("assert/strict");
module.exports = async function (browser, page, context, OUT, axeScreen) {
  const row = (number, extra = {}) => ({
    caseNumber: number,
    address: "101 TEST ST",
    parcel: "070822219105",
    owner: "SYNTHETIC OWNER",
    category: "Building Code",
    description: "Roof and gutters",
    status: "Open",
    dateOpened: "2026-09-30",
    latest: { type: "Initial Inspection", status: "Violations Found", date: "2026-10-01", scheduled: "" },
    ...extra,
  });
  const cases = [
    row("CB2026-241-60001"),
    row("CB2026-241-60002", {
      address: "22 OAK AVE",
      owner: "OTHER OWNER",
      description: "Porch rail",
      latest: { type: "", status: "", date: "", scheduled: "" },
    }),
    row("CB2026-241-60003", { address: "9 ELM CT", parcel: "070822219999" }),
  ];
  const requests = [];
  await context.route("**/inspector-cases/list", async (route) => {
    requests.push(["list"]);
    await route.fulfill({
      json: {
        ok: true,
        inspectors: [
          { id: "JSMITH", name: "Jordan Smith", openCases: 3 },
          { id: "BAD", name: "Broken Person", openCases: 1 },
        ],
      },
    });
  });
  await context.route("**/inspector-cases/cases", async (route) => {
    const inspector = route.request().postDataJSON().inspector;
    requests.push(["cases", inspector]);
    if (inspector === "BAD") return route.fulfill({ status: 503, json: { ok: false, error: "Your Windows account cannot read the case database." } });
    await route.fulfill({ json: { ok: true, inspector: { id: inspector, name: "Jordan Smith" }, cases } });
  });
  const lookups = [];
  await context.route("**/case-lookup", async (route) => {
    lookups.push(route.request().postDataJSON().caseNumber);
    await route.fulfill({ status: 503, json: { ok: false, error: "Stand-in lookup answer for the test." } });
  });
  try {
    await page.evaluate(() => {
      WriterState.state.modal = null;
      WriterState.state.picker = false;
      WriterState.state.acc = null;
      WriterState.WORK.acc = null;
      WriterState.state.screen = "import";
      render();
    });
    // An earlier visit may have left the card on an error (the test helper cannot reach SQL); Try again reloads it.
    const select = page.locator("#open-cases-inspector");
    if (!(await select.count())) {
      await page.locator("#open-cases-retry").waitFor();
      await page.locator("#open-cases-retry").click();
    }
    await select.waitFor();
    assert.equal(await select.locator("option").count(), 3, "a placeholder and two inspectors");
    await select.selectOption("JSMITH");
    await page.getByRole("button", { name: "Show open cases", exact: true }).click();
    await page.locator(".open-case").first().waitFor();
    assert.equal(await page.locator(".open-case").count(), 3);
    assert.match(await page.locator("#open-cases-count").innerText(), /^3 open cases for Jordan Smith\. Loaded /);
    assert.match(await page.locator(".open-case").nth(1).innerText(), /No inspection result yet/);
    assert.ok(!/SYNTHETIC OWNER|Opened/.test(await page.locator("#open-cases-results").innerText()), "owner and opened date are not listed");
    assert.match(await page.locator(".open-case").first().innerText(), /Latest inspection: Initial Inspection · Violations Found · 10\/01\/2026/);
    await axeScreen(page, "open-case-list");

    // Search narrows the list while the box keeps focus.
    await page.locator("#open-cases-search").click();
    await page.keyboard.type("oak");
    assert.equal(await page.locator(".open-case").count(), 1);
    assert.match(await page.locator("#open-cases-count").innerText(), /^1 of 3 open cases/);
    assert.equal(await page.evaluate(() => document.activeElement.id), "open-cases-search");
    await page.locator("#open-cases-search").fill("zzzz");
    assert.match(await page.locator("#open-cases-results").innerText(), /No open case matches this search/);
    await page.locator("#open-cases-search").fill("elm");
    assert.equal(await page.locator(".open-case").count(), 1);
    await page.locator("#open-cases-search").fill("");
    assert.equal(await page.locator(".open-case").count(), 3);

    // A failure keeps the earlier list and says why.
    await select.selectOption("BAD");
    await page.getByRole("button", { name: "Show open cases", exact: true }).click();
    await page.getByText("Your Windows account cannot read the case database.").waitFor();
    assert.equal(await page.locator(".open-case").count(), 3);
    await select.selectOption("JSMITH");
    await page.getByRole("button", { name: "Show open cases", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector("#open-cases .banner.alert"));

    // Import only fills the case number and starts the existing lookup.
    await page.locator('[data-open-case-pick="CB2026-241-60002"]').click();
    await page.getByText("Stand-in lookup answer for the test.").waitFor();
    assert.deepEqual(lookups, ["CB2026-241-60002"]);
    assert.equal(await page.locator("#lookup-number").inputValue(), "CB2026-241-60002");
    assert.equal(await page.locator("#open-cases-search").count(), 1, "the list stays available after a failed lookup");
    assert.deepEqual(requests.slice(0, 2), [["list"], ["cases", "JSMITH"]]);
    assert.equal(requests.filter((r) => r[0] === "list").length, 1, "the inspector list loads once per session");
  } finally {
    await context.unroute("**/inspector-cases/list");
    await context.unroute("**/inspector-cases/cases");
    await context.unroute("**/case-lookup");
    await page.evaluate(() => {
      WriterState.LOOKUP_ERROR = "";
      delete WriterState.WORK.entry["lookup-number"];
    });
  }
  return { passed: true, listed: 3, searched: true, importStartsLookup: true };
};
