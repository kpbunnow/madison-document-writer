/* Production R42 task navigation and preview. Only synthetic state is introduced and restored. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict");
module.exports = async function (browser, page, OUT, axeScreen, axeThemes) {
  const viewport = page.viewportSize();
  await page.evaluate(() => {
    window.__r42Saved = {
      CASES: WriterState.CASES,
      DOCS: WriterState.DOCS,
      REINSP: WriterState.REINSP,
      EVENTS: WriterState.EVENTS,
      PENDING: WriterState.PENDING,
      RECORD_ATTEMPTS: WriterState.RECORD_ATTEMPTS,
      WORK: WriterState.WORK,
      state: WriterState.state,
      HELPER: WriterState.HELPER,
      CASEDIR: WriterState.CASEDIR,
      NEEDGRANT: WriterState.NEEDGRANT,
    };
  });
  const results = [];
  try {
    await page.locator("[data-message-dismiss]").evaluateAll((nodes) => nodes.forEach((n) => n.click()));
    await page.evaluate(() => {
      WriterState.CASES = [
        {
          id: "r42-synthetic",
          number: "QA-R42-EDITOR",
          address: "4200 SYNTHETIC LANE",
          parcel: "070822219105",
          owner: "SYNTHETIC PROPERTY OWNER",
          ownerAddr: ["4200 SYNTHETIC LANE", "MADISON WI 53703"],
          inspectorId: "i4",
          date: recordDay(today),
          time: "09:00",
          emails: [],
        },
      ];
      WriterState.DOCS = [];
      WriterState.REINSP = [];
      WriterState.EVENTS = {};
      WriterState.PENDING = [];
      WriterState.RECORD_ATTEMPTS = {};
      WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
      WriterState.state = { ...WriterState.state, modal: null, picker: false, publicationBusy: null };
      newDoc(WriterState.CASES[0].id, "notice");
      const d = doc(WriterState.state.docId);
      d.items = [
        {
          id: "r42-fixture-item",
          no: "1",
          title: "Repair exterior wall",
          text: "Repair ( ) on the exterior wall.",
          sections: ["27.05(2)(c)"],
          due: "",
          cite: false,
        },
      ];
      render();
    });
    for (const size of [
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(size);
      await page.evaluate(() => scrollTo(0, 0));
      assert.equal(await page.locator(".topbar-actions .btn-primary").count(), 1);
      assert.equal(await page.locator("#btn-save").isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await axeScreen(page, "r42-notice-" + size.width);
      await page.screenshot({ path: path.join(OUT, "r42-editor-" + size.width + ".png"), fullPage: false });
      results.push({
        viewport: size,
        primary: await page.locator(".editor-primary").innerText(),
        header: await page.locator(".topbar").boundingBox(),
      });
    }
    // R59: above 860px the remove button never covers the due date or its calendar button. Widths 1093 and 911 are
    // the CSS viewport of a 1366px screen at 125% and 150% browser zoom.
    await page.evaluate(() => {
      const d = doc(WriterState.state.docId);
      window.__r42Items = clone(d.items);
      d.items.push({ ...clone(d.items[0]), id: "r42-overlap-item", no: "2", title: "Repair porch", due: addDays(recordDay(today), 30) });
      d.items[0].due = addDays(recordDay(today), 21);
      render();
    });
    const overlap = {};
    for (const width of [1366, 1024, 900, 1093, 911]) {
      await page.setViewportSize({ width, height: 768 });
      const row = page.locator(".desk tbody tr:not(.grp)").first();
      await row.scrollIntoViewIfNeeded();
      await row.hover();
      const m = await row.evaluate((tr) => {
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        };
        const due = box(tr.querySelector(".due-in")),
          boxes = { pick: box(tr.querySelector(".due-pick")), due, calendar: { ...due, left: due.right - 20 }, remove: box(tr.querySelector(".rm")) };
        const hit = (b, x = (b.left + b.right) / 2) => {
          const el = document.elementFromPoint(x, (b.top + b.bottom) / 2);
          return el?.matches(".due-pick") ? "pick" : el?.matches(".due-in") ? "due" : el?.matches(".rm") ? "remove" : String(el?.className);
        };
        return {
          boxes,
          hits: { pick: hit(boxes.pick), due: hit(boxes.due), calendar: hit(boxes.calendar), remove: hit(boxes.remove) },
          cellRight: tr.querySelector(".c-due").getBoundingClientRect().right,
          scrollWidth: document.scrollingElement.scrollWidth,
        };
      });
      overlap[width] = m;
      const meets = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      for (const [a, b] of [
        ["pick", "due"],
        ["pick", "remove"],
        ["due", "remove"],
        ["calendar", "remove"],
      ])
        assert.equal(meets(m.boxes[a], m.boxes[b]), false, width + "px: " + a + " and " + b + " do not intersect " + JSON.stringify(m.boxes));
      assert.deepEqual(m.hits, { pick: "pick", due: "due", calendar: "due", remove: "remove" }, width + "px: each control hit-tests to itself");
      assert.ok(m.boxes.due.right <= m.cellRight + 0.5, width + "px: the due date stays inside its cell");
      assert.ok(m.boxes.remove.left - m.boxes.due.right >= 8, width + "px: space between the date field and the remove button");
      assert.ok(
        m.boxes.remove.right - m.boxes.remove.left >= 24 && m.boxes.remove.bottom - m.boxes.remove.top >= 24,
        width + "px: 24px remove target",
      );
      assert.ok(m.scrollWidth <= width, width + "px: no horizontal overflow");
    }
    // Clicking the calendar area of item 1 removes nothing; clicking item 2's remove button removes only item 2.
    await page.setViewportSize({ width: 1366, height: 768 });
    const firstRow = page.locator(".desk tbody tr:not(.grp)").first();
    await firstRow.scrollIntoViewIfNeeded();
    const calendar = await firstRow.locator(".due-in").boundingBox();
    await page.mouse.click(calendar.x + calendar.width - 10, calendar.y + calendar.height / 2);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => doc(WriterState.state.docId).items.length), 2, "the calendar button does not remove an item");
    const secondRemove = page.locator('.desk [data-del="r42-overlap-item"]');
    assert.equal(await secondRemove.getAttribute("aria-label"), "Remove item 2");
    // Keyboard focus shows the remove button without hovering.
    await page.mouse.move(0, 0);
    await secondRemove.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    assert.equal(
      await secondRemove.evaluate((el) => el === document.activeElement && getComputedStyle(el).opacity),
      "1",
      "focused remove button is visible",
    );
    const removeBox = await secondRemove.boundingBox();
    await page.mouse.click(removeBox.x + removeBox.width / 2, removeBox.y + removeBox.height / 2);
    assert.deepEqual(
      await page.evaluate(() => doc(WriterState.state.docId).items.map((i) => i.id)),
      ["r42-fixture-item"],
      "the remove button removes only its own item",
    );
    // The remove and selection controls stay out of print.
    await page.emulateMedia({ media: "print" });
    const printed = await page.evaluate(() => [...document.querySelectorAll(".desk .rm,.desk .due-pick")].map((el) => getComputedStyle(el).display));
    assert.ok(printed.length === 2 && printed.every((x) => x === "none"), "screen-only controls are not printed " + JSON.stringify(printed));
    await page.emulateMedia({ media: "screen" });
    await page.locator("[data-message-dismiss]").evaluateAll((nodes) => nodes.forEach((n) => n.click()));
    await page.evaluate(() => {
      doc(WriterState.state.docId).items = window.__r42Items;
      delete window.__r42Items;
      render();
    });
    results.push({ removeAndDueDate: overlap });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => scrollTo(0, 0));
    // Phase 3: at 390x844 one fixed task bar carries Next required field, Review and the primary action.
    const bar = page.locator(".editor-mobile-bar");
    assert.equal(await bar.isVisible(), true);
    assert.deepEqual(await bar.locator("button").allInnerTexts(), [
      "Next required field",
      "Review",
      await page.locator(".editor-primary").innerText(),
    ]);
    assert.match(await bar.locator("[data-document-device-save]").innerText(), /device/i);
    const barBox = await bar.boundingBox();
    assert.equal(Math.round(barBox.y + barBox.height), 844);
    assert.equal(await page.locator(".editor-mobile-bar").count(), 1);
    // The workspace's bottom padding keeps its last content clear of the bar when scrolled to the end.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const clear = await page.evaluate(() => {
      const bar = document.querySelector(".editor-mobile-bar").getBoundingClientRect(),
        sections = document.querySelectorAll(".document-workspace > .editor-section"),
        last = sections[sections.length - 1].getBoundingClientRect();
      return { lastBottom: last.bottom, barTop: bar.top };
    });
    assert.ok(clear.lastBottom <= clear.barTop, JSON.stringify(clear));
    // Next required field focuses the field; the bar hides while a field is focused (virtual keyboard) and returns after.
    await bar.getByRole("button", { name: "Next required field", exact: true }).click();
    assert.equal(
      await page.evaluate(() => {
        const ready = editorReadiness(doc(WriterState.state.docId)),
          first = ready.list.find((c) => !c.ok && !c.soft && c.targets?.length);
        return document.activeElement === document.querySelector(first.targets[0].selector);
      }),
      true,
    );
    assert.equal(await bar.isVisible(), false);
    await page.evaluate(() => document.activeElement.blur());
    assert.equal(await bar.isVisible(), true);
    await bar.getByRole("button", { name: "Review", exact: true }).click();
    // R59: the bar's Review opens the Review dialog, and Escape returns focus to the bar's button.
    await page.locator("#overlay [data-review-dialog]").waitFor();
    assert.equal(await page.evaluate(() => document.querySelector("[data-review-dialog]").contains(document.activeElement)), true);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[data-review-dialog]"));
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-mobile-review")), true);
    await page.evaluate(() => scrollTo(0, 0));
    // #25: 320px reflow (WCAG 1.4.10). The editable row's date-selection box, due date and remove button wrap inside
    // the item card, header fields stay inside the sheet and the More menu stays on screen; nothing widens the page
    // and no control shrinks below its narrow-screen size.
    const reflow = () =>
      page.evaluate(() => {
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width, height: r.height };
        };
        const row = document.querySelector(".desk tbody tr:not(.grp)"),
          sheet = document.querySelector(".desk .sheet");
        return {
          width: innerWidth,
          scrollWidth: document.scrollingElement.scrollWidth,
          row: box(row),
          sheet: box(sheet),
          pick: box(row.querySelector("[data-due-select]")),
          due: { ...box(row.querySelector(".due-in")), font: parseFloat(getComputedStyle(row.querySelector(".due-in")).fontSize) },
          remove: box(row.querySelector("[data-del]")),
          rowControls: [...row.querySelectorAll("input,button,select,[contenteditable]")].map(box),
          header: [...sheet.querySelectorAll(".n-head input,.n-head select")].map(box),
        };
      });
    const reflowSizes = {};
    for (const size of [
      { width: 760, height: 900 },
      { width: 390, height: 844 },
      { width: 320, height: 700 },
    ]) {
      await page.setViewportSize(size);
      await page.evaluate(() => scrollTo(0, 0));
      const m = await reflow();
      reflowSizes[size.width] = m;
      assert.ok(m.scrollWidth <= m.width, size.width + "px: no page-level horizontal overflow " + JSON.stringify(m.scrollWidth));
      for (const control of m.rowControls) {
        assert.ok(control.left >= m.row.left - 0.5 && control.right <= m.row.right + 0.5, size.width + "px: row control inside its card");
        assert.ok(control.left >= 0 && control.right <= m.width, size.width + "px: row control inside the viewport");
      }
      for (const field of m.header)
        assert.ok(field.left >= m.sheet.left - 3 && field.right <= m.sheet.right + 0.5, size.width + "px: header field inside the sheet");
      assert.ok(m.pick.width >= 24 && m.pick.height >= 24, size.width + "px: date-selection box keeps a 24px target");
      assert.ok(m.remove.width >= 40 && m.remove.height >= 40, size.width + "px: remove button keeps its 40px target");
      assert.ok(m.due.height >= 40 && m.due.width >= 9 * m.due.font - 0.5, size.width + "px: due date stays full height and readable");
      assert.ok(m.remove.right <= m.width && m.pick.left >= 0, size.width + "px: selection and removal stay visible");
      assert.equal(await bar.isVisible(), true, size.width + "px: one fixed task bar");
      const barBox = await bar.boundingBox();
      assert.equal(Math.round(barBox.y + barBox.height), size.height, size.width + "px: task bar sits on the bottom edge");
      assert.ok(barBox.x >= 0 && barBox.x + barBox.width <= size.width, size.width + "px: task bar inside the viewport");
      for (const button of await bar.locator("button").all()) {
        const target = await button.boundingBox();
        assert.ok(target.height >= 24 && target.width >= 24, size.width + "px: bar actions keep 24px targets");
        assert.ok(target.x >= 0 && target.x + target.width <= size.width, size.width + "px: bar action inside the viewport");
      }
      await page.screenshot({ path: path.join(OUT, "r42-editor-reflow-" + size.width + ".png"), fullPage: false });
    }
    for (const key of ["pick", "remove"])
      for (const dimension of ["width", "height"])
        assert.ok(reflowSizes[320][key][dimension] >= reflowSizes[390][key][dimension] - 0.5, "320px " + key + " " + dimension + " not reduced");
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).overflowX), "visible", "overflow is not hidden");
    await axeScreen(page, "r42-notice-320");
    // The issued copy's More menu (Document actions) opens inside the 320px screen.
    await page.evaluate(() => {
      const d = doc(WriterState.state.docId);
      window.__r42Reflow = clone(d);
      d.draft = false;
      d.status = "Final";
      d.mailed = recordDay(today);
      render();
    });
    await page.locator(".editor-more > summary").click();
    const menu = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.scrollingElement.scrollWidth,
      items: [...document.querySelectorAll(".editor-more > div button")].map((b) => {
        const r = b.getBoundingClientRect();
        return { left: r.left, right: r.right, height: r.height };
      }),
    }));
    assert.ok(menu.items.length, "issued copy offers document actions");
    assert.ok(menu.scrollWidth <= menu.width, "open More menu adds no horizontal overflow " + menu.scrollWidth);
    assert.ok(
      menu.items.every((i) => i.left >= 0 && i.right <= menu.width),
      "every More menu action is on screen",
    );
    await page.evaluate(() => {
      document.querySelector(".editor-more").open = false;
      const d = doc(WriterState.state.docId);
      Object.keys(d).forEach((key) => delete d[key]);
      Object.assign(d, window.__r42Reflow);
      delete window.__r42Reflow;
      render();
    });
    results.push({
      reflow: Object.fromEntries(
        Object.entries(reflowSizes).map(([w, m]) => [w, { scrollWidth: m.scrollWidth, remove: m.remove, pick: m.pick, due: m.due }]),
      ),
      menu,
    });
    await page.evaluate(() => scrollTo(0, 0));
    await page.setViewportSize({ width: 1366, height: 768 });
    assert.equal(await bar.isVisible(), false, "the task bar is narrow-screen only");
    await axeThemes(page, "r42-document");
    // The summary's first-field button reaches the first unresolved required field.
    await page.locator(".editor-readiness").getByRole("button", { name: "Go to first required field" }).click();
    assert.equal(
      await page.evaluate(() => {
        const ready = editorReadiness(doc(WriterState.state.docId)),
          first = ready.list.find((c) => !c.ok && !c.soft && c.targets?.length);
        return document.activeElement === document.querySelector(first.targets[0].selector);
      }),
      true,
    );
    await page.locator("#btn-review").focus();
    await page.keyboard.press("Enter");
    await page.locator("#overlay [data-review-dialog]").waitFor();
    assert.equal(await page.evaluate(() => document.querySelector("[data-review-dialog]").contains(document.activeElement)), true);
    await page.locator("[data-review-dialog] [data-review-blocking] .check-link").filter({ hasText: "Item 1" }).first().focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.dataset.field), "text");
    const field = page.locator('[data-field="text"]').first();
    await field.fill("Repair the damaged wall.");
    assert.equal(await field.evaluate((el) => document.activeElement === el), true);
    await page
      .locator('[data-field="due"]')
      .first()
      .fill(await page.evaluate(() => addDays(recordDay(today), 21)));
    await page.waitForFunction(() => blockers(doc(WriterState.state.docId)).length === 0);
    assert.equal(await page.locator(".editor-primary").innerText(), "Issue");
    // Phase 2: one readiness summary in the top line, which now reports no required fixes.
    assert.equal(await page.locator("[data-editor-readiness],#chk-chip").count(), 1);
    assert.match(await page.locator(".editor-readiness #chk-chip[data-editor-readiness]").innerText(), /^Ready for review/);
    assert.equal(await page.locator(".editor-readiness").getByRole("button", { name: "Go to first required field" }).count(), 0);
    // R59: no draft Print preview; the Review dialog lists the remaining concerns and returns focus on Escape.
    assert.equal(await page.locator("[data-editor-preview]").count(), 0);
    await page.locator("#btn-review").click();
    await page.locator("#overlay [data-review-dialog]").waitFor();
    assert.equal(await page.locator("[data-review-dialog] [data-review-blocking]").count(), 0);
    await axeScreen(page, "r42-review-dialog");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("[data-review-dialog]"));
    assert.equal(await page.evaluate(() => document.activeElement.id), "btn-review");
    // All four copies appear by default; compact preview must not trim the print packet.
    await page.evaluate(() => {
      doc(WriterState.state.docId).importRule = { kind: "initial", doc: "notice", cite: true, label: "Citation", status: "Citation" };
      render();
    });
    await page.locator("[data-notecite]").first().check();
    await page.waitForFunction(() => initialCitations.enabled(doc(WriterState.state.docId)));
    await page.locator(".initial-citation-previews .cit").first().waitFor();
    assert.equal(await page.locator(".initial-citation-previews .cit:visible").count(), 4);
    assert.equal(await page.locator(".initial-citation-previews .cit").count(), 4);
    await page.locator("[data-citation-copies]").click();
    assert.equal(await page.locator(".initial-citation-previews .cit:visible").count(), 1);
    const job = await page.evaluate(() => printJob(initialCitations.preview(doc(WriterState.state.docId))));
    const print = await browser.newPage();
    try {
      await print.setContent(job.html);
      await print.evaluate(() => document.fonts.ready);
      await print.emulateMedia({ media: "print" });
      assert.equal(await print.locator(".cit:visible").count(), 4);
      await print.pdf({ path: path.join(OUT, "r42-full-citation-packet.pdf"), format: "Letter", printBackground: true, preferCSSPageSize: true });
    } finally {
      await print.close();
    }
    assert.equal(await page.locator("[data-editor-preview]").count(), 0, "no draft Print preview for the citation packet");
    fs.writeFileSync(
      path.join(OUT, "r42-editor-results.json"),
      JSON.stringify(
        { passed: true, layouts: results, fullPacketCopies: 4, staffUsability: "Not measured; inspector and screen-reader sessions remain open." },
        null,
        2,
      ),
    );
    return {
      passed: true,
      layouts: results,
      checks: [
        "one primary header action",
        "save remains visible",
        "three nonsequential task links",
        "invalid draft and actionable keyboard checks",
        "caret retained",
        "readiness updates",
        "review dialog focus return",
        "one screen copy and four print copies",
        "three viewport sizes",
        "dark high contrast and system themes",
      ],
    };
  } finally {
    await page.evaluate(() => {
      ({
        CASES: WriterState.CASES,
        DOCS: WriterState.DOCS,
        REINSP: WriterState.REINSP,
        EVENTS: WriterState.EVENTS,
        PENDING: WriterState.PENDING,
        RECORD_ATTEMPTS: WriterState.RECORD_ATTEMPTS,
        WORK: WriterState.WORK,
        state: WriterState.state,
        HELPER: WriterState.HELPER,
        CASEDIR: WriterState.CASEDIR,
        NEEDGRANT: WriterState.NEEDGRANT,
      } = window.__r42Saved);
      delete window.__r42Saved;
      render();
    });
    await page.setViewportSize(viewport);
  }
};
