/* Record-action dialog against the retained module: exact markup for every mode, held attempt, saved form and error
   state, escaping, and every peer read in order. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile, prng, recorder } = require("../fixtures/equivalence_harness.cjs");

globalThis.__TEST_BUILD__ = true;
const { random, pick, chance } = prng(20261207);

function scenario(inspectors) {
  const mode = pick(["void", "recordnote", "reconcile", "other", null]);
  const docType = pick(["notice", "citation", "referral", "extension", "summaryAbatement", "noOccupancy"]);
  const kind = { void: "document.voided", recordnote: "document.annotated", reconcile: "document.reconciled" }[mode] || "document.voided";
  return {
    mode,
    docId: pick(["doc", "doc", "doc", "gone"]),
    docType,
    held: chance(3)
      ? {
          cid: pick(["case", "case", "other"]),
          pendingAmendment: {
            type: pick([kind, kind, "document.voided"]),
            by: pick(inspectors),
            payload: {
              docId: pick(["doc", "doc", "x"]),
              ...pick([
                { reason: "Held <reason>" },
                { text: "Held note" },
                { reference: "Held ref" },
                { reason: "", text: "Held note", reference: "Held ref" },
                { text: "T", reference: "R" },
                {},
              ]),
              externalReference: pick(["", "Ext & ref"]),
            },
          },
        }
      : null,
    form: pick([undefined, { text: "Saved <b>text</b>", external: "Saved ext" }, { text: "" }]),
    error: pick(["", "", "Save failed <now>"]),
    inspectorId: pick(inspectors),
    fail: chance(3) ? 1 + random(6) : 0,
  };
}

function run(api, sc) {
  const x = structuredClone(sc),
    calls = [],
    state = api.WriterState;
  Object.assign(state, {
    CASES: [{ id: "case", number: "BLD2026-00001", inspectorId: x.inspectorId }],
    DOCS: [{ id: "doc", caseId: "case", type: x.docType, draft: false }],
    RECORD_ATTEMPTS: x.held ? { k: x.held } : {},
    WORK: { entry: {}, recordForms: x.form ? { ["doc:" + x.mode]: x.form } : {} },
    state: { modal: x.mode, docId: x.docId, amendmentError: x.error },
  });
  const services = recorder(calls, {}, {}, x.fail);
  const owner = api.createCorrectionUI(services);
  assert.deepEqual(calls, [], "construction remains inert");
  let value, error;
  try {
    value = owner.recordActionModal();
  } catch (e) {
    error = [e.name, e.message];
  }
  return JSON.stringify({ value, error, calls });
}

(async () => {
  const [current, legacy] = await Promise.all([
    compile('export {createCorrectionUI} from "./correction_ui.js";'),
    compile(fs.readFileSync("tests/fixtures/correction_ui_reference.txt", "utf8")),
  ]);
  const inspectors = current.INSPECTORS.map((i) => i.id);
  const seen = new Set();
  for (let n = 0; n < 6000; n++) {
    const sc = scenario(inspectors);
    const [before, after] = [run(legacy, sc), run(current, sc)];
    assert.equal(after, before, `record action scenario ${n} differs from the retained module:\n${JSON.stringify(sc)}`);
    const html = JSON.parse(after).value || "";
    for (const f of [
      "Withdraw this document",
      "Add a record note",
      "Record follow-through",
      "awaiting confirmation",
      "banner alert",
      "record-action-external",
      "Confirm previous save",
      "Confirm withdrawal",
      "Save to case record",
      "disabled",
      "Saved &lt;b&gt;",
      "Held &lt;reason&gt;",
      "Held note",
      "Held ref",
      "selected",
    ])
      if (html.includes(f)) seen.add(f);
    if (!html) seen.add("empty");
  }
  for (const f of [
    "Withdraw this document",
    "Add a record note",
    "Record follow-through",
    "awaiting confirmation",
    "banner alert",
    "record-action-external",
    "Confirm previous save",
    "Confirm withdrawal",
    "Save to case record",
    "Saved &lt;b&gt;",
    "Held &lt;reason&gt;",
    "Held note",
    "Held ref",
    "selected",
    "empty",
  ])
    assert.ok(seen.has(f), "scenarios reach: " + f);
  console.log("PASS record-action dialog matches the retained module over 6000 scenarios");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
