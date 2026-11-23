/* Selection regressions exercise the maintained owner; historical assertions remain independently unchanged. */
const assert = require("node:assert/strict"),
  { compile } = require("../fixtures/equivalence_harness.cjs");
global.__TEST_BUILD__ = false;
(async () => {
  const { createCaseRecovery, WriterState: s } = await compile('export {createCaseRecovery} from "./case_recovery.js";');
  let requests = [];
  const api = createCaseRecovery({
    render() {},
    helperJSON(url, body) {
      return new Promise((resolve, reject) => requests.push({ url, body, resolve, reject }));
    },
  });
  const backup = {
      format: "madison-draft-recovery",
      version: 1,
      workspace: "a".repeat(32),
      case: "b".repeat(32),
      at: "2026-11-23T12:00:00Z",
      pending: [],
      bundle: { cases: [], docs: [], reinsp: [], events: {}, work: { recordForms: {} } },
    },
    row = { workspace: backup.workspace, case: backup.case, name: "first.json" },
    other = { ...row, name: "second.json" };
  function reset() {
    requests = [];
    Object.assign(s, { RECOVERY_SELECT_SEQ: 0, RECOVERY: { list: [row], selected: null, shared: null }, state: { modal: "recovery" } });
  }
  reset();
  const oldSelection = api.selectRecovery(row),
    reopened = api.listRecovery();
  assert.deepEqual(
    requests.map((r) => r.url),
    ["/draft-backups/read", "/draft-backups/list"],
  );
  requests[1].resolve({ backups: [other] });
  await reopened;
  requests[0].resolve({ backup });
  await oldSelection;
  assert.equal(s.RECOVERY.selected, null, "reopening the list invalidates an earlier selection");
  assert.equal(s.RECOVERY.selectedRow, null);

  reset();
  const oldList = api.listRecovery(),
    newerList = api.listRecovery();
  requests[1].resolve({ backups: [other] });
  await newerList;
  requests[0].resolve({ backups: [row] });
  await oldList;
  assert.deepEqual(s.RECOVERY.list, [other], "an older list cannot replace a newer result");

  reset();
  const pendingList = api.listRecovery(),
    imported = { ...other, imported: backup };
  s.RECOVERY.list = [imported];
  await api.selectRecovery(imported);
  requests[0].resolve({ backups: [row] });
  await pendingList;
  assert.equal(s.RECOVERY.selected, backup);
  assert.equal(s.RECOVERY.selectedRow, imported, "the chosen source remains separate from backup payload identity");
  assert.deepEqual(s.RECOVERY.list, [imported], "an import supersedes a pending list");
  assert.equal(s.RECOVERY.loading, false);
  assert.equal("selectedRow" in backup, false, "source row identity is not added to the stored format");

  reset();
  const first = api.selectRecovery(row),
    second = api.selectRecovery(other);
  requests[1].resolve({ backup });
  await second;
  requests[0].resolve({ backup: structuredClone(backup) });
  await first;
  assert.equal(s.RECOVERY.selectedRow, other);
  assert.equal(s.RECOVERY.selected, backup, "late reads cannot replace the latest selection");

  reset();
  const closedList = api.listRecovery();
  s.state.modal = null;
  requests[0].resolve({ backups: [other] });
  await closedList;
  assert.equal(s.state.modal, null);
  assert.deepEqual(s.RECOVERY.list, [row], "a closed dialog ignores a late list");

  reset();
  const staleFailure = api.listRecovery(),
    accepted = api.listRecovery();
  requests[1].resolve({ backups: [other] });
  await accepted;
  requests[0].reject(Error("stale read failed"));
  await staleFailure;
  assert.equal(s.RECOVERY.error, "", "superseded failures cannot replace current feedback");
  assert.deepEqual(s.RECOVERY.list, [other]);
  console.log("PASS recovery source identity, superseded list/selection reads, import while loading and stale failures");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
