/* Both inspection consumers use the real pure calculation, at their original live-read checkpoint. */
const assert = require("node:assert/strict"),
  { compile } = require("../fixtures/equivalence_harness.cjs");
(async () => {
  const api = await compile(
    `export {createWorksheetWorkflow} from './worksheet_workflow.js';export {createReinspectionEntry} from './reinspection_entry.js';export {sourceDocFor} from './writer_queries.js';`,
  );
  const s = api.WriterState,
    actor = api.INSPECTORS.find((i) => i.name).id;
  const source = {
    id: "source",
    caseId: "case",
    type: "notice",
    inspDate: "2026-01-01",
    items: [
      { id: "one", no: "1" },
      { id: "two", no: "2" },
      { id: "three", no: "3" },
      { id: "four", no: "4", withdrawn: true },
    ],
    frozen: { case: { id: "case", date: "2026-01-01" } },
  };
  const visit = (id, item, extra = {}) => ({
    id,
    caseId: "case",
    sourceDocId: "source",
    date: "2026-02-01",
    results: { [item]: { oc: "corrected", on: "2026-02-01" } },
    ...extra,
  });
  const reset = () =>
    Object.assign(s, {
      CASES: [{ id: "case", inspectorId: actor }],
      DOCS: [structuredClone(source)],
      REINSP: [],
      EVENTS: { case: [] },
      WORK: { walk: null },
      state: {},
      DIRTY: false,
    });
  let uidHook = () => {},
    trace = [];
  const services = {
    snow: { isCase: () => false },
    recordIntegrity: { blocked: () => false },
    clearWalk: () => trace.push("clear"),
    restoreWalkFor: () => {},
    uid: () => {
      trace.push("uid");
      uidHook();
      return "new";
    },
    saveDrafts: () => trace.push("save"),
    render: () => trace.push("render"),
    sourceDocFor: () => s.DOCS[0],
    unissuedVisitFor: () => null,
    today: "2026-03-01",
    toast: () => {},
    dueCheck: () => ({ ok: true }),
  };
  const entry = api.createReinspectionEntry(services),
    worksheet = api.createWorksheetWorkflow(services);
  reset();
  s.REINSP = [visit("prior", "one"), visit("wrong", "three", { sourceDocId: "other" })];
  entry.startReinspection("case");
  let r = s.REINSP.at(-1);
  assert.equal(r.results.one.carried, true);
  assert.equal(r.results.one.on, "2026-02-01");
  assert.equal(r.results.two, undefined);
  assert.equal(r.results.three, undefined);
  assert.equal(r.results.four.oc, "withdrawn");
  Object.assign(r, {
    date: "2026-03-01",
    time: "10:00",
    results: { ...r.results, two: { oc: "none", on: "2026-03-01" }, three: { oc: "none", on: "2026-03-01" } },
  });
  s.REINSP.push(visit("draft", "two", { draft: true }));
  assert.deepEqual(worksheet.worksheetFaults(r), []);
  r.results.one.carried = false;
  assert.ok(worksheet.worksheetFaults(r).includes("Previously confirmed compliance must carry forward unchanged."));
  r.results.one.carried = true;
  // Replacement and in-place edits must both be read on the next attempt, with no retained calculation.
  s.REINSP = [r, visit("replacement", "two")];
  assert.ok(worksheet.worksheetFaults(r).includes("Previously confirmed compliance must carry forward unchanged."));
  s.REINSP[1].results.two.oc = "none";
  assert.deepEqual(worksheet.worksheetFaults(r), []);
  // Its own result must not become prior compliance, even if a stale copy lacks the draft marker.
  r.draft = false;
  r.results.two = { oc: "corrected", on: "2026-03-01" };
  assert.deepEqual(worksheet.worksheetFaults(r), []);
  // Read visits AFTER uid/current-day preparation: a callback can replace the live array synchronously.
  reset();
  trace = [];
  uidHook = () => {
    s.REINSP = [visit("late", "three")];
  };
  entry.startReinspection("case");
  r = s.REINSP.at(-1);
  assert.equal(r.results.one, undefined);
  assert.equal(r.results.three.carried, true);
  assert.deepEqual(trace, ["clear", "uid", "save", "render"]);
  // A second attempt uses current source and current visits, not earlier carried state.
  reset();
  uidHook = () => {};
  s.REINSP = [visit("later", "two")];
  entry.startReinspection("case");
  r = s.REINSP.at(-1);
  assert.equal(r.results.two.carried, true);
  assert.equal(r.results.three, undefined);
  console.log(
    "PASS continuing-item consumers: true prior compliance, exclusions, own-visit omission, array/in-place replacement and post-uid live reads",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
