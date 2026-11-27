/* Individual recovery keeps its retained proofs, including invalid read-only evidence, after durable acknowledgment. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { compile } = require("../fixtures/equivalence_harness.cjs");
globalThis.__TEST_BUILD__ = true;

(async () => {
  const api = await compile(
    'export {createCaseRecovery} from "./case_recovery.js"; export {initRecordIntegrity,verifyIntegrity} from "./record_integrity.js";',
  );
  const original = JSON.parse(fs.readFileSync("tests/fixtures/reference/integrity-case.json", "utf8"));
  const copy = (v) => structuredClone(v);
  function setup(proof, retained = []) {
    const k = copy(proof.case),
      cid = k.id,
      b = {
        format: "madison-draft-recovery",
        version: 1,
        workspace: "a".repeat(32),
        case: "b".repeat(32),
        number: k.number,
        at: "2026-11-27",
        pending: [],
        bundle: {
          cases: [k],
          docs: [],
          reinsp: [],
          events: { [cid]: copy(proof.events) },
          recordAttempts: {},
          checkpoints: {},
          seq: 30,
          work: { entry: {}, recordForms: {} },
          integrityRecords: [copy(proof)],
        },
      },
      row = { workspace: b.workspace, case: b.case, number: b.number },
      s = api.WriterState;
    Object.assign(s, {
      CASES: [],
      DOCS: [],
      REINSP: [],
      EVENTS: {},
      RECORD_ATTEMPTS: {},
      SAVE_CHECKPOINTS: {},
      PENDING: [],
      WORK: { entry: {}, recordForms: {} },
      seq: 0,
      state: { screen: "tools", modal: "recovery" },
      RECOVERY: { selected: b, list: [row] },
      RECOVERY_SELECT_SEQ: 0,
    });
    const integrity = api.initRecordIntegrity({ store: s, kase: (id) => s.CASES.find((c) => c.id === id) || {} }),
      disk = { drafts: {}, pending: [] },
      writes = [],
      notices = [],
      control = { fail: false, hold: false, release: null };
    const owner = api.createCaseRecovery({
      recordIntegrity: integrity,
      render() {},
      async helperJSON() {
        throw Error("Synthetic share offline");
      },
      draftBundle: () => ({
        cases: copy(s.CASES),
        docs: [],
        reinsp: [],
        events: copy(s.EVENTS),
        work: copy(s.WORK),
        integrityRecords: integrity.snapshot().concat(copy(retained)),
      }),
      IDB_OK: false,
      async idbGet(key) {
        return disk[key];
      },
      async idbSet(key, value) {
        writes.push([key, copy(value)]);
        if (key === "drafts" && control.hold)
          await new Promise((resolve) => {
            control.release = resolve;
          });
        if (key === "drafts" && control.fail) {
          control.fail = false;
          return false;
        }
        disk[key] = copy(value);
        return true;
      },
      toast(value) {
        notices.push(value);
      },
      clearWalk() {},
      async refreshArtifactLocations() {},
    });
    return { owner, integrity, disk, writes, notices, control, b, row, s };
  }
  for (const tampered of [false, true]) {
    const proof = copy(original);
    if (tampered) proof.case.owner = "Synthetic outside rewrite";
    const verdict = await api.verifyIntegrity(proof);
    assert.equal(verdict.valid, !tampered);
    const unrelated = { ...copy(original), case: { ...original.case, id: "other", number: "QA-OTHER" } };
    const run = setup(proof, [unrelated]);
    assert.equal(run.owner.validateRecovery(run.b, run.row), true);
    await run.owner.restoreRecovery();
    assert.equal(run.s.CASES.length, 1);
    assert.deepEqual(run.disk.drafts.integrityRecords, [unrelated, proof]);
    assert.deepEqual(run.integrity.snapshot(), [proof]);
    assert.equal(run.integrity.status(proof.case).valid, !tampered, "invalid evidence must remain read-only when offline");
    assert.match(run.notices.at(-1), /No document was issued/);
  }
  const failed = setup(original);
  failed.control.fail = true;
  await failed.owner.restoreRecovery();
  assert.deepEqual(failed.s.CASES, []);
  assert.deepEqual(failed.integrity.snapshot(), []);
  assert.match(failed.notices.at(-1), /previous work was retained/);

  const held = setup(original);
  held.control.hold = true;
  const restoring = held.owner.restoreRecovery();
  while (!held.control.release) await new Promise(setImmediate);
  assert.deepEqual(held.integrity.snapshot(), [], "no proof enters live state before storage acknowledgment");
  assert.deepEqual(held.s.CASES, []);
  held.control.release();
  await restoring;
  assert.equal(held.integrity.status(original.case).valid, true);
  assert.deepEqual(held.disk.drafts.integrityRecords, [original]);

  for (const bad of [
    null,
    "records",
    {},
    [null],
    [[]],
    [7],
    [{ ...original, case: { ...original.case, number: "QA-OTHER" } }],
    [{ ...original, extra: "\ud800" }],
  ]) {
    const run = setup(original);
    run.b.bundle.integrityRecords = bad;
    assert.throws(() => run.owner.validateRecovery(run.b, run.row), /integrity records/);
    await run.owner.restoreRecovery();
    assert.deepEqual(run.writes, [], "invalid evidence must be refused before persistence");
    assert.deepEqual(run.integrity.snapshot(), []);
  }
  const legacy = setup(original);
  delete legacy.b.bundle.integrityRecords;
  await legacy.owner.restoreRecovery();
  assert.equal(legacy.s.CASES.length, 1, "older backups without the optional evidence field still restore");
  const aliased = setup(original),
    oldId = original.case.id;
  aliased.b.bundle.cases[0].id = "local_case_alias";
  const events = aliased.b.bundle.events[oldId];
  for (const event of events) {
    if (event.payload?.snapshot?.caseId === oldId) event.payload.snapshot.caseId = "local_case_alias";
    if (event.payload?.reinspection?.caseId === oldId) event.payload.reinspection.caseId = "local_case_alias";
  }
  aliased.b.bundle.events = { local_case_alias: events };
  await aliased.owner.restoreRecovery();
  assert.equal(aliased.s.CASES[0].id, "local_case_alias");
  assert.deepEqual(aliased.disk.drafts.integrityRecords, [original], "a local case alias never rewrites the retained shared proof");
  console.log(
    "PASS individual recovery persists and restores scoped integrity evidence after acknowledgment, retaining invalid verdicts and older backups",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
