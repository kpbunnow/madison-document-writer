/* R56 usability phase 1: conditional Inspection section, special check links, save and removal wording,
   workspace quick views with More views, Done-only Recipients, grouped recovery and report export labels. */
globalThis.MADISON_TEST_DATA = true;
const assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const payload = bundleSource(builtPage()),
  reportsSource = bundleSource(builtPage("reports"));
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
window.HTMLElement.prototype.scrollIntoView = function () {};
global.fetch = async () => {
  throw Error("offline");
};
global.REPORTS_SOURCE = reportsSource;
const test = async () => {
  await new Promise((r) => setTimeout(r, 30));
  saveDrafts = async () => true;
  idbSet = async () => true;
  const toasts = [];
  const originalToast = toast;
  toast = (message, options) => {
    toasts.push(String(message));
    return originalToast(message, options);
  };
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

  // 1. An ordinary draft notice has no empty Inspection section; its fields stay on the working document.
  newDoc(k.id, "notice");
  const d = doc(WriterState.state.docId);
  d.items = [{ id: "u1-item", no: "1", title: "Wall repair", text: "Repair the wall.", sections: ["27.05(2)(c)"], due: "", cite: false }];
  render();
  const app = document.getElementById("app");
  assert.equal(document.getElementById("editor-inspection"), null, "no Inspection section for an ordinary draft notice");
  assert.ok(!app.textContent.includes("Edit inspection, property and mailing details"));
  assert.ok(document.getElementById("editor-items") && document.getElementById("editor-review"));
  assert.ok(app.querySelector('.desk [data-case="ownerBlock"]'), "mailing details remain editable on the working document");
  const ownerAddr = docCase(d).ownerAddr;
  docCase(d).ownerAddr = [];
  render();
  const mailing = checks(d).find((c) => !c.ok && c.targets?.some((t) => t.selector === '[data-case="ownerBlock"]'));
  assert.ok(mailing, "an empty mailing block is a linked check");
  focusCheckTarget(mailing.targets[0], mailing.t);
  assert.ok(document.activeElement.matches('.desk [data-case="ownerBlock"]'), "mailing check link reaches the working document");
  docCase(d).ownerAddr = ownerAddr;
  render();

  // 2. Save labels match the device-save-and-return handler.
  const save = document.getElementById("btn-save");
  assert.equal(save.textContent, "Save draft & return to Workspace");
  WriterState.state.modal = "cc";
  render();
  assert.equal(document.querySelectorAll(".modal #btn-savework,.modal #btn-save").length, 0, "Recipients has no save-and-exit button");
  const modalButtons = [...document.querySelectorAll(".modal .modal-f button")];
  assert.deepEqual(
    modalButtons.map((b) => b.textContent),
    ["Done"],
  );
  k.ccList = [{ name: "Copy", addr: "Main Street", city: "Madison, WI 53703" }];
  render();
  document.querySelector('.modal [data-close="modal"]').click();
  assert.equal(WriterState.state.modal, "cc", "Done with an invalid copy address keeps Recipients open");
  k.ccList = [];
  WriterState.state.modal = null;
  render();
  document.getElementById("btn-save").click();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(WriterState.state.screen, "cases", "Save draft returns to Workspace");
  assert.ok(toasts.at(-1).includes("Work saved on this device"), "Save draft saves on this device");
  assert.ok(doc(d.id)?.draft, "saving a draft does not issue it");

  // 1b. The section appears when it has something to act on: special-document details or a correction.
  WriterState.state.screen = "write";
  WriterState.state.docId = d.id;
  d.type = "bestInterestExtension";
  d.authoringVersion = DATED_EXTENSIONS;
  d.special = {};
  d.items = [
    { id: "u1-a", no: "1", title: "Porch", text: "Repair the porch.", sections: ["27.05(2)(c)"], due: addDays(recordDay(today), 10) },
    { id: "u1-b", no: "2", title: "Gutter", text: "Repair the gutter.", sections: ["27.05(2)(c)"], due: addDays(recordDay(today), 10) },
  ];
  render();
  assert.ok(document.querySelector("#editor-inspection #r26-details"), "Best Interest details render in the Inspection section");
  const affected = checks(d).find((c) => c.t === "Select at least one outstanding affected item." && !c.ok);
  assert.ok(affected, "affected-item check fails with nothing selected");
  assert.equal(affected.targets.length, 1);
  const before = toasts.length;
  focusCheckTarget(affected.targets[0], affected.t);
  // Phase 2: authoring-13 drafts select affected items in the items table, beside each due date.
  assert.ok(document.activeElement.matches(".desk [data-special-item]"), "affected check focuses the first row Affected checkbox");
  assert.equal(document.activeElement.dataset.specialItem, "1");
  assert.equal(toasts.length, before, "no fallback toast for the affected check");
  // Every failing special check that names a target resolves to a real element.
  for (const type of ["bestInterestExtension", "vacancyExtension", "summaryAbatement", "nonSummaryAbatement", "noOccupancy"]) {
    d.type = type;
    // Authoring-13 Vacancy Extensions are always dated (requireDated at creation and on every edit).
    d.special = type === "vacancyExtension" ? { deadlineMode: "dated" } : {};
    render();
    assert.ok(document.querySelector("#editor-inspection #r26-details"), type + ": details in Inspection");
    for (const c of newDocuments.specialChecks(d).filter((x) => !x.ok))
      for (const target of c.targets) assert.ok(document.querySelector(target.selector), type + ": " + c.t + " → " + target.selector);
  }
  // Authoring-13 later due dates are entered in Items and due dates; the check links those fields.
  d.type = "bestInterestExtension";
  d.special = { affected: ["1"], originalDues: { 1: addDays(recordDay(today), 10), 2: addDays(recordDay(today), 10) } };
  render();
  const later = newDocuments.specialChecks(d).find((c) => !c.ok && /later future due date/.test(c.t));
  assert.ok(later);
  assert.deepEqual(
    later.targets.map((t) => t.selector),
    [itemSelector("u1-a", "due")],
  );
  focusCheckTarget(later.targets[0], later.t);
  assert.equal(document.activeElement.dataset.field, "due");
  assert.equal(document.activeElement.dataset.id, "u1-a");
  // Vacancy uses the same affected-item target.
  d.type = "vacancyExtension";
  d.special = { deadlineMode: "dated" };
  render();
  const vacancy = checks(d).find((c) => c.t === "Select at least one outstanding affected item.");
  focusCheckTarget(vacancy.targets[0], vacancy.t);
  assert.ok(document.activeElement.matches(".desk [data-special-item]"));
  // A correction draft keeps the section for its correction panel.
  d.type = "notice";
  delete d.special;
  d.correction = {
    targetId: "u1-issued-source",
    reason: "",
    case: clone(docCase(d)),
    caseBaseline: caseDetails(k),
    body: docBody(d),
    blocks: clone(docBlocks(d)),
    updateCase: true,
    externalReference: "",
    reviewed: false,
    outcomes: {},
    actionDate: recordDay(today),
  };
  render();
  assert.ok(document.querySelector("#editor-inspection .correction-panel"), "correction panel keeps the Inspection section");
  delete d.correction;

  // 2b. Issued-document actions: shared case save and PDF filing.
  d.draft = false;
  d.status = "Final";
  d.mailed = recordDay(today);
  d.frozen = freezeSources(d);
  render();
  assert.equal(document.querySelector("#btn-savecase").textContent, "Save case to shared folder");
  assert.equal(document.querySelector(".editor-primary").textContent, "File issued PDF");
  assert.equal(document.querySelector(".editor-primary").getAttribute("data-editor-command"), "btn-retryfiling");
  assert.equal(document.getElementById("btn-save"), null);
  const shared = savedCaseState(app_savedworkContext(), k, true);
  WriterState.PENDING = [{ cid: k.id, name: caseFileName(k), body: "{}" }];
  assert.equal(savedCaseState(app_savedworkContext(), k, true).label, "Save case to shared folder");
  assert.equal(savedCaseState(app_savedworkContext(), k, false).label, "Connect shared folder");
  WriterState.PENDING = [];
  assert.ok(shared.label);

  // 5. Backups and recovery: two labelled groups with all original controls.
  const work = document.createElement("div");
  work.innerHTML = savedWorkHTML(app_savedworkContext(), "", {});
  const device = work.querySelector('[data-saved-detail="recovery"] [data-recovery-group="device"]'),
    workspace = work.querySelector('[data-saved-detail="recovery"] [data-recovery-group="workspace"]');
  assert.equal(device.querySelector("h4").textContent, "Recovery on this device");
  assert.equal(device.getAttribute("aria-labelledby"), device.querySelector("h4").id);
  assert.ok(device.querySelector("#btn-recovery") && device.querySelector("#saved-recovery-status"));
  assert.equal(device.querySelector("[data-safety-backup]").textContent, "Create recovery copy on this device");
  assert.ok(device.textContent.includes("does not issue a document or save to the shared folder"));
  assert.equal(workspace.querySelector("h4").textContent, "Download or restore a workspace");
  assert.equal(workspace.querySelector("#btn-workbackup").textContent, "Download workspace backup");
  assert.equal(workspace.querySelector("#btn-workrestore").textContent, "Restore workspace backup");
  assert.ok(workspace.textContent.includes("requires an empty workspace"));
  assert.ok(!work.innerHTML.includes("Back up unfinished work now"));

  // 3. Workspace quick views and More views.
  WriterState.DOCS = WriterState.DOCS.filter((x) => x.caseId !== k.id);
  WriterState.CASES = [];
  for (let n = 0; n < 6; n++) {
    const c = { id: "u1-case-" + n, number: "U1-" + n, address: n + " SAMPLE ST", owner: "SYNTHETIC", inspectorId: n % 2 ? "i4" : "i1" };
    c.date = recordDay(today);
    WriterState.CASES.push(c);
    WriterState.DOCS.push({
      id: "u1-doc-" + n,
      caseId: c.id,
      type: "notice",
      created: recordDay(today),
      mailed: recordDay(today),
      draft: false,
      status: "Final",
      filedAt: "filed",
      filedArtifact: { filename: n + ".pdf", sha256: "a".repeat(64) },
      cits: {},
      items: [
        { id: "u1-i" + n, no: "1", title: "Repair", text: "Repair.", sections: ["27.05(2)(c)"], due: addDays(recordDay(today), n < 2 ? -2 : 30) },
      ],
    });
    WriterState.ARTIFACT_LOCATIONS["u1-doc-" + n] = ["shared"];
  }
  WriterState.state = { ...WriterState.state, screen: "cases", caseFilter: "attention", caseQ: "", caseInspector: "", metric: "", modal: null };
  render();
  const quick = () => [...document.querySelectorAll("[data-queue-view]")];
  assert.deepEqual(
    quick().map((b) => b.querySelector("span").textContent),
    ["Needs attention", "Continue work", "Deadlines", "Needs resolution", "All cases"],
  );
  assert.equal(document.querySelector('[data-queue-view="attention"]').getAttribute("aria-pressed"), "true");
  const resolution = document.querySelector('[data-queue-view="resolution"]');
  const description = document.getElementById(resolution.getAttribute("aria-describedby"));
  assert.ok(/unconfirmed or queued saves, PDF filing and transfers, record problems/.test(description.textContent));
  assert.ok(
    document
      .querySelector(".queue-view-note")
      .textContent.includes("Device save and connection problems appear in the Saved work & connection banner."),
  );
  const select = document.getElementById("case-filter");
  assert.equal(select.getAttribute("aria-label"), "More views");
  assert.equal(select.value, "");
  assert.equal(select.options[0].textContent, "More views…");
  assert.deepEqual(
    [...select.options].slice(1).map((o) => o.value),
    ["soon", "overdue", "open", "closed"],
  );
  const shown = () => document.querySelectorAll("[data-queue-case]").length;
  for (const key of quick().map((b) => b.dataset.queueView)) {
    document.querySelector(`[data-queue-view="${key}"]`).click();
    const button = document.querySelector(`[data-queue-view="${key}"]`);
    assert.equal(WriterState.state.caseFilter, key);
    assert.equal(button.getAttribute("aria-pressed"), "true");
    assert.equal(document.activeElement, button, "focus stays on the chosen quick view");
    assert.equal(Number(button.querySelector("strong").textContent), shown(), key + " count matches its rows");
    assert.equal(document.getElementById("case-filter").value, "");
  }
  // Extra views stay reachable; search and inspector filters remain applied when switching.
  WriterState.state.caseInspector = "i4";
  render();
  for (const value of ["soon", "overdue", "open", "closed"]) {
    const sel = document.getElementById("case-filter");
    const label = [...sel.options].find((o) => o.value === value).textContent;
    sel.value = value;
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(WriterState.state.caseFilter, value);
    assert.equal(document.getElementById("case-filter").value, value, "More views shows the active extra view");
    assert.equal(document.querySelectorAll('[data-queue-view][aria-pressed="true"]').length, 0);
    assert.equal(WriterState.state.caseInspector, "i4", "inspector filter kept");
    assert.equal(document.getElementById("case-inspector").value, "i4");
    assert.equal(
      shown(),
      WriterState.CASES.filter(
        (c) =>
          c.inspectorId === "i4" &&
          queueMatches(
            workspaceQueue([{ k: c, st: caseState(c) }], workspaceTasks([{ k: c, st: caseState(c) }]), app_workspacequeueContext())[0],
            value,
          ),
      ).length,
    );
    const total = Number(/\((\d+)\)$/.exec(label)[1]);
    WriterState.state.caseInspector = "";
    render();
    assert.equal(shown(), total, value + " count matches its rows");
    WriterState.state.caseInspector = "i4";
    render();
  }
  WriterState.state.caseInspector = "";
  WriterState.state.caseQ = "U1-1";
  WriterState.state.caseFilter = "overdue";
  render();
  assert.equal(document.getElementById("case-search").value, "U1-1");
  assert.equal(shown(), 1, "workspace search still applies");
  const sel = document.getElementById("case-filter");
  sel.value = "";
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  assert.equal(WriterState.state.caseFilter, "attention", "More views placeholder returns to Needs attention");
  assert.equal(WriterState.state.caseQ, "U1-1", "search kept");
  WriterState.state.caseQ = "";

  // 7. Labels: remove from this workspace, and Import inspection.
  render();
  assert.equal(document.getElementById("btn-clear").textContent, "Remove cases from this workspace");
  assert.ok([...document.querySelectorAll("[data-rmcase]")].every((b) => b.textContent === "Remove from this workspace"));
  WriterState.state.modal = "clear";
  WriterState.CASES[0].savedAt = "";
  render();
  const modal = document.querySelector(".modal");
  assert.equal(modal.querySelector("h2").textContent, "Remove cases from this workspace");
  assert.ok(modal.textContent.includes("does not delete its shared case record"));
  assert.ok(/^Remove the \d+ safe cases?$/.test(modal.querySelector('[data-clearcases="safe"]')?.textContent || "Remove the 0 safe cases"));
  assert.equal(modal.querySelector('[data-clearcases="all"]').textContent, "Remove all " + WriterState.CASES.length + ", losing that unsaved work");
  WriterState.state.modal = null;
  // A refused removal keeps the case and its refusal message.
  WriterState.RECORD_ATTEMPTS.u1 = { cid: "u1-case-5", recordKey: "u1" };
  global.confirm = () => true;
  render();
  document.querySelector('[data-rmcase="u1-case-5"]').click();
  assert.ok(kase("u1-case-5").id, "pending record save refuses removal");
  assert.equal(toasts.at(-1), "Confirm pending record saves before removing this case from this workspace.");
  WriterState.RECORD_ATTEMPTS = {};
  let asked = "";
  global.confirm = (text) => {
    asked = text;
    return true;
  };
  WriterState.DOCS.push({ id: "u1-draft", caseId: "u1-case-4", type: "notice", draft: true, items: [], cits: {} });
  render();
  document.querySelector('[data-rmcase="u1-case-4"]').click();
  assert.ok(asked.includes("Removing it from this workspace loses that work. The shared case record is not deleted."), asked);
  assert.ok(!WriterState.CASES.some((c) => c.id === "u1-case-4"));
  assert.equal(toasts.at(-1), "U1-4 removed from this workspace. The shared case record is not deleted.");
  clearCases("all");
  assert.ok(/^\d+ cases? removed from this workspace\. Shared case records are not deleted\.$/.test(toasts.at(-1)), toasts.at(-1));
  render();
  assert.ok(document.querySelector('.empty-state [data-nav="import"]').textContent === "Import inspection");
  WriterState.state.screen = "import";
  render();
  assert.equal(document.querySelector("h1").textContent, "Import inspection");
  assert.equal(document.getElementById("btn-savework").textContent, "Save draft & return to Workspace");

  // 6. Reports export labels and an accurate note (Reports bundle source).
  // The bundler escapes non-ASCII characters; decode them before comparing.
  const R = globalThis.REPORTS_SOURCE.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  assert.ok(R.includes("Current report — CSV") && R.includes("Reports workbook — Excel"));
  assert.ok(!R.includes("Export this report CSV") && !R.includes(">Export to Excel<"));
  assert.ok(R.includes("The CSV contains exactly the rows and columns of this table, with its filters, dates and sort."));
  assert.ok(R.includes("This report’s sheet keeps the table sort"));
  console.log(
    "PASS usability phase 1: conditional Inspection section, special check links, save labels, quick views with More views, " +
      "Done-only Recipients, recovery groups, remove-from-workspace wording, Import inspection and report export labels",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
