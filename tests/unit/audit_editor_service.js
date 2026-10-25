/* Editor composition preserves synchronous copy routing, readiness and refresh/focus/save order. */
const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const acorn = require("acorn");
const walk = {
  simple(node, visitors) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((child) => walk.simple(child, visitors));
      return;
    }
    visitors[node.type]?.(node);
    Object.values(node).forEach((child) => walk.simple(child, visitors));
  },
};
const esbuild = require("esbuild");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../..");
const directory = path.join(root, "app/modules");
const owners = { editor_screens: "createEditorScreens" };
const parse = (name) => acorn.parse(fs.readFileSync(path.join(directory, name + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
const core = parse("app_core");
const composition = new Map();
for (const statement of core.body) {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
  for (const d of declaration?.declarations || []) {
    if (Object.values(owners).includes(d.init?.callee?.name)) composition.set(d.init.callee.name, d.init);
  }
}
assert.deepEqual([...composition.keys()], Object.values(owners), "preserve service initialization order");
for (const [owner, factory] of Object.entries(owners)) {
  const required = new Set();
  walk.simple(parse(owner), {
    MemberExpression(n) {
      if (n.object.name === "services") {
        assert.equal(n.computed, false, "service dependencies are statically named");
        required.add(n.property.name);
      }
    },
  });
  const call = composition.get(factory);
  assert.equal(call.arguments.length, 1);
  const properties = call.arguments[0].properties;
  assert.deepEqual(new Set(properties.map((p) => p.key.name)), required, owner + " has exactly its required interface");
  for (const p of properties) {
    assert.equal(p.type, "Property", "no spread registry");
    if (p.kind === "get") {
      assert.equal(p.value.body.body.length, 1);
      assert.equal(p.value.body.body[0].argument.name, p.key.name);
    } else {
      assert.equal(p.value.type, "ArrowFunctionExpression", "do not capture dependencies during construction");
      assert.equal(p.value.body.type, "CallExpression");
      assert.equal(p.value.body.callee.name, p.key.name);
    }
  }
}
(async () => {
  const declarations = core.body.filter((s) => s.type !== "ImportDeclaration");
  assert.equal(declarations[0].declarations[0].id.name, "editorScreens", "copy registration must precede existing feature construction");
  const compiled = await esbuild.build({
    stdin: {
      contents: "export { createEditorScreens } from './editor_screens.js'; export { WriterState } from './state.js';",
      resolveDir: directory,
    },
    bundle: true,
    format: "cjs",
    write: false,
    plugins: [
      {
        name: "data",
        setup(build) {
          build.onResolve({ filter: /\/data\// }, (args) => ({ path: path.join(root, "build/generated/modules/data", path.basename(args.path)) }));
        },
      },
    ],
  });
  const coldCalls = [],
    cold = { exports: {} };
  const unavailable = new Proxy(
    {},
    {
      get(_, key) {
        throw new Error("premature service access: " + String(key));
      },
    },
  );
  new Function("module", "exports", "document", compiled.outputFiles[0].text)(cold, cold.exports, {
    addEventListener: (...args) => coldCalls.push(args),
  });
  assert.deepEqual(cold.exports.WriterState, {}, "importing editor definitions must not start Writer");
  cold.exports.createEditorScreens(unavailable);
  assert.deepEqual(cold.exports.WriterState, {});
  assert.equal(coldCalls.length, 1);
  assert.equal(coldCalls[0][0], "click");
  assert.equal(coldCalls[0][2], undefined);
  const dom = new JSDOM(
    '<div id="app"><main class="document-workspace"><button data-citation-copies>Copies</button><div class="editor-readiness"><span id="chk-chip"></span><span class="readiness-actions" data-readiness-key="0:Go to first required field"><button id="kept-focus">Next</button></span></div><button id="btn-review">Review</button><button id="btn-final">Issue</button><div class="desk"><section class="cit"></section><section class="cit"></section><section class="cit"></section><section class="cit"></section></div><div hidden data-editor-check-messages></div></main></div><div id="overlay"></div>',
    { url: "http://localhost/" },
  );
  const document = dom.window.document,
    box = { exports: {} };
  new Function("module", "exports", "document", compiled.outputFiles[0].text)(box, box.exports, document);
  const { createEditorScreens, WriterState: state } = box.exports,
    trace = [];
  const d = {
    id: "draft",
    caseId: "case",
    draft: true,
    items: [
      { id: "one", no: "1" },
      { id: "two", no: "2" },
    ],
    cits: {},
  };
  Object.assign(state, { state: { docId: d.id, screen: "write" }, DOCS: [d], CASES: [{ id: d.caseId }], EVENTS: {}, RECORD_ATTEMPTS: {} });
  let checks = [
    { ok: false, t: "Required field", targets: [{ selector: "#field" }] },
    { ok: false, soft: true, t: "Advisory" },
    { ok: true, t: "Passed" },
  ];
  let editable = true,
    blocked = false,
    renderCount = 0,
    editor;
  editor = createEditorScreens({
    checks: () => {
      trace.push("checks");
      return checks;
    },
    isLocked: () => !editable,
    checkRowHTML: (c) => "<p>" + c.t + "</p>",
    recordIntegrity: { status: () => ({ valid: true }), blocked: () => blocked },
    structEditable: () => editable,
    snow: { isCase: () => false },
    render: () => {
      renderCount++;
      editor.editorEnhance();
    },
    toast: () => trace.push("toast"),
    documentHTML: () => {
      trace.push("document");
      return '<button data-grip="one">One</button><button data-grip="two">Two</button>';
    },
    paginate: () => trace.push("paginate"),
    highlightOpenChecks: () => trace.push("highlight"),
    scheduleDraftSave: () => trace.push("schedule"),
  });
  const ready = editor.editorReadiness(d);
  assert.equal(ready.required.length, 1);
  assert.equal(ready.advice.length, 1);
  assert.deepEqual(editor.readinessFirst(ready), { index: 0, label: "Go to first required field" });
  const review = editor.reviewConcernsHTML(d, ready);
  assert.ok(review.indexOf("Must fix before issuing") < review.indexOf("Advisories"));
  assert.ok(review.includes("passed-checks"));
  const button = document.querySelector("[data-citation-copies]");
  button.click();
  assert.equal(state.state.compactCitationCopies, d.id);
  assert.equal(renderCount, 1, "copy action remains synchronous");
  assert.equal(document.querySelectorAll("[data-editor-extra-copy]").length, 3);
  assert.equal(document.activeElement, button);
  button.click();
  assert.equal(state.state.compactCitationCopies, null);
  assert.equal(document.querySelectorAll("[data-editor-extra-copy]").length, 0);
  const focus = document.getElementById("kept-focus");
  focus.focus();
  editor.editorSync();
  assert.equal(document.activeElement, focus, "unchanged readiness actions retain their focused node");
  assert.ok(focus.isConnected);
  assert.equal(document.getElementById("btn-review").textContent, "Review · 1");
  trace.length = 0;
  editor.refreshSheet();
  assert.deepEqual(
    trace,
    ["document", "paginate", "checks", "highlight", "schedule"],
    "render, layout, checks and deferred save keep their original order",
  );
  editable = false;
  assert.equal(editor.moveItem("two", "up"), false);
  assert.deepEqual(
    d.items.map((i) => i.id),
    ["one", "two"],
  );
  editable = true;
  assert.equal(editor.moveItem("two", "up", true), true);
  assert.deepEqual(
    d.items.map((i) => [i.id, i.no]),
    [
      ["two", "1"],
      ["one", "2"],
    ],
  );
  assert.equal(document.activeElement.dataset.grip, "two");
  assert.equal(state.DIRTY, true);
  blocked = true;
  const count = state.DOCS.length;
  editor.newDoc(d.caseId, "notice");
  assert.equal(state.DOCS.length, count, "blocked records cannot start a draft");
  checks = [];
  assert.equal(editor.editorReadiness(d).required.length, 0);
  state.state.modal = "review";
  document.getElementById("overlay").innerHTML = '<section role="dialog"><h2>Review</h2><div class="modal-b"></div><button>Close</button></section>';
  editor.enhanceDialog();
  const dialog = document.querySelector('[role="dialog"]');
  assert.equal(document.activeElement, dialog);
  assert.equal(document.getElementById("app").inert, true);
  assert.equal(dialog.getAttribute("aria-labelledby"), "dialog-title");
  document.getElementById("overlay").innerHTML = "";
  editor.enhanceDialog();
  assert.equal(document.getElementById("app").inert, false);
  dom.window.close();
  console.log(
    JSON.stringify({
      passed: true,
      isolatedEditor: true,
      lazyComposition: true,
      synchronousCopies: true,
      retainedFocus: true,
      refreshSaveOrder: true,
      recordGuards: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
