/* Phase seven: catalog truth, private draft identity, and asynchronous isolation. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8");
const payload = Buffer.from(/var B="([A-Za-z0-9+\/=]+)"/.exec(html)[1], "base64").toString("utf8");
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div><div id="overlay"></div><div id="toast"></div></body></html>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
const w = dom.window;
Object.assign(global, {
  window: w,
  document: w.document,
  localStorage: w.localStorage,
  confirm: () => true,
  prompt: () => "",
  getSelection: () => w.getSelection(),
});
w.scrollTo = () => {};
w.HTMLElement.prototype.scrollIntoView = function () {};
const test = async () => {
  await new Promise((r) => setTimeout(r, 50));
  scheduleDraftSave = () => {};
  idbSet = async () => true;
  render = () => {};
  let count = 0;
  const ok = (label, value) => {
    assert.ok(value, label);
    console.log("PASS " + label);
    count++;
  };
  const items = allItems(),
    a = items.find((i) => i.catalogId === "EXT15"),
    other = items.find((i) => i.catalogId === "STR06"),
    key = catalogKey(a),
    old = items.find((i) => i.p !== "draft" && i.s.length);
  const event = (version, extra = {}) => ({
    id: "r47-v" + version,
    key,
    version,
    status: "approved",
    at: nowISO(),
    reviewer: "SYNTHETIC QA",
    source: "Synthetic test only",
    wording: a.a,
    ordinances: a.s,
    ...extra,
  });
  WriterState.CATALOG_EVENTS = [];
  WriterState.CATALOG_VERIFIED = true;
  WriterState.state.screen = "library";
  WriterState.state.languageMode = "browse";
  WriterState.state.libStatus = "approved";
  WriterState.state.libFilter = "";
  WriterState.state.libCl = -1;
  ok("No bundled approval is inferred", !screenLibrary().includes("data-language-key=") && screenLibrary().includes("No approved language matches"));
  WriterState.CATALOG_EVENTS = [event(1)];
  let shown = screenLibrary();
  ok(
    "Approved default excludes proposed entries and admin forms",
    shown.includes('data-language-key="' + esc(key) + '"') && !shown.includes("data-catalog-save=") && !shown.includes(other.t),
  );
  for (const query of ["garbage", "rubbish", "27.05(2)(c)", "exterior trash"]) {
    WriterState.state.libFilter = query;
    ok("Universal ordinary/synonym/ordinance query " + query, screenLibrary().includes('data-language-key="' + esc(key) + '"'));
  }
  WriterState.state.libFilter = "";
  WriterState.state.libStatus = "usable";
  ok("Standard sources remain explicitly available and truthfully labeled", screenLibrary().includes("formal approval not recorded"));
  WriterState.state.libStatus = "review";
  ok(
    "Needs review exposes proposed without claiming approval",
    screenLibrary().includes(other.t) && !screenLibrary().includes('data-language-key="' + esc(key) + '"'),
  );
  WriterState.CATALOG_EVENTS = [];
  WriterState.CATALOG_VERIFIED = false;
  WriterState.state.libStatus = "approved";
  ok("Unverified sources cannot appear approved", !screenLibrary().includes("data-language-key="));
  WriterState.CATALOG_VERIFIED = true;
  WriterState.CATALOG_EVENTS = [event(1)];
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  toggleLibraryItem(d, a.ci, a.gi, catalogSelection(a));
  Object.assign(d.items[0], {
    text: "PRIVATE REPAIR DETAIL",
    sections: ["PRIVATE 77"],
    due: addDays(recordDay(today), 25),
    abate: true,
    group: "North wall",
    note: "PRIVATE NOTE",
  });
  const privateItem = clone(d.items[0]);
  for (let n = 0; n < 3; n++) {
    toggleLibraryItem(d, a.ci, a.gi, catalogSelection(a));
    ok("Deselection removes exactly once " + n, d.items.length === 0);
    toggleLibraryItem(d, a.ci, a.gi, catalogSelection(a));
    assert.deepEqual(d.items[0], privateItem);
  }
  ok("Reselection retains identity, wording, ordinance, date, location and note", d.items.length === 1);
  WriterState.state.screen = "write";
  WriterState.state.picker = true;
  WriterState.state.cl = -1;
  WriterState.state.q = "";
  WriterState.state.pickerStatus = "approved";
  let picker = pickerHTML();
  ok(
    "Exact selected count and checked identity",
    picker.includes("1 selected from library") && picker.includes('aria-pressed="true"') && picker.includes("PRIVATE REPAIR DETAIL"),
  );
  WriterState.CATALOG_EVENTS.push(event(2, { wording: "SECOND SYNTHETIC REVIEW" }));
  ok("New approval blocks stale draft without rewriting edits", catalogDraftBlocked(d.items[0]) && d.items[0].text === "PRIVATE REPAIR DETAIL");
  toggleLibraryItem(d, a.ci, a.gi, catalogSelection(a));
  toggleLibraryItem(d, a.ci, a.gi, catalogSelection(a));
  assert.deepEqual(d.items[0], privateItem);
  ok("New review does not replace cached private draft", d.items[0].catalogReviewId === "r47-v1");
  toggleLibraryItem(d, a.ci, a.gi, catalogSelection(a));
  const backup = draftBundle();
  ok("Device bundle retains selection cache", backup.docs.find((x) => x.id === d.id).selectionCache[privateItem.libraryKey].id === privateItem.id);
  toggleLibraryItem(d, a.ci, a.gi, catalogSelection(a));
  ok(
    "Explicit adoption retains item identity",
    adoptCatalogReview(d, d.items[0]) && d.items[0].id === privateItem.id && d.items[0].text === "SECOND SYNTHETIC REVIEW",
  );
  issueDocument(d);
  const issued = doc(d.id),
    before = JSON.stringify(issued),
    body = docBody(issued);
  WriterState.CATALOG_EVENTS.push(event(3, { wording: "THIRD SYNTHETIC REVIEW" }));
  ok("Catalog update cannot rewrite issued snapshot", JSON.stringify(issued) === before && docBody(issued) === body);
  WriterState.CATALOG_EVENTS.push(event(4, { status: "retired" }));
  ok("Retired approval is unavailable", catalogStatus(a).code === "retired" && !catalogVisible(a, "approved"));
  WriterState.CATALOG_EVENTS.push({
    id: "r47-replacement",
    key: catalogKey(other),
    version: 1,
    status: "approved",
    at: nowISO(),
    wording: other.a,
    ordinances: other.s,
    replaces: catalogKey(old),
  });
  WriterState.state.screen = "library";
  WriterState.state.languageMode = "browse";
  WriterState.state.libStatus = "all";
  WriterState.state.libFilter = old.t;
  shown = screenLibrary();
  ok(
    "Replacement has human title and deliberate discovery path",
    shown.includes("Preferred entry:") && shown.includes(other.t) && shown.includes("Find approved replacement"),
  );
  WriterState.state.languageMode = "admin";
  WriterState.state.catalogAdminKey = key;
  WriterState.state.catalogAdminStatus = "all";
  WriterState.state.catalogAdminQ = "";
  WriterState.CATALOG_FORMS[key] = { ...catalogForm(key, a, catalogReview(key)), reviewer: "UNSUBMITTED REVIEWER", open: true };
  shown = screenLibrary();
  ok(
    "Administration is one dedicated selected review form",
    shown.includes("UNSUBMITTED REVIEWER") && (shown.match(/data-catalog-save=/g) || []).length === 2,
  );
  let reads = [];
  helperJSON = () => new Promise((resolve) => reads.push(resolve));
  const first = refreshCatalog(),
    second = refreshCatalog();
  reads[1]({ events: [event(6)] });
  await second;
  reads[0]({ events: [event(5)] });
  await first;
  ok("Late earlier read cannot roll back current catalog", catalogReview(key).version === 6);
  reads = [];
  const pending = refreshCatalog();
  WriterState.CATALOG_EVENTS = [event(7)];
  reads[0]({ events: [event(6)] });
  await pending;
  ok("Read begun before acknowledgement cannot erase it", catalogReview(key).version === 7);
  helperJSON = async () => {
    throw Error("synthetic share unavailable");
  };
  ok(
    "Unavailable share reports failure and retains last-known approval",
    !(await refreshCatalog()) && catalogReview(key).version === 7 && WriterState.CATALOG_ERROR.includes("Last verified"),
  );
  WriterState.CATALOG_EVENTS = [];
  WriterState.CATALOG_VERIFIED = false;
  await refreshCatalog();
  ok("Unavailable share cannot approve proposed wording", catalogStatus(other).code === "unknown" && !catalogVisible(other, "approved"));
  WriterState.CATALOG_VERIFIED = true;
  WriterState.CATALOG_EVENTS = [event(1)];
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  newDoc("k1", "notice");
  const abandoned = doc(WriterState.state.docId);
  WriterState.state.screen = "write";
  WriterState.state.picker = true;
  reads = [];
  helperJSON = () => new Promise((resolve) => reads.push(resolve));
  const b = document.createElement("button");
  b.dataset.pick = a.ci + ":" + a.gi + ":" + a.o;
  document.body.appendChild(b);
  b.click();
  await new Promise((r) => setTimeout(r, 0));
  newDoc("k2", "notice");
  const next = doc(WriterState.state.docId);
  WriterState.state.picker = true;
  reads[0]({ events: [event(1)] });
  await new Promise((r) => setTimeout(r, 20));
  ok("Delayed selection cannot mutate either case after switching", abandoned.items.length === 0 && next.items.length === 0);
  b.remove();
  console.log(count + " phase-seven assertions passed");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
