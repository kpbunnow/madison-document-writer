globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
window.scrollTo = () => {};
global.getSelection = () => window.getSelection();
global.fetch = async () => {
  throw Error("offline");
};
const payload = Buffer.from(
  /var B="([A-Za-z0-9+/=]+)"/.exec(
    fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8"),
  )[1],
  "base64",
).toString();
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  WriterState.REINSP = [];
  WriterState.PENDING = [];
  WriterState.CASES = [
    {
      id: "k1",
      number: "QA-SNOW-ONE",
      address: "3300 SYNTHETIC ST",
      parcel: "070822219101",
      owner: "SYNTHETIC OWNER",
      ownerAddr: ["3300 SYNTHETIC ST", "MADISON WI 53703"],
      inspectorId: "i4",
      date: "2026-01-05",
      time: "11:46",
    },
  ];
  const key = '["ENF_PM_PROPMAINT","SNOW",1]',
    ci = LIBRARY.findIndex((x) => x.code === "ENF_PM_PROPMAINT"),
    gi = LIBRARY[ci].groups.findIndex((x) => x.code === "SNOW"),
    src = LIBRARY[ci].groups[gi].items[0];
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  assert.equal(toggleLibraryItem(d, ci, gi, src), true);
  assert.equal(d.type, "citation");
  assert.equal(kase("k1").caseType, "snow-10.28");
  assert.equal(d.items[0].due, null);
  assert.deepEqual(dueItems(d), []);
  assert.equal(duePanel(d, false), "");
  assert.equal(toggleLibraryItem(d, 0, 0, LIBRARY[0].groups[0].items[0]), false);
  assert.equal(d.items.length, 1);
  d.inspDate = "2026-01-05";
  d.inspTime = "11:46";
  d.mailed = "2026-01-05";
  d.snow = { snowfallDate: "2026-01-01", inches: 0.8, condition: "snow covered", photographed: true, cornerNotCleared: false };
  const c = Object.values(d.cits)[0];
  c.issued = d.mailed;
  citationPricing.refresh(d);
  assert.equal(c.amount, "124.00");
  assert.equal(c.desc, "SNOW & ICE REMOVAL FROM SIDEWALK VIOLATION");
  assert.equal(c.comment, "On 01/01/2026, 0.8 inches of snow fell. Inspection found the public sidewalk snow covered.");
  const html = noticeHTML(d);
  assert.ok(html.includes("$124.00") && html.includes("$187.00"));
  assert.ok(html.includes("snow-sites"));
  assert.ok(!html.includes("Due Date"));
  assert.ok(!html.toLowerCase().includes("reinspection"));
  d.inspDate = "2026-01-02";
  d.inspTime = "11:59";
  snow.prepare(d);
  assert.ok(snow.checks(d).some((x) => !x.ok && x.t.includes("until noon on 01/02/2026")));
  d.inspTime = "12:00";
  snow.prepare(d);
  assert.ok(!snow.checks(d).some((x) => !x.ok && !x.soft && x.t.includes("until noon")));
  d.mailed = recordDay(today);
  d.inspDate = d.mailed;
  d.inspTime = "10:00";
  d.snow.snowfallDate = addDays(d.mailed, -2);
  c.issued = d.mailed;
  citationPricing.refresh(d);
  assert.equal(c.amount, "134.00");
  assert.ok(snow.body(d).includes("$197.00"));
  issueDocument(d);
  const issued = doc(d.id),
    original = printJob(issued).html;
  const frozen = clone(issued.frozen.snowLetter);
  snow.setLetter({ ...frozen, closing: "Changed seasonal contact information" });
  assert.equal(printJob(issued).html, original);
  const k2 = {
    ...clone(kase("k1")),
    id: "snow-two",
    number: "QA-SNOW-TWO",
    owner: "DIFFERENT OWNER",
    caseType: "snow-10.28",
    date: recordDay(today),
    time: "11:00",
  };
  WriterState.CASES.push(k2);
  newDoc(k2.id, "citation");
  const second = doc(WriterState.state.docId);
  second.snow = { ...d.snow };
  citationPricing.refresh(second);
  const next = Object.values(second.cits)[0];
  assert.equal(next.amount, "197.00");
  assert.equal(next.countedOffenses.length, 1);
  assert.ok(next.pricingWarning.includes("different owner"));
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  newDoc("k1", "citation");
  const empty = doc(WriterState.state.docId);
  toggleLibraryItem(empty, ci, gi, src);
  assert.equal(kase("k1").caseType, undefined);
  assert.equal(empty.type, "notice");
  WriterState.WORK.entry["new-case-type"] = "";
  CITATION_POLICY.snowAccelaCaseTypes = ["SyntheticSnowType"];
  assert.equal(snow.matchesImport({ caseType: "syntheticsnowtype" }), true);
  assert.equal(snow.matchesImport({ caseType: "unmapped" }), false);
  WriterState.WORK.entry["new-case-type"] = "snow-10.28";
  assert.equal(snow.matchesImport({}), true);
  console.log("PASS R33 snow-only items, timing, historical/current totals, property escalation and frozen seasonal content");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
