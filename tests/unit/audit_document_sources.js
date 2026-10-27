const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Inert source snapshots and notification/placeholder owners, without Writer startup. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild"),
  { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules");
const parse = (name) => acorn.parse(fs.readFileSync(path.join(dir, name + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, fn) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((v) => walk(v, fn));
  fn(n);
  Object.values(n).forEach((v) => walk(v, fn));
}
const defs = {
  documentFeedback: ["document_feedback", "createDocumentFeedback", ["A11Y", "isLocked", "document", "Event"]],
  documentSources: ["document_sources", "createDocumentSources", ["snow", "initialOrderCitation", "docBody", "docBlocks"]],
};
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
let previous = entries.findIndex((n) => n.id.name === "documentDelivery");
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
  assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "courtScheduling"));
  previous = entries.indexOf(e);
  for (const p of serviceComposition(e.init.arguments[0]).properties)
    if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
    else assert.equal(p.value.body.callee.name, p.key.name);
}
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createDocumentFeedback} from './document_feedback.js';export {createDocumentSources} from './document_sources.js';export {WriterState} from './state.js';export {BLOCKS,COURT,CIT_COPIES,CIT_INSTRUCTIONS,COURT_CONTACT} from './document_types.js';",
      resolveDir: dir,
    },
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
  const { createDocumentFeedback, createDocumentSources, WriterState: s, BLOCKS, COURT, CIT_COPIES, CIT_INSTRUCTIONS, COURT_CONTACT } = box.exports;
  assert.deepEqual(s, {});
  for (const ctor of [createDocumentFeedback, createDocumentSources])
    ctor(new Proxy({}, { get: (_, k) => assert.fail("construction reads " + String(k)) }));
  assert.deepEqual(s, {});
  const copy = (x) => JSON.parse(JSON.stringify(x));
  let notices = [],
    utilityCalls = 0,
    locked = false,
    dom = new JSDOM('<main id="app"></main>'),
    a11y;
  const setup = () => {
    dom = new JSDOM('<main id="app"><div tabindex="0" data-field="text" data-id="i"><button id="blank">blank</button></div></main>');
    a11y = {
      notify: (...args) => notices.push(args),
      utility(title, html) {
        utilityCalls++;
        assert.equal(title, "Add corrective-action detail");
        const dialog = dom.window.document.createElement("dialog");
        dialog.id = "utility-dialog";
        dialog.innerHTML = "<button data-utility-close>Close</button>" + html;
        dialog.close = () => {
          dialog.dispatchEvent(new dom.window.Event("close"));
        };
        dom.window.document.body.append(dialog);
      },
    };
    s.state = { screen: "write", docId: "d" };
    s.DOCS = [{ id: "d", items: [{ id: "i" }] }];
    locked = false;
  };
  setup();
  const ui = createDocumentFeedback({
    get A11Y() {
      return a11y;
    },
    isLocked: () => locked,
    get document() {
      return dom.window.document;
    },
    get Event() {
      return dom.window.Event;
    },
  });
  const options = { severity: "warning" };
  s.undoFn = () => {};
  ui.toast("warning", options);
  assert.equal(s.undoFn, null);
  assert.deepEqual(notices.pop(), ["warning", options]);
  ui.toastHold("busy");
  assert.deepEqual(notices.pop(), ["busy", { severity: "progress" }]);
  let undoCalls = 0;
  const undo = () => {
    assert.equal(s.undoFn, null);
    undoCalls++;
  };
  ui.toastUndo("done", undo);
  assert.equal(s.undoFn, undo);
  let notice = notices.pop();
  assert.equal(notice[1].severity, "success");
  notice[1].undo();
  assert.equal(undoCalls, 1);
  a11y = { ...a11y, notify: (...args) => notices.push(["replacement", ...args]) };
  ui.toast("live");
  assert.equal(notices.pop()[0], "replacement");
  const blank = () => dom.window.document.getElementById("blank"),
    dialog = () => dom.window.document.getElementById("utility-dialog"),
    submit = () =>
      dialog()
        .querySelector("form")
        .dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  locked = true;
  ui.fillBlank(blank());
  assert.equal(utilityCalls, 0);
  locked = false;
  ui.fillBlank(blank());
  assert.equal(utilityCalls, 1);
  assert.equal(dialog().querySelector("[data-utility-close]").textContent, "Cancel");
  assert.equal(dom.window.document.activeElement, dialog().querySelector("textarea"));
  submit();
  assert.match(dialog().querySelector("#corrective-detail-error").textContent, /Enter text/);
  assert.ok(blank());
  dialog().querySelector("textarea").value = "  <unsafe> corrected detail  ";
  let inputs = 0;
  const field = blank().parentElement;
  field.addEventListener("input", (e) => {
    assert.equal(e.bubbles, true);
    inputs++;
  });
  submit();
  assert.equal(inputs, 1);
  assert.equal(field.textContent, "<unsafe> corrected detail");
  assert.equal(field.querySelector("unsafe"), null);
  assert.equal(dom.window.document.activeElement, field);
  for (const stale of [
    () => (s.state.screen = "home"),
    () => (s.state.docId = "other"),
    () => (s.DOCS = []),
    () => (locked = true),
    () => (s.DOCS[0].items = []),
    () => (s.DOCS[0].items[0].withdrawn = true),
    () => (s.DOCS[0].items[0].done = true),
    () => blank().parentElement.remove(),
    () => blank().replaceWith(dom.window.document.createElement("span")),
  ]) {
    setup();
    const el = blank();
    ui.fillBlank(el);
    dialog().querySelector("textarea").value = "refused";
    stale();
    submit();
    assert.match(dialog().querySelector("#corrective-detail-error").textContent, /no longer editable/);
    assert.equal(el.textContent, "blank");
  }
  setup();
  s.DOCS[0].correction = { targetId: "old" };
  s.DOCS[0].items[0].done = true;
  ui.fillBlank(blank());
  dialog().querySelector("textarea").value = "correction allowed";
  submit();
  assert.equal(blank(), null);
  // Replacing workspace arrays before submit must edit only the current document's field/event path.
  setup();
  ui.fillBlank(blank());
  s.DOCS = [{ id: "d", items: [{ id: "i", withdrawn: true }] }];
  dialog().querySelector("textarea").value = "refused";
  submit();
  assert.ok(blank());
  assert.match(dialog().querySelector("#corrective-detail-error").textContent, /no longer editable/);
  let order = [],
    snowMode = false,
    body = "approved body",
    blocks = [{ id: "b", text: "approved" }],
    initial = false;
  let snow = {
    is: () => snowMode,
    freeze: () => {
      order.push("snow");
      return { snowRule: { season: "kept" }, case: { discard: "overridden" } };
    },
  };
  const sources = createDocumentSources({
    get snow() {
      return snow;
    },
    initialOrderCitation: () => initial,
    docBody: (d) => {
      order.push("body");
      return body;
    },
    docBlocks: () => {
      order.push("blocks");
      return blocks;
    },
  });
  s.CASES = [{ id: "c", owner: "Live owner", historic: true, landmark: "Landmark" }];
  let d = { id: "d", caseId: "c", type: "notice", authoringVersion: 16, items: [{ text: "Repair exterior siding" }] };
  const active = sources.activeBlocks(d);
  assert.deepEqual(
    active.slice(0, Object.keys(BLOCKS).filter((k) => BLOCKS[k].always).length),
    Object.keys(BLOCKS).filter((k) => BLOCKS[k].always),
  );
  assert.ok(active.includes("PERMIT_500"));
  assert.ok(active.includes("LANDMARKS"));
  assert.equal(active.includes("LANDMARK"), !!String(BLOCKS.LANDMARK?.text || "").trim());
  assert.deepEqual(sources.activeBlocks({ ...d, type: "extension" }), []);
  initial = true;
  assert.deepEqual(sources.activeBlocks({ ...d, type: "citation" }), active);
  initial = false;
  snowMode = true;
  assert.deepEqual(sources.activeBlocks(d), ["LANGUAGE"]);
  snowMode = false;
  d.frozen = {
    case: { id: "c", owner: "Frozen owner", nested: { x: 1 } },
    inspector: { name: "Frozen inspector" },
    court: { room: "old room", nested: { x: 1 } },
    courtCopies: [{ name: "old copy" }],
    courtInstructions: "retained instructions",
    courtContact: { phone: "retained" },
  };
  const before = copy(d),
    frozen = sources.freezeSources(d);
  assert.deepEqual(d, before);
  assert.deepEqual(order, ["body", "blocks"]);
  assert.equal(frozen.case.owner, "Frozen owner");
  assert.equal(frozen.inspector.name, "Frozen inspector");
  assert.equal(frozen.body, body);
  assert.equal(frozen.court.room, "RM#203,");
  assert.equal(frozen.courtInstructions, "retained instructions");
  assert.equal(frozen.courtCopies[0].name, "old copy");
  assert.ok(Number.isFinite(Date.parse(frozen.at)));
  frozen.case.nested.x = 2;
  frozen.court.nested.x = 2;
  frozen.blocks[0].text = "changed";
  frozen.courtCopies[0].name = "changed";
  assert.equal(d.frozen.case.nested.x, 1);
  assert.equal(d.frozen.court.nested.x, 1);
  assert.equal(blocks[0].text, "approved");
  assert.equal(d.frozen.courtCopies[0].name, "old copy");
  const old = sources.freezeSources({ ...d, authoringVersion: 8 });
  assert.equal(old.court.room, "old room");
  assert.equal(Object.hasOwn(old.court, "caseNumberLabel"), false);
  const defaults = sources.freezeSources({ ...d, frozen: undefined });
  assert.deepEqual(defaults.courtCopies, CIT_COPIES);
  assert.equal(defaults.courtInstructions, CIT_INSTRUCTIONS);
  assert.deepEqual(defaults.courtContact, COURT_CONTACT);
  assert.equal(defaults.case.owner, "Live owner");
  s.CASES = [{ id: "c", owner: "Replaced owner" }];
  assert.equal(sources.freezeSources({ ...d, frozen: undefined }).case.owner, "Replaced owner");
  const special = {
    signerName: "Signer",
    signerTitle: "Title",
    delegation: "Ref",
    reviewer: "Reviewer",
    reviewDateLegal: "2026-10-01",
    reviewRef: "Review",
  };
  for (const [type, version, hasSigner] of [
    ["bestInterestExtension", 14, true],
    ["bestInterestExtension", 15, false],
    ["vacancyExtension", 15, true],
    ["vacancyExtension", 16, false],
  ]) {
    const f = sources.freezeSources({ ...d, type, authoringVersion: version, special });
    assert.equal(Object.hasOwn(f, "authorizedSigner"), hasSigner);
    assert.equal(Object.hasOwn(f, "divisionReview"), hasSigner);
    if (hasSigner) assert.deepEqual(f.authorizedSigner, { name: "Signer", title: "Title", delegation: "Ref" });
  }
  snowMode = true;
  order = [];
  const sf = sources.freezeSources(d);
  assert.deepEqual(order, ["snow", "body", "blocks"]);
  assert.deepEqual(sf.snowRule, { season: "kept" });
  assert.equal(sf.case.owner, "Frozen owner");
  snow = { is: () => false };
  assert.equal(Object.hasOwn(sources.freezeSources(d), "snowRule"), false);
  const correction = { ...d, correction: { case: { id: "c", owner: "Correction owner" } } };
  assert.equal(sources.freezeSources(correction).case.owner, "Correction owner");
  console.log(
    JSON.stringify({
      passed: true,
      feedbackInputs: 4,
      sourceInputs: 4,
      inertConstruction: true,
      stalePlaceholderGuards: true,
      undoAndFocus: true,
      sourcePrecedenceAndCloning: true,
      historicalCutoffs: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
