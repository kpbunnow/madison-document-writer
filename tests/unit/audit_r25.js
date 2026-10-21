const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  { JSDOM } = require("jsdom");
const { builtPage, bundleSource } = require("../fixtures/built_bundle.cjs");
const html = builtPage(),
  src = bundleSource(html);
const dom = new JSDOM(html, { url: "http://127.0.0.1:8777/", pretendToBeVisual: true });
global.window = dom.window;
global.document = window.document;
global.localStorage = window.localStorage;
global.getSelection = () => window.getSelection();
global.confirm = () => true;
global.setTimeout = () => 0;
global.clearTimeout = () => {};
global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, version: "2026.10.02.25", caseStore: true }) });
window.scrollTo = () => {};
const tests = async () => {
  WriterState.CASES = [];
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  WriterState.PENDING = [{ cid: "other", name: "Other - QA-OTHER.json", body: "{}" }];
  WriterState.state.caseFilter = "all";
  WriterState.state.screen = "cases";
  for (const number of ["CB_2026_01", "CB 2026 01", "12", ""]) {
    const id = "legacy" + WriterState.CASES.length;
    WriterState.CASES.push({ id, number, address: "Legacy property", owner: "Legacy owner" });
    assert.doesNotThrow(() => render());
    assert.doesNotThrow(() => caseUnsaved(kase(id)));
    assert.doesNotThrow(() => summarize(caseFile(id)));
    assert.equal(caseState(kase(id)).label, "Case number needs correction");
    assert.equal(await saveCaseFile(id), false);
  }
  const existing = kase("legacy0");
  WriterState.SAVE_CHECKPOINTS[existing.id] = { case: clone(existing), events: [] };
  assert.equal(caseNumberAllowed(existing), true);
  assert.equal(caseFileName(existing), "Legacy property - CB_2026_01.json");
  assert.equal(caseNumberKey(" QA/001 "), "qa-001");
  assert.equal(caseNumberKey("QA  001"), "qa 001");
  assert.equal(caseNumberKey(""), "");
  WriterState.PENDING.push({ cid: existing.id, name: "Old spelling.json" });
  assert.equal(caseState(existing).pendingSync, true);
  assert.equal(caseFileName(kase("legacy3")), null);
  assert.equal(validCaseNumber("CB_2026_01"), false);
  const original = helperJSON,
    load = loadCaseFile;
  const requests = [];
  helperJSON = async (url) => {
    requests.push(url);
    throw Object.assign(new Error("missing"), { name: "NotFoundError" });
  };
  WriterState.WRITER_ACCESS = true;
  WriterState.WRITER_READY = true;
  await assert.rejects(writerOpenReportedCase({ number: "CB_2026_99" }), /No shared case/);
  assert.ok(
    requests.includes("/cases/resolve?number=CB_2026_99"),
    "Report handoff requests the exact legacy case; concurrent catalog reads do not replace this observation",
  );
  helperJSON = original;
  loadCaseFile = load;
  const shared = fs
    .readFileSync(path.join(require("path").resolve(__dirname, "../.."), "app/assets/shared.js"), "utf8")
    .replace(/const\s+MAILED_MAX_DAYS_AHEAD\s*=\s*5\s*;/, "const MAILED_MAX_DAYS_AHEAD=2;")
    .replace(/const\s+CITATION_MAX_DAYS_AHEAD\s*=\s*0\s*;/, "const CITATION_MAX_DAYS_AHEAD=1;")
    .replace(/export \{[^}]+\};/g, "");
  const messages = new Function(shared + ';return [mailingDateMessage("notice"),mailingDateMessage("citation")];')();
  assert.ok(messages[0].includes("2 days"));
  assert.ok(messages[1].includes("1 day"));
  console.log("PASS R25 legacy/blank Workspace, queued IDs, strict new saves, lenient report handoff and policy messages");
  process.exit(0);
};
eval(src + "\n(" + tests.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
