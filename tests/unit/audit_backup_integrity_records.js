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
  for (const bad of [[null], ["text"], [[]], [7], "records", {}, [{ ok: 1 }, null], 0]) {
    reset();
    await assert.rejects(owner.restoreWorkspaceBackup(backup(bad)), /invalid integrity records/, JSON.stringify(bad));
    assert.deepEqual(writes, [], "nothing is written for " + JSON.stringify(bad));
    assert.deepEqual(restored, []);
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
