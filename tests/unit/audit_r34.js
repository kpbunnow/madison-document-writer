globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom"),
  { execFileSync } = require("child_process");
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
global.__R34_PY = (snap) =>
  execFileSync(
    process.env.PYTHON || "python3",
    ["-c", "import json,sys,snow_rules;s=json.load(sys.stdin);sys.stdout.write(snow_" + 'rules.cover_html(s,s["frozen"]["snowLetter"]))'],
    { cwd: require("path").resolve(__dirname, "../.."), input: JSON.stringify(snap) },
  ).toString();
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  const key = '["ENF_PM_PROPMAINT","SNOW",1]',
    ci = LIBRARY.findIndex((x) => x.code === "ENF_PM_PROPMAINT"),
    gi = LIBRARY[ci].groups.findIndex((x) => x.code === "SNOW"),
    src = LIBRARY[ci].groups[gi].items[0];
  const comments = (html) => (html.match(/VIOLATION COMMENT:/g) || []).length;
  const reset = (cases) => {
    WriterState.DOCS = [];
    WriterState.EVENTS = {};
    WriterState.REINSP = [];
    WriterState.PENDING = [];
    WriterState.CASES = cases;
  };
  const base = { inspectorId: "i4", owner: "SYNTHETIC OWNER", ownerAddr: ["3300 SYNTHETIC ST", "MADISON WI 53703"], caseType: "snow-10.28" };
  const draft = (caseId, fall, day, time) => {
    newDoc(caseId, "notice");
    const d = doc(WriterState.state.docId);
    if (!d.items.length) assert.equal(toggleLibraryItem(d, ci, gi, src), true);
    d.inspDate = day;
    d.inspTime = time;
    d.mailed = day;
    d.snow = { snowfallDate: fall, inches: 0.8, condition: "snow covered", photographed: true, cornerNotCleared: false };
    const c = Object.values(d.cits)[0];
    c.issued = day;
    citationPricing.refresh(d);
    return d;
  };
  reset([{ ...base, id: "k1", number: "QA-R34-ONE", address: "3300 SYNTHETIC ST", parcel: "070822219101", date: "2026-01-05", time: "11:46" }]);
  // 1. Format 10 cover, January pricing.
  const jan = draft("k1", "2026-01-01", "2026-01-05", "11:46");
  assert.ok(jan.authoringVersion >= 10);
  assert.equal(Object.values(jan.cits)[0].amount, "124.00");
  const body = snow.body(jan);
  assert.ok(body.startsWith('<p class="snow-subject"><strong>Subject: Failure to Remove Snow and/or Ice from Public Sidewalk</strong></p>'));
  assert.ok(body.includes("<strong>There are no warnings given for this Ordinance violation.</strong>"));
  assert.ok(
    body.includes("<td><strong>If there is no sand, please call: Streets West: 266-4681</strong></td>") &&
      body.includes("<td><strong>or Streets East: 246-4532</strong></td>"),
  );
  assert.equal((body.match(/<strong>/g) || []).length, 4);
  assert.ok(body.includes("$124.00") && body.includes("$187.00"));
  assert.equal(snow.coverFormat(jan), 10);
  // 2. Issued cover is byte-identical to the helper's renderer; defendant copy has no comment.
  jan.mailed = recordDay(today);
  jan.inspDate = jan.mailed;
  jan.inspTime = "10:00";
  jan.snow.snowfallDate = addDays(jan.mailed, -2);
  Object.values(jan.cits)[0].issued = jan.mailed;
  citationPricing.refresh(jan);
  issueDocument(jan);
  const issued = doc(jan.id);
  assert.equal(issued.frozen.snowCoverFormat, 10);
  assert.equal(__R34_PY(clone(issued)), issued.frozen.body);
  const html = printJob(issued).html;
  assert.equal(comments(html), 3);
  assert.ok(html.includes("snow-subject"));
  // 3. Authoring 9 (R33) snow citations keep the old cover and the defendant-copy comment.
  const r33 = clone(issued);
  r33.id = "r33-copy";
  r33.authoringVersion = 9;
  delete r33.frozen.snowCoverFormat;
  delete r33.frozen.body;
  assert.equal(snow.coverFormat(r33), 9);
  assert.ok(!snow.body(r33).includes("snow-subject"));
  assert.ok(!snow.body(r33).includes("<strong>"));
  WriterState.DOCS.push(r33);
  assert.equal(comments(printJob(r33).html), 4);
  WriterState.DOCS.pop();
  // 4. R35: one snow case tracks the property through the season; a later inspection in the same case is cited again and escalates.
  const again = draft("k1", addDays(recordDay(today), -2), recordDay(today), "11:30");
  assert.equal(snow.lifecycle(again).length, 0, JSON.stringify(snow.lifecycle(again)));
  const ac = Object.values(again.cits)[0];
  assert.equal(ac.tier, "2nd");
  assert.equal(ac.amount, "197.00");
  issueDocument(again);
  assert.equal(docsFor("k1").filter((x) => !x.draft && snow.is(x)).length, 2);
  assert.equal(snow.newCaseButton, undefined);
  // 5. Property matching without a parcel, and the unavailable warning.
  const day = recordDay(today),
    fall = addDays(day, -2);
  reset([
    { ...base, id: "p1", number: "QA-R34-P1", address: "2714 WILLARD AVE", parcel: "", date: day, time: "09:00" },
    { ...base, id: "p2", number: "QA-R34-P2", address: "2714 Willard Ave.", parcel: "", date: day, time: "13:00" },
    { ...base, id: "p3", number: "QA-R34-P3", address: "UNKNOWN LOCATION", parcel: "", date: day, time: "13:00" },
  ]);
  const first = draft("p1", fall, day, "09:00");
  issueDocument(first);
  const next = draft("p2", fall, day, "13:00"),
    nc = Object.values(next.cits)[0];
  assert.equal(nc.amount, "197.00");
  assert.equal(nc.countedOffenses.length, 1);
  assert.equal(nc.siteMatch, "address");
  assert.ok(nc.pricingWarning.includes("Matched prior citations by address; no parcel number."));
  const none = draft("p3", fall, day, "13:00"),
    uc = Object.values(none.cits)[0];
  assert.equal(uc.siteMatch, "unavailable");
  assert.ok(uc.pricingWarning.includes("Prior snow citations could not be checked for this property."));
  assert.equal(uc.amount, "134.00");
  assert.equal(propertyKey("2714 Willard Avenue, Madison WI"), "2714 WILLARD AVE");
  assert.ok(sameSite({ parcel: "070901234567", address: "1 A ST" }, { address: "1 A Street" }));
  assert.ok(!sameSite({ parcel: "070901234567", address: "1 A ST" }, { parcel: "070901234568", address: "1 A ST" }));
  console.log(
    "PASS R34 snow cover format 10 (browser equals helper), defendant copy, R" +
      "33 retention, multiple citations per snow case and property matching",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
