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
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  WriterState.WORK = { entry: {}, recordForms: {} };
  newDoc("k1", "notice");
  const first = doc(WriterState.state.docId);
  newDoc("k2", "notice");
  const second = doc(WriterState.state.docId);
  const future = addDays(recordDay(today), 40);
  first.items = [
    { id: "item-a", due: addDays(recordDay(today), 10) },
    { id: "item-b", due: addDays(recordDay(today), 20) },
    { id: "item-c", due: addDays(recordDay(today), 30) },
  ];
  second.items = [{ id: "item-d", due: "" }];
  const before = JSON.stringify(WriterState.DOCS);
  const plan = planBulkDue(
    [
      { docId: first.id, itemId: "item-a" },
      { docId: second.id, itemId: "item-d" },
    ],
    future,
  );
  assert.equal(plan.get(first.id).items[0].due, future);
  assert.equal(plan.get(second.id).items[0].due, future);
  assert.equal(JSON.stringify(WriterState.DOCS), before);
  assert.throws(() => planBulkDue([{ docId: first.id, itemId: "item-a" }], addDays(recordDay(today), 21)), /seven/);
  first.items.push({ id: "item-e", due: "" });
  assert.throws(() => planBulkDue([{ docId: first.id, itemId: "item-e" }], future), /three/);
  second.draft = false;
  assert.throws(
    () =>
      planBulkDue(
        [
          { docId: first.id, itemId: "item-a" },
          { docId: second.id, itemId: "item-d" },
        ],
        future,
      ),
    /editable/,
  );
  second.draft = true;
  first.cits = { item: { num: "CIT-9876" } };
  first.frozen = { case: { owner: "Historic owner", address: "Historic street" } };
  assert.ok(caseSearchText(kase("k1")).includes("cit-9876"));
  assert.ok(caseSearchText(kase("k1")).includes("historic owner"));
  assert.equal(WriterState.WORKFLOW_PREFS.reminders.enabled, false);
  assert.ok(csvText([["=unsafe", "+unsafe", "@unsafe", "-unsafe", -12, 'A,"B"']]).includes('"\'=unsafe"'));
  assert.ok(csvText([[-12]]).includes('"-12"'));
  await WriterState.LOCAL_SAVE_CHAIN;
  let release;
  const disk = [];
  let count = 0;
  idbSet = async (key, value) => {
    disk.push(clone(value));
    if (++count === 1)
      await new Promise((resolve) => {
        release = resolve;
      });
    return true;
  };
  const patch = persistWorkspacePatch(
    (staged) => {
      staged.cases[0].owner = "Durable reviewed owner";
      return staged;
    },
    (staged) => {
      WriterState.CASES = staged.cases;
    },
  );
  await Promise.resolve();
  await Promise.resolve();
  assert.ok(release);
  const autosave = saveDrafts();
  release();
  await patch;
  await autosave;
  assert.equal(disk.at(-1).cases[0].owner, "Durable reviewed owner");
  assert.equal(WriterState.WORK_PATCH, null);
  console.log("PASS batch draft validation, issued protection, citation/history search," + " CSV neutralization and concurrent autosave durability");
  process.exit(0);
}
eval(payload + "\n(" + test.toString() + ")().catch(e=>{console.error(e);process.exit(1);})");
