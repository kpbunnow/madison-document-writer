/* R23 client boundaries against the actual rebuilt Writer and Reports. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path");
const { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  src = bundleSource(html);
const dom = new JSDOM(html, { url: "http://127.0.0.1:8777/", pretendToBeVisual: true });
const w = dom.window;
global.window = w;
global.document = w.document;
global.localStorage = w.localStorage;
global.getSelection = () => w.getSelection();
global.confirm = () => true;
global.setTimeout = () => 0;
global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, version: "2026.10.01.23", caseStore: true }) });
globalThis.MADISON_TEST_DATA = true;
const tests = async () => {
  assert.equal(document.compatMode, "CSS1Compat");
  assert.equal(mailingMaxDay("notice", "2026-10-02"), "2026-10-07");
  assert.equal(mailingMaxDay("citation", "2026-10-02"), "2026-10-02");
  assert.equal(recordDay("2026-10-03T04:59:59Z"), "2026-10-02");
  assert.equal(recordDay("2026-10-03T05:00:00Z"), "2026-10-03");
  for (const no of ["QA/001", "QA_001", "ab", "a".repeat(81)]) assert.equal(validCaseNumber(no), false);
  assert.equal(validCaseNumber("qA-001"), true);
  assert.equal(caseNumberKey("qA-001"), "qa-001");
  // Failure isolation: later cases save, failed signatures remain retryable.
  const jobs = ["QA-FIRST", "QA-SECOND", "QA-THIRD"].map((number, n) => ({
    workspace: "a".repeat(32),
    case: String(n).repeat(32),
    backup: { number, bundle: { n }, pending: [], included: [] },
  }));
  const attempted = [];
  helperJSON = async (url, job) => {
    attempted.push(job.backup.number);
    if (job.backup.number === "QA-FIRST") throw new Error("disk failure");
    return { ok: true };
  };
  await backupUnfinished(jobs);
  assert.deepEqual(attempted, ["QA-FIRST", "QA-SECOND", "QA-THIRD"]);
  assert.match(WriterState.RECOVERY.error, /QA-FIRST: disk failure/);
  assert.equal(Object.keys(WriterState.RECOVERY_SIGNATURES).length, 2);
  helperJSON = async (url, job) => {
    attempted.push(job.backup.number);
    return { ok: true };
  };
  await backupUnfinished(jobs);
  assert.equal(attempted.at(-1), "QA-FIRST");
  assert.equal(attempted.length, 4);
  assert.equal(WriterState.RECOVERY.error, "");
  // Handoff errors distinguish disconnected storage from a missing record.
  WriterState.WRITER_READY = true;
  WriterState.WRITER_ACCESS = true;
  helperJSON = async () => {
    const e = new Error("The shared case folder is unavailable");
    e.name = "StorageError";
    throw e;
  };
  await assert.rejects(writerOpenReportedCase({ number: "QA-MISSING" }), /shared case folder is unavailable/);
  helperJSON = async () => {
    const e = new Error("missing");
    e.name = "NotFoundError";
    throw e;
  };
  await assert.rejects(writerOpenReportedCase({ number: "QA-MISSING" }), /No shared case exists/);
  // Field validation rejects invalid number without modifying the saved model.
  newDoc("k1", "notice");
  let d = doc(WriterState.state.docId),
    k = kase("k1");
  k.number = "QA-001";
  render();
  let field = document.querySelector('[data-case="number"]');
  field.textContent = "QA/001";
  field.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert.equal(field.getAttribute("aria-invalid"), "true");
  assert.equal(k.number, "QA-001");
  Object.defineProperty(field, "isContentEditable", { value: true });
  field.innerText = "Qa-001";
  field.textContent = "Qa-001";
  field.dispatchEvent(new w.Event("input", { bubbles: true }));
  assert.equal(k.number, "Qa-001");
  assert.equal(field.hasAttribute("aria-invalid"), false);
  field.classList.add("check-open");
  field.setAttribute("aria-invalid", "true");
  highlightOpenChecks();
  assert.equal(field.hasAttribute("aria-invalid"), false);
  d.type = "citation";
  d.items = [];
  render();
  assert.equal(document.querySelector('[data-doc="mailed"]').max, recordDay(today));
  d.mailed = mailingMaxDay("notice");
  assert.equal(
    lifecycleChecks(d).some((c) => c.t === mailingDateMessage("citation")),
    true,
  );
  d.type = "notice";
  d.mailed = recordDay(today);
  render();
  assert.equal(document.querySelector('[data-doc="mailed"]').max, mailingMaxDay("notice"));
  const reports = fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-reports.html"), "utf8");
  assert.equal(new JSDOM(reports).window.document.compatMode, "CSS1Compat");
  for (const s of [html, reports]) assert.doesNotMatch(s, /fonts\.gstatic\.com|Public Sans|Archivo|IBM Plex Mono/);
  console.log("PASS R23 client dates, backup isolation, handoff, case field errors and standards mode");
};
eval(src + "\n(" + tests.toString() + ")().catch(e=>{console.error(e);process.exitCode=1;})");
