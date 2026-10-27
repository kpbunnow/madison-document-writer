const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Independent retained record actions, correction UI and inspection-history ownership. */
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
const defs = {
  inspectionHistory: ["inspection_history", "createInspectionHistory", ["correctionVisitPatch"]],
  correctionUI: ["correction_ui", "createCorrectionUI", ["correctionChanges", "today", "correctionTypeAllowed"]],
  recordActions: [
    "record_actions",
    "createRecordActions",
    ["correctionEligibility", "toast", "evid", "render", "commitAmendment", "issueCorrection", "publishDocument"],
  ],
};
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
let prev = entries.findIndex((n) => n.id.name === "recordHistory");
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
  assert.ok(entries.indexOf(e) > prev);
  assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "documentRenderer"));
  prev = entries.indexOf(e);
  for (const p of serviceComposition(e.init.arguments[0]).properties) {
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
        "export * from './inspection_history.js'; export {createCorrectionUI} from './correction_ui.js'; export {createRecordActions} from './record_actions.js'; export {WriterState} from './state.js'; export {INSPECTORS} from './data/inspectors.js';",
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
  const {
    createInspectionHistory,
    createCorrectionUI,
    createRecordActions,
    itemHistory,
    itemInspectionHistory,
    hasItemInspectionHistory,
    WriterState: s,
    INSPECTORS,
  } = box.exports;
  assert.deepEqual(s, {});
  for (const c of [createInspectionHistory, createCorrectionUI, createRecordActions])
    c(new Proxy({}, { get: (_, k) => assert.fail("premature " + String(k)) }));
  assert.deepEqual(s, {});
  let calls, commits, commitOK, commitError, fault, seq, day, patch, changes, source, d;
  const actor = INSPECTORS.find((i) => i.name).id;
  const actions = createRecordActions({
    correctionEligibility() {
      return fault;
    },
    toast(text) {
      calls.push(["toast", text]);
    },
    evid() {
      return "event" + ++seq;
    },
    render() {
      calls.push("render");
    },
    async commitAmendment(cid, attempt, holder) {
      commits.push({ cid, attempt, holder });
      if (commitError) throw Error("uncertain write");
      return commitOK;
    },
  });
  const ui = createCorrectionUI({
    correctionChanges() {
      return changes;
    },
    get today() {
      return day;
    },
    correctionTypeAllowed() {
      return true;
    },
  });
  assert.equal("correctionValueText" in ui, false);
  const history = createInspectionHistory({
    correctionVisitPatch() {
      return patch;
    },
  });
  function reset() {
    calls = [];
    commits = [];
    commitOK = true;
    commitError = false;
    fault = "";
    seq = 0;
    day = "2026-10-26";
    patch = null;
    changes = [];
    source = { id: "source", caseId: "one", type: "notice", authoringVersion: 9, items: [], issuedAt: "2026-10-01T12:00:00Z" };
    d = {
      id: "draft",
      caseId: "one",
      draft: true,
      type: "notice",
      items: [],
      correction: {
        targetId: "source",
        reason: "<reason>",
        externalReference: "<external>",
        actionDate: "2026-10-01",
        case: { parcel: "<parcel>", siteCity: "Madison" },
      },
    };
    Object.assign(s, {
      CASES: [{ id: "one", inspectorId: actor, date: "2026-10-01" }],
      DOCS: [d, source],
      REINSP: [],
      EVENTS: { one: [] },
      RECORD_ATTEMPTS: {},
      WORK: { recordForms: {} },
      state: { docId: source.id, modal: "recordnote", amendmentError: "" },
    });
  }
  reset();
  commitOK = false;
  assert.equal(await actions.addRecordNote(source.id, "  Retained original note  "), false);
  assert.equal(s.state.modal, "recordnote");
  assert.equal(calls.length, 0);
  const first = commits[0],
    key = "one_source_documentannotated";
  assert.equal(s.RECORD_ATTEMPTS[key], first.holder);
  assert.equal(first.attempt.payload.text, "Retained original note");
  assert.equal(first.attempt.by, actor);
  commitOK = true;
  assert.equal(await actions.addRecordNote(source.id, "Different attempted retry", actor), true);
  assert.equal(commits[1].attempt, first.attempt);
  assert.equal(commits[1].holder, first.holder);
  assert.equal(s.state.modal, null);
  assert.equal(calls[0], "render");
  assert.match(calls.at(-1)[1], /issued document is unchanged/);
  reset();
  commitError = true;
  await assert.rejects(actions.reconcileDocument(source.id, "Recipients notified with reference"), /uncertain/);
  assert.equal(s.state.modal, "recordnote");
  assert.equal(Object.keys(s.RECORD_ATTEMPTS).length, 1);
  assert.equal(calls.length, 0);
  reset();
  fault = "Blocked by original eligibility";
  assert.equal(await actions.voidDocument(source.id, "Specific withdrawal reason"), false);
  assert.equal(commits.length, 0);
  assert.match(calls.at(-1)[1], /Blocked/);
  fault = "";
  source.type = "citation";
  assert.equal(await actions.voidDocument(source.id, "Specific withdrawal reason", "short"), false);
  assert.equal(commits.length, 0);
  assert.equal(await actions.voidDocument(source.id, "  Specific withdrawal reason  ", "Court instructed this withdrawal", "other"), true);
  assert.equal(commits[0].attempt.type, "document.voided");
  assert.equal(commits[0].attempt.by, "other");
  assert.equal(commits[0].attempt.payload.reason, "Specific withdrawal reason");
  assert.ok("expectedHead" in commits[0].attempt.payload);
  assert.equal(commits[0].attempt.payload.externalReference, "Court instructed this withdrawal");
  reset();
  for (const call of [
    () => actions.addRecordNote("missing", "Specific note text"),
    () => actions.addRecordNote(d.id, "Specific note text"),
    () => actions.reconcileDocument(source.id, "short"),
  ])
    assert.equal(await call(), false);
  assert.equal(commits.length, 0);
  assert.equal(await actions.reconcileDocument(source.id, " Completed notifications and filing "), true);
  assert.equal(commits[0].attempt.payload.reference, "Completed notifications and filing");
  reset();
  changes = [
    { label: "<charge>", path: "citation.x.base", before: 100, after: "197.00" },
    { label: "<text>", path: "item.text", before: "<old>", after: "<new>" },
  ];
  let view = new JSDOM(ui.correctionDiffHTML(d)).window.document;
  assert.match(view.body.textContent, /\$100.00/);
  assert.match(view.body.textContent, /\$197.00/);
  assert.match(view.body.textContent, /<old>/);
  assert.equal(view.querySelector("old"), null);
  const before = copy(s);
  view = new JSDOM(ui.correctionPanel(d)).window.document;
  assert.equal(view.querySelector("#correction-reason").value, "<reason>");
  assert.equal(view.querySelector("#correction-action-date").max, day);
  assert.equal(view.querySelector("#btn-reviewcorrection").disabled, false);
  assert.deepEqual(s, before);
  day = "2026-10-27";
  assert.equal(new JSDOM(ui.correctionPanel(d)).window.document.querySelector("#correction-action-date").max, day);
  d.pendingAmendment = {};
  view = new JSDOM(ui.correctionPanel(d)).window.document;
  assert.ok(view.querySelector("#correction-reason").disabled);
  assert.ok(view.querySelector("#btn-reviewcorrection").disabled);
  assert.ok(view.querySelector("#btn-retrycorrection"));
  assert.equal(ui.correctionPanel(source), "");
  reset();
  s.WORK.recordForms["source:recordnote"] = { text: "typed <note>" };
  view = new JSDOM(ui.recordActionModal()).window.document;
  assert.equal(view.querySelector("#record-action-text").value, "typed <note>");
  s.RECORD_ATTEMPTS = {
    held: { cid: "one", pendingAmendment: { type: "document.annotated", by: actor, payload: { docId: "source", text: "retained <request>" } } },
  };
  view = new JSDOM(ui.recordActionModal()).window.document;
  assert.equal(view.querySelector("#record-action-text").value, "retained <request>");
  assert.ok(view.querySelector("#record-action-text").disabled);
  assert.ok(view.querySelector("#record-action-inspector").disabled);
  assert.equal(view.querySelector("#record-action-go").textContent, "Confirm previous save");
  s.state.modal = "other";
  assert.equal(ui.recordActionModal(), "");
  reset();
  const rootDoc = { id: "root", caseId: "one", type: "notice", inspDate: "2026-10-01", items: [{ id: "rootItem", no: "1" }] },
    next = {
      id: "next",
      caseId: "one",
      type: "referral",
      authoringVersion: 14,
      fromDocId: "root",
      fromReinspId: "current",
      inspDate: "2026-10-20",
      items: [{ id: "nextItem", no: "1", srcItemId: "rootItem" }],
    };
  s.DOCS = [
    rootDoc,
    next,
    {
      id: "initialCitation",
      caseId: "one",
      type: "citation",
      fromDocId: "root",
      items: [{ id: "cite1", no: "1", srcItemId: "rootItem", cite: true }],
      cits: { cite1: { num: "A" } },
    },
    {
      id: "visitCitation",
      caseId: "one",
      type: "citation",
      fromDocId: "root",
      fromReinspId: "v1",
      items: [{ id: "cite2", no: "1", srcItemId: "rootItem", cite: true }],
      cits: { cite2: { num: "B" } },
    },
  ];
  s.REINSP = [
    { id: "v1", caseId: "one", sourceDocId: "root", date: "2026-10-10", results: { rootItem: { oc: "progress", note: " observed " } } },
    { id: "carried", caseId: "one", sourceDocId: "root", date: "2026-10-11", results: { rootItem: { oc: "corrected", carried: true } } },
    { id: "otherDraft", caseId: "one", sourceDocId: "root", draft: true, date: "2026-10-12", results: { rootItem: { oc: "none" } } },
    {
      id: "current",
      caseId: "one",
      sourceDocId: "root",
      draft: true,
      date: "2026-10-20",
      results: { rootItem: { oc: "corrected", on: "2026-10-19", note: "done" } },
    },
  ];
  const retained = copy(s),
    rows = itemInspectionHistory(next, next.items[0]);
  assert.deepEqual(
    rows.map((x) => [x.on, x.oc, x.cit]),
    [
      ["2026-10-01", "initial", "A"],
      ["2026-10-10", "progress", "B"],
      ["2026-10-19", "corrected", ""],
    ],
  );
  assert.equal(rows[1].note, "observed");
  assert.deepEqual(s, retained);
  const added = itemInspectionHistory(next, { id: "newItem", no: "2" });
  assert.equal(added[0].on, "2026-10-20");
  assert.equal(added.length, 1);
  assert.equal(hasItemInspectionHistory({ type: "referral", authoringVersion: 13 }), false);
  assert.equal(hasItemInspectionHistory({ type: "referral", authoringVersion: 14 }), true);
  assert.equal(hasItemInspectionHistory({ type: "compliance", authoringVersion: 14 }), false);
  assert.equal(hasItemInspectionHistory({ type: "compliance", authoringVersion: 15 }), true);
  assert.equal(hasItemInspectionHistory({ type: "notice", authoringVersion: 16 }), false);
  const legacy = itemHistory("one", "1");
  assert.ok(legacy.some((x) => x.cit === "A"));
  assert.ok(legacy.some((x) => x.cit === "B"));
  assert.equal(itemHistory("other", "1").length, 0);
  const correcting = { ...next, correction: {}, items: [] },
    it = { srcItemId: "rootItem", no: "1", hist: copy(rows) };
  patch = { id: "v1", date: "2026-10-14", results: { rootItem: { oc: "corrected", on: "2026-10-13", note: "fixed" } } };
  const patched = history.documentItemHistory(correcting, it);
  assert.equal(patched.find((x) => x.visitId === "v1").on, "2026-10-13");
  assert.equal(patched.find((x) => x.visitId === "v1").note, "fixed");
  assert.equal(it.hist[1].on, "2026-10-10");
  patch = null;
  assert.equal(history.documentItemHistory(correcting, it), it.hist);
  assert.equal(history.documentItemHistory({ ...correcting, correction: null }, it), it.hist);
  console.log(
    JSON.stringify({
      passed: true,
      historyInputs: 1,
      correctionInputs: 3,
      actionInputs: 7,
      inertConstruction: true,
      retainedRetryIdentity: true,
      correctionLockAndEscaping: true,
      itemLineageAndHistoricalCutoffs: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
