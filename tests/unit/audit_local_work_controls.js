const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Native local-file controls and existing draft-save scheduling, without Writer startup. */
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
  if (Array.isArray(n)) return n.forEach((x) => walk(x, f));
  f(n);
  Object.values(n).forEach((x) => walk(x, f));
}
const defs = {
  localCaseFiles: ["local_case_files", "createLocalCaseFiles", ["Blob", "URL", "document", "setTimeout", "FileReader", "toast", "loadCaseFile"]],
  draftSaveControls: [
    "draft_save_controls",
    "createDraftSaveControls",
    ["document", "app_savedworkContext", "IDB_OK", "setTimeout", "clearTimeout", "saveDrafts"],
  ],
};
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
let previous = entries.findIndex((n) => n.id.name === "caseFolderWorkflow");
for (const [name, [file, ctor, fields]] of Object.entries(defs)) {
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
  assert.deepEqual(new Set(serviceComposition(e.init.arguments[0]).properties.map((p) => p.key.name)), used);
  assert.ok(entries.indexOf(e) > previous);
  assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "recipientWorkflow"));
  previous = entries.indexOf(e);
  for (const p of serviceComposition(e.init.arguments[0]).properties)
    if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
    else assert.equal(p.value.body.callee.name, p.key.name);
}
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createLocalCaseFiles} from './local_case_files.js';export {createDraftSaveControls} from './draft_save_controls.js';export {WriterState} from './state.js';",
      resolveDir: dir,
    },
    bundle: true,
    format: "cjs",
    write: false,
  });
  const box = { exports: {} };
  new Function("module", "exports", built.outputFiles[0].text)(box, box.exports);
  const { createLocalCaseFiles, createDraftSaveControls, WriterState: s } = box.exports;
  assert.deepEqual(s, {});
  for (const ctor of [createLocalCaseFiles, createDraftSaveControls])
    ctor(new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  assert.deepEqual(s, {});
  let timers = new Map(),
    nextTimer = 0,
    calls = [];
  const later = (fn, delay) => {
      const id = ++nextTimer;
      timers.set(id, { fn, delay });
      return id;
    },
    cancel = (id) => {
      calls.push(["cancel", id]);
      timers.delete(id);
    };
  let dom = new JSDOM('<span id="save-status"></span><span data-document-device-save></span><div id="navigation-save-failure">failure</div>');
  global.document = dom.window.document;
  let idb = true,
    contextReads = 0,
    saves = [];
  s.LOCAL_SAVE = { ok: true, saving: false, at: "" };
  s.LOCAL_CHANGED = 0;
  s.DIRTY = false;
  s.draftTimer = null;
  const controls = createDraftSaveControls({
    get document() {
      return dom.window.document;
    },
    app_savedworkContext: () => {
      contextReads++;
      return { LOCAL_SAVE: s.LOCAL_SAVE, draftTimer: s.draftTimer, A11Y: { resolve: (reason) => calls.push(["resolve", reason]) } };
    },
    get IDB_OK() {
      return idb;
    },
    setTimeout: later,
    clearTimeout: cancel,
    saveDrafts: () => {
      saves.push({ timer: s.draftTimer, changed: s.LOCAL_CHANGED });
    },
  });
  controls.updateSaveStatus();
  assert.equal(contextReads, 2);
  assert.equal(document.getElementById("save-status").textContent, "Device save not yet confirmed");
  assert.equal(document.querySelector("[data-document-device-save]").textContent, "Device save not yet confirmed");
  assert.equal(document.getElementById("navigation-save-failure"), null);
  controls.scheduleDraftSave();
  const first = s.draftTimer;
  assert.equal(s.DIRTY, true);
  assert.equal(s.LOCAL_CHANGED, 1);
  assert.equal(timers.get(first).delay, 1500);
  assert.equal(saves.length, 0);
  controls.updateSaveStatus();
  assert.equal(document.getElementById("save-status").textContent, "Device save pending…");
  controls.scheduleDraftSave();
  const second = s.draftTimer;
  assert.notEqual(second, first);
  assert.equal(timers.has(first), false);
  assert.deepEqual(
    calls.find((c) => c[0] === "cancel"),
    ["cancel", first],
  );
  assert.equal(s.LOCAL_CHANGED, 2);
  timers.get(second).fn();
  assert.equal(s.draftTimer, null);
  assert.deepEqual(saves, [{ timer: null, changed: 2 }]);
  timers.delete(second);
  s.LOCAL_SAVE = { ok: false, saving: false };
  controls.updateSaveStatus();
  assert.equal(document.getElementById("save-status").classList.contains("save-error"), true);
  assert.equal(document.querySelector("[data-document-device-save]").textContent, "Not saved — keep this tab open");
  s.LOCAL_SAVE = { ok: true, saving: true };
  controls.updateSaveStatus();
  assert.equal(document.getElementById("save-status").textContent, "Saving on this device…");
  // Original unavailable-IDB path updates status but does not cancel an already queued timer.
  s.LOCAL_SAVE = { ok: true, saving: false };
  controls.scheduleDraftSave();
  const pending = s.draftTimer;
  idb = false;
  const size = timers.size;
  controls.scheduleDraftSave();
  assert.equal(s.LOCAL_SAVE.ok, false);
  assert.equal(timers.size, size);
  assert.equal(s.draftTimer, pending);
  assert.equal(document.getElementById("save-status").classList.contains("save-error"), true);
  timers.get(pending).fn();
  timers.delete(pending);
  idb = true;
  dom = new JSDOM("<span data-document-device-save></span>");
  global.document = dom.window.document;
  s.LOCAL_SAVE = { ok: true, saving: false, at: "2026-10-27T00:00:00Z" };
  controls.updateSaveStatus();
  assert.equal(document.querySelector("[data-document-device-save]").textContent, "Saved on this device");
  calls = [];
  let input,
    anchor,
    readers = [],
    loadError = false;
  const nativeDoc = {
    body: { appendChild: (a) => calls.push(["append", a]) },
    createElement: (tag) => {
      if (tag === "a") {
        anchor = {
          click() {
            calls.push(["click", this.href, this.download]);
          },
          remove() {
            calls.push(["remove"]);
          },
        };
        return anchor;
      }
      assert.equal(tag, "input");
      input = {
        files: [],
        click() {
          calls.push(["picker", this.type, this.accept]);
        },
      };
      return input;
    },
  };
  class BlobAdapter {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
      calls.push(["blob", parts, options]);
    }
  }
  class Reader {
    constructor() {
      readers.push(this);
    }
    readAsText(file) {
      calls.push(["read", file]);
    }
  }
  const files = createLocalCaseFiles({
    get Blob() {
      return BlobAdapter;
    },
    get URL() {
      return {
        createObjectURL: (blob) => {
          calls.push(["url", blob]);
          return "blob:synthetic";
        },
        revokeObjectURL: (url) => calls.push(["revoke", url]),
      };
    },
    get document() {
      return nativeDoc;
    },
    setTimeout: later,
    get FileReader() {
      return Reader;
    },
    toast: (m) => calls.push(["toast", m]),
    loadCaseFile: (raw) => {
      calls.push(["load", raw]);
      if (loadError) throw Error("loader refusal");
    },
  });
  files.downloadFile("case.json", '{"case":"synthetic"}');
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["blob", "url", "append", "click", "remove"],
  );
  assert.deepEqual(calls[0].slice(1), [['{"case":"synthetic"}'], { type: "application/json" }]);
  assert.deepEqual(calls[3], ["click", "blob:synthetic", "case.json"]);
  const cleanup = [...timers.values()].find((t) => t.delay === 4000);
  assert.ok(cleanup);
  cleanup.fn();
  assert.deepEqual(calls.at(-1), ["revoke", "blob:synthetic"]);
  calls = [];
  files.pickCaseFile();
  assert.deepEqual(calls, [["picker", "file", ".json,application/json"]]);
  input.onchange();
  assert.equal(readers.length, 0);
  const selected = { name: "case.json" };
  input.files = [selected];
  input.onchange();
  assert.deepEqual(calls.at(-1), ["read", selected]);
  readers[0].result = '{"original":"bytes"}';
  readers[0].onload();
  assert.deepEqual(calls.at(-1), ["load", '{"original":"bytes"}']);
  readers[0].onerror();
  assert.equal(calls.at(-1)[1], "That file could not be read from this machine");
  loadError = true;
  readers[0].onload();
  assert.match(calls.at(-1)[1], /That case file was not loaded — loader refusal/);
  console.log(
    JSON.stringify({
      passed: true,
      fileInputs: 7,
      saveInputs: 6,
      inertConstruction: true,
      debounceAndStatus: true,
      originalUnavailablePath: true,
      filePickerFailures: true,
      downloadAndCleanupOrder: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
