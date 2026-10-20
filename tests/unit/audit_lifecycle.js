/* Full case paths and interrupted working papers. Synthetic records only. */
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
  refreshCatalog = async () => true;
  WriterState.CATALOG_VERIFIED = true;
  const failures = [];
  let checksCount = 0;
  const ok = (label, v) => {
    checksCount++;
    if (!v) {
      failures.push(label);
      console.log("FAIL " + label);
    }
  };
  const realRender = render,
    originalCase = clone(kase("k1"));
  render = () => {};
  let disk = {},
    localOK = true,
    server = null,
    mode = "ok",
    posts = 0,
    pdfs = 0;
  idbSet = async (k, v) => {
    if (!localOK) return false;
    disk[k] = clone(v);
    return true;
  };
  idbGet = async (k) => clone(disk[k] || null);
  filePdf = async () => {
    pdfs++;
    return true;
  };
  writeSummary = async () => true;
  emailDocument = async () => true;
  helperJSON = async (url, body) => {
    posts++;
    if (mode === "reject") {
      const e = new Error("Conflicting case action");
      e.name = "StorageError";
      e.definitive = true;
      throw e;
    }
    if (!server) server = clone(body.file);
    else if (!server.events.some((e) => e.id === body.idempotencyEvent)) {
      server = clone(body.file);
    }
    if (mode === "lost") {
      mode = "ok";
      throw new Error("Response lost after write");
    }
    return { ok: true, file: clone(server), name: caseFileName(server.case), revision: "test" };
  };
  function fresh() {
    WriterState.CASES = [clone(originalCase)];
    WriterState.CASES[0].date = addDays(iso(today), -30);
    WriterState.CASES[0].savedAt = "";
    WriterState.DOCS = [];
    WriterState.REINSP = [];
    WriterState.EVENTS = {};
    WriterState.PENDING = [];
    WriterState.SAVE_CHECKPOINTS = {};
    WriterState.RECORD_ATTEMPTS = {};
    COMMITTED.clear();
    WriterState.WORK = { entry: {}, acc: null, recordForms: {} };
    WriterState.state.acc = null;
    WriterState.state.modal = null;
    WriterState.state.docId = null;
    WriterState.state.reinspId = null;
    WriterState.state.screen = "cases";
    WriterState.state.amendmentError = "";
    WriterState.CASEDIR = { helper: true };
    WriterState.HELPER = { caseStore: true };
    server = null;
    mode = "ok";
    localOK = true;
  }
  function notice(count = 3) {
    newDoc(WriterState.CASES[0].id, "notice");
    let d = doc(WriterState.state.docId);
    d.items = Array.from({ length: count }, (_, n) => ({
      id: uid("x"),
      no: String(n + 1),
      sections: ["27.05(2)(c)"],
      title: "Condition " + (n + 1),
      text: "Repair the condition.",
      due: futureDue(iso(today), 21),
      prov: "notice",
      done: false,
      doneOn: "",
    }));
    return d;
  }
  function visit(src, outcomes) {
    startReinspection(src.caseId);
    const r = reinsp(WriterState.state.reinspId);
    r.time = "10:15";
    src.items.forEach((i, n) => {
      if (i.done || i.withdrawn) return;
      r.results[i.id] = { oc: outcomes[n], on: r.date, due: futureDue(r.date, 21), note: "Observed item " + i.no, cite: false };
    });
    return r;
  }
  let paths = 0;
  for (const a of OUTCOMES)
    for (const b of OUTCOMES)
      for (const c of OUTCOMES) {
        const outcomes = [a.id, b.id, c.id],
          remaining = outcomes.filter((o) => o !== "corrected").length;
        for (const type of ["extension", "citation", "referral", "compliance"]) {
          fresh();
          let n = notice();
          issueDocument(n);
          let src = doc(n.id),
            r = visit(src, outcomes);
          if (type === "citation" && remaining) {
            const target = src.items.find((i) => r.results[i.id].oc !== "corrected");
            r.results[target.id].cite = true;
          }
          docFromReinspection(r, type);
          const d = draftDocFor(src.caseId),
            allowed = type === "compliance" ? !remaining : !!remaining;
          ok("Allowed transition " + outcomes + "/" + type, !!d === allowed);
          if (!d) continue;
          paths++;
          ok("Complete numbered list " + paths, d.items.length === 3 && d.items.map((i) => i.no).join(",") === "1,2,3");
          ok("Validated document " + paths, blockers(d).length === 0);
          issueDocument(d);
          let published = doc(d.id),
            sum = summarize(caseFile(src.caseId));
          ok("One visit and one follow-up " + paths, sum.visits.length === 1 && sum.documents.length === 2);
          ok(
            "Outcomes retained " + paths,
            published.items.every((i, n) => i.done === (outcomes[n] === "corrected")),
          );
          ok("Case round trip " + paths, caseFileFault(caseFile(src.caseId)) === "");
          if (type === "referral")
            ok(
              "Current visit in referral history " + paths,
              published.items.every((i) => i.hist.some((x) => x.note === "Observed item " + i.no)),
            );
          if (type === "compliance") {
            ok("Closure consistency " + paths, caseState(WriterState.CASES[0]).closed && sum.case.status === "Closed");
            let count = WriterState.REINSP.length;
            startReinspection(src.caseId);
            ok("No visit after closure " + paths, WriterState.REINSP.length === count);
          } else {
            let last = visit(published, ["corrected", "corrected", "corrected"]);
            docFromReinspection(last, "compliance");
            const close = draftDocFor(src.caseId);
            ok("Completion allowed " + paths, !!close);
            if (close) {
              issueDocument(close);
              const end = summarize(caseFile(src.caseId));
              ok(
                "Final closure retains every record " + paths,
                end.documents.length === 3 &&
                  end.visits.length === 2 &&
                  end.violations.every((i) => i.done) &&
                  caseState(WriterState.CASES[0]).closed,
              );
            }
          }
        }
      }
  console.log("Enumerated " + paths + " allowed document paths across all 64 three-item outcome combinations.");
  fresh();
  let n = notice(2);
  let r;
  let before = JSON.stringify(eventsFor(n.caseId));
  mode = "reject";
  ok(
    "Rejected initial issuance stays a draft",
    (await publishDocument(n)) === false && doc(n.id).draft && JSON.stringify(eventsFor(n.caseId)) === before,
  );
  mode = "lost";
  const printBefore = pdfs;
  ok(
    "Uncertain issuance is retained",
    (await publishDocument(n)) === false && !!n.pendingAmendment && eventsFor(n.caseId).length === 0 && pdfs === printBefore,
  );
  const attempt = n.pendingAmendment.id;
  await saveDrafts();
  ok(
    "Exact issuance attempt survives device backup",
    disk.drafts.docs.some((d) => d.pendingAmendment && d.pendingAmendment.id === attempt),
  );
  ok(
    "Retry confirms one issued notice",
    (await publishDocument(n)) && !doc(n.id).draft && eventsFor(n.caseId).length === 1 && server.events.length === 1,
  );
  n = doc(n.id);
  r = visit(n, ["progress", "corrected"]);
  docFromReinspection(r, "extension");
  let d = draftDocFor(n.caseId),
    visitId = r.id;
  mode = "reject";
  before = JSON.stringify(eventsFor(n.caseId));
  ok(
    "Rejected follow-up retains both working papers",
    (await publishDocument(d)) === false && reinsp(visitId).draft && doc(d.id).draft && JSON.stringify(eventsFor(n.caseId)) === before,
  );
  mode = "lost";
  ok("Uncertain visit and document commit together", (await publishDocument(d)) === false && server.events.length === 3 && reinsp(visitId).draft);
  ok(
    "Retry creates no duplicate visit",
    (await publishDocument(d)) && reinspFor(n.caseId).length === 1 && !reinsp(visitId).draft && eventsFor(n.caseId).length === 3,
  );
  fresh();
  n = notice(1);
  localOK = false;
  const postsBefore = posts;
  ok("Local save failure prevents network issuance", (await publishDocument(n)) === false && posts === postsBefore && n.draft);
  WriterState.state.screen = "write";
  ok("Save and continue stays on screen when storage fails", (await saveAndContinue()) === false && WriterState.state.screen === "write");
  localOK = true;
  fresh();
  n = notice(2);
  issueDocument(n);
  n = doc(n.id);
  r = visit(n, ["progress", "none"]);
  docFromReinspection(r, "extension");
  d = draftDocFor(n.caseId);
  d.items[0].text = "A carefully edited draft description.";
  ok("Return to worksheet retains prior draft", returnToWorksheet(d) && !doc(d.id) && r.previousDraft.items[0].text === d.items[0].text);
  const originalDate = r.date;
  changeVisitDate(r, addDays(originalDate, -1));
  ok(
    "Default result dates follow changed visit date",
    Object.values(r.results).every((x) => x.on === r.date),
  );
  ok(
    "Prior draft and inspection restore together",
    restorePreviousDraft(r) && doc(d.id).items[0].text === d.items[0].text && r.date === originalDate,
  );
  ok("Cannot orphan a follow-up by discarding its visit", discardWorksheet(r.id) === false && !!doc(d.id) && !!reinsp(r.id));
  fresh();
  n = notice(1);
  issueDocument(n);
  n = doc(n.id);
  r = visit(n, ["corrected"]);
  recordReinspection(r);
  r = reinsp(r.id);
  ok("Recorded visit without a letter is resumable", unissuedVisitFor(n.caseId).id === r.id);
  docFromReinspection(r, "compliance");
  d = draftDocFor(n.caseId);
  ok("Recorded visit can produce its missing letter", !!d);
  if (d) {
    issueDocument(d);
    ok("Completing recorded visit does not count it twice", reinspFor(n.caseId).length === 1);
  }
  fresh();
  n = notice(1);
  issueDocument(n);
  n = doc(n.id);
  r = visit(n, ["progress"]);
  r.results[n.items[0].id].on = addDays(r.date, 1);
  ok(
    "A future-to-visit outcome cannot issue",
    worksheetFaults(r, "extension").some((x) => x.includes("Result dates")),
  );
  docFromReinspection(r, "extension");
  ok("Invalid result blocks draft generation", !draftDocFor(n.caseId));
  fresh();
  n = notice(2);
  issueDocument(n);
  n = doc(n.id);
  const imported = { date: addDays(iso(today), -1), time: "14:35", inspectorId: "i1", type: "Reinspection", typeKey: "reinspection" };
  startReinspection(n.caseId, imported);
  r = reinsp(WriterState.state.reinspId);
  ok(
    "Imported reinspection date and time initialize the worksheet",
    r.date === imported.date && r.time === imported.time && r.importInspection.date === imported.date,
  );
  r.results[n.items[0].id] = { oc: "progress", on: r.date, due: addDays(r.date, 21), note: "Checked", cite: false };
  r.results[n.items[1].id] = { oc: "none", on: r.date, due: addDays(r.date, 27), note: "Checked", cite: false };
  ok(
    "Reinspection due dates six days apart are blocked",
    worksheetFaults(r, "extension").some((x) => x.includes("seven days")),
  );
  r.results[n.items[1].id].due = addDays(r.date, 28);
  ok("Reinspection due dates seven days apart pass spacing", !worksheetFaults(r, "extension").some((x) => x.includes("seven days")));
  docFromReinspection(r, "extension");
  d = draftDocFor(n.caseId);
  ok("Generated follow-up uses imported inspection date and time", !!d && d.inspDate === imported.date && d.inspTime === imported.time);
  d.inspTime = "";
  ok(
    "Blank document inspection time targets its header field",
    checks(d).some((c) => !c.ok && /inspection time/.test(c.t) && c.targets.some((t) => t.selector === '[data-doc="inspTime"]')),
  );
  d.inspTime = imported.time;
  r.time = "";
  ok(
    "Blank reinspection time blocks worksheet generation",
    worksheetFaults(r, "extension").some((x) => x.includes("time")),
  );
  fresh();
  n = notice(1);
  issueDocument(n);
  n = doc(n.id);
  r = visit(n, ["none"]);
  docFromReinspection(r, "referral");
  d = draftDocFor(n.caseId);
  issueDocument(d);
  r = visit(doc(d.id), ["progress"]);
  docFromReinspection(r, "extension");
  ok("Referral cannot return to extension", !draftDocFor(n.caseId));
  docFromReinspection(r, "citation");
  ok("Referral cannot return to citation", !draftDocFor(n.caseId));
  docFromReinspection(r, "referralUpdate");
  d = draftDocFor(n.caseId);
  ok("Referral update has no invented due date", !!d && d.items.every((i) => i.due === ""));
  fresh();
  WriterState.WORK.entry = { "lookup-number": "CB2026-001-00001" };
  WriterState.state.screen = "import";
  WriterState.LOOKUP_BUSY = true;
  await saveAndContinue();
  ok(
    "Saving lookup cancels busy state and exposes resume",
    !WriterState.LOOKUP_BUSY && hasSetupWork() && importResumePanel().includes("Continue search"),
  );
  for (const value of ["13:00 PM", "0:00 AM", "09:00garbage", "09:00:99", "24:00", "12:60"])
    ok("Invalid time rejected: " + value, parseTime(value) === null && accTime(value) === null);
  for (const [value, want] of [
    ["12:00 AM", "00:00"],
    ["12:00 PM", "12:00"],
    ["9:05:30 PM", "21:05"],
    ["09:05:00", "09:05"],
    ["0:00", "00:00"],
  ])
    ok("Valid time normalized: " + value, parseTime(value) === want && accTime(value) === want);
  fresh();
  render = realRender;
  WriterState.state.screen = "import";
  WriterState.WORK.entry = { "lookup-number": "CB2026-001-00001" };
  render();
  document.getElementById("acc-cancel").click();
  ok("Clear search removes resumable import", !hasSetupWork() && !WriterState.WORK.entry["lookup-number"]);
  fresh();
  render = realRender;
  WriterState.state.screen = "import";
  render();
  ok(
    "Manual case and CSV entry options removed",
    !document.getElementById("m-go") && !document.getElementById("imp-go") && !document.getElementById("imp-csv"),
  );
  ok("Import screen exposes the SSRS report flow", !!document.getElementById("acc-pick"));
  render = () => {};
  fresh();
  n = notice(1);
  issueDocument(n);
  n = doc(n.id);
  r = visit(n, ["progress"]);
  r.results[n.items[0].id].on = "";
  ok("Legacy implicit result date is normalized", worksheetFaults(r, "extension").length === 0 && cleanVisit(r).results[n.items[0].id].on === r.date);
  r.results[n.items[0].id].manualDate = true;
  ok("An explicitly cleared result date is not silently replaced", worksheetFaults(r, "extension").length > 0);
  fresh();
  n = notice(1);
  n.items[0].cite = true;
  await publishDocument(n);
  d = docsFor(n.caseId).find((x) => x.type === "citation" && !x.draft);
  ok("Notice and completed citation issue in one batch", d && eventsFor(n.caseId).length === 2 && !draftDocFor(n.caseId));
  fresh();
  n = notice(1);
  n.items[0].cite = true;
  issueDocument(n);
  n = doc(n.id);
  ok(
    "Legacy interrupted initial citation can be resumed visibly",
    needsInitialCitation(n) && citationRecoveryPanel(n).includes("Create citation draft"),
  );
  d = citationFromNotice(n.id);
  ok(
    "Initial citation recovery cannot duplicate the draft",
    citationFromNotice(n.id).id === d.id && WriterState.DOCS.filter((x) => x.draft && x.type === "citation").length === 1,
  );
  issueDocument(d);
  d = doc(d.id);
  const courtBefore = citationFaces(d);
  const oldCourt = COURT.addr;
  COURT.addr = "CHANGED LATER";
  ok("Issued court form retains frozen court details", citationFaces(d) === courtBefore);
  COURT.addr = oldCourt;
  fresh();
  n = notice(1);
  issueDocument(n);
  appendEvent(n.caseId, "document.voided", { docId: n.id, reason: "Entered on the wrong case." });
  project();
  ok(
    "Withdrawn original remains visible as completed history",
    caseState(WriterState.CASES[0]).closed &&
      caseState(WriterState.CASES[0]).label === "Withdrawn" &&
      summarize(caseFile(n.caseId)).case.status === "Withdrawn",
  );
  const ordered = [
    { id: "second", at: "2026-09-01T15:00:00.001Z" },
    { id: "first", at: "2026-09-01T15:00:00Z" },
  ].sort(byTime);
  ok("Mixed timestamp precision preserves real event order", ordered[0].id === "first");
  fresh();
  n = notice(1);
  issueDocument(n);
  n = doc(n.id);
  r = visit(n, ["progress"]);
  docFromReinspection(r, "referral");
  d = draftDocFor(n.caseId);
  issueDocument(d);
  d = doc(d.id);
  const originalHistory = clone(d.items[0].hist),
    amend = startCorrection(d.id);
  amend.correction.outcomes[amend.items[0].id] = "none";
  ok(
    "Referral correction changes the printed same-visit history",
    documentItemHistory(amend, amend.items[0]).some((h) => h.visitId === r.id && h.oc === "none") &&
      JSON.stringify(doc(d.id).items[0].hist) === JSON.stringify(originalHistory),
  );
  const keep = JSON.stringify(draftBundle());
  try {
    await restoreWorkspaceBackup({ format: "madison-workspace-backup", version: 1, bundle: clone(draftBundle()) });
    ok("Backup rejects an occupied workspace", false);
  } catch (e) {
    ok(
      "Backup rejects an occupied workspace",
      /empty workspace/.test(e.message) && JSON.stringify(draftBundle().docs) === JSON.stringify(JSON.parse(keep).docs),
    );
  }
  fresh();
  render = realRender;
  n = notice(1);
  kase(n.caseId).emails = [{ addr: "synthetic@example.invalid", kind: "Property Owner" }];
  WriterState.HELPER = { chrome: true };
  WriterState.state.docId = n.id;
  WriterState.state.screen = "write";
  WriterState.state.modal = "final";
  render();
  document.querySelector("[data-finsend]").checked = false;
  await saveAndContinue();
  WriterState.state.docId = n.id;
  WriterState.state.screen = "write";
  WriterState.state.modal = "final";
  render();
  ok("Issue-review recipient choice survives save and continue", document.querySelector("[data-finsend]").checked === false);
  render = () => {};
  console.log("Lifecycle checks: " + checksCount + " assertions, " + failures.length + " failures.");
  if (failures.length) console.log(failures.join("\n"));
  process.exit(failures.length ? 1 : 0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);});");
