/* Three-way shared case comparison, field choices and durable workspace staging, against the real language catalog
   owner with the real record-integrity, working-papers and draft-persistence owners
   (tests/fixtures/shared_case_workflow.cjs). Browser storage is the boundary. */
const assert = require("assert/strict");
const createSharedCaseWorkflow = require("../fixtures/shared_case_workflow.cjs");
async function test() {
  const h = await createSharedCaseWorkflow(),
    { WriterState, clone } = h,
    { compareSharedCase, resolvedCaseFields, persistWorkspacePatch } = h.catalog;
  global.fetch = async () => ({ ok: true, json: async () => ({ ok: true, caseStore: true, version: "2026.10.02.25" }) });
  WriterState.CASEDIR = { helper: true };
  const local = { id: "case-merge", number: "QA-MERGE", owner: "Mine", address: "Base street", parcel: "Local parcel" },
    base = { ...local, owner: "Base", parcel: "Base parcel" },
    shared = { format: "madison-case-file", schema: 3, case: { ...base, owner: "Shared", address: "Shared street" }, inspectors: [], events: [] };
  const cmp = compareSharedCase(local, [], shared, { case: base, events: [] }, false);
  assert.equal(cmp.kind, "conflict");
  const merged = resolvedCaseFields(local, shared.case, cmp, { owner: { kind: "merge", value: "Reviewed owner" } });
  assert.equal(merged.owner, "Reviewed owner");
  assert.equal(merged.parcel, "Local parcel");
  assert.equal(merged.address, "Shared street");
  assert.equal(merged.id, local.id);
  assert.equal(merged.number, local.number);
  assert.throws(() => resolvedCaseFields(local, shared.case, cmp, {}));
  assert.throws(() => resolvedCaseFields(local, shared.case, cmp, { owner: { kind: "merge", value: { unexpected: true } } }));
  const spell = { ...shared, case: { ...local, number: "qa-merge" } };
  assert.notEqual(compareSharedCase(local, [], spell, { case: local, events: [] }, false).kind, "invalid");
  WriterState.CASES = [local];
  WriterState.DOCS = [];
  WriterState.REINSP = [];
  WriterState.EVENTS = {};
  WriterState.WORK = { entry: {}, recordForms: {} };
  WriterState.SAVE_CHECKPOINTS = {};
  WriterState.RECORD_ATTEMPTS = {};
  WriterState.LOCAL_SAVE_CHAIN = Promise.resolve();
  let committed = false;
  h.bound.idbSet = async () => false;
  await assert.rejects(
    persistWorkspacePatch(
      (x) => x,
      () => {
        committed = true;
      },
    ),
  );
  assert.equal(committed, false);
  assert.equal(WriterState.WORK_PATCH, null);
  assert.equal(WriterState.CASES[0].owner, "Mine");
  let stored = null;
  h.bound.idbSet = async (key, value) => {
    stored = clone(value);
    return true;
  };
  await persistWorkspacePatch(
    (staged) => {
      staged.cases[0].owner = "Reviewed";
      return staged;
    },
    (staged) => {
      WriterState.CASES = staged.cases;
    },
  );
  assert.equal(WriterState.CASES[0].owner, "Reviewed");
  assert.equal(stored.cases[0].owner, "Reviewed");
  assert.equal(WriterState.WORK_PATCH, null);
  console.log("PASS three-way field choices, independent changes, identity, type safety and durable workspace staging");
  process.exit(0);
}
test().catch((e) => {
  console.error(e);
  process.exit(1);
});
