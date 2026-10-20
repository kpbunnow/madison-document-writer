/* R4 regression: reversible selection, grouped manual deadlines, citation accuracy. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8");
const payload = Buffer.from(/var B="([A-Za-z0-9+\/=]+)"/.exec(html)[1], "base64").toString("utf8");
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
const w = dom.window;
global.window = w;
global.document = w.document;
global.getSelection = () => w.getSelection();
global.confirm = () => true;
global.prompt = () => "";
w.scrollTo = () => {};
global.URL = { createObjectURL: () => "test", revokeObjectURL() {} };
global.Blob = function () {};
const test = async function () {
  await new Promise((r) => setTimeout(r, 20));
  render = () => {};
  idbSet = async () => true;
  let count = 0;
  const ok = (name, v) => {
    assert.ok(v, name);
    count++;
    console.log("PASS " + name);
  };
  WriterState.CATALOG_VERIFIED = true;
  const restored = allItems(),
    catalog = restored.filter((i) => i.catalogId);
  ok("Full order library restores all 109 consolidated entries", catalog.length === 109 && restored.length === 250);
  ok("Restored entries stay draft and block issuance", catalog.every((i) => i.p === "draft") && catalog.every((i) => i.a));
  const entries = LIBRARY.flatMap((c) => c.groups.flatMap((g) => g.items.map((i) => ({ c, g, i }))));
  ok(
    "Legacy order library identities remain unchanged",
    entries.filter((x) => !x.i.catalogId).length === 141 &&
      new Set(entries.map((x) => libraryKey({ c: x.c.code, g: x.g.code, o: x.i.o }))).size === 250,
  );
  const restoredEntry = entries.find((x) => x.i.catalogId);
  newDoc("k1", "notice");
  const libDraft = doc(WriterState.state.docId);
  toggleLibraryItem(libDraft, LIBRARY.indexOf(restoredEntry.c), restoredEntry.c.groups.indexOf(restoredEntry.g), restoredEntry.i);
  ok(
    "Selecting restored wording preserves its draft gate",
    libDraft.items[0].prov === "draft" && checks(libDraft).some((c) => !c.ok && c.t.includes("draft language")),
  );
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  newDoc("k1", "notice");
  let d = doc(WriterState.state.docId);
  const ci = 0,
    gi = 0,
    src = LIBRARY[ci].groups[gi].items[0];
  ok("Select adds one item", toggleLibraryItem(d, ci, gi, src) && d.items.length === 1);
  ok("New item due date is blank", d.items[0].due === "");
  const key = itemLibraryKey(d.items[0]);
  delete d.items[0].lib;
  d.items[0].sections = ["CHANGED"];
  ok("Changing classification retains selection identity", itemLibraryKey(d.items[0]) === key);
  ok("Selected item toggles off after wording edits", !toggleLibraryItem(d, ci, gi, src) && d.items.length === 0);
  toggleLibraryItem(d, ci, gi, src);
  ok("Reselect restores the edited draft instead of losing work", d.items[0].sections[0] === "CHANGED");
  toggleLibraryItem(d, ci, gi, src);
  for (let n = 0; n < 10; n++) toggleLibraryItem(d, ci, gi, src);
  ok("Repeated toggle never duplicates", d.items.length === 0);
  toggleLibraryItem(d, ci, gi, src);
  renumber(d);
  WriterState.state.picker = true;
  WriterState.state.pickerStatus = "selected";
  ok("Picker exposes checked button semantics", pickerHTML().includes('aria-pressed="true"'));
  d.items = Array.from({ length: 5 }, (_, n) => ({
    id: "item" + n,
    no: String(n + 1),
    sections: ["27.05(2)(c)"],
    title: "Item " + n,
    text: "Repair.",
    due: "",
    prov: "notice",
  }));
  ok(
    "Missing manually entered dates block issuance",
    blockers(d).some((c) => c.t.includes("no due date")),
  );
  const date = addDays(iso(today), 21),
    next = addDays(date, 1),
    third = addDays(date, 2),
    fourth = addDays(date, 3);
  ok(
    "Group date updates only selected items",
    !assignDue(d, false, date, ["item0", "item1"]) && d.items[0].due === date && d.items[1].due === date && d.items[2].due === "",
  );
  assignDue(d, false, next, ["item2"]);
  assignDue(d, false, third, ["item3"]);
  const before = JSON.stringify(d.items);
  ok("Fourth date rejects entire batch", !!assignDue(d, false, fourth, ["item4"]) && JSON.stringify(d.items) === before);
  ok("Existing date remains usable", !assignDue(d, false, date, ["item4"]));
  ok(
    "Changing all items to one new date is allowed",
    !assignDue(
      d,
      false,
      fourth,
      d.items.map((i) => i.id),
    ) && distinctDues(d.items).length === 1,
  );
  d.items.forEach((i) => (i.due = date));
  d.items[0].due = date;
  d.items[1].due = addDays(date, 6);
  ok(
    "Due dates six days apart fail issuance",
    authoringChecks(d).some((c) => !c.ok && c.t.includes("seven days")),
  );
  d.items[1].due = addDays(date, 7);
  ok("Due dates exactly seven days apart pass spacing check", !authoringChecks(d).some((c) => !c.ok && c.t.includes("seven days")));
  d.items.forEach((i, n) => (i.due = addDays(date, n)));
  ok(
    "Individual date edits cannot bypass issuance gate",
    authoringChecks(d).some((c) => !c.ok && c.t.includes("three")),
  );
  d.items[4].done = true;
  d.items[3].withdrawn = true;
  ok("Historical resolved dates do not consume active deadlines", !authoringChecks(d).some((c) => !c.ok && c.t.includes("three")));
  d.items = d.items.slice(0, 1);
  d.items[0].due = date;
  d.items[0].cite = true;
  issueDocument(d);
  d = citationFromNotice(d.id);
  let i = d.items[0],
    c = d.cits[i.id];
  ok("Initial citation does not claim a reinspection", !docBody(d).includes("A reinspection found") && !docBody(d).includes("$75.00"));
  ok("Generated citation has valid deposit", citationDepositFault(c) === "");
  ok("All generated tickets use one suggested session", c.courtTime === "08:30");
  editCitation(d, i.id, "ord", "SPS 999.99");
  ok("Missing schedule is actionable and blocked", !!citationDepositFault(c) && citationReview(d).includes("Approved total"));
  editCitation(d, i.id, "depositMode", "base");
  editCitation(d, i.id, "base", "123.45");
  ok("Manual amount requires authority", !!citationDepositFault(c));
  editCitation(d, i.id, "depositSource", "Division approved schedule, reviewed 2026-09-20");
  ok("Manual base uses penny-accurate fees", c.amount === "226.55" && citationDepositFault(c) === "");
  editCitation(d, i.id, "base", "");
  ok("Blank is not a zero deposit", !!citationDepositFault(c));
  editCitation(d, i.id, "base", "0");
  ok("Explicit approved zero base is distinguished from blank", c.amount === "71.00" && citationDepositFault(c) === "");
  editCitation(d, i.id, "base", "1.234");
  ok("Fractional cents rejected", !!citationDepositFault(c));
  editCitation(d, i.id, "depositMode", "total");
  editCitation(d, i.id, "amount", "245.67");
  editCitation(d, i.id, "depositSource", "Court instruction QA-123, total includes assessments.");
  ok("Approved total is not charged assessments twice", citationDepositFault(c) === "" && citAmount(d, i) === "$245.67");
  editCitation(d, i.id, "desc", "Inspector wording retained");
  editCitation(d, i.id, "ord", "27.05(2)(c)");
  ok("Ordinance change invalidates manual override", c.depositMode === "schedule" && c.resolvedVia === "exact" && c.amount === "197.00");
  ok("Inspector description survives deposit lookup", c.desc === "Inspector wording retained");
  editCitation(d, i.id, "courtDate", "11/10/2026");
  editCitation(d, i.id, "courtTime", "1:30 PM");
  ok("Printed date and time edits normalize", c.courtDate === "2026-11-10" && c.courtTime === "13:30");
  const expected = JSON.stringify(d);
  citationFaces(d, true);
  ok("Rendering never mutates citation data", JSON.stringify(d) === expected);
  c.amount = "";
  const saved = JSON.stringify(d);
  citationFaces(d, true);
  ok("Missing retained amount is not silently recalculated", JSON.stringify(d) === saved && citAmount(d, i) === "");
  applyDeposit(d, i.id, c.ord);
  c.courtTime = "";
  ok(
    "Missing court time blocks issuance",
    authoringChecks(d).some((c) => !c.ok && c.t.includes("court time")),
  );
  c.courtTime = "08:30";
  c.issued = addDays(d.mailed, -1);
  ok(
    "Issue/mail date disagreement blocks issuance",
    authoringChecks(d).some((c) => !c.ok && c.t.includes("mailed date")),
  );
  c.issued = d.mailed;
  c.amount = "1.00";
  ok("Edited arithmetic cannot bypass checks", !!citationDepositFault(c));
  ok("Prefix lookup does not confuse distinct ordinance numbers", lookupForf(["10.2"]) === null);
  ok(
    "Phantom charges have no resolution; identical duplicate 29.22 rules now price automatically",
    ["9.4", "1008.1"].every((o) => !lookupForf([o])?.tiers?.length) && lookupForf(["29.22"]).tiers.length === 3,
  );
  console.log(count + " R4 authoring assertions passed.");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1)});");
