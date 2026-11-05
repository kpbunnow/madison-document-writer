/* The workspace is cleared each time Document Writer closes (owner request 2026-11-05): on Exit after the helper stops,
   and at the next start when the last session ended without Exit. Unfinished work is never cleared without the
   inspector's confirmation; queued shared saves are not workspace work and stay. */
const assert = require("node:assert/strict"),
  path = require("node:path"),
  esbuild = require("esbuild");
(async () => {
  const dir = path.resolve("app/modules");
  const built = await esbuild.build({
    stdin: { contents: "export * from './session_close.js';export {WriterState} from './state.js';", resolveDir: dir },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.resolve("build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { unfinishedWork, clearWorkspace, exitClearHTML, exitClearConfirmed, startSession, markSessionClosed, WriterState: s } = box.exports;
  let store,
    calls,
    dialogs,
    helper = "run-2";
  const reset = (cases = []) => {
    store = {};
    calls = [];
    dialogs = [];
    Object.assign(s, {
      CASES: cases,
      DOCS: [],
      REINSP: [],
      PENDING: [{ cid: "queued" }],
      WORK: { entry: {}, acc: null, recordForms: {} },
      state: { acc: null, docId: null, reinspId: null, screen: "cases" },
    });
  };
  const unsaved = { "BI-RISKY": "unfinished drafts" };
  const services = () => ({
    caseUnsaved: (k) => unsaved[k.number] || "",
    removeCase: (id) => {
      calls.push(["remove", id]);
      if (id === "held") return false; // a pending save confirmation keeps the case
      s.CASES = s.CASES.filter((k) => k.id !== id);
    },
    saveDrafts: async () => calls.push(["save"]),
    idbGet: async (key) => store[key],
    idbSet: async (key, value) => {
      store[key] = value;
      return true;
    },
    A11Y: { utility: (title, body) => dialogs.push({ title, body }) },
    instance: () => helper,
    render: () => calls.push(["render"]),
    toast: (t) => calls.push(["toast", t]),
  });
  global.document = { querySelector: () => null, getElementById: () => null };
  const safe = { id: "safe", number: "BI-SAFE" },
    risky = { id: "risky", number: "BI-RISKY" },
    held = { id: "held", number: "BI-HELD" };

  // Unfinished work is listed by case, with an import in progress.
  reset([safe, risky]);
  assert.deepEqual(unfinishedWork(services().caseUnsaved), ["BI-RISKY: unfinished drafts"]);
  s.WORK.entry["lookup-number"] = "CB2026-1-1";
  assert.deepEqual(unfinishedWork(services().caseUnsaved), ["BI-RISKY: unfinished drafts", "An inspection import in progress"]);

  // Exit: the dialog says the workspace is cleared; unfinished work needs its own confirmation.
  const form = (checked) => ({ elements: { clearUnfinished: checked === undefined ? undefined : { checked } } });
  assert.match(exitClearHTML(services().caseUnsaved), /Exit removes the cases, drafts, worksheets and notes/);
  assert.match(exitClearHTML(services().caseUnsaved), /name="clearUnfinished" required/);
  assert.equal(exitClearConfirmed(form(false), services().caseUnsaved), false);
  assert.equal(exitClearConfirmed(form(true), services().caseUnsaved), true);
  reset([safe]);
  assert.doesNotMatch(exitClearHTML(services().caseUnsaved), /clearUnfinished/, "saved work needs no confirmation");
  assert.equal(exitClearConfirmed(form(), services().caseUnsaved), true);
  reset();
  assert.equal(exitClearHTML(services().caseUnsaved), "", "an empty workspace says nothing");

  // Clearing removes every case it can and the import work; a held case and queued shared saves stay.
  reset([safe, risky, held]);
  s.state.acc = { id: "import" };
  s.WORK.acc = { id: "import" };
  s.WORK.entry = { "lookup-number": "CB2026-1-1" };
  assert.equal(await clearWorkspace(services()), 1);
  assert.deepEqual(
    s.CASES.map((k) => k.id),
    ["held"],
  );
  assert.equal(s.state.acc, null);
  assert.deepEqual(s.WORK.entry, {});
  assert.deepEqual(s.PENDING, [{ cid: "queued" }]);
  assert.deepEqual(calls.at(-1), ["save"]);

  // Start: a first start (no marker) and a start after Exit clear nothing; both mark this session open.
  reset([safe, risky]);
  await startSession(services());
  assert.equal(s.CASES.length, 2);
  assert.equal(store.session.open, true);
  await markSessionClosed(services().idbSet);
  await startSession(services());
  assert.equal(s.CASES.length, 2, "after Exit nothing is cleared at start");

  // A page reload while the same helper keeps running is not a close; without a helper instance nothing is cleared.
  reset([safe]);
  store.session = { open: true, instance: "run-2" };
  await startSession(services());
  assert.equal(s.CASES.length, 1, "a reload keeps the workspace");
  helper = "";
  store.session = { open: true, instance: "run-1" };
  await startSession(services());
  assert.equal(s.CASES.length, 1, "no helper instance, nothing cleared");
  helper = "run-2";

  // After a session that ended without Exit (a later run of the helper): saved work is cleared at once.
  reset([safe]);
  store.session = { open: true, instance: "run-1" };
  await startSession(services());
  assert.equal(s.CASES.length, 0);
  assert.equal(dialogs.length, 0);

  // Unfinished work waits for the inspector's confirmation in a dialog.
  reset([safe, risky]);
  store.session = { open: true, instance: "run-1" };
  await startSession(services());
  assert.equal(s.CASES.length, 2, "nothing is cleared without confirmation");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(dialogs.length, 1);
  assert.equal(dialogs[0].title, "Document Writer was not exited last time");
  assert.match(dialogs[0].body, /BI-RISKY: unfinished drafts/);
  assert.match(dialogs[0].body, /name="clearUnfinished" required/);
  assert.match(dialogs[0].body, /data-workbackup/);
  console.log("PASS workspace cleared on close: Exit confirmation, startup after an unclean close, held cases and queued saves kept");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
