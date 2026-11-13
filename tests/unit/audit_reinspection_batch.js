/* Reinspection worksheet "Mark the rest" (owner direction 2026-11-13): only items with no result are given the chosen
   outcome, through the ordinary single-item recorder; resulted, carried and withdrawn items are untouched; Undo clears
   only what the step set; nothing happens in One item at a time, on another screen or for an unknown outcome. */
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { compile } = require("../fixtures/equivalence_harness.cjs");

(async () => {
  global.document = new JSDOM("<!doctype html><body></body>").window.document;
  const api = await compile('export * from "./reinspection_batch.js";');
  const s = api.WriterState;
  const fresh = () => {
    Object.assign(s, {
      state: { screen: "reinspect", reinspId: "r1", riWalk: false },
      DOCS: [
        {
          id: "src",
          caseId: "k",
          items: [{ id: "a" }, { id: "b" }, { id: "c", withdrawn: true }, { id: "d" }, { id: "e" }],
        },
      ],
      REINSP: [{ id: "r1", caseId: "k", sourceDocId: "src", draft: true, results: { b: { oc: "progress" }, d: { carried: true } } }],
      DIRTY: false,
    });
    return s.REINSP[0];
  };
  const calls = [];
  let undo = null,
    refuse = "";
  const services = {
    recordReinspectionOutcome: (id, outcome) => {
      calls.push([id, outcome]);
      if (id === refuse) return false;
      s.REINSP[0].results[id] = { oc: outcome };
      return true;
    },
    toastUndo: (text, fn) => {
      calls.push(["toast", text]);
      undo = fn;
    },
    saveDrafts: () => calls.push(["save"]),
    render: () => calls.push(["render"]),
  };
  let r = fresh();
  assert.deepEqual(
    api.unresultedItems(r).map((i) => i.id),
    ["a", "e"],
    "resulted, carried and withdrawn items are not waiting",
  );
  assert.equal(api.recordRemaining(services, "corrected"), 2);
  assert.deepEqual(calls, [
    ["a", "corrected"],
    ["e", "corrected"],
    ["toast", "2 items marked Corrected. Change any that differ."],
  ]);
  assert.equal(r.results.b.oc, "progress", "an existing result is never overwritten");
  r.results.e = { oc: "noaccess" };
  undo();
  assert.equal(r.results.a, undefined, "Undo clears what the step set");
  assert.equal(r.results.e.oc, "noaccess", "Undo leaves an item changed since");
  assert.equal(s.DIRTY, true);
  assert.deepEqual(calls.slice(-2), [["save"], ["render"]]);

  for (const [change, outcome] of [
    [() => (s.state.riWalk = true), "corrected"],
    [() => (s.state.screen = "write"), "corrected"],
    [() => (s.state.reinspId = "missing"), "corrected"],
    [() => {}, "progress"],
    [() => {}, "withdrawn"],
  ]) {
    r = fresh();
    change();
    calls.length = 0;
    assert.equal(api.recordRemaining(services, outcome), 0);
    assert.deepEqual(calls, [], "refused without touching the worksheet");
  }
  r = fresh();
  refuse = "a";
  calls.length = 0;
  assert.equal(api.recordRemaining(services, "none"), 1, "an item the recorder refuses is not counted");
  assert.equal(calls.at(-1)[1], "1 item marked No change. Change any that differ.");
  console.log("PASS reinspection Mark the rest: unresulted items only, ordinary recorder, safe Undo, refused outside the worksheet");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
