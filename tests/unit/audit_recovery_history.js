/* Recovery controls/presentation, catalog forms and read-only document history without Writer startup. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, f));
  f(n);
  Object.values(n).forEach((c) => walk(c, f));
}
const expected = {
  recoveryUI: [
    "recovery_ui",
    "createRecoveryUI",
    [
      "document",
      "ENTRY_IDS",
      "recordFormKey",
      "cancelCaseLookup",
      "captureWork",
      "clearTimeout",
      "navigation",
      "render",
      "toast",
      "restoreWorkspaceBackup",
      "caseUnsaved",
    ],
  ],
  catalogForms: ["catalog_forms", "createCatalogForms", ["localStorage"]],
  recordHistory: ["record_history", "createRecordHistory", ["fmtDate"]],
};
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
let previous = entries.findIndex((n) => n.id.name === "worksheetWorkflow");
for (const [name, [file, ctor, fields]] of Object.entries(expected)) {
  const used = new Set();
  walk(parse(file), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") {
      assert.equal(n.computed, false);
      used.add(n.property.name);
    }
  });
  assert.deepEqual([...used].sort(), fields.slice().sort());
  const e = entries.find((n) => n.id.name === name);
  assert.equal(e.init.callee.name, ctor);
  assert.deepEqual(new Set(e.init.arguments[0].properties.map((p) => p.key.name)), used);
  assert.ok(entries.indexOf(e) > previous);
  assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "documentRenderer"));
  previous = entries.indexOf(e);
  for (const p of e.init.arguments[0].properties) {
    if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
    else {
      assert.equal(p.value.type, "ArrowFunctionExpression");
      assert.equal(p.value.body.callee.name, p.key.name);
    }
  }
}
const copy = (v) => JSON.parse(JSON.stringify(v));
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createRecoveryUI} from './recovery_ui.js'; export {createCatalogForms,catalogKey} from './catalog_forms.js'; export {createRecordHistory} from './record_history.js'; export {WriterState} from './state.js'; export {LIBRARY} from './data/library.js';",
      resolveDir: dir,
    },
    define: { __TEST_BUILD__: "false" },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(b) {
          b.onResolve({ filter: /\/data\// }, (a) => ({ path: path.join(root, "build/generated/modules/data", path.basename(a.path)) }));
        },
      },
    ],
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createRecoveryUI, createCatalogForms, catalogKey, createRecordHistory, WriterState: s, LIBRARY } = box.exports;
  assert.deepEqual(s, {});
  for (const ctor of [createRecoveryUI, createCatalogForms, createRecordHistory])
    ctor(new Proxy({}, { get: (_, k) => assert.fail("premature service " + String(k)) }));
  assert.deepEqual(s, {});
  const dom = new JSDOM(
    '<input id="entry"><textarea id="record-action-text"></textarea><textarea id="record-action-external" disabled>locked</textarea><input id="record-action-inspector"><div id="recovery-status"></div>',
  );
  let calls = [],
    navAllowed = true,
    lastInput,
    restoreFailure = false,
    storageFailure = false,
    storage = {};
  const nativeDoc = dom.window.document;
  const api = createRecoveryUI({
    get document() {
      return {
        getElementById: (id) => nativeDoc.getElementById(id),
        createElement(tag) {
          lastInput = nativeDoc.createElement(tag);
          lastInput.click = () => calls.push("click");
          return lastInput;
        },
      };
    },
    get ENTRY_IDS() {
      return ["entry"];
    },
    recordFormKey: () => "doc:note",
    cancelCaseLookup() {
      calls.push("cancel");
    },
    captureWork() {
      calls.push("capture");
    },
    clearTimeout(id) {
      calls.push(["clear", id]);
    },
    get navigation() {
      return {
        leave(fn) {
          calls.push("leave");
          return navAllowed ? fn() : false;
        },
      };
    },
    render() {
      calls.push("render");
    },
    toast(text) {
      calls.push(["toast", text]);
    },
    async restoreWorkspaceBackup(value) {
      calls.push(["restore", copy(value)]);
      if (restoreFailure) throw Error("storage failed");
    },
    caseUnsaved(k) {
      calls.push(["unsaved", k.id]);
      return "unfinished <work>";
    },
  });
  function reset() {
    calls = [];
    navAllowed = true;
    restoreFailure = false;
    storageFailure = false;
    Object.assign(s, {
      state: { screen: "import", modal: "review", picker: true, riFilter: "old" },
      WORK: { entry: { entry: "typed" }, recordForms: { "doc:note": { text: "note", external: "external", actor: "i4" } } },
      CASES: [],
      RECOVERY: { list: [], selected: null, shared: null, error: "", at: "" },
      HELPER: null,
      DIRTY: true,
      draftTimer: 9,
      CATALOG_FORMS: { one: { text: "retained" } },
      CATALOG_ERROR: "",
      DOCS: [],
      RECORD_ATTEMPTS: {},
    });
  }
  reset();
  api.restoreWorkControls();
  assert.equal(nativeDoc.getElementById("entry").value, "typed");
  assert.equal(nativeDoc.getElementById("record-action-text").value, "note");
  assert.equal(nativeDoc.getElementById("record-action-external").value, "locked");
  assert.equal(nativeDoc.getElementById("record-action-inspector").value, "i4");
  s.WORK = { entry: { entry: "replacement" }, recordForms: {} };
  api.restoreWorkControls();
  assert.equal(nativeDoc.getElementById("entry").value, "replacement");
  reset();
  await api.saveAndContinue();
  assert.deepEqual(calls.slice(0, 5), ["cancel", "capture", ["clear", 9], "leave", "render"]);
  assert.equal(s.draftTimer, null);
  assert.equal(s.state.screen, "cases");
  assert.equal(s.state.modal, null);
  assert.equal(s.state.picker, false);
  assert.equal(s.state.riFilter, "");
  assert.equal(s.DIRTY, false);
  assert.match(calls.at(-1)[1], /saved on this device/);
  reset();
  navAllowed = false;
  assert.equal(await api.saveAndContinue(), false);
  assert.equal(s.state.screen, "import");
  assert.equal(s.DIRTY, true);
  assert.equal(calls.includes("render"), false);
  s.state.screen = "write";
  calls = [];
  await api.saveAndContinue();
  assert.equal(calls.includes("cancel"), false);
  reset();
  api.restoreWorkspaceFile();
  assert.equal(lastInput.type, "file");
  assert.equal(lastInput.accept, ".json,application/json");
  Object.defineProperty(lastInput, "files", { value: [{ text: async () => '{"saved":true}' }], configurable: true });
  await lastInput.onchange();
  assert.deepEqual(calls.at(-1), ["restore", { saved: true }]);
  Object.defineProperty(lastInput, "files", { value: [{ text: async () => "{" }], configurable: true });
  await lastInput.onchange();
  assert.match(calls.at(-1)[1], /Backup was not restored:/);
  restoreFailure = true;
  Object.defineProperty(lastInput, "files", { value: [{ text: async () => '{"saved":true}' }], configurable: true });
  await lastInput.onchange();
  assert.match(calls.at(-1)[1], /storage failed/);
  reset();
  assert.match(api.recoveryStatusHTML(), /Automatic backup unavailable/);
  s.HELPER = true;
  assert.match(api.recoveryStatusHTML(), /waiting for its first save/);
  s.RECOVERY.error = '<img src=x onerror="bad">';
  s.RECOVERY.at = "<time>";
  api.renderRecoveryStatus();
  const status = nativeDoc.getElementById("recovery-status");
  assert.equal(status.querySelector("img"), null);
  assert.match(status.textContent, /<img/);
  s.RECOVERY.error = "";
  assert.match(api.recoveryStatusHTML(), /recovery copy available/);
  reset();
  s.RECOVERY.list = [{ workspace: "a".repeat(32), case: "b".repeat(32), number: "<case>", at: "date", included: ["<draft>"], error: "bad" }];
  s.RECOVERY.selected = { number: "<case>", at: "date", included: ["draft"], bundle: { cases: [{ id: "one", number: "<case>" }] } };
  s.CASES = [{ id: "one", number: "<case>" }];
  s.RECOVERY.shared = { kind: "conflict", detail: "<shared>", fields: [{ field: "<owner>", local: "<old>", shared: "<new>" }] };
  const stateBefore = copy(s),
    modal = new JSDOM(api.recoveryModal()).window.document;
  assert.ok(modal.querySelector("[data-recovery-row]").disabled);
  assert.ok(modal.querySelector("[data-recovery-restore]").disabled);
  assert.ok(modal.querySelector("[data-recovery-shared]"));
  assert.match(modal.body.textContent, /<owner>/);
  assert.equal(modal.querySelector("owner"), null);
  assert.deepEqual(s, stateBefore);
  s.RECOVERY.shared.kind = "unavailable";
  assert.equal(new JSDOM(api.recoveryModal()).window.document.querySelector("[data-recovery-restore]").disabled, false);
  const forms = createCatalogForms({
    get localStorage() {
      if (storageFailure) throw Error("blocked");
      return {
        setItem(k, v) {
          storage[k] = v;
        },
      };
    },
  });
  reset();
  forms.keepCatalogForms();
  assert.deepEqual(JSON.parse(storage["madison-catalog-forms-v1"]), s.CATALOG_FORMS);
  s.CATALOG_FORMS = { two: { text: "new" } };
  forms.keepCatalogForms();
  assert.deepEqual(JSON.parse(storage["madison-catalog-forms-v1"]), s.CATALOG_FORMS);
  storageFailure = true;
  forms.keepCatalogForms();
  assert.equal(s.CATALOG_ERROR, "Review form could not be stored on this device.");
  assert.equal(catalogKey({ ci: 0, gi: 0, o: "test" }), JSON.stringify([LIBRARY[0].code, LIBRARY[0].groups[0].code, "test"]));
  const history = createRecordHistory({ fmtDate: (v) => "date:" + v });
  reset();
  const original = { id: "original", caseId: "one", issuedAt: "2026-10-01T12:00:00Z", superseded: true },
    revision = {
      id: "revision",
      caseId: "one",
      issuedAt: "2026-10-10T12:00:00Z",
      revision: { rootId: "original", targetId: "original", number: 1, at: "2026-10-10T12:00:00Z", originalIssued: "2026-10-01", reason: "<reason>" },
      annotations: [{ at: "2026-10-11T12:00:00Z", by: "unknown", text: "<note>" }],
      void: { reason: "withdrawn" },
    };
  s.DOCS = [
    revision,
    original,
    { id: "other", caseId: "two" },
    { id: "unrelated", caseId: "one" },
    { id: "draft", caseId: "one", draft: true, revision: { rootId: "original" } },
  ];
  s.RECORD_ATTEMPTS = {
    one: { cid: "one", recordKey: 'key"', pendingAmendment: { payload: { docId: revision.id } } },
    other: { cid: "two", pendingAmendment: { payload: { docId: revision.id } } },
  };
  s.state.publicationBusy = "draft";
  const before = copy(s),
    html = history.recordHistoryHTML(revision),
    view = new JSDOM(html).window.document;
  assert.deepEqual(
    [...view.querySelectorAll(".record-chain [data-open]")].map((x) => x.dataset.open),
    ["original", "revision"],
  );
  assert.equal(view.querySelectorAll("[data-resumerecord]").length, 1);
  assert.equal(view.querySelector("[data-resumerecord]").dataset.resumerecord, 'key"');
  assert.ok(view.querySelector("#btn-reconcile"));
  assert.ok(view.querySelector("#btn-recordnote").disabled);
  assert.match(view.body.textContent, /<note>/);
  assert.equal(view.querySelector("note"), null);
  assert.deepEqual(s, before);
  s.state.publicationBusy = "other";
  assert.equal(new JSDOM(history.recordHistoryHTML(revision)).window.document.querySelector("#btn-recordnote").disabled, false);
  revision.reconciliation = { by: "missing", at: "2026-10-12T12:00:00Z", reference: "<follow>" };
  assert.match(history.recordHistoryHTML(revision), /Follow-through recorded by missing/);
  assert.equal(new JSDOM(history.recordHistoryHTML(revision)).window.document.querySelector("#btn-reconcile"), null);
  assert.equal(history.recordHistoryHTML({ draft: true }), "");
  assert.match(history.revisionPrintNote({ draft: true }), /DRAFT · NOT ISSUED/);
  assert.equal(history.revisionPrintNote(original), "");
  const print = history.revisionPrintNote(revision);
  assert.match(print, /CORRECTED DOCUMENT · Revision 1/);
  assert.match(print, /date:2026-10-01/);
  assert.match(print, /&lt;reason&gt;/);
  s.DOCS = [];
  assert.equal(history.revisionPrintNote(revision), print);
  dom.window.close();
  console.log(
    JSON.stringify({
      passed: true,
      recoveryInputs: 11,
      catalogInputs: 1,
      historyInputs: 1,
      inertConstruction: true,
      navigationAndPickerErrors: true,
      escapedReadOnlyPresentation: true,
      catalogPersistence: true,
      historyAndPrintRetained: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
