/* Independent worksheet validation and reversible working-paper transitions. */
const assert = require("assert/strict"),
  fs = require("fs"),
  path = require("path"),
  acorn = require("acorn"),
  esbuild = require("esbuild");
const root = path.resolve(__dirname, "../.."),
  dir = path.join(root, "app/modules"),
  parse = (n) => acorn.parse(fs.readFileSync(path.join(dir, n + ".js"), "utf8"), { ecmaVersion: 2022, sourceType: "module" });
function walk(n, f) {
  if (!n || typeof n !== "object") return;
  if (Array.isArray(n)) return n.forEach((c) => walk(c, f));
  f(n);
  Object.values(n).forEach((c) => walk(c, f));
}
const used = new Set();
walk(parse("worksheet_workflow"), (n) => {
  if (n.type === "MemberExpression" && n.object.name === "services") {
    assert.equal(n.computed, false);
    used.add(n.property.name);
  }
});
assert.deepEqual([...used].sort(), ["sourceDocFor", "today", "newDocuments", "dueCheck", "saveDrafts", "render", "toast", "clearWalk"].sort());
const entries = parse("app_core").body.flatMap((n) => (n.declaration || n).declarations || []),
  entry = entries.find((n) => n.id.name === "worksheetWorkflow");
assert.equal(entry.init.callee.name, "createWorksheetWorkflow");
assert.deepEqual(new Set(entry.init.arguments[0].properties.map((p) => p.key.name)), used);
assert.ok(entries.indexOf(entry) > entries.findIndex((n) => n.id.name === "caseRecovery"));
assert.ok(entries.indexOf(entry) < entries.findIndex((n) => n.id.name === "documentRenderer"));
for (const p of entry.init.arguments[0].properties) {
  if (p.kind === "get") assert.equal(p.value.body.body[0].argument.name, p.key.name);
  else {
    assert.equal(p.value.type, "ArrowFunctionExpression");
    assert.equal(p.value.body.callee.name, p.key.name);
  }
}
const copy = (v) => JSON.parse(JSON.stringify(v));
(async () => {
  const built = await esbuild.build({
    stdin: {
      contents:
        "export {createWorksheetWorkflow,changeVisitDate,cleanVisit} from './worksheet_workflow.js'; export {continuingItemsForVisits} from './case_projection.js'; export {WriterState} from './state.js'; export {INSPECTORS} from './data/inspectors.js';",
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
  const { createWorksheetWorkflow, changeVisitDate, cleanVisit, continuingItemsForVisits, WriterState: s, INSPECTORS } = box.exports;
  assert.deepEqual(s, {});
  createWorksheetWorkflow(new Proxy({}, { get: (_, k) => assert.fail("premature service " + String(k)) }));
  assert.deepEqual(s, {});
  let calls, day, dueOK, src, r, d;
  const actor = INSPECTORS.find((i) => i.name).id;
  const api = createWorksheetWorkflow({
    sourceDocFor(cid) {
      return s.DOCS.find((x) => x.id === "source" && x.caseId === cid) || null;
    },
    get today() {
      return day;
    },
    get newDocuments() {
      return {
        continuingItems(source, visits) {
          calls.push(["continuing", visits.map((x) => x.id)]);
          return continuingItemsForVisits(source, visits);
        },
      };
    },
    dueCheck(due, from) {
      calls.push(["due", due, from]);
      return { ok: dueOK };
    },
    saveDrafts() {
      calls.push("save");
      return false;
    },
    render() {
      calls.push("render");
    },
    toast(text) {
      calls.push(["toast", text]);
    },
    clearWalk() {
      calls.push("clearWalk");
    },
  });
  function reset() {
    calls = [];
    day = "2026-10-26";
    dueOK = true;
    src = {
      id: "source",
      caseId: "one",
      type: "notice",
      items: [{ id: "item", no: "1", sections: [] }],
      frozen: { case: { id: "one", date: "2026-10-01" } },
    };
    r = {
      id: "visit",
      caseId: "one",
      draft: true,
      sourceDocId: "source",
      date: "2026-10-20",
      time: "09:00",
      inspectorId: actor,
      results: { item: { oc: "none", on: "2026-10-20", due: "2026-11-01" } },
    };
    d = {
      id: "draft",
      caseId: "one",
      draft: true,
      fromReinspId: "visit",
      items: [{ id: "item", text: "retained draft", sections: [] }],
      authoringVersion: 9,
    };
    Object.assign(s, {
      CASES: [{ id: "one", date: "2026-01-01" }],
      DOCS: [src, d],
      REINSP: [r],
      WORK: { walk: { context: "one|visit", item: "item" } },
      state: { screen: "write", docId: d.id, reinspId: r.id, modal: "review" },
      DIRTY: false,
    });
  }
  reset();
  assert.deepEqual(api.worksheetFaults(r), []);
  assert.deepEqual(calls[0], ["continuing", []]);
  for (const oc of ["corrected", "progress", "none", "noaccess"]) {
    r.results.item.oc = oc;
    assert.deepEqual(api.worksheetFaults(r), []);
  }
  assert.match(api.worksheetFaults(null)[0], /source is missing/);
  reset();
  r.date = "2026-09-30";
  assert.ok(api.worksheetFaults(r).some((x) => x.startsWith("Inspection date")));
  r.date = "2026-10-27";
  assert.ok(api.worksheetFaults(r).some((x) => x.startsWith("Inspection date")));
  day = "2026-10-28";
  r.results.item.on = r.date;
  assert.deepEqual(api.worksheetFaults(r), []);
  src.inspDate = "2026-10-28";
  r.date = "2026-10-27";
  assert.ok(api.worksheetFaults(r).some((x) => x.startsWith("Inspection date")));
  reset();
  r.time = "bad";
  r.inspectorId = "missing";
  r.results.item.oc = "";
  const faults = api.worksheetFaults(r);
  assert.ok(faults.some((x) => x.includes("reinspection time")));
  assert.ok(faults.some((x) => x.includes("Select the inspector")));
  assert.ok(faults.some((x) => x.includes("every item")));
  assert.ok(faults.some((x) => x.includes("valid inspection outcome")));
  assert.equal(new Set(faults).size, faults.length);
  reset();
  src.items[0].withdrawn = true;
  r.results.item.oc = "none";
  assert.ok(api.worksheetFaults(r).some((x) => x.includes("remain withdrawn")));
  r.results.item.oc = "withdrawn";
  assert.equal(
    api.worksheetFaults(r).some((x) => x.includes("remain withdrawn")),
    false,
  );
  assert.ok(api.worksheetFaults(r).some((x) => x.includes("case is completed")));
  reset();
  src.items[0].done = true;
  src.items[0].doneOn = "2026-10-10";
  r.results.item = { oc: "corrected", on: "2026-10-10", carried: true };
  assert.deepEqual(api.worksheetFaults(r), []);
  r.results.item.carried = false;
  assert.ok(api.worksheetFaults(r).some((x) => x.includes("carry forward unchanged")));
  reset();
  r.results.item.on = "2026-09-30";
  assert.ok(api.worksheetFaults(r).some((x) => x.startsWith("Result dates")));
  r.results.item.on = "";
  r.results.item.manualDate = true;
  assert.ok(api.worksheetFaults(r).some((x) => x.startsWith("Result dates")));
  r.results.item.manualDate = false;
  assert.equal(
    api.worksheetFaults(r).some((x) => x.startsWith("Result dates")),
    false,
  );
  src.type = "compliance";
  assert.ok(api.worksheetFaults(r).some((x) => x.includes("case is completed")));
  reset();
  dueOK = false;
  for (const type of ["extension", "bestInterestExtension", "citation"])
    assert.ok(api.worksheetFaults(r, type).some((x) => x.startsWith("Set a future due")));
  assert.equal(
    api.worksheetFaults(r, "vacancyExtension").some((x) => x.startsWith("Set a future due")),
    false,
  );
  r.results.item.oc = "corrected";
  assert.equal(
    api.worksheetFaults(r, "extension").some((x) => x.startsWith("Set a future due")),
    false,
  );
  reset();
  src.items = Array.from({ length: 4 }, (_, i) => ({ id: "i" + i, no: String(i + 1), sections: [] }));
  r.results = Object.fromEntries(src.items.map((it, i) => [it.id, { oc: "none", due: ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22"][i] }]));
  assert.ok(api.worksheetFaults(r, "extension").some((x) => x.includes("no more than three")));
  r.results.i3.due = "2026-11-15";
  assert.deepEqual(api.worksheetFaults(r, "extension"), []);
  r.results.i1.due = "2026-11-03";
  assert.ok(api.worksheetFaults(r, "extension").some((x) => x.includes("seven days apart")));
  reset();
  s.REINSP = [{ id: "old", caseId: "one", sourceDocId: "source", results: {} }, r];
  api.worksheetFaults(r);
  assert.deepEqual(calls.at(-1), ["continuing", ["old"]]);
  const before = copy({ src, r });
  api.worksheetFaults(r);
  assert.deepEqual({ src, r }, before);
  reset();
  r.results = {
    implicit: { on: r.date },
    blank: { on: "" },
    manual: { manualDate: true, on: r.date },
    carried: { carried: true, on: r.date },
    different: { on: "2026-10-19" },
  };
  changeVisitDate(r, "2026-10-21");
  assert.equal(r.results.implicit.on, r.date);
  assert.equal(r.results.blank.on, r.date);
  for (const name of ["manual", "carried"]) assert.equal(r.results[name].on, "2026-10-20");
  assert.equal(r.results.different.on, "2026-10-19");
  r.previousDraft = { nested: { retained: true } };
  r.previousWorksheet = {};
  r.expectedHead = "e";
  r.dueWork = {};
  r.followupIntent = "x";
  r.results.blank.on = "";
  const clean = cleanVisit(r);
  for (const name of ["draft", "previousDraft", "previousWorksheet", "expectedHead", "dueWork", "followupIntent"]) assert.equal(name in clean, false);
  assert.equal(clean.results.blank.on, r.date);
  assert.equal(r.results.blank.on, "");
  clean.results.manual.on = "changed";
  assert.equal(r.results.manual.on, "2026-10-20");
  reset();
  assert.equal(api.unissuedVisitFor("one"), null);
  r.draft = false;
  assert.equal(api.unissuedVisitFor("one"), r);
  s.DOCS.push({ id: "issued-followup", caseId: "one", fromReinspId: r.id });
  assert.equal(api.unissuedVisitFor("one"), null);
  s.DOCS = [];
  assert.equal(api.unissuedVisitFor("one"), null);
  for (const mutate of [() => (d.draft = false), () => (d.pendingAmendment = {}), () => (d.correction = {}), () => (r.draft = false)]) {
    reset();
    mutate();
    const prior = copy(s);
    assert.equal(api.returnToWorksheet(d), false);
    assert.deepEqual(s, prior);
    assert.equal(calls.length, 0);
  }
  reset();
  r.docId = d.id;
  const oldDraft = copy(d);
  assert.equal(api.returnToWorksheet(d), true);
  assert.equal(
    s.DOCS.some((x) => x.id === d.id),
    false,
  );
  assert.deepEqual(r.previousDraft, oldDraft);
  assert.equal(r.docId, null);
  assert.equal(s.state.screen, "reinspect");
  assert.equal(s.state.modal, null);
  assert.equal(s.DIRTY, true);
  assert.deepEqual(calls.slice(0, 2), ["save", "render"]);
  assert.match(calls.at(-1)[1], /previous document draft/);
  r.results.item.oc = "corrected";
  r.date = "2026-10-25";
  d.items[0].text = "later";
  assert.equal(api.restorePreviousDraft(r), true);
  const restored = s.DOCS[0];
  assert.deepEqual(restored, oldDraft);
  assert.equal(r.date, "2026-10-20");
  assert.equal(r.results.item.oc, "none");
  assert.equal(r.docId, oldDraft.id);
  assert.equal("previousDraft" in r, false);
  assert.equal("previousWorksheet" in r, false);
  assert.equal(s.state.screen, "write");
  assert.deepEqual(calls.slice(-2), ["save", "render"]);
  assert.equal(api.restorePreviousDraft(r), false);
  reset();
  r.docId = d.id;
  d.pendingAmendment = {};
  const pendingBefore = copy(s);
  assert.equal(api.discardWorksheet(r.id), false);
  assert.deepEqual(s, pendingBefore);
  assert.match(calls.at(-1)[1], /Confirm the pending/);
  delete d.pendingAmendment;
  calls = [];
  assert.equal(api.discardWorksheet(r.id), false);
  assert.equal(s.state.screen, "write");
  assert.deepEqual(calls[0], "render");
  assert.match(calls.at(-1)[1], /Review inspection/);
  delete r.docId;
  calls = [];
  assert.equal(api.discardWorksheet(r.id), true);
  assert.equal(s.REINSP.length, 0);
  assert.equal(s.state.reinspId, null);
  assert.equal(s.WORK.walk, null);
  assert.deepEqual(calls, ["clearWalk", "save", "render"]);
  assert.equal(api.discardWorksheet("missing"), false);
  console.log(
    JSON.stringify({
      passed: true,
      dependencies: used.size,
      inertConstruction: true,
      worksheetAndDeadlineGuards: true,
      dateAndCloneSemantics: true,
      reversibleDrafts: true,
      discardRefusals: true,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
