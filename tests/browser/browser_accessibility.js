/* WCAG 2.2 screen checks complement axe: relative type, keyboard focus/obscuration, reflow and field feedback.
   Official documents keep their frozen typography; City screen-reader/native acceptance remains separate. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
function contrast(a, b) {
  const light = (rgb) =>
    rgb
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const x = light(a),
    y = light(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
module.exports = async function (browser, hostPage, OUT, axeScreen) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Chicago" });
  const errors = [],
    checks = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(new URL("/", hostPage.url()).href);
    await page.waitForFunction(() => typeof WriterState !== "undefined" && WriterState.WRITER_READY === true);
    await page.evaluate(() => {
      WriterState.CASES = [
        {
          id: "a11y-case",
          number: "QA-A11Y",
          address: "100 SYNTHETIC ST",
          owner: "SYNTHETIC OWNER",
          ownerAddr: ["100 EXAMPLE ST", "MADISON WI 53703"],
          inspectorId: "i4",
          date: "2026-01-02",
          time: "09:00",
          emails: [],
        },
      ];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      newDoc("a11y-case", "notice");
      doc(WriterState.state.docId).items = Array.from({ length: 3 }, (_, i) => ({
        id: "a11y-item-" + i,
        no: String(i + 1),
        title: "Repair wall",
        text: "Repair the synthetic wall. ".repeat(8),
        sections: ["27.05(2)(c)"],
        due: "",
      }));
      render();
    });
    for (const theme of ["light", "dark", "high"]) {
      await page.evaluate((t) => A11Y.setTheme(t), theme);
      await page.keyboard.press("Tab");
      const focus = await page.locator("#btn-final").evaluate((button) => {
        button.focus();
        let parent = button.parentElement;
        while (parent && getComputedStyle(parent).backgroundColor === "rgba(0, 0, 0, 0)") parent = parent.parentElement;
        const s = getComputedStyle(button);
        return {
          visible: button.matches(":focus-visible"),
          style: s.outlineStyle,
          width: parseFloat(s.outlineWidth),
          color: s.outlineColor,
          background: getComputedStyle(parent).backgroundColor,
        };
      });
      assert.ok(focus.visible && focus.style === "solid" && focus.width >= 3);
      assert.ok(contrast(focus.color, focus.background) >= 3, theme + ": focus indicator needs 3:1 contrast against its surroundings");
      checks.push({ theme, focus });
    }
    await page.emulateMedia({ forcedColors: "active" });
    await page.keyboard.press("Tab");
    const forced = await page.locator("#btn-final").evaluate((button) => {
      button.focus();
      const probe = document.createElement("span");
      probe.style.color = "Highlight";
      button.after(probe);
      const expected = getComputedStyle(probe).color;
      probe.remove();
      const style = getComputedStyle(button);
      return { color: style.outlineColor, expected, style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    assert.equal(forced.color, forced.expected, "forced colors use the system focus color");
    assert.ok(forced.style === "solid" && forced.width >= 3);
    checks.push({ forcedColors: forced });
    await page.emulateMedia({ forcedColors: "none" });
    await page.evaluate(() => A11Y.setTheme("light"));
    await page.evaluate(() => {
      const h = document.querySelector(".editor-section > h2");
      h.tabIndex = -1;
      h.focus();
      if (getComputedStyle(h).outlineStyle !== "solid") throw Error("Keyboard destination has no focus indicator");
    });
    for (const width of [1280, 683, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const result = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.scrollingElement.scrollWidth,
        font: getComputedStyle(document.body).fontSize,
        family: getComputedStyle(document.body).fontFamily,
        navigation: [...document.querySelectorAll(".writer-navigation .rail-item")].map((e) => {
          const b = e.getBoundingClientRect();
          return { x: b.x, right: b.right, top: b.top, width: b.width, height: b.height };
        }),
        pick: [...document.querySelectorAll("input.due-pick")].map((e) => ({
          width: e.getBoundingClientRect().width,
          height: e.getBoundingClientRect().height,
        })),
      }));
      assert.equal(result.font, "16px");
      assert.ok(result.scroll <= width, "body must reflow without horizontal scrolling");
      if (width === 320) {
        assert.equal(result.navigation.length, 4);
        assert.ok(
          result.navigation.every((b) => b.x >= 0 && b.right <= width && b.height >= 44),
          "all four destinations visible without sideways navigation",
        );
      }
      assert.ok(result.pick.every((b) => b.width >= 24 && b.height >= 24));
      checks.push(result);
    }
    await axeScreen(page, "accessibility-editor-320");
    // Native Tab scrolling must keep the focused target visible above the mobile fixed action bar.
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    for (let n = 0; n < 32; n++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const e = document.activeElement;
        if (e === document.body || !e.getClientRects().length) return null;
        const b = e.getBoundingClientRect(),
          x = Math.max(0, Math.min(innerWidth - 1, b.left + b.width / 2)),
          y = Math.max(0, Math.min(innerHeight - 1, b.top + b.height / 2));
        const above = document.elementFromPoint(x, y);
        return {
          label: e.getAttribute("aria-label") || e.textContent.trim().slice(0, 50),
          visible: b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth,
          unobscured: above === e || e.contains(above),
        };
      });
      if (focused) assert.ok(focused.visible && focused.unobscured, "Keyboard focus obscured: " + JSON.stringify(focused));
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.evaluate(() => {
      WriterState.state.screen = "tools";
      render();
      document.documentElement.style.fontSize = "200%";
    });
    const resized = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontSize,
      overflow: document.scrollingElement.scrollWidth > innerWidth,
    }));
    assert.equal(resized.body, "32px");
    assert.equal(resized.overflow, false, "200% text resizing must not widen the page");
    await axeScreen(page, "accessibility-text-resize-200");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "";
    });
    // A real limited textarea is enhanced asynchronously without changing the correction model or its label.
    await page.evaluate(() =>
      A11Y.utility(
        "Correction reason",
        '<label for="qa-limited">Correction reason</label><textarea id="qa-limited" maxlength="1000" rows="3"></textarea>',
      ),
    );
    const field = page.locator("#qa-limited");
    await page.waitForFunction(() => document.getElementById("qa-limited")?.hasAttribute("aria-describedby"));
    await field.fill("x".repeat(999));
    await field.press("End");
    await field.press("x");
    await field.press("y");
    assert.equal((await field.inputValue()).length, 1000, "native limit remains enforced");
    assert.equal(await field.evaluate((e) => document.getElementById(e.getAttribute("aria-describedby")).textContent), "1,000 / 1,000 characters");
    await axeScreen(page, "accessibility-character-count");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("utility-dialog"));
    const client = await context.newCDPSession(page);
    await client.send("HeapProfiler.collectGarbage");
    const before = await client.send("Memory.getDOMCounters");
    await page.evaluate(async () => {
      for (let n = 0; n < 20; n++) {
        A11Y.utility("Limited reason", '<label>Reason<textarea maxlength="1000"></textarea></label>');
        await new Promise(requestAnimationFrame);
        const dialog = document.getElementById("utility-dialog");
        if (dialog.querySelectorAll("[data-character-count]").length !== 1) throw Error("Missing/duplicated counter");
        await new Promise((resolve) => {
          dialog.addEventListener("close", resolve, { once: true });
          dialog.close();
        });
      }
    });
    await client.send("HeapProfiler.collectGarbage");
    await client.send("HeapProfiler.collectGarbage");
    const after = await client.send("Memory.getDOMCounters");
    assert.ok(after.jsEventListeners <= before.jsEventListeners + 8, "counter dialog listeners must be collectible");
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "qa-spacing";
      style.textContent =
        ":not(.sheet *):not(.cit *) {line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important} p:not(.sheet *):not(.cit *){margin-bottom:2em!important}";
      document.head.append(style);
    });
    await page.setViewportSize({ width: 320, height: 900 });
    assert.equal(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), true, "WCAG text-spacing overrides must reflow");
    await axeScreen(page, "accessibility-text-spacing-320");
    await page.screenshot({ path: path.join(OUT, "accessibility-text-spacing-320.png"), fullPage: true });
    const reports = await context.newPage();
    reports.on("pageerror", (e) => errors.push(e.message));
    await reports.goto(new URL("/madison-reports.html", hostPage.url()).href);
    await reports.waitForFunction(() => typeof ReportsState !== "undefined" && ReportsState.S.phase && ReportsState.S.phase !== "loading");
    assert.equal(await reports.evaluate(() => getComputedStyle(document.body).fontSize), "16px");
    assert.equal(await reports.evaluate(() => getComputedStyle(document.body).fontFamily), checks.find((c) => c.family).family);
    await reports.setViewportSize({ width: 320, height: 900 });
    assert.equal(await reports.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), true);
    await axeScreen(reports, "accessibility-reports-320");
    assert.deepEqual(errors, []);
    const result = { passed: true, checks, relativeTextResize: resized, keyboardTargets: 32, counterDialogs: 20, before, after, errors };
    fs.writeFileSync(path.join(OUT, "accessibility-review-results.json"), JSON.stringify(result, null, 2));
    return result;
  } finally {
    await context.close();
  }
};
