/* Capture the program manual's screenshots and captioned clips from the real production build.

   Maintainer tool; never part of the gate. Run after `python3 tools/build.py`:
     node tools/capture_manual_media.cjs            capture everything
     node tools/capture_manual_media.cjs ID ...     capture only the named items

   It starts the real Python helper on a throwaway folder and drives the production pages in the pinned Chromium,
   exactly as a person would, with synthetic cases only. City-only services (report server, GIS, Outlook) are answered
   by synthetic stand-ins, and a synthetic inspector is added to the page's roster so no real case or staff record
   appears. Output goes to docs/staff/manual-media/ and docs/staff/manual-media.json records each file's caption, alt
   text, size and SHA-256; tools/build_manual.py refuses media that do not match that record. Clips are recorded by
   Playwright and re-encoded with ffmpeg (VP9 WebM); their captions are written as WebVTT. Requires ffmpeg. */
const fs = require("fs"),
  os = require("os"),
  path = require("path"),
  crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, ".."),
  STAFF = path.join(ROOT, "docs/staff"),
  MEDIA = path.join(STAFF, "manual-media"),
  MANIFEST = path.join(STAFF, "manual-media.json");
const VIEW = { width: 1280, height: 800 },
  CLIP = { width: 1280, height: 800 },
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* Synthetic people and cases. Nothing here is a real City record. */
const INSPECTOR = {
  id: "i_manual",
  name: "TAYLOR EXAMPLE",
  title: "CODE ENFORCEMENT OFFICER II",
  phone: "(608) 555-0100",
  email: "texample@example.org",
  badge: "0000",
};
const caseRow = (number, address, extra = {}) => ({
  CaseNumber: number,
  SiteAddress: address + ", MADISON WI 53703",
  ParcelNumber: "070900000001",
  OwnerName: "SAMPLE PROPERTY OWNER LLC",
  OwnerAddress: "100 EXAMPLE PLAZA\nMADISON WI 53703",
  CaseDescription: "Synthetic manual example",
  HistoricDistrict: "No",
  HistoricDistrictName: "",
  IndividualLandmark: "No",
  Landmark: "",
  InspectionDate: "2026-10-05T00:00:00",
  InspectionType: "Initial Inspection",
  InspectionStatus: "Official Notice",
  InspectionTime: "09:30:00",
  InspectorName: INSPECTOR.name,
  ...extra,
});
const OPEN_CASES = [
  { caseNumber: "CB2026-900-00101", address: "100 SAMPLE ST", description: "Exterior paint and gutters" },
  { caseNumber: "CB2026-900-00102", address: "202 EXAMPLE AVE", description: "Handrail and smoke alarms", dueDate: "2026-12-04" },
  { caseNumber: "CB2026-900-00103", address: "35 DEMO CT", description: "Porch repair", dueDate: "2027-01-15" },
];

// A minimal one-page PDF that stands in for every filed original during capture.
const SYNTHETIC_PDF = [
  "%PDF-1.4",
  "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
  "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
  "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj",
  "trailer<</Root 1 0 R>>",
  "%%EOF",
  "",
].join("\n");

async function startHelper() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "manual-capture-"));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "build/generated/runtime-manifest.json"), "utf8"));
  for (const [name, source] of Object.entries(manifest.deploy)) {
    if (name.includes("/") || name.endsWith(".bat")) continue;
    fs.copyFileSync(path.join(ROOT, source), path.join(work, name));
  }
  fs.cpSync(path.join(ROOT, "helper/vendor"), path.join(work, "vendor"), { recursive: true, filter: (p) => !p.includes("__pycache__") });
  fs.mkdirSync(path.join(work, "Case JSON Files"));
  fs.writeFileSync(path.join(work, "__manual_pdf.pdf"), SYNTHETIC_PDF);
  // Native Chrome PDF printing is Windows-only; a synthetic original stands in for every filed PDF.
  fs.writeFileSync(
    path.join(work, "manual-helper.py"),
    [
      "import server",
      "from pathlib import Path",
      "def renderer(html, target):",
      "    Path(target).write_bytes((server.HERE / '__manual_pdf.pdf').read_bytes())",
      "    return str(target)",
      "server.make_pdf = renderer",
      "with server.Server(('127.0.0.1', server.PORT), server.Handler) as http:",
      "    server.start_session(server.HERE)",
      "    http.serve_forever()",
      "",
    ].join("\n"),
  );
  const port = await new Promise((resolve) => {
    const socket = require("net").createServer();
    socket.listen(0, "127.0.0.1", () => {
      const p = socket.address().port;
      socket.close(() => resolve(p));
    });
  });
  const server = spawn(process.env.PYTHON || "python3", ["-u", path.join(work, "manual-helper.py")], {
    cwd: work,
    env: { ...process.env, DW_PORT: String(port), DW_OPEN_BROWSER: "0", DW_CASE_DIR: path.join(work, "Case JSON Files") },
    stdio: "ignore",
  });
  const base = "http://127.0.0.1:" + port,
    session = path.join(work, ".helper-session.json");
  for (let n = 0; n < 150 && !fs.existsSync(session); n++) {
    try {
      if ((await fetch(base + "/dw-status")).ok && fs.existsSync(session)) break;
    } catch (e) {}
    await delay(100);
  }
  if (!fs.existsSync(session)) throw new Error("The helper did not start; set PYTHON to the project's CPython 3.14 interpreter");
  return { work, base, server, bootstrap: JSON.parse(fs.readFileSync(session, "utf8")).bootstrap };
}

/* A visible pointer and click ring, so a viewer of a clip can follow what is selected. Capture contexts only. */
function pointerScript() {
  addEventListener("DOMContentLoaded", () => {
    const dot = document.createElement("div");
    dot.setAttribute("aria-hidden", "true");
    dot.style.cssText =
      "position:fixed;z-index:2147483647;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(220,38,38,.55);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4);pointer-events:none;left:-40px;top:-40px;transition:transform .15s";
    document.documentElement.appendChild(dot);
    addEventListener(
      "mousemove",
      (e) => {
        dot.style.left = e.clientX + "px";
        dot.style.top = e.clientY + "px";
      },
      true,
    );
    addEventListener("mousedown", () => (dot.style.transform = "scale(1.8)"), true);
    addEventListener("mouseup", () => (dot.style.transform = ""), true);
  });
}

async function openWriter(browser, helper, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || VIEW,
    deviceScaleFactor: 1,
    timezoneId: "America/Chicago",
    colorScheme: "light",
    reducedMotion: "reduce",
    ...(options.video ? { recordVideo: { dir: options.video, size: CLIP } } : {}),
  });
  await context.addInitScript((master) => {
    try {
      localStorage.setItem("madison-helper-bootstrap", master);
    } catch (e) {}
  }, helper.bootstrap);
  if (options.video) await context.addInitScript(pointerScript);
  // City-only services: synthetic answers.
  await context.route("**/dw-status", async (route) => {
    const data = await (await route.fetch()).json();
    await route.fulfill({ json: { ...data, chrome: true, caseLookup: true } });
  });
  await context.route("**/inspector-cases/list", (route) =>
    route.fulfill({
      json: {
        ok: true,
        inspectors: [
          { id: "TEXAMPLE", name: "Taylor Example", openCases: OPEN_CASES.length },
          { id: "JSAMPLE", name: "Jordan Sample", openCases: 2 },
        ],
      },
    }),
  );
  await context.route("**/inspector-cases/names", (route) => route.fulfill({ json: { ok: true, names: [] } }));
  await context.route("**/inspector-cases/cases", (route) =>
    route.fulfill({ json: { ok: true, inspector: { id: "TEXAMPLE", name: "Taylor Example" }, cases: OPEN_CASES, dueDates: true } }),
  );
  await context.route("**/case-lookup", async (route) => {
    const number = route.request().postDataJSON().caseNumber;
    const rows = (options.lookups || {})[number] || [caseRow(number, "100 SAMPLE ST")];
    await route.fulfill({
      json: {
        ok: true,
        caseNumber: number,
        rows,
        source: {
          kind: "ssrs",
          server: "reports.example.org",
          report: "/Synthetic/DocumenGeneratorImport",
          retrievedAt: new Date().toISOString(),
        },
      },
    });
  });
  await context.route("**/email", (route) => route.fulfill({ json: { ok: true, name: "Synthetic draft", via: "outlook" } }));
  const page = await context.newPage();
  page.started = Date.now();
  await page.goto(helper.base + "/");
  await page.waitForFunction(() => typeof WriterState !== "undefined" && WriterState.HELPER && WriterState.WRITER_READY === true);
  await page.evaluate((inspector) => {
    if (!INSPECTORS.some((i) => i.id === inspector.id)) INSPECTORS.push(inspector);
  }, INSPECTOR);
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

/* One session of real user actions. In a clip it moves the pointer visibly, pauses so a viewer can read the screen and
   marks caption times; for screenshots it only waits for the screen to settle. */
class Session {
  constructor(page, video = false) {
    this.page = page;
    this.video = video;
    this.marks = [];
  }
  // Clips run slower than a person would so each caption can be read.
  async pause(ms = 900) {
    await this.page.waitForTimeout(this.video ? Math.round(ms * 1.6) : 150);
  }
  caption(text) {
    if (this.marks.at(-1)?.text !== text) this.marks.push({ at: (Date.now() - this.page.started) / 1000, text });
  }
  async click(locator, ms) {
    await locator.scrollIntoViewIfNeeded();
    if (this.video) {
      const box = await locator.boundingBox();
      if (box) await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 18 });
      await this.page.waitForTimeout(350);
    }
    await locator.click();
    await this.pause(ms);
  }
  async type(text, ms) {
    await this.page.keyboard.type(text, { delay: this.video ? 55 : 0 });
    await this.pause(ms);
  }
  async quiet() {
    // Clear routine messages so a still shows the screen itself; the program keeps them in Message history.
    for (const button of await this.page.locator("[data-message-dismiss]").all()) await button.click({ timeout: 1000 }).catch(() => {});
    await this.page.mouse.move(0, VIEW.height - 1);
    await this.page.waitForTimeout(200);
  }
}

const future = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const button = (page, name) => page.getByRole("button", { name, exact: true });

/* The real workflows. Each step waits for the visible result of the control it used. */
const flows = {
  async workspace(s) {
    await s.click(s.page.locator('.writer-navigation [data-nav="cases"]').first());
    await s.page.waitForFunction(() => WriterState.state.screen === "cases");
  },
  async openCasesFor(s) {
    const select = s.page.locator("#open-cases-inspector");
    await select.waitFor();
    s.caption("Choose an inspector, then Show open cases.");
    await select.selectOption("TEXAMPLE");
    await s.pause(600);
    if (await button(s.page, "Show open cases").count()) await s.click(button(s.page, "Show open cases"));
    await s.page.locator(".open-case").first().waitFor();
    await s.pause();
  },
  async selectOpenCase(s, number) {
    s.caption("Select a case. Its available inspections open in the import window.");
    await s.click(s.page.locator(".open-case", { hasText: number }));
    await s.page.locator("[data-import-dialog] #acc-go").waitFor();
    await s.pause(1600);
  },
  async lookUp(s, number) {
    s.caption("Or type the case number and choose Find Case Inspections.");
    await s.click(s.page.locator("#lookup-number"));
    await s.type(number, 300);
    await s.click(button(s.page, "Find Case Inspections"));
    await s.page.locator("[data-import-dialog] #acc-go").waitFor();
    await s.pause(1200);
  },
  async confirmImport(s) {
    s.caption("Review the inspection, then confirm it. The button names the document it starts.");
    await s.click(s.page.locator("[data-import-dialog] #acc-go"));
    await s.page.waitForFunction(() => WriterState.state.screen === "write" && !WriterState.LOOKUP_BUSY);
    await s.pause(1200);
  },
  async addLanguage(s, picks) {
    s.caption("Choose Violation Items to open the language picker.");
    await s.click(button(s.page, "Violation Items"));
    await s.page.locator("#pk-q").waitFor();
    for (const [query, title] of picks) {
      s.caption("Search by ordinary words or an ordinance, then select the entry.");
      await s.click(s.page.locator("#pk-q"), 200);
      await s.page.locator("#pk-q").fill("");
      await s.type(query, 700);
      await s.click(s.page.locator(".gitem", { hasText: title }).first(), 1000);
    }
  },
  async doneAdding(s) {
    s.caption("Choose Done adding to return to the document.");
    await s.click(button(s.page, "Done adding"), 1000);
  },
  async fillBubble(s, text) {
    s.caption("Click a fill-in bubble and type the detail. It goes straight into the sentence.");
    await s.click(s.page.locator(".blank-edit").first(), 500);
    await s.type(text, 900);
  },
  async assignDueDates(s, days = 30) {
    s.caption("Select the items that share a deadline, enter the date and apply it.");
    await s.click(button(s.page, "Select all"), 500);
    await s.click(s.page.locator("#bulk-due"), 200);
    await s.page.locator("#bulk-due").fill(future(days));
    await s.pause(700);
    await s.click(button(s.page, "Apply date to selected items"), 1000);
  },
  async review(s) {
    s.caption("Review lists every check. Nothing is left to fix here.");
    await s.click(s.page.locator("#btn-review"));
    await s.page.locator("#overlay [data-review-dialog]").waitFor();
    await s.pause(1500);
  },
  async closeDialog(s) {
    await s.page.keyboard.press("Escape");
    await s.pause(500);
  },
  async issue(s) {
    s.caption("Choose Issue, check the mailed date, then Issue document.");
    await s.click(s.page.locator(".topbar-actions .btn-primary"));
    await s.page.locator("#fin-go").waitFor();
    await s.pause(1500);
  },
  async confirmIssue(s) {
    await s.click(s.page.locator("#fin-go"), 300);
    await s.page.waitForFunction(() => WriterState.state.screen === "cases" && !WriterState.state.publicationBusy, null, { timeout: 30000 });
    s.caption("After the shared save, Workspace opens with the issued case highlighted.");
    await s.page.locator("tr[data-issued-highlight]").scrollIntoViewIfNeeded();
    await s.pause(2000);
  },
  async reinspect(s) {
    s.caption("Choose Reinspect to open the reinspection worksheet.");
    await s.click(button(s.page, "Reinspect"));
    await s.page.locator(".ri-progress").first().waitFor();
    await s.pause(1200);
  },
  async oneItem(s) {
    s.caption("One item at a time shows each item in turn.");
    await s.click(button(s.page, "One item at a time"), 1200);
  },
  async outcome(s, key, text) {
    s.caption(text);
    await s.pause(600);
    await s.page.keyboard.press(key);
    await s.pause(1500);
  },
  async newDue(s, days = 21) {
    const input = s.page.locator("[data-ridue]:visible").first();
    s.caption("Progress made needs a new due date for that item.");
    await s.click(input, 200);
    await input.fill(future(days));
    await s.pause(900);
  },
  async allItems(s) {
    await s.click(button(s.page, "Review all items"), 900);
  },
  async chooseFollowUp(s, group) {
    const choice = s.page.locator(".r26-choice", { hasText: group });
    await choice.scrollIntoViewIfNeeded();
    s.caption("Choose the follow-up, then the document, and Create draft.");
    await s.click(choice.locator("input"), 1200);
  },
};

/* Stills: id, chapter, alt text and caption are recorded with each file. */
const STILLS = [];
const still = (id, chapter, caption, alt) => STILLS.push({ id, chapter, caption, alt });
still(
  "workspace-open-cases",
  4,
  "Workspace on a City PC: Open cases by inspector lists the chosen inspector's open cases, each with its soonest due date.",
  "Workspace screen. The Open cases by inspector card shows Taylor Example selected and three synthetic cases with case numbers, addresses, descriptions and due dates.",
);
still(
  "import-window",
  4,
  "The import window shows the inspection that can be imported. Start Official Notice confirms it; Exit returns to the list.",
  "Import window titled Inspections for CB2026-900-00101, showing one Initial Inspection with status Official Notice and the buttons Start Official Notice, Clear import, Save draft and return to Workspace, and Exit.",
);
still(
  "notice-editor",
  5,
  "A new Official Notice. The header shows the case and its state; Recipients, Violation Items and Review share the task bar with Fix next issue.",
  "Official Notice editor with the header CB2026-900-00101, Official Notice, Draft, not issued; buttons Save draft and return to Workspace and Issue; a task bar with Recipients, Violation Items, Review and Fix next issue; and the notice page below.",
);
still(
  "language-picker",
  6,
  "The language picker. Search across checklists; a selected entry turns green and reads Selected · remove from notice.",
  "Select for this notice dialog with a search for smoke alarm, Violation Categories on the left, a selected Smoke alarms entry with Add again and Favorite buttons, and Done adding at the bottom.",
);
still(
  "fill-in-bubble",
  5,
  "A selected fill-in bubble shows a double ring. Typing replaces it with the detail.",
  "Violation items table with item 1, Handrails, whose fill-in bubble is selected, and item 2, Smoke alarms, with an empty bubble.",
);
still(
  "assign-due-dates",
  5,
  "Assign due dates: select the items that share a deadline, enter the date and choose Apply date to selected items.",
  "Assign due dates panel showing 2 of 2 items selected, a date entered and the buttons Select all, Clear selection, Apply date to selected items and Sort by due date.",
);
still(
  "review-dialog",
  12,
  "Review lists the checks that must be fixed before issuing, then advisories; here every check has passed.",
  "Review dialog reading No concerns. This document is ready to issue, with the count of checks passed.",
);
still(
  "issue-dialog",
  12,
  "The issue dialog confirms the mailed date and names the case file the issued document is saved to.",
  "Finalize this official notice dialog with Every check passed, the mailed date field, and Cancel, Save draft and return to Workspace and Issue document buttons.",
);
still(
  "workspace-issued",
  3,
  "After issuing, Workspace highlights the case. Each row shows its issued documents, next due date, inspector and one recommended action.",
  "Workspace case table with 100 SAMPLE ST highlighted, an Official Notice link with its issue date, the next due date, inspector Taylor Example and a Reinspect button.",
);
still(
  "reinspection-worksheet",
  9,
  "The reinspection worksheet: the visit date and time, progress counts and each item's outcome buttons.",
  "Reinspection worksheet with the visit date, time and inspector, counts of corrected, outstanding and not yet resulted items, and Corrected, Progress made, No change and No access buttons for each item.",
);
still(
  "one-item-at-a-time",
  9,
  "One item at a time brings the next unanswered item into focus. Keys 1 to 4 record its outcome.",
  "One item at a time view showing four steps, item 1 Handrails with its original due date and the outcome buttons.",
);
still(
  "follow-up-chooser",
  10,
  "Choose next action: pick the follow-up group, then the document, and Create draft.",
  "Choose next action card with the options Give more time, Take enforcement action, Restrict occupancy and Confirm compliance, a document choice and a Create draft button.",
);
still(
  "citation-review",
  7,
  "Citation review: each charge card summarizes the ordinance, citation number, dates and amount, and opens for editing and pricing details.",
  "Initial-inspection citations panel with a charge card for item 1, 27.05(2)(i) Handrails, showing its citation number, a deposit ready amount, the suggested court session, and the Edit charge and dates and Pricing details and authorization disclosures.",
);
still(
  "tools-settings",
  18,
  "Tools & settings groups its actions: Cases & planning, Saved work & connection, Program instructions, Display & help and Administrator tools.",
  "Tools and settings screen with cards for Reminders, Batch draft due dates, Saved work and connection, Open saved case, the Exit Document Writer button, program manual links, color theme, message history and keyboard shortcuts.",
);
still(
  "saved-work",
  14,
  "Saved work & connection keeps three separate facts: this device, shared cases and PDF filing.",
  "Saved work and connection screen with sections This device, Shared cases and PDF filing, and disclosures for backups and connection checks.",
);
still(
  "exit-dialog",
  1,
  "Exit Document Writer saves this device's drafts, lists anything unfinished and asks before the workspace is cleared.",
  "Exit Document Writer dialog explaining what happens on exit, with the Exit Document Writer button.",
);
still(
  "keyboard-shortcuts",
  20,
  "Press ? outside a text field for the keyboard shortcuts sheet.",
  "Keyboard shortcuts dialog listing keys such as ?, Tab, Escape, Ctrl+S, 1 to 4 and U with their actions.",
);
still(
  "order-language",
  6,
  "Order language → Browse language searches all approved and standard language without a case open.",
  "Browse language screen with a search for handrail, status and checklist filters and matching entries.",
);
still(
  "reports",
  16,
  "Reports opens in its own tab. Choose a report in the rail; each report states its population and dates.",
  "Reports screen showing 1. Open cases by area, with the report list in the left rail, the As of date, quick ranges, area and inspector filters, and a table of open cases by area.",
);
still(
  "data-definitions",
  17,
  "Data and definitions shows the read time, included case files and any excluded summaries before you rely on totals.",
  "Data and definitions report showing coverage counts and definitions.",
);
still(
  "mobile-editor",
  20,
  "On a narrow screen the editor uses a compact header and one task bar at the bottom.",
  "Phone-width citation draft with a compact header, the navigation at the top and a bottom bar holding the save state, Fix next issue, Review and Issue.",
);

/* Clips: cut from recorded sessions by caption marks. */
const CLIPS = [
  {
    id: "clip-import-case",
    chapter: 4,
    session: "notice",
    from: "Choose an inspector",
    to: "Choose Violation Items",
    caption: "Find an open case, review its inspection and start the document.",
    alt: "Screen recording of Workspace: choosing an inspector, showing open cases, selecting a case and confirming its inspection.",
  },
  {
    id: "clip-notice-language",
    chapter: 5,
    session: "notice",
    from: "Choose Violation Items",
    to: "Select the items",
    caption: "Add order language and type the fill-in details.",
    alt: "Screen recording of the language picker: searching, selecting two entries, choosing Done adding and typing into fill-in bubbles.",
  },
  {
    id: "clip-due-dates-issue",
    chapter: 12,
    session: "notice",
    from: "Select the items",
    to: null,
    caption: "Assign a shared due date, review the checks and issue the notice.",
    alt: "Screen recording of assigning one due date to both items, opening Review, choosing Issue and Issue document, and returning to Workspace.",
  },
  {
    id: "clip-reinspection",
    chapter: 9,
    session: "reinspection",
    from: "Choose Reinspect",
    to: null,
    caption: "Record a reinspection one item at a time and choose the follow-up.",
    alt: "Screen recording of the reinspection worksheet: One item at a time, recording Corrected and Progress made with a new due date, and choosing a follow-up.",
  },
];

const LOOKUPS = {
  "CB2026-900-00102": [caseRow("CB2026-900-00102", "202 EXAMPLE AVE", { InspectionStatus: "Citation", InspectionTime: "10:15:00" })],
  "CB2026-900-00103": [caseRow("CB2026-900-00103", "35 DEMO CT")],
  "CB2026-900-00104": [caseRow("CB2026-900-00104", "48 TRIAL LN")],
};

// Tools such as Saved work & connection and Exit open in the shared utility dialog; Close returns to the page.
async function closeUtility(page) {
  const dialog = page.locator("#utility-dialog[open]");
  if (await dialog.count()) await dialog.locator("[data-utility-close]").last().click();
  await dialog.waitFor({ state: "detached" });
}

async function stills(browser, helper, wanted, out) {
  const { context, page } = await openWriter(browser, helper, { lookups: LOOKUPS });
  const s = new Session(page);
  const shot = async (id, locator) => {
    if (!wanted(id)) return;
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    await (locator || page).screenshot({ path: path.join(out, id + ".png") });
  };
  await context.route("**/reporting/areas", (route) =>
    route.fulfill({ json: { ok: true, districts: { type: "FeatureCollection", features: [] }, zips: null, notes: [] } }),
  );
  await context.route("**/reporting/parcels", (route) => route.fulfill({ json: { ok: true, parcels: [] } }));
  await flows.workspace(s);
  await flows.openCasesFor(s);
  await shot("workspace-open-cases");
  await flows.selectOpenCase(s, "CB2026-900-00101");
  await shot("import-window");
  await flows.confirmImport(s);
  await s.quiet();
  await shot("notice-editor");
  await flows.addLanguage(s, [
    ["handrail", "Handrails"],
    ["smoke alarm", "Smoke alarms"],
  ]);
  await shot("language-picker");
  await flows.doneAdding(s);
  await s.quiet();
  await page.locator(".blank-edit").first().click();
  await page.locator(".desk").first().scrollIntoViewIfNeeded();
  await shot("fill-in-bubble");
  await page.keyboard.type("the rear entry stairs");
  await page.locator(".blank-edit").first().click();
  await page.keyboard.type("each bedroom and hallway");
  await button(page, "Select all").click();
  await page.locator("#bulk-due").fill(future(30));
  await page.locator("#bulk-due").scrollIntoViewIfNeeded();
  await page.mouse.move(0, VIEW.height - 1);
  await shot("assign-due-dates");
  await button(page, "Apply date to selected items").click();
  await s.quiet();
  await flows.review(s);
  await shot("review-dialog");
  await flows.closeDialog(s);
  await s.quiet();
  await flows.issue(s);
  await shot("issue-dialog");
  await flows.confirmIssue(s);
  await s.quiet();
  await page.locator("tr[data-issued-highlight]").scrollIntoViewIfNeeded();
  await shot("workspace-issued");
  await flows.reinspect(s);
  await s.quiet();
  await shot("reinspection-worksheet");
  await flows.oneItem(s);
  await shot("one-item-at-a-time");
  await flows.outcome(s, "1", "");
  await flows.outcome(s, "2", "");
  await flows.newDue(s);
  await flows.allItems(s);
  await flows.chooseFollowUp(s, "Give more time");
  await s.quiet();
  await shot("follow-up-chooser", page.locator(".r26-chooser"));
  await button(page, "Save draft & return to Workspace").first().click();
  await page.waitForFunction(() => WriterState.state.screen === "cases");
  // A citation case: the Accela status Citation offers Cite on each item.
  await flows.lookUp(s, "CB2026-900-00102");
  await flows.confirmImport(s);
  await flows.addLanguage(s, [["handrail", "Handrails"]]);
  await flows.doneAdding(s);
  await page.locator(".blank-edit").first().click();
  await page.keyboard.type("the front porch steps");
  await page.locator("[data-notecite]").first().check({ force: true });
  await page.locator("#citation-review").waitFor();
  await s.quiet();
  await shot("citation-review", page.locator("#citation-review"));
  await button(page, "Save draft & return to Workspace").first().click();
  await page.waitForFunction(() => WriterState.state.screen === "cases");
  await page.locator('.writer-navigation [data-nav="tools"]').first().click();
  await page.getByRole("heading", { name: "Tools & settings", exact: true }).waitFor();
  await s.quiet();
  await shot("tools-settings");
  await page.locator("[data-exit-writer]").click();
  await page.locator("[data-exit-confirm]").waitFor();
  await s.quiet();
  await shot("exit-dialog");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await closeUtility(page);
  await page.locator(".tool-action", { hasText: "Saved work & connection" }).first().click();
  await page.waitForTimeout(800);
  await s.quiet();
  await shot("saved-work");
  await closeUtility(page);
  await flows.workspace(s);
  await page.locator("body").click({ position: { x: 600, y: 60 } });
  await page.keyboard.press("?");
  await page.locator("#utility-dialog[open]").waitFor();
  await shot("keyboard-shortcuts");
  await closeUtility(page);
  await page.locator('.writer-navigation [data-nav="library"]').first().click();
  await page.getByLabel("Search all order language").fill("handrail");
  await page.waitForTimeout(800);
  await s.quiet();
  await shot("order-language");
  // Reports, in its own tab, over the synthetic cases issued above.
  const reports = await context.newPage();
  await reports.goto(helper.base + "/madison-reports.html");
  await reports.locator("table").first().waitFor({ timeout: 60000 });
  await reports.mouse.move(640, 799);
  await reports.waitForTimeout(1200);
  await shot("reports", reports);
  await reports.getByRole("button", { name: "Data and definitions", exact: true }).first().click();
  await reports.mouse.move(640, 799);
  await reports.waitForTimeout(1200);
  await shot("data-definitions", reports);
  await reports.close();
  // Phone width: the compact editor with its bottom task bar.
  await page.setViewportSize({ width: 390, height: 844 });
  await flows.workspace(s);
  await page.locator("[data-open], button", { hasText: "Continue document" }).first().click();
  await page.locator(".editor-mobile-bar").waitFor();
  await s.quiet();
  await shot("mobile-editor");
  await context.close();
}

async function record(browser, helper, name, body, dir) {
  const { context, page } = await openWriter(browser, helper, { lookups: LOOKUPS, video: dir });
  const s = new Session(page, true);
  await body(s);
  await page.waitForTimeout(800);
  const video = page.video();
  await context.close();
  const file = path.join(dir, name + ".webm");
  fs.renameSync(await video.path(), file);
  return { file, marks: s.marks, end: (Date.now() - page.started) / 1000 };
}

const SESSIONS = {
  async notice(s) {
    await flows.workspace(s);
    await flows.openCasesFor(s);
    await flows.selectOpenCase(s, "CB2026-900-00103");
    await flows.confirmImport(s);
    await s.quiet();
    await flows.addLanguage(s, [
      ["handrail", "Handrails"],
      ["smoke alarm", "Smoke alarms"],
    ]);
    await flows.doneAdding(s);
    await flows.fillBubble(s, "the rear entry stairs");
    await flows.fillBubble(s, "each bedroom and hallway");
    await flows.assignDueDates(s);
    await flows.review(s);
    await flows.closeDialog(s);
    await flows.issue(s);
    await flows.confirmIssue(s);
  },
  async reinspection(s) {
    // Setup: an issued notice to reinspect. The clip starts at Reinspect.
    await flows.workspace(s);
    await flows.lookUp(s, "CB2026-900-00104");
    await flows.confirmImport(s);
    await flows.addLanguage(s, [
      ["handrail", "Handrails"],
      ["smoke alarm", "Smoke alarms"],
    ]);
    await flows.doneAdding(s);
    await flows.fillBubble(s, "the rear entry stairs");
    await flows.fillBubble(s, "each bedroom and hallway");
    await flows.assignDueDates(s);
    await flows.issue(s);
    await flows.confirmIssue(s);
    await s.quiet();
    await flows.reinspect(s);
    await flows.oneItem(s);
    await flows.outcome(s, "1", "Press 1 for Corrected. The next unanswered item opens.");
    await flows.outcome(s, "2", "Press 2 for Progress made.");
    await flows.newDue(s);
    await flows.allItems(s);
    await flows.chooseFollowUp(s, "Give more time");
    await s.pause(1500);
  },
};

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const ffmpeg = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
const vttTime = (t) => new Date(Math.max(0, t) * 1000).toISOString().slice(11, 23);

/* Cut one clip from a session recording, re-encode it, write its captions and a poster frame. */
function cutClip(clip, recorded, out) {
  const start = recorded.marks.find((m) => m.text.startsWith(clip.from));
  if (!start) throw new Error(clip.id + ": no caption mark starts with " + clip.from);
  const stop = clip.to ? recorded.marks.find((m) => m.at > start.at && m.text.startsWith(clip.to)) : null;
  const from = Math.max(0, start.at - 0.4),
    to = stop ? stop.at : recorded.end;
  const cues = recorded.marks.filter((m) => m.at >= start.at && m.at < to && m.text);
  const vtt = ["WEBVTT", ""];
  cues.forEach((cue, n) => {
    const end = n + 1 < cues.length ? cues[n + 1].at : to;
    vtt.push(String(n + 1), vttTime(cue.at - from) + " --> " + vttTime(end - from), cue.text, "");
  });
  const video = path.join(out, clip.id + ".webm"),
    poster = path.join(out, clip.id + ".png"),
    captions = path.join(out, clip.id + ".vtt");
  ffmpeg([
    "-ss",
    from.toFixed(2),
    "-to",
    to.toFixed(2),
    "-i",
    recorded.file,
    "-an",
    "-vf",
    "fps=15,scale=1024:-2",
    "-c:v",
    "libvpx-vp9",
    "-crf",
    "40",
    "-b:v",
    "0",
    "-row-mt",
    "1",
    "-deadline",
    "good",
    "-cpu-used",
    "4",
    video,
  ]);
  ffmpeg(["-ss", Math.min(to - from - 0.5, 2.5).toFixed(2), "-i", video, "-frames:v", "1", poster]);
  optimizePNG(poster);
  fs.writeFileSync(captions, vtt.join("\n"));
  return { video, poster, captions, duration: Math.round((to - from) * 10) / 10 };
}

/* Palette PNGs keep interface screenshots small without visible change. */
function optimizePNG(file) {
  const temporary = file + ".tmp.png";
  ffmpeg(["-i", file, "-vf", "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none", temporary]);
  if (fs.statSync(temporary).size < fs.statSync(file).size) fs.renameSync(temporary, file);
  else fs.rmSync(temporary);
}

function writeManifest(entries) {
  const previous = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")).items : [];
  const byId = new Map(previous.map((item) => [item.id, item]));
  for (const entry of entries) byId.set(entry.id, entry);
  const order = [...STILLS, ...CLIPS].map((item) => item.id);
  const items = order.filter((id) => byId.has(id)).map((id) => byId.get(id));
  fs.writeFileSync(MANIFEST, JSON.stringify({ format: "document-writer-manual-media", version: 1, items }, null, 2) + "\n");
}

const describe = (file) => ({ file: path.relative(STAFF, file).split(path.sep).join("/"), bytes: fs.statSync(file).size, sha256: sha256(file) });

async function main() {
  const only = process.argv.slice(2);
  const wanted = (id) => !only.length || only.includes(id);
  fs.mkdirSync(MEDIA, { recursive: true });
  const helper = await startHelper();
  const browser = await chromium.launch({ executablePath: process.env.DW_BROWSER || undefined, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const entries = [];
  try {
    if (STILLS.some((x) => wanted(x.id))) {
      await stills(browser, helper, wanted, MEDIA);
      for (const item of STILLS.filter((x) => wanted(x.id))) {
        const file = path.join(MEDIA, item.id + ".png");
        optimizePNG(file);
        entries.push({ id: item.id, kind: "image", chapter: item.chapter, caption: item.caption, alt: item.alt, image: describe(file) });
      }
    }
    const raw = fs.mkdtempSync(path.join(os.tmpdir(), "manual-video-"));
    for (const name of Object.keys(SESSIONS)) {
      const clips = CLIPS.filter((c) => c.session === name && wanted(c.id));
      if (!clips.length) continue;
      const recorded = await record(browser, helper, name, SESSIONS[name], raw);
      for (const clip of clips) {
        const made = cutClip(clip, recorded, MEDIA);
        entries.push({
          id: clip.id,
          kind: "clip",
          chapter: clip.chapter,
          caption: clip.caption,
          alt: clip.alt,
          duration: made.duration,
          video: describe(made.video),
          poster: describe(made.poster),
          captions: describe(made.captions),
        });
      }
    }
  } finally {
    await browser.close();
    helper.server.kill();
  }
  writeManifest(entries);
  console.log("Captured " + entries.length + " manual media items into " + path.relative(ROOT, MEDIA));
}

module.exports = { STILLS, CLIPS };

if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
