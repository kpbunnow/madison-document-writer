/* Workspace includes the inspector list, so startup keeps every restored screen, including all retained-work cases. */
const assert = require("node:assert/strict");
const path = require("node:path");
const esbuild = require("esbuild");

(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        'export {createWriterStartup} from "./app/modules/writer_startup.js"; export {WriterState} from "./app/modules/state.js"; export {editorState} from "./app/modules/editor_state.js"; export {startupState} from "./app/modules/startup_state.js";',
      resolveDir: path.resolve("."),
    },
    bundle: true,
    write: false,
    format: "cjs",
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createWriterStartup, WriterState: s, startupState } = box.exports;
  const fresh = async (change = {}) => {
    Object.assign(s, {
      DOCS: [],
      REINSP: [],
      PENDING: [],
      RECORD_ATTEMPTS: {},
      WORK: { entry: {}, acc: null },
      state: { screen: "cases", acc: null },
    });
    startupState.HELPER = { ok: true, caseLookup: true };
    change.helper?.(startupState);
    change.state?.(s);
    let ready = false;
    const noop = () => {};
    await createWriterStartup({
      navigator: {},
      document: {},
      location: {},
      initWriterHandoff: noop,
      checkHelper: noop,
      refreshCatalog: noop,
      restoreCaseFolder: noop,
      restorePending: noop,
      restoreDrafts: noop,
      recordIntegrity: { refresh: noop },
      refreshArtifactLocations: noop,
      flushPending: noop,
      startSession: noop,
      scheduleRecoveryBackup: noop,
      markWriterReady: () => {
        ready = true;
      },
      markWriterFailed: (error) => {
        throw error;
      },
    }).bootStorage();
    assert.equal(ready, true, "startup finishes without a destination-redirect port");
    return false;
  };
  assert.equal(await fresh(), false);
  assert.equal(s.state.screen, "cases", "a City PC opens on Workspace, where the inspector list now loads");

  const stays = async (label, change) => {
    assert.equal(await fresh(change), false, label);
    assert.equal(s.state.screen, "cases", label);
  };
  await stays("no helper", { helper: (st) => (st.HELPER = null) });
  await stays("no City lookup on this PC", { helper: (st) => (st.HELPER = { ok: true, caseLookup: false }) });
  await stays("an older helper that does not report it", { helper: (st) => (st.HELPER = { ok: true }) });
  await stays("an unfinished draft", { state: (w) => w.DOCS.push({ id: "d", draft: true }) });
  await stays("an unfinished worksheet", { state: (w) => w.REINSP.push({ id: "r", draft: true }) });
  await stays("a case file waiting to reach the share", { state: (w) => w.PENDING.push({ name: "x.json" }) });
  await stays("a pending record confirmation", {
    state: (w) => {
      w.DOCS.push({ id: "issued", draft: false });
      w.RECORD_ATTEMPTS.note = { cid: "case1", pendingAmendment: { type: "document.annotated", payload: { docId: "issued" } } };
    },
  });
  await stays("a saved record-note form", { state: (w) => (w.WORK.recordForms = { "issued:recordnote": { text: "Unsubmitted note" } }) });
  await stays("a saved external reference", { state: (w) => (w.WORK.recordForms = { "issued:reconcile": { external: "Court reference" } }) });
  await stays("an import awaiting review", { state: (w) => (w.state.acc = { cases: [{}] }) });
  await stays("a saved import review", { state: (w) => (w.WORK.acc = { cases: [{}] }) });
  await stays("a saved case number", { state: (w) => (w.WORK.entry["lookup-number"] = "CB2026-241-00001") });
  assert.equal(await fresh({ state: (w) => w.DOCS.push({ id: "issued", draft: false }) }), false, "issued records keep the Workspace start");
  assert.equal(await fresh({ state: (w) => (w.state.screen = "library") }), false, "a screen restored elsewhere is kept");
  assert.equal(s.state.screen, "library");
  console.log("PASS start screen");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
