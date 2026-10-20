/* R40 semantic tasks, policy hold, legacy reprints and idempotent filing event. */
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const payload = Buffer.from(
  /var B="([A-Za-z0-9+/=]+)"/.exec(
    fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8"),
  )[1],
  "base64",
).toString();
const dom = new JSDOM('<div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.fetch = async () => {
  throw Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  render = () => {};
  saveDrafts = async () => true;
  WriterState.CASES = [
    {
      id: "k1",
      number: "QA-R40",
      address: "100 TEST ST",
      parcel: "070822219101",
      owner: "SYNTHETIC OWNER",
      ownerAddr: ["100 TEST ST", "MADISON WI 53703"],
      inspectorId: "i4",
      date: recordDay(today),
      time: "09:00",
    },
  ];
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  d.authoringVersion = 11;
  d.type = "citation";
  const entry = policyAt(recordDay(today)).entries.find((e) => e.rule?.kind === "mandatory");
  d.items = [
    {
      id: "r40-item",
      no: "1",
      title: "Synthetic mandatory charge",
      text: "Synthetic work",
      sections: [entry.ordinance],
      cite: true,
      due: addDays(recordDay(today), 21),
    },
  ];
  d.cits = {
    "r40-item": {
      num: "QA-MANDATORY",
      ord: entry.ordinance,
      issued: recordDay(today),
      courtDate: nextCourtDate(recordDay(today)),
      courtTime: courtTime(),
      ...resolveCitationAmount({ ordinance: entry.ordinance, entryId: entry.id, tier: 1, date: recordDay(today) }),
    },
  };
  const rows = () => [{ k: kase("k1"), st: caseState(kase("k1")) }];
  assert.equal(workspaceTasks(rows()).find((t) => t.key === "deposit").count, 0);
  assert.ok(authoringChecks(d).some((c) => !c.ok && c.t.includes("division-approved defendant instructions")));
  const preview = citationFaces(d, true);
  assert.ok(preview.includes("preview is on hold"));
  assert.ok(!preview.includes("No in-person appearance is required."));
  assert.throws(() => printJob(d), /division-approved/);
  const other = { id: "ordinary-item", no: "2", sections: ["27.05(2)(c)"], cite: true };
  d.items.push(other);
  d.cits[other.id] = {
    ord: "27.05(2)(c)",
    issued: recordDay(today),
    ...resolveCitationAmount({ ordinance: "27.05(2)(c)", tier: 1, date: recordDay(today) }),
  };
  assert.ok(
    authoringChecks(d).some((c) => !c.ok && c.t.includes("division-approved defendant instructions")),
    "mixed charges remain blocked as one issuance",
  );
  d.items.pop();
  delete d.cits[other.id];
  const frozen = freezeSources(d);
  d.frozen = frozen;
  d.draft = false;
  assert.ok(citationFaces(d, true).includes(frozen.courtInstructions), "old issued wording remains frozen");
  const citation = {
    ...clone(d),
    id: "r40-citation",
    type: "citation",
    draft: false,
    filedAt: nowISO(),
    filedArtifact: { filename: "Synthetic - 0citation.pdf", sha256: "a".repeat(64) },
  };
  const notice = { ...clone(d), id: "r40-notice", type: "notice", draft: false, cits: {}, issuanceGroup: { citationId: citation.id }, filedAt: null };
  WriterState.DOCS = [citation, notice];
  WriterState.ARTIFACT_LOCATIONS[citation.id] = ["shared"];
  assert.equal(pdfTransferState(notice), "included in citation PDF");
  assert.equal(workspaceTasks(rows()).find((t) => t.key === "artifacts").count, 0);
  citation.filedAt = null;
  assert.equal(caseState(kase("k1")).filingDoc.id, citation.id, "next filing action targets citation, not its internal notice");
  citation.filedAt = nowISO();
  WriterState.ARTIFACT_LOCATIONS[citation.id] = [];
  let tasks = workspaceTasks(rows()).find((t) => t.key === "artifacts");
  assert.equal(tasks.count, 1);
  assert.ok(tasks.items[0].action.includes(citation.id));
  citation.superseded = true;
  assert.equal(workspaceTasks(rows()).find((t) => t.key === "artifacts").count, 0);
  citation.superseded = false;
  WriterState.state.publicationBusy = citation.id;
  let history = document.createElement("div");
  history.innerHTML = recordHistoryHTML(citation);
  assert.ok(history.querySelector("#btn-recordnote").disabled, "note editor waits for complete filing/save");
  WriterState.state.publicationBusy = null;
  history.innerHTML = recordHistoryHTML(citation);
  assert.equal(history.querySelector("#btn-recordnote").disabled, false, "note editor resumes after save");
  // Original bytes returned twice must generate one filing event, while retrying
  // persistence even if the event was already appended locally.
  const snapshot = clone(citation);
  delete snapshot.filedAt;
  delete snapshot.filedArtifact;
  WriterState.EVENTS = { k1: [{ id: "issued_r40", type: "citation.issued", payload: { snapshot }, at: nowISO() }] };
  WriterState.HELPER = { ok: true, chrome: true };
  let saves = 0,
    posts = [];
  saveCaseFile = async () => {
    saves++;
    return true;
  };
  refreshArtifactLocations = async () => {};
  project = () => {};
  global.fetch = async (url, request) => {
    posts.push(JSON.parse(request.body));
    return { json: async () => ({ ok: true, name: "Synthetic - 0citation.pdf", path: "synthetic.pdf", sha256: "a".repeat(64) }) };
  };
  const job = { docId: citation.id, name: "Synthetic - 0citation.pdf", html: "<p>Frozen original</p>" };
  await filePdf(citation, job);
  await filePdf(citation, job);
  assert.equal(eventsFor("k1").filter((e) => e.type === "document.filed").length, 1);
  assert.equal(saves, 2);
  assert.deepEqual(posts[0].operation, posts[1].operation);
  assert.equal(posts[0].operation.version.length, 64);
  console.log("PASS R40 mandatory hold, truthful tasks, preserved reprints and one filing event");
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
