const { serviceComposition } = require("../fixtures/deferred_service_syntax.cjs");
/* Citation and item-selection owners preserve charge phases, retained prices and private wording. */
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
const decl = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []);
const interfaces = {
  citation_workflow: [
    "administration",
    "citationPricing",
    "citationPricingDate",
    "depositStep",
    "initialCitations",
    "initialOrderCitation",
    "isLocked",
    "snow",
    "unchangedCorrectionValue",
    "applyDeposit",
    "changeCharge",
    "chargeChoices",
    "choosesCharge",
    "feeLines",
    "fmtDate",
    "today",
  ],
  item_selection: ["snow", "uid"],
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
  const name = file === "citation_workflow" ? "citationWorkflow" : "itemSelection",
    entry = decl.find((n) => n.id.name === name);
  assert.equal(entry.init.callee.name, file === "citation_workflow" ? "createCitationWorkflow" : "createItemSelection");
  assert.ok(decl.indexOf(entry) > decl.findIndex((n) => n.id.name === "deadlineAssignment"));
  assert.ok(decl.indexOf(entry) < decl.findIndex((n) => n.id.name === "workspaceTaskPresentation"));
  assert.equal(entry.init.arguments.length, 1);
  assert.deepEqual(new Set(serviceComposition(entry.init.arguments[0]).properties.map((p) => p.key.name)), used);
  for (const p of serviceComposition(entry.init.arguments[0]).properties) {
    assert.equal(p.type, "Property");
    if (p.kind === "get") {
      assert.equal(p.value.body.body.length, 1);
      assert.equal(p.value.body.body[0].argument.name, p.key.name);
    } else {
      assert.equal(p.value.type, "ArrowFunctionExpression");
      assert.equal(p.value.body.type, "CallExpression");
      assert.equal(p.value.body.callee.name, p.key.name === "changeCharge" ? "changeChargeBasis" : p.key.name);
    }
  }
}
assert.equal(fs.existsSync(path.join(directory, "case_timeline.js")), false, "do not retain an empty forwarding module");
(async () => {
  const compiled = await esbuild.build({
    stdin: {
      contents:
        "export {createCitationWorkflow} from './citation_workflow.js'; export {createItemSelection} from './item_selection.js'; export {WriterState} from './state.js'; export {LIBRARY} from './data/library.js'; export {DOCBODY} from './document_types.js';",
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
  const { createCitationWorkflow, createItemSelection, WriterState: state, LIBRARY, DOCBODY } = box.exports;
  assert.deepEqual(state, {});
  const unavailable = new Proxy({}, { get: (_, k) => assert.fail("premature dependency: " + String(k)) });
  createCitationWorkflow(unavailable);
  createItemSelection(unavailable);
  assert.deepEqual(state, {}, "both constructors require no Writer/DOM startup, services or workspace reads");
  let canAdd = true,
    calls = [],
    ids = 0;
  const selection = createItemSelection({
    uid: () => "new" + ++ids,
    snow: { canAdd: () => canAdd, added: (d, i) => calls.push(["added", i.id]), removed: () => calls.push("removed") },
  });
  const src = { ...LIBRARY[0].groups[0].items[0], catalogVersion: 3, catalogReviewId: "review" },
    d = { items: [] };
  const libraryBefore = JSON.stringify(LIBRARY[0]);
  assert.equal(selection.toggleLibraryItem(d, 0, 0, src), true);
  const selected = d.items[0];
  selected.text = "Private wording";
  selected.due = "2026-11-01";
  assert.equal(selected.catalogVersion, 3);
  assert.equal(selected.catalogReviewId, "review");
  assert.equal(selection.toggleLibraryItem(d, 0, 0, src), false);
  assert.equal(d.items.length, 0);
  assert.equal(selection.toggleLibraryItem(d, 0, 0, { ...src, a: "New catalogue wording" }), true);
  assert.equal(d.items[0].id, selected.id);
  assert.equal(d.items[0].text, "Private wording");
  assert.equal(d.items[0].due, "2026-11-01");
  assert.equal(ids, 1, "reselection retains the existing identity");
  selection.toggleLibraryItem(d, 0, 0, src);
  canAdd = false;
  const cached = JSON.stringify(d.selectionCache);
  assert.equal(selection.toggleLibraryItem(d, 0, 0, src), false);
  assert.equal(JSON.stringify(d.selectionCache), cached, "a refused snow addition must not consume private cached work");
  assert.equal(JSON.stringify(LIBRARY[0]), libraryBefore);
  assert.deepEqual(calls.slice(0, 3), [["added", selected.id], "removed", ["added", selected.id]]);

  let today = new Date("2026-10-25T12:00:00Z"),
    original = null,
    overrideFault = "",
    locked = false;
  calls = [];
  const api = createCitationWorkflow({
    get today() {
      return today;
    },
    citationPricing: {
      refresh: () => calls.push("refresh"),
      ensureShared: () => calls.push("shared"),
      unchangedCorrection: () => original,
      historyFault: () => "",
      chargeFault: () => "",
    },
    administration: { overrideFault: () => overrideFault },
    initialCitations: { enabled: () => false },
    depositStep: { form: () => "<p>deposit review</p>" },
    initialOrderCitation: (v) => !!v.initial,
    isLocked: () => locked,
    snow: { is: () => false },
    unchangedCorrectionValue: () => false,
    citationPricingDate: () => "2026-10-26",
    changeCharge: (doc, id, value) => {
      calls.push(["charge", doc.cits[id].ord, value]);
      doc.cits[id].ord = value;
      return true;
    },
    applyDeposit: () => calls.push("apply"),
    chargeChoices: (i) => i.sections.map((v) => ({ value: v, label: v })),
    choosesCharge: (i) => i.sections.length > 1,
    feeLines: () => ({ total: 125, cents: { total: 12500 } }),
    fmtDate: (v) => v,
  });
  state.CASES = [{ id: "c", date: "2026-10-20", time: "09:00" }];
  state.DOCS = [];
  const item = { id: "i", no: "1", title: "Wall", sections: ["27.05(2)(c)"], cite: true };
  const charge = {
    ord: "27.05(2)(c)",
    amount: "125.00",
    depositMode: "total",
    depositSource: "Approved City total authority",
    pricedOn: "2026-10-26",
    issued: "2026-10-26",
    overrideBasis: { approved: true },
    num: "TEST-1",
    courtDate: "2026-12-02",
    courtTime: "09:00",
    violTime: "09:00",
  };
  const doc = { id: "d", caseId: "c", type: "citation", authoringVersion: 16, draft: true, mailed: "2026-10-26", items: [item], cits: { i: charge } };
  assert.equal(api.citationDepositFault(charge, doc, item), "");
  overrideFault = "Approval does not match this charge";
  assert.equal(api.citationDepositFault(charge, doc, item), overrideFault);
  overrideFault = "";
  assert.match(api.citationDepositFault({ ...charge, amount: "0" }, doc, item), /positive cash deposit/);
  assert.match(api.citationDepositFault({ ...charge, assessments: { total: 12500 } }, doc, item), /must not retain/);
  original = structuredClone(charge);
  assert.equal(api.citationDepositFault(charge, doc, item), "");
  assert.match(api.citationDepositFault({ ...charge, amount: "126.00" }, doc, item), /retains its original deposit/);
  original = null;
  assert.equal(api.depositComplete(doc), true);
  doc.depositRequests = { i: { reason: "Needs review" } };
  assert.equal(api.depositComplete(doc), false);
  delete doc.depositRequests;
  const dateCheck = () => api.authoringChecks(doc).find((c) => c.t.includes("the issue date must be no later than today."));
  assert.equal(dateCheck().ok, false);
  today = new Date("2026-10-27T12:00:00Z");
  assert.equal(dateCheck().ok, true, "the supplied live day is read per operation");
  charge.mandatoryAppearance = true;
  assert.ok(api.authoringChecks(doc).some((c) => !c.ok && c.t.includes("division-approved defendant instructions")));
  delete charge.mandatoryAppearance;
  doc.correction = { reviewed: true };
  const beforeOrd = charge.ord;
  calls = [];
  api.editCitation(doc, "i", "ord", "27.05(2)(c)2", "input");
  assert.equal(charge.ordEditingFrom, beforeOrd);
  assert.equal(doc.correction.reviewed, false);
  assert.deepEqual(calls, [], "typing must not price or commit a charge");
  api.commitCitationEdits(doc);
  assert.deepEqual(calls, [["charge", beforeOrd, "27.05(2)(c)2"]]);
  assert.equal(Object.hasOwn(charge, "ordEditingFrom"), false);
  api.editCitation(doc, "i", "amount", "invalid");
  assert.equal(charge.amount, "125.00");
  assert.equal(charge.depositEditInvalid, true);
  assert.equal(charge.reconfirmDeposit, true);
  api.editCitation(doc, "i", "courtTime", "2:30 PM");
  assert.equal(charge.courtTime, "14:30");
  api.editCitation(doc, "i", "desc", "Retained private description");
  assert.equal(charge.descEdited, true);
  calls = [];
  locked = true;
  assert.equal(api.citationReview(doc), "");
  assert.deepEqual(calls, ["refresh", "shared"], "retain existing review refresh/guard order");
  assert.equal(api.initialCitationBody({ initial: true }), DOCBODY.initialCitation);
  console.log(
    JSON.stringify({
      passed: true,
      citationDependencies: 16,
      selectionDependencies: 2,
      retainedChargePhasesAndPrices: true,
      retainedWordingAndIdentity: true,
    }),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
