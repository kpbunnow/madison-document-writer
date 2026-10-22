/* R59 production screen styles: shared type tokens across Writer screens and the Reports chrome, reflow at narrow
   widths and 200% zoom, the selected inspection candidate and the issued case row in every theme, including forced
   colors. Only synthetic state is introduced and restored. */
const path = require("path"),
  assert = require("assert/strict");
const TOKENS = {
  "--type-title": "24px",
  "--type-title-narrow": "20px",
  "--type-h2": "18px",
  "--type-h3": "15px",
  "--type-body": "14px",
  "--type-label": "12px",
  "--type-table": "14px",
  "--type-table-head": "12px",
  "--type-table-num": "13.5px",
  "--type-button": "13px",
  "--type-button-sm": "12px",
  "--type-hint": "13px",
  "--type-badge": "11.5px",
};
// Equivalent elements, each expected at one token wherever it appears.
const ROLES = {
  title: [".topbar h1", "--type-title"],
  heading: [".editor-section > h2, .panel-h h2, .tools-section h2, .modal-h h2, .picker-h h2, .workspace-lead h2, .empty-state h2", "--type-h2"],
  card: [".card-h h2", "--type-h3"],
  label: ["label.f > span:not(.hint), .filters .f > span:not(.hint)", "--type-label"],
  tableHead: ["table.list th, table.rep th", "--type-table-head"],
  tableCell: ["table.list td, table.rep td:not(.n)", "--type-table"],
  tableNumber: ["table.rep td.n", "--type-table-num"],
  button: [".btn:not(.btn-sm)", "--type-button"],
  smallButton: [".btn.btn-sm", "--type-button-sm"],
  hint: [".hint", "--type-hint"],
};
async function measure(page, screen) {
  return page.evaluate(
    ({ ROLES, screen }) => {
      const root = getComputedStyle(document.documentElement),
        out = { screen, roles: {}, width: innerWidth, scrollWidth: document.scrollingElement.scrollWidth, clipped: [] };
      for (const [role, [selector, token]] of Object.entries(ROLES)) {
        const sizes = [...document.querySelectorAll(selector)]
          .filter((el) => !el.closest(".sheet") && el.getClientRects().length)
          .map((el) => getComputedStyle(el).fontSize);
        if (sizes.length) out.roles[role] = { sizes: [...new Set(sizes)], token: root.getPropertyValue(token).trim() };
      }
      for (const el of document.querySelectorAll(".topbar h1, .btn, label.f > span, th, .card-h h2"))
        if (
          el.getClientRects().length &&
          !el.closest(".sheet") &&
          el.scrollWidth > el.clientWidth + 1 &&
          getComputedStyle(el).overflowX !== "visible"
        )
          out.clipped.push(el.className + " " + el.textContent.trim().slice(0, 40));
      return out;
    },
    { ROLES, screen },
  );
}
module.exports = async function (browser, page, context, OUT, axeScreen, axeThemes, base) {
  const viewport = page.viewportSize();
  await page.evaluate(() => {
    window.__r59Saved = {
      CASES: WriterState.CASES,
      DOCS: WriterState.DOCS,
      REINSP: WriterState.REINSP,
      EVENTS: WriterState.EVENTS,
      PENDING: WriterState.PENDING,
      RECORD_ATTEMPTS: WriterState.RECORD_ATTEMPTS,
      WORK: WriterState.WORK,
      state: WriterState.state,
    };
  });
  const reports = await context.newPage();
  const results = { screens: [], reflow: {} };
  try {
    await page.locator("[data-message-dismiss]").evaluateAll((nodes) => nodes.forEach((n) => n.click()));
    await page.evaluate(() => {
      WriterState.CASES = [
        {
          id: "r59-synthetic",
          number: "QA-R59-TYPE",
          address: "5900 SYNTHETIC LANE",
          parcel: "070822219105",
          owner: "SYNTHETIC PROPERTY OWNER",
          ownerAddr: ["5900 SYNTHETIC LANE", "MADISON WI 53703"],
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
      WriterState.state = { ...WriterState.state, modal: null, picker: false, publicationBusy: null, issuedCase: null };
      newDoc("r59-synthetic", "notice");
      doc(WriterState.state.docId).items = [
        { id: "r59-type-item", no: "1", title: "Repair wall", text: "Repair the wall.", sections: ["27.05(2)(c)"], due: "", cite: false },
      ];
      window.__r59Doc = WriterState.state.docId;
    });
    const screens = {
      workspace: () => {
        WriterState.state.screen = "cases";
        WriterState.state.modal = null;
        render();
      },
      editor: () => {
        WriterState.state.docId = window.__r59Doc;
        WriterState.state.screen = "write";
        render();
      },
      review: () => document.querySelector("#btn-review").click(),
      tools: () => {
        WriterState.state.modal = null;
        WriterState.state.screen = "tools";
        render();
      },
      library: () => {
        WriterState.state.screen = "library";
        render();
      },
      import: () => {
        const number = "QA-R59-IMPORT",
          row = {
            CaseNumber: number,
            SiteAddress: "5901 SYNTHETIC LANE, MADISON WI 53703",
            ParcelNumber: "070913125237",
            OwnerName: "SYNTHETIC OWNER",
            OwnerAddress: "5901 SYNTHETIC LANE\nMADISON WI 53703",
            CaseDescription: "Complaint",
            HistoricDistrict: "No",
            HistoricDistrictName: "",
            IndividualLandmark: "No",
            Landmark: "",
            InspectionDate: "2026-09-10",
            InspectionType: "Initial Inspection",
            InspectionStatus: "Official Notice",
            InspectionTime: "09:05",
            InspectorName: INSPECTORS[0].name,
          };
        WriterState.state.screen = "import";
        WriterState.state.acc = sqlReport(
          {
            ok: true,
            rows: [row, { ...row, InspectionDate: "2026-09-12", InspectionTime: "10:00" }],
            caseNumber: number,
            source: { kind: "sql", retrievedAt: new Date().toISOString() },
          },
          number,
        );
        WriterState.state.acc.sel = WriterState.state.acc.cases[0].rows[1].i;
        render();
      },
    };
    await reports.goto(base + "/madison-reports.html");
    await reports.waitForFunction(() => ReportsState.S.phase === "ready");
    for (const size of [
      { width: 1366, height: 900 },
      { width: 760, height: 900 },
      { width: 390, height: 844 },
      { width: 320, height: 700 },
      // 200% browser zoom on a 1366px screen
      { width: 683, height: 450 },
    ]) {
      await page.setViewportSize(size);
      await reports.setViewportSize(size);
      const found = [];
      await page.bringToFront();
      for (const [name, open] of Object.entries(screens)) {
        await page.evaluate(open);
        if (name === "review") await page.locator("#overlay [data-review-dialog]").waitFor();
        found.push(await measure(page, name));
      }
      await page.evaluate(() => {
        WriterState.state.modal = null;
        WriterState.state.acc = null;
        WriterState.state.screen = "cases";
        render();
      });
      await reports.bringToFront();
      for (const screen of ["openCases", "data"]) {
        await reports.locator("#report-menu").evaluate((el) => (el.open = true));
        await reports.locator('.rail [data-screen="' + screen + '"]').click();
        found.push(await measure(reports, "reports-" + screen));
      }
      await page.bringToFront();
      for (const m of found) {
        assert.ok(m.scrollWidth <= m.width, size.width + "px " + m.screen + ": no horizontal overflow " + m.scrollWidth);
        assert.deepEqual(m.clipped, [], size.width + "px " + m.screen + ": no clipped titles, buttons, labels or headings");
      }
      results.reflow[size.width] = found.map((m) => ({ screen: m.screen, scrollWidth: m.scrollWidth }));
      if (size.width !== 1366) continue;
      results.screens = found;
      // Tokens hold the reviewed scale and every representative element uses its token on every screen.
      const tokens = await page.evaluate(
        (names) => names.map((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()),
        Object.keys(TOKENS),
      );
      assert.deepEqual(tokens, Object.values(TOKENS), "Writer type tokens");
      const reportTokens = await reports.evaluate(
        (names) => names.map((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()),
        Object.keys(TOKENS),
      );
      assert.deepEqual(reportTokens, Object.values(TOKENS), "Reports type tokens");
      const seen = {};
      for (const m of found)
        for (const [role, value] of Object.entries(m.roles)) {
          assert.deepEqual(value.sizes, [value.token], m.screen + " " + role + " uses its token");
          (seen[role] = seen[role] || new Set()).add(m.screen);
        }
      // Each role is compared across several screens, including Reports for the shared chrome.
      for (const role of ["title", "heading", "button", "label"]) assert.ok(seen[role].size >= 3, role + " compared on " + [...seen[role]]);
      for (const role of ["title", "heading", "button", "label"])
        assert.ok(
          [...seen[role]].some((s) => s.startsWith("reports")),
          role + " compared with Reports",
        );
      assert.ok(
        ["workspace", "editor", "tools", "import"].every((s) => seen.title.has(s)),
        "page titles on every Writer screen",
      );
    }
    await page.setViewportSize({ width: 1366, height: 900 });
    // The selected inspection is marked by border, bar and tint; forced colors keep an outline.
    await page.evaluate(screens.import);
    const selected = page.locator('.import-inspection[aria-pressed="true"]');
    assert.equal(await selected.count(), 1);
    const selectedStyle = () =>
      selected.evaluate((el) => {
        const s = getComputedStyle(el),
          other = getComputedStyle(document.querySelector('.import-inspection[aria-pressed="false"]'));
        return {
          border: s.borderLeftColor !== other.borderLeftColor,
          bar: s.boxShadow.includes("inset"),
          tint: s.backgroundColor !== other.backgroundColor,
          outline: s.outlineStyle,
        };
      });
    assert.deepEqual(await selectedStyle(), { border: true, bar: true, tint: true, outline: "solid" }, "selected candidate in the light theme");
    for (const theme of ["dark", "high"]) {
      await page.evaluate((value) => A11Y.setTheme(value), theme);
      const style = await selectedStyle();
      assert.ok(
        style.border && style.bar && style.outline === "solid",
        theme + ": selected candidate keeps its border and bar " + JSON.stringify(style),
      );
    }
    await page.evaluate(() => A11Y.setTheme("light"));
    await axeScreen(page, "r59-import-selected");
    await page.emulateMedia({ forcedColors: "active" });
    assert.equal(await selected.evaluate((el) => getComputedStyle(el).outlineStyle), "solid", "forced colors keep the selection outline");
    await page.emulateMedia({ forcedColors: "none" });
    await page.screenshot({ path: path.join(OUT, "r59-import-selected.png"), fullPage: true });
    // The issued case row: tint, inset bar and a visible focus outline in every theme.
    await page.evaluate(() => {
      WriterState.state.acc = null;
      WriterState.state.issuedCase = "r59-synthetic";
      WriterState.state.screen = "cases";
      render();
      document.querySelector("tr[data-issued-highlight]").focus();
    });
    const row = page.locator("tr[data-issued-highlight]");
    assert.equal(await row.count(), 1);
    const rowStyle = () =>
      row.evaluate((tr) => ({
        bar: getComputedStyle(tr.cells[0]).boxShadow.includes("inset"),
        tint: getComputedStyle(tr.cells[1]).backgroundColor,
        focus: getComputedStyle(tr).outlineStyle,
      }));
    const light = await rowStyle();
    assert.ok(light.bar && light.focus === "solid" && light.tint !== "rgba(0, 0, 0, 0)", "issued case row " + JSON.stringify(light));
    for (const theme of ["dark", "high"]) {
      await page.evaluate((value) => A11Y.setTheme(value), theme);
      const style = await rowStyle();
      assert.ok(style.bar && style.focus === "solid", theme + ": issued row keeps its bar and focus outline " + JSON.stringify(style));
    }
    await page.evaluate(() => A11Y.setTheme("light"));
    await page.evaluate(() => document.activeElement.blur());
    await page.emulateMedia({ forcedColors: "active" });
    assert.equal(await row.evaluate((tr) => getComputedStyle(tr).outlineStyle), "solid", "forced colors keep the issued row outline");
    await page.emulateMedia({ forcedColors: "none" });
    await axeScreen(page, "r59-workspace-issued");
    await axeThemes(page, "r59-workspace-issued");
    await page.screenshot({ path: path.join(OUT, "r59-workspace-issued.png"), fullPage: true });
    return {
      passed: true,
      tokens: TOKENS,
      screens: results.screens.map((m) => ({ screen: m.screen, roles: m.roles })),
      reflow: results.reflow,
      checks: [
        "type tokens on Writer and Reports",
        "equivalent elements share their token across screens",
        "no overflow or clipping at 1366, 760, 390, 320 and 200% zoom",
        "selected inspection border, bar and tint in light, dark, high contrast and forced colors",
        "issued case row bar, tint and focus outline in every theme",
      ],
    };
  } finally {
    await reports.close().catch(() => {});
    await page.emulateMedia({ forcedColors: "none" });
    await page.evaluate(() => {
      A11Y.setTheme("light");
      ({
        CASES: WriterState.CASES,
        DOCS: WriterState.DOCS,
        REINSP: WriterState.REINSP,
        EVENTS: WriterState.EVENTS,
        PENDING: WriterState.PENDING,
        RECORD_ATTEMPTS: WriterState.RECORD_ATTEMPTS,
        WORK: WriterState.WORK,
        state: WriterState.state,
      } = window.__r59Saved);
      delete window.__r59Saved;
      delete window.__r59Doc;
      render();
    });
    await page.setViewportSize(viewport);
    await page.bringToFront();
  }
};
