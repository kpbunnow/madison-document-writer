/* Correction lifecycle regressions. HTTP semantics are independently exercised
   by audit_helper.py and the real browser suite. No operational data is used. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8");
const src = Buffer.from(/var B="([A-Za-z0-9+\/=]+)"/.exec(html)[1], "base64").toString("utf8");
const dom = new JSDOM(
  "<!doctype html><style>" +
    /<style>([\s\S]*?)<\/style>/.exec(html)[1] +
    '</style><div id="app"></div><div id="overlay"></div><div id="toast"></div>',
  { pretendToBeVisual: true, url: "http://127.0.0.1:8777/" },
);
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
  const failures = [];
  function ok(label, value) {
    console.log((value ? "PASS " : "FAIL ") + label);
    if (!value) failures.push(label);
  }
  await new Promise((r) => setTimeout(r, 10));
  const originalFetch = global.fetch;
  for (const status of [400, 503]) {
    global.fetch = async () => ({ ok: false, status, json: async () => ({ ok: false, error: "Synthetic HTTP failure" }) });
    try {
      await helperJSON("/cases/save", {});
      ok("HTTP error must be raised", false);
    } catch (e) {
      ok("HTTP " + status + " classification preserves uncertain writes", e.name === "StorageError" && e.definitive === (status === 400));
    }
  }
  global.fetch = originalFetch;
  idbSet = async () => true;
  filePdf = async () => true;
  writeSummary = async () => true;
  globalThis.TEST_SENT_EMAILS = [];
  emailDocument = async (d, picked) => {
    globalThis.TEST_SENT_EMAILS.push({ id: d.id, picked: clone(picked) });
    return true;
  };
  WriterState.CASEDIR = { helper: true };
  WriterState.DIRNAME = "Test case folder";
  WriterState.HELPER = { caseStore: true };
  let serverRecord = null,
    mode = "ok",
    attempts = [];
  helperJSON = async (url, body) => {
    if (url !== "/cases/save") throw new Error("Unexpected URL " + url);
    const incoming = clone(body.file),
      ev = incoming.events.find((e) => e.type === "correction.issued");
    if (ev) attempts.push(ev.id);
    if (mode === "reject") {
      const e = new Error("Synthetic conflicting correction");
      e.name = "StorageError";
      throw e;
    }
    if (!serverRecord) serverRecord = incoming;
    else {
      const map = new Map(serverRecord.events.map((e) => [e.id, e]));
      incoming.events.forEach((e) => map.set(e.id, e));
      serverRecord = Object.assign({}, incoming, { events: Array.from(map.values()) });
    }
    if (mode === "server-error") {
      mode = "ok";
      const e = new Error("Temporary server failure after commit");
      e.name = "StorageError";
      e.definitive = false;
      throw e;
    }
    if (mode === "lost") {
      mode = "ok";
      throw new Error("Response lost after server commit");
    }
    return { ok: true, file: clone(serverRecord), revision: "test-revision", name: caseFileName(serverRecord.case) };
  };
  function fresh() {
    WriterState.DOCS = [];
    WriterState.REINSP = [];
    WriterState.EVENTS = {};
    WriterState.SAVE_CHECKPOINTS = {};
    WriterState.PENDING = [];
    COMMITTED.clear();
    serverRecord = null;
    WriterState.state.modal = null;
    WriterState.state.screen = "cases";
    WriterState.state.amendmentError = "";
    kase("k1").date = addDays(iso(today), -30);
  }
  function notice() {
    kase("k1").emails = [{ addr: "owner@example.invalid", kind: "Property Owner", on: true }];
    kase("k1").ccList = [{ name: "Test Recipient", addr: "123 Main St", city: "Madison, WI 53703" }];
    newDoc("k1", "notice");
    const d = doc(WriterState.state.docId);
    d.emailedTo = [{ addr: "owner@example.invalid", kind: "Property Owner" }];
    d.items = [1, 2].map((n) => ({
      id: uid("x"),
      no: String(n),
      sections: ["27.05(2)(c)"],
      title: "Test item " + n,
      text: "Repair condition " + n + ".",
      due: futureDue(iso(today), 21),
      prov: "notice",
      done: false,
      doneOn: "",
    }));
    issueDocument(d);
    rememberSaved(kase("k1"), caseFile("k1"));
    serverRecord = clone(caseFile("k1"));
    return doc(d.id);
  }
  ok(
    "City record day respects midnight and daylight saving",
    recordDay("2026-01-01T01:30:00Z") === "2025-12-31" && recordDay("2026-07-01T04:30:00Z") === "2026-06-30",
  );
  fresh();
  let original = notice(),
    raw = JSON.stringify(eventsFor("k1")),
    c = startCorrection(original.id);
  ok("Starting a correction leaves original active and log untouched", isEffective(doc(original.id)) && JSON.stringify(eventsFor("k1")) === raw);
  ok(
    "No item renumbering or deletion in a correction",
    !structEditable(c) && stableJSON(c.items.map((i) => [i.id, i.no])) === stableJSON(original.items.map((i) => [i.id, i.no])),
  );
  const originalOwner = kase("k1").owner;
  c.correction.case.owner = "CORRECTED TEST OWNER";
  ok("Correction case fields stay staged until issue", kase("k1").owner === originalOwner && docCase(original).owner === originalOwner);
  ok(
    "Correction carries forward issued email recipients",
    c.correction.case.emails.some((e) => e.addr === "owner@example.invalid") && c.emailSelection.includes("owner@example.invalid|Property Owner"),
  );
  ok(
    "Email recipients appear on the correction draft",
    documentHTML(c).includes("Email recipients:") &&
      documentHTML(c).includes("owner@example.invalid") &&
      documentHTML(c).includes("CC:") &&
      documentHTML(c).includes("123 Main St"),
  );
  ok(
    "Correction record prompt is removed",
    !correctionPanel(c).includes("correction-case") && !recordHistoryHTML(Object.assign({}, c, { draft: false })).includes("Record follow-through"),
  );
  await discardDraft(c.id);
  ok("Discarding leaves the published record unchanged", JSON.stringify(eventsFor("k1")) === raw);
  c = startCorrection(original.id);
  c.correction.reason = "Fix the incorrect repair description.";
  ok(
    "Mail date / signer alone do not qualify as a correction",
    correctionChecks(c).some((x) => !x.ok && /content correction/.test(x.t)),
  );
  c.items[0].text = "Repair the west wall.";
  c.correction.case.owner = "CORRECTED TEST OWNER";
  c.emailedTo = clone(original.emailedTo);
  c.correction.reviewed = true;
  mode = "reject";
  ok("Rejected save is reported", (await issueCorrection(c)) === false);
  ok(
    "Rejected save keeps editable draft and original active",
    doc(c.id).draft && !c.pendingAmendment && isEffective(doc(original.id)) && JSON.stringify(eventsFor("k1")) === raw,
  );
  mode = "server-error";
  ok("Temporary server failure retains the exact attempt", (await issueCorrection(c)) === false && !!c.pendingAmendment);
  const pendingId = c.pendingAmendment.id;
  mode = "lost";
  ok("Lost response is not called a confirmed save", (await issueCorrection(c)) === false);
  ok(
    "Ambiguous request remains durable and locked",
    isLocked(c) && draftBundle().docs.some((x) => x.pendingAmendment && x.pendingAmendment.id === pendingId),
  );
  ok("An ambiguous correction cannot be discarded", (await discardDraft(c.id)) === false);
  ok("Retry confirms the already committed event", (await issueCorrection(c)) === true);
  ok(
    "Retry uses same identity and creates one revision",
    attempts.slice(-3).every((id) => id === pendingId) && serverRecord.events.filter((e) => e.type === "correction.issued").length === 1,
  );
  ok("Original event bytes are preserved", JSON.stringify(eventsFor("k1").filter((e) => e.type !== "correction.issued")) === raw);
  ok("Old and new are linked; current source is new", doc(original.id).superseded.replacedBy === c.id && sourceDocFor("k1").id === c.id);
  ok(
    "Correction automatically updates current case details and reporting source",
    kase("k1").owner === "CORRECTED TEST OWNER" &&
      docCase(doc(c.id)).owner === "CORRECTED TEST OWNER" &&
      summarize(caseFile("k1")).case.owner === "CORRECTED TEST OWNER",
  );
  ok(
    "Correction recipient is noted and prepared for email",
    doc(c.id).emailedTo.some((e) => e.addr === "owner@example.invalid") &&
      documentHTML(doc(c.id)).includes("owner@example.invalid") &&
      globalThis.TEST_SENT_EMAILS.some((x) => x.id === c.id && x.picked.some((e) => e.addr === "owner@example.invalid")),
  );
  ok("Accela manual confirmation action is absent", !screenWrite().includes("Mark recorded in Accela"));
  ok("Revision is visibly identified in printable HTML", documentHTML(doc(c.id)).includes("CORRECTED DOCUMENT"));
  ok("Ancestor correction is refused", startCorrection(original.id) === null);
  ok("Annotation changes no enforcement counts", await addRecordNote(original.id, "Original description was a transcription error."));
  ok("Annotation is linked and immutable", doc(original.id).annotations.length === 1 && summarize(caseFile("k1")).documents.length === 2);
  let next = startCorrection(c.id);
  next.correction.reason = "Remove an item entered on the wrong property.";
  next.items[1].withdrawn = true;
  next.items[1].withdrawalReason = "This condition belongs to a different property.";
  next.correction.reviewed = true;
  ok("Withdrawal saves as correction", await issueCorrection(next));
  let sum = summarize(caseFile("k1"));
  ok("Withdrawn is separate from compliant", sum.violations[1].withdrawn && !sum.violations[1].done && sum.violations[0].no === "1");
  ok("Revision does not reset original action date", sum.case.noticeIssued === original.mailed && sum.documents[2].issued === original.mailed);
  ok("Past history contains the earlier valid version", sum.violations[1].history.length === 3 && !!sum.violations[1].history[0].effectiveTo);
  startReinspection("k1");
  reinsp(WriterState.state.reinspId).time = "10:00";
  let visit = reinsp(WriterState.state.reinspId);
  ok(
    "Withdrawn item is carried without a pass",
    visit.results[next.items[1].id].oc === "withdrawn" && doneItems(visit).length === 0 && unchecked(visit).length === 1,
  );
  visit.results[next.items[0].id] = { oc: "corrected", on: visit.date, due: "", note: "Verified condition", cite: false };
  docFromReinspection(visit, "compliance");
  let comp = doc(WriterState.state.docId);
  ok(
    "Corrected email recipient carries into future documents",
    emailList(docCase(comp)).some((e) => e.addr === "owner@example.invalid"),
  );
  ok("Withdrawn item does not block compliant items from closing", blockers(comp).length === 0);
  issueDocument(comp);
  serverRecord = caseFile("k1");
  rememberSaved(kase("k1"), serverRecord);
  const count = reinspFor("k1").length;
  let fix = startCorrection(comp.id);
  fix.correction.reason = "Correct the recorded compliance date for the same inspection.";
  fix.items[0].doneOn = addDays(iso(today), -1);
  fix.correction.reviewed = true;
  ok("Compliance date correction commits", await issueCorrection(fix));
  ok("Visit is amended without duplicate", reinspFor("k1").length === count && reinsp(visit.id).results[next.items[0].id].on === fix.items[0].doneOn);
  ok(
    "Original recorded visit is retained",
    eventsFor("k1").find((e) => e.type === "reinspection.recorded").payload.reinspection.results[next.items[0].id].on !== fix.items[0].doneOn,
  );
  // Historical due dates may be preserved, but never silently changed to tomorrow.
  fresh();
  original = notice();
  let event = eventsFor("k1")[0];
  event.payload.snapshot.items[0].due = addDays(iso(today), -2);
  project();
  c = startCorrection(original.id);
  c.items[0].text = "Correct the transcribed location.";
  c.correction.reason = "Correct the location without changing the deadline.";
  ok("Unchanged historical due date remains usable", !blockers(c).some((x) => /today or in the past/.test(x.t)));
  c.items[0].due = addDays(iso(today), -3);
  ok(
    "A newly changed past deadline is flagged",
    blockers(c).some((x) => /today or in the past/.test(x.t)),
  );
  appendEvent("k1", "reinspection.recorded", {
    reinspection: { id: "late_visit", caseId: "k1", sourceDocId: original.id, date: iso(today), results: {} },
  });
  project();
  ok(
    "Intervening inspection invalidates the correction review",
    correctionChecks(c).some((x) => !x.ok && /changed|inspection/i.test(x.t)),
  );
  // Rendering failure after a confirmed correction remains a filing task.
  fresh();
  original = notice();
  raw = JSON.stringify(eventsFor("k1"));
  c = startCorrection(original.id);
  c.items[0].text = "Repair the north wall.";
  c.correction.reason = "Correct the wall location in the issued notice.";
  c.correction.reviewed = true;
  const retainedPrintJob = printJob,
    retainedToast = toast,
    filingMessages = [];
  printJob = () => {
    throw new Error("Synthetic print preparation failure");
  };
  toast = (message) => filingMessages.push(message);
  ok(
    "Confirmed correction survives print preparation failure",
    (await issueCorrection(c)) === true && !doc(c.id).draft && serverRecord.events.filter((e) => e.type === "correction.issued").length === 1,
  );
  ok(
    "Print failure explains recovery without duplicate issue",
    filingMessages.includes("Correction saved; PDF filing needs a retry.") &&
      JSON.stringify(eventsFor("k1").filter((e) => e.type !== "correction.issued")) === raw,
  );
  printJob = retainedPrintJob;
  toast = retainedToast;
  console.log("Correction regressions: " + failures.length + " failure(s)");
  process.exit(failures.length ? 1 : 0);
};
try {
  eval(src + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);});");
} catch (e) {
  console.error(e);
  process.exit(1);
}
