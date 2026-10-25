/* R56 usability phase 3: named search scopes with a shared-search offer that keeps the workspace query, standard
   Reports and Writer labels with restored report context, two named reinspection review modes with a step indicator
   and collapsed tips, shortcut sheet labels that match OUTCOMES, the narrow-screen editor task bar structure, distinct
   language modes and a collapsed Administrator tools group. Layout of the task bar is checked in browser_r42. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom"),
  { spawnSync } = require("child_process");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const { reportsBundleSource } = require("../fixtures/reports_bundle.cjs");

if (process.argv[2] === "reports") {
  // Reports runs in its own process: its bundle and globals are separate from Writer's.
  const payload = reportsBundleSource(builtPage("reports"));
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: "http://127.0.0.1:8777/madison-reports.html" });
  const w = dom.window;
  w.__NO_AUTOLOAD__ = true;
  Object.assign(global, { window: w, document: w.document, localStorage: w.localStorage, location: w.location });
  w.open = () => ({});
  w.focus = () => {};
  // Records each message with the report context at the moment it was posted.
  w.BroadcastChannel = class {
    constructor() {
      this.sent = [];
    }
    postMessage(message) {
      const S = global.REPORTS_STATE_PROBE?.();
      this.sent.push({ message, context: S && { screen: S.screen, view: S.view, dateMode: S.dateMode, from: S.F.from, owner: S.F.owner } });
    }
  };
  global.BroadcastChannel = w.BroadcastChannel;
  const reports = async () => {
    // ITEM 12. One label for every Reports to Writer action.
    assert.equal(payload.includes(">Open in Writer<"), false, "the old Reports label is gone");
    assert.ok(payload.split('">Open case in Writer</button>').length - 1 >= 3, "table, list and case card use Open case in Writer");
    render = () => {};
    ReportsState.S.M = { byNo: { "QA-U3": { number: "QA-U3" } } };
    ReportsState.S.raw = { summaries: [{ case: { number: "QA-U3" }, eventCount: 3 }] };
    const target = REPORTS[1];
    ReportsState.S.screen = target.id;
    ReportsState.S.view = "map";
    ReportsState.S.dateMode = "fixed";
    ReportsState.S.F = { ...ReportsState.S.F, from: "2026-01-01", to: "2026-03-31", status: "open", owner: "owner-key" };
    ReportsState.S.tableSort = { report: target.id, ci: 2, dir: -1 };
    openInWriter("QA-U3");
    // Change everything the return context covers, then return from Writer.
    ReportsState.S.screen = REPORTS[0].id;
    ReportsState.S.view = "table";
    ReportsState.S.dateMode = "month";
    ReportsState.S.F = { ...ReportsState.S.F, from: "2025-05-01", to: "2025-05-31", status: "", owner: "" };
    ReportsState.S.tableSort = null;
    // Back to Reports reaches an already open Reports tab as a channel message (#24): drive the registered handler.
    global.REPORTS_STATE_PROBE = () => ReportsState.S;
    const channel = ReportsState.REPORT_LINK;
    assert.equal(typeof channel.onmessage, "function", "Open case in Writer registered the return handler");
    const returnEvent = (request) => {
      channel.sent.length = 0;
      channel.onmessage({ data: { kind: "return", request } });
      assert.equal(channel.sent.length, 1);
      assert.deepEqual(channel.sent[0].message, { kind: "return-ack", request });
      return channel.sent[0].context;
    };
    const atAck = returnEvent("u3-return-1");
    assert.deepEqual(
      atAck,
      { screen: target.id, view: "map", dateMode: "fixed", from: "2026-01-01", owner: "owner-key" },
      "the saved context is restored before the return is acknowledged",
    );
    assert.equal(ReportsState.S.reportNotice, "Returned from Writer to the saved report context.");
    assert.equal(ReportsState.S.screen, target.id);
    assert.equal(ReportsState.S.view, "map");
    assert.equal(ReportsState.S.dateMode, "fixed");
    assert.equal(ReportsState.S.F.from, "2026-01-01");
    assert.equal(ReportsState.S.F.to, "2026-03-31");
    assert.equal(ReportsState.S.F.status, "open");
    assert.equal(ReportsState.S.F.owner, "owner-key");
    assert.deepEqual(ReportsState.S.tableSort, { report: target.id, ci: 2, dir: -1 });
    // A saved view and a drill-down opened in Reports while Writer was open belong to another context:
    // the return must not leave either visible over the restored report (PR #26 follow-up review).
    const intervening = () => {
      ReportsState.SAVED_VIEWS.push({
        id: "other-view",
        name: "Trash by inspector",
        report: REPORTS[0].id,
        filters: { vtype: "trash" },
        dateMode: "fixed",
        view: "table",
      });
      applyReportView("other-view");
      assert.equal(ReportsState.S.savedId, "other-view");
      assert.equal(ReportsState.S.F.vtype, "trash");
      // The shape a count's drill-down stores (reports_core [data-drill]).
      ReportsState.S.drill = { at: "0:1", ids: ["QA-A"], title: "Inspector, cases" };
      ReportsState.SAVED_VIEWS.pop();
    };
    const restoredScope = () => {
      assert.equal(ReportsState.S.screen, target.id);
      assert.equal(ReportsState.S.drill, null, "no drill-down from the intervening report remains");
      assert.equal(ReportsState.S.savedId, "", "no unrelated saved view stays selected");
      assert.notEqual(ReportsState.S.F.vtype, "trash");
    };
    const returnFilters = JSON.parse(localStorage.getItem("madison-report-return-v1")).filters;
    assert.equal(returnFilters.vtype ?? "", "", "the saved return context has no violation-type filter");
    intervening();
    returnEvent("u3-return-drill");
    restoredScope();
    assert.equal(ReportsState.S.reportNotice, "Returned from Writer to the saved report context.");
    // The ?return=1 page-load path uses the same helper.
    intervening();
    assert.equal(restoreReportReturn(), true);
    restoredScope();
    assert.equal(ReportsState.S.reportNotice, "Returned to the saved report context.");
    // A relative date mode is recomputed for today rather than restoring stale dates.
    ReportsState.S.dateMode = "month";
    ReportsState.S.F.from = "2020-01-01";
    openInWriter("QA-U3");
    ReportsState.S.dateMode = "fixed";
    returnEvent("u3-return-2");
    assert.equal(ReportsState.S.dateMode, "month");
    assert.equal(ReportsState.S.F.from, iso(new Date()).slice(0, 7) + "-01");
    ReportsState.S.dateMode = "fixed";
    assert.equal(restoreReportReturn(), true);
    assert.equal(ReportsState.S.dateMode, "month");
    assert.equal(ReportsState.S.F.from, iso(new Date()).slice(0, 7) + "-01");
    // A missing, unknown or malformed report context changes nothing; the return is still acknowledged.
    const unchanged = () => ({
      screen: ReportsState.S.screen,
      view: ReportsState.S.view,
      dateMode: ReportsState.S.dateMode,
      F: { ...ReportsState.S.F },
    });
    for (const stored of [JSON.stringify({ report: "no-such-report" }), "{not json", null]) {
      if (stored === null) localStorage.removeItem("madison-report-return-v1");
      else localStorage.setItem("madison-report-return-v1", stored);
      ReportsState.S.view = "table";
      const before = unchanged();
      assert.equal(restoreReportReturn(), false);
      returnEvent("u3-return-unknown");
      assert.deepEqual(unchanged(), before);
      assert.equal(ReportsState.S.reportNotice, "Returned from Writer.");
    }
    console.log("R56 usability phase 3 Reports checks passed");
  };
  eval(payload + "\n(" + reports.toString() + ")().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});");
} else {
  const payload = bundleSource(builtPage());
  const dom = new JSDOM('<!doctype html><html><body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>', {
    url: "http://127.0.0.1:8777/",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  Object.assign(global, {
    window: w,
    document: w.document,
    getSelection: () => w.getSelection(),
    confirm: () => true,
    prompt: () => "",
  });
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = function () {};
  let fetches = 0;
  global.fetch = async () => {
    fetches++;
    throw Error("offline");
  };
  const writer = async () => {
    await new Promise((r) => setTimeout(r, 30));
    saveDrafts = async () => true;
    idbSet = async () => true;
    scheduleDraftSave = () => {};
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const text = (el) => el.textContent.replace(/\s+/g, " ").trim();
    WriterState.HELPER = null;
    WriterState.CASEDIR = null;
    WriterState.PENDING = [];
    WriterState.EVENTS = {};
    WriterState.DOCS = [];
    WriterState.REINSP = [];
    WriterState.RECORD_ATTEMPTS = {};
    const k = kase("k1");
    k.parcel = "070822219105";
    k.date = recordDay(today);
    k.time = "09:00";

    // ITEM 11. Three named scopes: this workspace, shared case records and Accela inspections.
    WriterState.state.screen = "cases";
    WriterState.state.caseQ = "";
    WriterState.state.caseInspector = "";
    WriterState.state.caseFilter = "all";
    render();
    const search = document.getElementById("case-search");
    assert.equal(text(search.closest("label").querySelector(".sr-only")), "Search this workspace");
    assert.equal(search.placeholder, "Search this workspace…");
    assert.equal(text(document.querySelector(".workspace-start [data-global-search]")), "Search shared case records");
    assert.match(text(document.querySelector(".case-count")), /Use Search shared case records for records outside this workspace\./);
    assert.equal(document.querySelector("[data-shared-offer]"), null, "no offer while workspace results are shown");
    WriterState.state.caseQ = "  QA-NOT-HERE-77 ";
    render();
    assert.match(text(document.querySelector(".case-table .empty")), /^No cases match these filters\./);
    const offer = document.querySelector(".case-table .empty [data-shared-offer]");
    assert.equal(text(offer), "Search shared case records for “QA-NOT-HERE-77”");
    assert.equal(document.querySelectorAll("[data-global-search]").length, 1, "the Workspace entry stays the only data-global-search control");
    fetches = 0;
    offer.click();
    await tick();
    const dialog = document.getElementById("utility-dialog");
    assert.ok(dialog, "shared search opens");
    assert.equal(text(dialog.querySelector("h2")), "Search shared case records");
    const query = dialog.querySelector("#global-search-form input[name=query]");
    assert.equal(query.value.trim(), "QA-NOT-HERE-77", "the workspace query is retained");
    assert.equal(text(dialog.querySelector("#global-search-form button[type=submit]")), "Search shared case records");
    assert.equal(dialog.querySelector("#global-search-results").textContent, "", "the shared search is not submitted automatically");
    assert.equal(fetches, 0, "no shared search request until the inspector submits");
    dialog.close?.();
    dialog.remove();
    // An inspector filter alone (no query) offers no shared search.
    WriterState.state.caseQ = "";
    WriterState.state.caseInspector = "no-such-inspector";
    render();
    assert.ok(document.querySelector(".case-table .empty"));
    assert.equal(document.querySelector("[data-shared-offer]"), null);
    WriterState.state.caseInspector = "";
    const lookup = new JSDOM(lookupCard()).window.document;
    assert.equal(text(lookup.querySelector(".lookup-card h2")), "Find Accela inspection");
    assert.equal(text(lookup.querySelector("#lookup-form button[type=submit]")), "Find Accela inspection");
    assert.equal(text(lookup.querySelector("#lookup-form label span")), "Case number");

    // ITEM 12. Writer's Reports entry: Back to Reports with a return context, otherwise Open Reports in a new tab.
    WriterState.REPORT_RETURN = null;
    render();
    const reportsLink = document.querySelector('.writer-navigation a.rail-item[href="madison-reports.html"]');
    assert.equal(reportsLink.getAttribute("aria-label"), "Open Reports (opens in a new tab)");
    assert.equal(text(reportsLink.querySelector("span:not(.nav-external)")), "Open Reports");
    WriterState.REPORT_RETURN = { request: "u3" };
    render();
    assert.equal(text(document.querySelector(".writer-navigation [data-report-return]")), "Back to Reports");
    assert.equal(document.querySelector('.writer-navigation a[href="madison-reports.html"]'), null);
    WriterState.REPORT_RETURN = null;

    // ITEM 15. Tools: everyday settings first, specialist tools in a collapsed Administrator tools group.
    WriterState.state.screen = "tools";
    render();
    const sections = [...document.querySelectorAll(".tools-section")];
    const admin = document.querySelector(".tools-section.tools-admin > details[data-tools-admin]");
    assert.ok(admin, "Administrator tools group");
    assert.equal(admin.open, false, "collapsed by default");
    assert.equal(text(admin.querySelector("summary")), "Administrator tools");
    assert.equal(sections[sections.length - 1], admin.parentElement, "after the everyday settings");
    assert.match(text(admin.querySelector(".hint")), /existing administrator checks; this grouping does not grant authorization/);
    for (const [selector, label] of [
      ['[data-language-mode="admin"]', "Review catalog"],
      ["[data-admin-deposit]", "Administrator deposit override"],
      ["[data-admin-snow-letter]", "Review snow-letter content"],
    ]) {
      assert.equal(document.querySelectorAll(selector).length, 1, selector);
      assert.ok(admin.contains(document.querySelector(selector)), selector + " is inside Administrator tools");
      assert.equal(text(document.querySelector(selector + " strong")), label);
    }
    for (const selector of [
      "[data-global-search]",
      "[data-reminders]",
      "[data-batch-due]",
      ".tool-action[data-sync-safety]",
      "[data-openfile]",
      "[data-a11y-theme]",
    ])
      assert.equal(admin.contains(document.querySelector(selector)), false, selector + " stays with everyday tools");
    assert.equal(document.querySelectorAll(".tools-section .tool-action").length, 10);
    assert.equal(
      sections.map((s) => text(s.querySelector("h2, summary"))).join(" | "),
      "Cases & planning | Saved work & connection | Program instructions | Display & help | Administrator tools",
    );

    // ITEM 15. Language modes: Browse language, Review catalog, and Select for this notice in the picker.
    WriterState.state.screen = "library";
    WriterState.state.languageMode = "browse";
    render();
    assert.equal(text(document.querySelector(".topbar h1")), "Browse language");
    assert.equal(text(document.querySelector('.topbar [data-language-mode="admin"]')), "Review catalog");
    assert.ok(document.getElementById("lib-filter"), "the existing language search is reused");
    WriterState.state.languageMode = "admin";
    render();
    assert.equal(text(document.querySelector(".topbar h1")), "Review catalog");
    assert.equal(text(document.querySelector('.topbar [data-language-mode="browse"]')), "Browse language");
    assert.ok(document.getElementById("catalog-filter"));
    WriterState.state.languageMode = "browse";

    // ITEM 14. Narrow-screen editor task bar (structure; layout in browser_r42).
    newDoc(k.id, "notice");
    const d = doc(WriterState.state.docId);
    d.items = [{ id: "u3-a", no: "1", title: "Wall repair", text: "Repair ( ) on the wall.", sections: ["27.05(2)(c)"], due: "", cite: false }];
    render();
    assert.equal(text(document.querySelector(".editor-sections #btn-add-top")), "Violation Items");
    WriterState.state.picker = true;
    render();
    const picker = document.querySelector(".picker-box");
    assert.equal(text(picker.querySelector(".picker-h h2")), "Select for this notice");
    assert.equal(picker.getAttribute("aria-label"), "Select for this notice");
    assert.ok(document.getElementById("pk-q"), "the picker keeps the shared language search");
    WriterState.state.picker = false;
    render();
    const bars = document.querySelectorAll(".document-workspace > .editor-mobile-bar");
    assert.equal(bars.length, 1, "one task bar");
    let bar = bars[0];
    assert.ok(bar.classList.contains("no-print"));
    assert.equal(bar.getAttribute("role"), "region");
    assert.equal(bar.getAttribute("aria-label"), "Document task actions");
    assert.equal(bar.querySelector("[data-document-device-save]").textContent, localSaveText(app_savedworkContext()));
    let ready = editorReadiness(d);
    assert.ok(ready.required.length > 0);
    const next = bar.querySelector("[data-mobile-next]");
    assert.equal(text(next), "Next required field");
    assert.equal(
      next.dataset.checkIndex,
      document.querySelector(".editor-readiness [data-readiness-first]").dataset.checkIndex,
      "same field as Go to first required field",
    );
    assert.equal(text(bar.querySelector("[data-mobile-review]")), "Review");
    const barPrimary = bar.querySelector("[data-mobile-primary]");
    assert.equal(text(barPrimary), text(document.querySelector(".topbar .editor-primary")));
    assert.equal(
      bar.querySelectorAll(".editor-primary,#btn-final,[data-readiness-first],[data-editor-section],[data-editor-review]").length,
      0,
      "no duplicate ids or toolbar hooks",
    );
    let clicked = 0;
    document.querySelector(".topbar .editor-primary").addEventListener("click", (e) => {
      clicked++;
      e.stopImmediatePropagation();
    });
    barPrimary.click();
    assert.equal(clicked, 1, "the bar's primary action runs the toolbar's own button");
    bar.querySelector("[data-mobile-review]").click();
    assert.equal(WriterState.state.modal, "review", "the bar's Review opens the Review dialog");
    assert.ok(document.querySelector("#overlay [data-review-dialog]").contains(document.activeElement));
    WriterState.state.modal = null;
    render();
    bar = document.querySelector(".document-workspace > .editor-mobile-bar");
    // Save state is mirrored, including an unsaved state.
    WriterState.LOCAL_SAVE.ok = false;
    updateSaveStatus();
    assert.match(bar.querySelector("[data-document-device-save]").textContent, /^Not saved/);
    WriterState.LOCAL_SAVE.ok = true;
    updateSaveStatus();
    // The bar follows readiness without a full render.
    d.items[0].text = "Repair the wall.";
    d.items[0].due = addDays(recordDay(today), 21);
    editorSync();
    ready = editorReadiness(d);
    assert.equal(!!document.querySelector(".editor-mobile-bar [data-mobile-next]"), ready.required.length > 0);
    assert.equal(text(document.querySelector("[data-mobile-primary]")), text(document.querySelector(".topbar .editor-primary")));

    // ITEM 13. Reinspection: two named modes, a step indicator from walk state, tips collapsed.
    WriterState.DOCS.length = 0;
    WriterState.REINSP.length = 0;
    WriterState.state.riWalk = false;
    WriterState.state.riWalkItem = null;
    WriterState.state.riWalkUndo = null;
    WriterState.state.riFilter = "";
    WriterState.state.riWalkMode = "quick";
    newDoc("k1", "notice");
    const n = doc(WriterState.state.docId);
    n.items = Array.from({ length: 3 }, (_, i) => ({
      id: uid("u3walk"),
      no: String(i + 1),
      sections: ["27.05(2)(c)"],
      title: "Walk item " + (i + 1),
      text: "Inspect condition " + (i + 1),
      due: futureDue(iso(today), 21),
      prov: "notice",
      done: false,
      doneOn: "",
    }));
    issueDocument(n);
    startReinspection("k1");
    const r = reinsp(WriterState.state.reinspId);
    r.time = "10:00";
    WriterState.state.screen = "reinspect";
    render();
    const mode = (value) => document.querySelector('.ri-walk-modes [data-riwalk="' + value + '"]');
    const current = () => [...document.querySelectorAll('.ri-walk-steps li[aria-current="step"]')].map((li) => li.dataset.walkStep);
    assert.equal(text(mode("off")), "Review all items");
    assert.equal(text(mode("on")), "One item at a time");
    assert.equal(mode("off").getAttribute("aria-pressed"), "true");
    assert.equal(mode("on").getAttribute("aria-pressed"), "false");
    assert.doesNotMatch(document.body.textContent, /Start walk-through|Review all items \(pause\)/);
    assert.equal(document.querySelector(".ri-walk-steps"), null, "no steps while reviewing all items");
    const tips = document.querySelector(".ri-walk-panel details.ri-walk-tips");
    assert.equal(tips.open, false, "tips are collapsed");
    assert.equal(text(tips.querySelector("summary")), "Keyboard shortcuts and tips");
    assert.equal(
      [...tips.querySelectorAll("kbd")]
        .map((k) => k.nextSibling.textContent.replace(/[·.]/g, "").trim())
        .slice(0, 4)
        .join("|"),
      OUTCOMES.map((o) => o.label).join("|"),
      "tips use the OUTCOMES labels",
    );
    assert.deepEqual(
      [...document.querySelectorAll("#ri-walk-mode option")].map((o) => o.textContent),
      ["Go to next unanswered item", "Complete details first"],
    );
    mode("off").click();
    assert.equal(WriterState.state.riWalk, false, "choosing the current mode changes nothing");
    mode("on").click();
    assert.equal(WriterState.state.riWalk, true);
    assert.equal(mode("on").getAttribute("aria-pressed"), "true");
    assert.equal(mode("off").getAttribute("aria-pressed"), "false");
    assert.deepEqual(
      [...document.querySelectorAll(".ri-walk-steps li")].map((li) => text(li)),
      ["Record the outcome", "Complete required details", "Continue to the next item", "Review the inspection and permitted follow-up"],
    );
    assert.deepEqual(current(), ["1"]);
    assert.equal(Object.keys(r.results).length, 0, "starting one item at a time records no outcome");
    const first = WriterState.state.riWalkItem;
    mode("on").click();
    assert.equal(WriterState.state.riWalkItem, first, "choosing the current mode does not restart");
    // Complete details first: an extension follow-up needs a new due date before the item is ready.
    const select = document.getElementById("ri-walk-mode");
    select.value = "details";
    select.dispatchEvent(new w.Event("change", { bubbles: true }));
    r.followupIntent = "extension";
    document.querySelector('[data-setoc="progress"][data-item="' + first + '"]').click();
    assert.equal(r.results[first].oc, "progress");
    assert.equal(WriterState.state.riWalkStage, "details");
    render();
    assert.equal(walkItemReady(r, first), false);
    assert.deepEqual(current(), ["2"]);
    r.results[first].due = futureDue(iso(today), 30);
    render();
    assert.equal(walkItemReady(r, first), true);
    assert.deepEqual(current(), ["3"]);
    document.querySelector("[data-riwalk-next]").click();
    assert.deepEqual(current(), ["1"]);
    assert.notEqual(WriterState.state.riWalkItem, first);
    assert.equal(Object.keys(r.results).length, 1, "moving on records nothing for the next item");
    r.followupIntent = undefined;
    select.value = "quick";
    document.getElementById("ri-walk-mode").value = "quick";
    document.getElementById("ri-walk-mode").dispatchEvent(new w.Event("change", { bubbles: true }));
    while (WriterState.state.riWalkItem) document.querySelector('[data-setoc="corrected"][data-item="' + WriterState.state.riWalkItem + '"]').click();
    assert.deepEqual(current(), ["4"]);
    assert.match(text(document.querySelector(".ri-walk-panel")), /All items have a result/);
    mode("off").click();
    assert.equal(WriterState.state.riWalk, false);
    assert.ok(document.querySelector('[data-rifilter="corrected"]:not([disabled])'), "all-items filters return");
    assert.equal(document.querySelector(".ri-walk-steps"), null);

    // Shortcut sheet labels match OUTCOMES.
    A11Y.shortcuts();
    const sheet = document.getElementById("utility-dialog");
    const row = [...sheet.querySelectorAll("tr")].find((tr) => text(tr.querySelector("th")) === "1 / 2 / 3 / 4");
    assert.equal(text(row.querySelector("td")), "One item at a time: " + OUTCOMES.map((o) => o.label).join(" / "));
    console.log("R56 usability phase 3 Writer checks passed");
  };
  eval(
    payload +
      "\n(" +
      writer.toString() +
      ")().then(()=>{const r=spawnSync(process.execPath,[__filename,'reports'],{stdio:'inherit'});process.exit(r.status)}).catch(e=>{console.error(e);process.exit(1)});",
  );
}
