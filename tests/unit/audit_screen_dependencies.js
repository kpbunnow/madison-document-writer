const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Independently loadable screen owners, live facts, scoped wiring and retained repaint ordering. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules");
const specs = {
  case_status: { ctor: "createCaseStatus", instance: "caseStatus", names: ["caseState"], inputs: ["snow", "today", "unissuedVisitFor"] },
  citation_history: { ctor: "createCitationHistory", instance: "citationHistory", names: ["priorCitations"], inputs: ["today"] },
  workspace_screen: {
    ctor: "createWorkspaceScreen",
    instance: "workspaceScreen",
    names: ["revealIssuedCase", "focusIssuedCase", "screenCases"],
    inputs: [
      "app_workspacequeueContext",
      "caseSearchText",
      "caseState",
      "document",
      "recoveryStatusHTML",
      "remindersPanel",
      "saveWorkflowPrefs",
      "shell",
      "workspaceTasks",
    ],
  },
  language_views: {
    ctor: "createLanguageViews",
    instance: "languageViews",
    names: ["screenLibrary", "pickerHTML"],
    inputs: ["app_languagediscoveryContext"],
  },
  screen_overlays: {
    ctor: "createScreenOverlays",
    instance: "screenOverlays",
    names: ["overlayHTML"],
    inputs: [
      "CASEDIR_EXPECT",
      "blockers",
      "caseUnsaved",
      "checkRowHTML",
      "checks",
      "correctionDiffHTML",
      "initialCitations",
      "pickerHTML",
      "recipientPreview",
      "recordActionModal",
      "recoveryModal",
      "reindexReport",
      "reviewModalHTML",
      "sharedChangeModal",
      "storageReport",
      "today",
    ],
  },
  app_screens: {
    ctor: "createAppScreens",
    instance: "appScreens",
    names: ["render", "renderKeep"],
    inputs: [
      "A11Y",
      "IDB_OK",
      "app_languagediscoveryContext",
      "document",
      "editorEnhance",
      "enhanceDialog",
      "ensureWalkContext",
      "highlightOpenChecks",
      "isLocked",
      "location",
      "navigation",
      "newDocuments",
      "overlayHTML",
      "paginate",
      "restoreWorkControls",
      "scheduleDraftSave",
      "screenCases",
      "screenImport",
      "screenLibrary",
      "screenReinspect",
      "screenWrite",
      "updateSaveStatus",
      "walkIdentity",
      "window",
    ],
  },
};
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  f(n);
  Object.values(n).forEach((x) => walk(x, f));
}
const parse = (file) => acorn.parse(fs.readFileSync(path.join(dir, file + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
for (const [file, { ctor, instance, inputs }] of Object.entries(specs)) {
  const used = new Set();
  walk(parse(file), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") used.add(n.property.name);
  });
  assert.deepEqual([...used].sort(), inputs);
  const entry = entries.find((n) => n.id.name === instance);
  assert.equal(entry.init.callee.name, ctor);
  assert.deepEqual(
    serviceComposition(entry.init.arguments[0])
      .properties.map((p) => p.key.name)
      .sort(),
    inputs,
  );
  for (const p of serviceComposition(entry.init.arguments[0]).properties)
    assert.ok(p.kind === "get" || p.value.type === "ArrowFunctionExpression", "lazy input " + p.key.name);
  assert.ok(entries.indexOf(entry) > entries.findIndex((n) => n.id.name === "storageProbe"));
  assert.ok(entries.indexOf(entry) < entries.findIndex((n) => n.id.name === "folderConnections"));
}
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        Object.entries(specs)
          .map(([f, { ctor }]) => `export {${ctor}} from './${f}.js';`)
          .join("") +
        "export {WriterState} from './state.js';export {helperStop} from './helper_stopped.js';export {esc} from './presentation_format.js';export {uiIcon} from './ui_icons.js';",
      resolveDir: dir,
    },
    bundle: true,
    format: "cjs",
    write: false,
    define: { __TEST_BUILD__: "false" },
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
  const {
    WriterState: s,
    helperStop,
    esc,
    uiIcon,
    createCaseStatus,
    createCitationHistory,
    createWorkspaceScreen,
    createScreenOverlays,
    createAppScreens,
  } = box.exports;
  assert.deepEqual(s, {});
  for (const { ctor } of Object.values(specs)) box.exports[ctor](new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  assert.match(uiIcon("cases"), /<svg/);
  assert.equal(uiIcon("unknown"), uiIcon("cases"));
  const k = { id: "c", number: "BI-123", address: "123 Main <&", savedAt: "2026-10-01", inspectorId: "other" };
  const base = () => {
    s.CASES = [k];
    s.DOCS = [];
    s.REINSP = [];
    s.EVENTS = {};
    s.WORK = {};
    s.SAVE_CHECKPOINTS = {};
    s.PENDING = [];
    s.RECORD_ATTEMPTS = {};
    s.state = { screen: "cases", caseFilter: "all", caseQ: "", caseInspector: "", metric: "", docId: null, modal: null, picker: false };
  };
  base();
  let day = "2026-10-27",
    visit = null,
    snow = false;
  const status = createCaseStatus({
    get today() {
      return day;
    },
    get snow() {
      return { isCase: () => snow };
    },
    unissuedVisitFor: () => visit,
  });
  assert.equal(status.caseState(k).label, "Ready to start");
  visit = { id: "r", draft: false };
  assert.equal(status.caseState(k).label, "Visit needs document");
  visit = null;
  const notice = { id: "n", caseId: "c", type: "notice", issuedAt: "2026-10-01", items: [{ id: "i", no: "1", due: "2026-10-28" }] };
  s.DOCS = [notice];
  assert.equal(status.caseState(k).soon, true);
  assert.equal(status.caseState(k).late, false);
  day = "2026-10-29";
  assert.equal(status.caseState(k).late, true);
  const attempt = { cid: "c", recordKey: "held" };
  s.RECORD_ATTEMPTS = { held: attempt };
  assert.equal(status.caseState(k).pendingRecord, attempt);
  s.DOCS = [{ ...notice, draft: true }];
  assert.equal(status.caseState(k).label, "Document draft");
  s.DOCS = [{ ...notice, draft: true, correction: {} }];
  assert.equal(status.caseState(k).label, "Correction draft");
  s.DOCS = [{ ...notice, type: "compliance", items: [{ id: "i", no: "1", corrected: true }] }];
  assert.equal(status.caseState(k).closed, true);
  assert.equal(status.caseState(k).label, "Closed");
  snow = true;
  s.DOCS = [{ ...notice, filedAt: "2026-10-01" }];
  assert.equal(status.caseState(k).closed, true);
  assert.equal(status.caseState(k).label, "Cited – snow");
  snow = false;
  const history = createCitationHistory({
    get today() {
      return day;
    },
  });
  day = "2024-02-29";
  const cite = (id, date, extra = {}) => ({ id, caseId: "c", type: "citation", mailed: date, items: [{ no: "1", cite: true }], ...extra });
  s.DOCS = [
    cite("a", "2023-02-28"),
    cite("b", "2023-02-27"),
    cite("c", "2024-02-29"),
    cite("d", "2024-03-01"),
    cite("e", "2024-01-01", { draft: true }),
    cite("f", "2024-01-01", { void: {} }),
    cite("g", "2024-01-01", { superseded: {} }),
  ];
  assert.equal(history.priorCitations("c", "1"), 2);
  assert.equal(history.priorCitations("other", "1"), 0);
  day = "2025-03-01";
  assert.equal(history.priorCitations("c", "1"), 1, "the former future citation enters the live rolling window");
  const dom = new JSDOM('<div id="app"></div><div id="overlay"></div>', { url: "http://127.0.0.1:8777", pretendToBeVisual: true });
  global.document = dom.window.document;
  base();
  let prefs = 0,
    calls = [];
  const context = () => ({
    recordIntegrity: { status: () => ({ valid: true }) },
    esc,
    caseNumberAllowed: () => true,
    docsFor: () => s.DOCS,
    snow: { isCase: () => false },
    PREFLIGHT_CONFLICT: null,
  });
  const workspace = createWorkspaceScreen({
    document: dom.window.document,
    caseState: status.caseState,
    workspaceTasks: () => [{ key: "imports", count: 0, items: [] }],
    app_workspacequeueContext: context,
    caseSearchText: (k) => k.number.toLowerCase(),
    saveWorkflowPrefs: () => prefs++,
    remindersPanel: () => "reminders",
    recoveryStatusHTML: () => "recovery",
    shell: (title, crumb, actions, body) => body,
  });
  s.state.caseFilter = "closed";
  s.state.caseQ = "missing";
  s.state.caseInspector = "unrelated";
  s.state.metric = "old";
  s.state.modal = "old";
  s.state.picker = true;
  assert.equal(workspace.revealIssuedCase("c"), true);
  assert.equal(s.state.caseFilter, "all");
  assert.equal(s.state.caseQ, "");
  assert.equal(s.state.caseInspector, "");
  assert.equal(s.state.issuedCase, "c");
  assert.equal(s.state.modal, null);
  assert.equal(s.state.picker, false);
  assert.equal(prefs, 1);
  assert.equal(workspace.revealIssuedCase("c"), true);
  assert.equal(prefs, 1);
  const unchanged = JSON.stringify(s.state);
  assert.equal(workspace.revealIssuedCase("missing"), false);
  assert.equal(JSON.stringify(s.state), unchanged);
  dom.window.document.getElementById("app").innerHTML = '<table><tr data-issued-highlight data-queue-case="c" tabindex="-1"></tr></table>';
  const row = dom.window.document.querySelector("tr");
  row.scrollIntoView = (options) => calls.push(options);
  workspace.focusIssuedCase("c");
  assert.equal(dom.window.document.activeElement, row);
  assert.deepEqual(calls, [{ block: "center" }]);
  const markup = workspace.screenCases();
  assert.match(markup, /123 Main &lt;&amp;/);
  s.CASES = [{ ...k, id: "changed", number: "BI-456" }];
  assert.match(workspace.screenCases(), /BI-456/);
  s.CASES = [k];
  const overlays = createScreenOverlays({
    sharedChangeModal: () => "shared",
    reviewModalHTML: () => "review",
    recoveryModal: () => "recovery",
    recordActionModal: () => "record",
    pickerHTML: () => "picker",
    caseUnsaved: () => true,
    checks: () => [],
    recipientPreview: () => "",
    blockers: () => [],
    initialCitations: { enabled: () => false },
    CASEDIR_EXPECT: "Case JSON Files",
    checkRowHTML: () => "",
    correctionDiffHTML: () => "",
    reindexReport: () => "",
    storageReport: () => "",
    today: day,
  });
  for (const [modal, expected] of [
    ["shared-change", "shared"],
    ["review", "review"],
    ["recovery", "recovery"],
    ["void", "record"],
    ["recordnote", "record"],
    ["reconcile", "record"],
  ]) {
    s.state.modal = modal;
    s.state.picker = true;
    assert.equal(overlays.overlayHTML(), expected);
  }
  s.state.modal = null;
  assert.equal(overlays.overlayHTML(), "picker");
  s.state.picker = false;
  assert.equal(overlays.overlayHTML(), "");
  s.state.modal = "cc";
  s.state.docId = "missing";
  assert.equal(overlays.overlayHTML(), "");
  s.state.modal = "clear";
  assert.match(overlays.overlayHTML(), /work that has not reached the share/);
  assert.match(overlays.overlayHTML(), /123 Main &lt;&amp;/);
  base();
  s.WRITER_READY = false;
  s.STARTUP_STATUS = "restoring";
  s.DIRTY = false;
  let idb = true,
    reloads = 0;
  const noop = () => {},
    callsReset = () => (calls = []);
  const renderServices = {
    document: dom.window.document,
    window: { scrollY: 37, scrollTo: (...args) => calls.push(["scroll", ...args]), getSelection: () => dom.window.getSelection() },
    location: { reload: () => reloads++ },
    get IDB_OK() {
      return idb;
    },
    A11Y: { rememberFocus: () => calls.push("remember"), enhance: () => calls.push("a11y") },
    app_languagediscoveryContext: () => ({ state: s.state }),
    isLocked: () => false,
    walkIdentity: () => "walk",
    ensureWalkContext: () => calls.push("walk"),
    screenCases: () => '<div class="cases">cases</div>',
    screenLibrary: () => "library",
    screenImport: () => "import",
    navigation: { screen: () => "tools" },
    newDocuments: { caseActionScreen: () => "caseactions", actionScreen: () => "actions" },
    screenReinspect: () => "reinspect",
    screenWrite: () => '<div class="document-workspace" data-editor-doc="d"><input id="reason" value="typed"></div>',
    overlayHTML: () => "overlay",
    paginate: () => calls.push("paginate"),
    editorEnhance: () => calls.push("editor"),
    restoreWorkControls: () => calls.push("restore"),
    updateSaveStatus: () => calls.push("save-status"),
    enhanceDialog: () => calls.push("dialog"),
    highlightOpenChecks: () => calls.push("checks"),
    scheduleDraftSave: () => calls.push("schedule"),
  };
  const screens = createAppScreens(renderServices);
  screens.render();
  assert.match(dom.window.document.getElementById("app").textContent, /Restoring saved workspace/);
  assert.equal(dom.window.document.getElementById("overlay").innerHTML, "");
  s.STARTUP_STATUS = "failed";
  screens.render();
  assert.match(dom.window.document.getElementById("app").textContent, /Saved workspace could not be restored/);
  dom.window.document.getElementById("startup-retry").click();
  assert.equal(reloads, 1);
  assert.equal(dom.window.document.activeElement.id, "main-content");
  dom.window.document.getElementById("app").innerHTML = "untouched";
  s.STARTUP_STATUS = "locked";
  screens.render();
  assert.equal(dom.window.document.getElementById("app").innerHTML, "untouched");
  s.STARTUP_STATUS = "ready";
  s.WRITER_READY = true;
  helperStop.stopped = true;
  screens.render();
  assert.equal(dom.window.document.getElementById("app").innerHTML, "untouched");
  helperStop.stopped = false;
  callsReset();
  screens.render();
  assert.deepEqual(calls, ["remember", "walk", "restore", "save-status", "dialog", "checks", "a11y"]);
  assert.equal(dom.window.document.getElementById("overlay").innerHTML, "overlay");
  for (const [route, text] of [
    ["library", "library"],
    ["tools", "tools"],
    ["import", "import"],
    ["caseactions", "caseactions"],
    ["actions", "actions"],
    ["reinspect", "reinspect"],
    ["unknown", "cases"],
  ]) {
    s.state.screen = route;
    screens.render();
    assert.match(dom.window.document.getElementById("app").textContent, new RegExp(text));
  }
  s.state.screen = "write";
  s.state.docId = "d";
  s.DOCS = [{ id: "d", caseId: "c", type: "notice", items: [] }];
  callsReset();
  screens.render();
  assert.deepEqual(calls, ["remember", "walk", "paginate", "editor", "restore", "save-status", "dialog", "checks", "a11y"]);
  const field = dom.window.document.getElementById("reason");
  field.focus();
  field.setSelectionRange(1, 3);
  screens.render();
  assert.equal(dom.window.document.activeElement.id, "reason");
  assert.equal(dom.window.document.activeElement.selectionStart, 1);
  assert.equal(dom.window.document.activeElement.selectionEnd, 3);
  s.DIRTY = true;
  callsReset();
  screens.renderKeep();
  assert.equal(calls[0], "schedule");
  assert.deepEqual(calls.at(-1), ["scroll", 0, 37]);
  console.log(
    JSON.stringify({
      passed: true,
      owners: 6,
      inertConstruction: true,
      liveCaseFacts: true,
      citationWindow: true,
      workspaceReveal: true,
      modalRouting: true,
      startupBarriers: true,
      repaintOrderAndFocus: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
