const fs = require("fs"),
  path = require("path"),
  assert = require("assert/strict"),
  { JSDOM } = require("jsdom");
const html = fs.readFileSync(path.join(require("path").resolve(__dirname, "../.."), "build/dist/madison-document-writer.html"), "utf8"),
  payload = Buffer.from(/var B="([A-Za-z0-9+/=]+)"/.exec(html)[1], "base64").toString();
const dom = new JSDOM('<!doctype html><div id="app"></div><div id="overlay"></div><div id="toast"></div>', {
  url: "http://127.0.0.1:8777",
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = window.document;
global.localStorage = window.localStorage;
global.getSelection = () => window.getSelection();
window.scrollTo = () => {};
global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, caseStore: true, version: "2026.10.02.25" }) });
globalThis.MADISON_TEST_DATA = true;
async function test() {
  await new Promise((r) => setTimeout(r, 25));
  render = () => {};
  WriterState.CASEDIR = { helper: true };
  const local = { id: "case-merge", number: "QA-MERGE", owner: "Mine", address: "Base street", parcel: "Local parcel" },
    base = { ...local, owner: "Base", parcel: "Base parcel" },
    shared = { format: "madison-case-file", schema: 3, case: { ...base, owner: "Shared", address: "Shared street" }, inspectors: [], events: [] };
  const cmp = compareSharedCase(local, [], shared, { case: base, events: [] }, false);
  assert.equal(cmp.kind, "conflict");
  const merged = resolvedCaseFields(local, shared.case, cmp, { owner: { kind: "merge", value: "Reviewed owner" } });
  assert.equal(merged.owner, "Reviewed owner");
  assert.equal(merged.parcel, "Local parcel");
  assert.equal(merged.address, "Shared street");
  assert.equal(merged.id, local.id);
  assert.equal(merged.number, local.number);
  assert.throws(() => resolvedCaseFields(local, shared.case, cmp, {}));
  assert.throws(() => resolvedCaseFields(local, shared.case, cmp, { owner: { kind: "merge", value: { unexpected: true } } }));
  const spell = { ...shared, case: { ...local, number: "qa-merge" } };
  assert.notEqual(compareSharedCase(local, [], spell, { case: local, events: [] }, false).kind, "invalid");
  WriterState.CASES = [local];
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  WriterState.WORK = { entry: {}, recordForms: {} };
  WriterState.SAVE_CHECKPOINTS = {};
  WriterState.RECORD_ATTEMPTS = {};
  WriterState.LOCAL_SAVE_CHAIN = Promise.resolve();
  let committed = false;
  idbSet = async () => false;
  await assert.rejects(
    persistWorkspacePatch(
      (x) => x,
      () => {
        committed = true;
      },
    ),
  );
  assert.equal(committed, false);
  assert.equal(WriterState.WORK_PATCH, null);
  assert.equal(WriterState.CASES[0].owner, "Mine");
  let stored = null;
  idbSet = async (key, value) => {
    stored = clone(value);
    return true;
  };
  await persistWorkspacePatch(
    (staged) => {
      staged.cases[0].owner = "Reviewed";
      return staged;
    },
    (staged) => {
      WriterState.CASES = staged.cases;
    },
  );
  assert.equal(WriterState.CASES[0].owner, "Reviewed");
  assert.equal(stored.cases[0].owner, "Reviewed");
  assert.equal(WriterState.WORK_PATCH, null);
  console.log("PASS three-way field choices, independent changes, identity, type safety and durable workspace staging");
  process.exit(0);
}
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
