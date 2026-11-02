/* A workspace backup whose retained integrity records are malformed is refused before anything is written, so
   a restart cannot meet the invalid state; well-formed records restore as before. */
const assert = require("node:assert/strict"),
  { compile } = require("../fixtures/equivalence_harness.cjs");

globalThis.__TEST_BUILD__ = true;

function backup(integrityRecords) {
  return {
    format: "madison-workspace-backup",
    version: 2,
    bundle: { cases: [], docs: [], reinsp: [], events: {}, integrityRecords },
  };
}

(async () => {
  const api = await compile('export {createWorkspaceBackup} from "./workspace_backup.js";');
  const writes = [],
    restored = [];
  const reset = () => {
    Object.assign(api.WriterState, {
      CASES: [],
      DOCS: [],
      REINSP: [],
      EVENTS: {},
      PENDING: [],
      RECORD_ATTEMPTS: {},
      SAVE_CHECKPOINTS: {},
      seq: 0,
      WORK: { entry: {}, recordForms: {} },
      state: { screen: "tools", modal: null },
    });
    writes.length = restored.length = 0;
  };
  const services = {
    hasSetupWork: () => false,
    draftBundle: () => ({ seq: 0 }),
    idbSet: async (key, value) => (writes.push([key, structuredClone(value)]), true),
    recordIntegrity: { restore: async (records) => restored.push(structuredClone(records)) },
    render: () => {},
    saveDrafts: async () => true,
    refreshArtifactLocations: async () => {},
    toast: () => {},
  };
  const owner = api.createWorkspaceBackup(services);
  for (const bad of [[null], ["text"], [[]], [7], "records", {}, [{ ok: 1 }, null], 0, [{ note: "\ud800" }], [{ n: Infinity }]]) {
    reset();
    await assert.rejects(owner.restoreWorkspaceBackup(backup(bad)), /invalid integrity records/, JSON.stringify(bad));
    assert.deepEqual(writes, [], "nothing is written for " + JSON.stringify(bad));
    assert.deepEqual(restored, []);
  }
  // Exercise the actual integrity owner: malformed input cannot reach the persistent store or live proofs.
  const real = await compile('export {initRecordIntegrity} from "./record_integrity.js";');
  const integrity = real.initRecordIntegrity({ state: {} });
  const actualOwner = api.createWorkspaceBackup({ ...services, recordIntegrity: integrity });
  reset();
  await assert.rejects(actualOwner.restoreWorkspaceBackup(backup([{ note: "\ud800" }])), /invalid integrity records/);
  assert.deepEqual(writes, []);
  assert.deepEqual(integrity.snapshot(), []);
  // A real WebCrypto await must not let newly entered work be overwritten by the pending restore.
  reset();
  let releaseDigest;
  const digestGate = new Promise((resolve) => (releaseDigest = resolve));
  const digest = crypto.subtle.digest;
  crypto.subtle.digest = async (...args) => {
    await digestGate;
    return digest.apply(crypto.subtle, args);
  };
  try {
    const pending = actualOwner.restoreWorkspaceBackup(backup([{ schema: 5, case: { number: "QA-001" }, events: [], integrity: { genesis: {} } }]));
    await new Promise((resolve) => setImmediate(resolve));
    api.WriterState.CASES.push({ id: "new-work", number: "QA-002" });
    releaseDigest();
    await assert.rejects(pending, /empty workspace/);
    assert.deepEqual(writes, []);
    assert.equal(api.WriterState.CASES[0].id, "new-work");
  } finally {
    crypto.subtle.digest = digest;
  }
  for (const good of [undefined, [], [{ case: { number: "BLD2026-00001" } }], [{ retained: "proof" }]]) {
    reset();
    assert.equal(await owner.restoreWorkspaceBackup(backup(good)), true);
    assert.equal(writes[0][0], "drafts");
    assert.deepEqual(restored[0], good || []);
  }
  console.log("PASS backup integrity records are validated before persistence");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
