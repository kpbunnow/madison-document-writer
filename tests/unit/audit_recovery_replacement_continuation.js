/* Recovery must recheck issued history after the asynchronous safety-copy write. */
const assert = require("node:assert/strict"),
  { compile } = require("../fixtures/equivalence_harness.cjs");

globalThis.__TEST_BUILD__ = false;

(async () => {
  const { createCaseRecovery, WriterState: s } = await compile('export {createCaseRecovery} from "./case_recovery.js";');
  for (const change of ["none", "note", "identity"]) {
    const k = { id: "one", number: "QA-RECOVERY" },
      history = [
        {
          id: "issued-event",
          type: "notice.issued",
          at: "2026-11-28T12:00:00Z",
          payload: {
            snapshot: {
              id: "issued",
              caseId: k.id,
              type: "notice",
              authoringVersion: 9,
              items: [],
              frozen: { case: k, body: "Retained issued document" },
            },
          },
        },
      ],
      b = {
        format: "madison-draft-recovery",
        version: 1,
        workspace: "a".repeat(32),
        case: "b".repeat(32),
        number: k.number,
        at: "2026-11-28",
        pending: [],
        bundle: {
          cases: [k],
          docs: [{ id: "draft", caseId: k.id, draft: true, items: [] }],
          reinsp: [],
          events: { one: history },
          work: { entry: {}, recordForms: {} },
        },
      },
      row = { workspace: b.workspace, case: b.case, number: b.number },
      writes = [],
      notices = [];
    Object.assign(s, {
      CASES: [structuredClone(k)],
      DOCS: [{ ...structuredClone(history[0].payload.snapshot), draft: false }],
      REINSP: [],
      EVENTS: { one: structuredClone(history) },
      WORK: { entry: {}, recordForms: {} },
      RECORD_ATTEMPTS: {},
      SAVE_CHECKPOINTS: {},
      PENDING: [],
      seq: 1,
      state: { modal: "recovery", screen: "tools" },
      RECOVERY: { selected: b, list: [row] },
      RECOVERY_SELECT_SEQ: 0,
    });
    let release;
    const owner = createCaseRecovery({
      render() {},
      toast: (text) => notices.push(text),
      async helperJSON(url) {
        if (url.startsWith("/cases/resolve?")) return { file: { format: "madison-case-file", schema: 5, case: k, events: history, inspectors: [] } };
        assert.equal(url, "/draft-backups/write");
        await new Promise((resolve) => {
          release = resolve;
        });
        return { ok: true };
      },
      compareSharedCase: () => ({ kind: "equal" }),
      caseUnsaved: () => "local work",
      recoverySnapshot: () => structuredClone(b),
      recoveryCaseKey: () => b.case,
      RECOVERY_WORKSPACE: b.workspace,
      confirm: () => true,
      IDB_OK: false,
      idbGet: async () => [],
      async idbSet(key, value) {
        writes.push([key, structuredClone(value)]);
        return true;
      },
      draftBundle: () => ({ work: structuredClone(s.WORK) }),
      clearWalk() {},
      async refreshArtifactLocations() {},
    });
    assert.equal(owner.validateRecovery(b, row), true);
    const restoring = owner.restoreRecovery();
    await new Promise(setImmediate);
    assert.equal(typeof release, "function", "the real owner is waiting for its safety copy");
    assert.deepEqual(writes, [], "no recovery storage change before confirmation");
    if (change === "note")
      s.EVENTS.one.push({
        id: "confirmed-note",
        type: "document.annotated",
        at: "2026-11-28T12:01:00Z",
        payload: { docId: "issued", text: "Newly confirmed record note" },
      });
    if (change === "identity") s.CASES = [{ ...k, id: "replacement-local-id" }];
    const current = structuredClone({ cases: s.CASES, events: s.EVENTS });
    release();
    await restoring;
    if (change === "none") {
      assert.ok(s.DOCS.some((d) => d.id === "draft" && d.draft));
      assert.deepEqual(
        writes.map(([key]) => key),
        ["pending", "drafts"],
      );
      assert.match(notices.at(-1), /No document was issued/);
    } else {
      assert.deepEqual({ cases: s.CASES, events: s.EVENTS }, current, "newly confirmed history/identity is preserved");
      assert.deepEqual(writes, [], "stale recovery cannot replace durable drafts or pending work");
      assert.match(notices.at(-1), change === "note" ? /different issued history/ : /identity conflicts/);
    }
  }
  console.log("PASS recovery safety-copy continuation: ordinary restore, confirmed history and replaced local identity");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
