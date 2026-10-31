/* Working-draft recovery clicks against the retained module: id and attribute priority, every action's peer calls in
   order with the state they see, filing retries, and refusal on the first interrupted read or call. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder, listenerTarget } = require("../fixtures/equivalence_harness.cjs");

process.on("unhandledRejection", () => {});
const { random, pick, chance } = prng(20261202);

const IDS = [
  "btn-savework",
  "btn-workbackup",
  "btn-workrestore",
  "btn-retrypublish",
  "btn-editvisit",
  "btn-previousdraft",
  "btn-exportprevious",
  "btn-retryfiling",
  "btn-continuecitation",
  "btn-unknown",
  "",
];

function scenario() {
  return {
    none: chance(10),
    id: pick(IDS),
    workbackup: chance(8),
    worknote: pick(["", "", "", "doc:recordnote", "gone:void", "doc:reconcile", "nocolon"]),
    forms: pick([{}, { "doc:recordnote": { text: "x" } }, { "doc:reconcile": {} }, { nocolon: {} }]),
    docs: [{ id: "doc", draft: chance(3), type: "notice" }],
    docId: pick(["doc", "gone"]),
    reinspId: pick(["visit", "gone"]),
    visit: pick([{ id: "visit", previousDraft: { a: 1 }, previousWorksheet: { b: 2 } }, { id: "visit" }]),
    printJob: pick(["ok", "throw", "ok"]),
    needs: chance(2),
    next: pick([null, { id: "nxt" }]),
    fail: chance(3) ? 1 + random(10) : 0,
  };
}

async function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  Object.assign(state, {
    DOCS: x.docs,
    REINSP: [x.visit],
    WORK: { entry: {}, recordForms: x.forms },
    state: { screen: "cases", docId: x.docId, reinspId: x.reinspId, modal: null },
  });
  globalThis.document = { getElementById: (id) => ({ close: () => calls.push("close " + id) }) };
  const returns = {
    "ui.captureWork": () => undefined,
    "ui.render": () => undefined,
    "ui.toast": () => undefined,
    "ui.scheduleDraftSave": () => undefined,
    "recovery.saveAndContinue": () => undefined,
    "recovery.downloadWorkspace": () => undefined,
    "recovery.restoreWorkspaceFile": () => undefined,
    "recovery.returnToWorksheet": () => undefined,
    "recovery.restorePreviousDraft": () => undefined,
    "publication.printJob": () => {
      if (x.printJob === "throw") throw new Error("packet incomplete");
      return { html: "<p>job</p>" };
    },
    "publication.filePdf": () => Promise.resolve(true),
    "publication.needsInitialCitation": () => x.needs,
    "publication.citationFromNotice": () => x.next,
    "publication.publishDocument": () => undefined,
    "publication.downloadFile": () => undefined,
  };
  const services = recorder(calls, returns, {}, x.fail);
  const owner = api.createRecoveryEvents(services);
  assert.deepEqual(calls, [], "construction remains inert");
  const target = listenerTarget();
  owner.registerWorkingActions(target);
  const button = x.none
    ? null
    : {
        id: x.id,
        disabled: false,
        hasAttribute: (a) => a === "data-workbackup" && x.workbackup,
        dataset: x.worknote ? { worknote: x.worknote } : {},
      };
  const ev = {
    target: { closest: () => button },
    preventDefault: () => calls.push("preventDefault"),
    stopImmediatePropagation: () => calls.push("stop"),
  };
  let error;
  try {
    target.listeners.click(ev);
    await Promise.resolve();
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ error, ui: state.state, button: button && button.disabled, calls });
}

/* The retained original with the one intentional change: the retry button asks filePdf to explain a missing Chrome or
   Edge. Its source must carry the old call exactly once. */
function retainedOriginal() {
  const source = fs.readFileSync("tests/fixtures/recovery_events_reference.txt", "utf8"),
    old = "services.publication.filePdf(d, job).finally(";
  assert.equal(source.split(old).length, 2, "retained original carries the old call exactly once");
  return source.replace(old, "services.publication.filePdf(d, job, true).finally(");
}

(async () => {
  const [current, legacy] = await Promise.all([compile('export {createRecoveryEvents} from "./recovery_events.js";'), compile(retainedOriginal())]);
  const seen = new Set();
  let interrupted = 0;
  for (let n = 0; n < 10000; n++) {
    const sc = scenario();
    const [before, after] = [await run(legacy, sc), await run(current, sc)];
    assert.equal(after, before, `recovery scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const parsed = JSON.parse(after);
    if (parsed.error) interrupted++;
    for (const c of parsed.calls) seen.add(c.split("(")[0].replace(/^get /, ""));
  }
  for (const name of [
    "ui.captureWork",
    "recovery.saveAndContinue",
    "recovery.downloadWorkspace",
    "recovery.restoreWorkspaceFile",
    "recovery.returnToWorksheet",
    "recovery.restorePreviousDraft",
    "publication.printJob",
    "publication.filePdf",
    "publication.needsInitialCitation",
    "publication.citationFromNotice",
    "publication.publishDocument",
    "publication.downloadFile",
    "ui.toast",
    "preventDefault",
  ])
    assert.ok(seen.has(name), "scenarios reach " + name);
  assert.ok(interrupted > 150, "coverage: " + interrupted + " interrupted");
  console.log("PASS recovery actions match the retained module over 10000 scenarios (" + interrupted + " interrupted)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
