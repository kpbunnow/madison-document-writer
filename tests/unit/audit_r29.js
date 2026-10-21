/* R29 navigation and continuity regressions with synthetic case data. */
globalThis.MADISON_TEST_DATA = true;
const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  payload = bundleSource(html);
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777/",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.confirm = () => true;
global.fetch = async () => {
  throw new Error("offline");
};
const test = async () => {
  await new Promise((r) => setTimeout(r, 25));
  WriterState.DOCS = [];
  WriterState.EVENTS = {};
  WriterState.REINSP = [];
  WriterState.PENDING = [];
  saveDrafts = async () => true;
  const actualRender = render;
  newDoc("k1", "notice");
  const d = doc(WriterState.state.docId);
  d.items = [
    {
      id: "typing-item",
      no: "1",
      title: "Synthetic test",
      text: "Repair.",
      sections: ["27.05(2)(c)"],
      cite: true,
      due: addDays(recordDay(today), 21),
    },
  ];
  initialCitations.prepare(d);
  editCitation(d, "typing-item", "depositMode", "total");
  editCitation(d, "typing-item", "amount", "250.00");
  editCitation(d, "typing-item", "depositSource", "Synthetic approved total including assessments.");
  editCitation(d, "typing-item", "desc", "APPROVED DESCRIPTION");
  render();
  const input = document.querySelector('[data-review-cit="typing-item|ord"]');
  assert.ok(input);
  input.focus();
  for (let n = 1; n <= "MGO 27.05 (2) (c)".length; n++) {
    input.value = "MGO 27.05 (2) (c)".slice(0, n);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    assert.equal(d.cits["typing-item"].amount, "250.00");
    assert.ok(input.isConnected);
  }
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
  const c = d.cits["typing-item"];
  assert.equal(c.ord, "27.05(2)(c)");
  assert.equal(c.depositMode, "total");
  assert.equal(c.amount, "250.00");
  assert.equal(c.depositSource, "Synthetic approved total including assessments.");
  assert.equal(c.desc, "APPROVED DESCRIPTION");
  assert.ok(!("ordEditingFrom" in c));
  // Saving during an edit retains its original comparison basis for reopening.
  editCitation(d, "typing-item", "ord", "MGO 27.05 (2) (c)", "input");
  d.cits = clone(d.cits);
  commitCitationEdits(d);
  assert.equal(d.cits["typing-item"].amount, "250.00");
  assert.ok(!("ordEditingFrom" in d.cits["typing-item"]));
  editCitation(d, "typing-item", "ord", "27.05(2)(a)", "input");
  assert.equal(d.cits["typing-item"].depositMode, "total");
  commitCitationEdits(d);
  assert.equal(d.cits["typing-item"].depositMode, "schedule");
  assert.ok(d.cits["typing-item"].resolvedVia === "ladder");
  assert.ok(!("ordEditingFrom" in d.cits["typing-item"]));
  assert.equal(d.cits["typing-item"].desc, "APPROVED DESCRIPTION");
  // Publication must normalize an in-progress charge before validation.
  editCitation(d, "typing-item", "depositMode", "total");
  editCitation(d, "typing-item", "amount", "250.00");
  editCitation(d, "typing-item", "depositSource", "Synthetic approved total including assessments.");
  editCitation(d, "typing-item", "ord", "UNKNOWN", "input");
  WriterState.CASEDIR = { helper: true };
  refreshCatalog = async () => true;
  assert.equal(await publishDocument(d), false);
  assert.equal(d.draft, true);
  assert.equal(d.cits["typing-item"].depositMode, "schedule");
  assert.ok(!("ordEditingFrom" in d.cits["typing-item"]));
  assert.equal(eventsFor("k1").length, 0);
  render = () => {};
  const messages = [];
  const originalToast = toast;
  toast = (message) => messages.push(message);
  WriterState.state.screen = "write";
  saveDrafts = async () => false;
  assert.equal(await navigation.navigate("tools"), false);
  assert.equal(WriterState.state.screen, "write");
  assert.ok(messages.some((m) => m.includes("could not be saved")));
  const beforeBackup = JSON.stringify(d),
    oldDownload = downloadWorkspace;
  let emergencyBackups = 0;
  downloadWorkspace = () => {
    emergencyBackups++;
  };
  document.querySelector("[data-workbackup]").click();
  assert.equal(emergencyBackups, 1);
  assert.equal(JSON.stringify(d), beforeBackup);
  downloadWorkspace = oldDownload;
  saveDrafts = async () => {
    throw new Error("Synthetic storage failure");
  };
  assert.equal(await navigation.navigate("cases"), false);
  assert.equal(WriterState.state.screen, "write");
  assert.equal(await saveAndContinue(), false);
  assert.equal(WriterState.state.screen, "write");
  assert.ok(document.querySelector("[data-workbackup]"));
  const failureDialog = document.createElement("div");
  failureDialog.setAttribute("role", "dialog");
  document.getElementById("overlay").append(failureDialog);
  assert.equal(await saveAndContinue(), false);
  assert.ok(failureDialog.querySelector("[data-workbackup]"));
  failureDialog.remove();
  const deferred = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  };
  const pending = deferred();
  saveDrafts = () => pending.promise;
  const waiting = navigation.navigate("tools");
  assert.equal(WriterState.state.screen, "write");
  pending.resolve(true);
  assert.equal(await waiting, true);
  assert.equal(WriterState.state.screen, "tools");
  WriterState.state.screen = "write";
  const first = deferred(),
    second = deferred();
  let calls = 0;
  saveDrafts = () => (++calls === 1 ? first.promise : second.promise);
  const firstNav = navigation.navigate("import"),
    lastNav = navigation.navigate("library");
  first.resolve(true);
  assert.equal(await firstNav, false);
  assert.equal(WriterState.state.screen, "write");
  second.resolve(true);
  assert.equal(await lastNav, true);
  assert.equal(WriterState.state.screen, "library");
  WriterState.state.screen = "write";
  const revision = deferred();
  calls = 0;
  saveDrafts = () => {
    ++WriterState.LOCAL_CHANGED;
    return ++calls === 1 ? revision.promise : Promise.resolve(true);
  };
  const revisionNav = navigation.navigate("tools");
  ++WriterState.LOCAL_CHANGED;
  revision.resolve(true);
  assert.equal(await revisionNav, true);
  assert.equal(calls, 2, "Edits while saving require a fresh snapshot before leaving");
  saveDrafts = async () => true;
  const rail = document.createElement("nav");
  WriterState.REPORT_RETURN = true;
  WriterState.state.screen = "caseactions";
  rail.innerHTML = navigation.rail();
  assert.equal(rail.children.length, 5);
  assert.equal(rail.querySelectorAll("[data-report-return]").length, 1);
  assert.equal(rail.querySelectorAll("a").length, 0);
  assert.equal(rail.querySelector('[data-nav="cases"]').getAttribute("aria-current"), "page");
  WriterState.REPORT_RETURN = false;
  assert.equal(
    navigation.helperVersion(),
    JSON.parse(fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/generated/runtime-manifest.json"), "utf8"))
      .helperVersion,
  );
  const utility = A11Y.utility,
    shown = [];
  A11Y.utility = (title, body) => shown.push({ title, body });
  const old = deferred(),
    fresh = deferred();
  calls = 0;
  helperJSON = () => (++calls === 1 ? old.promise : fresh.promise);
  const oldHealth = showHealth(),
    newHealth = showHealth(true);
  fresh.resolve({ version: navigation.helperVersion(), versionMatch: true, checkedAt: "NEW" });
  await newHealth;
  old.resolve({ version: "2026.10.01.24", versionMatch: true, checkedAt: "OLD" });
  assert.equal(await oldHealth, false);
  assert.equal(shown.length, 1);
  assert.ok(shown[0].body.includes("<td>Match</td>"));
  assert.equal(WriterState.SAFETY_HEALTH.checkedAt, "NEW");
  const stale = deferred();
  helperJSON = () => stale.promise;
  const late = showSafety();
  assert.equal(shown.length, 2, "R44 opens device recovery before health completes");
  assert.ok(shown[1].body.includes("Checking connection"));
  await navigation.navigate("cases");
  stale.resolve({ checkedAt: "NAV-STALE" });
  assert.equal(await late, false);
  assert.equal(WriterState.SAFETY_HEALTH.checkedAt, "NEW");
  assert.equal(shown.length, 2, "Late health cannot replace the navigated screen");
  const outbox = deferred();
  helperJSON = () => outbox.promise;
  const lateOutbox = showOutbox();
  navigation.invalidateUtilities();
  outbox.resolve({ files: [{ name: "stale.pdf", size: 100 }] });
  assert.equal(await lateOutbox, false);
  assert.ok(!WriterState.OUTBOX_FILES.some((x) => x.name === "stale.pdf"));
  helperJSON = async () => ({ version: "2026.10.01.24", versionMatch: true });
  await showHealth();
  assert.ok(shown.at(-1).body.includes("Mismatch or helper unavailable"));
  A11Y.utility = utility;
  toast = originalToast;
  render = actualRender;
  WriterState.WRITER_READY = true;
  WriterState.WRITER_ACCESS = true;
  window.focus = () => {};
  preflightCase = async (cid, reason, continuation) => continuation();
  WriterState.REPORT_RETURN = false;
  await writerOpenReportedCase({ number: kase("k1").number });
  assert.equal(document.querySelectorAll("[data-report-return]").length, 1);
  WriterState.REPORT_RETURN = false;
  WriterState.state.screen = "tools";
  render();
  A11Y.enhance();
  assert.equal(document.querySelectorAll(".writer-navigation .rail-item").length, 5);
  assert.ok(document.querySelector("[data-a11y-history]"));
  console.log(
    "PASS R29 typed charge preservation, resumed edits, commit validation, fa" +
      "iled/delayed/latest navigation, edits during save, consolidated rail, ma" +
      "tching helper versions and stale utilities",
  );
  process.exit(0);
};
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
