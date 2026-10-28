const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Correction preparation and workflow preserve lineage, checks, retry identity and post-confirmation delivery. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  directory = path.join(root, "app/modules");
const parse = (n) => acorn.parse(fs.readFileSync(path.join(directory, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, visit) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, visit));
  visit(n);
  Object.values(n).forEach((c) => walk(c, visit));
}
const declarations = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
const interfaces = {
  correction_preparation: ["validateAndStandardizeAddresses", "freezeSources", "hasItemInspectionHistory", "documentItemHistory", "evid", "today"],
  correction_workflow: [
    "correctionEligibility",
    "uid",
    "today",
    "docBody",
    "docBlocks",
    "saveDrafts",
    "render",
    "toast",
    "recordIntegrity",
    "commitCitationEdits",
    "citationPricing",
    "blockers",
    "makeCorrectionAttempt",
    "commitAmendment",
    "printJob",
    "filePdf",
    "emailDocument",
    "scrollTo",
  ],
};
for (const [file, fields] of Object.entries(interfaces)) {
  const used = new Set();
  walk(parse(file), (n) => {
    if (n.type === "MemberExpression" && n.object.name === "services") {
      assert.equal(n.computed, false);
      used.add(n.property.name);
    }
  });
  assert.deepEqual([...used].sort(), fields.slice().sort());
  const name = file === "correction_preparation" ? "correctionPreparation" : "correctionWorkflow",
    entry = declarations.find((n) => n.id.name === name);
  assert.equal(entry.init.callee.name, file === "correction_preparation" ? "createCorrectionPreparation" : "createCorrectionWorkflow");
  assert.deepEqual(new Set(serviceComposition(entry.init.arguments[0]).properties.map((p) => p.key.name)), used);
  assert.ok(declarations.indexOf(entry) > declarations.findIndex((n) => n.id.name === "publicationWorkflow"));
  assert.ok(declarations.indexOf(entry) < declarations.findIndex((n) => n.id.name === "documentRenderer"));
  for (const p of serviceComposition(entry.init.arguments[0]).properties) {
    if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
    else {
      assert.equal(p.value.type, "ArrowFunctionExpression");
      if (p.key.name === "scrollTo") {
        assert.equal(p.value.body.callee.object.name, "window");
        assert.equal(p.value.body.callee.property.name, "scrollTo");
      } else assert.equal(p.value.body.callee.name, p.key.name);
    }
  }
}
assert.ok(declarations.findIndex((n) => n.id.name === "correctionPreparation") < declarations.findIndex((n) => n.id.name === "correctionWorkflow"));
const copy = (v) => JSON.parse(JSON.stringify(v));
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createCorrectionPreparation} from './correction_preparation.js'; export {createCorrectionWorkflow} from './correction_workflow.js'; export {WriterState} from './state.js'; export {INSPECTORS} from './data/inspectors.js';",
      resolveDir: directory,
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
  const { createCorrectionPreparation, createCorrectionWorkflow, WriterState: state, INSPECTORS } = box.exports;
  assert.deepEqual(state, {});
  const unavailable = new Proxy({}, { get: (_, k) => assert.fail("premature dependency " + String(k)) });
  createCorrectionPreparation(unavailable);
  createCorrectionWorkflow(unavailable);
  assert.deepEqual(state, {});
  const actor = INSPECTORS.find((i) => i.name).id;
  let today, addressFault, calls, serial, blocked, shared, concerns, commitOK, fileMode, history;
  const preparation = createCorrectionPreparation({
    validateAndStandardizeAddresses: (k, llc) => {
      calls.push(["address", k, llc]);
      return addressFault;
    },
    freezeSources: (d) => ({ case: copy(d.correction.case), inspector: { id: actor } }),
    hasItemInspectionHistory: () => history,
    documentItemHistory: () => [{ on: "2026-10-20", oc: "initial", note: "Retained observation" }],
    evid: () => "event-" + ++serial,
    get today() {
      return today;
    },
  });
  const workflow = createCorrectionWorkflow({
    correctionEligibility: (...args) => preparation.correctionEligibility(...args),
    uid: () => "draft-" + ++serial,
    get today() {
      return today;
    },
    docBody: () => "Original body",
    docBlocks: () => ({ original: true }),
    saveDrafts: async () => {
      calls.push(["save"]);
      return true;
    },
    render: () => calls.push(["render"]),
    toast: (t) => calls.push(["toast", t]),
    get recordIntegrity() {
      return { blocked: () => blocked };
    },
    commitCitationEdits: () => calls.push(["edit"]),
    get citationPricing() {
      return {
        loadShared: async () => {
          calls.push(["pricing"]);
          return shared;
        },
      };
    },
    blockers: () => concerns,
    makeCorrectionAttempt: (d) => {
      calls.push(["make"]);
      return preparation.makeCorrectionAttempt(d);
    },
    commitAmendment: async (cid, event, d) => {
      calls.push(["commit", event]);
      d.pendingAmendment = event;
      if (!commitOK) return false;
      state.DOCS = state.DOCS.filter((x) => x.id !== d.id);
      state.DOCS.unshift(copy(event.payload.snapshot));
      return true;
    },
    printJob: (d) => {
      calls.push(["print", d.id]);
      return { html: "prepared " + d.id, id: d.id };
    },
    filePdf: async (d, job) => {
      calls.push(["file", d.id, job]);
      if (fileMode === "throw") throw new Error("PDF unavailable");
      return fileMode !== "false";
    },
    emailDocument: async (d, rows, confirmed, job) => {
      calls.push(["email", rows, confirmed, job]);
      rows.push({ addr: "mutation@example.test" });
    },
    scrollTo: (...args) => calls.push(["scroll", ...args]),
  });
  function reset() {
    today = new Date("2026-10-26T12:00:00Z");
    addressFault = null;
    calls = [];
    serial = 0;
    blocked = false;
    shared = true;
    concerns = [];
    commitOK = true;
    fileMode = "ok";
    history = false;
    const k = {
      id: "case",
      number: "BLD2026-00001",
      address: "1 SYNTHETIC ST",
      owner: "Synthetic owner",
      date: "2026-10-20",
      inspectorId: actor,
      emails: [],
    };
    const src = {
      id: "source",
      caseId: "case",
      type: "notice",
      draft: false,
      status: "Final",
      authoringVersion: 14,
      mailed: "2026-10-20",
      eventId: "base",
      inspectorId: actor,
      inspDate: "2026-10-20",
      inspTime: "09:00",
      items: [{ id: "item", no: "1", text: "Repair wall", sections: ["27.05(2)(c)"], done: false }],
      cits: {},
      frozen: { case: copy(k), inspector: { id: actor } },
      filedAt: "2026-10-20",
      filedRef: "retained.pdf",
    };
    Object.assign(state, {
      CASES: [k],
      DOCS: [src],
      REINSP: [],
      EVENTS: { case: [{ id: "base", type: "notice.issued", at: "2099-01-01T12:00:00.000Z" }] },
      CASEDIR: { helper: true },
      WORK: { recordForms: {} },
      state: {},
    });
    return src;
  }
  function open() {
    const d = workflow.startCorrection("source");
    d.items[0].text = "Repair the damaged wall";
    d.correction.reason = "Correct the recorded wall description";
    d.correction.reviewed = true;
    return d;
  }
  let src = reset();
  assert.ok(preparation.correctionEligibility(null));
  assert.ok(preparation.correctionEligibility({ ...src, draft: true }));
  assert.ok(preparation.correctionEligibility({ ...src, superseded: true }).includes("replaced"));
  state.DOCS.unshift({ ...src, id: "newer" });
  assert.ok(preparation.correctionEligibility(src).includes("Later documents"));
  state.DOCS = [src];
  state.REINSP = [{ caseId: src.caseId, sourceDocId: src.id }];
  assert.ok(preparation.correctionEligibility(src).includes("inspection already uses"));
  state.REINSP = [];
  state.DOCS.unshift({ id: "another", caseId: "case", draft: true });
  assert.ok(preparation.correctionEligibility(src).includes("existing document draft"));
  src = reset();
  let d = open();
  assert.deepEqual(
    preparation.correctionChecks(d).filter((c) => !c.ok),
    [],
  );
  assert.equal(workflow.startCorrection(src.id), d, "reopen the retained draft");
  assert.equal(state.DOCS.filter((x) => x.draft).length, 1);
  assert.equal(d.authoringVersion, 14);
  assert.equal(d.frozen, undefined);
  assert.equal(d.filedAt, undefined);
  assert.equal(d.filedRef, undefined);
  assert.deepEqual(d.correction.expectedHead, ["base"]);
  assert.equal(d.correction.baseEventId, "base");
  assert.equal(d.correction.body, "Original body");
  assert.equal(src.items[0].text, "Repair wall");
  assert.ok(preparation.correctionChanges(d).some((c) => c.path === "item.1.text"));
  d.items[0].id = "different";
  assert.ok(preparation.correctionChecks(d).some((c) => !c.ok && c.t.includes("identities")));
  d.items[0].id = "item";
  state.EVENTS.case.push({ id: "changed", type: "document.voided" });
  assert.ok(preparation.correctionChecks(d).some((c) => !c.ok && c.t.includes("case changed")));
  state.EVENTS.case.pop();
  d.correction.case.owner = "Revised owner";
  state.CASES[0].owner = "Other working copy";
  assert.ok(preparation.correctionChecks(d).some((c) => !c.ok && c.t.includes("another working copy")));
  src = reset();
  d = open();
  d.items[0].text = src.items[0].text;
  assert.ok(preparation.correctionChecks(d).some((c) => !c.ok && c.t.includes("content correction")));
  d.correction.actionDate = "2026-10-26";
  today = new Date("2026-10-25T12:00:00Z");
  assert.ok(preparation.correctionChecks(d).some((c) => !c.ok && c.t.includes("original action date")));
  today = new Date("2026-10-26T12:00:00Z");
  assert.ok(preparation.correctionChecks(d).find((c) => c.t.includes("original action date")).ok);
  state.CASEDIR = null;
  assert.ok(preparation.correctionChecks(d).some((c) => !c.ok && c.t.includes("current local helper")));
  src = reset();
  src.revision = { number: 2, rootId: "root", originalIssued: "2026-09-01" };
  d = open();
  d.dueWork = { private: true };
  d.selectionCache = { private: true };
  d.publicationEvents = [{ id: "discard" }];
  d.expectedHead = ["discard"];
  d.pendingAmendment = { id: "discard" };
  d.correction.case.ownerAddr = "New address";
  d.correction.case.ownerAddressParsed = { street: "New address" };
  history = true;
  const before = copy(d);
  let a = preparation.makeCorrectionAttempt(d);
  assert.equal(a.type, "correction.issued");
  assert.equal(a.at, "2099-01-01T12:00:00.001Z");
  assert.equal(a.payload.baseEventId, "base");
  assert.deepEqual(a.payload.expectedHead, ["base"]);
  assert.equal(a.payload.snapshot.authoringVersion, 14);
  assert.deepEqual(a.payload.snapshot.revision, {
    number: 3,
    rootId: "root",
    targetId: "source",
    originalIssued: "2026-09-01",
    actionDate: "2026-09-01",
    reason: d.correction.reason,
    externalReference: "",
  });
  for (const k of ["draft", "correction", "pendingAmendment", "dueWork", "selectionCache", "publicationEvents", "expectedHead"])
    assert.equal(a.payload.snapshot[k], undefined, k);
  assert.equal(a.payload.snapshot.replaces, "source");
  assert.deepEqual(a.payload.caseChanges.ownerAddr, { before: null, after: "New address" });
  assert.deepEqual(a.payload.caseChanges.ownerAddressParsed, { before: null, after: { street: "New address" } });
  assert.equal(a.payload.snapshot.items[0].hist[0].note, "Retained observation");
  assert.deepEqual(d, before, "preparation keeps the draft separate from the retained snapshot");
  a.payload.snapshot.items[0].text = "Changed snapshot";
  assert.equal(d.items[0].text, before.items[0].text);
  addressFault = { message: "Address refused" };
  assert.throws(() => preparation.makeCorrectionAttempt(d), /Address refused/);
  src = reset();
  src.authoringVersion = 10;
  d = open();
  assert.equal(preparation.makeCorrectionAttempt(d).payload.snapshot.authoringVersion, 11);
  src = reset();
  src.type = "extension";
  src.fromReinspId = "visit";
  src.items[0].srcItemId = "visit-item";
  const previous = { ...copy(src), id: "previous", type: "notice", fromReinspId: undefined, inspDate: "2026-10-19" };
  state.DOCS.push(previous);
  state.REINSP = [
    {
      id: "visit",
      eventId: "visit-event",
      sourceDocId: "previous",
      date: src.inspDate,
      time: src.inspTime,
      results: { "visit-item": { oc: "progress", on: src.inspDate, note: "Original" }, carried: { oc: "none", carried: true, on: "2026-10-01" } },
    },
  ];
  d = open();
  d.inspDate = "2026-10-21";
  d.items[0].done = true;
  d.items[0].doneOn = "2026-10-21";
  const storedVisit = copy(state.REINSP[0]),
    patch = preparation.correctionVisitPatch(d);
  assert.equal(patch.baseEventId, "visit-event");
  assert.equal(patch.results["visit-item"].oc, "corrected");
  assert.equal(patch.results["visit-item"].on, "2026-10-21");
  assert.equal(patch.results.carried, undefined);
  assert.deepEqual(state.REINSP[0], storedVisit);
  d.items[0].withdrawn = true;
  assert.deepEqual(preparation.correctionVisitPatch(d).results, {});
  src = reset();
  src.type = "bestInterestExtension";
  src.special = { scope: "entire" };
  d = open();
  d.special.scope = "unit";
  assert.ok(preparation.correctionChecks(d).some((c) => !c.ok && c.t.includes("new action")));
  src = reset();
  src.frozen.case.emails = [{ addr: " OWNER@example.test ", kind: "Owner", on: false }];
  state.CASES[0].emails = [
    { addr: "owner@example.test", kind: "Owner", on: false },
    { addr: "local@example.test", kind: "Other", on: true },
  ];
  src.emailedTo = [
    { addr: "OWNER@example.test", kind: "Owner" },
    { addr: "issued@example.test", kind: "Agent" },
  ];
  const original = copy(src);
  d = open();
  assert.equal(d.correction.case.emails.length, 3);
  assert.equal(d.correction.case.emails.find((e) => e.kind === "Owner").on, true);
  assert.ok(d.emailSelection.includes("OWNER@example.test|Owner"));
  assert.deepEqual(src, original);
  assert.equal(d.emailedTo, undefined);
  reset();
  d = open();
  calls = [];
  blocked = true;
  assert.equal(await workflow.issueCorrection(d), false);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["toast"],
  );
  blocked = false;
  d.type = "citation";
  shared = false;
  calls = [];
  assert.equal(await workflow.issueCorrection(d), false);
  assert.equal(
    calls.some((c) => c[0] === "make"),
    false,
  );
  assert.ok(state.state.amendmentError.includes("Shared citation history"));
  reset();
  d = open();
  d.correction.reviewed = false;
  calls = [];
  assert.equal(await workflow.issueCorrection(d), false);
  assert.equal(
    calls.some((c) => c[0] === "commit"),
    false,
  );
  d.correction.reviewed = true;
  concerns = [{ t: "block" }];
  assert.equal(await workflow.issueCorrection(d), false);
  reset();
  d = open();
  commitOK = false;
  calls = [];
  assert.equal(await workflow.issueCorrection(d), false);
  const held = d.pendingAmendment;
  assert.ok(held);
  assert.equal(
    calls.some((c) => c[0] === "file"),
    false,
  );
  calls = [];
  commitOK = true;
  shared = false;
  concerns = [{ t: "new blocker" }];
  d.correction.reviewed = false;
  d.type = "citation";
  assert.equal(await workflow.issueCorrection(d), true);
  assert.equal(calls.find((c) => c[0] === "commit")[1], held);
  for (const step of ["edit", "pricing", "make"])
    assert.equal(
      calls.some((c) => c[0] === step),
      false,
      "retained confirmation skips " + step,
    );
  for (const mode of ["ok", "false", "throw"]) {
    reset();
    d = open();
    d.emailedTo = [{ addr: "recipient@example.test" }];
    fileMode = mode;
    calls = [];
    assert.equal(await workflow.issueCorrection(d), true);
    assert.ok(calls.findIndex((c) => c[0] === "commit") < calls.findIndex((c) => c[0] === "print"));
    assert.ok(calls.findIndex((c) => c[0] === "scroll") < calls.findIndex((c) => c[0] === "print"));
    assert.deepEqual(calls.find((c) => c[0] === "scroll").slice(1), [0, 0]);
    assert.equal(calls.at(-1)[0], "render");
    assert.equal(state.state.modal, null);
    assert.equal(state.state.docId, d.id);
    if (mode === "ok") {
      const email = calls.find((c) => c[0] === "email");
      assert.equal(email[2], true);
      assert.equal(email[3], calls.find((c) => c[0] === "file")[2]);
      assert.deepEqual(state.DOCS[0].emailedTo, [{ addr: "recipient@example.test" }]);
    } else {
      assert.equal(
        calls.some((c) => c[0] === "email"),
        false,
      );
      assert.ok(calls.some((c) => c[0] === "toast" && /PDF/.test(c[1])));
    }
  }
  console.log(
    JSON.stringify({
      passed: true,
      preparationDependencies: 6,
      workflowDependencies: 18,
      inertConstruction: true,
      correctionLineageAndChecks: true,
      retainedRetryAndDelivery: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
