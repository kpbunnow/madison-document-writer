/* Publication preparation and continuation load without recovery UI or Writer startup. */
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
  publication_preparation: [
    "snow",
    "newDocuments",
    "sourceDocFor",
    "worksheetFaults",
    "today",
    "cleanVisit",
    "evid",
    "freezeSources",
    "initialCitations",
  ],
  publication_workflow: [
    "recordIntegrity",
    "toast",
    "commitCitationEdits",
    "saveDrafts",
    "render",
    "refreshCatalog",
    "initialCitations",
    "citationPricing",
    "blockers",
    "makePublication",
    "commitAmendment",
    "printJob",
    "filePdf",
    "emailDocument",
    "needsInitialCitation",
    "revealIssuedCase",
    "focusIssuedCase",
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
  const name = file === "publication_preparation" ? "publicationPreparation" : "publicationWorkflow",
    entry = declarations.find((n) => n.id.name === name);
  assert.equal(entry.init.callee.name, file === "publication_preparation" ? "createPublicationPreparation" : "createPublicationWorkflow");
  assert.deepEqual(new Set(entry.init.arguments[0].properties.map((p) => p.key.name)), used);
  assert.ok(declarations.indexOf(entry) > declarations.findIndex((n) => n.id.name === "recordCommit"));
  assert.ok(declarations.indexOf(entry) < declarations.findIndex((n) => n.id.name === "documentRenderer"));
  for (const p of entry.init.arguments[0].properties) {
    if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
    else {
      assert.equal(p.value.type, "ArrowFunctionExpression");
      assert.equal(p.value.body.callee.name, p.key.name);
    }
  }
}
assert.ok(declarations.findIndex((n) => n.id.name === "publicationPreparation") < declarations.findIndex((n) => n.id.name === "publicationWorkflow"));
const copy = (v) => JSON.parse(JSON.stringify(v));
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents:
        "export {createPublicationPreparation} from './publication_preparation.js'; export {createPublicationWorkflow} from './publication_workflow.js'; export {WriterState} from './state.js'; export {INSPECTORS} from './data/inspectors.js';",
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
  new Function("module", "exports", compiled.outputFiles[0].text)(box, box.exports);
  const { createPublicationPreparation, createPublicationWorkflow, WriterState: state, INSPECTORS } = box.exports;
  assert.deepEqual(state, {});
  const unavailable = new Proxy({}, { get: (_, k) => assert.fail("premature dependency " + String(k)) });
  createPublicationPreparation(unavailable);
  createPublicationWorkflow(unavailable);
  assert.deepEqual(state, {});
  const actor = INSPECTORS.find((i) => i.name).id;
  let today = new Date("2026-10-26T12:00:00Z"),
    source = null,
    release = null,
    sequence = 0,
    snow = false,
    group = false,
    worksheet = [];
  const preparation = createPublicationPreparation({
    get snow() {
      return { is: () => snow, lifecycle: () => [{ ok: false, t: "snow guard" }] };
    },
    get newDocuments() {
      return { specialLifecycle: () => [{ ok: false, t: "special guard" }], releaseVisit: () => release };
    },
    sourceDocFor: () => source,
    worksheetFaults: () => worksheet,
    get today() {
      return today;
    },
    cleanVisit: (r) => {
      const out = copy(r);
      delete out.draft;
      delete out.previousDraft;
      return out;
    },
    evid: () => "event-" + ++sequence,
    freezeSources: () => ({ case: { owner: "Frozen owner" }, inspector: { id: actor } }),
    get initialCitations() {
      return { enabled: () => group, group: (d, a) => ({ ...a, id: "group", payload: { ...a.payload, grouped: true } }) };
    },
  });
  function reset() {
    source = null;
    release = null;
    snow = false;
    group = false;
    worksheet = [];
    today = new Date("2026-10-26T12:00:00Z");
    Object.assign(state, {
      CASES: [{ id: "case", number: "BLD2026-00001", address: "1 SYNTHETIC ST" }],
      DOCS: [],
      REINSP: [],
      EVENTS: { case: [] },
      AMENDMENT_BUSY: false,
      CASEDIR: { helper: true },
      WORK: { recordForms: {} },
      state: { screen: "write", docId: "draft", modal: "final" },
    });
  }
  function draft(type = "notice") {
    return {
      id: "draft",
      caseId: "case",
      draft: true,
      type,
      inspectorId: actor,
      inspDate: "2026-10-20",
      inspTime: "09:00",
      mailed: "2026-10-21",
      authoringVersion: 16,
      items: [{ id: "item", no: "1", text: "Repair wall", cite: false }],
      cits: {},
    };
  }
  reset();
  assert.deepEqual(preparation.lifecycleChecks(draft()), []);
  assert.deepEqual(preparation.lifecycleChecks(null), []);
  assert.deepEqual(preparation.lifecycleChecks({ ...draft(), correction: {} }), []);
  snow = true;
  assert.equal(preparation.lifecycleChecks(draft())[0].t, "snow guard");
  snow = false;
  assert.equal(preparation.lifecycleChecks(draft("bestInterestExtension"))[0].t, "special guard");
  reset();
  let d = draft("citation");
  source = { ...draft(), id: "notice", draft: false };
  d.fromDocId = source.id;
  d.items[0].cite = true;
  d.cits = { item: { num: "C1", issued: "2026-10-26" } };
  state.DOCS = [source];
  assert.deepEqual(preparation.lifecycleChecks(d), []);
  today = new Date("2026-10-25T12:00:00Z");
  assert.ok(preparation.lifecycleChecks(d).some((c) => c.t === "Citation issue dates must be between the inspection and today."));
  today = new Date("2026-10-26T12:00:00Z");
  state.DOCS = [source, { id: "other", caseId: "case", type: "citation", draft: false, cits: { x: { num: "C1" } } }];
  assert.ok(preparation.lifecycleChecks(d).some((c) => c.t.includes("unique citation number")));
  d.expectedHead = [];
  state.EVENTS.case = [{ id: "new-event", type: "notice.issued" }];
  assert.ok(preparation.lifecycleChecks(d).some((c) => c.t.includes("case record changed")));
  reset();
  d = draft("extension");
  source = { ...draft(), id: "source", draft: false };
  d.fromDocId = "source";
  d.fromReinspId = "visit";
  d.expectedHead = ["base"];
  d.dueWork = { private: true };
  d.selectionCache = { private: true };
  d.publicationError = "temporary";
  d.emailSelection = { private: true };
  d.pendingAmendment = { id: "old" };
  state.EVENTS.case = [{ id: "base", type: "notice.issued", at: "2099-01-01T12:00:00.000Z" }];
  const visit = {
    id: "visit",
    sourceDocId: "source",
    caseId: "case",
    date: d.inspDate,
    time: d.inspTime,
    inspectorId: actor,
    draft: true,
    previousDraft: { private: true },
    results: { item: { oc: "progress" } },
  };
  state.REINSP = [visit];
  release = { id: "release", sourceDocId: "source", date: "2026-10-21", inspectorId: actor, results: {} };
  const visitBefore = copy(visit);
  let a = preparation.makePublication(d);
  assert.deepEqual(visit, visitBefore);
  assert.equal(d.publicationEvents.length, 2);
  assert.equal(a.type, "extension.issued");
  assert.equal(a.payload.snapshot.status, "Final");
  assert.equal(a.payload.snapshot.authoringVersion, 16);
  for (const key of [
    "draft",
    "pendingAmendment",
    "publicationEvents",
    "expectedHead",
    "publicationError",
    "emailSelection",
    "dueWork",
    "selectionCache",
  ])
    assert.equal(a.payload.snapshot[key], undefined, key);
  assert.deepEqual(a.payload.snapshot.frozen.case, { owner: "Frozen owner" });
  assert.equal(d.publicationEvents[0].payload.reinspection.docId, d.id);
  assert.equal(d.publicationEvents[0].payload.reinspection.draft, undefined);
  assert.deepEqual(d.publicationEvents[0].payload.expectedHead, ["base"]);
  assert.deepEqual(d.publicationEvents[1].payload.expectedHead, ["base", d.publicationEvents[0].id].sort());
  assert.deepEqual(a.payload.expectedHead, ["base", ...d.publicationEvents.map((e) => e.id)].sort());
  assert.equal(Date.parse(d.publicationEvents[0].at), Date.parse(state.EVENTS.case[0].at) + 1);
  assert.equal(Date.parse(a.at), Date.parse(d.publicationEvents[0].at) + 2);
  a.payload.snapshot.items[0].text = "Frozen mutation";
  assert.equal(d.items[0].text, "Repair wall");
  reset();
  d = draft();
  d.initialCitationId = "private";
  d.cits = { item: { num: "not-on-notice" } };
  a = preparation.makePublication(d);
  assert.deepEqual(a.payload.snapshot.cits, {});
  assert.equal(a.payload.snapshot.initialCitationId, undefined);
  group = true;
  a = preparation.makePublication(d);
  assert.equal(a.id, "group");
  assert.equal(a.payload.grouped, true);

  let calls = [],
    blocked = false,
    catalog = true,
    load = true,
    signature = "before",
    changeSignature = false,
    wanted = false,
    concerns = [],
    commitOK = true,
    renderFault = false,
    jobFault = false,
    fileMode = "ok",
    lateNavigation = false,
    legacy = false,
    waitForCommit = null;
  const workflow = createPublicationWorkflow({
    get recordIntegrity() {
      return { blocked: () => blocked };
    },
    toast: (...args) => calls.push(["toast", ...args]),
    commitCitationEdits: () => calls.push(["edit"]),
    saveDrafts: async () => {
      calls.push(["save"]);
      return true;
    },
    render: () => calls.push(["render"]),
    refreshCatalog: async () => {
      calls.push(["catalog"]);
      if (renderFault) throw new Error("catalog unavailable");
      return catalog;
    },
    get initialCitations() {
      return { enabled: () => wanted, prepare: () => calls.push(["prepare"]) };
    },
    get citationPricing() {
      return {
        refresh: () => calls.push(["pricing"]),
        signature: () => signature,
        loadShared: async () => {
          calls.push(["shared"]);
          if (changeSignature) signature = "after";
          return load;
        },
      };
    },
    blockers: () => concerns,
    makePublication: (x) => {
      calls.push(["make"]);
      const event = { id: "attempt", type: "notice.issued", payload: { snapshot: { ...copy(x), draft: false } } };
      if (wanted) {
        event.payload.snapshot = { ...copy(x), id: "citation", type: "citation", draft: false };
        x.publicationEvents = [{ id: "notice-event", payload: { snapshot: { ...copy(x), draft: false } } }];
      }
      return event;
    },
    commitAmendment: async (cid, event, x) => {
      calls.push(["commit", event]);
      x.pendingAmendment = event;
      if (waitForCommit) await waitForCommit;
      if (!commitOK) return false;
      state.DOCS = [
        ...(x.publicationEvents || []).filter((e) => e.payload?.snapshot).map((e) => copy(e.payload.snapshot)),
        copy(event.payload.snapshot),
      ];
      return true;
    },
    printJob: (x) => {
      calls.push(["print", x.id]);
      if (jobFault) return { html: "" };
      return { html: "print " + x.id, id: x.id };
    },
    filePdf: async (x, job) => {
      calls.push(["file", x.id, job]);
      if (lateNavigation) state.state = { screen: "cases", docId: "elsewhere", modal: "other" };
      if (fileMode === "throw") throw new Error("filing unavailable");
      return fileMode !== "false";
    },
    emailDocument: async (x, to, confirmed, job) => {
      calls.push(["email", x.id, to, confirmed, job]);
      to.push("mutated@example.test");
    },
    needsInitialCitation: () => legacy,
    revealIssuedCase: (cid) => {
      calls.push(["workspace", cid]);
      return true;
    },
    focusIssuedCase: (cid) => calls.push(["focus", cid]),
  });
  function resetFlow() {
    reset();
    calls = [];
    blocked = false;
    catalog = true;
    load = true;
    signature = "before";
    changeSignature = false;
    wanted = false;
    concerns = [];
    commitOK = true;
    renderFault = false;
    jobFault = false;
    fileMode = "ok";
    lateNavigation = false;
    legacy = false;
    waitForCommit = null;
  }
  resetFlow();
  blocked = true;
  assert.equal(await workflow.publishDocument(draft()), false);
  assert.deepEqual(
    calls.map((c) => c[0]),
    ["toast"],
  );
  blocked = false;
  state.AMENDMENT_BUSY = true;
  calls = [];
  assert.equal(await workflow.publishDocument(draft()), false);
  assert.deepEqual(calls, []);
  state.AMENDMENT_BUSY = false;
  state.CASEDIR = null;
  assert.equal(await workflow.publishDocument(draft()), false);
  assert.equal(
    calls.some((c) => c[0] === "commit"),
    false,
  );
  assert.ok(state.state.amendmentError.includes("remains a draft"));
  resetFlow();
  catalog = false;
  assert.equal(await workflow.publishDocument(draft()), false);
  assert.ok(state.state.amendmentError.includes("catalog"));
  assert.equal(
    calls.some((c) => c[0] === "make"),
    false,
  );
  resetFlow();
  wanted = true;
  load = false;
  assert.equal(await workflow.publishDocument(draft()), false);
  assert.ok(state.state.amendmentError.includes("Shared citation history"));
  assert.equal(
    calls.some((c) => c[0] === "commit"),
    false,
  );
  resetFlow();
  wanted = true;
  changeSignature = true;
  assert.equal(await workflow.publishDocument(draft()), false);
  assert.ok(state.state.amendmentError.includes("changed the deposit or tier"));
  resetFlow();
  concerns = [{ t: "blocked" }];
  assert.equal(await workflow.publishDocument(draft()), false);
  assert.equal(
    calls.some((c) => c[0] === "make"),
    false,
  );
  resetFlow();
  wanted = true;
  jobFault = true;
  assert.equal(await workflow.publishDocument(draft()), false);
  assert.ok(state.state.amendmentError.includes("no issuance was sent"));
  assert.equal(
    calls.some((c) => c[0] === "commit"),
    false,
  );
  resetFlow();
  wanted = true;
  commitOK = false;
  d = draft();
  assert.equal(await workflow.publishDocument(d), false);
  const retained = d.pendingAmendment;
  assert.ok(retained);
  assert.equal(
    calls.some((c) => c[0] === "file"),
    false,
  );
  assert.equal(state.state.publicationBusy, null);
  calls = [];
  commitOK = true;
  catalog = false;
  load = false;
  concerns = [{ t: "would block new work" }];
  assert.equal(await workflow.publishDocument(d), true);
  assert.equal(calls.find((c) => c[0] === "commit")[1], retained);
  for (const step of ["edit", "catalog", "prepare", "pricing", "shared", "make"])
    assert.equal(
      calls.some((c) => c[0] === step),
      false,
      "pending confirmation must not reprepare: " + step,
    );
  assert.deepEqual(
    calls.filter((c) => c[0] === "file").map((c) => c[1]),
    ["draft", "citation"],
  );
  resetFlow();
  wanted = true;
  d = draft();
  d.emailedTo = ["recipient@example.test"];
  state.WORK.recordForms = { "draft:final": { text: "saved" }, other: { text: "keep" } };
  assert.equal(await workflow.publishDocument(d), true);
  const firstCommit = calls.findIndex((c) => c[0] === "commit"),
    prints = calls.map((c, i) => (c[0] === "print" ? i : -1)).filter((i) => i >= 0),
    files = calls.filter((c) => c[0] === "file");
  assert.ok(
    prints.every((i) => i < firstCommit),
    "initial jobs prepared before atomic save",
  );
  assert.equal(prints.length, 2);
  assert.equal(files.length, 2);
  assert.deepEqual(
    files.map((c) => c[1]),
    ["draft", "citation"],
  );
  assert.ok(calls.findIndex((c) => c[0] === "file") > firstCommit);
  assert.equal(calls.filter((c) => c[0] === "email").length, 2);
  for (const c of calls.filter((c) => c[0] === "email")) {
    assert.equal(c[3], true);
    assert.equal(c[4], files.find((f) => f[1] === c[1])[2]);
  }
  assert.deepEqual(state.DOCS[0].emailedTo, ["recipient@example.test"]);
  assert.equal(state.WORK.recordForms["draft:final"], undefined);
  assert.ok(state.WORK.recordForms.other);
  assert.ok(calls.some((c) => c[0] === "workspace"));
  assert.equal(calls.at(-1)[0], "focus");
  assert.equal(state.state.publicationBusy, null);
  for (const mode of ["false", "throw"]) {
    resetFlow();
    wanted = true;
    fileMode = mode;
    assert.equal(await workflow.publishDocument(draft()), true);
    assert.equal(calls.filter((c) => c[0] === "file").length, 2, "one failed PDF must not skip the other");
    assert.equal(
      calls.some((c) => c[0] === "email"),
      false,
    );
    assert.equal(
      calls.some((c) => c[0] === "toast" && c[2]?.severity === "success"),
      false,
    );
    assert.equal(state.state.publicationBusy, null);
  }
  for (const later of [true, false]) {
    resetFlow();
    lateNavigation = later;
    legacy = !later;
    assert.equal(await workflow.publishDocument(draft()), true);
    assert.equal(
      calls.some((c) => c[0] === "workspace"),
      false,
      "later navigation and legacy initial citation stay where they belong",
    );
  }
  resetFlow();
  let resume;
  waitForCommit = new Promise((r) => {
    resume = r;
  });
  d = draft();
  const first = workflow.publishDocument(d);
  await new Promise((r) => setImmediate(r));
  assert.equal(await workflow.publishDocument(d), false);
  assert.equal(calls.filter((c) => c[0] === "make").length, 1);
  resume();
  assert.equal(await first, true);
  assert.equal(calls.filter((c) => c[0] === "commit").length, 1);
  resetFlow();
  renderFault = true;
  await assert.rejects(workflow.publishDocument(draft()), /catalog unavailable/);
  renderFault = false;
  assert.equal(await workflow.publishDocument(draft()), true, "per-draft guard must release after a thrown adapter");
  resetFlow();
  state.state.amendmentError = "<img src=x onerror=bad>";
  assert.ok(workflow.publicationPanel({ ...draft(), pendingAmendment: {} }).includes("Confirm save"));
  assert.ok(workflow.publicationPanel(draft()).includes("&lt;img"));
  assert.equal(workflow.publicationPanel({ ...draft(), draft: false }), "");
  assert.equal(workflow.publicationPanel({ ...draft(), correction: {} }), "");
  console.log(
    JSON.stringify({
      passed: true,
      preparationDependencies: 9,
      continuationDependencies: 17,
      inertConstruction: true,
      retainedPreparationAndRetry: true,
      filingAndNavigationOrder: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
