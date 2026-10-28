const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Isolated citation drafts, visit recording and lossless working-control capture. */
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
  workingPapers: ["working_papers", "createWorkingPapers", ["ensureWalkContext", "ENTRY_IDS", "document", "recordFormKey"]],
  citationDrafts: [
    "citation_drafts",
    "createCitationDrafts",
    [
      "priorCitations",
      "uid",
      "today",
      "citationNumber",
      "fmtDate",
      "nextCourtDate",
      "applyDeposit",
      "saveDrafts",
      "depositStep",
      "sourceDocFor",
      "unissuedVisitFor",
    ],
  ],
  visitRecording: ["visit_recording", "createVisitRecording", ["appendEvent", "saveDrafts", "toast", "fmtDate", "render"]],
};
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
let previous = entries.findIndex((n) => n.id.name === "recordActions");
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
  assert.ok(entries.indexOf(e) < entries.findIndex((n) => n.id.name === "documentRenderer"));
  previous = entries.indexOf(e);
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
        "export {createCitationDrafts} from './citation_drafts.js'; export {createVisitRecording} from './visit_recording.js'; export * from './working_papers.js'; export {createRecordActions} from './record_actions.js'; export {WriterState} from './state.js';",
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
  const {
    createCitationDrafts,
    createVisitRecording,
    createWorkingPapers,
    createRecordActions,
    hasSetupWork,
    importResumePanel,
    workingNotesPanel,
    filingPanel,
    WriterState: s,
  } = box.exports;
  assert.deepEqual(s, {});
  for (const c of [createCitationDrafts, createVisitRecording, createWorkingPapers])
    c(new Proxy({}, { get: (_, k) => assert.fail("premature " + String(k)) }));
  assert.deepEqual(s, {});
  let calls, seq, day, prior, unissued, source, walkOK;
  const drafts = createCitationDrafts({
    priorCitations: () => prior,
    uid: (k) => k + ++seq,
    get today() {
      return day;
    },
    citationNumber: () => "CIT" + seq,
    fmtDate: (v) => "date:" + v,
    nextCourtDate: () => "2026-12-01",
    applyDeposit(d, id, ord) {
      calls.push(["deposit", d.id, id, ord]);
    },
    saveDrafts() {
      calls.push("save");
      return false;
    },
    get depositStep() {
      return {
        openNext(d) {
          calls.push(["open", d.id]);
        },
      };
    },
    sourceDocFor: () => source,
    unissuedVisitFor: () => unissued,
  });
  const visits = createVisitRecording({
    appendEvent(cid, type, payload, unused, by) {
      calls.push(["append", cid, type, copy(payload), unused, by]);
      const e = { id: "recorded", type, at: "2026-10-20T12:00:00Z", by, payload };
      s.EVENTS[cid].push(e);
      return e;
    },
    saveDrafts() {
      calls.push("save");
      return false;
    },
    toast(text) {
      calls.push(["toast", text]);
    },
    fmtDate: (v) => "date:" + v,
    render() {
      calls.push("render");
    },
  });
  const dom = new JSDOM(
    '<input id="entry" value="DOM value"><input id="missing" value="fallback"><textarea id="record-action-text">DOM note</textarea><input id="record-action-external" value="DOM external"><input id="record-action-inspector" value="actor"><input type="checkbox" data-finsend="0" checked><input type="checkbox" data-finsend="1"><input type="checkbox" data-finsend="99" checked>',
  );
  const capture = createWorkingPapers({
    ensureWalkContext: () => walkOK,
    get ENTRY_IDS() {
      return ["entry", "missing"];
    },
    get document() {
      return dom.window.document;
    },
    recordFormKey: () => "source:recordnote",
  });
  function reset() {
    calls = [];
    seq = 0;
    day = "2026-10-26";
    prior = 0;
    unissued = null;
    walkOK = true;
    source = {
      id: "source",
      caseId: "one",
      type: "notice",
      authoringVersion: 9,
      mailed: "2026-10-02",
      items: [
        { id: "a", no: "1", cite: true, title: "Repair.", sections: ["27.05(2)(c)"] },
        { id: "b", no: "2", cite: true, done: true, sections: [] },
        { id: "c", no: "3", cite: true, withdrawn: true, sections: [] },
      ],
      frozen: { case: { id: "one", date: "2026-10-01", time: "09:00" }, inspector: { id: "inspector", badge: "42" } },
    };
    Object.assign(s, {
      CASES: [
        {
          id: "one",
          number: "<case>",
          emails: [
            { addr: "one@example.test", kind: "Owner" },
            { addr: "two@example.test", kind: "Other" },
          ],
        },
      ],
      DOCS: [source],
      REINSP: [],
      EVENTS: { one: [] },
      WORK: { entry: { entry: "" }, recordForms: { "source:recordnote": { text: "", external: "typed" } } },
      state: { screen: "import", modal: null, acc: null, docId: "source" },
      DIRTY: false,
    });
  }
  reset();
  assert.equal(drafts.citationTier("one", "1"), "1st");
  prior = 1;
  assert.equal(drafts.citationTier("one", "1"), "2nd");
  prior = 4;
  assert.equal(drafts.citationTier("one", "1"), "3rd+");
  assert.equal(drafts.citationFromNotice("missing"), null);
  const before = copy(source),
    nd = drafts.citationFromNotice(source.id);
  assert.equal(nd.draft, true);
  assert.equal(nd.fromDocId, "source");
  assert.equal(nd.inspectorId, "inspector");
  assert.equal(nd.inspDate, "2026-10-01");
  assert.equal(nd.inspTime, "09:00");
  assert.equal(nd.mailed, day);
  assert.equal(nd.items.length, 3);
  assert.deepEqual(
    nd.items.map((i) => i.cite),
    [true, false, false],
  );
  assert.deepEqual(
    nd.items.map((i) => i.srcItemId),
    ["a", "b", "c"],
  );
  assert.equal(new Set(nd.items.map((i) => i.id)).size, 3);
  const cite = nd.cits[nd.items[0].id];
  assert.equal(cite.deptId, "42");
  assert.equal(cite.courtDate, "2026-12-01");
  assert.equal(cite.depositMode, "schedule");
  assert.deepEqual(cite.preparedSections, ["27.05(2)(c)"]);
  assert.match(cite.comment, /Official Notice dated date:2026-10-02/);
  assert.deepEqual(source, before);
  assert.deepEqual(calls.slice(-2), ["save", ["open", nd.id]]);
  assert.equal(calls.filter((c) => Array.isArray(c) && c[0] === "deposit").length, 1);
  calls = [];
  assert.equal(drafts.citationFromNotice(source.id), nd);
  assert.equal(calls.length, 0);
  reset();
  source.items.forEach((i) => (i.cite = false));
  assert.equal(drafts.citationFromNotice(source.id), null);
  assert.equal(seq, 0);
  reset();
  assert.equal(drafts.needsInitialCitation(source), true);
  assert.match(drafts.citationRecoveryPanel(source), /Create citation draft/);
  for (const block of [
    () => (source.void = true),
    () => s.DOCS.push({ id: "draft", caseId: "one", draft: true }),
    () => s.REINSP.push({ id: "visit", caseId: "one", draft: true }),
    () => (unissued = {}),
    () => s.DOCS.push({ id: "citation", caseId: "one", type: "citation", fromDocId: "source" }),
  ]) {
    reset();
    block();
    assert.equal(drafts.needsInitialCitation(source), false);
    assert.equal(drafts.citationRecoveryPanel(source), "");
  }
  reset();
  let r = {
    id: "visit",
    caseId: "one",
    draft: true,
    sourceDocId: "source",
    date: "2026-10-20",
    inspectorId: "inspector",
    previousDraft: { id: "old" },
    results: { a: { oc: "none" } },
  };
  s.REINSP = [r];
  const event = visits.recordReinspection(r);
  assert.equal(event.type, "reinspection.recorded");
  assert.equal(event.payload.reinspection.draft, undefined);
  assert.equal(event.payload.reinspection.previousDraft, undefined);
  assert.equal(event.payload.reinspection.results.a.on, "2026-10-20");
  assert.equal(r.results.a.on, undefined);
  assert.equal(s.REINSP[0].draft, undefined);
  assert.equal(s.REINSP[0].id, "visit");
  assert.equal(calls[0][0], "append");
  assert.deepEqual(calls.slice(1), ["save", ["toast", "Reinspection of date:2026-10-20 recorded"], "render"]);
  assert.equal(visits.recordReinspection(s.REINSP[0]), null);
  reset();
  r = { id: "quiet", caseId: "one", draft: true, sourceDocId: "source", date: "2026-10-20", results: {} };
  s.REINSP = [r];
  visits.recordReinspection(r, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1], "save");
  reset();
  capture.captureWork();
  assert.equal(s.WORK.entry.entry, "");
  assert.equal(s.WORK.entry.missing, "fallback");
  s.state.modal = "recordnote";
  capture.captureWork();
  assert.equal(s.WORK.recordForms["source:recordnote"].text, "");
  assert.equal(s.WORK.recordForms["source:recordnote"].external, "typed");
  assert.equal(s.WORK.recordForms["source:recordnote"].actor, "actor");
  s.state.acc = { nested: { saved: true } };
  capture.captureWork();
  s.state.acc.nested.saved = false;
  assert.equal(s.WORK.acc.nested.saved, true);
  s.state.screen = "reinspect";
  Object.assign(s.state, {
    riWalk: true,
    riWalkContext: "one|visit",
    riWalkItem: "a",
    riWalkUndo: { a: { oc: "none" } },
    riWalkSkipped: ["b"],
    riWalkMode: "guided",
    riWalkStage: "outcome",
  });
  capture.captureWork();
  assert.equal(s.WORK.walk.context, "one|visit");
  s.state.riWalkUndo.a.oc = "corrected";
  s.state.riWalkSkipped.push("c");
  assert.equal(s.WORK.walk.undo.a.oc, "none");
  assert.deepEqual(s.WORK.walk.skipped, ["b"]);
  walkOK = false;
  s.state.riWalkItem = "new";
  capture.captureWork();
  assert.equal(s.WORK.walk.item, "a");
  s.state.modal = "final";
  source.draft = true;
  capture.captureWork();
  assert.deepEqual(source.emailSelection, ["one@example.test|Owner"]);
  source.pendingAmendment = {};
  source.emailSelection = ["keep"];
  capture.captureWork();
  assert.deepEqual(source.emailSelection, ["keep"]);
  reset();
  assert.equal(hasSetupWork(), false);
  s.WORK.entry["lookup-number"] = " <case> ";
  assert.equal(hasSetupWork(), true);
  let html = new JSDOM(importResumePanel()).window.document;
  assert.match(html.body.textContent, /<case>/);
  assert.equal(html.querySelector("case"), null);
  s.WORK.recordForms = { "source:recordnote": { text: "note" }, "missing:recordnote": { text: "orphan" }, "source:void": { text: "" } };
  html = new JSDOM(workingNotesPanel()).window.document;
  assert.equal(html.querySelectorAll("[data-worknote]").length, 1);
  assert.equal(html.querySelector("[data-worknote]").dataset.worknote, "source:recordnote");
  assert.match(filingPanel(source), /PDF filing needed/);
  assert.equal(filingPanel({ ...source, draft: true }), "");
  assert.equal(filingPanel({ ...source, filedAt: "date" }), "");
  assert.match(filingPanel({ ...source, authoringVersion: 11, issuanceGroup: { citationId: "citation" } }), /Delivered within the citation/);
  const dispatch = createRecordActions({
    issueCorrection(v) {
      calls.push(["correction", v.id]);
      return "corrected";
    },
    publishDocument(v) {
      calls.push(["publish", v.id]);
      return "published";
    },
  });
  calls = [];
  assert.equal(dispatch.runFinalize(null), undefined);
  assert.equal(dispatch.runFinalize({ id: "issued" }), undefined);
  assert.equal(dispatch.runFinalize({ id: "draft", draft: true }), "published");
  assert.equal(dispatch.runFinalize({ id: "fix", draft: true, correction: {} }), "corrected");
  assert.deepEqual(calls, [
    ["publish", "draft"],
    ["correction", "fix"],
  ]);
  dom.window.close();
  console.log(
    JSON.stringify({
      passed: true,
      workingInputs: 4,
      citationInputs: 11,
      visitInputs: 5,
      inertConstruction: true,
      citationIdentityAndGuards: true,
      visitDispatchOrder: true,
      typedWorkAndWalkRetained: true,
      finalizationDispatch: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
